import { useLogin } from '@privy-io/react-auth'
import ForecastsTableABI from 'const/abis/Forecasts.json'
import { FORECASTS_TABLE_ADDRESSES, FORECASTS_TABLE_NAMES } from 'const/config'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useActiveAccount } from 'thirdweb/react'
import { useCitizen } from '@/lib/citizen/useCitizen'
import { useDePrizeRestricted } from '@/lib/deprize/deprizeRestrictedContext'
import {
  deprizeForecastVoteId,
  encodeForecastVote,
  isValidAllocation,
} from '@/lib/deprize/forecastVote'
import { normalizeProbabilities } from '@/lib/deprize/serverMarket'
import { writeForecastVote } from '@/lib/deprize/writeForecastVote'
import type { ForecastConsensus } from '@/lib/forecasts/consensusTypes'
import { FORECAST_DAO_MIN_PARTICIPANTS } from '@/lib/forecasts/constants'
import { daoEvidence, logLinearPool, marketEvidence } from '@/lib/forecasts/pool'
import { forecastPanelShouldMount } from '@/lib/forecasts/visibility'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { sepolia } from '@/lib/rpc/chains'
import { v4SlugToV5Chain } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useTotalVMOONEY } from '@/lib/tokens/hooks/useTotalVMOONEY'
import { CARD } from '@/components/deprize/detail/primitives'

function pct(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return `${Math.round(n)}%`
}

function allocationFromSelected(selected: number[], n: number): number[] {
  const out = Array.from({ length: n }, () => 0)
  if (selected.length === 0) return out
  const ordered = [...selected].sort((a, b) => a - b)
  const base = Math.floor(100 / ordered.length)
  for (const idx of ordered) out[idx] = base
  out[ordered[ordered.length - 1]] += 100 - base * ordered.length
  return out
}

function selectedFromAllocation(allocation: number[]): number[] {
  return allocation.map((value, i) => (value > 0 ? i : -1)).filter((i) => i >= 0)
}

