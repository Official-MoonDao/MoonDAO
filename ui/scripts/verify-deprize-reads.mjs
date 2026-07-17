// One-off verification harness for the DePrize production UI (Phase 2).
//
// Exercises, against the LIVE Sepolia deployments, the exact reads the new
// lib/deprize hooks perform — using the same hand-written ABI JSONs the UI
// ships — so a decode/selector mistake in those ABIs fails loudly here rather
// than silently blanking the page.
//
//   node scripts/verify-deprize-reads.mjs
//
// Read-only; no keys needed.
import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { readFileSync } from 'node:fs'

const abi = (p) => JSON.parse(readFileSync(new URL(`../const/abis/${p}`, import.meta.url)))

const RegistryABI = abi('DePrizeRegistry.json')
const RedeemABI = abi('DePrizeRedeem.json')
const CTFABI = abi('ConditionalTokens.json')
const LMSRABI = abi('LMSRWithTWAP.json').abi ?? abi('LMSRWithTWAP.json')

// Sepolia addresses from ui/const/config.ts
const REGISTRY = '0x299F163705AbBFa1A8DE7670F33171730F828F3D'
const REDEEM = '0x2fec56899a1121a46b6bcba0bb924796b6ddf4f7'
const LMSR = '0x36da9d41b673b4115df0e06cefb4c665e2289dd0'
const CTF = '0xC3B0a34fb9a1c5F9464D7249BF564117e1fe6dE8'
const WETH = '0x8cfF28F922AeEe80d3a0663e735681469F7374c6'
const PLAY_ID = 3n
const ZERO32 = '0x' + '0'.repeat(64)

const RPCS = [
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://sepolia.drpc.org',
  'https://1rpc.io/sepolia',
]

