import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import type { MatchupAuthor } from '@/lib/contributions/matchupAuthors'
import {
  FLAG_REASONS,
  MAX_AREAS_SHOWN,
  type FlagReason,
  type MatchupCard,
  type Standing,
} from '@/lib/contributions/matchups'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import WebsiteHead from '@/components/layout/Head'
import type { MatchupResponse, PickResponse } from './api/contributions/matchup'
import type { StandingsResponse } from './api/contributions/matchup-standings'

const QUESTION = 'Which did more to advance the space industry?'
const ANON_VOTER_KEY = 'contribute-vote:voter'

type Choice = string | 'neither'
type CardState = 'idle' | 'won' | 'lost'

// Signed-in voters are keyed by wallet (so they never see their own work);
// everyone else gets a random id remembered in this browser.
function useVoterId(): string | null {
  const account = useActiveAccount()
  const [anonId, setAnonId] = useState<string | null>(null)

  useEffect(() => {
    let id: string | null = null
    try {
      id = window.localStorage.getItem(ANON_VOTER_KEY)
    } catch {
      // storage blocked; fall through to a per-visit id
    }
    if (!id || !/^anon-[a-z0-9-]{8,64}$/.test(id)) {
      id = `anon-${crypto.randomUUID()}`
      try {
        window.localStorage.setItem(ANON_VOTER_KEY, id)
      } catch {
        // ignore
      }
    }
    setAnonId(id)
  }, [])

  return account?.address ? account.address.toLowerCase() : anonId
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function AreaChips({ areas }: { areas: string[] }) {
  const shown = areas.slice(0, MAX_AREAS_SHOWN)
  const extra = areas.length - shown.length
  return (
    <>
      {shown.map((area) => (
        <span
          key={area}
          className="px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-300 text-xs font-medium"
        >
          {area}
        </span>
      ))}
      {extra > 0 && (
        <span
          className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-300/80 text-xs"
          title={areas.slice(MAX_AREAS_SHOWN).join(', ')}
        >
          +{extra}
        </span>
      )}
    </>
  )
}

function FlagControl({
  flagged,
  disabled,
  onFlag,
}: {
  flagged: boolean
  disabled: boolean
  onFlag: (reason: FlagReason) => void
}) {
  const [open, setOpen] = useState(false)

  if (flagged) {
    return <p className="text-amber-300/80 text-xs">Flagged for Senate review</p>
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="text-gray-500 hover:text-gray-300 text-xs disabled:opacity-50"
      >
        ⚑ Flag
      </button>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(Object.keys(FLAG_REASONS) as FlagReason[]).map((reason) => (
        <button
          key={reason}
          type="button"
          onClick={() => {
            setOpen(false)
            onFlag(reason)
          }}
          className="px-2.5 py-1 rounded-full border border-amber-400/30 text-amber-200 hover:bg-amber-500/10 text-xs"
        >
          {FLAG_REASONS[reason]}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-gray-500 hover:text-gray-300 text-xs"
      >
        Cancel
      </button>
    </div>
  )
}

function ContributionCard({
  card,
  side,
  disabled,
  state,
  author,
  flagged,
  canFlag,
  onPick,
  onFlag,
}: {
  card: MatchupCard
  side: 'left' | 'right'
  disabled: boolean
  state: CardState
  author: MatchupAuthor | null
  flagged: boolean
  canFlag: boolean
  onPick: () => void
  onFlag: (reason: FlagReason) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const long = card.description.length > 420

  const ring =
    state === 'won'
      ? 'border-emerald-400 bg-emerald-500/10'
      : state === 'lost'
      ? 'border-white/5'
      : 'border-white/10 hover:border-blue-400/60'

  return (
    <div
      className={`flex flex-col bg-white/5 border rounded-2xl p-5 md:p-6 transition-all duration-200 min-w-0 ${ring}`}
    >
      <div className={`flex flex-col flex-1 ${state === 'lost' ? 'opacity-50' : ''}`}>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <AreaChips areas={card.areas} />
          {card.timeCommitment && (
            <span className="px-2.5 py-1 rounded-full bg-white/10 text-gray-300 text-xs">
              {card.timeCommitment}
            </span>
          )}
          {card.submittedAt && (
            <span className="text-gray-500 text-xs ml-auto">{formatDate(card.submittedAt)}</span>
          )}
        </div>

        <p
          className={`text-gray-200 text-sm leading-relaxed whitespace-pre-line break-words ${
            long && !expanded ? 'line-clamp-[10]' : ''
          }`}
        >
          {card.description}
        </p>
        {long && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="self-start text-blue-400 hover:text-blue-300 text-xs mt-2"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}

        {card.links.length > 0 && (
          <div className="flex flex-col gap-1 mt-4">
            {card.links.map((link) => (
              <a
                key={link}
                href={link}
                target="_blank"
                rel="noreferrer noopener"
                className="text-blue-400 hover:text-blue-300 text-xs underline truncate"
              >
                {hostOf(link)} ↗
              </a>
            ))}
          </div>
        )}
      </div>

      {author ? (
        <div className="mt-auto pt-5">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
            <div className="min-w-0">
              <p className="text-gray-500 text-[11px] uppercase tracking-wide">
                {state === 'won' ? 'Your pick · by' : 'By'}
              </p>
              <p className="text-white font-semibold text-sm truncate">{author.name}</p>
            </div>
            {author.profileUrl && (
              <Link
                href={author.profileUrl}
                target="_blank"
                className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 text-xs font-medium"
              >
                View profile ↗
              </Link>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPick}
          disabled={disabled}
          className="mt-auto pt-5 w-full"
          aria-label={`Pick the ${side} contribution`}
        >
          <span
            className={`block w-full px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm transition-colors ${
              disabled ? 'opacity-50' : ''
            }`}
          >
            {state === 'won' ? 'Picked ✓' : side === 'left' ? '← This one' : 'This one →'}
          </span>
        </button>
      )}

      {canFlag && (
        <div className="pt-3 min-h-[28px]">
          <FlagControl flagged={flagged} disabled={disabled} onFlag={onFlag} />
        </div>
      )}
    </div>
  )
}

function Standings({ data }: { data: StandingsResponse | null }) {
  if (!data) {
    return <p className="text-gray-500 text-sm">Loading standings…</p>
  }
  if (data.standings.length === 0) {
    return <p className="text-gray-500 text-sm">No contributions in the last 90 days yet.</p>
  }

  return (
    <div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-white/10">
            <th className="py-2 px-1 font-medium">#</th>
            <th className="py-2 px-1 font-medium">Contribution</th>
            <th className="py-2 px-1 font-medium text-right hidden sm:table-cell">Matchups</th>
            <th className="py-2 px-1 font-medium text-right hidden sm:table-cell">Win rate</th>
            <th className="py-2 px-1 font-medium text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {data.standings.map((s: Standing, i) => (
            <tr key={s.card.id} className="border-b border-white/5 align-top">
              <td className="py-3 px-1 text-gray-500 tabular-nums">{i + 1}</td>
              <td className="py-3 px-1 max-w-[420px]">
                <span className="flex flex-wrap items-center gap-x-2 mb-0.5">
                  {s.card.areas.length > 0 && (
                    <span className="text-blue-300 text-xs">
                      {s.card.areas.slice(0, MAX_AREAS_SHOWN).join(' · ')}
                      {s.card.areas.length > MAX_AREAS_SHOWN &&
                        ` +${s.card.areas.length - MAX_AREAS_SHOWN}`}
                    </span>
                  )}
                  {s.flags > 0 && (
                    <span className="text-amber-300/80 text-xs">
                      ⚑ {s.flags} flag{s.flags === 1 ? '' : 's'}
                    </span>
                  )}
                </span>
                <span className="text-gray-300 line-clamp-2 break-words">{s.card.description}</span>
                <span className="sm:hidden block text-gray-500 text-xs mt-1 tabular-nums">
                  {s.matchups} matchups
                  {s.winRate === null ? '' : ` · ${Math.round(s.winRate * 100)}% won`}
                </span>
              </td>
              <td className="py-3 px-1 text-right text-gray-300 tabular-nums hidden sm:table-cell">{s.matchups}</td>
              <td className="py-3 px-1 text-right text-gray-300 tabular-nums hidden sm:table-cell">
                {s.winRate === null ? '—' : `${Math.round(s.winRate * 100)}%`}
              </td>
              <td className="py-3 pl-3 pr-1 text-right tabular-nums whitespace-nowrap">
                {s.status === 'paid' && (
                  <span className="text-emerald-300 font-semibold">
                    {((s.share ?? 0) * 100).toFixed(1)}%
                  </span>
                )}
                {s.status === 'cut' && <span className="text-gray-500">Below cutoff</span>}
                {s.status === 'needs-votes' && (
                  <span className="text-amber-300/80 text-xs">
                    Needs {data.minMatchups - s.matchups} more
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ContributeVotePage() {
  const voter = useVoterId()
  const [matchup, setMatchup] = useState<MatchupResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [choice, setChoice] = useState<Choice | null>(null)
  const [authors, setAuthors] = useState<PickResponse['authors']>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sessionPicks, setSessionPicks] = useState(0)
  const [flagged, setFlagged] = useState<Record<string, boolean>>({})
  // Prototype-only escape hatch for the daily limit.
  const [ignoreLimit, setIgnoreLimit] = useState(false)
  const [standings, setStandings] = useState<StandingsResponse | null>(null)
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>()

  const loadStandings = useCallback(async () => {
    try {
      const res = await fetch('/api/contributions/matchup-standings')
      if (res.ok) setStandings(await res.json())
    } catch {
      // standings are secondary; keep the last good copy
    }
  }, [])

  const loadMatchup = useCallback(async () => {
    if (!voter) return
    clearTimeout(advanceTimer.current)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/contributions/matchup?voter=${encodeURIComponent(voter)}`
      )
      const body = await res.json()
      if (!res.ok) throw new Error(body?.message || 'Could not load a matchup')
      // Clear the previous pick only once the new pair is ready, so the old
      // cards don't flash back to their unpicked state while loading.
      setMatchup(body)
      setChoice(null)
      setAuthors(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load a matchup')
    } finally {
      setLoading(false)
    }
  }, [voter])

  useEffect(() => {
    loadMatchup()
  }, [loadMatchup])

  useEffect(() => {
    loadStandings()
    return () => clearTimeout(advanceTimer.current)
  }, [loadStandings])

  const atLimit =
    !!matchup &&
    matchup.storage &&
    !ignoreLimit &&
    !choice &&
    matchup.votesToday >= matchup.maxVotesPerDay

  // `next` is a contribution id, 'neither', or null to skip.
  const submit = useCallback(
    async (next: Choice | null) => {
      if (!matchup?.cards || submitting || choice || !voter) return

      // Preview mode: nothing to save, just show the next pair.
      if (!matchup.matchupId) {
        if (next) setChoice(next)
        advanceTimer.current = setTimeout(loadMatchup, next ? 450 : 0)
        return
      }

      setSubmitting(true)
      if (next) setChoice(next)
      try {
        const res = await fetch('/api/contributions/matchup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            voter,
            matchupId: matchup.matchupId,
            winnerId: next,
            ignoreDailyLimit: ignoreLimit,
          }),
        })
        const body = await res.json()
        if (!res.ok) {
          setChoice(null)
          if (res.status === 429) {
            setMatchup({ ...matchup, votesToday: matchup.maxVotesPerDay })
            return
          }
          throw new Error(body?.message || 'Could not save your pick')
        }
        if (!next) {
          loadMatchup()
          return
        }
        const pick = body as PickResponse
        setSessionPicks((n) => n + 1)
        setMatchup((m) => (m ? { ...m, votesToday: pick.votesToday } : m))
        setAuthors(pick.authors)
        loadStandings()
        // Without author details there's nothing to show; move straight on.
        if (!pick.authors) advanceTimer.current = setTimeout(loadMatchup, 450)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save your pick')
      } finally {
        setSubmitting(false)
      }
    },
    [matchup, submitting, choice, voter, ignoreLimit, loadMatchup, loadStandings]
  )

  const flag = useCallback(
    async (contributionId: string, reason: FlagReason) => {
      if (!voter) return
      setFlagged((f) => ({ ...f, [contributionId]: true }))
      try {
        const res = await fetch('/api/contributions/matchup-flag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voter, contributionId, reason }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.message || 'Could not save your flag')
        }
        loadStandings()
      } catch (err) {
        setFlagged((f) => ({ ...f, [contributionId]: false }))
        setError(err instanceof Error ? err.message : 'Could not save your flag')
      }
    },
    [voter, loadStandings]
  )

  const revealed = !!authors

  // Before a pick: ← / → to pick, N for neither, S to skip.
  // After a pick: Enter (or → / Space) for the next matchup.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      // Enter/Space on a focused button or link already clicks it.
      if (target && /^(BUTTON|A)$/.test(target.tagName) && /^(Enter| )$/.test(e.key)) return
      if (!matchup?.cards || loading || atLimit) return
      const key = e.key.toLowerCase()
      if (revealed) {
        if (key === 'enter' || key === 'arrowright' || key === ' ') {
          e.preventDefault()
          loadMatchup()
        }
        return
      }
      if (key === 'arrowleft') submit(matchup.cards[0].id)
      else if (key === 'arrowright') submit(matchup.cards[1].id)
      else if (key === 'n') submit('neither')
      else if (key === 's') submit(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [matchup, loading, atLimit, revealed, submit, loadMatchup])

  const cards = matchup?.cards
  const busy = loading || submitting || !!choice

  const cardState = (id: string): CardState => {
    if (!choice) return 'idle'
    if (choice === 'neither') return 'lost'
    return choice === id ? 'won' : 'lost'
  }

  const renderCard = (i: 0 | 1) => {
    const card = cards![i]
    return (
      <ContributionCard
        key={card.id}
        card={card}
        side={i === 0 ? 'left' : 'right'}
        disabled={busy}
        state={cardState(card.id)}
        author={authors?.[card.id] ?? null}
        flagged={!!flagged[card.id]}
        canFlag={matchup?.storage ?? false}
        onPick={() => submit(card.id)}
        onFlag={(reason) => flag(card.id, reason)}
      />
    )
  }

  return (
    <>
      <WebsiteHead
        title="Contribution Matchups"
        description="Compare two community contributions head to head and pick the one that did more to advance the space industry."
      />
      <section className="flex flex-col justify-start items-start animate-fadeIn w-[90vw] md:w-full px-5 mt-5">
        <Container>
          <ContentLayout
            header="Contribution Matchups"
            headerSize="max(20px, 3vw)"
            mainPadding
            mode="compact"
            popOverEffect={false}
            isProfile
            description={
              <>
                A prototype of peer review for the Community Circle. Read two recent
                contributions and pick the one that did more. Authors are hidden until
                you pick, so the work is judged on its own.{' '}
                <Link href="/contributions" className="text-blue-400 hover:text-blue-300 underline">
                  See all submissions
                </Link>
              </>
            }
          >
            <div className="flex flex-col gap-8 max-w-[1200px] md:mb-[5vw] 2xl:mb-[2vw]">
              {matchup && !matchup.storage && (
                <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-amber-200 text-sm">
                  Preview mode: vote storage isn&apos;t configured on this deployment, so
                  picks aren&apos;t saved.
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <h2 className="text-white font-GoodTimes text-lg md:text-2xl">{QUESTION}</h2>
                {matchup?.storage && (
                  <p
                    className={`text-xs tabular-nums whitespace-nowrap ${
                      matchup.votesToday > matchup.maxVotesPerDay ? 'text-amber-300/80' : 'text-gray-400'
                    }`}
                  >
                    {matchup.votesToday} / {matchup.maxVotesPerDay} picks today
                  </p>
                )}
              </div>

              {error && (
                <div className="flex items-center justify-between gap-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3">
                  <p className="text-red-200 text-sm">{error}</p>
                  <button
                    type="button"
                    onClick={loadMatchup}
                    className="text-red-100 text-sm underline whitespace-nowrap"
                  >
                    Try again
                  </button>
                </div>
              )}

              {atLimit ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-center">
                  <p className="text-white font-semibold mb-1">
                    {matchup?.votesToday} / {matchup?.maxVotesPerDay} picks today. Thank you!
                  </p>
                  <p className="text-gray-400 text-sm">
                    Come back tomorrow for more matchups. Standings update as picks come in.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIgnoreLimit(true)
                      loadMatchup()
                    }}
                    className="mt-4 text-blue-400 hover:text-blue-300 text-sm underline"
                  >
                    Continue anyway (prototype only)
                  </button>
                </div>
              ) : !cards && !loading && !error ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-center">
                  <p className="text-white font-semibold mb-1">Not enough contributions to compare</p>
                  <p className="text-gray-400 text-sm">
                    Matchups need at least two contributions from the last 90 days
                    {matchup ? ` (found ${matchup.poolSize}).` : '.'}
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <div
                    className={`grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 md:gap-5 items-stretch transition-opacity ${
                      loading && !cards ? 'opacity-0' : loading ? 'opacity-50' : 'opacity-100'
                    }`}
                  >
                    {cards ? (
                      <>
                        {renderCard(0)}
                        <div className="flex md:flex-col items-center justify-center gap-3">
                          <span className="font-GoodTimes text-gray-500 text-sm">VS</span>
                        </div>
                        {renderCard(1)}
                      </>
                    ) : (
                      <div className="h-64" />
                    )}
                  </div>
                  {loading && !cards && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    </div>
                  )}
                </div>
              )}

              {cards && !atLimit && (
                <div className="flex flex-wrap items-center justify-center gap-3 -mt-2">
                  {revealed ? (
                    <>
                      <p className="text-gray-400 text-sm w-full text-center">
                        {choice === 'neither'
                          ? 'Counted as a loss for both. Here’s who submitted them.'
                          : 'Pick saved. Here’s who did the work. Reach out if it resonated.'}
                      </p>
                      <button
                        type="button"
                        onClick={loadMatchup}
                        autoFocus
                        className="px-6 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm"
                      >
                        Next matchup →
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => submit('neither')}
                        disabled={busy}
                        className="px-5 py-2 rounded-xl border border-white/15 text-gray-300 hover:bg-white/5 text-sm disabled:opacity-50"
                        title="Neither is a meaningful contribution: both count as a loss"
                      >
                        Neither
                      </button>
                      <button
                        type="button"
                        onClick={() => submit(null)}
                        disabled={busy}
                        className="px-5 py-2 rounded-xl border border-white/15 text-gray-300 hover:bg-white/5 text-sm disabled:opacity-50"
                        title="Can't decide: nothing is counted"
                      >
                        Skip
                      </button>
                    </>
                  )}
                </div>
              )}
              {cards && !atLimit && (
                <p className="text-gray-500 text-xs text-center -mt-4 hidden md:block">
                  {revealed
                    ? 'Keyboard: Enter for the next matchup'
                    : 'Keyboard: ← / → to pick, N for neither, S to skip'}
                  {sessionPicks > 0 &&
                    ` · ${sessionPicks} pick${sessionPicks === 1 ? '' : 's'} this visit`}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  ['Pick one, or neither', 'Two contributions from the last 3 months. Choose the one that did more, or “Neither” if both fall short; then see who did the work.'],
                  ['Least-compared first', 'Contributions with the fewest matchups show up first, so every one gets enough votes.'],
                  ['Win more, earn more', 'Shares are win rate squared: winning twice as often earns about four times as much.'],
                  ['Bottom quarter cut', `Contributions need ${standings?.minMatchups ?? 5} matchups to be ranked; the bottom 25% earn nothing. Flags go to the Senate and don’t change scores.`],
                ].map(([title, body]) => (
                  <div key={title} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-white font-semibold text-sm mb-1">{title}</p>
                    <p className="text-gray-400 text-xs leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>

              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                  <h2 className="text-white font-GoodTimes text-xl">Current standings</h2>
                  {standings && (
                    <p className="text-gray-500 text-xs">
                      {standings.totalPicks} pick{standings.totalPicks === 1 ? '' : 's'} so far · prototype, not used for payouts
                    </p>
                  )}
                </div>
                <Standings data={standings} />
              </div>
            </div>
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}
