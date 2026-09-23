import { getAccessToken, useLogin, usePrivy, useWallets } from '@privy-io/react-auth'
import ForecastsTableABI from 'const/abis/Forecasts.json'
import { FORECASTS_TABLE_ADDRESSES, FORECASTS_TABLE_NAMES } from 'const/config'
import Link from 'next/link'
import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import { useActiveAccount } from 'thirdweb/react'
import { usePrizeChainCitizen } from '@/lib/citizen/usePrizeChainCitizen'
import { deprizePrefixedHref, isCompetitorClaimed } from '@/lib/deprize/competitions'
import { fireDePrizeConfetti } from '@/lib/deprize/confetti'
import { useDePrizeRestricted } from '@/lib/deprize/deprizeRestrictedContext'
import { deprizeForecastVoteId, encodeForecastVote } from '@/lib/deprize/forecastVote'
import { clearForecastVote, writeForecastVote } from '@/lib/deprize/writeForecastVote'
import { votingPowerByOutcome } from '@/lib/forecasts/aggregate'
import { consensusQuery } from '@/lib/forecasts/consensusQuery'
import type { ForecastConsensus } from '@/lib/forecasts/consensusTypes'
import { FORECAST_COPY } from '@/lib/forecasts/forecastCopy'
import {
  allocationForPick,
  canUndo,
  pickFromAllocation,
  tapPlan,
  undoPlan,
} from '@/lib/forecasts/forecastPick'
import { notifyRoster } from '@/lib/forecasts/rosterRefresh'
import { rowActions } from '@/lib/forecasts/rowActions'
import { forecastPanelShouldMount } from '@/lib/forecasts/visibility'
import { SEED_ATLAS, orgById, projectById } from '@/lib/lunar-atlas'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import { sepolia } from '@/lib/rpc/chains'
import { v4SlugToV5Chain } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useTotalVMOONEY } from '@/lib/tokens/hooks/useTotalVMOONEY'
import CitizenPredictNotice from '@/components/deprize/CitizenPredictNotice'
import DePrizeTeamCard from '@/components/deprize/DePrizeTeamCard'
import PredictModal from '@/components/deprize/PredictModal'
import { CARD } from '@/components/deprize/detail/primitives'

