import { getAccessToken, useLogin, usePrivy } from '@privy-io/react-auth'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useDePrizeRestricted } from '@/lib/deprize/deprizeRestrictedContext'
import { normalizeProbabilities } from '@/lib/deprize/serverMarket'
import { FORECAST_CROWD_MIN } from '@/lib/forecasts/constants'
import { forecastPanelShouldMount } from '@/lib/forecasts/visibility'
import {
  evenPercents,
  percentsDiverged,
  weightsToPercents,
} from '@/lib/forecasts/weights'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import NumberStepper from '@/components/layout/NumberStepper'
import { CARD } from '@/components/deprize/detail/primitives'

type CrowdResponse = {
  vector: number[]
  count: number
  p25: number[]
  p75: number[]
  staleSeconds?: number
}

type MineResponse = {
  weights: number[] | null
  vector: number[] | null
  updatedAt: string | null
  calls: number
  scoreState?: string
  reason?: string
  liveTipId?: number
  score?: { rawBrier?: number; skill?: number | null; daysScored?: number }
}

function pct(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return `${Math.round(n)}%`
}

function scoreCopy(state: string | undefined, liveTipId?: number): string | null {
  if (state === 'void') {
    return liveTipId
      ? `Forecasts on a superseded generation are void. Call it on the live prize.`
      : 'Forecasts on this generation are void.'
  }
  if (state === 'not-scorable') {
    return 'This prize refunded; there was no outcome to be right about.'
  }
  if (state === 'scored') return 'Your call has been scored against what happened.'
  if (state === 'awaiting-resolution-timestamp') {
    return 'This prize has reported — waiting on the resolution timestamp before scoring.'
  }
  if (state === 'awaiting-resolution') return 'Scored after this prize resolves.'
  return null
}

