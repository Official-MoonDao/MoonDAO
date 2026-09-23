/**
 * Stand up a Touchdown side market on Sepolia v2: its own CTF condition, its
 * own LMSR, its own registry entry. Sibling of provision-sepolia-races.ts,
 * which does the same for a race; the differences are all in the guards.
 *
 *   source ../prediction/.env   # DEPLOYER_PK
 *   SIDE_MARKET_KEY=touchdown-attitude \
 *   SLICE_DESTINATION=own-project \
 *   yarn tsx --tsconfig tsconfig.json scripts/provision-sepolia-side-markets.ts
 *
 * One market per run, named explicitly. A side market is cheap to describe and
 * expensive to get wrong — its outcome set freezes at `prepareCondition` — so
 * there is no "do them all" mode to fat-finger.
 *
 * ## The Juicebox question this script forces you to answer
 *
 * `DePrizeMint.bet` splits every wager into a 5% slice and a 95% budget, and
 * pays the slice into the DePrize's Juicebox project, minting project tokens
 * to the bettor. On a race that slice is the purse: it is what the winning
 * team is eventually paid out of. A side market has no team, so nothing is
 * ever paid out of it.
 *
 * You cannot dodge this by pointing the side market at Touchdown's project.
 * `DePrizeRegistry.register` reverts with `JBProjectAlreadyBound` if a project
 * already has a DePrize, and only `supersede` rebinds one. Sharing a pool is
 * not a policy choice that was left open — it is unreachable.
 *
 * So the slice has to go somewhere, and the options are materially different
 * for whoever pays it:
 *
 *   own-project  Mint a dedicated Juicebox project per side market. Bettors
 *                receive that project's tokens. The slice accumulates with no
 *                winner to pay, and the Senate decides later what it is for.
 *                Honest and reversible, but it ships a token whose purpose is
 *                undecided, and people will ask what it is worth.
 *
 * Only `own-project` is implemented, because it is the only one the current
 * contracts support without a change. It is still required explicitly rather
 * than defaulted, so that nobody provisions a side market without having read
 * the paragraph above. If the answer turns out to be "route it to the payload
 * purse" or "waive the slice for markets with no competitor", that is a
 * DePrizeMint change and this script grows a second branch.
 *
 * ## What this refuses to do
 *
 * - Provision a market whose outcomes are not a partition. CTF reports payout
 *   numerators across the whole set; a gap makes it unresolvable.
 * - Provision a side market whose parent race is not OPEN on this registry. A
 *   side market on a settled or superseded race is a market on a known fact.
 * - Write a `sharedGoalId` binding. Side markets are looked up by their own
 *   key, and binding one to the parent goal would break the duplicate-binding
 *   guard in `goalIndexForChain`.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  keccak256,
  parseAbi,
  parseEther,
  stringify,
  toBytes,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { findDePrizeIdForGoal } from '../lib/deprize/competitions'
import {
  SIDE_MARKETS,
  sideMarketOutcomesArePartition,
  type SideMarketDefinition,
} from '../lib/deprize/sideMarkets'

function envAddr(name: string, fallback: `0x${string}`): `0x${string}` {
  const raw = process.env[name]
  return (raw && raw.startsWith('0x') ? raw : fallback) as `0x${string}`
}

const REGISTRY = envAddr(
  'DEPRIZE_REGISTRY',
  '0x7208B0Ba9B1013000b8D30b60A462079300984E2'
)
const MINT = envAddr('DEPRIZE_MINT', '0x22E22C4135be93595f341e072321D18e7D4Ee0D0')
const FACTORY = envAddr(
  'DEPRIZE_FACTORY',
  '0x30b449b6c85B64f4FCBB81fBe48A9d35f41d5674'
)
const COMPLIANCE_SIGNER = envAddr(
  'DEPRIZE_COMPLIANCE_SIGNER',
  '0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011'
)
const CTF = '0xC3B0a34fb9a1c5F9464D7249BF564117e1fe6dE8' as const
const WETH = '0x8cfF28F922AeEe80d3a0663e735681469F7374c6' as const
const MISSION_CREATOR = '0xa692eEd67c4D2C1C73DC0515240d27cf7d6fF9D1' as const
const MOONDAO_TEAM = 22n
const FUNDING_PER_OUTCOME = parseEther('0.01')
const FEE = 10_000_000_000_000_000n // 1%
const SUNSET = BigInt(Math.floor(Date.now() / 1000) + 2 * 365 * 24 * 3600)
const OUT = '/tmp/sepolia-side-markets.json'

/** Juicebox token metadata per market. Frozen at createMission. */
const TOKEN: Record<string, { name: string; symbol: string }> = {
  'touchdown-attitude': { name: 'DePrize Attitude', symbol: 'DATT' },
  'touchdown-window': { name: 'DePrize Window', symbol: 'DWIN' },
}

