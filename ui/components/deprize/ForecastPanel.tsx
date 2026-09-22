import { useLogin } from '@privy-io/react-auth'
import ForecastsTableABI from 'const/abis/Forecasts.json'
import { FORECASTS_TABLE_ADDRESSES, FORECASTS_TABLE_NAMES } from 'const/config'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useActiveAccount } from 'thirdweb/react'
import { useCitizen } from '@/lib/citizen/useCitizen'
import { isCompetitorClaimed } from '@/lib/deprize/competitions'
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
import { SEED_ATLAS, orgById, projectById } from '@/lib/lunar-atlas'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { sepolia } from '@/lib/rpc/chains'
import { v4SlugToV5Chain } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useTotalVMOONEY } from '@/lib/tokens/hooks/useTotalVMOONEY'
import DePrizeTeamCard from '@/components/deprize/DePrizeTeamCard'
import { CARD, TOUCH } from '@/components/deprize/detail/primitives'

function pct(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return `${Math.round(n)}%`
}

/** One outcome carries the whole call. A prediction is a single pick, not a spread. */
function allocationForPick(picked: number | null, n: number): number[] {
  const out = Array.from({ length: n }, () => 0)
  if (picked == null || picked < 0 || picked >= n) return out
  out[picked] = 100
  return out
}

