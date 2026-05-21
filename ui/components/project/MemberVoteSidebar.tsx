// Right-rail sidebar that mirrors the layout of the legacy Nance proposal
// page (pages/proposal/[proposal].tsx) for non-project proposals: a vote
// CTA at the top, then a list of every voter with their dominant choice
// and quadratic voting power running down the right side of the proposal.
//
// Three rendering modes derived from the proposal lifecycle:
//   - 'voting'  — Vote button + voter list. Used while members can still cast.
//   - 'closed'  — Voter list only (no CTA), shown after the vote tallied.
//   - 'inactive' — No voters yet (Senate hasn't approved or no rows).
//
// Voting power per voter = sqrt(vMOONEY at the voting-window close) and
// is computed server-side in `pages/project/[tokenId].tsx` so this
// component just renders it (same number used for the on-chain tally).
import { CITIZEN_TABLE_NAMES, DEFAULT_CHAIN_V5 } from 'const/config'
import Link from 'next/link'
import { useMemo } from 'react'
import { formatNumberUSStyle } from '@/lib/nance'
import { ProposalStatus } from '@/lib/nance/useProposalStatus'
import { Project } from '@/lib/project/useProjectData'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'
import { getChainSlug } from '@/lib/thirdweb/chain'
import NewVoteButton from '@/components/nance/NewVoteButton'
import { AddressLink } from '@/components/nance/AddressLink'

const CHOICE_LABELS: Record<string, string> = {
  '1': 'For',
  '2': 'Against',
  '3': 'Abstain',
}

// Map a quadratic vote distribution like { '1': 70, '2': 30 } to a single
// label by picking the choice with the highest weight. Single-click votes
// (after task 4) are always 100/0/0 so this collapses to the obvious
// answer; older split votes still render sensibly.
function dominantChoice(vote: Record<string, number> | undefined): string {
  if (!vote) return 'Unknown'
  let best: [string, number] | null = null
  for (const [k, v] of Object.entries(vote)) {
    const n = Number(v)
    if (!Number.isFinite(n)) continue
    if (best === null || n > best[1]) best = [k, n]
  }
  if (!best || best[1] <= 0) return 'Unknown'
  return CHOICE_LABELS[best[0]] ?? `Choice ${best[0]}`
}