const registryAbi = parseAbi([
  'function count() view returns (uint256)',
  'function register(uint256 jbProjectId, uint256[] teamIds, uint256 sunset) returns (uint256)',
  'function setCondition(uint256 deprizeId, bytes32 ctfConditionId)',
  'function open(uint256 deprizeId)',
  'function state(uint256 deprizeId) view returns (uint8)',
  'function deprizeIdByJBProject(uint256 jbProjectId) view returns (uint256)',
  'event DePrizeRegistered(uint256 indexed deprizeId, uint256 indexed jbProjectId, uint256[] teamIds, uint256 sunset)',
])

const mintAbi = parseAbi([
  'function setMarket(uint256 deprizeId, address market)',
  'function setComplianceSigner(address complianceSigner)',
  'function complianceSigner() view returns (address)',
])

const ctfAbi = parseAbi([
  'function prepareCondition(address oracle, bytes32 questionId, uint256 outcomeSlotCount)',
  'function getConditionId(address oracle, bytes32 questionId, uint256 outcomeSlotCount) view returns (bytes32)',
  'function getOutcomeSlotCount(bytes32 conditionId) view returns (uint256)',
])

const factoryAbi = parseAbi([
  'function createLMSRMarketMaker(address pmSystem, address collateralToken, bytes32[] conditionIds, uint64 fee, address whitelist, uint256 funding) returns (address)',
  'event LMSRMarketMakerCreation(address indexed creator, address lmsrMarketMaker, address pmSystem, address collateralToken, bytes32[] conditionIds, uint64 fee, uint256 funding)',
])

const wethAbi = parseAbi([
  'function deposit() payable',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
])

const lmsrAbi = parseAbi(['function owner() view returns (address)'])

const missionAbi = parseAbi([
  'function createMission(uint256 teamId, address to, string projectUri, uint256 fundingGoal, uint256 deadline, uint256 refundPeriod, bool token, string tokenName, string tokenSymbol, string memo) returns (uint256)',
  'function missionIdToProjectId(uint256) view returns (uint256)',
  'function missionIdToPayHook(uint256) view returns (address)',
])

const payhookAbi = parseAbi([
  'function setDePrizeRegistry(address registry)',
  'function deprizeRegistry() view returns (address)',
])

/** DePrizeState enum ordinals, from IDePrizeRegistry.sol. */
const STATE_OPEN = 2

type Result = {
  key: string
  parentGoalId: string
  deprizeId: number
  questionId: Hex
  conditionId: Hex
  market: Hex
  jbProjectId: string
  teamIds: string[]
  outcomeKeys: string[]
}

function loadDone(): Result[] {
  try {
    return JSON.parse(readFileSync(OUT, 'utf8')) as Result[]
  } catch {
    return []
  }
}

function pk(): Hex {
  const raw = process.env.DEPLOYER_PK || process.env.PRIVATE_KEY
  if (!raw) throw new Error('Set DEPLOYER_PK or PRIVATE_KEY')
  return (raw.startsWith('0x') ? raw : `0x${raw}`) as Hex
}

function pickMarket(): SideMarketDefinition {
  const key = process.env.SIDE_MARKET_KEY
  if (!key) {
    throw new Error(
      `Set SIDE_MARKET_KEY to one of: ${SIDE_MARKETS.map((m) => m.key).join(', ')}`
    )
  }
  const market = SIDE_MARKETS.find((m) => m.key === key)
  if (!market) throw new Error(`Unknown SIDE_MARKET_KEY ${key}`)
  return market
}

function requireSliceDestination(): void {
  const choice = process.env.SLICE_DESTINATION
  if (choice === 'own-project') return
  if (choice === 'parent-project') {
    throw new Error(
      'SLICE_DESTINATION=parent-project is not reachable: DePrizeRegistry.register ' +
        'reverts with JBProjectAlreadyBound when a Juicebox project already has a ' +
        'DePrize. Sharing the Touchdown pool needs a contract change, not a flag.'
    )
  }
  throw new Error(
    'Set SLICE_DESTINATION=own-project to confirm you have read the header: every ' +
      'bet pays a 5% slice into this market\u2019s own Juicebox project, and a side ' +
      'market has no winner to pay it out to.'
  )
}

