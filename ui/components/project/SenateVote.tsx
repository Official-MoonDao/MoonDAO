// Shared Senate vote UI used by both /projects (ProjectCard, in the
// senate-vote phase) and /project/[tokenId] (non-project proposal page).
//
// Two render targets, two exports:
//   - SenateVoteButtons (+ SenatorsStatus): compact pill cluster sized for the
//     right rail of ProjectCard. Kept for backward compatibility.
//   - SenateVote (default): full-width, two-section layout designed for a
//     SectionCard on the project page. Includes summary counts, action
//     buttons, and the per-senator status grid in one balanced layout.
//
// Voting writes to the on-chain Proposals contract via voteTempCheck(mdp, pass).
import { usePrivy } from '@privy-io/react-auth'
import confetti from 'canvas-confetti'
import ProposalsABI from 'const/abis/Proposals.json'
import { DEFAULT_CHAIN_V5, PROPOSALS_ADDRESSES } from 'const/config'
import React, { memo, useEffect } from 'react'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import useProposalData from '@/lib/project/useProposalData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useIsSenator } from '@/lib/thirdweb/hooks/useIsSenator'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'

const VOTE_CONFETTI = (pass: boolean) =>
  confetti({
    particleCount: 150,
    spread: 100,
    origin: { y: 0.6 },
    shapes: ['circle', 'star'],
    colors: pass
      ? ['#22c55e', '#4ade80', '#86efac', '#ffffff', '#FFD700']
      : ['#ef4444', '#f87171', '#fca5a5', '#ffffff', '#FFD700'],
  })