let pass = 0
let fail = 0
const ok = (name, detail = '') => {
  pass++
  console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`)
}
const bad = (name, err) => {
  fail++
  console.log(`  FAIL  ${name} — ${err?.shortMessage || err?.message || err}`)
}

async function pickClient() {
  for (const url of RPCS) {
    const client = createPublicClient({ chain: sepolia, transport: http(url, { timeout: 15000 }) })
    try {
      await client.getBlockNumber()
      console.log(`RPC: ${url}\n`)
      return client
    } catch {
      /* try next */
    }
  }
  throw new Error('No Sepolia RPC reachable from this environment')
}

const client = await pickClient()
const read = (address, abi_, functionName, args = []) =>
  client.readContract({ address, abi: abi_, functionName, args })

// ---- Registry (useDePrize / useDePrizeCount) ----
console.log('DePrizeRegistry')
let count
try {
  count = await read(REGISTRY, RegistryABI, 'count')
  ok('count()', `${count} DePrizes registered`)
} catch (e) {
  bad('count()', e)
}

let dp
try {
  const st = await read(REGISTRY, RegistryABI, 'state', [PLAY_ID])
  ok(`state(${PLAY_ID})`, `state=${st}`)
} catch (e) {
  bad(`state(${PLAY_ID})`, e)
}
try {
  dp = await read(REGISTRY, RegistryABI, 'getDePrize', [PLAY_ID])
  ok(
    `getDePrize(${PLAY_ID}) tuple decode`,
    `jbProjectId=${dp.jbProjectId} state=${dp.state} teams=[${dp.teamIds.join(',')}] cond=${dp.ctfConditionId.slice(0, 10)}…`
  )
  if (dp.teamIds.length >= 2) ok('teamIds length >= 2', `${dp.teamIds.length} teams`)
  else bad('teamIds length >= 2', `got ${dp.teamIds.length}`)
} catch (e) {
  bad(`getDePrize(${PLAY_ID})`, e)
}

// The hook's unknown-id probe: state() must NOT revert (returns NONE=0), while
// getDePrize MUST revert with UnknownDePrize.
try {
  const st = await read(REGISTRY, RegistryABI, 'state', [999999n])
  if (Number(st) === 0) ok('state(unknown) returns NONE without reverting')
  else bad('state(unknown)', `expected 0, got ${st}`)
} catch (e) {
  bad('state(unknown)', e)
}
try {
  await read(REGISTRY, RegistryABI, 'getDePrize', [999999n])
  bad('getDePrize(unknown)', 'expected revert, call succeeded')
} catch {
  ok('getDePrize(unknown) reverts (hook must probe state() first)')
}

// ---- Market (useDePrizeMarket) ----
console.log('\nLMSRWithTWAP + ConditionalTokens')
let cond
try {
  cond = await read(LMSR, LMSRABI, 'conditionIds', [0n])
  ok('lmsr.conditionIds(0)', cond.slice(0, 10) + '…')
  if (dp && cond.toLowerCase() === dp.ctfConditionId.toLowerCase())
    ok('market condition == registry condition (play market is bound to DePrize 3)')
  else if (dp) bad('market condition == registry condition', `${cond} != ${dp.ctfConditionId}`)
} catch (e) {
  bad('lmsr.conditionIds(0)', e)
}
try {
  const stage = await read(LMSR, LMSRABI, 'stage')
  ok('lmsr.stage()', `${stage} (0=Running 1=Paused 2=Closed)`)
} catch (e) {
  bad('lmsr.stage()', e)
}
try {
  const fee = await read(LMSR, LMSRABI, 'fee')
  ok('lmsr.fee()', `${Number(fee) / 1e16}%`)
} catch (e) {
  bad('lmsr.fee()', e)
}

const N = dp ? dp.teamIds.length : 3
try {
  const prices = []
  for (let i = 0; i < N; i++) {
    const p = await read(LMSR, LMSRABI, 'calcMarginalPrice', [i])
    prices.push((Number(p) / 2 ** 64) * 100)
  }
  const sum = prices.reduce((a, b) => a + b, 0)
  ok('calcMarginalPrice per outcome', prices.map((p) => p.toFixed(1) + '%').join(' / '))
  if (sum > 95 && sum < 105) ok('odds sum ≈ 100%', sum.toFixed(2) + '%')
  else console.log(`  NOTE  odds sum ${sum.toFixed(2)}% (expected off-100 only when Paused/Closed)`)
} catch (e) {
  bad('calcMarginalPrice', e)
}

// The quote path the BetModal uses: calcNetCost + calcMarketFee for a small buy.
try {
  const qty = 10n ** 15n // 0.001 outcome tokens
  const amounts = Array.from({ length: N }, (_, j) => (j === 0 ? qty : 0n))
  const net = await read(LMSR, LMSRABI, 'calcNetCost', [amounts])
  const fee = await read(LMSR, LMSRABI, 'calcMarketFee', [net])
  ok('calcNetCost + calcMarketFee (BetModal quote path)', `net=${net} fee=${fee}`)
} catch (e) {
  bad('calcNetCost/calcMarketFee', e)
}

// Position-id derivation exactly as useDePrizeMarket does it.
try {
  if (!cond) throw new Error('no condition id')
  const collectionId = await read(CTF, CTFABI, 'getCollectionId', [ZERO32, cond, 1n])
  const positionId = await read(CTF, CTFABI, 'getPositionId', [WETH, collectionId])
  ok('ctf.getCollectionId -> getPositionId', `pid=${positionId.toString().slice(0, 12)}…`)
  const den = await read(CTF, CTFABI, 'payoutDenominator', [cond])
  ok('ctf.payoutDenominator', den === 0n ? 'unresolved' : `resolved (den=${den})`)
} catch (e) {
  bad('ctf position/payout reads', e)
}

// ---- Redeem helper (useDePrizeRedeem) ----
console.log('\nDePrizeRedeem')
try {
  const preview = await read(REDEEM, RedeemABI, 'previewRedeem', [
    PLAY_ID,
    '0x679d87D8640e66778c3419D164998E720D7495f6',
  ])
  ok('previewRedeem(3, oracle)', `${preview} wei`)
} catch (e) {
  bad('previewRedeem', e)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
