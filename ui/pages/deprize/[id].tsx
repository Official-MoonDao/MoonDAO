import type { GetServerSideProps } from 'next'
import DePrizeRegistryABI from 'const/abis/DePrizeRegistry.json'
import LMSRWithTWAP from 'const/abis/LMSRWithTWAP.json'
import TeamABI from 'const/abis/Team.json'
import {
  DEPRIZE_MINT_ADDRESSES,
  DEPRIZE_REGISTRY_ADDRESSES,
  TEAM_ADDRESSES,
} from 'const/config'
import { useLogin } from '@privy-io/react-auth'
import Link from 'next/link'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { eth_getBalance, getRpcClient } from 'thirdweb/rpc'
import {
  ROSTER_DISCLAIMER,
  findDePrizeIdForGoal,
  getDePrizeCompetition,
  getDePrizeGenerationNumber,
  getDePrizeRaceBinding,
  isCompetitorClaimed,
  isKnownDePrizeCompetition,
  isRaceBindingComplete,
} from '@/lib/deprize/competitions'
import {
  resolveDePrizePageProps,
  type DePrizePageProps,
} from '@/lib/deprize/pageEligibility'
import DePrizeRestrictedNotice from '@/components/deprize/DePrizeRestrictedNotice'
import { SEED_ATLAS, orgById, projectById, sharedGoalById } from '@/lib/lunar-atlas'
import GoalDePrizeDetail from '@/components/deprize/GoalDePrizeDetail'
import { orgColor } from '@/lib/lunar-atlas/display'
import {
  DePrizeState,
  DEPRIZE_STATE_META,
  MarketStage,
  OUTCOME_COLORS,
  positionRedeemValue,
  shouldSurfaceResolution,
  UNIT,
  deprizeOgDescription,
} from '@/lib/deprize/constants'
import { spendableFromBalanceEth } from '@/lib/deprize/gas-reserve'
import { buildAmounts } from '@/lib/deprize/quote'
import { rankOutcomes } from '@/lib/deprize/rank-outcomes'
import { deprizeReadChain, deprizeReadClient, rpcRead } from '@/lib/deprize/read'
import { formatBettingCloses, isMintConfigured, reconcileBettingStatus } from '@/lib/deprize/status'
import { useDePrize } from '@/lib/deprize/useDePrize'
import { useDePrizeActivity } from '@/lib/deprize/useDePrizeActivity'
import { useDePrizeLaunchpadToken } from '@/lib/deprize/useDePrizeLaunchpad'
import { useDePrizeMarket } from '@/lib/deprize/useDePrizeMarket'
import { useOddsHistory } from '@/lib/deprize/useOddsHistory'
import DePrizeAvailabilityLegend from '@/components/deprize/DePrizeAvailabilityLegend'
import EthUsd from '@/components/deprize/EthUsd'
import useRegionRestriction from '@/lib/geo/useRegionRestriction'
import useTotalFunding from '@/lib/juicebox/useTotalFunding'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'
import Container from '@/components/layout/Container'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import BetModal from '@/components/deprize/BetModal'
import ClaimPanel from '@/components/deprize/ClaimPanel'
import DePrizeAdminPanel from '@/components/deprize/DePrizeAdminPanel'
import DePrizePositionPanel from '@/components/deprize/DePrizePositionPanel'
import DePrizeQuestionCard from '@/components/deprize/DePrizeQuestionCard'
import DePrizeTeamCard from '@/components/deprize/DePrizeTeamCard'
import DePrizeTeamLink, {
  useDePrizeTeamName,
  useDePrizeTeamNames,
} from '@/components/deprize/DePrizeTeamLink'
import ExitPositionModal from '@/components/deprize/ExitPositionModal'

const OddsHistoryChart = dynamic(() => import('@/components/deprize/OddsHistoryChart'), {
  ssr: false,
})

const CARD =
  'p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 backdrop-blur-xl border border-white/[0.08] shadow-lg'

const EXPLORER_TX: Record<string, string> = {
  sepolia: 'https://sepolia.etherscan.io/tx/',
  arbitrum: 'https://arbiscan.io/tx/',
  'arbitrum-sepolia': 'https://sepolia.arbiscan.io/tx/',
}

