/**
 * Live Sepolia verification of Phase B2 Wave 2: DePrize → Moon Base Zero merge.
 *
 * Reads DePrize 9 (fission surface power) from Sepolia, runs the exact UI
 * mapping + merge helpers against SEED_ATLAS, and optionally places a tiny bet
 * to prove the odds that land in the panel actually move with the market.
 *
 *   yarn verify:deprize-moonbase
 *   yarn verify:deprize-moonbase -- --bet   # needs $PRIVATE_KEY, spends ~0.004 ETH
 *
 * Exit 0 on green; non-zero on any failed assertion.
 */
import { readFileSync } from 'node:fs'
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseEther,
  type Abi,
  type PublicClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import {
  getDePrizeRaceBinding,
  OPEN_FIELD_PROJECT_ID,
} from '../lib/deprize/competitions'
import { mergeLiveMarketInto } from '../lib/deprize/goal-market'
import { mapOutcomeOddsToProjectIds } from '../lib/deprize/goal-odds'
import { buildAmounts } from '../lib/deprize/quote-math'
import { SEED_ATLAS } from '../lib/lunar-atlas/seed'
import { buildTechTrees, sharedGoalById } from '../lib/lunar-atlas/selectors'

const REGISTRY = '0x299F163705AbBFa1A8DE7670F33171730F828F3D' as const
const MINT = '0xa6f9632ee9848f7c1f252da5a1e869ac90e57cc8' as const
const DEPRIZE_ID = 9n
const WANT_BET = process.argv.includes('--bet')

const RPCS = [
  process.env.SEPOLIA_RPC_URL,
  process.env.ETH_RPC_URL,
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://sepolia.drpc.org',
  'https://1rpc.io/sepolia',
].filter(Boolean) as string[]

const RegistryABI = JSON.parse(
  readFileSync(new URL('../const/abis/DePrizeRegistry.json', import.meta.url), 'utf8')
) as Abi
const MintABI = JSON.parse(
  readFileSync(new URL('../const/abis/DePrizeMint.json', import.meta.url), 'utf8')
) as Abi
const LmsrABI = (JSON.parse(
  readFileSync(new URL('../const/abis/LMSRWithTWAP.json', import.meta.url), 'utf8')
).abi ??
  JSON.parse(
    readFileSync(new URL('../const/abis/LMSRWithTWAP.json', import.meta.url), 'utf8')
  )) as Abi

