// Repair script for citizen NFTs that minted on-chain but whose Tableland
// metadata row was never created.
//
// ROOT CAUSE: the Citizen contract builds its Tableland INSERT with
// SQLHelpers.quote(), which wraps a value in single quotes WITHOUT escaping
// embedded quotes. Any mint whose name/bio/location/etc. contained a raw `'`
// (e.g. a bio with "Brazil's") produced malformed SQL that the Tableland
// validator rejected — so the NFT exists but has no metadata row. The mint
// paths now escape `'` -> `''` (see lib/tableland/cleanData.ts), but these
// already-minted tokens need a one-time backfill.
//
// The CitizenTable owner is a multisig Safe (0x29B0D7d7f0C88Ce0DF1De5888b37B90A6faF75cB),
// and insertIntoTable is onlyOperators (owner or the Citizen NFT contract), so
// this script does NOT send anything. It prints, for each orphaned token, the
// target contract and the ABI-encoded calldata to execute from the owner Safe
// (e.g. via the Safe Transaction Builder).
//
// NOTE: insertIntoTable ALSO uses the non-escaping SQLHelpers.quote(), so every
// value below is pre-escaped (`'` -> `''`) here; SQLite stores it back as a
// single `'`.
//
// Usage:  node ui/scripts/repair-orphaned-citizens.mjs

import { ethers } from 'ethers'

const CITIZEN_TABLE_ADDRESS = '0x0Eb1dF01b34cEDAFB3148f07D013793b557470d1'
const OWNER_SAFE = '0x29B0D7d7f0C88Ce0DF1De5888b37B90A6faF75cB'

const INSERT_ABI = [
  'function insertIntoTable(uint256 id, string name, string description, string image, string location, string discord, string twitter, string website, string _view, string formId, address owner)',
]

// Double single quotes so the on-chain SQLHelpers.quote() produces valid SQL.
const esc = (v) => (typeof v === 'string' ? v.replace(/'/g, "''") : v)

// Source values were read from each token's original mintTo calldata on
// Arbitrum. `description`/socials are passed through esc(); `location` is set to
// clean JSON (token 72's original was malformed non-JSON with single quotes).
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
    // Lucas Fonseca — KEEP this token (his latest attempt, current wallet).
    // Token 219 (wallet 0xa8c2f00143727F9d98f17264975c122D5de4828A) is the same
    // person's earlier attempt and is intentionally NOT backfilled to avoid a
    // duplicate citizen. Backfill 219 instead/as well only if product decides.
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

function main() {
  const iface = new ethers.utils.Interface(INSERT_ABI)

  console.log('Owner Safe (must execute these):', OWNER_SAFE)
  console.log('Target contract (CitizenTable):', CITIZEN_TABLE_ADDRESS)
  console.log('Chain: Arbitrum One (42161)\n')

  for (const r of RECORDS) {
    const data = iface.encodeFunctionData('insertIntoTable', [
      r.id,
      esc(r.name),
      esc(r.description),
      esc(r.image),
      r.location, // JSON; double quotes are SQL-safe, contains no single quote
      esc(r.discord),
      esc(r.twitter),
      esc(r.website),
      r.view,
      esc(r.formId),
      r.owner,
    ])

    console.log(`--- token ${r.id} (${r.name}) -> owner ${r.owner} ---`)
    console.log('to:   ', CITIZEN_TABLE_ADDRESS)
    console.log('value:', '0')
    console.log('data: ', data)
    console.log('')
  }

  console.log(
    'After execution, confirm each row materializes:\n' +
      "  curl -s 'https://tableland.network/api/v1/query?statement=SELECT%20id,name%20FROM%20CITIZENTABLE_42161_126%20WHERE%20id%20IN%20(72,221,222)'"
  )
}

main()