function Tick({ left, label, className }: { left: number; label: string; className: string }) {
  const clamped = Math.min(100, Math.max(0, left))
  return (
    <span
      className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-0.5 ${className}`}
      style={{ left: `${clamped}%` }}
      title={label}
    />
  )
}

export default function ForecastPanel(props: {
  chainSlug: string
  deprizeId: number
  labels: string[]
  marketPercents: number[]
  liveTipId?: number
  reported: boolean
}) {
  const { chainSlug, deprizeId, labels, marketPercents, liveTipId, reported } = props
  const restricted = useDePrizeRestricted()
  void forecastPanelShouldMount(restricted)
  const { login } = useLogin()
  const { authenticated, ready } = usePrivy()

  const n = labels.length
  const uniform = useMemo(() => evenPercents(n), [n])
  const [percents, setPercents] = useState<number[]>(uniform)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mine, setMine] = useState<MineResponse | null>(null)
  const [crowd, setCrowd] = useState<CrowdResponse | null>(null)

  useEffect(() => {
    setPercents(uniform)
  }, [uniform])

  const marketNormalized = useMemo(
    () => normalizeProbabilities(marketPercents),
    [marketPercents]
  )
  const isLive = liveTipId == null || liveTipId === deprizeId
  const inputsLocked = !isLive || reported
  const submitDisabled = inputsLocked || saving || n < 2
  const showEven = percentsDiverged(percents, n)

  const loadCrowd = useCallback(async () => {
    const token = authenticated ? await getAccessToken().catch(() => null) : null
    const qs = new URLSearchParams({
      chain: chainSlug,
      deprizeId: String(deprizeId),
    })
    if (authenticated) qs.set('excludeMe', '1')
    const res = await fetch(`/api/forecasts/crowd?${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    if (!res.ok) return
    setCrowd(await res.json())
  }, [authenticated, chainSlug, deprizeId])

  const loadMine = useCallback(async () => {
    if (!authenticated) {
      setMine(null)
      return
    }
    const token = await getAccessToken().catch(() => null)
    if (!token) return
    const qs = new URLSearchParams({
      chain: chainSlug,
      deprizeId: String(deprizeId),
    })
    const res = await fetch(`/api/forecasts/mine?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const body = (await res.json()) as MineResponse
    setMine(body)
    if (body.weights?.length === n) setPercents(weightsToPercents(body.weights))
  }, [authenticated, chainSlug, deprizeId, n])

  useEffect(() => {
    void loadCrowd()
    void loadMine()
  }, [loadCrowd, loadMine])

  async function save() {
    setError(null)
    if (!ready) return
    if (!authenticated) {
      login()
      return
    }
    if (submitDisabled) return
    setSaving(true)
    try {
      const token = await getAccessToken().catch(() => null)
      if (!token) {
        login()
        return
      }
      const res = await fetch('/api/forecasts/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ chainSlug, deprizeId, weights: percents }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.status === 429) {
        setError(`Wait ${body.retryAfterSec ?? 30}s before editing again.`)
        return
      }
      if (!res.ok) {
        setError(body.error || 'Could not save your prediction.')
        return
      }
      await Promise.all([loadMine(), loadCrowd()])
      const callers = Number(body.calls ?? crowd?.count ?? 0) || 1
      const when = body.updatedAt
        ? new Date(body.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        : 'just now'
      toast.success(`Saved · you're 1 of ${callers} callers · ${when}`, {
        style: toastStyle,
      })
    } finally {
      setSaving(false)
    }
  }

  const crowdReady = (crowd?.count ?? 0) >= FORECAST_CROWD_MIN
  const stateLine = scoreCopy(mine?.scoreState, mine?.liveTipId ?? liveTipId)

  return (
    <section id="deprize-forecast" className={CARD}>
      <h2 className="text-white text-base font-semibold">Predict the winner — free</h2>
      <p className="mt-1 text-sm text-gray-300">
        Set a percentage for each competitor. You&apos;re scored against what actually happens and
        ranked on the leaderboard. No wallet, no money, and your prediction doesn&apos;t move the
        market.
      </p>
      {restricted && (
        <p className="mt-2 text-sm text-amber-200">
          Betting isn&apos;t available in your region — you can still make a prediction.
        </p>
      )}

      {!isLive && (
        <p className="mt-3 text-sm text-amber-200">
          Forecasts are on the live generation.{' '}
          <a href={`/deprize/${liveTipId}`} className="text-indigo-300 underline">
            Go to DePrize #{liveTipId}
          </a>
        </p>
      )}
      {reported && (
        <p className="mt-3 text-sm text-amber-200">
          This prize has reported — forecasting is closed.
        </p>
      )}
      {stateLine && <p className="mt-3 text-sm text-gray-300">{stateLine}</p>}

      <div className="mt-4 flex flex-col gap-4" aria-live="polite">
        {labels.map((label, i) => (
          <div key={`${label}-${i}`} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-white">{label}</span>
              <NumberStepper
                id={`deprize-forecast-weight-${i}`}
                ariaLabel={`${label} percent`}
                number={percents[i] ?? 0}
                setNumber={(value) =>
                  setPercents((prev) => {
                    const next = prev.slice()
                    next[i] = value
                    return next
                  })
                }
                min={0}
                max={100}
                step={1}
                suffix="%"
                isDisabled={inputsLocked}
              />
            </div>
            <div className="relative h-3 rounded-full bg-white/5 border border-white/10">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-indigo-400/70"
                style={{ width: `${Math.min(100, Math.max(0, percents[i] ?? 0))}%` }}
              />
              <Tick
                left={marketNormalized[i] ?? 0}
                label={`Market ${pct(marketNormalized[i] ?? 0)}`}
                className="bg-white"
              />
              {crowdReady && crowd && (
                <Tick
                  left={(crowd.vector[i] ?? 0) * 100}
                  label={`Crowd ${pct((crowd.vector[i] ?? 0) * 100)}`}
                  className="bg-amber-300"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
        <li className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-full bg-indigo-400/70" />
          You
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-white" />
          Market
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-amber-300" />
          Crowd
          {crowdReady && crowd ? ` (${crowd.count})` : ''}
        </li>
      </ul>
      {!crowdReady && (
        <p className="mt-1 text-xs text-gray-400">
          Crowd shows once 5 people have predicted ({crowd?.count ?? 0} so far).
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {showEven && (
          <button
            type="button"
            onClick={() => setPercents(uniform)}
            className="px-3 py-1.5 rounded-full text-sm border border-white/20 bg-transparent text-gray-200 hover:bg-white/5"
          >
            Even it out
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={authenticated ? submitDisabled : !ready}
          className="px-4 py-1.5 rounded-full text-sm border border-white/20 bg-white/10 text-white hover:bg-white/15 disabled:opacity-40"
        >
          {saving ? 'Saving…' : authenticated ? 'Save prediction' : 'Log in to predict'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-amber-200">{error}</p>}
    </section>
  )
}
