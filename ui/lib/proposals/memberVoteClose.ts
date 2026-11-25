import NonProjectProposalABI from 'const/abis/NonProjectProposal.json'
import {
  DEFAULT_CHAIN_V5,
  NON_PROJECT_PROPOSAL_ADDRESSES,
  NON_PROJECT_PROPOSAL_TABLE_NAMES,
} from 'const/config'
import { getContract, prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { createHSMWallet } from '@/lib/google/hsm-signer'
import { CloseBlocksByChain, resolveCloseBlocks } from '@/lib/proposals/blockAtTimestamp'
import {
  computeMemberProposalTally,
  MEMBER_VOTE_SUPER_MAJORITY,
} from '@/lib/proposals/computeMemberProposalTally'
import { isSnapshotVoteRow } from '@/lib/proposals/memberVoteSnapshotRetry'
import queryTable from '@/lib/tableland/queryTable'
import { DistributionVote } from '@/lib/tableland/types'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'
import { fetchTotalVMOONEYs } from '@/lib/tokens/hooks/useTotalVMOONEY'

const chain = DEFAULT_CHAIN_V5
const chainSlug = getChainSlug(chain)

export const MEMBER_VOTE_WINDOW_SECONDS = 60 * 60 * 24 * 5

type HSMAccount = Awaited<ReturnType<typeof createHSMWallet>>
type MemberProposalTally = ReturnType<typeof computeMemberProposalTally>

export async function tallyMemberVote(mdp: number, voteCloseTimestamp: number) {
  const voteStatement = `SELECT * FROM ${NON_PROJECT_PROPOSAL_TABLE_NAMES[chainSlug]} WHERE MDP = ${mdp}`
  const votes = (await queryTable(chain, voteStatement)) as DistributionVote[]
  const voteAddresses = votes.map((pv) => pv.address)
  const vMOONEYs = await fetchTotalVMOONEYs(voteAddresses, voteCloseTimestamp)
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
  const tally = computeMemberProposalTally(votes as any, addressToQuadraticVotingPower)
  const realVoteCount = (votes ?? []).filter((row) => !isSnapshotVoteRow(row)).length
  const hasSnapshotRow = realVoteCount < (votes ?? []).length

  // `fetchTotalVMOONEYs` does NOT throw on an RPC/Engine read failure — it
  // logs and returns all zeros. A Member Vote on a Senate-approved proposal
  // always has voters holding vMOONEY, so real vote rows with 0 total VP mean
  // the fetch failed. Callers must not commit anything in that case.
  const votingPowerUnavailable = realVoteCount > 0 && tally.totalParticipationVP === 0

  return { votes, voteAddresses, tally, realVoteCount, hasSnapshotRow, votingPowerUnavailable }
}

// Persist a "snapshot row" into the NonProjectProposal_* Tableland table so
// the proposal page can render the tally with truly-historical voting power
// (`balanceOfAt(addr, _block)`) on every load. The row's `address` is the HSM
// wallet (set by the contract's `Strings.toHexString(msg.sender)` insert), and
// its `vote` JSON carries `kind: 'snapshot'` + `closeBlocks` per chain instead
// of the '1'/'2'/'3' choice keys, so consumers tell it apart from voter rows by
// SHAPE rather than by identity. Never throws: the on-chain `active` flip is
// canonical for pass/fail, and the page falls back to the live recompute until
// this row lands.
export async function writeMemberVoteSnapshot({
  mdp,
  voteCloseTimestamp,
  tally,
  account,
}: {
  mdp: number
  voteCloseTimestamp: number
  tally: MemberProposalTally
  account: HSMAccount
}): Promise<{ written: boolean; closeBlocks: CloseBlocksByChain | null }> {
  let closeBlocks: CloseBlocksByChain | null = null
  try {
    closeBlocks = await resolveCloseBlocks(voteCloseTimestamp)
    const snapshotPayload = {
      kind: 'snapshot' as const,
      voteCloseTimestamp,
      capturedAt: Math.floor(Date.now() / 1000),
      closeBlocks,
      // Tally summary at close time — informational. The page re-derives the
      // same numbers from the votes table + `closeBlocks`, but pinning them
      // here leaves a small audit log alongside the votes.
      tally: {
        forVP: tally.forVP,
        againstVP: tally.againstVP,
        abstainVP: tally.abstainVP,
        decidedVP: tally.decidedVP,
        forPctOfDecided: tally.forPctOfDecided,
        threshold: MEMBER_VOTE_SUPER_MAJORITY,
        passed: tally.passed,
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
    } catch (insertErr: any) {
      // The table has `unique(address, mdp)`. If a snapshot row from a prior
      // close already exists (re-tally on a previously failed proposal),
      // `insertIntoTable` reverts. Fall through to `updateTableCol`, which is
      // gated by msg.sender on the same (mdp, address) pair, so it only
      // touches our own row.
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
    }
    return { written: true, closeBlocks }
  } catch (snapshotErr: any) {
    console.error(
      `[member-proposal-vote] snapshot row write failed for MDP-${mdp}; ` +
        `on-chain decision is committed but page will render with live ` +
        `recompute until a snapshot row is inserted:`,
      snapshotErr?.message ?? snapshotErr
    )
    return { written: false, closeBlocks }
  }
}