function pickFromAllocation(allocation: number[]): number | null {
  let best = -1
  for (let i = 0; i < allocation.length; i++) {
    if ((allocation[i] ?? 0) > (allocation[best] ?? 0)) best = i
  }
  return best >= 0 && (allocation[best] ?? 0) > 0 ? best : null
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
  numOutcomes: number
  rankedOutcomes: Array<{ index: number; [key: string]: any }>
  teamIds: readonly bigint[]
  raceBinding: ReturnType<typeof import('@/lib/deprize/competitions').getDePrizeRaceBinding>
  teamContract: any
  outcomeColors: string[]
  marketLoading: boolean
  showResolved: boolean
  isRefundVector: boolean
  winningIndex: number
  bettingOpen: boolean
  tradingHalted: boolean
  userAddress?: string
  withdrawnByTeamId: Record<string, boolean>
  onBet: (index: number) => void
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
    numOutcomes,
    rankedOutcomes,
    teamIds,
    raceBinding,
    teamContract,
    outcomeColors,
    marketLoading,
    showResolved,
    isRefundVector,
    winningIndex,
    bettingOpen,
    tradingHalted,
    userAddress,
    withdrawnByTeamId,
    onBet,
  } = props
  const restricted = useDePrizeRestricted()
  void forecastPanelShouldMount(restricted)
  const { login } = useLogin()
  const account = useActiveAccount()
  const chain = v4SlugToV5Chain(chainSlug) ?? sepolia
  const citizen = useCitizen(chain)
  const { totalVMOONEY } = useTotalVMOONEY(account?.address)

  const n = labels.length
  const [picked, setPicked] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consensus, setConsensus] = useState<ForecastConsensus | null>(null)

  const percents = useMemo(() => allocationForPick(picked, n), [picked, n])
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
      setPicked(pickFromAllocation(mine.allocation))
    }
  }, [account?.address, chainSlug, deprizeId, n])

  useEffect(() => {
    void loadConsensus()
  }, [loadConsensus])

  function pickOutcome(index: number) {
    if (inputsLocked) return
    setPicked((prev) => (prev === index ? null : index))
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

  if (numOutcomes <= 0) return null

  return (
    <section id="deprize-forecast" className={CARD}>
      <h2 className="title-text-colors text-lg font-GoodTimes">Competitors</h2>
      <p className="mt-1 text-sm text-gray-300">
        Back one with ETH where betting is allowed. Citizens can also call a single outcome with a
        prediction weighted by √vMOONEY.
      </p>
      {restricted && (
        <p className="mt-2 text-sm text-amber-200">
          Betting isn&apos;t available in your region — you can still make a prediction.
        </p>
      )}

      {!isLive && (
        <p className="mt-3 text-sm text-amber-200">
          Forecasts are on the live generation.{' '}
          <Link href={`/deprize/${liveTipId}`} className="text-indigo-300 underline">
            Go to DePrize #{liveTipId}
          </Link>
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
          <Link href="/join" className="text-indigo-300 underline">
            Mint a Citizen
          </Link>
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

      <div className="mt-4 flex flex-col gap-3" aria-live="polite">
        {rankedOutcomes.map((o) => {
          const teamId = teamIds[o.index] ?? 0n
          const outcomeBinding = raceBinding?.outcomes[o.index]
          const isField = !!outcomeBinding?.field
          const atlasProject =
            !isField && outcomeBinding?.projectId
              ? projectById(SEED_ATLAS, outcomeBinding.projectId)
              : undefined
          const atlasOrg = atlasProject ? orgById(SEED_ATLAS, atlasProject.orgId) : undefined
          const claimed = isCompetitorClaimed(outcomeBinding)
          const isPicked = picked === o.index
          const marketPct = marketNormalized[o.index] ?? 0
          const daoPct = daoReady ? (daoVector[o.index] ?? 0) * 100 : null
          const pooledPct = pooled ? pooled[o.index] * 100 : null
          const lo = daoPct == null ? marketPct : Math.min(marketPct, daoPct)
          const hi = daoPct == null ? marketPct : Math.max(marketPct, daoPct)
          return (
            <div id={`deprize-outcome-${o.index}`} key={o.index}>
              <DePrizeTeamCard
                outcome={o as any}
                teamId={teamId}
                teamContract={teamContract}
                color={outcomeColors[o.index]}
                loading={marketLoading}
                resolved={showResolved}
                isRefundVector={isRefundVector}
                isWinningSlot={showResolved && o.index === winningIndex}
                bettingOpen={bettingOpen}
                tradingHalted={tradingHalted}
                busy={false}
                userConnected={!!userAddress}
                onBet={onBet}
                isField={isField}
                withdrawn={!!withdrawnByTeamId[teamId.toString()]}
                hrefOverride={
                  outcomeBinding?.projectId ? `/moonbase/${outcomeBinding.projectId}` : undefined
                }
                nameOverride={atlasOrg?.name || atlasProject?.name}
                vehicleLabel={outcomeBinding?.vehicleLabel}
                backLabel={
                  isField
                    ? 'Back the field'
                    : atlasOrg?.name || atlasProject?.name
                    ? `Back ${atlasOrg?.name || atlasProject?.name}`
                    : undefined
                }
                imageOverride={claimed ? atlasOrg?.logoURI : undefined}
                unclaimed={!isField && !!outcomeBinding && !claimed}
                participation={
                  isField || !outcomeBinding ? undefined : claimed ? 'official' : 'unofficial'
                }
              />
              <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => pickOutcome(o.index)}
                    disabled={inputsLocked}
                    aria-pressed={isPicked}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide border transition-colors disabled:opacity-40 ${TOUCH} ${
                      isPicked
                        ? 'border-indigo-400/60 bg-indigo-400/15 text-white'
                        : 'border-white/15 bg-white/[0.04] text-gray-200 hover:bg-white/10'
                    }`}
                  >
                    {isPicked ? 'Your call' : 'Predict this'}
                  </button>
                  <p className="text-xs text-gray-400">
                    {daoPct != null ? `DAO ${pct(daoPct)}` : 'DAO —'}
                    {pooledPct != null ? ` · Pooled ${pct(pooledPct)}` : ''}
                  </p>
                </div>
                <div className="mt-2 relative h-4 rounded-full bg-white/5 border border-white/10">
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
              </div>
            </div>
          )
        })}
      </div>

      {!daoReady && (
        <p className="mt-3 text-xs text-gray-400">
          DAO shows once {FORECAST_DAO_MIN_PARTICIPANTS} Citizens have called it (
          {consensus?.participants ?? 0} so far).
        </p>
      )}
      {picked != null && (
        <p className="mt-2 text-xs text-gray-400">
          Calling one outcome says the rest will not win, which costs a full point under Brier if
          one of them does.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={account ? submitDisabled || !canWrite : false}
          className={`w-full sm:w-auto px-4 py-1.5 rounded-full text-sm border border-white/20 bg-white/10 text-white hover:bg-white/15 disabled:opacity-40 ${TOUCH}`}
        >
          {saving ? 'Saving…' : account ? 'Save prediction' : 'Connect to predict'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-amber-200">{error}</p>}
    </section>
  )
}
