// Quick diagnostic: is `address` actually checked in on each chain this week?
//
// Usage:
//   node ui/scripts/check-checkin-status.mjs 0xYOURADDRESS
//
// Reads weekStart, lastCheckIn[address] and vMOONEY balance directly from the
// public RPC for Ethereum, Arbitrum and Base, then tells you per-chain:
//   - whether you hold vMOONEY (i.e. you're eligible to check in there)
//   - whether your lastCheckIn == weekStart (i.e. you ARE checked in there)

// NOTE: These FeeHook / vMOONEY addresses are duplicated from the app config
// (FEE_HOOK_ADDRESSES in ui/const/config.ts, sourced from
// contracts/deployments/<chain>.json, and the vMOONEY config). They are
// hardcoded here only so this stays a zero-dependency standalone .mjs you can
// run with plain `node`. If a FeeHook is ever redeployed, update both places.
const CHAINS = [
  {
    name: 'ethereum',
    rpc: 'https://ethereum-rpc.publicnode.com',
    feeHook: '0x1b9f3544dC4915E0C08882d1C3F39B6E464E4844',
    vMooney: '0xCc71C80d803381FD6Ee984FAff408f8501DB1740',
  },
  {
    name: 'arbitrum',
    rpc: 'https://arb1.arbitrum.io/rpc',
    feeHook: '0x6D9C97c94c88a67d1A93BBC8ccAe3a5322208844',
    vMooney: '0xB255c74F8576f18357cE6184DA033c6d93C71899',
  },
  {
    name: 'base',
    rpc: 'https://mainnet.base.org',
    feeHook: '0x3F74A92F6D68a0638802d32D40a1Cb63C49b0844',
    vMooney: '0x7f8f1B45c3FD6Be4F467520Fc1Cf030d5CaBACF5',
  },
]

// 4-byte selectors (verified via ethers.utils.id):
//   weekStart()           -> 0x3b698348
//   lastCheckIn(address)  -> 0xef6fdb1c
//   balanceOf(address)    -> 0x70a08231
const WEEK_START = '0x3b698348'
const LAST_CHECK_IN = '0xef6fdb1c'
const BALANCE_OF = '0x70a08231'

function pad(addr) {
  return addr.toLowerCase().replace('0x', '').padStart(64, '0')
}

async function call(rpc, to, data) {
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to, data }, 'latest'],
    }),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message)
  return json.result
}

async function main() {
  const address = process.argv[2]
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    console.error('Usage: node check-checkin-status.mjs 0xYOURADDRESS')
    process.exit(1)
  }

  console.log(`\nChecking weekly check-in status for ${address}\n`)

  for (const c of CHAINS) {
    try {
      const weekStartHex = await call(c.rpc, c.feeHook, WEEK_START)
      const lastHex = await call(c.rpc, c.feeHook, LAST_CHECK_IN + pad(address))
      const balHex = await call(c.rpc, c.vMooney, BALANCE_OF + pad(address))

      const weekStart = BigInt(weekStartHex)
      const last = BigInt(lastHex)
      const bal = BigInt(balHex)

      const eligible = bal > 0n
      const checkedIn = last === weekStart && weekStart !== 0n

      console.log(`── ${c.name} ──────────────────────────────`)
      console.log(`  vMOONEY balance : ${bal} ${eligible ? '(eligible)' : '(0 — not eligible)'}`)
      console.log(`  weekStart       : ${weekStart}`)
      console.log(`  lastCheckIn     : ${last}`)
      console.log(`  CHECKED IN?     : ${checkedIn ? '✅ YES' : '❌ NO'}`)
      console.log('')
    } catch (err) {
      console.log(`── ${c.name} ──────────────────────────────`)
      console.log(`  ⚠️  read failed: ${err.message}`)
      console.log('')
    }
  }
}

main()
