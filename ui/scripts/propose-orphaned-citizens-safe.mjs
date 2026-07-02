// Proposes the one-time Tableland backfill for citizen NFTs that minted on-chain
// but whose metadata row was never created (unescaped `'` in the mint data, see
// repair-orphaned-citizens.mjs for the full root cause).
//
// The CitizenTable owner is a 2-of-4 Safe
// (0x29B0D7d7f0C88Ce0DF1De5888b37B90A6faF75cB), and insertIntoTable is
// onlyOperators, so the fix must be executed by that Safe. This script batches
// the inserts into ONE Safe transaction (MultiSend) and proposes it to the Safe
// Transaction Service so the other owners can confirm it in the Safe UI.
//
// The signer MUST be one of the Safe owners (or a registered delegate):
//   0xAF6f2A7643A97b849bD9cf6d3f57e142c5BbB0DA
//   0xB2d3900807094D4Fe47405871B0C8AdB58E10D42
//   0x679d87D8640e66778c3419D164998E720D7495f6
//   0xb00E7F2C408D23337dFEe6be44EA2D7AAd4B0FE7
//
// Usage (from ui/):
//   SAFE_PROPOSER_PK=0x<owner-or-delegate-key> node scripts/propose-orphaned-citizens-safe.mjs
// Optional: ARBITRUM_RPC_URL=<rpc> (defaults to the public Arbitrum One RPC).
// With no key set, it prints the batched calldata and exits without proposing.

import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import SafeApiKit from '@safe-global/api-kit'
import Safe from '@safe-global/protocol-kit'
import { ethers } from 'ethers'

const CHAIN_ID = 42161n
const SAFE_ADDRESS = '0x29B0D7d7f0C88Ce0DF1De5888b37B90A6faF75cB'
const CITIZEN_TABLE_ADDRESS = '0x0Eb1dF01b34cEDAFB3148f07D013793b557470d1'
const DEFAULT_RPC = 'https://arb1.arbitrum.io/rpc'

const INSERT_ABI = [
  'function insertIntoTable(uint256 id, string name, string description, string image, string location, string discord, string twitter, string website, string _view, string formId, address owner)',
]

