/**
 * Place a real bet on a live Sepolia DePrize and prove the LMSR odds move.
 * Generic over DePrize id / outcome index — unlike
 * verify-deprize-moonbase-sepolia.ts (which is specifically the fission-race
 * Moon Base Zero merge proof), this is a plain on-chain smoke for any market.
 *
 *   DEPRIZE_ID=10 OUTCOME_INDEX=0 BET_ETH=0.006 \
 *     yarn verify:deprize-bet
 *
 * Needs $PRIVATE_KEY funded with Sepolia ETH.
 */
import { readFileSync } from 'node:fs'
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseEther,
  type Abi,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { buildAmounts } from '../lib/deprize/quote-math'

const REGISTRY = '0x299F163705AbBFa1A8DE7670F33171730F828F3D' as const
const MINT = '0xA6F9632ee9848f7C1f252DA5a1e869aC90E57cc8' as const

const DEPRIZE_ID = BigInt(process.env.DEPRIZE_ID || '10')
const OUTCOME_INDEX = Number(process.env.OUTCOME_INDEX || '0')
const BET_ETH = process.env.BET_ETH || '0.006'

const RPCS = [
  process.env.SEPOLIA_RPC_URL,
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://sepolia.drpc.org',
  'https://1rpc.io/sepolia',
].filter(Boolean) as string[]

const abi = (p: string) =>
  JSON.parse(readFileSync(new URL(`../const/abis/${p}`, import.meta.url), 'utf8'))
const RegistryABI = abi('DePrizeRegistry.json') as Abi
const MintABI = abi('DePrizeMint.json') as Abi
const LmsrJson = abi('LMSRWithTWAP.json')
const LmsrABI = (LmsrJson.abi ?? LmsrJson) as Abi

let pass = 0
let fail = 0
const ok = (n: string, d = '') => {
  pass++
  console.log(`  PASS  ${n}${d ? ` — ${d}` : ''}`)
}
const bad = (n: string, d: unknown) => {
  fail++
  console.log(`  FAIL  ${n} — ${d}`)
}
const assert = (n: string, cond: boolean, d = '') => (cond ? ok(n, d) : bad(n, d))

async function pickRpc() {
  for (const url of RPCS) {
    const client = createPublicClient({ chain: sepolia, transport: http(url, { timeout: 20_000 }) })
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

async function readPrices(client: any, market: `0x${string}`, n: number) {
  return Promise.all(
    Array.from({ length: n }, (_, i) =>
      client
        .readContract({ address: market, abi: LmsrABI, functionName: 'calcMarginalPrice', args: [i] })
        .then((p: bigint) => (Number(p) / 2 ** 64) * 100)
        .catch(() => NaN)
    )
  )
}

async function main() {
  console.log(`DePrize ${DEPRIZE_ID} — real bet proof (outcome ${OUTCOME_INDEX}, ${BET_ETH} ETH)\n`)
  const { client, rpcUrl } = await pickRpc()

  const dp = (await client.readContract({
    address: REGISTRY,
    abi: RegistryABI,
    functionName: 'getDePrize',
    args: [DEPRIZE_ID],
  })) as { teamIds: readonly bigint[]; state: number | bigint }
  assert('registry state is OPEN', Number(dp.state) === 2, `state=${dp.state}`)
  const numOutcomes = dp.teamIds.length
  assert('outcome index in range', OUTCOME_INDEX >= 0 && OUTCOME_INDEX < numOutcomes)

  const market = (await client.readContract({
    address: MINT,
    abi: MintABI,
    functionName: 'marketOf',
    args: [DEPRIZE_ID],
  })) as `0x${string}`
  assert('market bound', !!market && !/^0x0+$/.test(market), market)

  const stage = Number(
    await client.readContract({ address: market, abi: LmsrABI, functionName: 'stage' })
  )
  assert('LMSR Running', stage === 0, `stage=${stage}`)

  const before = await readPrices(client, market, numOutcomes)
  console.log('  odds before:', before.map((p) => p.toFixed(2) + '%').join(', '))

  const pk = process.env.PRIVATE_KEY
  if (!pk) {
    bad('PRIVATE_KEY', 'set $PRIVATE_KEY to place a bet')
    process.exit(1)
  }
  const key = (pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`
  const account = privateKeyToAccount(key)
  const wallet = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl, { timeout: 60_000 }) })

  const bal = await client.getBalance({ address: account.address })
  console.log(`  wallet ${account.address} balance ${formatEther(bal)} ETH`)
  assert('wallet funded', bal > parseEther('0.008'), formatEther(bal))

  const value = parseEther(BET_ETH)
  const budget = (value * 95n) / 100n
  const feeOf = async (net: bigint) => {
    try {
      return (await client.readContract({ address: market, abi: LmsrABI, functionName: 'calcMarketFee', args: [net] })) as bigint
    } catch {
      return net / 100n
    }
  }
  const costOf = async (qty: bigint) => {
    if (qty <= 0n) return 0n
    const amounts = buildAmounts(OUTCOME_INDEX, qty, numOutcomes)
    const net = (await client.readContract({ address: market, abi: LmsrABI, functionName: 'calcNetCost', args: [amounts] })) as bigint
    if (net <= 0n) return 0n
    return net + (await feeOf(net))
  }
  let lo = 0n
  let hi = budget * 3n
  while (lo + 1n < hi) {
    const mid = (lo + hi) / 2n
    const c = await costOf(mid)
    if (c <= budget) lo = mid
    else hi = mid
  }
  const qty = lo
  assert('quoted qty > 0', qty > 0n, `qty=${qty}`)
  const maxCost = budget + parseEther('0.0003')

  console.log(`  betting qty=${formatEther(qty)} outcome tokens, value=${BET_ETH} ETH, maxCost=${formatEther(maxCost)}`)
  const hash = await wallet.writeContract({
    address: MINT,
    abi: MintABI,
    functionName: 'bet',
    args: [DEPRIZE_ID, BigInt(OUTCOME_INDEX), qty, maxCost],
    value,
  })
  console.log(`  tx ${hash}`)
  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 120_000 })
  assert('bet mined', receipt.status === 'success', `block=${receipt.blockNumber}`)

  const after = await readPrices(client, market, numOutcomes)
  console.log('  odds after: ', after.map((p) => p.toFixed(2) + '%').join(', '))
  assert(
    `outcome ${OUTCOME_INDEX} odds rose`,
    after[OUTCOME_INDEX] > before[OUTCOME_INDEX],
    `${before[OUTCOME_INDEX].toFixed(2)}% → ${after[OUTCOME_INDEX].toFixed(2)}%`
  )

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