function outcomeDisplayName(
  index: number,
  raceBinding: ReturnType<typeof getDePrizeRaceBinding>
): string {
  const binding = raceBinding?.outcomes[index]
  if (binding?.field) return 'Open Field'
  if (binding?.projectId) {
    const project = projectById(SEED_ATLAS, binding.projectId)
    const org = project ? orgById(SEED_ATLAS, project.orgId) : undefined
    return org?.name || project?.name || `Team #${index + 1}`
  }
  return `Team #${index + 1}`
}

function StateBadge({
  state,
  labelOverride,
  toneOverride,
}: {
  state: DePrizeState
  labelOverride?: string
  toneOverride?: 'amber'
}) {
  const meta = DEPRIZE_STATE_META[state]
  const tone = toneOverride
    ? 'bg-amber-500/15 text-amber-200 border-amber-500/40'
    : state === DePrizeState.OPEN
      ? 'bg-moon-green/20 text-moon-green border-moon-green/40'
      : state === DePrizeState.M2_COMPLETE
        ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
        : [DePrizeState.CANCELLED, DePrizeState.NO_WINNER, DePrizeState.M2_FAILED].includes(state)
          ? 'bg-red-500/10 text-red-200 border-red-500/30'
          : state === DePrizeState.SUPERSEDED
            ? 'bg-amber-500/15 text-amber-200 border-amber-500/40'
            : 'bg-white/10 text-gray-200 border-white/20'
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${tone}`}>
      {labelOverride ?? meta?.label ?? 'Unknown'}
    </span>
  )
}

export default function DePrizeDetailPage({ restricted }: DePrizePageProps) {
  if (restricted) return <DePrizeRestrictedNotice />
  return <DePrizeDetailContent />
}

export const getServerSideProps: GetServerSideProps<DePrizePageProps> = async ({
  req,
  res,
}) => resolveDePrizePageProps(req, res)

function DePrizeDetailContent() {
  const router = useRouter()
  const rawId = router.query.id
  const numericId =
    typeof rawId === 'string' && /^\d+$/.test(rawId) ? Number(rawId) : undefined
  const goalFromSlug =
    typeof rawId === 'string' && !/^\d+$/.test(rawId)
      ? sharedGoalById(SEED_ATLAS, rawId)
      : undefined
  const { selectedChain: chain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(chain)
  const boundFromSlug = goalFromSlug
    ? findDePrizeIdForGoal(chainSlug, goalFromSlug.id)
    : undefined
  const deprizeId = numericId ?? boundFromSlug

  // Follow the app's live selected chain (wallet / header dropdown), not the
  // build-time default — otherwise switching networks never re-queries DePrize.
  const competition = getDePrizeCompetition(chainSlug, deprizeId)
  const raceBinding = getDePrizeRaceBinding(chainSlug, deprizeId)
  const raceGoal = raceBinding ? sharedGoalById(SEED_ATLAS, raceBinding.sharedGoalId) : undefined
  const generationNumber = getDePrizeGenerationNumber(chainSlug, deprizeId)
  const knownCompetition = isKnownDePrizeCompetition(chainSlug, deprizeId)
  const account = useActiveAccount()
  const userAddress = account?.address
  const { login } = useLogin()

  const {
    deprize,
    error,
    registryConfigured,
    refresh: refreshRegistry,
  } = useDePrize(deprizeId, chain)
  const numOutcomes = deprize?.teamIds.length ?? 0
  const [withdrawnByTeamId, setWithdrawnByTeamId] = useState<Record<string, boolean>>({})

  const market = useDePrizeMarket({
    deprizeId,
    conditionId: deprize?.conditionId,
    numOutcomes,
    chain,
    userAddress,
    registryState: deprize?.state,
  })

  const [refreshNonce, setRefreshNonce] = useState(0)
  const activity = useDePrizeActivity({
    deprizeId,
    marketAddress: market.marketAddress,
    chain,
    refreshNonce,
  })
  const odds = useOddsHistory({ market, activity })

  const region = useRegionRestriction()
  // Pass a plain number: useRead JSON.stringify's its params for memoization,
  // which throws on bigint. JB project ids are small, so Number() is safe.
  // useTotalFunding returns BigInt(0) for a missing projectId / while reads are
  // in flight, so gate the display on a real project id and !isLoading.
  // Read Juicebox on the same chain as the DePrize registry (jbTerminal.pay
  // settles on-chain with the mint router), not the build-time default.
  const jbProjectId = deprize && deprize.jbProjectId > 0n ? Number(deprize.jbProjectId) : undefined
  const { totalFunding, isLoading: isLoadingFunding } = useTotalFunding(jbProjectId, chain)
  const launchpad = useDePrizeLaunchpadToken(jbProjectId, chain)

  const mintAddress = DEPRIZE_MINT_ADDRESSES[chainSlug] ?? ''

  const [nativeBalance, setNativeBalance] = useState<number | undefined>()
  const [sellQuotes, setSellQuotes] = useState<Map<number, number>>(new Map())
  const [betIndex, setBetIndex] = useState<number | null>(null)
  const [exitIndex, setExitIndex] = useState<number | null>(null)

  const readChain = useMemo(() => deprizeReadChain(chain.id), [chain.id])

  // Disclosure flags: withdrawn competitors stay tradable but are badged.
  useEffect(() => {
    const address = DEPRIZE_REGISTRY_ADDRESSES[chainSlug] ?? ''
    if (!deprize?.teamIds.length || !address || deprizeId === undefined) {
      setWithdrawnByTeamId({})
      return
    }
    let cancelled = false
    const registry = getContract({
      client: deprizeReadClient,
      chain: readChain,
      address,
      abi: DePrizeRegistryABI as any,
    })
    ;(async () => {
      const entries = await Promise.all(
        deprize.teamIds.map(async (teamId) => {
          try {
            const w = await rpcRead<boolean>({
              contract: registry,
              method: 'withdrawn' as string,
              params: [BigInt(deprizeId), teamId],
            })
            return [teamId.toString(), !!w] as const
          } catch {
            return [teamId.toString(), false] as const
          }
        }),
      )
      if (!cancelled) setWithdrawnByTeamId(Object.fromEntries(entries))
    })()
    return () => {
      cancelled = true
    }
  }, [deprize?.teamIds, deprizeId, chainSlug, readChain, refreshNonce])

  const teamContract = useMemo(
    () =>
      TEAM_ADDRESSES[chainSlug]
        ? getContract({
            client,
            chain,
            address: TEAM_ADDRESSES[chainSlug],
            abi: TeamABI as any,
          })
        : undefined,
    [chain, chainSlug],
  )

  const lmsrRead = useMemo(
    () =>
      market.marketAddress
        ? getContract({
            client: deprizeReadClient,
            chain: readChain,
            address: market.marketAddress,
            abi: LMSRWithTWAP.abi as any,
          })
        : undefined,
    [market.marketAddress, readChain],
  )

  // Native ETH balance (spendable for bets).
  useEffect(() => {
    if (!userAddress) {
      setNativeBalance(undefined)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const b = await eth_getBalance(
          getRpcClient({ client: deprizeReadClient, chain: readChain }),
          { address: userAddress },
        )
        if (!cancelled) setNativeBalance(Number(b) / Number(UNIT))
      } catch {
        if (!cancelled) setNativeBalance(undefined)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userAddress, readChain, refreshNonce])

  // After a tx, events land a block or two later: refresh now, soon, and later.
  const refreshAll = useCallback(() => {
    const tick = () => {
      market.refresh()
      refreshRegistry()
      setRefreshNonce((n) => n + 1)
    }
    tick()
    setTimeout(tick, 2500)
    setTimeout(tick, 8000)
  }, [market, refreshRegistry])

  // Live sell quotes for held outcomes while the market is trading.
  useEffect(() => {
    if (!lmsrRead || market.stage !== MarketStage.Running) {
      setSellQuotes(new Map())
      return
    }
    const held = market.outcomes.filter((o) => Number.isFinite(o.balance) && o.balance > 0)
    if (!held.length) {
      setSellQuotes(new Map())
      return
    }
    let cancelled = false
    ;(async () => {
      const entries = await Promise.all(
        held.map(async (o) => {
          try {
            const balWei = o.balanceWei ?? 0n
            const amounts = buildAmounts(o.index, -balWei, numOutcomes)
            const net = await rpcRead<bigint>({
              contract: lmsrRead,
              method: 'calcNetCost' as string,
              params: [amounts],
            })
            // Net cost excludes the market-maker fee; realized sells record
            // proceeds as -netCost - fees, so quote the same here. If the fee
            // read fails, fall back to the net-only quote rather than no quote.
            let fee = 0n
            try {
              // calcMarketFee is uint256(|net|); a signed sell net is out of range.
              const absNet = net < 0n ? -net : net
              fee = await rpcRead<bigint>({
                contract: lmsrRead,
                method: 'calcMarketFee' as string,
                params: [absNet],
              })
            } catch {
              fee = 0n
            }
            return [o.index, Number(-net - fee) / Number(UNIT)] as [number, number]
          } catch {
            return null
          }
        }),
      )
      if (cancelled) return
      setSellQuotes(new Map(entries.filter((e): e is [number, number] => e !== null)))
    })()
    return () => {
      cancelled = true
    }
  }, [lmsrRead, market.outcomes, market.stage, numOutcomes])

  const spendable = spendableFromBalanceEth(nativeBalance, chain.id)
  const tradingHalted = market.stage !== undefined && market.stage !== MarketStage.Running
  const mintConfigured = isMintConfigured(mintAddress)
  const marketBound =
    !!market.marketAddress && !/^0x0+$/.test(market.marketAddress)
      ? true
      : market.loading
        ? undefined
        : false
  // Default-deny when country is unknown: `/api/geo/country` reports
  // restricted=false for a missing geo header, which must not open betting.
  const bettingAllowed =
    !!deprize?.bettingOpen &&
    market.mintBound &&
    mintConfigured &&
    !!region.country &&
    !region.isRestricted &&
    !region.isLoading &&
    !region.isError &&
    !tradingHalted &&
    market.stage === MarketStage.Running

  // The Back button is also the connect entry point.
  const handleBet = useCallback(
    (index: number) => {
      if (!userAddress) {
        login()
        return
      }
      setBetIndex(index)
    },
    [userAddress, login],
  )

  // Moon Base Zero "Back this team" deep-links here with ?outcome=N. Wait for
  // the market + chart to settle so the layout above the card stops shifting.
  const [deepLinkHandled, setDeepLinkHandled] = useState(false)
  useEffect(() => {
    if (deepLinkHandled || !router.isReady || numOutcomes <= 0) return
    if (market.loading || odds.loading) return
    const raw = router.query.outcome
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return
    const idx = Number(raw)
    if (idx < 0 || idx >= numOutcomes) return
    // Wallet hydrate and the geo check usually finish after the chart. Latch
    // only once those gates can open the modal; otherwise a later ready pass
    // would no-op and `?outcome=N` would scroll without auto-opening.
    if (!userAddress || !bettingAllowed) return
    setDeepLinkHandled(true)
    const el = document.getElementById(`deprize-outcome-${idx}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setBetIndex(idx)
  }, [
    deepLinkHandled,
    router.isReady,
    router.query.outcome,
    numOutcomes,
    market.loading,
    odds.loading,
    userAddress,
    bettingAllowed,
  ])

  // CTF may already have a payout vector on a still-OPEN/paused test market —
  // only show Refund/WON/claim when the registry lifecycle (or a Closed market)
  // says resolution should surface.
  const showResolved =
    !!deprize &&
    shouldSurfaceResolution({
      ctfResolved: market.resolved,
      registryState: deprize.state,
      marketClosed: market.stage === MarketStage.Closed,
    })
  const showRefundVector = showResolved && market.isRefundVector

  const { bettingBlockedReason, statusLabelOverride } = deprize
    ? reconcileBettingStatus({
        bettingOpen: deprize.bettingOpen,
        marketStage: market.stage,
        mintConfigured: mintConfigured && market.mintBound,
        registryState: deprize.state,
        marketBound,
      })
    : { bettingBlockedReason: undefined, statusLabelOverride: undefined }

  // Prefer the registry's winning team id (NFT id); fall back to the CTF
  // payout slot → teamIds mapping once resolution is surfaced.
  const winningTeamId =
    deprize && deprize.winningTeamId > 0n
      ? deprize.winningTeamId
      : showResolved && market.winningIndex >= 0 && deprize?.teamIds[market.winningIndex]
        ? deprize.teamIds[market.winningIndex]
        : 0n
  const winningTeamName = useDePrizeTeamName(
    winningTeamId > 0n ? winningTeamId : undefined,
    teamContract,
  )
  const rosterNames = useDePrizeTeamNames(deprize?.teamIds, teamContract)
  const predictionLabels = market.outcomes.map((o) => {
    const bound = outcomeDisplayName(o.index, raceBinding)
    if (!bound.startsWith('Team #')) return bound
    return rosterNames[o.index] || bound
  })

  // One color per outcome, shared by cards, chart lines and the position panel.
  // Claimed listings get their brand color; everything else gets a distinct
  // palette color (consent gates branding, not legibility — the cards are the
  // chart's legend).
  const outcomeColors = useMemo(
    () =>
      Array.from({ length: numOutcomes }, (_, i) => {
        const binding = raceBinding?.outcomes[i]
        const fallback = OUTCOME_COLORS[i % OUTCOME_COLORS.length]
        if (binding?.field || !binding || !isCompetitorClaimed(binding)) return fallback
        const project = binding.projectId ? projectById(SEED_ATLAS, binding.projectId) : undefined
        const org = project ? orgById(SEED_ATLAS, project.orgId) : undefined
        return orgColor(org) || fallback
      }),
    [numOutcomes, raceBinding],
  )

  // Display order only — `market.outcomes` stays contract-index aligned.
  const rankedOutcomes = useMemo(
    () =>
      rankOutcomes(market.outcomes, {
        isField: (i) => !!raceBinding?.outcomes[i]?.field,
        winningIndex: showResolved && market.winningIndex >= 0 ? market.winningIndex : undefined,
      }),
    [market.outcomes, raceBinding, showResolved, market.winningIndex],
  )

  const redeemValues = useMemo(() => {
    const m = new Map<number, number>()
    if (!showResolved) return m
    for (const o of market.outcomes) {
      if (o.balanceWei === undefined) continue
      m.set(
        o.index,
        Number(
          positionRedeemValue(
            o.balanceWei,
            market.payoutNums[o.index] ?? 0n,
            market.payoutDen ?? 0n,
          ),
        ) / Number(UNIT),
      )
    }
    return m
  }, [showResolved, market.outcomes, market.payoutNums, market.payoutDen])

  const shellTitle =
    knownCompetition && deprizeId !== undefined
      ? `DePrize #${deprizeId} — ${competition.title}`
      : deprizeId !== undefined
        ? `DePrize #${deprizeId}`
        : competition.title

  // --- Render states ---
  if (!router.isReady) {
    return (
      <Shell title={shellTitle} description={competition.metaDescription}>
        <div className="p-8 text-center text-gray-400">Loading DePrize…</div>
      </Shell>
    )
  }
  if (goalFromSlug && boundFromSlug === undefined) {
    return <GoalDePrizeDetail goal={goalFromSlug} />
  }
  if (!registryConfigured) {
    return (
      <Shell title={shellTitle} description={competition.metaDescription}>
        <Notice tone="amber">
          The DePrize registry isn&apos;t configured on{' '}
          <span className="font-mono">{chainSlug}</span> yet.
        </Notice>
      </Shell>
    )
  }
  if (typeof rawId === 'string' && !numericId && !goalFromSlug) {
    return (
      <Shell title={shellTitle} description={competition.metaDescription}>
        <Notice tone="amber">This prize doesn&apos;t exist.</Notice>
      </Shell>
    )
  }
  if (deprizeId === undefined) {
    return (
      <Shell title={shellTitle} description={competition.metaDescription}>
        <Notice tone="amber">Invalid DePrize id.</Notice>
      </Shell>
    )
  }
  if (error) {
    return (
      <Shell title={shellTitle} description={competition.metaDescription}>
        <Notice tone="red">Couldn&apos;t load this DePrize: {error}</Notice>
      </Shell>
    )
  }
  if (!deprize || (deprizeId !== undefined && deprize.deprizeId !== deprizeId)) {
    return (
      <Shell title={shellTitle} description={competition.metaDescription}>
        <div className="p-8 text-center text-gray-400">Loading DePrize…</div>
      </Shell>
    )
  }
  if (deprize.state === DePrizeState.NONE) {
    return (
      <Shell title={shellTitle} description={competition.metaDescription}>
        <Notice tone="amber">DePrize #{deprizeId} does not exist.</Notice>
      </Shell>
    )
  }

  // "Open" next to a live market says nothing; badge only when something is off.
  const abnormalStatus = !!bettingBlockedReason && !bettingBlockedReason.startsWith('Loading')
  const showBadge = abnormalStatus || deprize.state !== DePrizeState.OPEN
  const explorerTxBase = EXPLORER_TX[chainSlug] ?? 'https://etherscan.io/tx/'
  const hasLineage =
    deprize.state === DePrizeState.SUPERSEDED || competition.supersedes !== undefined

  return (
    <Shell title={shellTitle} description={competition.metaDescription}>
      <div className="flex flex-col gap-4 w-full max-w-[860px] mx-auto">
        {/* Header — name, id, status only when it isn't the normal OPEN state, stats. */}
        <div className={CARD}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
              <h1 className="text-white font-GoodTimes text-lg sm:text-xl">
                {knownCompetition ? competition.title : `DePrize #${deprizeId}`}
              </h1>
              {knownCompetition && (
                <span className="text-xs font-mono text-gray-500">#{deprizeId}</span>
              )}
              {showBadge && (
                <StateBadge
                  state={deprize.state}
                  labelOverride={abnormalStatus ? statusLabelOverride : undefined}
                  toneOverride={abnormalStatus ? 'amber' : undefined}
                />
              )}
            </div>
            <div className="flex items-center gap-4 shrink-0 text-sm">
              {raceGoal && (
                <Link
                  href={`/moonbase?race=${raceGoal.id}`}
                  className="text-indigo-300/90 hover:text-indigo-200 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 rounded"
                >
                  Open in Moon Base Zero
                </Link>
              )}
              <Link
                href="/deprize"
                className="text-indigo-300/90 hover:text-indigo-200 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 rounded"
              >
                ← All prizes
              </Link>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat
              label="Prize pool · to winner"
              href={launchpad.missionHref}
              title="Paid to the winning competitor when the race settles. Separate from what bettors win — bettor payouts come from the betting market."
            >
              {jbProjectId !== undefined && !isLoadingFunding ? (
                <EthUsd eth={Number(totalFunding) / Number(UNIT)} prize />
              ) : (
                '—'
              )}
            </Stat>
            <Stat
              label="Total staked"
              title="ETH bettors have put into the market. Winning shares are paid from this plus the market's seed funding."
            >
              {activity.loading && !activity.bets.length ? (
                '…'
              ) : activity.error ? (
                '—'
              ) : (
                <EthUsd eth={activity.totalStakedEth} approx />
              )}
            </Stat>
            <Stat label="Backers" title="Unique wallets that have backed a competitor.">
              {activity.loading && !activity.bets.length ? (
                '…'
              ) : activity.error ? (
                '—'
              ) : (
                <>
                  {activity.backers}
                  {activity.bets.length > 0 && (
                    <span className="ml-1.5 text-xs font-normal text-gray-500">
                      · {activity.bets.length} {activity.bets.length === 1 ? 'bet' : 'bets'}
                    </span>
                  )}
                </>
              )}
            </Stat>
            <Stat
              label="Betting closes"
              title="After this time the market can be locked and moved to winner determination. Until then, betting stays open."
            >
              {deprize.sunset > 0n ? formatBettingCloses(deprize.sunset) : '—'}
            </Stat>
          </div>
          {winningTeamId > 0n && (
            <div className="mt-3 flex items-center gap-2 flex-wrap px-3 py-2.5 rounded-xl bg-moon-green/10 border border-moon-green/35">
              <span className="text-moon-green text-xs font-semibold uppercase tracking-wide">
                Winner
              </span>
              <DePrizeTeamLink
                teamId={winningTeamId}
                teamContract={teamContract}
                size={28}
                className="text-moon-green hover:text-emerald-300 font-semibold"
              />
            </div>
          )}
          {showResolved &&
            winningTeamId === 0n &&
            (deprize.state === DePrizeState.NO_WINNER ||
              deprize.state === DePrizeState.CANCELLED ||
              deprize.state === DePrizeState.M2_FAILED) && (
              <div className="mt-3 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
                {deprize.state === DePrizeState.NO_WINNER
                  ? 'No winner — positions redeem on an equal-payout basis.'
                  : deprize.state === DePrizeState.CANCELLED
                    ? 'Cancelled — refunds are available.'
                    : 'Delivery failed after Milestone 1 — refunds are available.'}
              </div>
            )}
        </div>

        {/* Actionable status only (paused / no market / cancelling). */}
        {bettingBlockedReason && !bettingBlockedReason.startsWith('Loading') && (
          <Notice tone="amber">{bettingBlockedReason}</Notice>
        )}

        {market.error && <Notice tone="red">Couldn&apos;t load market data — reload.</Notice>}

        <DePrizeQuestionCard
          tagline={competition.tagline}
          description={raceGoal?.description}
          criteria={raceGoal?.criteria}
          moonbaseHref={raceGoal ? `/moonbase?race=${raceGoal.id}` : undefined}
        />

        {userAddress && numOutcomes > 0 && (
          <DePrizePositionPanel
            outcomes={market.outcomes}
            labels={predictionLabels}
            colors={outcomeColors}
            bets={activity.bets}
            sells={activity.sells}
            user={userAddress}
            sellQuotes={sellQuotes}
            redeemValues={redeemValues}
            resolved={showResolved}
            isRefundVector={showRefundVector}
            winningIndex={market.winningIndex}
            tradingHalted={tradingHalted}
            explorerTxBase={explorerTxBase}
            onCashOut={(i) => setExitIndex(i)}
            loading={activity.loading}
          />
        )}

        {/* Odds — the ranked cards below are the legend (same colors). */}
        {numOutcomes > 0 && (
          <div className={CARD}>
            <p className="text-white font-semibold mb-3">
              {!activity.loading && !activity.error && activity.bets.length === 0
                ? 'Starting odds — no bets yet'
                : 'Odds'}
            </p>
            <OddsHistoryChart
              history={odds.history}
              labels={predictionLabels}
              colors={outcomeColors}
              domainStartMs={market.marketStartMs}
              markers={odds.markers}
              loading={odds.loading}
            />
          </div>
        )}

        {/* Competitors, ranked by chance; Open Field last. */}
        {numOutcomes > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="title-text-colors text-lg font-GoodTimes">Competitors</h3>
            {rankedOutcomes.map((o) => {
              const teamId = deprize.teamIds[o.index] ?? 0n
              const outcomeBinding = raceBinding?.outcomes[o.index]
              const isField = !!outcomeBinding?.field
              const atlasProject =
                !isField && outcomeBinding?.projectId
                  ? projectById(SEED_ATLAS, outcomeBinding.projectId)
                  : undefined
              const atlasOrg = atlasProject
                ? orgById(SEED_ATLAS, atlasProject.orgId)
                : undefined
              const claimed = isCompetitorClaimed(outcomeBinding)
              return (
                <div id={`deprize-outcome-${o.index}`} key={o.index}>
                  <DePrizeTeamCard
                    outcome={o}
                    teamId={teamId}
                    teamContract={teamContract}
                    color={outcomeColors[o.index]}
                    loading={market.loading}
                    resolved={showResolved}
                    isRefundVector={showRefundVector}
                    isWinningSlot={showResolved && o.index === market.winningIndex}
                    bettingOpen={bettingAllowed}
                    tradingHalted={tradingHalted}
                    busy={false}
                    userConnected={!!userAddress}
                    onBet={handleBet}
                    isField={isField}
                    withdrawn={!!withdrawnByTeamId[teamId.toString()]}
                    hrefOverride={
                      outcomeBinding?.projectId
                        ? `/moonbase/${outcomeBinding.projectId}`
                        : undefined
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
                      isField || !outcomeBinding
                        ? undefined
                        : claimed
                          ? 'official'
                          : 'unofficial'
                    }
                  />
                </div>
              )
            })}
          </div>
        )}

        {(region.isRestricted || (!region.isLoading && !region.isError && !region.country)) && (
          <Notice tone="amber">
            Betting isn&apos;t available in your region. You can view odds, cash out and claim.
          </Notice>
        )}

        {/* Claim / refund */}
        {showResolved && (
          <ClaimPanel
            deprizeId={deprizeId}
            chain={chain}
            account={account}
            resolved={showResolved}
            isRefundVector={showRefundVector}
            winningTeamName={winningTeamName || undefined}
            jbProjectId={deprize.jbProjectId}
            refreshNonce={refreshNonce}
            onDone={refreshAll}
          />
        )}

        {/* Admin (renders nothing for non-admins) */}
        <DePrizeAdminPanel
          deprizeId={deprizeId}
          chain={chain}
          account={account}
          state={deprize.state}
          teamIds={deprize.teamIds}
          cancellationPending={deprize.cancellationPending}
          marketAddress={market.marketAddress}
          numOutcomes={numOutcomes}
          stage={market.stage}
          resolved={market.resolved}
          marketFeesWei={market.marketFeesWei}
          onDone={refreshAll}
        />

        {/* Lineage + roster footnote */}
        {(hasLineage || isRaceBindingComplete(raceBinding?.outcomes)) && (
          <div className="flex flex-col gap-1.5 px-1">
            {deprize.state === DePrizeState.SUPERSEDED && (
              <p className="text-xs text-amber-200/90">
                Superseded
                {competition.supersededBy ? (
                  <>
                    {' '}by{' '}
                    <Link
                      href={`/deprize/${competition.supersededBy}`}
                      className="underline underline-offset-2 hover:text-amber-100"
                    >
                      DePrize #{competition.supersededBy}
                    </Link>
                  </>
                ) : null}
                {' '}— new bets happen there. You can still sell here.
              </p>
            )}
            {competition.supersedes !== undefined && deprize.state !== DePrizeState.SUPERSEDED && (
              <p className="text-xs text-gray-500">
                Generation {generationNumber} · continues from{' '}
                <Link
                  href={`/deprize/${competition.supersedes}`}
                  className="text-indigo-300/90 underline underline-offset-2 hover:text-indigo-200"
                >
                  #{competition.supersedes}
                </Link>
              </p>
            )}
            {isRaceBindingComplete(raceBinding?.outcomes) && (
              <p className="text-[11px] text-gray-600 leading-relaxed">{ROSTER_DISCLAIMER}</p>
            )}
          </div>
        )}
      </div>

      {/* Bet modal */}
      {betIndex !== null && market.marketAddress && account && (
        <BetModal
          deprizeId={deprizeId}
          outcomeIndex={betIndex}
          teamName={predictionLabels[betIndex] || outcomeDisplayName(betIndex, raceBinding)}
          probability={market.outcomes[betIndex]?.probability ?? NaN}
          numOutcomes={numOutcomes}
          mintAddress={mintAddress}
          marketAddress={market.marketAddress}
          jbProjectId={deprize.jbProjectId}
          chain={chain}
          account={account}
          spendableEth={spendable}
          onClose={() => setBetIndex(null)}
          onDone={refreshAll}
        />
      )}

      {/* Exit modal */}
      {exitIndex !== null && market.marketAddress && account && (
        <ExitPositionModal
          deprizeId={deprizeId}
          outcomeIndex={exitIndex}
          teamName={predictionLabels[exitIndex] || outcomeDisplayName(exitIndex, raceBinding)}
          balanceWei={market.outcomes[exitIndex]?.balanceWei ?? 0n}
          positionId={market.outcomes[exitIndex]?.positionId ?? 0n}
          numOutcomes={numOutcomes}
          marketAddress={market.marketAddress}
          chain={chain}
          account={account}
          onClose={() => setExitIndex(null)}
          onDone={refreshAll}
        />
      )}
    </Shell>
  )
}

