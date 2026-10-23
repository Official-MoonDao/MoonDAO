import { getAccessToken, useLogin } from '@privy-io/react-auth'
import ForecastsTableABI from 'const/abis/Forecasts.json'
import { FORECASTS_TABLE_ADDRESSES, FORECASTS_TABLE_NAMES } from 'const/config'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import type { Chain } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { resolveLiveDePrizeId } from '@/lib/deprize/competitions'
import { fireDePrizeConfetti } from '@/lib/deprize/confetti'
import { deprizeForecastVoteId, encodeForecastVote } from '@/lib/deprize/forecastVote'
import { useClientDePrizeRestricted } from '@/lib/deprize/useClientDePrizeRestricted'
import { clearForecastVote, writeForecastVote } from '@/lib/deprize/writeForecastVote'
import { votingPowerByOutcome } from '@/lib/forecasts/aggregate'
import { consensusQuery } from '@/lib/forecasts/consensusQuery'
import type { ForecastConsensus } from '@/lib/forecasts/consensusTypes'
import {
  allocationForPick,
  canUndo,
  pickFromAllocation,
  tapPlan,
  undoPlan,
} from '@/lib/forecasts/forecastPick'
import {
  mergeCallerRoster,
  notifyRoster,
  pruneRosterOverlays,
  subscribeRoster,
  type RosterOverlay,
} from '@/lib/forecasts/rosterRefresh'
import { rowActions } from '@/lib/forecasts/rowActions'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useTotalVMOONEY } from '@/lib/tokens/hooks/useTotalVMOONEY'

export type ForecastPredictController = {
  connected: boolean
  /** vMOONEY balance is still loading. A non-Citizen can hold voting power. */
  votingPowerLoading: boolean
  regionRestricted: boolean
  savedPick: number | null
  writing: boolean
  error: string | null
  blockedReason: string | null
  predictEnabled: boolean
  undoEnabled: boolean
  chanceLoading: boolean
  /** Voting power per outcome. Undefined until the roster has loaded. */
  votingPower: number[] | undefined
  onConnect: () => void
  predict: (index: number) => Promise<boolean>
  undo: () => void
}

/**
 * Session behind the DePrize "Predict {team}" window: voting-power weight,
 * roster share, and the free MOONEY write. Moon Base Zero mounts this so its
 * prize rows open that same window.
 */
export function useForecastPredict(args: {
  chain: Chain
  chainSlug: string
  deprizeId: number
  numOutcomes: number
  labels: readonly string[]
  reported: boolean
  marketLoading: boolean
}): ForecastPredictController {
  const { chain, chainSlug, deprizeId, numOutcomes, labels, reported, marketLoading } = args
  const regionRestricted = useClientDePrizeRestricted()
  const { login } = useLogin()
  const account = useActiveAccount()
  const { totalVMOONEY, isLoading: votingPowerLoading } = useTotalVMOONEY(account?.address)
  const votingWeight = totalVMOONEY || 0

  const n = numOutcomes
  const [savedPick, setSavedPick] = useState<number | null>(null)
  const [previousPick, setPreviousPick] = useState<number | null>(null)
  const [writing, setWriting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consensus, setConsensus] = useState<ForecastConsensus | null>(null)
  const [overlays, setOverlays] = useState<RosterOverlay[]>([])
  const [chanceLoading, setChanceLoading] = useState(true)

  const shownLeaderboard = useMemo(
    () => mergeCallerRoster(consensus?.leaderboard ?? [], overlays, labels),
    [consensus, overlays, labels]
  )
  const votingPower = useMemo(
    () => (consensus ? votingPowerByOutcome(shownLeaderboard, n) : undefined),
    [consensus, shownLeaderboard, n]
  )

  const forecastsContract = useContract({
    address: FORECASTS_TABLE_ADDRESSES[chainSlug] ?? '',
    chain,
    abi: ForecastsTableABI.abi as any,
  })
  const forecastsTableName = FORECASTS_TABLE_NAMES[chainSlug] ?? ''

  const liveTipId = resolveLiveDePrizeId(chainSlug, deprizeId)
  const isLive = liveTipId == null || liveTipId === deprizeId
  const inputsLocked = !isLive || reported || marketLoading || n < 2
  const predictEnabled = !!rowActions({
    restricted: regionRestricted,
    bettingOpen: false,
    locked: inputsLocked,
    isCitizen: false,
    connected: !!account,
  }).find((action) => action.kind === 'predict')?.enabled

  const blockedReason = !isLive
    ? 'Forecasts are on the live generation.'
    : reported
    ? 'This prize has reported — forecasting is closed.'
    : null

  const applyConsensus = useCallback(
    (body: ForecastConsensus) => {
      setConsensus(body)
      setOverlays((prev) => pruneRosterOverlays(prev, body.leaderboard ?? [], labels))
      const mine = account?.address
        ? body.leaderboard.find((row) => row.voterAddress === account.address.toLowerCase())
        : undefined
      if (mine?.allocation?.length === n) {
        setSavedPick(pickFromAllocation(mine.allocation))
      }
    },
    [account?.address, labels, n]
  )

  useEffect(() => {
    setSavedPick(null)
    setPreviousPick(null)
    setError(null)
    setConsensus(null)
    setOverlays([])
  }, [account?.address, chainSlug, deprizeId])

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
    if (n < 2) {
      setChanceLoading(false)
      return
    }
    let cancelled = false
    setChanceLoading(true)
    void (async () => {
      try {
        await loadConsensus()
      } catch {
        // A failed roster read leaves the share blank. The window still opens.
      } finally {
        if (!cancelled) setChanceLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadConsensus, n])

  function rememberRow(allocation: number[]) {
    if (!account) return
    setConsensus((prev) => {
      if (!prev) return prev
      const row = {
        voterAddress: account.address.toLowerCase(),
        citizenId: '',
        citizenName: account.address,
        citizenImage: undefined,
        allocation,
        weight: votingWeight,
        storedVmooney: votingWeight,
        liveVmooney: votingWeight,
        updatedAt: Math.floor(Date.now() / 1000),
        brier: null,
        skill: null,
      }
      const others = prev.leaderboard.filter((entry) => entry.voterAddress !== row.voterAddress)
      return { ...prev, leaderboard: [row, ...others] }
    })
  }

  async function commitPick(index: number): Promise<boolean> {
    if (!account) return false
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
      const vote = encodeForecastVote(allocation, votingWeight)
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

  async function predict(index: number): Promise<boolean> {
    const plan = tapPlan({
      index,
      savedPick,
      writing,
      connected: !!account,
      isCitizen: false,
      locked: inputsLocked,
    })
    if (plan.action === 'connect') {
      login()
      return false
    }
    if (plan.action !== 'write') return false
    return commitPick(plan.index)
  }

  function undo() {
    const plan = undoPlan({
      savedPick,
      previousPick,
      writing,
      locked: inputsLocked,
    })
    if (plan.action === 'write') void commitPick(plan.index)
    if (plan.action === 'clear') void clearPick()
  }

  return {
    connected: !!account,
    votingPowerLoading: !!account && votingPowerLoading,
    regionRestricted,
    savedPick,
    writing,
    error,
    blockedReason,
    predictEnabled,
    undoEnabled: canUndo({ savedPick, writing, locked: inputsLocked }),
    chanceLoading,
    votingPower,
    onConnect: () => {
      login()
    },
    predict,
    undo,
  }
}
