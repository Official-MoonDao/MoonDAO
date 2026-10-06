import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import type { MatchupCard, Standing } from '@/lib/contributions/matchups'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import WebsiteHead from '@/components/layout/Head'
import type { MatchupResponse } from './api/contributions/matchup'
import type { StandingsResponse } from './api/contributions/matchup-standings'

const QUESTION = 'Which did more to advance the space industry?'
const ANON_VOTER_KEY = 'contribute-vote:voter'

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

function ContributionCard({
  card,
  side,
  disabled,
  state,
  onPick,
}: {
  card: MatchupCard
  side: 'left' | 'right'
  disabled: boolean
  state: 'idle' | 'won' | 'lost'
  onPick: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const long = card.description.length > 420

  const ring =
    state === 'won'
      ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]'
      : state === 'lost'
      ? 'border-white/5 opacity-40'
      : 'border-white/10 hover:border-blue-400/60'

  return (
    <div
      className={`flex flex-col bg-white/5 border rounded-2xl p-5 md:p-6 transition-all duration-200 min-w-0 ${ring}`}
    >
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {card.area && (
          <span className="px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-300 text-xs font-medium">
            {card.area}
          </span>
        )}
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

      <button
        type="button"
        onClick={onPick}
        disabled={disabled}
        className="mt-auto pt-5 w-full"
        aria-label={`Pick the ${side} contribution`}
      >
        <span className="block w-full px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors">
          {state === 'won' ? 'Picked ✓' : side === 'left' ? '← This one' : 'This one →'}
        </span>
      </button>
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
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-left text-sm min-w-[560px]">
        <thead>
          <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-white/10">
            <th className="py-2 px-1 font-medium">#</th>
            <th className="py-2 px-1 font-medium">Contribution</th>
            <th className="py-2 px-1 font-medium text-right">Matchups</th>
            <th className="py-2 px-1 font-medium text-right">Win rate</th>
            <th className="py-2 px-1 font-medium text-right">Projected share</th>
          </tr>
        </thead>
        <tbody>
          {data.standings.map((s: Standing, i) => (
            <tr key={s.card.id} className="border-b border-white/5 align-top">
              <td className="py-3 px-1 text-gray-500 tabular-nums">{i + 1}</td>
              <td className="py-3 px-1 max-w-[420px]">
                {s.card.area && (
                  <span className="text-blue-300 text-xs block mb-0.5">{s.card.area}</span>
                )}
                <span className="text-gray-300 line-clamp-2 break-words">{s.card.description}</span>
              </td>
              <td className="py-3 px-1 text-right text-gray-300 tabular-nums">{s.matchups}</td>
              <td className="py-3 px-1 text-right text-gray-300 tabular-nums">
                {s.winRate === null ? '—' : `${Math.round(s.winRate * 100)}%`}
              </td>
              <td className="py-3 px-1 text-right tabular-nums">
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
  const [picked, setPicked] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sessionPicks, setSessionPicks] = useState(0)
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
    setLoading(true)
    setError(null)
    setPicked(null)
    try {
      const res = await fetch(
        `/api/contributions/matchup?voter=${encodeURIComponent(voter)}`
      )
      const body = await res.json()
      if (!res.ok) throw new Error(body?.message || 'Could not load a matchup')
      setMatchup(body)
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
    !!matchup && matchup.storage && matchup.votesToday >= matchup.maxVotesPerDay

  const submit = useCallback(
    async (winnerId: string | null) => {
      if (!matchup?.cards || submitting || picked || !voter) return

      // Preview mode: nothing to save, just show the next pair.
      if (!matchup.matchupId) {
        if (winnerId) setPicked(winnerId)
        advanceTimer.current = setTimeout(loadMatchup, winnerId ? 450 : 0)
        return
      }

      setSubmitting(true)
      if (winnerId) setPicked(winnerId)
      try {
        const res = await fetch('/api/contributions/matchup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voter, matchupId: matchup.matchupId, winnerId }),
        })
        const body = await res.json()
        if (!res.ok) {
          setPicked(null)
          if (res.status === 429) {
            setMatchup({ ...matchup, votesToday: matchup.maxVotesPerDay })
            return
          }
          throw new Error(body?.message || 'Could not save your pick')
        }
        if (winnerId) {
          setSessionPicks((n) => n + 1)
          setMatchup((m) => (m ? { ...m, votesToday: body.votesToday } : m))
          loadStandings()
        }
        advanceTimer.current = setTimeout(loadMatchup, winnerId ? 450 : 0)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save your pick')
      } finally {
        setSubmitting(false)
      }
    },
    [matchup, submitting, picked, voter, loadMatchup, loadStandings]
  )

  // ← / → to pick, S to skip.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (!matchup?.cards || loading || atLimit) return
      if (e.key === 'ArrowLeft') submit(matchup.cards[0].id)
      else if (e.key === 'ArrowRight') submit(matchup.cards[1].id)
      else if (e.key.toLowerCase() === 's') submit(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [matchup, loading, atLimit, submit])

  const cards = matchup?.cards
  const busy = loading || submitting || !!picked

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
                contributions and pick the one that did more. Author names are hidden
                so the work is judged on its own.{' '}
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
                  <p className="text-gray-400 text-xs tabular-nums whitespace-nowrap">
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
                    That&apos;s {matchup?.maxVotesPerDay} picks today. Thank you!
                  </p>
                  <p className="text-gray-400 text-sm">
                    Come back tomorrow for more matchups. Standings update as picks come in.
                  </p>
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
                        <ContributionCard
                          key={cards[0].id}
                          card={cards[0]}
                          side="left"
                          disabled={busy}
                          state={!picked ? 'idle' : picked === cards[0].id ? 'won' : 'lost'}
                          onPick={() => submit(cards[0].id)}
                        />
                        <div className="flex md:flex-col items-center justify-center gap-3">
                          <span className="font-GoodTimes text-gray-500 text-sm">VS</span>
                        </div>
                        <ContributionCard
                          key={cards[1].id}
                          card={cards[1]}
                          side="right"
                          disabled={busy}
                          state={!picked ? 'idle' : picked === cards[1].id ? 'won' : 'lost'}
                          onPick={() => submit(cards[1].id)}
                        />
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
                <div className="flex flex-wrap items-center justify-center gap-4 -mt-2">
                  <button
                    type="button"
                    onClick={() => submit(null)}
                    disabled={busy}
                    className="px-5 py-2 rounded-xl border border-white/15 text-gray-300 hover:bg-white/5 text-sm disabled:opacity-50"
                  >
                    Skip this pair
                  </button>
                  <p className="text-gray-500 text-xs hidden md:block">
                    Keyboard: ← / → to pick, S to skip
                  </p>
                  {sessionPicks > 0 && (
                    <p className="text-gray-400 text-xs">
                      {sessionPicks} pick{sessionPicks === 1 ? '' : 's'} this visit
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  ['Pick one', 'Two contributions from the last 3 months. Choose the one that did more for the space industry.'],
                  ['Least-compared first', 'Contributions with the fewest matchups show up first, so every one gets enough votes.'],
                  ['Win more, earn more', 'Shares are win rate squared: winning twice as often earns about four times as much.'],
                  ['Bottom quarter cut', `Contributions need ${standings?.minMatchups ?? 5} matchups to be ranked; the bottom 25% earn nothing.`],
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