// Double single quotes so the on-chain (non-escaping) SQLHelpers.quote() yields
// valid SQL; SQLite stores it back as a single `'`.
const esc = (v) => (typeof v === 'string' ? v.replace(/'/g, "''") : v)

// Per product: Lucas Fonseca keeps token 221 (wallet 0xe375…7693). His earlier
// duplicate token 219 (wallet 0xa8c2f0…828A) is intentionally NOT backfilled.
const RECORDS = [
  {
    id: 72,
    owner: '0x063AF2EB31Dc1072eddcC871dbb2CCf1c1DF0548',
    name: 'Noctis Phantomhive',
    description:
      'I am a Correctional Officer fulltime. I have a deep love for space and hope to one day start my own space company!',
    image: 'ipfs://QmSLPAQKM4grv1aSw2BBSnjf3EjPRH6MYxrMSGgUc6LwUw',
    location: '{"lat":39.4647665,"lng":-76.7336521,"name":"Baltimore County, MD, USA"}',
    discord: 'nphantomhive',
    twitter: 'https://x.com/Nphantomhivee',
    website: '',
    view: 'public',
    formId: 'lqqvb3ybad2l9qiibe4ilqqvb3yb80d7',
  },
  {
    id: 221,
    owner: '0xe375bdc3ae9f6e48491415eABA0E16c569d57693',
    name: 'Lucas Fonseca',
    description:
      "Brazilian space engineer, founder of Airvantis & Stratolit, Mission Director of Brazil's first lunar mission (Garatéa), and the only Brazilian on the historic Rosetta comet landing. Karman Fellow.",
    image: 'ipfs://Qma8LCT7SRCNfwXpnLuzyMrqCJBmFB6W7WJtVbxobDX2vd',
    location:
      '{"lat":-23.5557714,"lng":-46.6395571,"name":"São Paulo, State of São Paulo, Brazil"}',
    discord: 'lucas.fonseca',
    twitter: 'https://@astrolucasf',
    website: 'https://www.astrolucas.com',
    view: 'public',
    formId: '5o0u6iv4vi2vft6qe5x67rh5o0u9it9t',
  },
  {
    id: 222,
    owner: '0x6bf9d2B1Cc5dc3dB44966caC47d21f7c4B138635',
    name: 'Nadine Nicole',
    description:
      "Filipina-German Actress & Founder (True-Connection.org, YariDesigns.com). Space for Humanity Advisor. \n\nJoining MoonDAO to help build humanity's multiplanetary future.",
    image: 'ipfs://QmUUJXq7WoJibiKkkeSKRdVDugWk5MPKqYbA1XMbuo8oP1',
    location: '{"lat":34.0549076,"lng":-118.242643,"name":"Los Angeles, CA, USA"}',
    discord: '',
    twitter: 'https://_nadinenicole_',
    website: 'https://nadinenicole.com',
    view: 'public',
    formId: 'dxzpo2fxhonzc044nsrrdxzpo2bztlrb',
  },
]

function loadEnvLocal() {
  const here = dirname(fileURLToPath(import.meta.url))
  const envPath = join(here, '..', '.env.local')
  try {
    const raw = readFileSync(envPath, 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = value
    }
  } catch {
    // .env.local is optional; rely on the process environment.
  }
}

function buildMetaTransactions() {
  const iface = new ethers.utils.Interface(INSERT_ABI)
  return RECORDS.map((r) => ({
    to: CITIZEN_TABLE_ADDRESS,
    value: '0',
    data: iface.encodeFunctionData('insertIntoTable', [
      r.id,
      esc(r.name),
      esc(r.description),
      esc(r.image),
      r.location,
      esc(r.discord),
      esc(r.twitter),
      esc(r.website),
      r.view,
      esc(r.formId),
      r.owner,
    ]),
  }))
}

async function main() {
  loadEnvLocal()
  const transactions = buildMetaTransactions()

  console.log(`Backfilling ${transactions.length} citizen rows (tokens ${RECORDS.map((r) => r.id).join(', ')})`)
  console.log('Safe:           ', SAFE_ADDRESS)
  console.log('Target contract:', CITIZEN_TABLE_ADDRESS, '\n')
  transactions.forEach((t, i) => {
    console.log(`  [${i}] token ${RECORDS[i].id} -> data ${t.data.slice(0, 26)}…`)
  })
  console.log('')

  const pk = process.env.SAFE_PROPOSER_PK
  if (!pk) {
    console.log(
      'No SAFE_PROPOSER_PK set — printed the batch above but did not propose.\n' +
        'Re-run with an owner/delegate key to open the transaction on the Safe:\n' +
        '  SAFE_PROPOSER_PK=0x<owner-key> node scripts/propose-orphaned-citizens-safe.mjs'
    )
    return
  }

  const rpcUrl = process.env.ARBITRUM_RPC_URL || process.env.RPC_URL || DEFAULT_RPC
  const senderAddress = new ethers.Wallet(pk).address

  const protocolKit = await Safe.init({
    provider: rpcUrl,
    signer: pk,
    safeAddress: SAFE_ADDRESS,
  })

  const owners = (await protocolKit.getOwners()).map((o) => o.toLowerCase())
  if (!owners.includes(senderAddress.toLowerCase())) {
    console.warn(
      `WARNING: proposer ${senderAddress} is not a Safe owner. ` +
        'The Transaction Service will reject the proposal unless it is a registered delegate.'
    )
  }

  // Multiple transactions are automatically wrapped in a MultiSend (one nonce).
  const safeTransaction = await protocolKit.createTransaction({ transactions })
  const safeTxHash = await protocolKit.getTransactionHash(safeTransaction)
  const signature = await protocolKit.signHash(safeTxHash)

  const apiKit = new SafeApiKit({ chainId: CHAIN_ID })
  await apiKit.proposeTransaction({
    safeAddress: SAFE_ADDRESS,
    safeTransactionData: safeTransaction.data,
    safeTxHash,
    senderAddress,
    senderSignature: signature.data,
    origin: 'repair-orphaned-citizens',
  })

  console.log('\nProposed to the Safe ✅')
  console.log('safeTxHash:', safeTxHash)
  console.log(`Confirm at: https://app.safe.global/transactions/queue?safe=arb1:${SAFE_ADDRESS}`)
  console.log('\nAfter execution, verify the rows materialized:')
  console.log(
    "  curl -s 'https://tableland.network/api/v1/query?statement=SELECT%20id,name%20FROM%20CITIZENTABLE_42161_126%20WHERE%20id%20IN%20(72,221,222)'"
  )
}

main().catch((err) => {
  console.error('Failed to propose Safe transaction:', err)
  process.exit(1)
})