async function main() {
  const market = pickMarket()
  requireSliceDestination()

  if (!sideMarketOutcomesArePartition(market.outcomes)) {
    throw new Error(
      `${market.key}: outcomes are not a partition. Fix sideMarkets.ts before ` +
        'preparing a condition — the outcome set freezes here.'
    )
  }
  const token = TOKEN[market.key]
  if (!token) throw new Error(`${market.key}: no Juicebox token metadata`)

  const account = privateKeyToAccount(pk())
  const rpc =
    process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpc, { timeout: 60_000 }),
  })
  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpc, { timeout: 60_000 }),
  })

  console.log('deployer', account.address)
  console.log(`\n=== ${market.key} ===`)
  console.log('parent', market.parentGoalId)
  console.log('question', market.question)

  // A side market on a race that has already settled is a market on a known
  // fact, and one on a superseded race points at a roster nobody is watching.
  const parentId = findDePrizeIdForGoal('sepolia', market.parentGoalId)
  if (parentId === undefined) {
    throw new Error(
      `${market.key}: parent ${market.parentGoalId} has no DePrize on sepolia`
    )
  }
  const parentState = await publicClient.readContract({
    address: REGISTRY,
    abi: registryAbi,
    functionName: 'state',
    args: [BigInt(parentId)],
  })
  if (Number(parentState) !== STATE_OPEN) {
    throw new Error(
      `${market.key}: parent DePrize ${parentId} is state ${parentState}, not OPEN`
    )
  }
  console.log('parent deprizeId', parentId, '(OPEN)')

  const done = loadDone()
  if (done.some((r) => r.key === market.key)) {
    console.log(`already provisioned per ${OUT} — delete the entry to redo`)
    return
  }
  const results = [...done]

  const teamIds = market.outcomes.map((o) => BigInt(o.teamId))
  const n = BigInt(teamIds.length)
  const funding = FUNDING_PER_OUTCOME * n
  const questionVersion = process.env.QUESTION_VERSION || 'v1'
  const questionId = keccak256(
    toBytes(`deprize:sepolia:side:${market.key}:${questionVersion}`)
  )
  console.log('questionId', questionId)
  console.log('outcomes', n.toString(), 'funding', funding.toString())

  const fees = await publicClient.estimateFeesPerGas()
  const maxFeePerGas = ((fees.maxFeePerGas ?? 2_000_000_000n) * 3n) / 2n
  const maxPriorityFeePerGas = (fees.maxPriorityFeePerGas ?? 1_000_000_000n) * 2n

  type WriteParams = Parameters<typeof wallet.writeContract>[0]
  // `value` for the payable WETH deposit: viem's default generic resolution
  // pins it to `undefined`, which the payable branch of the union needs back.
  const send = async (params: Omit<WriteParams, 'value'> & { value?: bigint }) => {
    // Spreading into viem's discriminated write union collapses it, so the
    // fee fields have to be re-attached behind a cast. Call sites stay typed.
    const hash = await wallet.writeContract({
      ...params,
      maxFeePerGas,
      maxPriorityFeePerGas,
    } as WriteParams)
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      timeout: 180_000,
    })
    if (receipt.status !== 'success') throw new Error(`tx reverted ${hash}`)
    return receipt
  }

  let jbProjectId: bigint
  try {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 2 * 365 * 24 * 3600)
    const missionArgs = [
      MOONDAO_TEAM,
      account.address,
      `https://moondao.com/deprize/side/${market.key}`,
      parseEther('100'),
      deadline,
      30n * 24n * 3600n,
      true,
      token.name,
      token.symbol,
      `DePrize side market: ${market.label}`,
    ] as const
    const sim = await publicClient.simulateContract({
      account,
      address: MISSION_CREATOR,
      abi: missionAbi,
      functionName: 'createMission',
      args: missionArgs,
    })
    await send({
      address: MISSION_CREATOR,
      abi: missionAbi,
      functionName: 'createMission',
      args: missionArgs,
    })
    jbProjectId = await publicClient.readContract({
      address: MISSION_CREATOR,
      abi: missionAbi,
      functionName: 'missionIdToProjectId',
      args: [sim.result],
    })
    if (!jbProjectId) throw new Error('createMission produced no jb project')
    console.log('  jbProjectId', jbProjectId.toString())
    const payHook = await publicClient.readContract({
      address: MISSION_CREATOR,
      abi: missionAbi,
      functionName: 'missionIdToPayHook',
      args: [sim.result],
    })
    if (payHook && payHook !== '0x0000000000000000000000000000000000000000') {
      const current = await publicClient.readContract({
        address: payHook,
        abi: payhookAbi,
        functionName: 'deprizeRegistry',
      })
      if (current.toLowerCase() !== REGISTRY.toLowerCase()) {
        await send({
          address: payHook,
          abi: payhookAbi,
          functionName: 'setDePrizeRegistry',
          args: [REGISTRY],
        })
      }
      console.log('  payHook', payHook)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(
      `createMission failed for ${market.key}: ${message}. Refusing a synthetic Juicebox id.`
    )
  }

  const bound = await publicClient.readContract({
    address: REGISTRY,
    abi: registryAbi,
    functionName: 'deprizeIdByJBProject',
    args: [jbProjectId],
  })
  if (bound !== 0n) {
    throw new Error(
      `jbProject ${jbProjectId} already bound to DePrize ${bound}; register would revert`
    )
  }

  const conditionId = await publicClient.readContract({
    address: CTF,
    abi: ctfAbi,
    functionName: 'getConditionId',
    args: [account.address, questionId, n],
  })
  const slots = await publicClient.readContract({
    address: CTF,
    abi: ctfAbi,
    functionName: 'getOutcomeSlotCount',
    args: [conditionId],
  })
  if (slots === 0n) {
    await send({
      address: CTF,
      abi: ctfAbi,
      functionName: 'prepareCondition',
      args: [account.address, questionId, n],
    })
  }
  console.log('  conditionId', conditionId, slots > 0n ? '(pre-existing)' : '')

  const wethBal = await publicClient.readContract({
    address: WETH,
    abi: wethAbi,
    functionName: 'balanceOf',
    args: [account.address],
  })
  if (wethBal < funding) {
    await send({
      address: WETH,
      abi: wethAbi,
      functionName: 'deposit',
      value: funding - wethBal,
    })
  }
  await send({
    address: WETH,
    abi: wethAbi,
    functionName: 'approve',
    args: [FACTORY, funding],
  })

  const lmsrReceipt = await send({
    address: FACTORY,
    abi: factoryAbi,
    functionName: 'createLMSRMarketMaker',
    args: [
      CTF,
      WETH,
      [conditionId],
      FEE,
      '0x0000000000000000000000000000000000000000',
      funding,
    ],
  })
  let lmsr: Hex | undefined
  for (const log of lmsrReceipt.logs) {
    try {
      const parsed = decodeEventLog({
        abi: factoryAbi,
        data: log.data,
        topics: log.topics,
      })
      if (parsed.eventName === 'LMSRMarketMakerCreation') {
        lmsr = (parsed.args as { lmsrMarketMaker: Hex }).lmsrMarketMaker
      }
    } catch {
      /* not this event */
    }
  }
  if (!lmsr) throw new Error('no LMSRMarketMakerCreation log')
  console.log('  market', lmsr)

  const regReceipt = await send({
    address: REGISTRY,
    abi: registryAbi,
    functionName: 'register',
    args: [jbProjectId, teamIds, SUNSET],
  })
  let logged: bigint | undefined
  for (const log of regReceipt.logs) {
    try {
      const parsed = decodeEventLog({
        abi: registryAbi,
        data: log.data,
        topics: log.topics,
      })
      if (parsed.eventName === 'DePrizeRegistered') {
        logged = (parsed.args as { deprizeId: bigint }).deprizeId
      }
    } catch {
      /* skip */
    }
  }
  const deprizeId =
    logged ??
    (await publicClient.readContract({
      address: REGISTRY,
      abi: registryAbi,
      functionName: 'count',
    }))
  console.log('  deprizeId', deprizeId.toString())

  await send({
    address: REGISTRY,
    abi: registryAbi,
    functionName: 'setCondition',
    args: [deprizeId, conditionId],
  })
  await send({
    address: REGISTRY,
    abi: registryAbi,
    functionName: 'open',
    args: [deprizeId],
  })
  await send({
    address: MINT,
    abi: mintAbi,
    functionName: 'setMarket',
    args: [deprizeId, lmsr],
  })
  const signer = await publicClient.readContract({
    address: MINT,
    abi: mintAbi,
    functionName: 'complianceSigner',
  })
  if (signer.toLowerCase() !== COMPLIANCE_SIGNER.toLowerCase()) {
    await send({
      address: MINT,
      abi: mintAbi,
      functionName: 'setComplianceSigner',
      args: [COMPLIANCE_SIGNER],
    })
  }
  const owner = await publicClient.readContract({
    address: lmsr,
    abi: lmsrAbi,
    functionName: 'owner',
  })
  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(`LMSR owner ${owner} is not the deployer ${account.address}`)
  }

  results.push({
    key: market.key,
    parentGoalId: market.parentGoalId,
    deprizeId: Number(deprizeId),
    questionId,
    conditionId,
    market: lmsr,
    jbProjectId: jbProjectId.toString(),
    teamIds: teamIds.map(String),
    outcomeKeys: market.outcomes.map((o) => o.key),
  })
  writeFileSync(OUT, stringify(results, null, 2))
  console.log('  recorded', OUT)

  console.log('\nBind this in REGISTERED_SIDE_MARKETS (sideMarkets.ts):\n')
  console.log(`  sepolia: {`)
  for (const r of results) {
    console.log(`    '${r.key}': ${r.deprizeId},`)
  }
  console.log(`  },`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
