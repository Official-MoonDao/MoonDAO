import ProposalsABI from 'const/abis/Proposals.json'
import { DEFAULT_CHAIN_V5, PROJECT_TABLE_NAMES, PROPOSALS_ADDRESSES } from 'const/config'
import { isOperator } from 'middleware/isOperator'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { getContract, readContract } from 'thirdweb'
import { createHSMWallet } from '@/lib/google/hsm-signer'
import { PROJECT_ACTIVE, PROJECT_VOTE_FAILED } from '@/lib/nance/types'
import {
  MEMBER_VOTE_WINDOW_SECONDS,
  tallyMemberVote,
  writeMemberVoteSnapshot,
} from '@/lib/proposals/memberVoteClose'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'

const chain = DEFAULT_CHAIN_V5
const chainSlug = getChainSlug(chain)

// Writes the member-vote snapshot row for a proposal that Close & Tally has
// already decided, when that write failed at close time. Never touches the
// on-chain `active` decision.
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const mdp = parseInt(req.body?.mdp, 10)
  if (!Number.isInteger(mdp) || mdp <= 0) {
    return res.status(400).json({ error: 'Invalid mdp: must be a positive integer.' })
  }

  const projects = await queryTable(
    chain,
    `SELECT * FROM ${PROJECT_TABLE_NAMES[chainSlug]} WHERE MDP = ${mdp}`
  )
  const project = projects?.[0]
  if (!project) {
    return res.status(404).json({ error: 'Proposal not found.' })
  }
  if (project.active !== PROJECT_ACTIVE && project.active !== PROJECT_VOTE_FAILED) {
    return res.status(400).json({ error: 'The member vote has not been closed and tallied yet.' })
  }

  const proposalContract = getContract({
    client: serverClient,
    address: PROPOSALS_ADDRESSES[chainSlug],
    abi: ProposalsABI.abi as any,
    chain,
  })
  const tempCheckApprovedTimestamp = await readContract({
    contract: proposalContract,
    method: 'tempCheckApprovedTimestamp' as string,
    params: [mdp],
  })
  const voteCloseTimestamp = parseInt(tempCheckApprovedTimestamp) + MEMBER_VOTE_WINDOW_SECONDS

  const { tally, hasSnapshotRow, votingPowerUnavailable } = await tallyMemberVote(
    mdp,
    voteCloseTimestamp
  )
  if (hasSnapshotRow) {
    return res.status(200).json({ written: true, alreadyExisted: true })
  }
  if (votingPowerUnavailable) {
    return res.status(503).json({
      error:
        'Could not resolve voting power (all voters returned 0 vMOONEY). ' +
        'This usually indicates a transient RPC/Engine failure. Please retry.',
    })
  }

  // A snapshot that contradicts the recorded decision would mislead every
  // page render, so a recount that has drifted since the close is refused.
  const decidedPassed = project.active === PROJECT_ACTIVE
  if (tally.passed !== decidedPassed) {
    console.error(
      `[member-proposal-vote] snapshot retry refused for MDP-${mdp}: recount ` +
        `passed=${tally.passed} but on-chain decision passed=${decidedPassed}`
    )
    return res.status(409).json({
      error:
        'A recount no longer matches the recorded result, so no snapshot was ' +
        'written. The page keeps showing the live tally.',
    })
  }

  const account = await createHSMWallet()
  const { written, closeBlocks } = await writeMemberVoteSnapshot({
    mdp,
    voteCloseTimestamp,
    tally,
    account,
  })
  if (!written) {
    return res.status(502).json({ error: 'Snapshot write failed. Please retry.' })
  }
  return res.status(200).json({ written: true, closeBlocks })
}

export default withMiddleware(handler, rateLimit, isOperator)
