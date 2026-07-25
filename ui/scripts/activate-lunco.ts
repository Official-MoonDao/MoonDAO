/**
 * One-shot script: set LunCoSim (project id=120, MDP=238) to active=2.
 *
 * Uses the existing GCP HSM signer — requires GCP_SIGNER_SERVICE_ACCOUNT
 * and GCP_PROJECT_ID to be set in .env.local (or the process environment).
 *
 * Run from ui/:
 *   npx ts-node --project tsconfig.json -e "$(cat scripts/activate-lunco.ts)"
 *   -- or --
 *   npx ts-node scripts/activate-lunco.ts
 */

// dotenv MUST be loaded before any module that reads process.env at init time
// (the GCP KMS client is a module-level singleton in hsm-signer.ts).
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

// Now safe to import the HSM signer (KMS client reads env at require time)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getHSMSigner, isHSMAvailable } = require('../lib/google/hsm-signer')
import { utils, providers } from 'ethers'

const PROJECT_TABLE_ADDRESS = '0x83755AF34867a3513ddCE921E9cAd28f0828CDdB'
const PROJECT_ID = 120
const RPC_URL =
  process.env.ARBITRUM_RPC_URL ||
  process.env.RPC_URL ||
  'https://arb1.arbitrum.io/rpc'

const UPDATE_ABI = ['function updateTableCol(uint256 id, string col, string val)']

async function main() {
  if (!isHSMAvailable()) {
    console.error('HSM not available — GCP_SIGNER_SERVICE_ACCOUNT must be set.')
    process.exit(1)
  }

  const signer = getHSMSigner()
  const address = await signer.getAddress()
  console.log('HSM signer address:', address)
  console.log(`Setting project id=${PROJECT_ID} → active=2 (PROJECT_ACTIVE)…`)

  const provider = new providers.JsonRpcProvider(RPC_URL)
  const iface = new utils.Interface(UPDATE_ABI)
  const data = iface.encodeFunctionData('updateTableCol', [
    PROJECT_ID,
    'active',
    '2',
  ])

  const tx = await signer.sendTransaction({
    to: PROJECT_TABLE_ADDRESS,
    data,
    provider,
  })

  const hash = tx?.transactionHash || tx?.hash
  console.log('Tx sent:', hash)

  if (tx.wait) {
    const receipt = await tx.wait()
    console.log(
      `Confirmed in block ${receipt.blockNumber}. LunCoSim (id=${PROJECT_ID}) is now PROJECT_ACTIVE.`
    )
  } else {
    console.log('Transaction submitted. Check:', `https://arbiscan.io/tx/${hash}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