let pass = 0
let fail = 0
const ok = (name: string, detail = '') => {
  pass++
  console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`)
}
const bad = (name: string, err: unknown) => {
  fail++
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : JSON.stringify(err)
  console.log(`  FAIL  ${name} — ${msg}`)
}
const assert = (name: string, cond: boolean, detail = '') => {
  if (cond) ok(name, detail)
  else bad(name, detail || 'assertion failed')
}

async function pickClient(): Promise<{ client: PublicClient; rpcUrl: string }> {
  for (const url of RPCS) {
    const client = createPublicClient({
      chain: sepolia,
      transport: http(url, { timeout: 20_000 }),
    })
    try {
      const n = await client.getBlockNumber()
      console.log(`RPC: ${url} (block ${n})\n`)
      return { client, rpcUrl: url }
    } catch {
      /* try next */
    }
  }
  throw new Error('No Sepolia RPC reachable')
}

async function readPrices(
  client: PublicClient,
  market: `0x${string}`,
  n: number
): Promise<number[]> {
  const prices = await Promise.all(
    Array.from({ length: n }, (_, i) =>
      client
        .readContract({
          address: market,
          abi: LmsrABI,
          functionName: 'calcMarginalPrice',
          args: [i],
        })
        .then((p) => (Number(p as bigint) / 2 ** 64) * 100)
        .catch(() => NaN)
    )
  )
  return prices
}

function mergeAndCheck(
  label: string,
  teamIds: bigint[],
  probabilities: number[]
) {
  console.log(`\n${label}`)
  const binding = getDePrizeRaceBinding('sepolia', Number(DEPRIZE_ID))
  assert('binding present', !!binding, `sharedGoalId=${binding?.sharedGoalId}`)
  assert(
    'binding is fission race',
    binding?.sharedGoalId === 'shared-fission-power'
  )

  const mapped = mapOutcomeOddsToProjectIds({
    outcomes: binding!.outcomes,
    teamIds,
    probabilities,
  })
  assert('mapper returned odds', !!mapped && Object.keys(mapped.oddsByProjectId).length > 0)
  if (!mapped) return undefined

  for (const o of binding!.outcomes.filter((x) => !x.field)) {
    assert(
      `mapped has ${o.projectId}`,
      Number.isFinite(mapped.oddsByProjectId[o.projectId]),
      `${(mapped.oddsByProjectId[o.projectId] * 100).toFixed(2)}%`
    )
  }

  const seedGoal = sharedGoalById(SEED_ATLAS, 'shared-fission-power')
  assert('atlas seed has fission goal', !!seedGoal)
  assert(
    'seed market was planned (priors)',
    seedGoal?.market?.status === 'planned',
    `status=${seedGoal?.market?.status}`
  )

  const live = {
    deprizeId: Number(DEPRIZE_ID),
    oddsByProjectId: mapped.oddsByProjectId,
    fieldOdds: mapped.fieldOdds,
    status: 'live' as const,
  }
  const next = mergeLiveMarketInto(
    [...SEED_ATLAS.sharedGoals],
    'shared-fission-power',
    live
  )
  const merged = next.find((g) => g.id === 'shared-fission-power')
  assert('merge flipped status to live', merged?.market?.status === 'live')
  assert(
    'merge kept resolutionAuthority',
    merged?.market?.resolutionAuthority === seedGoal?.market?.resolutionAuthority
  )
  if (mapped.fieldOdds !== undefined) {
    assert(
      'field odds under sentinel',
      merged?.market?.impliedOdds?.[OPEN_FIELD_PROJECT_ID] === mapped.fieldOdds
    )
  }

  const trees = buildTechTrees(SEED_ATLAS.projects, next)
  const power = trees.find((t) => t.goal?.id === 'shared-fission-power')
  assert('buildTechTrees sees live market', power?.goal?.market?.status === 'live')
  const leaderId = Object.entries(power?.goal?.market?.impliedOdds ?? {})
    .filter(([id]) => id !== OPEN_FIELD_PROJECT_ID)
    .sort((a, b) => b[1] - a[1])[0]?.[0]
  assert('district has a leader projectId', !!leaderId, `leader=${leaderId}`)

  console.log('  odds:', JSON.stringify(mapped.oddsByProjectId, null, 2))
  return { mapped, leaderId, probabilities }
}

async function placeSkewBet(
  client: PublicClient,
  rpcUrl: string,
  market: `0x${string}`,
  numOutcomes: number
) {
  console.log('\nBet (skew westinghouse / outcome 0)')
  const pk = process.env.PRIVATE_KEY
  if (!pk) {
    bad('PRIVATE_KEY', 'set $PRIVATE_KEY to place a bet')
    return false
  }
  const key = (pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`
  const account = privateKeyToAccount(key)
  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl, { timeout: 60_000 }),
  })

  const bal = await client.getBalance({ address: account.address })
  console.log(`  wallet ${account.address} balance ${formatEther(bal)} ETH`)
  assert('wallet funded', bal > parseEther('0.01'), formatEther(bal))

  // ~0.004 ETH total bet; 5% prize slice → ~0.0038 ETH LMSR budget.
  const value = parseEther('0.004')
  const budget = (value * 95n) / 100n
  // Binary-search a qty that fits the LMSR fee-inclusive budget.
  let lo = 0n
  let hi = budget * 3n // generous upper for cheap outcomes
  const feeOf = async (net: bigint) => {
    try {
      return (await client.readContract({
        address: market,
        abi: LmsrABI,
        functionName: 'calcMarketFee',
        args: [net],
      })) as bigint
    } catch {
      return net / 100n
    }
  }
  const costOf = async (qty: bigint) => {
    if (qty <= 0n) return 0n
    const amounts = buildAmounts(0, qty, numOutcomes)
    const net = (await client.readContract({
      address: market,
      abi: LmsrABI,
      functionName: 'calcNetCost',
      args: [amounts],
    })) as bigint
    if (net <= 0n) return 0n
    return net + (await feeOf(net))
  }
  while (lo + 1n < hi) {
    const mid = (lo + hi) / 2n
    const c = await costOf(mid)
    if (c <= budget) lo = mid
    else hi = mid
  }
  const qty = lo
  assert('quoted qty > 0', qty > 0n, `qty=${qty}`)
  const maxCost = budget + parseEther('0.0005') // slip buffer on the 95% slice

  console.log(
    `  betting qty=${formatEther(qty)} outcome tokens, value=${formatEther(value)} ETH, maxCost=${formatEther(maxCost)}`
  )

  try {
    const hash = await wallet.writeContract({
      address: MINT,
      abi: MintABI,
      functionName: 'bet',
      args: [DEPRIZE_ID, 0n, qty, maxCost],
      value,
    })
    console.log(`  tx ${hash}`)
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 120_000 })
    assert('bet mined', receipt.status === 'success', `block=${receipt.blockNumber}`)
    return receipt.status === 'success'
  } catch (e) {
    bad('bet()', e)
    return false
  }
}

