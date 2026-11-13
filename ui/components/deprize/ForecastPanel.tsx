import { getAccessToken, useLogin, usePrivy, useWallets } from '@privy-io/react-auth'
import ForecastsTableABI from 'const/abis/Forecasts.json'
import { FORECASTS_TABLE_ADDRESSES, FORECASTS_TABLE_NAMES } from 'const/config'
import Link from 'next/link'
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import toast from 'react-hot-toast'
import { useActiveAccount } from 'thirdweb/react'
import { usePrizeChainCitizen } from '@/lib/citizen/usePrizeChainCitizen'
import { deprizePrefixedHref, isCompetitorClaimed } from '@/lib/deprize/competitions'
import { fireDePrizeConfetti } from '@/lib/deprize/confetti'
import { useDePrizeRestricted } from '@/lib/deprize/deprizeRestrictedContext'
import { deprizeForecastVoteId, encodeForecastVote } from '@/lib/deprize/forecastVote'
import { walletErrorMessage } from '@/lib/deprize/walletError'
import { clearForecastVote, writeForecastVote } from '@/lib/deprize/writeForecastVote'
import { aggregateForecastVotes, votingPowerByOutcome } from '@/lib/forecasts/aggregate'
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
import { sameForecastSession } from '@/lib/forecasts/forecastSession'
import { forgetGuestForecast, rememberGuestForecast } from '@/lib/forecasts/guestHandoff'
import {
  mergeCallerRoster,
  notifyRoster,
  pruneRosterOverlays,
  subscribeRoster,
  type RosterOverlay,
} from '@/lib/forecasts/rosterRefresh'
import { rowActions } from '@/lib/forecasts/rowActions'
import { forecastGasErrorMessage, requestForecastGas } from '@/lib/forecasts/sponsorForecastGas'
import { useForecastWriter } from '@/lib/forecasts/useForecastWriter'
import { forecastRosterKey, useGuestForecastHandoff } from '@/lib/forecasts/useGuestForecastHandoff'
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
import { GuestConsentLine, GuestSaveNotice } from '@/components/deprize/GuestForecastNotice'
import PredictModal from '@/components/deprize/PredictModal'

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
  /**
   * ETH bet form for the open competitor. The page omits this when betting
   * is not allowed or no wallet is connected.
   */
  renderBet?: (input: {
    index: number
    onClose: () => void
    /** Records the pick after the ETH stake succeeds. */
    onPlaced?: () => Promise<boolean>
  }) => ReactNode
  /** ETH staked on each outcome, same order as `labels`. */
  stakedEthByOutcome?: number[]
  /**
   * 'predict' explains the pick. 'bet' is the ETH form, opened from "Add ETH"
   * or from a deep link that already chose to stake.
   */
  mode: 'bet' | 'predict'
  onModeChange: (mode: 'bet' | 'predict') => void
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
    renderBet,
    stakedEthByOutcome,
    mode,
    onModeChange,
  } = props
  const restricted = useDePrizeRestricted()
  void forecastPanelShouldMount(restricted)
  const { login } = useLogin()
  const { connectWallet } = usePrivy()
  const { wallets } = useWallets()
  const { setSelectedWallet } = useContext(PrivyWalletContext)
  const account = useActiveAccount()
  const forecastWriter = useForecastWriter()
  const writer = forecastWriter.writer
  const sessionRef = useRef({
    address: writer?.address?.toLowerCase(),
    chainSlug,
    deprizeId,
  })
  sessionRef.current = {
    address: writer?.address?.toLowerCase(),
    chainSlug,
    deprizeId,
  }
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
  const [rosterPrize, setRosterPrize] = useState<string | null>(null)
  const [overlays, setOverlays] = useState<RosterOverlay[]>([])
  // The writer, not the active account. A guest has no active account until
  // they create one, and that upgrade keeps this same address.
  const writerAddress = writer?.address?.toLowerCase()
  const prizeKey = forecastRosterKey(chainSlug, deprizeId, writerAddress)
  // The panel instance is reused across prizes. Drop the previous roster's
  // pick before effects run, or a stale saved pick would discard the next handoff.
  if (rosterPrize !== null && rosterPrize !== prizeKey) {
    setRosterPrize(null)
    setSavedPick(null)
  }
  const shownLeaderboard = useMemo(
    () => mergeCallerRoster(consensus?.leaderboard ?? [], overlays, labels),
    [consensus, overlays, labels]
  )
  const citizenVotingPowerByOutcome = useMemo(
    () => (consensus ? votingPowerByOutcome(shownLeaderboard, n) : undefined),
    [consensus, shownLeaderboard, n]
  )
  const predictionCounts = useMemo(
    () => (consensus ? aggregateForecastVotes(shownLeaderboard, n).backersByOutcome : undefined),
    [consensus, shownLeaderboard, n]
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
    connected: !!writer,
  })
  const predictAction = actions.find((action) => action.kind === 'predict')
  const showBet = actions.some((action) => action.kind === 'bet' && action.enabled)

  const applyConsensus = useCallback(
    (body: ForecastConsensus) => {
      setRosterPrize(prizeKey)
      setConsensus(body)
      setOverlays((prev) => pruneRosterOverlays(prev, body.leaderboard ?? [], labels))
      const mine = writerAddress
        ? body.leaderboard.find((row) => row.voterAddress === writerAddress)
        : undefined
      if (mine?.allocation?.length === n) {
        setSavedPick(pickFromAllocation(mine.allocation))
      }
    },
    [writerAddress, labels, n, prizeKey]
  )

  useEffect(() => {
    return subscribeRoster((notice) => {
      if (notice.chain !== chainSlug || notice.deprizeId !== deprizeId) return
      const address = notice.address.toLowerCase()
      setOverlays((prev) => [
        ...prev.filter((row) => row.address.toLowerCase() !== address),
        { address, pick: notice.pick, removed: notice.removed },
      ])
    })
  }, [chainSlug, deprizeId])

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
    return (await res.json()) as ForecastConsensus
  }, [chainSlug, deprizeId, n])

  const refetchFresh = useCallback(async () => {
    if (n < 2) return
    const started = {
      address: writer?.address?.toLowerCase(),
      chainSlug,
      deprizeId,
    }
    const res = await fetch(
      consensusQuery({
        chain: chainSlug,
        deprizeId,
        outcomes: n,
        fresh: true,
      })
    )
    if (!res.ok) return
    const body = (await res.json()) as ForecastConsensus
    if (!sameForecastSession(sessionRef.current, started)) return
    applyConsensus(body)
  }, [writer?.address, applyConsensus, chainSlug, deprizeId, n])

  useEffect(() => {
    setSavedPick(null)
    setPreviousPick(null)
    setError(null)
  }, [writerAddress, chainSlug, deprizeId])

  useEffect(() => {
    setError(null)
  }, [modalIndex])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const body = await loadConsensus()
        // A wallet switch cancels this read. Applying it would restore the previous pick.
        if (cancelled || !body) return
        applyConsensus(body)
      } catch {
        // A failed roster read leaves the share blank. The window still opens.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applyConsensus, loadConsensus])

  function rememberRow(allocation: number[], from: { address: string }) {
    setConsensus((prev) => {
      if (!prev) return prev
      const row = {
        voterAddress: from.address.toLowerCase(),
        citizenId: prizeCitizen.tokenId ?? '',
        citizenName: from.address,
        citizenImage: undefined,
        allocation,
        weight: isCitizen ? totalVMOONEY || 0 : 0,
        storedVmooney: isCitizen ? totalVMOONEY || 0 : 0,
        liveVmooney: isCitizen ? totalVMOONEY || 0 : 0,
        updatedAt: Math.floor(Date.now() / 1000),
        brier: null,
        skill: null,
      }
      const others = prev.leaderboard.filter((entry) => entry.voterAddress !== row.voterAddress)
      return { ...prev, leaderboard: [row, ...others] }
    })
  }

  async function commitPick(
    index: number,
    options?: { silent?: boolean; from?: typeof writer }
  ): Promise<boolean> {
    let from = options?.from ?? writer
    if (!from) return false
    if (!forecastsContract || !forecastsTableName) {
      setError('Predictions are not available on this network yet.')
      return false
    }
    const started = {
      address: from.address.toLowerCase(),
      chainSlug,
      deprizeId,
    }
    setError(null)
    setWriting(true)
    const allocation = allocationForPick(index, n)
    try {
      toast.loading('Covering gas…', { id: 'forecast-gas', style: toastStyle })
      const gas = await requestForecastGas({
        writer: from,
        chainId: chain.id,
        deprizeId,
        canRenewGuest: forecastWriter.canRenewGuest,
        getToken: getAccessToken,
        renewGuest: forecastWriter.renewGuestWriter,
      })
      toast.dismiss('forecast-gas')
      if (gas.writer !== from) {
        from = gas.writer
        started.address = from.address.toLowerCase()
      }
      if (!gas.reply.ok) {
        if (sameForecastSession(sessionRef.current, started)) {
          setError(forecastGasErrorMessage(gas.reply))
        }
        return false
      }
      const vote = encodeForecastVote(allocation, isCitizen ? totalVMOONEY || 0 : 0)
      await writeForecastVote({
        forecastsContract,
        account: from,
        forecastsTableName,
        chainId: chain.id,
        voteId: deprizeForecastVoteId(deprizeId),
        address: from.address,
        vote,
      })
      // The gateway cannot see this row yet. Keep it locally so signing into
      // an existing account can still move it.
      if (forecastWriter.isGuest || (options?.from && !account)) {
        rememberGuestForecast({ chainSlug, deprizeId, vote, from: from.address })
      }
      notifyRoster({
        chain: chainSlug,
        deprizeId,
        address: from.address,
        pick: labels[index],
        removed: false,
      })
      // The signature can outlive a wallet switch. The new wallet's Undo
      // would otherwise delete or replace that wallet's forecast.
      if (!sameForecastSession(sessionRef.current, started)) return false
      setPreviousPick(savedPick)
      setSavedPick(index)
      rememberRow(allocation, from)
      if (!options?.silent) {
        toast.success('Prediction saved', { style: toastStyle })
        fireDePrizeConfetti()
      }
      await refetchFresh()
      return true
    } catch (err: any) {
      toast.dismiss('forecast-gas')
      if (sameForecastSession(sessionRef.current, started)) {
        setError(walletErrorMessage(err, 'Could not save your prediction.'))
      }
      return false
    } finally {
      setWriting(false)
    }
  }

  async function clearPick() {
    if (!writer || !forecastsContract) return
    const started = {
      address: writer.address.toLowerCase(),
      chainSlug,
      deprizeId,
    }
    setError(null)
    setWriting(true)
    try {
      await clearForecastVote({
        forecastsContract,
        account: writer,
        voteId: deprizeForecastVoteId(deprizeId),
      })
      if (forecastWriter.isGuest || !account) forgetGuestForecast(chainSlug, deprizeId)
      const clearedPick = savedPick != null ? labels[savedPick] : undefined
      notifyRoster({
        chain: chainSlug,
        deprizeId,
        address: writer.address,
        pick: clearedPick,
        removed: true,
      })
      if (!sameForecastSession(sessionRef.current, started)) return
      setSavedPick(null)
      setPreviousPick(null)
      toast.success('Prediction removed', { style: toastStyle })
      await refetchFresh()
    } catch (err: any) {
      if (sameForecastSession(sessionRef.current, started)) {
        setError(walletErrorMessage(err, 'Could not remove your prediction.'))
      }
    } finally {
      setWriting(false)
    }
  }

  async function onPredict(index: number) {
    const plan = tapPlan({
      index,
      savedPick,
      writing,
      connected: !!writer,
      isCitizen,
      locked: inputsLocked,
    })
    if (plan.action === 'connect') {
      setWriting(true)
      const guest = await forecastWriter.ensureWriter().finally(() => setWriting(false))
      if (!guest) {
        login()
        return
      }
      const ok = await commitPick(index, { from: guest })
      if (ok) onModalClose()
      return
    }
    if (plan.action === 'write') {
      const ok = await commitPick(plan.index)
      if (ok) onModalClose()
    }
  }

  // A guest who signed in to an existing account left their pick in
  // localStorage (useForecastWriter.switchToExistingAccount).
  useGuestForecastHandoff({
    chainSlug,
    deprizeId,
    accountAddress: account?.address,
    isGuest: forecastWriter.isGuest,
    rosterReady: rosterPrize === prizeKey && consensus != null,
    inputsLocked,
    writing,
    savedPick,
    n,
    commitPick,
  })

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

  const mine = consensus?.leaderboard.find(
    (row) => row.voterAddress === writer?.address?.toLowerCase()
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
    <section id="deprize-forecast" className="scroll-mt-24">
      <h2 className="text-white text-lg font-heading font-semibold">Competitors</h2>
      <p className="mt-1 text-sm text-gray-400">{FORECAST_COPY.panelIntro}</p>

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
      {!showBet && account && !isCitizen ? (
        <div className="mt-3">{renderCitizenNotice()}</div>
      ) : null}
      {mine?.skill != null && (
        <p className="mt-3 text-sm text-gray-300">Your skill score is {mine.skill.toFixed(2)}.</p>
      )}

      <div
        aria-hidden
        className="mt-4 flex items-center gap-3 sm:gap-4 border-b border-white/[0.08] px-3 sm:px-4 pb-2 text-[11px] uppercase tracking-wide text-gray-500"
      >
        <span className="min-w-0 flex-1 sm:min-w-[150px]">Outcome</span>
        <span className="hidden w-24 text-right md:block">ETH bet</span>
        <span className="hidden w-28 text-right md:block">Voting power</span>
        <span className="hidden w-[5.5rem] text-right md:block"># predictions</span>
        <span className="w-16 text-right sm:w-20">Chance</span>
        <span className="hidden w-12 text-right sm:block">Pays</span>
      </div>
      <div className="mt-1 flex flex-col gap-1" aria-live="polite">
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
                mode="predict"
                showCta={false}
                bettingOpen={false}
                selectable={!showResolved && !inputsLocked}
                highlighted={isSaved}
                badge={isSaved ? FORECAST_COPY.predicted : undefined}
                chanceLabel="chance"
                stakedEth={stakedEthByOutcome?.[o.index] ?? 0}
                citizenVotingPower={
                  citizenVotingPowerByOutcome
                    ? citizenVotingPowerByOutcome[o.index] ?? 0
                    : undefined
                }
                predictionCount={predictionCounts ? predictionCounts[o.index] ?? 0 : undefined}
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
      {savedPick != null && forecastWriter.isGuest && (
        <div className="mt-2">
          <GuestSaveNotice
            onCreateAccount={login}
            onExistingAccount={() => void forecastWriter.switchToExistingAccount()}
          />
        </div>
      )}
      {error && <p className="mt-2 text-xs text-amber-200">{error}</p>}
      {modalIndex != null && (
        <PredictModal
          mode={mode}
          teamName={labels[modalIndex] || 'this competitor'}
          probability={marketPercents[modalIndex] ?? NaN}
          chanceLoading={marketLoading}
          bettingAvailable={showBet}
          regionRestricted={restricted}
          connected={!!writer}
          citizenLoading={!!account && prizeCitizen.isLoading}
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
          signedOutPredict={!writer}
          consentNotice={!account ? <GuestConsentLine /> : undefined}
          onClose={onModalClose}
          onAddEth={() => onModeChange('bet')}
          outcomeIndex={modalIndex}
          combineEth={!restricted && showBet}
          bet={
            showBet && renderBet ? (
              <div key={modalIndex}>
                {renderBet({
                  index: modalIndex,
                  onClose: onModalClose,
                  onPlaced: () =>
                    savedPick === modalIndex
                      ? Promise.resolve(true)
                      : commitPick(modalIndex, { silent: true }),
                })}
              </div>
            ) : undefined
          }
        />
      )}
    </section>
  )
}
