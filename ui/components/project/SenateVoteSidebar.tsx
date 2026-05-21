// Compact, right-rail variant of the Senate Vote breakdown that lives
// alongside `MemberVoteSidebar`. Always read-only — the interactive
// 👍/👎 buttons (for senators) and the operator Close Senate Vote
// control stay in the main-column SectionCard during Temperature Check
// because they need more breathing room than the rail allows. The
// sidebar's job is to be the persistent reference card members can
// glance at to see how the proposal got past the Senate (or whether
// it has).
//
// Reads the same on-chain state as the full `SenateVote` component
// via `useProposalData` so the two views can never disagree.
import ProposalsABI from 'const/abis/Proposals.json'
import { DEFAULT_CHAIN_V5, PROPOSALS_ADDRESSES } from 'const/config'
import useProposalData from '@/lib/project/useProposalData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'

export default function SenateVoteSidebar({
  mdp,
  // When `true`, render dimmed/quieter — the Member Vote above is the
  // active step and this card should fade into reference territory so
  // the eye lands on the primary CTA. The breakdown is still fully
  // legible at hover/focus.
  secondary = false,
}: {
  mdp: number
  secondary?: boolean
}) {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)

  const proposalContract = useContract({
    address: PROPOSALS_ADDRESSES[chainSlug],
    chain,
    abi: ProposalsABI.abi as any,
  })

  const { proposalData, senatorVotes, isLoading } = useProposalData(
    proposalContract,
    mdp
  )

  const approvalCount =
    'tempCheckApprovalCount' in proposalData
      ? Number(proposalData?.tempCheckApprovalCount || 0)
      : 0
  const totalVoteCount =
    'tempCheckVoteCount' in proposalData
      ? Number(proposalData?.tempCheckVoteCount || 0)
      : 0
  const rejectionCount = Math.max(totalVoteCount - approvalCount, 0)
  const tempCheckApproved = Boolean(
    'tempCheckApproved' in proposalData && proposalData?.tempCheckApproved
  )
  const tempCheckFailed = Boolean(
    'tempCheckFailed' in proposalData && proposalData?.tempCheckFailed
  )
  const senatorTotal = senatorVotes.length
  const votedCount = senatorVotes.filter((s) => s.hasVoted).length

  // Three states: approved (green), failed (red), in-progress (slate).
  // `tempCheckApproved` and `tempCheckFailed` are mutually exclusive on
  // chain so the cascade below is unambiguous.
  const outcome = tempCheckApproved
    ? {
        label: 'Approved by Senate',
        className: 'bg-green-500/15 border-green-500/40 text-green-200',
      }
    : tempCheckFailed
    ? {
        label: 'Rejected by Senate',
        className: 'bg-red-500/15 border-red-500/40 text-red-200',
      }
    : {
        label: 'Senate vote in progress',
        className: 'bg-slate-500/15 border-slate-500/40 text-slate-200',
      }

  return (
    <aside
      className={
        secondary
          ? 'w-full bg-dark-cool lg:bg-darkest-cool/60 rounded-[20px] p-4 sm:p-5 flex flex-col gap-4 border border-white/5 opacity-80 hover:opacity-100 focus-within:opacity-100 transition-opacity'
          : 'w-full bg-dark-cool lg:bg-darkest-cool rounded-[20px] p-4 sm:p-5 flex flex-col gap-4'
      }
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-GoodTimes text-base text-white/80">
          Senate Vote
        </h3>
        <span
          className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold uppercase tracking-wider ${outcome.className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {outcome.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-2 py-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-green-300/80">
            For
          </p>
          <p className="text-base font-semibold text-green-200">
            {approvalCount}
          </p>
        </div>
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-2 py-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-red-300/80">
            Against
          </p>
          <p className="text-base font-semibold text-red-200">
            {rejectionCount}
          </p>
        </div>
        <div className="rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-white/50">
            Voted
          </p>
          <p className="text-base font-semibold text-white">
            {votedCount}/{senatorTotal}
          </p>
        </div>
      </div>

      {senatorTotal > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h4 className="text-[10px] uppercase tracking-wider text-white/50">
              Senators
            </h4>
            <span className="text-[10px] text-white/40">
              {votedCount}/{senatorTotal}
            </span>
          </div>
          <div
            className={`flex flex-wrap gap-1.5 ${
              isLoading ? 'opacity-60' : ''
            }`}
          >
            {senatorVotes.map((s) => {
              const tone = !s.hasVoted
                ? 'bg-slate-700/40 border-white/10 text-white/50'
                : s.votedApprove
                ? 'bg-green-500/20 border-green-500/40 text-green-200'
                : s.votedDeny
                ? 'bg-red-500/20 border-red-500/40 text-red-200'
                : 'bg-slate-700/40 border-white/10 text-white/70'
              const icon = !s.hasVoted
                ? '○'
                : s.votedApprove
                ? '✓'
                : s.votedDeny
                ? '✗'
                : '•'
              return (
                <span
                  key={s.address}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] ${tone}`}
                  title={`${s.name}${
                    s.hasVoted
                      ? s.votedApprove
                        ? ' approved'
                        : s.votedDeny
                        ? ' rejected'
                        : ' voted'
                      : ' has not voted yet'
                  }`}
                >
                  <span>{icon}</span>
                  <span className="font-medium">{s.name}</span>
                </span>
              )
            })}
          </div>
        </div>
      )}
    </aside>
  )
}
