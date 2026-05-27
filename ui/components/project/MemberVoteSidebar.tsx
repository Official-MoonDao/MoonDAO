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

const FOR_KEY = '1'
const AGAINST_KEY = '2'
const ABSTAIN_KEY = '3'

// Mirrors `parseVote` in `lib/proposals/computeMemberProposalTally`:
// the Tableland row's `vote` field can come back as either an already-
// parsed object (Tableland gateway path) or a JSON-encoded string
// (some adapter paths and the legacy `distribution` column). Without
// this fallback, `Object.entries(stringVote)` would iterate the
// characters of the JSON literal and produce nonsense numbers — which
// would silently disagree with the on-chain tally for any caller that
// happens to pass a string-form row.
function parseVoteDist(
  raw: Record<string, number> | string | undefined | null
): Record<string, number> {
  if (raw == null) return {}
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  return raw
}

// Map a quadratic vote distribution like { '1': 70, '2': 30 } to a
// single label by picking the choice with the highest weight. Used
// only for the per-voter ChoicePill in the voter list — the *tally*
// (For/Against/Abstain VP totals) is intentionally computed by
// weighting each voter's VP by their allocation pct (see the
// useMemo below) so it still agrees with the canonical
// `computeMemberProposalTally` for legacy split votes.
function dominantChoice(
  vote: Record<string, number> | string | undefined
): string {
  const dist = parseVoteDist(vote)
  let best: [string, number] | null = null
  for (const [k, v] of Object.entries(dist)) {
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
  // Provenance for the rendered tally. When `source: 'snapshot'`, the
  // numbers are pinned in `MEMBER_PROPOSAL_VMOONEY_SNAPSHOTS` and
  // locked for audit. `'live'` means we're recomputing from the live
  // vMOONEY contract and the values may drift post-close. Used to
  // render a small pill at the top of the card so members know what
  // they're looking at.
  snapshotMeta?: {
    source: 'snapshot' | 'live'
    voteCloseTimestamp: number
    method?: 'historical' | 'projected'
    blockAtClose?: Record<string, number>
    snapshotTakenAt?: number
  } | null
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
  snapshotMeta,
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

  // VP-weighted tally — mirrors `computeMemberProposalTally` line-for-
  // line so the rendered sidebar breakdown can never diverge from the
  // server-side outcome or the on-chain decision. Each voter's VP is
  // distributed across For/Against/Abstain by the same pct allocation
  // they wrote into the Tableland row (split votes preserve their
  // weighting; single-click votes collapse to 100/0/0 and behave as
  // expected). `totalParticipationVP` counts each voter's *full* VP
  // when they allocated to any choice, which is the denominator used
  // for `abstainShareOfTurnout` — same convention as the helper.
  const tally = useMemo(() => {
    let forVP = 0
    let againstVP = 0
    let abstainVP = 0
    let totalParticipationVP = 0
    for (const v of enriched) {
      const power = Number(v.vp) || 0
      if (power <= 0) continue
      const dist = parseVoteDist(v.vote)
      const pctFor = Number(dist[FOR_KEY]) || 0
      const pctAgainst = Number(dist[AGAINST_KEY]) || 0
      const pctAbstain = Number(dist[ABSTAIN_KEY]) || 0
      forVP += (power * pctFor) / 100
      againstVP += (power * pctAgainst) / 100
      abstainVP += (power * pctAbstain) / 100
      if (pctFor > 0 || pctAgainst > 0 || pctAbstain > 0) {
        totalParticipationVP += power
      }
    }
    return { For: forVP, Against: againstVP, Abstain: abstainVP, totalParticipationVP }
  }, [enriched])

  // Percentages match `computeMemberProposalTally`: For/Against are
  // shares of decided VP (Abstain excluded — what the on-chain
  // supermajority test uses), Abstain is reported as % of total
  // participation VP so members can still see how much VP declined
  // to take a side.
  const tallyPercents = useMemo(() => {
    const decided = tally.For + tally.Against
    return {
      forPctOfDecided: decided > 0 ? (tally.For / decided) * 100 : 0,
      againstPctOfDecided: decided > 0 ? (tally.Against / decided) * 100 : 0,
      abstainPctOfTurnout:
        tally.totalParticipationVP > 0
          ? (tally.Abstain / tally.totalParticipationVP) * 100
          : 0,
    }
  }, [tally])

  // While the Member Vote is the active step, elevate the card so
  // users can't miss the primary action: a tinted background, a
  // gradient ring, and a pulsing "Active — Vote now" pill. Once
  // voting has closed (or hasn't opened yet), strip the emphasis so
  // both sidebar cards read as peers.
  const isActive = mode === 'voting'

  // Reveal the per-choice tally and per-voter pick only after the
  // vote has closed. While voting is open we show *who* has voted
  // and their voting power but never *what* they voted for —
  // surfacing the running tally lets late voters bandwagon or vote
  // strategically against a known leader. The on-chain Tableland
  // rows are still public, so this isn't a confidentiality
  // guarantee — just a UI-level discouragement of bandwagoning that
  // matches the legacy Nance flow.
  const revealResults = mode === 'closed'

  return (
    <aside
      className={
        isActive
          ? 'relative w-full rounded-[20px] p-4 sm:p-5 flex flex-col gap-4 bg-gradient-to-br from-blue-950/60 via-darkest-cool to-purple-950/40 border border-blue-400/40 shadow-[0_0_0_1px_rgba(59,130,246,0.25),0_8px_30px_-12px_rgba(59,130,246,0.45)]'
          : 'w-full bg-dark-cool lg:bg-darkest-cool rounded-[20px] p-4 sm:p-5 flex flex-col gap-4'
      }
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          className={
            isActive
              ? 'font-GoodTimes text-base text-white'
              : 'font-GoodTimes text-base text-white/90'
          }
        >
          Member Vote
        </h3>
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

      {/* Provenance pill. Only shown once the vote has closed (so it
          doesn't crowd the active "Vote now" CTA mid-vote). 'snapshot'
          tells members the numbers are locked from a vMOONEY balance
          capture and won't drift; 'live' (the brief window between
          close and the EB pinning a snapshot) tells them the numbers
          may still move slightly until the snapshot lands. */}
      {!isActive &&
        snapshotMeta &&
        snapshotMeta.source === 'snapshot' &&
        enriched.length > 0 && (
          <div
            className="inline-flex items-center gap-1.5 self-start rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-200"
            title="Tally is locked from a vMOONEY snapshot pinned at vote close — values won't drift even if voters change their locks later."
          >
            <span className="w-1 h-1 rounded-full bg-emerald-400" />
            Final tally
          </div>
        )}
      {!isActive &&
        snapshotMeta &&
        snapshotMeta.source === 'live' &&
        mode === 'closed' &&
        enriched.length > 0 && (
          <div
            className="inline-flex items-center gap-1.5 self-start rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200"
            title="Vote has closed but the EB hasn't pinned a vMOONEY snapshot yet, so these numbers are still computed live. Once the snapshot lands the tally is locked for audit."
          >
            <span className="w-1 h-1 rounded-full bg-amber-400" />
            Awaiting snapshot
          </div>
        )}

      {/* Final tally breakdown — pinned to the top of the card so
          it's the first thing readers see post-close. Three labeled
          percentages (For/Against of decided VP, Abstain of turnout)
          over a single proportional bar. Suppressed mid-vote since
          revealing the running split mid-window invites bandwagoning
          (same reason the per-voter Choice pill is gated on
          `revealResults`). */}
      {revealResults && enriched.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-green-300/80">
                For
              </p>
              <p className="text-sm font-semibold text-green-300">
                {tallyPercents.forPctOfDecided.toFixed(1)}%
              </p>
              <p className="text-[10px] text-white/50 font-mono">
                {formatNumberUSStyle(tally.For, true)} VP
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-red-300/80">
                Against
              </p>
              <p className="text-sm font-semibold text-red-300">
                {tallyPercents.againstPctOfDecided.toFixed(1)}%
              </p>
              <p className="text-[10px] text-white/50 font-mono">
                {formatNumberUSStyle(tally.Against, true)} VP
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-300/80">
                Abstain
              </p>
              <p className="text-sm font-semibold text-gray-300">
                {tallyPercents.abstainPctOfTurnout.toFixed(1)}%
              </p>
              <p className="text-[10px] text-white/50 font-mono">
                {formatNumberUSStyle(tally.Abstain, true)} VP
              </p>
            </div>
          </div>
          {/* Single proportional bar visualizes For vs Against —
              Abstain is intentionally omitted from the bar since the
              decision math also excludes it (matches the
              VotingResults ColorBar in the Voting Results tab).
              `role="img"` + a combined `aria-label` on the wrapper
              makes the bar legible to screen readers as one unit;
              the segment <div>s themselves are decorative
              (`aria-hidden`) since their textual percentages are
              already rendered in the grid above. Putting aria-labels
              on the inner divs would not be announced reliably —
              they have no semantic role of their own. */}
          <div
            role="img"
            aria-label={`For ${tallyPercents.forPctOfDecided.toFixed(
              1
            )}%, Against ${tallyPercents.againstPctOfDecided.toFixed(1)}%`}
            className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden flex"
          >
            <div
              aria-hidden="true"
              className="h-full bg-green-500/70"
              style={{ width: `${tallyPercents.forPctOfDecided}%` }}
            />
            <div
              aria-hidden="true"
              className="h-full bg-red-500/70"
              style={{ width: `${tallyPercents.againstPctOfDecided}%` }}
            />
          </div>
        </div>
      )}

      {isActive && (
        <NewVoteButton
          proposalStatus={proposalStatus}
          votes={votes}
          project={project}
        />
      )}

      {/* Participation summary — voter count + total committed VP.
          Visible at every phase: how *many* people have weighed in
          and *how much* voting power has shown up so far is fair to
          surface even mid-vote (it nudges turnout without revealing
          which side is winning). */}
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

      {/* Per-choice tally has moved to the top of the card (pinned
          right after the provenance pill) — keeping the absolute VPs
          there with the % breakdown so the post-close summary stays
          in one place rather than splitting across the card. */}

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
                  {/* Choice pill is only rendered once results are
                      unlocked. Mid-vote, the row is just name + VP —
                      the section header already says "Votes" so a
                      per-row "Voted" pill was redundant noise. */}
                  {revealResults && <ChoicePill label={v.choice} />}
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
