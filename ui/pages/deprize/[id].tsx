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
import { useRouter } from 'next/router'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { eth_getBalance, getRpcClient } from 'thirdweb/rpc'
import {
  CAPABILITY_LADDER_SPEC_HREF,
  getLadderForCompetition,
} from '@/lib/deprize/capabilityLadder'
import {
  findDePrizeIdForGoal,
  getDePrizeCompetition,
  getDePrizeGenerationNumber,
  getDePrizeRaceBinding,
  isKnownDePrizeCompetition,
  resolveLiveDePrizeId,
} from '@/lib/deprize/competitions'
import {
  resolveDePrizePageProps,
  type DePrizePageProps,
} from '@/lib/deprize/pageEligibility'
import { SEED_ATLAS, orgById, projectById, sharedGoalById } from '@/lib/lunar-atlas'
import GoalDePrizeDetail from '@/components/deprize/GoalDePrizeDetail'
import { orgColor } from '@/lib/lunar-atlas/display'
import {
  DePrizeState,
  MarketStage,
  OUTCOME_COLORS,
  positionRedeemValue,
  shouldSurfaceResolution,
  UNIT,
  deprizeOgDescription,
} from '@/lib/deprize/constants'
import { spendableFromBalanceEth } from '@/lib/deprize/gas-reserve'
import { marketAcceptsBets } from '@/lib/deprize/marketGates'
import { parseOnrampReturn } from '@/lib/deprize/onrampReturn'
import { DEPRIZE_MAX_BET_WEI } from '@/lib/deprize/positionCap'
import { useDePrizeOnrampReturn } from '@/lib/deprize/useDePrizeOnrampReturn'
import { buildAmounts } from '@/lib/deprize/quote'
import { rankOutcomes } from '@/lib/deprize/rank-outcomes'
import { deprizeReadChain, deprizeReadClient, rpcRead } from '@/lib/deprize/read'
import { isMintConfigured, reconcileBettingStatus } from '@/lib/deprize/status'
import { useDePrize } from '@/lib/deprize/useDePrize'
import { useDePrizeActivity } from '@/lib/deprize/useDePrizeActivity'
import { useDePrizeLaunchpadToken } from '@/lib/deprize/useDePrizeLaunchpad'
import { useDePrizeMarket } from '@/lib/deprize/useDePrizeMarket'
import { useOddsHistory } from '@/lib/deprize/useOddsHistory'
import DePrizeAvailabilityLegend from '@/components/deprize/DePrizeAvailabilityLegend'
import { DePrizeRestrictedProvider } from '@/lib/deprize/deprizeRestrictedContext'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import useTotalFunding from '@/lib/juicebox/useTotalFunding'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'
import Container from '@/components/layout/Container'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import BetModal from '@/components/deprize/BetModal'
import ClaimPanel from '@/components/deprize/ClaimPanel'
import AdminSection from '@/components/deprize/detail/AdminSection'
import ClaimSection from '@/components/deprize/detail/ClaimSection'
import CompetitorsSection from '@/components/deprize/detail/CompetitorsSection'
import ForecastSlot from '@/components/deprize/detail/ForecastSlot'
import MarketErrorNotice from '@/components/deprize/detail/MarketErrorNotice'
import OddsSection from '@/components/deprize/detail/OddsSection'
import PositionSection from '@/components/deprize/detail/PositionSection'
import PrizeHeader from '@/components/deprize/detail/PrizeHeader'
import PrizePoolSlot from '@/components/deprize/detail/PrizePoolSlot'
import PrizeQuestion from '@/components/deprize/detail/PrizeQuestion'
import ProvenanceFooter from '@/components/deprize/detail/ProvenanceFooter'
import RegionBanner from '@/components/deprize/detail/RegionBanner'
import { Notice } from '@/components/deprize/detail/primitives'
import {
  useDePrizeTeamName,
  useDePrizeTeamNames,
} from '@/components/deprize/DePrizeTeamLink'
import ExitPositionModal from '@/components/deprize/ExitPositionModal'

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

