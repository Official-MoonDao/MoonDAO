import { getAccessToken, useLogin, usePrivy } from '@privy-io/react-auth'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDePrizeRestricted } from '@/lib/deprize/deprizeRestrictedContext'
import { normalizeProbabilities } from '@/lib/deprize/serverMarket'
import { FORECAST_CROWD_MIN, FORECAST_WEIGHT_MAX } from '@/lib/forecasts/constants'
import { forecastPanelShouldMount } from '@/lib/forecasts/visibility'
import { normalizeWeights } from '@/lib/forecasts/weights'
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
  return `${Math.round(n * 10) / 10}%`
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

function Mark({
  left,
  symbol,
  label,
}: {
  left: number
  symbol: string
  label: string
}) {
  const clamped = Math.min(100, Math.max(0, left))
  return (
    <span
      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-sm leading-none"
      style={{ left: `${clamped}%` }}
      title={label}
    >
      {symbol}
    </span>
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
  const uniform = useMemo(() => (n > 0 ? Array.from({ length: n }, () => 1) : []), [n])
  const [weights, setWeights] = useState<number[]>(uniform)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mine, setMine] = useState<MineResponse | null>(null)
  const [crowd, setCrowd] = useState<CrowdResponse | null>(null)

  useEffect(() => {
    setWeights(uniform)
  }, [uniform])

  const normalized = useMemo(() => {
    if (!weights.length || !weights.some((w) => w > 0)) {
      return weights.map(() => 0)
    }
    return normalizeWeights(weights)
  }, [weights])

  const marketNormalized = useMemo(
    () => normalizeProbabilities(marketPercents),
    [marketPercents]
  )
  const marketRawSum = marketPercents
    .filter((p) => Number.isFinite(p) && p > 0)
    .reduce((a, b) => a + b, 0)
  const baselinePct = n > 0 ? 100 / n : 0
  const isLive = liveTipId == null || liveTipId === deprizeId
  const submitDisabled = !isLive || reported || saving || n < 2

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
    if (body.weights?.length === n) setWeights(body.weights)
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
        body: JSON.stringify({ chainSlug, deprizeId, weights }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.status === 429) {
        setError(`Wait ${body.retryAfterSec ?? 30}s before editing again.`)
        return
      }
      if (!res.ok) {
        setError(body.error || 'Could not save your call.')
        return
      }
      await Promise.all([loadMine(), loadCrowd()])
    } finally {
      setSaving(false)
    }
  }

  const crowdReady = (crowd?.count ?? 0) >= FORECAST_CROWD_MIN
  const stateLine = scoreCopy(mine?.scoreState, mine?.liveTipId ?? liveTipId)

  return (
    <section id="deprize-forecast" className={CARD}>
      <h2 className="text-white text-base font-semibold">Call it — free.</h2>
      <p className="mt-1 text-sm text-gray-300">
        Set your odds for who lands next. You&apos;re scored against what actually happens and
        ranked on the leaderboard. No wallet, no money, and your call doesn&apos;t move the
        market.
      </p>
      {restricted && (
        <p className="mt-2 text-sm text-amber-200">
          Betting isn&apos;t available in your region — you can still make a call.
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

      <div className="mt-4 flex flex-col gap-3" aria-live="polite">
        {labels.map((label, i) => (
          <div key={`${label}-${i}`} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-white">{label}</span>
              <NumberStepper
                id={`deprize-forecast-weight-${i}`}
                ariaLabel={`${label} weight`}
                number={weights[i] ?? 0}
                setNumber={(value) =>
                  setWeights((prev) => {
                    const next = prev.slice()
                    next[i] = value
                    return next
                  })
                }
                min={0}
                max={FORECAST_WEIGHT_MAX}
                step={1}
                suffix=""
                isDisabled={submitDisabled && authenticated}
              />
            </div>
            <p className="text-xs text-gray-400">your call: {pct(normalized[i] * 100)}</p>
            <div className="relative h-6 rounded-md bg-white/5 border border-white/10">
              <span
                className="absolute top-0 bottom-0 w-px bg-white/40"
                style={{ left: `${baselinePct}%` }}
                title={`1/${n} = ${pct(baselinePct)} — no-information baseline`}
              />
              {crowdReady && crowd && (
                <span
                  className="absolute top-1/2 -translate-y-1/2 h-2 bg-white/20 rounded-sm"
                  style={{
                    left: `${(crowd.p25[i] ?? 0) * 100}%`,
                    width: `${Math.max(0, ((crowd.p75[i] ?? 0) - (crowd.p25[i] ?? 0)) * 100)}%`,
                  }}
                />
              )}
              <Mark
                left={marketNormalized[i] ?? 0}
                symbol="◇"
                label={`market, normalised ${pct(marketNormalized[i] ?? 0)}`}
              />
              {crowdReady && crowd && (
                <Mark
                  left={(crowd.vector[i] ?? 0) * 100}
                  symbol="△"
                  label={`crowd ${pct((crowd.vector[i] ?? 0) * 100)}`}
                />
              )}
              <Mark
                left={normalized[i] * 100}
                symbol="●"
                label={`you ${pct(normalized[i] * 100)}`}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-gray-400">
        ● you · ◇ market, normalised · △ crowd
        {crowdReady && crowd ? ` (n=${crowd.count}, bar = middle 50%)` : ''}
        . 1/{n || 'N'} = {pct(baselinePct)} — no-information baseline.
        {marketRawSum > 0 && (
          <> Market prices sum to {pct(marketRawSum)}.</>
        )}
      </p>
      {!crowdReady && (
        <p className="mt-1 text-xs text-gray-400">
          Crowd shows once 5 people have called it ({crowd?.count ?? 0} so far).
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setWeights(uniform)}
          className="px-3 py-1.5 rounded-full text-sm border border-white/20 bg-transparent text-gray-200 hover:bg-white/5"
        >
          Even it out
        </button>
        <button
          type="button"
          onClick={save}
          disabled={authenticated ? submitDisabled : !ready}
          className="px-4 py-1.5 rounded-full text-sm border border-white/20 bg-white/10 text-white hover:bg-white/15 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save my call.'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-amber-200">{error}</p>}
    </section>
  )
}