// Senators Status Display – used by ProjectCard's compact right-rail variant.
export const SenatorsStatus = memo(
  ({
    senatorVotes,
    isLoading,
  }: {
    senatorVotes: any[]
    isLoading: boolean
  }) => {
    const votedSenators = senatorVotes.filter((s) => s.hasVoted)
    const pendingSenators = senatorVotes.filter((s) => !s.hasVoted)

    if (isLoading) {
      return (
        <div data-testid="senators-loading" className="flex items-center gap-2">
          <LoadingSpinner width="w-4" height="h-4" />
          <span className="text-[11px] text-white/60">Loading senators...</span>
        </div>
      )
    }

    if (senatorVotes.length === 0) return null

    return (
      <div
        data-testid="senators-status"
        className="p-2 rounded-lg bg-slate-800/40 border border-white/10 w-fit"
        onClick={(e) => e.stopPropagation()}
      >
        <div data-testid="senators-count" className="text-[11px] text-white/60 mb-1.5">
          Senators ({votedSenators.length}/{senatorVotes.length} voted)
        </div>
        <div className="flex flex-wrap gap-1">
          {votedSenators.map((senator) => (
            <div
              key={senator.address}
              data-testid={`senator-voted-${senator.name}`}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/20 border border-green-500/30"
              title={`${senator.name} has voted`}
            >
              <span className="text-[10px]">✓</span>
              <span className="text-[10px] text-white/90">{senator.name}</span>
            </div>
          ))}
          {pendingSenators.map((senator) => (
            <div
              key={senator.address}
              data-testid={`senator-pending-${senator.name}`}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-500/20 border border-gray-500/30"
              title={`${senator.name} has not voted yet`}
            >
              <span className="text-[10px]">○</span>
              <span className="text-[10px] text-white/50">{senator.name}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
)
SenatorsStatus.displayName = 'SenatorsStatus'

// Compact vote-button cluster used by ProjectCard.
export const SenateVoteButtons = memo(
  ({
    mdp,
    budgetLabel,
    onSenatorVotesChange,
  }: {
    mdp: number
    budgetLabel?: string
    onSenatorVotesChange?: (votes: any[], loading: boolean) => void
  }) => {
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)
    const account = useActiveAccount()
    const { authenticated } = usePrivy()
    const { isSenator, isLoading: isSenatorLoading } = useIsSenator()

    const proposalContract = useContract({
      address: PROPOSALS_ADDRESSES[chainSlug],
      chain: chain,
      abi: ProposalsABI.abi as any,
    })

    const { proposalData, senatorVotes, isLoading, refetch } = useProposalData(
      proposalContract,
      mdp
    )

    useEffect(() => {
      if (onSenatorVotesChange) {
        onSenatorVotesChange(senatorVotes, isLoading)
      }
    }, [senatorVotes, isLoading, onSenatorVotesChange])

    const handleVote = (pass: boolean) => {
      return async () => {
        if (!account) return
        const transaction = prepareContractCall({
          contract: proposalContract,
          method: 'voteTempCheck' as string,
          params: [mdp, pass],
        })
        await sendAndConfirmTransaction({
          transaction,
          account,
        })
        VOTE_CONFETTI(pass)
        refetch()
      }
    }

    const approvalCount =
      'tempCheckApprovalCount' in proposalData
        ? Number(proposalData?.tempCheckApprovalCount || 0).toString()
        : '0'
    const rejectionCount =
      'tempCheckVoteCount' in proposalData
        ? (
            Number(proposalData?.tempCheckVoteCount || 0) -
            Number(proposalData?.tempCheckApprovalCount || 0)
          ).toString()
        : '0'

    if (isSenatorLoading) {
      return (
        <div className="flex items-center gap-2 flex-shrink-0">
          <LoadingSpinner width="w-5" height="h-5" />
        </div>
      )
    }

    const VoteButtons =
      isSenator && account && authenticated ? (
        <div className="flex items-center gap-2">
          <PrivyWeb3Button
            action={handleVote(true)}
            requiredChain={DEFAULT_CHAIN_V5}
            className="!px-3 !py-2 !min-w-0 !h-[36px] rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium text-sm transition-all"
            label={`👍 ${approvalCount}`}
          />
          <PrivyWeb3Button
            action={handleVote(false)}
            requiredChain={DEFAULT_CHAIN_V5}
            className="!px-3 !py-2 !min-w-0 !h-[36px] rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-all"
            label={`👎 ${rejectionCount}`}
          />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="px-3 py-2 h-[36px] rounded-lg bg-green-600/50 text-white font-medium text-sm flex items-center">
            👍 {approvalCount}
          </div>
          <div className="px-3 py-2 h-[36px] rounded-lg bg-red-600/50 text-white font-medium text-sm flex items-center">
            👎 {rejectionCount}
          </div>
        </div>
      )

    return (
      <div className="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto sm:flex-shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {budgetLabel && (
            <span className="px-3 py-1.5 h-[36px] flex items-center rounded-lg text-sm font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {budgetLabel}
            </span>
          )}
          {VoteButtons}
        </div>
      </div>
    )
  }
)
SenateVoteButtons.displayName = 'SenateVoteButtons'

// ---------------------------------------------------------------------------
// Default export: full-width project-page Senate Vote layout.
// ---------------------------------------------------------------------------

function StatPill({
  emoji,
  label,
  count,
  tone,
}: {
  emoji: string
  label: string
  count: number
  tone: 'positive' | 'negative' | 'neutral'
}) {
  const styles = {
    positive: 'bg-green-500/15 border-green-500/30 text-green-300',
    negative: 'bg-red-500/15 border-red-500/30 text-red-300',
    neutral: 'bg-slate-500/15 border-slate-500/30 text-slate-200',
  }[tone]

  return (
    <div
      className={`flex flex-col items-center justify-center min-w-[120px] flex-1 sm:flex-initial px-4 py-3 rounded-xl border ${styles}`}
    >
      <div className="text-2xl font-bold leading-none">
        <span className="mr-1">{emoji}</span>
        {count}
      </div>
      <div className="text-[10px] uppercase tracking-wider mt-1.5 opacity-80">
        {label}
      </div>
    </div>
  )
}

function SenatorPill({
  name,
  hasVoted,
  votedApprove,
  votedDeny,
}: {
  name: string
  hasVoted: boolean
  votedApprove: boolean
  votedDeny: boolean
}) {
  const tone = !hasVoted
    ? 'bg-slate-700/40 border-white/10 text-white/50'
    : votedApprove
    ? 'bg-green-500/20 border-green-500/40 text-green-200'
    : votedDeny
    ? 'bg-red-500/20 border-red-500/40 text-red-200'
    : 'bg-slate-700/40 border-white/10 text-white/70'

  const icon = !hasVoted ? '○' : votedApprove ? '✓' : votedDeny ? '✗' : '•'

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs ${tone}`}
      title={`${name}${
        hasVoted
          ? votedApprove
            ? ' approved'
            : votedDeny
            ? ' rejected'
            : ' voted'
          : ' has not voted yet'
      }`}
    >
      <span className="text-[11px]">{icon}</span>
      <span className="font-medium">{name}</span>
    </div>
  )
}

export default function SenateVote({ mdp }: { mdp: number }) {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const account = useActiveAccount()
  const { authenticated } = usePrivy()
  const { isSenator, isLoading: isSenatorLoading } = useIsSenator()

  const proposalContract = useContract({
    address: PROPOSALS_ADDRESSES[chainSlug],
    chain: chain,
    abi: ProposalsABI.abi as any,
  })

  const { proposalData, senatorVotes, isLoading, refetch } = useProposalData(
    proposalContract,
    mdp
  )

  const handleVote = (pass: boolean) => async () => {
    if (!account) return
    const transaction = prepareContractCall({
      contract: proposalContract,
      method: 'voteTempCheck' as string,
      params: [mdp, pass],
    })
    await sendAndConfirmTransaction({ transaction, account })
    VOTE_CONFETTI(pass)
    refetch()
  }

  const approvalCount =
    'tempCheckApprovalCount' in proposalData
      ? Number(proposalData?.tempCheckApprovalCount || 0)
      : 0
  const totalVoteCount =
    'tempCheckVoteCount' in proposalData
      ? Number(proposalData?.tempCheckVoteCount || 0)
      : 0
  const rejectionCount = Math.max(totalVoteCount - approvalCount, 0)

  const votedCount = senatorVotes.filter((s) => s.hasVoted).length
  const senatorTotal = senatorVotes.length

  const canVote = isSenator && Boolean(account) && authenticated

  return (
    <div className="flex flex-col gap-6">
      {/* Summary stats — equal-width cards on every screen */}
      <div className="grid grid-cols-3 gap-3">
        <StatPill emoji="👍" label="For" count={approvalCount} tone="positive" />
        <StatPill
          emoji="👎"
          label="Against"
          count={rejectionCount}
          tone="negative"
        />
        <StatPill
          emoji="🗳️"
          label={`of ${senatorTotal} voted`}
          count={votedCount}
          tone="neutral"
        />
      </div>

      {/* Action row — buttons for senators, status note for everyone else */}
      <div className="flex flex-col items-center gap-3">
        {isSenatorLoading ? (
          <LoadingSpinner width="w-5" height="h-5" />
        ) : canVote ? (
          <>
            <p className="text-xs uppercase tracking-wider text-white/60">
              Cast your senate vote
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto sm:max-w-md">
              <PrivyWeb3Button
                action={handleVote(true)}
                requiredChain={DEFAULT_CHAIN_V5}
                className="flex-1 !px-6 !py-3 rounded-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-semibold text-base transition-all shadow-lg"
                label="👍 Approve"
              />
              <PrivyWeb3Button
                action={handleVote(false)}
                requiredChain={DEFAULT_CHAIN_V5}
                className="flex-1 !px-6 !py-3 rounded-lg bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold text-base transition-all shadow-lg"
                label="👎 Reject"
              />
            </div>
          </>
        ) : (
          <p className="text-xs text-white/50">
            Only senators can cast a vote at this stage.
          </p>
        )}
      </div>

      {/* Senator roster */}
      {senatorTotal > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h4 className="text-xs uppercase tracking-wider text-white/60">
              Senators
            </h4>
            <span className="text-[11px] text-white/40">
              {votedCount}/{senatorTotal} voted
            </span>
          </div>
          <div
            className={`flex flex-wrap gap-1.5 ${
              isLoading ? 'opacity-60' : ''
            }`}
          >
            {senatorVotes.map((s) => (
              <SenatorPill
                key={s.address}
                name={s.name}
                hasVoted={s.hasVoted}
                votedApprove={s.votedApprove}
                votedDeny={s.votedDeny}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
