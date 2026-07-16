import ProjectTableABI from 'const/abis/ProjectTable.json'
import {
  PROJECT_TABLE_ADDRESSES,
  PROJECT_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
} from 'const/config'
import { getServerSession } from 'next-auth/next'
import { NextApiRequest, NextApiResponse } from 'next'
import { prepareContractCall, sendAndConfirmTransaction, getContract } from 'thirdweb'
import { getPrivyUserData } from '@/lib/privy'
import { createHSMWallet } from '@/lib/google/hsm-signer'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'
import { PROJECT_PENDING, PROJECT_WITHDRAWN } from '@/lib/nance/types'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { authOptions } from '@/pages/api/auth/[...nextauth]'

const chain = DEFAULT_CHAIN_V5
const chainSlug = getChainSlug(chain)

// Author self-service proposal withdrawal ("delete"). Because the
// ProjectTable contract has no row-delete, this soft-deletes by flipping the
// `active` column to PROJECT_WITHDRAWN, which every listing/detail surface
// filters out. Guardrails:
//   - authenticated Privy session whose wallet set contains `address`
//   - `address` matches the proposal's on-IPFS `authorAddress`
//   - proposal is still PROJECT_PENDING (can't withdraw once approved/failed)
async function POST(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { address, proposalId } = req.body

    if (!address || proposalId === undefined || proposalId === null) {
      return res.status(400).json({ error: 'Missing address or proposalId' })
    }

    const session = await getServerSession(req, res, authOptions)
    if (!session?.accessToken) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const privyUserData = await getPrivyUserData(session.accessToken)
    if (!privyUserData || privyUserData.walletAddresses.length === 0) {
      return res.status(401).json({ error: 'No wallet addresses found' })
    }

    const ownsAddress = privyUserData.walletAddresses.some(
      (w: string) => w.toLowerCase() === String(address).toLowerCase()
    )
    if (!ownsAddress) {
      return res.status(401).json({ error: 'Address not authorized' })
    }

    const projectStatement = `SELECT * FROM ${PROJECT_TABLE_NAMES[chainSlug]} WHERE MDP = ${Number(
      proposalId
    )}`
    const projects = await queryTable(chain, projectStatement)
    const project = projects?.[0]

    if (!project) {
      return res.status(404).json({ error: 'Proposal not found' })
    }

    // Only pending proposals can be withdrawn. Once a proposal is approved
    // (PROJECT_ACTIVE) or has failed, its lifecycle is owned by the DAO, not
    // the author.
    if (Number(project.active) !== PROJECT_PENDING) {
      return res.status(403).json({
        error:
          'Only pending proposals can be deleted. This proposal has already advanced past the pending stage.',
      })
    }

    // Verify the caller is the proposal author. The author of record lives in
    // the pinned IPFS JSON (`authorAddress`), which is what every author-gated
    // surface keys off of.
    if (!project.proposalIPFS || typeof project.proposalIPFS !== 'string') {
      return res
        .status(409)
        .json({ error: 'Proposal has no associated content to verify ownership.' })
    }

    let authorAddress: string | undefined
    try {
      const proposalResponse = await fetch(project.proposalIPFS)
      if (!proposalResponse.ok) {
        throw new Error(`IPFS fetch failed: ${proposalResponse.status}`)
      }
      const proposalJSON = await proposalResponse.json()
      authorAddress = proposalJSON?.authorAddress
    } catch (error) {
      console.error('[proposals/delete] Failed to fetch proposal IPFS:', error)
      return res.status(502).json({
        error: 'Could not verify proposal ownership right now. Please try again.',
      })
    }

    if (
      !authorAddress ||
      authorAddress.toLowerCase() !== String(address).toLowerCase()
    ) {
      return res
        .status(403)
        .json({ error: 'Only the proposal author can delete this proposal.' })
    }

    const account = await createHSMWallet()
    const projectTableContract = getContract({
      client: serverClient,
      address: PROJECT_TABLE_ADDRESSES[chainSlug],
      abi: ProjectTableABI as any,
      chain: chain,
    })

    const transaction = prepareContractCall({
      contract: projectTableContract,
      method: 'updateTableCol',
      params: [project.id, 'active', String(PROJECT_WITHDRAWN)],
    })
    await sendAndConfirmTransaction({ transaction, account })

    return res.status(200).json({ proposalId: Number(proposalId), withdrawn: true })
  } catch (e: any) {
    console.error('Error deleting proposal:', e)
    return res.status(400).json({
      error: `Error deleting proposal: ${
        e?.message || 'An unexpected error occurred'
      }. Please try again. If the problem persists, submit a ticket in the MoonDAO Discord support channel.`,
    })
  }
}

export default withMiddleware(POST, rateLimit)