export default function ForecastPanel(props: {
  chainSlug: string
  deprizeId: number
  labels: string[]
  marketPercents: number[]
  liveTipId?: number
  reported: boolean
  resolvedVector?: number[] | null
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
  /** Which competitor's prediction window is open. The page owns this so deep links share it. */
  modalIndex: number | null
  onModalClose: () => void
  /** Open the embedded bet form as soon as the prediction window appears. */
  resumeBet?: boolean
  /**
   * ETH bet form for the open competitor. The page omits this when betting
   * is not allowed; the prediction itself does not need it.
   */
  renderBet?: (input: { index: number; onClose: () => void; onPlaced: () => void }) => ReactNode
}) {
  const {
    chainSlug,
    deprizeId,
    labels,
    marketPercents,
    liveTipId,
    reported,
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
    modalIndex,
    onModalClose,
    resumeBet,
    renderBet,
  } = props
  const restricted = useDePrizeRestricted()
  void forecastPanelShouldMount(restricted)
  const { login } = useLogin()
  const { connectWallet } = usePrivy()
  const { wallets } = useWallets()
  const { setSelectedWallet } = useContext(PrivyWalletContext)
  const account = useActiveAccount()
  const chain = v4SlugToV5Chain(chainSlug) ?? sepolia
  const prizeCitizen = usePrizeChainCitizen(chain)
  const isCitizen = prizeCitizen.isCitizen
  const citizenWalletIndex = prizeCitizen.linkedCitizenAddress
    ? wallets.findIndex(
        (wallet) => wallet.address?.toLowerCase() === prizeCitizen.linkedCitizenAddress
      )
    : -1
  const { totalVMOONEY } = useTotalVMOONEY(account?.address)

  const n = labels.length
  const [savedPick, setSavedPick] = useState<number | null>(null)
  const [previousPick, setPreviousPick] = useState<number | null>(null)
  const [writing, setWriting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consensus, setConsensus] = useState<ForecastConsensus | null>(null)
  const citizenVotingPowerByOutcome = useMemo(
    () => (consensus ? votingPowerByOutcome(consensus.leaderboard ?? [], n) : undefined),
    [consensus, n]
  )

  const forecastsContract = useContract({
    address: FORECASTS_TABLE_ADDRESSES[chainSlug] ?? '',
    chain,
    abi: ForecastsTableABI.abi as any,
  })
  const forecastsTableName = FORECASTS_TABLE_NAMES[chainSlug] ?? ''

  const isLive = liveTipId == null || liveTipId === deprizeId
  // Cards stay locked until the payout read finishes. `reported` is still
  // false for that whole window, so it cannot be the only gate.
  const inputsLocked = !isLive || reported || marketLoading
  const actions = rowActions({
    restricted,
    bettingOpen,
    locked: inputsLocked,
    isCitizen,
    connected: !!account,
  })
  const predictAction = actions.find((action) => action.kind === 'predict')
  const showBet = actions.some((action) => action.kind === 'bet')

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
    if (n < 2) return
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
    if (n < 2) return
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
        citizenId: prizeCitizen.tokenId ?? '',
        citizenName: account.address,
        citizenImage: undefined,
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

  async function commitPick(index: number): Promise<boolean> {
    if (!account || !isCitizen) return false
    if (!forecastsContract || !forecastsTableName) {
      setError('Predictions are not available on this network yet.')
      return false
    }
    setError(null)
    setWriting(true)
    const allocation = allocationForPick(index, n)
    try {
      toast.loading('Covering gas…', { id: 'forecast-gas', style: toastStyle })
      const accessToken = await getAccessToken().catch(() => null)
      const sponsorRes = await fetch('/api/deprize/sponsor-forecast-gas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          wallet: account.address,
          chainId: chain.id,
          deprizeId,
        }),
      })
      const sponsor = await sponsorRes.json().catch(() => ({}))
      toast.dismiss('forecast-gas')
      if (!sponsorRes.ok) {
        setError(
          typeof sponsor?.message === 'string'
            ? sponsor.message
            : 'Could not cover gas for this prediction.'
        )
        return false
      }
      const vote = encodeForecastVote(allocation, totalVMOONEY || 0)
      await writeForecastVote({
        forecastsContract,
        account,
        forecastsTableName,
        chainId: chain.id,
        voteId: deprizeForecastVoteId(deprizeId),
        address: account.address,
        vote,
      })
      setPreviousPick(savedPick)
      setSavedPick(index)
      rememberRow(allocation)
      toast.success('Prediction saved', { style: toastStyle })
      fireDePrizeConfetti()
      notifyRoster({
        chain: chainSlug,
        deprizeId,
        address: account.address,
        pick: labels[index],
        removed: false,
      })
      await refetchFresh()
      return true
    } catch (err: any) {
      toast.dismiss('forecast-gas')
      setError(err?.shortMessage || err?.message || 'Could not save your prediction.')
      return false
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
      const clearedPick = savedPick != null ? labels[savedPick] : undefined
      setSavedPick(null)
      setPreviousPick(null)
      toast.success('Prediction removed', { style: toastStyle })
      notifyRoster({
        chain: chainSlug,
        deprizeId,
        address: account.address,
        pick: clearedPick,
        removed: true,
      })
      await refetchFresh()
    } catch (err: any) {
      setError(err?.shortMessage || err?.message || 'Could not remove your prediction.')
    } finally {
      setWriting(false)
    }
  }

  async function onPredict(index: number) {
    const plan = tapPlan({
      index,
      savedPick,
      writing,
      connected: !!account,
      isCitizen,
      locked: inputsLocked,
    })
    if (plan.action === 'connect') {
      login()
      return
    }
    if (plan.action === 'need-citizen') {
      setError(
        prizeCitizen.linkedCitizenAddress
          ? 'Switch to the wallet that holds your Citizen to predict.'
          : prizeCitizen.lookupFailed
          ? "Couldn't check your Citizen. Try again."
          : prizeCitizen.expired
          ? 'Your Citizen subscription has lapsed.'
          : 'Predictions count only for Citizens. Mint a Citizen to predict.'
      )
      return
    }
    if (plan.action === 'write') {
      const ok = await commitPick(plan.index)
      if (ok && !showBet) onModalClose()
    }
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

  function attachPrediction(index: number) {
    const plan = tapPlan({
      index,
      savedPick,
      writing,
      connected: !!account,
      isCitizen,
      locked: inputsLocked,
    })
    if (plan.action === 'write') void commitPick(plan.index)
  }

  const mine = consensus?.leaderboard.find(
    (row) => row.voterAddress === account?.address?.toLowerCase()
  )
  const undoEnabled = canUndo({ savedPick, writing, locked: inputsLocked })

  function switchToCitizenWallet() {
    if (citizenWalletIndex >= 0) setSelectedWallet(citizenWalletIndex)
    else connectWallet()
  }

  function renderCitizenNotice() {
    if (!account) return null
    return (
      <CitizenPredictNotice
        loading={prizeCitizen.isLoading}
        isCitizen={isCitizen}
        lookupFailed={prizeCitizen.lookupFailed}
        expired={prizeCitizen.expired}
        activeAddress={account.address}
        linkedCitizenAddress={prizeCitizen.linkedCitizenAddress}
        chainLabel={chain.name || 'this network'}
        canSwitch={citizenWalletIndex >= 0}
        onSwitch={switchToCitizenWallet}
        onConnectLinked={connectWallet}
        onRetry={prizeCitizen.retry}
      />
    )
  }

  if (numOutcomes <= 0) return null

  return (
    <section id="deprize-forecast" className={CARD}>
      <h2 className="title-text-colors text-lg font-GoodTimes">Competitors</h2>
      <p className="mt-1 text-sm text-gray-300">{FORECAST_COPY.panelIntro}</p>
      {restricted && (
        <p className="mt-2 text-sm text-amber-200">
          Betting isn&apos;t available in your region — you can still make a prediction.
        </p>
      )}

      {!isLive && (
        <p className="mt-3 text-sm text-amber-200">
          Forecasts are on the live generation.{' '}
          <Link
            href={deprizePrefixedHref(chainSlug, liveTipId)}
            className="text-indigo-300 underline"
          >
            Go to DePrize #{liveTipId}
          </Link>
        </p>
      )}
      {reported && (
        <p className="mt-3 text-sm text-amber-200">
          This prize has reported — forecasting is closed.
        </p>
      )}
      {account && !isCitizen ? <div className="mt-3">{renderCitizenNotice()}</div> : null}
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
                bettingOpen={false}
                selectable={!showResolved && !inputsLocked}
                highlighted={isSaved}
                badge={isSaved ? FORECAST_COPY.predicted : undefined}
                citizenVotingPower={
                  citizenVotingPowerByOutcome
                    ? citizenVotingPowerByOutcome[o.index] ?? 0
                    : undefined
                }
                predictionCount={consensus ? consensus.backersByOutcome?.[o.index] ?? 0 : undefined}
                tradingHalted={tradingHalted}
                busy={writing}
                userConnected={!!userAddress}
                onBet={onBet}
                isField={isField}
                withdrawn={!!withdrawnByTeamId[teamId.toString()]}
                hrefOverride={
                  outcomeBinding?.projectId ? `/moonbase/${outcomeBinding.projectId}` : undefined
                }
                nameOverride={atlasOrg?.name || atlasProject?.name}
                vehicleLabel={outcomeBinding?.vehicleLabel}
                imageOverride={claimed ? atlasOrg?.logoURI : undefined}
                unclaimed={!isField && !!outcomeBinding && !claimed}
              />
            </div>
          )
        })}
      </div>

      {savedPick != null && (
        <p className="mt-2 text-xs text-gray-400">{FORECAST_COPY.singlePick}</p>
      )}
      {error && <p className="mt-2 text-xs text-amber-200">{error}</p>}
      {modalIndex != null && (
        <PredictModal
          teamName={labels[modalIndex] || 'this competitor'}
          probability={
            rankedOutcomes.find((outcome) => outcome.index === modalIndex)?.probability ??
            marketPercents[modalIndex] ??
            NaN
          }
          chanceLoading={marketLoading}
          bettingAvailable={showBet}
          connected={!!account}
          citizenLoading={prizeCitizen.isLoading}
          isCitizen={isCitizen}
          citizenNotice={renderCitizenNotice()}
          saved={savedPick === modalIndex}
          writing={writing}
          error={error}
          predictEnabled={!!predictAction?.enabled}
          undoEnabled={undoEnabled && savedPick === modalIndex}
          onPredict={() => void onPredict(modalIndex)}
          onUndo={onUndo}
          onConnect={login}
          onClose={onModalClose}
          resumeBet={resumeBet}
          bet={
            showBet && renderBet ? (
              <div key={modalIndex}>
                {renderBet({
                  index: modalIndex,
                  onClose: onModalClose,
                  onPlaced: () => attachPrediction(modalIndex),
                })}
              </div>
            ) : undefined
          }
        />
      )}
    </section>
  )
}
