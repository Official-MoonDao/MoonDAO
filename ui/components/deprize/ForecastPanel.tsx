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
import { deprizeForecastVoteId, encodeForecastVote } from '@/lib/deprize/forecastVote'
import { normalizeProbabilities } from '@/lib/deprize/serverMarket'
import { clearForecastVote, writeForecastVote } from '@/lib/deprize/writeForecastVote'
import { consensusQuery } from '@/lib/forecasts/consensusQuery'
import type { ForecastConsensus } from '@/lib/forecasts/consensusTypes'
import { FORECAST_DAO_MIN_PARTICIPANTS } from '@/lib/forecasts/constants'
import { FORECAST_COPY } from '@/lib/forecasts/forecastCopy'
import {
  allocationForPick,
  canUndo,
  pickFromAllocation,
  pickLabel,
  tapPlan,
  undoPlan,
} from '@/lib/forecasts/forecastPick'
import { oddsRowView } from '@/lib/forecasts/oddsRow'
import { daoEvidence, logLinearPool, marketEvidence } from '@/lib/forecasts/pool'
import { rowActions } from '@/lib/forecasts/rowActions'
import { forecastPanelShouldMount } from '@/lib/forecasts/visibility'
import { SEED_ATLAS, orgById, projectById } from '@/lib/lunar-atlas'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { sepolia } from '@/lib/rpc/chains'
import { v4SlugToV5Chain } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useTotalVMOONEY } from '@/lib/tokens/hooks/useTotalVMOONEY'
import DePrizeTeamCard from '@/components/deprize/DePrizeTeamCard'
import { CARD, TOUCH } from '@/components/deprize/detail/primitives'

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
  const [savedPick, setSavedPick] = useState<number | null>(null)
  const [previousPick, setPreviousPick] = useState<number | null>(null)
  const [writing, setWriting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consensus, setConsensus] = useState<ForecastConsensus | null>(null)

  const forecastsContract = useContract({
    address: FORECASTS_TABLE_ADDRESSES[chainSlug] ?? '',
    chain,
    abi: ForecastsTableABI.abi as any,
  })
  const forecastsTableName = FORECASTS_TABLE_NAMES[chainSlug] ?? ''

  const marketNormalized = useMemo(() => normalizeProbabilities(marketPercents), [marketPercents])
  const isLive = liveTipId == null || liveTipId === deprizeId
  const inputsLocked = !isLive || reported
  const actions = rowActions({
    restricted,
    bettingOpen,
    locked: inputsLocked,
    isCitizen: !!citizen,
    connected: !!account,
  })
  const predictAction = actions.find((action) => action.kind === 'predict')

  const applyConsensus = useCallback(
    (body: ForecastConsensus) => {
      setConsensus(body)
      const mine = account?.address
        ? body.leaderboard.find((row) => row.voterAddress === account.address.toLowerCase())
        : undefined
      if (mine?.allocation?.length === n) {
        setSavedPick(pickFromAllocation(mine.allocation))
      }
    },
    [account?.address, n]
  )

  const loadConsensus = useCallback(async () => {
    const res = await fetch(
      consensusQuery({
        chain: chainSlug,
        deprizeId,
        outcomes: n,
      })
    )
    if (!res.ok) return
    applyConsensus((await res.json()) as ForecastConsensus)
  }, [applyConsensus, chainSlug, deprizeId, n])

  const refetchFresh = useCallback(async () => {
    const res = await fetch(
      consensusQuery({
        chain: chainSlug,
        deprizeId,
        outcomes: n,
        fresh: true,
      })
    )
    if (!res.ok) return
    applyConsensus((await res.json()) as ForecastConsensus)
  }, [applyConsensus, chainSlug, deprizeId, n])

  useEffect(() => {
    void loadConsensus()
  }, [loadConsensus])

  function rememberRow(allocation: number[]) {
    if (!account) return
    setConsensus((prev) => {
      if (!prev) return prev
      const row = {
        voterAddress: account.address.toLowerCase(),
        citizenId: citizen?.id ?? '',
        citizenName: (citizen?.metadata?.name as string) || account.address,
        citizenImage: citizen?.metadata?.image,
        allocation,
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
  }

  async function commitPick(index: number) {
    if (!account || !citizen || !forecastsContract || !forecastsTableName) return
    setError(null)
    setWriting(true)
    const allocation = allocationForPick(index, n)
    try {
      const vote = encodeForecastVote(allocation, totalVMOONEY || 0)
      await writeForecastVote({
        forecastsContract,
        account,
        forecastsTableName,
        voteId: deprizeForecastVoteId(deprizeId),
        address: account.address,
        vote,
      })
      setPreviousPick(savedPick)
      setSavedPick(index)
      rememberRow(allocation)
      toast.success('Prediction saved', { style: toastStyle })
      await refetchFresh()
    } catch (err: any) {
      setError(err?.shortMessage || err?.message || 'Could not save your prediction.')
    } finally {
      setWriting(false)
    }
  }

  async function clearPick() {
    if (!account || !forecastsContract) return
    setError(null)
    setWriting(true)
    try {
      await clearForecastVote({
        forecastsContract,
        account,
        voteId: deprizeForecastVoteId(deprizeId),
      })
      setSavedPick(null)
      setPreviousPick(null)
      toast.success('Prediction removed', { style: toastStyle })
      await refetchFresh()
    } catch (err: any) {
      setError(err?.shortMessage || err?.message || 'Could not remove your prediction.')
    } finally {
      setWriting(false)
    }
  }

  function onPredict(index: number) {
    const plan = tapPlan({
      index,
      savedPick,
      writing,
      connected: !!account,
      isCitizen: !!citizen,
      locked: inputsLocked,
    })
    if (plan.action === 'connect') {
      login()
      return
    }
    if (plan.action === 'need-citizen') {
      setError('Predictions count only for Citizens. Mint a Citizen to predict.')
      return
    }
    if (plan.action === 'write') void commitPick(plan.index)
  }

  function onUndo() {
    const plan = undoPlan({
      savedPick,
      previousPick,
      writing,
      locked: inputsLocked,
    })
    if (plan.action === 'write') void commitPick(plan.index)
    if (plan.action === 'clear') void clearPick()
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

  const mine = consensus?.leaderboard.find(
    (row) => row.voterAddress === account?.address?.toLowerCase()
  )
  const showBet = actions.some((action) => action.kind === 'bet')
  const undoEnabled = canUndo({ savedPick, writing, locked: inputsLocked })

  if (numOutcomes <= 0) return null

  return (
    <section id="deprize-forecast" className={CARD}>
      <h2 className="title-text-colors text-lg font-GoodTimes">Competitors</h2>
      <p className="mt-1 text-sm text-gray-300">{FORECAST_COPY.panelIntro}</p>
      {bettingOpen && showBet && !showResolved && (
        <p className="mt-1 text-sm text-gray-400">
          Click a competitor to predict them as the winner.
        </p>
      )}
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
          const isSaved = savedPick === o.index
          const marketPct = marketNormalized[o.index] ?? 0
          const daoPct = daoReady ? (daoVector[o.index] ?? 0) * 100 : null
          const pooledPct = pooled ? pooled[o.index] * 100 : null
          const view = oddsRowView({ marketPct, daoPct, pooledPct })
          const predictReason =
            predictAction?.reason === 'locked'
              ? 'Forecasting is closed'
              : predictAction?.reason === 'need-citizen'
              ? 'Mint a Citizen to predict'
              : undefined
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
                bettingOpen={bettingOpen && showBet}
                tradingHalted={tradingHalted}
                busy={false}
                userConnected={!!userAddress}
                onBet={onBet}
                actions={
                  <>
                    <button
                      type="button"
                      onClick={() => onPredict(o.index)}
                      disabled={!predictAction?.enabled || writing}
                      aria-pressed={isSaved}
                      title={predictReason}
                      className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide border transition-colors disabled:opacity-40 w-full sm:w-auto ${TOUCH} ${
                        isSaved
                          ? 'border-indigo-400/60 bg-indigo-400/15 text-white'
                          : predictAction?.role === 'primary'
                          ? 'border-indigo-400/40 bg-indigo-400/10 text-white'
                          : 'border-white/15 bg-white/[0.04] text-gray-200 hover:bg-white/10'
                      }`}
                    >
                      {pickLabel({ picked: isSaved, saved: isSaved && !writing })}
                    </button>
                    {isSaved && undoEnabled && (
                      <button
                        type="button"
                        onClick={onUndo}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide border border-white/15 text-gray-200 hover:bg-white/10 w-full sm:w-auto ${TOUCH}`}
                      >
                        Undo
                      </button>
                    )}
                  </>
                }
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
                <p className="text-xs text-gray-400">
                  Market {view.marketLabel} · DAO {view.daoLabel}
                  {view.pooledLabel != null ? ` · Pooled ${view.pooledLabel}` : ''}
                </p>
                {view.gapCaption && <p className="mt-1 text-xs text-gray-400">{view.gapCaption}</p>}
                <div className="mt-2 relative h-4 rounded-full bg-white/5 border border-white/10">
                  {view.showBracket && (
                    <span
                      className="absolute inset-y-0 rounded-full bg-white/15"
                      style={{ left: `${view.bracketLo}%`, width: `${view.bracketWidth}%` }}
                    />
                  )}
                  {view.pooledLabel != null && pooledPct != null && (
                    <span
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-1 rounded-full bg-indigo-300"
                      style={{ left: `${pooledPct}%` }}
                      title={`Pooled ${view.pooledLabel}`}
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
          {FORECAST_COPY.daoPending(FORECAST_DAO_MIN_PARTICIPANTS, consensus?.participants ?? 0)}
        </p>
      )}
      {savedPick != null && (
        <p className="mt-2 text-xs text-gray-400">{FORECAST_COPY.singlePick}</p>
      )}
      {error && <p className="mt-2 text-xs text-amber-200">{error}</p>}
    </section>
  )
}
