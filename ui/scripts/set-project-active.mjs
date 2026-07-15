// One-shot script to set a project's `active` column to 2 (PROJECT_ACTIVE)
// in the on-chain Tableland ProjectTable.
//
// The ProjectTable owner is the GCP HSM EOA; this script accepts a plain
// private key via OPERATOR_PK so it can be run locally when the HSM
// environment is not available.
//
// Usage (from ui/):
//   OPERATOR_PK=0x<owner-private-key> node scripts/set-project-active.mjs <projectId>
//
// Example — set LunCoSim (project id=120, MDP=238) to active:
//   OPERATOR_PK=0x<key> node scripts/set-project-active.mjs 120

import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { ethers } from 'ethers'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PROJECT_TABLE_ADDRESS = '0x83755AF34867a3513ddCE921E9cAd28f0828CDdB'
const DEFAULT_RPC = 'https://arb1.arbitrum.io/rpc'

const UPDATE_TABLE_COL_ABI = [
  'function updateTableCol(uint256 id, string col, string val)',
]

function loadEnvLocal() {
  try {
    const envPath = join(__dirname, '..', '.env.local')
    const text = readFileSync(envPath, 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 0) continue
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
    // .env.local is optional
  }
}

async function main() {
  loadEnvLocal()

  const projectId = process.argv[2]
  if (!projectId || isNaN(Number(projectId))) {
    console.error('Usage: OPERATOR_PK=0x<key> node scripts/set-project-active.mjs <projectId>')
    console.error('Example: OPERATOR_PK=0x<key> node scripts/set-project-active.mjs 120')
    process.exit(1)
  }

  const pk = process.env.OPERATOR_PK
  if (!pk) {
    console.log(`No OPERATOR_PK set — would call updateTableCol(${projectId}, 'active', '2') on:`)
    console.log('  ProjectTable:', PROJECT_TABLE_ADDRESS)
    console.log('\nRe-run with the ProjectTable owner key:')
    console.log(`  OPERATOR_PK=0x<owner-key> node scripts/set-project-active.mjs ${projectId}`)
    return
  }

  const rpcUrl = process.env.ARBITRUM_RPC_URL || process.env.RPC_URL || DEFAULT_RPC
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
  const wallet = new ethers.Wallet(pk, provider)

  console.log('Signer:', wallet.address)
  console.log('ProjectTable:', PROJECT_TABLE_ADDRESS)
  console.log(`Setting project id=${projectId} active=2 …`)

  const iface = new ethers.utils.Interface(UPDATE_TABLE_COL_ABI)
  const data = iface.encodeFunctionData('updateTableCol', [projectId, 'active', '2'])

  const tx = await wallet.sendTransaction({
    to: PROJECT_TABLE_ADDRESS,
    data,
  })
  console.log('Tx sent:', tx.hash)
  console.log('Waiting for confirmation…')
  const receipt = await tx.wait()
  console.log(`Confirmed in block ${receipt.blockNumber}. Project ${projectId} is now active=2 (PROJECT_ACTIVE).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