export default function ForecastPanel(props: {
  chainSlug: string
  deprizeId: number
  labels: string[]
  marketPercents: number[]
  liveTipId?: number
  reported: boolean
  resolvedVector?: number[] | null
  collateralEth?: number
  liveMarket?: boolean
}) {
  const {
    chainSlug,
    deprizeId,
    labels,
    marketPercents,
    liveTipId,
    reported,
    collateralEth = 0,
    liveMarket = false,
  } = props
  const restricted = useDePrizeRestricted()
  void forecastPanelShouldMount(restricted)
  const { login } = useLogin()
  const account = useActiveAccount()
  const chain = v4SlugToV5Chain(chainSlug) ?? sepolia
  const citizen = useCitizen(chain)
  const { totalVMOONEY } = useTotalVMOONEY(account?.address)

  const n = labels.length
  const [selected, setSelected] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consensus, setConsensus] = useState<ForecastConsensus | null>(null)

  const percents = useMemo(() => allocationFromSelected(selected, n), [selected, n])
  const forecastsContract = useContract({
    address: FORECASTS_TABLE_ADDRESSES[chainSlug] ?? '',
    chain,
    abi: ForecastsTableABI.abi as any,
  })
  const forecastsTableName = FORECASTS_TABLE_NAMES[chainSlug] ?? ''

  const marketNormalized = useMemo(() => normalizeProbabilities(marketPercents), [marketPercents])
  const isLive = liveTipId == null || liveTipId === deprizeId
  const inputsLocked = !isLive || reported
  const canWrite = Boolean(account && citizen && forecastsContract && forecastsTableName)
  const submitDisabled = inputsLocked || saving || n < 2 || !isValidAllocation(percents)

  const loadConsensus = useCallback(async () => {
    const qs = new URLSearchParams({
      chain: chainSlug,
      deprizeId: String(deprizeId),
      outcomes: String(n),
    })
    const res = await fetch(`/api/forecasts/consensus?${qs}`)
    if (!res.ok) return
    const body = (await res.json()) as ForecastConsensus
    setConsensus(body)
    const mine = account?.address
      ? body.leaderboard.find((row) => row.voterAddress === account.address.toLowerCase())
      : undefined
    if (mine?.allocation?.length === n) {
      setSelected(selectedFromAllocation(mine.allocation))
    }
  }, [account?.address, chainSlug, deprizeId, n])

  useEffect(() => {
    void loadConsensus()
  }, [loadConsensus])

  function toggleOutcome(index: number) {
    if (inputsLocked) return
    setSelected((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    )
  }

  async function save() {
    setError(null)
    if (!account) {
      login()
      return
    }
    if (!citizen) {
      setError('Predictions count only for Citizens. Mint a Citizen to call it.')
      return
    }
    if (submitDisabled) return
    setSaving(true)
    try {
      const vote = encodeForecastVote(percents, totalVMOONEY || 0)
      await writeForecastVote({
        forecastsContract,
        account,
        forecastsTableName,
        voteId: deprizeForecastVoteId(deprizeId),
        address: account.address,
        vote,
      })
      setConsensus((prev) => {
        if (!prev) return prev
        const row = {
          voterAddress: account.address.toLowerCase(),
          citizenId: citizen.id ?? '',
          citizenName: (citizen.metadata?.name as string) || account.address,
          citizenImage: citizen.metadata?.image,
          allocation: percents,
          weight: 0,
          storedVmooney: totalVMOONEY || 0,
          liveVmooney: totalVMOONEY || 0,
          updatedAt: Math.floor(Date.now() / 1000),
          brier: null,
          skill: null,
        }
        const others = prev.leaderboard.filter((entry) => entry.voterAddress !== row.voterAddress)
        return { ...prev, leaderboard: [row, ...others] }
      })
      toast.success('Prediction saved', { style: toastStyle })
      void loadConsensus()
    } catch (err: any) {
      setError(err?.shortMessage || err?.message || 'Could not save your prediction.')
    } finally {
      setSaving(false)
    }
  }

  const daoReady = (consensus?.participants ?? 0) >= FORECAST_DAO_MIN_PARTICIPANTS
  const daoVector = daoReady ? consensus?.vector ?? [] : []
  const mEvidence = marketEvidence(collateralEth, liveMarket)
  const dEvidence = daoEvidence(consensus?.totalWeight ?? 0)
  const pooled =
    mEvidence + dEvidence > 0
      ? logLinearPool([
          {
            p: marketNormalized.map((p) => p / 100),
            weight: mEvidence,
          },
          {
            p: daoVector.length === n ? daoVector : marketNormalized.map((p) => p / 100),
            weight: dEvidence,
          },
        ])
      : null

  const divergence = labels.reduce((max, _, i) => {
    const market = marketNormalized[i] ?? 0
    const dao = (daoVector[i] ?? 0) * 100
    return Math.max(max, Math.abs(market - dao))
  }, 0)

  const mine = consensus?.leaderboard.find(
    (row) => row.voterAddress === account?.address?.toLowerCase()
  )

  return (
    <section id="deprize-forecast" className={CARD}>
      <h2 className="text-white text-base font-semibold">Back an outcome</h2>
      <p className="mt-1 text-sm text-gray-300">
        Tap one or more competitors. Citizens write a vote weighted by √vMOONEY; where betting is
        allowed, the same allocation is what you stake in ETH.
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
      {account && !citizen && (
        <p className="mt-3 text-sm text-amber-200">
          Predictions count for Citizens.{' '}
          <a href="/join" className="text-indigo-300 underline">
            Mint a Citizen
          </a>
        </p>
      )}
      {daoReady && divergence >= 10 && (
        <p className="mt-3 text-sm text-gray-300">
          Market and DAO diverge by {pct(divergence)} on the widest outcome.
        </p>
      )}
      {mine?.skill != null && (
        <p className="mt-3 text-sm text-gray-300">Your skill score is {mine.skill.toFixed(2)}.</p>
      )}

      <div className="mt-4 flex flex-col gap-4" aria-live="polite">
        {labels.map((label, i) => {
          const minePct = percents[i] ?? 0
          const marketPct = marketNormalized[i] ?? 0
          const daoPct = daoReady ? (daoVector[i] ?? 0) * 100 : null
          const pooledPct = pooled ? pooled[i] * 100 : null
          const backed = minePct > 0
          const lo = daoPct == null ? marketPct : Math.min(marketPct, daoPct)
          const hi = daoPct == null ? marketPct : Math.max(marketPct, daoPct)
          return (
            <button
              key={`${label}-${i}`}
              type="button"
              onClick={() => toggleOutcome(i)}
              disabled={inputsLocked}
              className={`flex flex-col gap-1.5 text-left rounded-xl border px-3 py-2 ${
                backed ? 'border-indigo-400/60 bg-indigo-400/10' : 'border-white/10 bg-transparent'
              } disabled:opacity-60`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-white">{label}</span>
                <span className="text-sm text-gray-200">{backed ? pct(minePct) : 'Back'}</span>
              </div>
              <div className="relative h-4 rounded-full bg-white/5 border border-white/10">
                <span
                  className="absolute inset-y-0 rounded-full bg-white/15"
                  style={{ left: `${lo}%`, width: `${Math.max(1, hi - lo)}%` }}
                />
                {pooledPct != null && (
                  <span
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-1 rounded-full bg-indigo-300"
                    style={{ left: `${pooledPct}%` }}
                  />
                )}
              </div>
              <p className="text-xs text-gray-400">
                Market {pct(marketPct)}
                {daoPct != null ? ` · DAO ${pct(daoPct)}` : ''}
                {pooledPct != null ? ` · Pooled ${pct(pooledPct)}` : ''}
              </p>
            </button>
          )
        })}
      </div>

      {!daoReady && (
        <p className="mt-2 text-xs text-gray-400">
          DAO shows once {FORECAST_DAO_MIN_PARTICIPANTS} Citizens have called it (
          {consensus?.participants ?? 0} so far).
        </p>
      )}
      {selected.length === n && n > 1 && (
        <p className="mt-2 text-xs text-amber-200">
          Backing every outcome in the ETH market is a guaranteed loss net of fees.
        </p>
      )}
      {selected.length === 1 && (
        <p className="mt-2 text-xs text-gray-400">
          Unbacked outcomes are a probability-zero claim if one of them wins.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={account ? submitDisabled || !canWrite : false}
          className="px-4 py-1.5 rounded-full text-sm border border-white/20 bg-white/10 text-white hover:bg-white/15 disabled:opacity-40"
        >
          {saving ? 'Saving…' : account ? 'Save prediction' : 'Connect to predict'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-amber-200">{error}</p>}
    </section>
  )
}
