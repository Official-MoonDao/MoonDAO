/**
 * One-time fix: Activate the 5 projects that passed the Screen% vote.
 *
 * Self-contained script — no project lib imports (avoids HSM / Next.js deps).
 * Uses TABLELAND_PRIVATE_KEY from .env.local with thirdweb v5.
 *
 * Run from ui/ dir:
 *   npx tsx scripts/fix-set-active-projects.ts
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import {
  createThirdwebClient,
  getContract,
  prepareContractCall,
  sendAndConfirmTransaction,
} from 'thirdweb'
import { arbitrum } from 'thirdweb/chains'
import { privateKeyToAccount } from 'thirdweb/wallets'

// ---- constants (inlined to avoid pulling in project imports) ----
const PROJECT_TABLE_ADDRESS = '0x83755AF34867a3513ddCE921E9cAd28f0828CDdB'
const PROJECT_ACTIVE = '2'

const UPDATE_TABLE_COL_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'id', type: 'uint256' },
      { internalType: 'string', name: 'col', type: 'string' },
      { internalType: 'string', name: 'val', type: 'string' },
    ],
    name: 'updateTableCol',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

// Projects that passed per Screen% (original production tally)
const PROJECTS_TO_ACTIVATE = [
  { id: 93, name: 'Maldives Space Research Balloons' },
  { id: 92, name: 'Open Pathways to Space' },
  { id: 98, name: 'Sustain MoonDAO w/ Laika' },
  { id: 94, name: 'LunARC Governance Workshop' },
  { id: 106, name: 'Lunar Dev Coop Tabletop Game' },
]

async function main() {
  // --- build thirdweb client ---
  const secretKey = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_SECRET
  if (!secretKey) throw new Error('NEXT_PUBLIC_THIRDWEB_CLIENT_SECRET not found in .env.local')

  const client = createThirdwebClient({ secretKey })

  // --- build signer account from TABLELAND_PRIVATE_KEY ---
  const pk = process.env.TABLELAND_PRIVATE_KEY
  if (!pk) throw new Error('TABLELAND_PRIVATE_KEY not found in .env.local')

  const account = privateKeyToAccount({
    client,
    privateKey: pk as `0x${string}`,
  })

  console.log('=== Fix: Set Screen% winner projects to active ===')
  console.log(`Chain:          arbitrum (42161)`)
  console.log(`ProjectTable:   ${PROJECT_TABLE_ADDRESS}`)
  console.log(`Signer address: ${account.address}`)
  console.log(`Target status:  active = ${PROJECT_ACTIVE}`)
  console.log('')

  const projectTableContract = getContract({
    client,
    address: PROJECT_TABLE_ADDRESS,
    abi: UPDATE_TABLE_COL_ABI,
    chain: arbitrum,
  })

  for (const project of PROJECTS_TO_ACTIVATE) {
    try {
      console.log(
        `Setting project ${project.id} (${project.name}) to active=${PROJECT_ACTIVE}...`
      )
      const transaction = prepareContractCall({
        contract: projectTableContract,
        method: 'function updateTableCol(uint256 id, string col, string val)',
        params: [BigInt(project.id), 'active', PROJECT_ACTIVE],
      })
      const receipt = await sendAndConfirmTransaction({
        transaction,
        account,
      })
      console.log(`  ✅ Done. TX: ${receipt.transactionHash}`)
    } catch (err: any) {
      console.error(`  ❌ Failed: ${err.message}`)
    }
  }

  console.log('\n=== Complete. Verifying via Tableland... ===')

  const ids = PROJECTS_TO_ACTIVATE.map((p) => p.id).join(',')
  const url = `https://tableland.network/api/v1/query?statement=SELECT%20id%2C%20name%2C%20active%20FROM%20PROJECT_42161_122%20WHERE%20id%20IN%20(${ids})&format=objects`
  const resp = await fetch(url)
  const data = await resp.json()
  console.log(JSON.stringify(data, null, 2))
}

main().catch(console.error)
