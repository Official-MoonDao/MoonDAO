// One-time fix: Set the 5 projects that passed the Screen% vote to active
// Screen% results: Maldives(93) 25.94%, Open Pathways(92) 13.65%, Laika(98) 12.36%, LunARC(94) 9.76%, Tabletop(106) 9.24%
import ProjectTableABI from 'const/abis/ProjectTable.json'
import { PROJECT_TABLE_ADDRESSES, DEFAULT_CHAIN_V5 } from 'const/config'
import { NextApiRequest, NextApiResponse } from 'next'
import { prepareContractCall, sendAndConfirmTransaction, getContract } from 'thirdweb'
import { PROJECT_ACTIVE } from '@/lib/nance/types'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { createHSMWallet } from '@/lib/google/hsm-signer'

const chain = DEFAULT_CHAIN_V5
const chainSlug = getChainSlug(chain)

// Projects that passed per Screen% (original buggy tally)
const PROJECTS_TO_ACTIVATE = [93, 92, 98, 94, 106]

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  // Safety: require a confirmation param
  if (req.body?.confirm !== 'yes-activate-screen-pct-projects') {
    return res.status(400).json({
      error: 'Must send { "confirm": "yes-activate-screen-pct-projects" } in body',
      projectsToActivate: PROJECTS_TO_ACTIVATE,
    })
  }

  try {
    const account = await createHSMWallet()
    const projectTableContract = getContract({
      client: serverClient,
      address: PROJECT_TABLE_ADDRESSES[chainSlug],
      abi: ProjectTableABI as any,
      chain: chain,
    })

    const results: { projectId: number; status: string; txHash?: string }[] = []

    for (const projectId of PROJECTS_TO_ACTIVATE) {
      try {
        console.log(`Setting project ${projectId} to active=${PROJECT_ACTIVE}...`)
        const transaction = prepareContractCall({
          contract: projectTableContract,
          method: 'updateTableCol',
          params: [projectId, 'active', PROJECT_ACTIVE],
        })
        const receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
        console.log(`  ✅ Project ${projectId} set to active. TX: ${receipt.transactionHash}`)
        results.push({
          projectId,
          status: 'success',
          txHash: receipt.transactionHash,
        })
      } catch (err: any) {
        console.error(`  ❌ Failed to set project ${projectId}:`, err.message)
        results.push({
          projectId,
          status: 'error',
          txHash: err.message,
        })
      }
    }

    return res.status(200).json({
      message: 'Done. Projects activated per Screen% results.',
      results,
    })
  } catch (err: any) {
    console.error('Fatal error:', err)
    return res.status(500).json({ error: err.message })
  }
}
