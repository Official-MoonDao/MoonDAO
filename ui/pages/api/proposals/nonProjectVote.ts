import ProjectTableABI from 'const/abis/ProjectTable.json'
import ProposalsABI from 'const/abis/Proposals.json'
import {
  PROJECT_TABLE_NAMES,
  PROPOSALS_ADDRESSES,
  DEFAULT_CHAIN_V5,
  PROJECT_TABLE_ADDRESSES,
} from 'const/config'
import { isOperator } from 'middleware/isOperator'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { readContract, prepareContractCall, sendAndConfirmTransaction, getContract } from 'thirdweb'
import { createHSMWallet } from '@/lib/google/hsm-signer'
import { PROJECT_ACTIVE, PROJECT_VOTE_FAILED } from '@/lib/nance/types'
import { MEMBER_VOTE_SUPER_MAJORITY } from '@/lib/proposals/computeMemberProposalTally'
import {
  MEMBER_VOTE_WINDOW_SECONDS,
  tallyMemberVote,
  writeMemberVoteSnapshot,
} from '@/lib/proposals/memberVoteClose'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'

// Configuration constants
const chain = DEFAULT_CHAIN_V5
const chainSlug = getChainSlug(chain)

// Tally votes for non-project proposals and flip the project's `active`
// column on-chain. Gated by `isOperator` (Executive Lead allowlist) — the
// frontend's `CloseAndTallyButton` is a UI hint only; the real gate is here.
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const mdp = parseInt(req.body?.mdp, 10)
  if (!Number.isInteger(mdp) || mdp <= 0) {
    return res.status(400).json({ error: 'Invalid mdp: must be a positive integer.' })
  }

  const proposalContract = getContract({
    client: serverClient,
    address: PROPOSALS_ADDRESSES[chainSlug],
    abi: ProposalsABI.abi as any,
    chain: chain,
  })
  const projectTableContract = getContract({
    client: serverClient,
    address: PROJECT_TABLE_ADDRESSES[chainSlug],
    abi: ProjectTableABI as any,
    chain: chain,
  })
  const tempCheckApproved = await readContract({
    contract: proposalContract,
    method: 'tempCheckApproved' as string,
    params: [mdp],
  })
  const tempCheckApprovedTimestamp = await readContract({
    contract: proposalContract,
    method: 'tempCheckApprovedTimestamp' as string,
    params: [mdp],
  })
  if (!tempCheckApproved) {
    return res.status(400).json({
      error: 'Proposal has not passed temp check.',
    })
  }
  const projectStatement = `SELECT * FROM ${PROJECT_TABLE_NAMES[chainSlug]} WHERE MDP = ${mdp}`
  const projects = await queryTable(chain, projectStatement)
  const project = projects[0]
  const projectId = project.id
  if (project.active === PROJECT_ACTIVE) {
    return res.status(400).json({
      error: 'Project has already passed.',
    })
  }
  const currentTimestamp: number = Math.floor(Date.now() / 1000)
  const votingPeriodClosedTimestamp =
    parseInt(tempCheckApprovedTimestamp) + MEMBER_VOTE_WINDOW_SECONDS
  // Don't require voting period for testnet
  if (
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' &&
    currentTimestamp <= votingPeriodClosedTimestamp
  ) {
    return res.status(400).json({
      error: 'Voting period has not ended.',
    })
  }
  const { voteAddresses, tally, realVoteCount, votingPowerUnavailable } = await tallyMemberVote(
    mdp,
    votingPeriodClosedTimestamp
  )

  // Guard against a silent vMOONEY-fetch failure flipping a passing
  // proposal to FAILED on-chain: an all-zero resolve makes
  // `computeMemberProposalTally` report `passed=false`, and we would then
  // write `PROJECT_VOTE_FAILED` for a proposal the membership actually
  // passed. The project-vote handler (`pages/api/proposals/vote.ts`) guards
  // the same case with `if (totalVotingPower === 0) return 500`.
  if (votingPowerUnavailable) {
    console.error(
      `[member-proposal-vote] aborting tally for MDP-${mdp}: ${realVoteCount} ` +
        `vote row(s) present but total resolved voting power is 0. This ` +
        `almost always means the vMOONEY fetch failed (RPC/Engine outage). ` +
        `Refusing to flip the on-chain 'active' column to avoid recording a ` +
        `false FAILED. Retry once the chains are reachable.`
    )
    return res.status(503).json({
      error:
        'Could not resolve voting power (all voters returned 0 vMOONEY). ' +
        'This usually indicates a transient RPC/Engine failure. The on-chain ' +
        'result was NOT changed. Please retry Close & Tally.',
    })
  }

  const passed = tally.passed
  const active = passed ? PROJECT_ACTIVE : PROJECT_VOTE_FAILED
  const account = await createHSMWallet()
  const transaction = prepareContractCall({
    contract: projectTableContract,
    method: 'updateTableCol',
    params: [projectId, 'active', active],
  })
  const receipt = await sendAndConfirmTransaction({
    transaction,
    account,
  })

  // Written AFTER the on-chain `active` flip so a partial failure (e.g., an
  // RPC outage during block resolution) leaves the canonical decision intact.
  // If it fails, the EB can write it later with /api/proposals/nonProjectVoteSnapshot.
  const { written: snapshotRowWritten, closeBlocks } = await writeMemberVoteSnapshot({
    mdp,
    voteCloseTimestamp: votingPeriodClosedTimestamp,
    tally,
    account,
  })
  console.log(
    `[member-proposal-vote] tallied MDP-${mdp} (passed=${passed}, ` +
      `forPctOfDecided=${tally.forPctOfDecided.toFixed(2)}%, ` +
      `threshold=${MEMBER_VOTE_SUPER_MAJORITY}%, ` +
      `snapshotRowWritten=${snapshotRowWritten})`
  )

  res.status(200).json({
    url: 'https://moondao.com/project/' + mdp,
    proposalId: mdp,
    passed,
    // Surface the same fields a Discord summary needs, so the
    // /api/proposals/vote-notification handler doesn't have to re-run
    // the tally to format its message. VPs are quadratic (square roots
    // of vMOONEY) and keyed by the same '1' / '2' / '3' choice ids
    // VotingModal writes. `forPctOfDecided` excludes Abstain from the
    // denominator so the threshold test matches the on-chain decision.
    tally: {
      forVP: tally.forVP,
      againstVP: tally.againstVP,
      abstainVP: tally.abstainVP,
      decidedVP: tally.decidedVP,
      totalParticipationVP: tally.totalParticipationVP,
      forPctOfDecided: tally.forPctOfDecided,
      againstPctOfDecided: tally.againstPctOfDecided,
      abstainShareOfTurnout: tally.abstainShareOfTurnout,
      threshold: MEMBER_VOTE_SUPER_MAJORITY,
      voterCount: voteAddresses.length,
      voteCloseTimestamp: votingPeriodClosedTimestamp,
    },
    // Auditable snapshot row metadata. `snapshotRowWritten=true` means
    // the tally is now drift-proof on every page render (renders use
    // `balanceOfAt(addr, _block)` against `closeBlocks`); `false` means
    // the on-chain decision is set but the page will render with the
    // drift-prone `balanceOf(addr, _t)` path until the snapshot row
    // lands.
    snapshot: {
      written: snapshotRowWritten,
      closeBlocks,
    },
  })
}
export default withMiddleware(handler, rateLimit, isOperator)
