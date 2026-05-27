import ProjectTableABI from 'const/abis/ProjectTable.json'
import ProposalsABI from 'const/abis/Proposals.json'
import {
  PROJECT_TABLE_NAMES,
  NON_PROJECT_PROPOSAL_TABLE_NAMES,
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
import queryTable from '@/lib/tableland/queryTable'
import { DistributionVote } from '@/lib/tableland/types'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { fetchTotalVMOONEYs } from '@/lib/tokens/hooks/useTotalVMOONEY'
import { runQuadraticVoting } from '@/lib/utils/rewards'

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
  const SUM_TO_ONE_HUNDRED = 100
  const outcome = runQuadraticVoting(votes, addressToQuadraticVotingPower, SUM_TO_ONE_HUNDRED)
  const SUPER_MAJORITY = 66.6
  const passed = outcome[1] >= SUPER_MAJORITY
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

  // Per-MDP vMOONEY snapshot, paste-ready for
  // `MEMBER_PROPOSAL_VMOONEY_SNAPSHOTS` in
  // `lib/proposals/vMooneySnapshots.ts`. This is the `--method=projected`
  // backup capture: it freezes the vMOONEY values reported by the live
  // fetcher *at this exact moment* (i.e. immediately after the on-chain
  // tally), which matches what the live recompute would produce until a
  // voter touches their lock. The truly-historical snapshot (recovered
  // via `balanceOfAt(_block)` per chain) is captured separately by
  // running `ui/scripts/snapshot-vmooney.mjs --kind=memberProposal
  // --mdp=<n>`. Prefer the historical capture when both exist; this
  // backup is what we have if the historical run can't be done (RPC
  // outage, etc.) so the audit is never empty.
  const projectedSnapshot = {
    mdp,
    voteCloseTimestamp: votingPeriodClosedTimestamp,
    snapshotTakenAt: Math.floor(Date.now() / 1000),
    method: 'projected' as const,
    vMOONEY: Object.fromEntries(
      voteAddresses.map((address, index) => [
        address.toLowerCase(),
        Number(vMOONEYs[index]) || 0,
      ])
    ),
    distributions: Object.fromEntries(
      votes.map((v) => [
        String(v.address || '').toLowerCase(),
        // The live row carries either a parsed object or a JSON
        // string in `vote`. Normalize to the object form the snapshot
        // schema expects.
        (() => {
          const raw = (v as any).vote
          if (raw && typeof raw === 'object') return { ...raw }
          if (typeof raw === 'string') {
            try {
              return JSON.parse(raw)
            } catch {
              return {}
            }
          }
          return {}
        })(),
      ])
    ),
  }
  // One-line marker for grep/Sentry/log-shipping. Operators can copy
  // the JSON below the marker straight into the constants file.
  console.log(
    `[member-proposal-vote] tallied MDP-${mdp} (passed=${passed}, forPct=${outcome[1]?.toFixed(2)}%) — paste under MEMBER_PROPOSAL_VMOONEY_SNAPSHOTS in lib/proposals/vMooneySnapshots.ts:\n` +
      `${mdp}: ${JSON.stringify(projectedSnapshot, null, 2)},`
  )

  res.status(200).json({
    url: 'https://moondao.com/project/' + mdp,
    proposalId: mdp,
    passed,
    // Surface the same fields a Discord summary needs, so the
    // /api/proposals/vote-notification handler doesn't have to re-run
    // the tally to format its message. Sums are quadratic VPs (square
    // roots of vMOONEY), keyed by the same '1' / '2' / '3' choice ids
    // VotingModal writes.
    tally: {
      vpFor: Number(outcome[1]) || 0,
      forPct: Number(outcome[1]) || 0,
      voterCount: voteAddresses.length,
      totalQuadraticVP: Object.values(addressToQuadraticVotingPower).reduce(
        (a, b) => a + (Number.isFinite(b) ? b : 0),
        0
      ),
      voteCloseTimestamp: votingPeriodClosedTimestamp,
    },
    // Paste-ready backup snapshot. The frontend doesn't read this; it's
    // for the EB workflow + log shipping.
    projectedSnapshot,
  })
}
export default withMiddleware(handler, rateLimit, isOperator)