export default function DePrizeDetailPage({ restricted }: DePrizePageProps) {
  return (
    <DePrizeRestrictedProvider restricted={restricted}>
      <DePrizeDetailContent restricted={restricted} />
    </DePrizeRestrictedProvider>
  )
}

export const getServerSideProps: GetServerSideProps<DePrizePageProps> = async ({
  req,
  res,
}) => resolveDePrizePageProps(req, res)

function DePrizeDetailContent({ restricted }: DePrizePageProps) {
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

  // Pass a plain number: useRead JSON.stringify's its params for memoization,
  // which throws on bigint. JB project ids are small, so Number() is safe.
  // useTotalFunding returns BigInt(0) for a missing projectId / while reads are
  // in flight, so gate the display on a real project id and !isLoading.
  // Read Juicebox on the same chain as the DePrize registry (jbTerminal.pay
  // settles on-chain with the mint router), not the build-time default.
  const jbProjectId = deprize && deprize.jbProjectId > 0n ? Number(deprize.jbProjectId) : undefined
  const { totalFunding, isLoading: isLoadingFunding } = useTotalFunding(jbProjectId, chain)
  const { ethPrice } = useETHPrice(1)
  const poolUsd = useMemo(() => {
    if (jbProjectId === undefined || isLoadingFunding || ethPrice == null) return null
    const eth = Number(totalFunding) / Number(UNIT)
    if (!Number.isFinite(eth)) return null
    return eth * ethPrice
  }, [jbProjectId, isLoadingFunding, totalFunding, ethPrice])
  const poolAsOf = useMemo(() => {
    if (ethPrice == null) return null
    return new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
  }, [ethPrice])
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
  const acceptsBets = marketAcceptsBets({
    bettingOpen: !!deprize?.bettingOpen,
    mintBound: market.mintBound,
    mintConfigured,
    tradingHalted,
    stage: market.stage,
  })
  // Default-deny when country is unknown: the SSR `restricted` prop is true
  // when the country header is missing (getDePrizePageEligibility).
  // Onramp return bypasses only the restricted term; market terms stay.
  const bettingAllowed = acceptsBets && !restricted
  const onrampReturn = useDePrizeOnrampReturn({
    userAddress,
    numOutcomes,
    marketLoading: market.loading,
    acceptsBets,
    spendableEthNow: spendable,
    capEth: Number(DEPRIZE_MAX_BET_WEI) / Number(UNIT),
  })
  const onrampQueryActive = parseOnrampReturn(router.query).active

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
    if (onrampReturn.betIndex != null) setBetIndex(onrampReturn.betIndex)
  }, [onrampReturn.betIndex])

  useEffect(() => {
    if (deepLinkHandled || !router.isReady || numOutcomes <= 0) return
    if (onrampQueryActive) return
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
    onrampQueryActive,
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
        <PrizeHeader
          knownCompetition={knownCompetition}
          title={competition.title}
          deprizeId={deprizeId}
          showBadge={showBadge}
          state={deprize.state}
          statusLabelOverride={statusLabelOverride}
          abnormalStatus={abnormalStatus}
          raceGoal={raceGoal}
          jbProjectId={jbProjectId}
          isLoadingFunding={isLoadingFunding}
          totalFunding={totalFunding}
          launchpadMissionHref={launchpad.missionHref}
          activityLoading={activity.loading}
          activityError={activity.error}
          betsLength={activity.bets.length}
          totalStakedEth={activity.totalStakedEth}
          backers={activity.backers}
          sunset={deprize.sunset}
          winningTeamId={winningTeamId}
          teamContract={teamContract}
          showResolved={showResolved}
        />
        <RegionBanner
          restricted={restricted}
          bettingBlockedReason={bettingBlockedReason}
        >
          Betting isn&apos;t available in your region. You can view odds, cash out and claim.
        </RegionBanner>
        {onrampReturn.notice?.kind === 'wrong-wallet' && (
          <Notice tone="amber">
            Connect the wallet you funded ({onrampReturn.notice.fundedAddress}) to continue. The ETH
            is in that wallet.
          </Notice>
        )}
        {onrampReturn.notice?.kind === 'connect-wallet' && (
          <Notice tone="amber">Connect the wallet you funded to continue.</Notice>
        )}
        {onrampReturn.notice?.kind === 'market-closed' && (
          <Notice tone="amber">{onrampReturn.notice.message}</Notice>
        )}
        <MarketErrorNotice error={market.error} />
        <PrizeQuestion
          tagline={competition.tagline}
          description={raceGoal?.description}
          criteria={raceGoal?.criteria}
          moonbaseHref={raceGoal ? `/moonbase?race=${raceGoal.id}` : undefined}
        />
        {(() => {
          const ladder = getLadderForCompetition(chainSlug, deprizeId)
          const current = ladder.rungs.find((r) => r.current)
          if (!ladder.currentKey || !current) return null
          return (
            <p className="text-sm text-gray-300">
              Rung {current.rung} of {ladder.rungs.length} · {current.label} — {current.bar} ·{' '}
              <a
                href={CAPABILITY_LADDER_SPEC_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-300/90 underline-offset-2 hover:underline hover:text-indigo-200"
              >
                Read the capability ladder →
              </a>
            </p>
          )
        })()}
        <PositionSection
          userAddress={userAddress}
          numOutcomes={numOutcomes}
          outcomes={market.outcomes}
          labels={predictionLabels}
          colors={outcomeColors}
          bets={activity.bets}
          sells={activity.sells}
          sellQuotes={sellQuotes}
          redeemValues={redeemValues}
          showResolved={showResolved}
          isRefundVector={showRefundVector}
          winningIndex={market.winningIndex}
          tradingHalted={tradingHalted}
          explorerTxBase={explorerTxBase}
          onCashOut={(i) => setExitIndex(i)}
          loading={activity.loading}
        />
        <OddsSection
          numOutcomes={numOutcomes}
          activityLoading={activity.loading}
          activityError={activity.error}
          betsLength={activity.bets.length}
          history={odds.history}
          labels={predictionLabels}
          colors={outcomeColors}
          domainStartMs={market.marketStartMs}
          markers={odds.markers}
          oddsLoading={odds.loading}
        />
        <CompetitorsSection
          numOutcomes={numOutcomes}
          rankedOutcomes={rankedOutcomes}
          teamIds={deprize.teamIds}
          raceBinding={raceBinding}
          teamContract={teamContract}
          outcomeColors={outcomeColors}
          marketLoading={market.loading}
          showResolved={showResolved}
          isRefundVector={showRefundVector}
          winningIndex={market.winningIndex}
          bettingOpen={bettingAllowed}
          tradingHalted={tradingHalted}
          userAddress={userAddress}
          withdrawnByTeamId={withdrawnByTeamId}
          onBet={handleBet}
        />
        <ForecastSlot
          chainSlug={chainSlug}
          deprizeId={deprizeId as number}
          labels={predictionLabels}
          marketPercents={market.outcomes.map((o) => o.probability)}
          liveTipId={resolveLiveDePrizeId(chainSlug, deprizeId)}
          reported={!!market.payoutDen && market.payoutDen > 0n}
        />
        <PrizePoolSlot
          poolUsd={poolUsd}
          asOf={poolAsOf}
          poolEth={
            jbProjectId !== undefined && !isLoadingFunding
              ? Number(totalFunding) / Number(UNIT)
              : null
          }
          deprizeId={deprizeId}
          jbProjectId={jbProjectId}
          prizeTitle={competition.title}
          chain={chain}
          account={account}
          refreshNonce={refreshNonce}
          onFunded={refreshAll}
        />
        <ClaimSection>
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
        </ClaimSection>
        <AdminSection
          deprizeId={deprizeId as number}
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
        <ProvenanceFooter
          hasLineage={hasLineage}
          raceBinding={raceBinding}
          state={deprize.state}
          supersededBy={competition.supersededBy}
          supersedes={competition.supersedes}
          generationNumber={generationNumber}
        />
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
          initialAmountEth={onrampReturn.prefillEth}
          fundsArrived={onrampReturn.fundsArrived}
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