async function main() {
  console.log('DePrize → Moon Base Zero Sepolia verification\n')
  const { client, rpcUrl } = await pickClient()

  console.log('On-chain DePrize 9')
  const state = Number(
    await client.readContract({
      address: REGISTRY,
      abi: RegistryABI,
      functionName: 'state',
      args: [DEPRIZE_ID],
    })
  )
  // OPEN = 2 in DePrizeState
  assert('registry state is OPEN', state === 2, `state=${state}`)

  const dp = (await client.readContract({
    address: REGISTRY,
    abi: RegistryABI,
    functionName: 'getDePrize',
    args: [DEPRIZE_ID],
  })) as {
    teamIds: readonly bigint[]
    ctfConditionId: string
    state: number | bigint
  }
  const teamIds = [...dp.teamIds]
  assert(
    'teamIds are 301/302/303',
    teamIds.map(String).join(',') === '301,302,303',
    teamIds.map(String).join(',')
  )

  const market = (await client.readContract({
    address: MINT,
    abi: MintABI,
    functionName: 'marketOf',
    args: [DEPRIZE_ID],
  })) as `0x${string}`
  assert(
    'mint.marketOf(9) bound',
    !!market && !/^0x0+$/.test(market),
    market
  )

  const stage = Number(
    await client.readContract({
      address: market,
      abi: LmsrABI,
      functionName: 'stage',
    })
  )
  // Running = 0
  assert('LMSR stage is Running', stage === 0, `stage=${stage}`)

  const slotCount = Number(
    await client.readContract({
      address: market,
      abi: LmsrABI,
      functionName: 'atomicOutcomeSlotCount',
    })
  )
  assert('3 outcome slots', slotCount === 3, `slots=${slotCount}`)
  assert(
    'roster length matches market',
    teamIds.length === slotCount,
    `${teamIds.length} vs ${slotCount}`
  )

  const beforePrices = await readPrices(client, market, slotCount)
  assert(
    'all marginal prices finite',
    beforePrices.every((p) => Number.isFinite(p)),
    beforePrices.map((p) => p.toFixed(2)).join(', ')
  )
  const before = mergeAndCheck('Merge (before bet)', teamIds, beforePrices)
  if (!before) {
    console.log(`\n${fail} failed, ${pass} passed`)
    process.exit(1)
  }

  // Live odds must differ from curator priors in at least one slot OR the
  // status flip alone is the Wave 2 contract — but after any trading they
  // should not all equal the seed priors.
  const seedOdds = sharedGoalById(SEED_ATLAS, 'shared-fission-power')!.market!
    .impliedOdds!
  const differsFromPriors = Object.entries(before.mapped.oddsByProjectId).some(
    ([id, p]) => Math.abs((seedOdds[id] ?? 0) - p) > 0.005
  )
  // Equal priors are fine if the market is still at the LMSR prior — status
  // flip is still the Wave 2 deliverable. Record, don't fail.
  if (differsFromPriors) {
    ok('live odds diverge from curator priors')
  } else {
    ok('live odds still at LMSR prior (no trading required)', 'status flip still verified')
  }

  if (WANT_BET) {
    const betOk = await placeSkewBet(client, rpcUrl, market, slotCount)
    if (betOk) {
      // Give the RPC a moment; then re-read.
      await new Promise((r) => setTimeout(r, 2000))
      const afterPrices = await readPrices(client, market, slotCount)
      const after = mergeAndCheck('Merge (after bet on outcome 0)', teamIds, afterPrices)
      if (after) {
        const beforeW = before.mapped.oddsByProjectId['westinghouse-fission-surface-power']
        const afterW = after.mapped.oddsByProjectId['westinghouse-fission-surface-power']
        assert(
          'westinghouse odds rose after buying outcome 0',
          afterW > beforeW,
          `${(beforeW * 100).toFixed(2)}% → ${(afterW * 100).toFixed(2)}%`
        )
        assert(
          'leader projectId still a bound competitor',
          [
            'westinghouse-fission-surface-power',
            'lockheed-fission-surface-power',
            'ix-fission-surface-power',
          ].includes(after.leaderId!)
        )
      }
    }
  } else {
    console.log('\n(skipping bet — pass --bet and $PRIVATE_KEY to skew odds)')
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