function ChoicePill({ label }: { label: string }) {
  const cls =
    label === 'For'
      ? 'bg-green-500/20 text-green-300 border-green-500/30'
      : label === 'Against'
      ? 'bg-red-500/20 text-red-300 border-red-500/30'
      : label === 'Abstain'
      ? 'bg-gray-500/20 text-gray-300 border-gray-500/30'
      : 'bg-white/5 text-white/60 border-white/10'
  return (
    <span
      className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border ${cls}`}
    >
      {label}
    </span>
  )
}

export type MemberVoteSidebarProps = {
  project: Project
  votes: any[]
  addressToVotingPower: { [address: string]: number }
  proposalStatus: ProposalStatus
  // 'voting' enables the Vote button (and Close & Tally for operators
  // via the parent). 'closed' renders read-only.
  mode: 'voting' | 'closed' | 'inactive'
  // Children slot for the operator-only Close & Tally button so the
  // parent stays in charge of when it shows.
  footer?: React.ReactNode
}

export default function MemberVoteSidebar({
  project,
  votes,
  addressToVotingPower,
  proposalStatus,
  mode,
  footer,
}: MemberVoteSidebarProps) {
  const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)

  // Resolve voter addresses to citizen names so the list reads like the
  // Snapshot/Nance UI rather than a wall of 0x… hashes.
  const citizenStatement = useMemo(() => {
    if (!votes || votes.length === 0) return null
    return `SELECT id, name, owner FROM ${CITIZEN_TABLE_NAMES[chainSlug]} WHERE owner IN (${votes
      .map((v) => `'${String(v.address).toLowerCase()}'`)
      .join(',')})`
  }, [votes, chainSlug])

  const { data: votingCitizens = [] } = useTablelandQuery(citizenStatement, {
    revalidateOnFocus: false,
  })

  const enriched = useMemo(() => {
    return (votes ?? [])
      .map((v) => {
        const addr = String(v.address || '').toLowerCase()
        const vp = addressToVotingPower?.[v.address] ?? addressToVotingPower?.[addr] ?? 0
        const choice = dominantChoice(v.vote)
        const citizen = votingCitizens?.find?.(
          (c: any) => String(c.owner).toLowerCase() === addr
        )
        return { ...v, vp, choice, citizen }
      })
      .sort((a, b) => (b.vp || 0) - (a.vp || 0))
  }, [votes, addressToVotingPower, votingCitizens])

  const totalVP = useMemo(
    () => enriched.reduce((acc, v) => acc + (v.vp || 0), 0),
    [enriched]
  )

  const tally = useMemo(() => {
    const acc = { For: 0, Against: 0, Abstain: 0 }
    for (const v of enriched) {
      if (v.choice === 'For') acc.For += v.vp
      else if (v.choice === 'Against') acc.Against += v.vp
      else if (v.choice === 'Abstain') acc.Abstain += v.vp
    }
    return acc
  }, [enriched])

  // While the Member Vote is the active step, elevate the card so
  // users can't miss the primary action: a tinted background, a
  // gradient ring, and a pulsing "Active — Vote now" pill. Once
  // voting has closed (or hasn't opened yet), strip the emphasis so
  // both sidebar cards read as peers.
  const isActive = mode === 'voting'

  return (
    <aside
      className={
        isActive
          ? 'relative w-full rounded-[20px] p-4 sm:p-5 flex flex-col gap-4 bg-gradient-to-br from-blue-950/60 via-darkest-cool to-purple-950/40 border border-blue-400/40 shadow-[0_0_0_1px_rgba(59,130,246,0.25),0_8px_30px_-12px_rgba(59,130,246,0.45)]'
          : 'w-full bg-dark-cool lg:bg-darkest-cool rounded-[20px] p-4 sm:p-5 flex flex-col gap-4'
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3
            className={
              isActive
                ? 'font-GoodTimes text-base text-white'
                : 'font-GoodTimes text-base text-white/90'
            }
          >
            Member Vote
          </h3>
          <p className="text-[11px] text-white/60 mt-1">
            Quadratic vMOONEY voting (vp = √vMOONEY at close).
          </p>
        </div>
        {isActive && (
          <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-blue-400/50 bg-blue-500/15 text-[10px] font-semibold uppercase tracking-wider text-blue-100">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-300 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-300" />
            </span>
            Vote now
          </span>
        )}
      </div>

      {isActive && (
        <>
          <p className="text-xs text-blue-100/80">
            This is the primary action right now — the Senate has
            approved this proposal and members must weigh in. Click
            below to cast your vote.
          </p>
          <NewVoteButton
            proposalStatus={proposalStatus}
            votes={votes}
            project={project}
          />
        </>
      )}

      {/* Headline tally — total VP and per-choice breakdown. Mirrors the
          old Nance "Total VP" stat strip. */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-white/5 px-2 py-2 border border-white/10">
          <p className="text-[10px] uppercase tracking-wider text-white/50">
            Voters
          </p>
          <p className="text-sm font-semibold text-white">
            {enriched.length}
          </p>
        </div>
        <div className="rounded-lg bg-white/5 px-2 py-2 border border-white/10">
          <p className="text-[10px] uppercase tracking-wider text-white/50">
            Total VP
          </p>
          <p className="text-sm font-semibold text-white">
            {formatNumberUSStyle(totalVP, true)}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-green-300">For</span>
          <span className="text-white/80 font-mono">
            {formatNumberUSStyle(tally.For, true)} VP
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-red-300">Against</span>
          <span className="text-white/80 font-mono">
            {formatNumberUSStyle(tally.Against, true)} VP
          </span>
        </div>
        {tally.Abstain > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Abstain</span>
            <span className="text-white/80 font-mono">
              {formatNumberUSStyle(tally.Abstain, true)} VP
            </span>
          </div>
        )}
      </div>

      {/* Voter list */}
      <div className="border-t border-white/10 pt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-wider text-white/50">
            Votes ({enriched.length})
          </p>
          <p className="text-[10px] text-white/40">sorted by VP</p>
        </div>
        {enriched.length === 0 ? (
          <p className="text-xs text-white/50 italic">
            {mode === 'inactive'
              ? 'Voting has not opened yet.'
              : 'No votes cast yet — be the first.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
            {enriched.map((v) => (
              <li
                key={v.id ?? v.address}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {v.citizen ? (
                    <Link
                      href={`/citizen/${generatePrettyLinkWithId(
                        v.citizen.name,
                        v.citizen.id
                      )}`}
                      className="text-white/90 hover:underline truncate"
                    >
                      {v.citizen.name}
                    </Link>
                  ) : (
                    <span className="text-white/80 font-mono truncate">
                      <AddressLink address={v.address} />
                    </span>
                  )}
                  <ChoicePill label={v.choice} />
                </div>
                <span className="text-white/70 font-mono whitespace-nowrap">
                  {formatNumberUSStyle(v.vp, true)} VP
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {footer && <div className="border-t border-white/10 pt-3">{footer}</div>}
    </aside>
  )
}
