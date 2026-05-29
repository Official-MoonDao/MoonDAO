import NonProjectProposalABI from 'const/abis/NonProjectProposal.json'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import ProposalsABI from 'const/abis/Proposals.json'
import {
  PROJECT_TABLE_NAMES,
  NON_PROJECT_PROPOSAL_TABLE_NAMES,
  NON_PROJECT_PROPOSAL_ADDRESSES,
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
import { resolveCloseBlocks } from '@/lib/proposals/blockAtTimestamp'
import {
  computeMemberProposalTally,
  MEMBER_VOTE_SUPER_MAJORITY,
} from '@/lib/proposals/computeMemberProposalTally'
import queryTable from '@/lib/tableland/queryTable'
import { DistributionVote } from '@/lib/tableland/types'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { fetchTotalVMOONEYs } from '@/lib/tokens/hooks/useTotalVMOONEY'

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

  const voteStatement = `SELECT * FROM ${NON_PROJECT_PROPOSAL_TABLE_NAMES[chainSlug]} WHERE MDP = ${mdp}`
  const votes = (await queryTable(chain, voteStatement)) as DistributionVote[]
  const voteAddresses = votes.map((pv) => pv.address)
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
  const votingPeriodClosedTimestamp = parseInt(tempCheckApprovedTimestamp) + 60 * 60 * 24 * 5
  // Don't require voting period for testnet
  if (
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' &&
    currentTimestamp <= votingPeriodClosedTimestamp
  ) {
    return res.status(400).json({
      error: 'Voting period has not ended.',
    })
  }
  const vMOONEYs = await fetchTotalVMOONEYs(voteAddresses, votingPeriodClosedTimestamp)
  const addressToQuadraticVotingPower = Object.fromEntries(
    voteAddresses.map((address, index) => {
      const vMOONEY = vMOONEYs[index] || 0
      const power = isNaN(vMOONEY) ? 0 : Math.sqrt(vMOONEY)
      return [address, power]
    })
  )
  // Abstain-aware tally: For % is computed as a share of decided VP
  // (For + Against), so a large-VP abstainer can't sink an otherwise-
  // passing proposal. See `lib/proposals/computeMemberProposalTally.ts`
  // for the full rationale and shared semantics.
  const tally = computeMemberProposalTally(
    votes as any,
    addressToQuadraticVotingPower
  )
  const realVoteCount = votes.filter((vote: any) => {
    if (typeof vote?.vote !== 'string') return true
    try {
      return JSON.parse(vote.vote)?.kind !== 'snapshot'
    } catch {
      return true
    }
  }).length
  if (realVoteCount > 0 && tally.totalParticipationVP === 0) {
    return res.status(503).json({
      error:
        'Resolved total voting power is 0 for non-snapshot votes. vMOONEY reads may have failed; retry once RPC/Engine reads recover.',
      voterCount: realVoteCount,
      vMOONEYs,
      voteAddresses,
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

  // Persist a "snapshot row" into the existing NonProjectProposal_*
  // Tableland table so the proposal page can render the tally with
  // truly-historical voting power (`balanceOfAt(addr, _block)`) on
  // every load — no manual paste step, no constants-file PR. The
  // row's `address` is the HSM wallet (set automatically by the
  // contract's `Strings.toHexString(msg.sender)` insert), and its
  // `vote` JSON carries `kind: 'snapshot'` + `closeBlocks` per chain
  // instead of the standard '1'/'2'/'3' choice keys, so consumers
  // distinguish it from real voter rows by SHAPE rather than by
  // identity.
  //
  // We resolve close blocks AFTER the on-chain `active` flip so that
  // a partial failure (e.g., RPC outage during block resolution)
  // leaves the canonical decision intact and the page just falls
  // back to the live timestamp-based fetcher. The snapshot row write
  // itself is a separate Tableland mutation; if it also fails the
  // active flip is unaffected and the EB can re-trigger the snapshot
  // write later (TODO: add a retry endpoint).
  let snapshotRowWritten = false
  let closeBlocks: Awaited<ReturnType<typeof resolveCloseBlocks>> | null = null
  try {
    closeBlocks = await resolveCloseBlocks(votingPeriodClosedTimestamp)
    const snapshotPayload = {
      kind: 'snapshot' as const,
      voteCloseTimestamp: votingPeriodClosedTimestamp,
      capturedAt: Math.floor(Date.now() / 1000),
      closeBlocks,
      // Tally summary at close time — informational. The page
      // re-derives the same numbers from the votes table + the
      // `closeBlocks` lookup, but pinning a snapshot of the
      // computed values gives us a small audit log right alongside
      // the votes.
      tally: {
        forVP: tally.forVP,
        againstVP: tally.againstVP,
        abstainVP: tally.abstainVP,
        decidedVP: tally.decidedVP,
        forPctOfDecided: tally.forPctOfDecided,
        threshold: MEMBER_VOTE_SUPER_MAJORITY,
        passed,
      },
    }
    const nonProjectProposalContract = getContract({
      client: serverClient,
      address: NON_PROJECT_PROPOSAL_ADDRESSES[chainSlug],
      abi: NonProjectProposalABI.abi as any,
      chain,
    })
    try {
      const insertTx = prepareContractCall({
        contract: nonProjectProposalContract,
        method: 'insertIntoTable',
        params: [BigInt(mdp), JSON.stringify(snapshotPayload)],
      })
      await sendAndConfirmTransaction({ transaction: insertTx, account })
      snapshotRowWritten = true
    } catch (insertErr: any) {
      // The table has `unique(address, mdp)`. If a snapshot row from
      // a prior close already exists (re-tally on a previously
      // failed proposal), `insertIntoTable` reverts. Fall through to
      // `updateTableCol` which is gated by msg.sender on the same
      // (mdp, address) pair, so it'll only touch our own row.
      console.warn(
        `[member-proposal-vote] snapshot insert reverted for MDP-${mdp} ` +
          `(likely duplicate); attempting update:`,
        insertErr?.message ?? insertErr
      )
      const updateTx = prepareContractCall({
        contract: nonProjectProposalContract,
        method: 'updateTableCol',
        params: [BigInt(mdp), JSON.stringify(snapshotPayload)],
      })
      await sendAndConfirmTransaction({ transaction: updateTx, account })
      snapshotRowWritten = true
    }
  } catch (snapshotErr: any) {
    // Don't fail the API — the on-chain `active` flip is canonical
    // for pass/fail. Page renders fall back to the live (drift-prone)
    // `balanceOf(addr, _t)` path until the snapshot row lands. Surface
    // the error to logs so an operator can investigate.
    console.error(
      `[member-proposal-vote] snapshot row write failed for MDP-${mdp}; ` +
        `on-chain decision is committed but page will render with live ` +
        `recompute until a snapshot row is inserted:`,
      snapshotErr?.message ?? snapshotErr
    )
  }
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