// --- Small presentational helpers ---
function Shell({
  children,
  title,
  description,
}: {
  children: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="animate-fadeIn flex flex-col items-center">
      <Head title={title} description={deprizeOgDescription(description)} />
      <Container>
        <div className="w-full max-w-[860px] mx-auto pt-6 sm:pt-8 pb-10 px-4 sm:px-5 md:px-0">
          {children}
        </div>
        <DePrizeAvailabilityLegend />
        <NoticeFooter />
      </Container>
    </div>
  )
}

function Stat({
  label,
  title,
  href,
  children,
}: {
  label: string
  title?: string
  /** When set, the whole stat is a link (e.g. Prize pool → launchpad). */
  href?: string
  children: React.ReactNode
}) {
  const body = (
    <>
      <p
        className={`text-xs ${
          href
            ? 'text-indigo-300/90 underline-offset-2 group-hover:underline'
            : title
              ? 'text-gray-400 cursor-help'
              : 'text-gray-400'
        }`}
        title={title}
      >
        {label}
      </p>
      <p
        className={`text-sm font-semibold ${
          href ? 'text-white group-hover:text-indigo-200 transition-colors' : 'text-white'
        }`}
      >
        {children}
      </p>
    </>
  )
  if (href) {
    return (
      <a
        href={href}
        title={title}
        className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
      >
        {body}
      </a>
    )
  }
  return <div>{body}</div>
}

function Notice({ tone, children }: { tone: 'amber' | 'red'; children: React.ReactNode }) {
  const cls =
    tone === 'amber'
      ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
      : 'bg-red-500/10 border-red-500/30 text-red-200'
  return <div className={`p-4 rounded-2xl border text-sm ${cls}`}>{children}</div>
}
