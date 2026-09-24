import type { GetServerSideProps } from 'next'
import DePrizeRegistryABI from 'const/abis/DePrizeRegistry.json'
import LMSRWithTWAP from 'const/abis/LMSRWithTWAP.json'
import TeamABI from 'const/abis/Team.json'
import {
  DEPRIZE_MINT_ADDRESSES,
  DEPRIZE_REGISTRY_ADDRESSES,
  TEAM_ADDRESSES,
} from 'const/config'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { eth_getBalance, getRpcClient } from 'thirdweb/rpc'
import {
  ROSTER_DISCLAIMER,
  deprizeChainLabel,
  deprizePrefixedHref,
  findDePrizeChainSlugs,
  findDePrizeIdForGoal,
  getDePrizeCompetition,
  getDePrizeRaceBinding,
  isCompetitorClaimed,
  isKnownDePrizeCompetition,
  isRaceBindingComplete,
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
import { useDePrizeMarket } from '@/lib/deprize/useDePrizeMarket'
import { useOddsHistory } from '@/lib/deprize/useOddsHistory'
import { DePrizeRestrictedProvider } from '@/lib/deprize/deprizeRestrictedContext'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import useTotalFunding from '@/lib/juicebox/useTotalFunding'
import { getChainSlug, v4SlugToV5Chain } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'
import Container from '@/components/layout/Container'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import BetModal from '@/components/deprize/BetModal'
import DePrizeQuestionCard from '@/components/deprize/DePrizeQuestionCard'
import ClaimPanel from '@/components/deprize/ClaimPanel'
import AdminSection from '@/components/deprize/detail/AdminSection'
import ClaimSection from '@/components/deprize/detail/ClaimSection'
import ForecastSlot from '@/components/deprize/detail/ForecastSlot'
import OddsSection from '@/components/deprize/detail/OddsSection'
import PositionSection from '@/components/deprize/detail/PositionSection'
import PrizeHeader from '@/components/deprize/detail/PrizeHeader'
import PrizePoolSlot from '@/components/deprize/detail/PrizePoolSlot'
import ProvenanceFooter from '@/components/deprize/detail/ProvenanceFooter'
import { Notice, NoticeStack, type NoticeItem } from '@/components/deprize/detail/primitives'
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

function prizeQuestion(tagline: string): string {
  // Taglines carry a trailing call to action after the question mark.
  const q = tagline.indexOf('?')
  return (q >= 0 ? tagline.slice(0, q + 1) : tagline).trim()
}

function outcomeDisplayName(
  index: number,
  raceBinding: ReturnType<typeof getDePrizeRaceBinding>
): string {
  const binding = raceBinding?.outcomes[index]
  if (binding?.field) return 'Other'
  if (binding?.vehicleLabel) return binding.vehicleLabel
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
  // `/deprize/sep/2` and `/deprize/arb/1` name the registry in the path. The app
  // shell also selects that network on load so a refresh does not fall back to
  // the build default. Prize reads still use the path if the header is changed.
  const forcedSlug =
    router.pathname === '/deprize/sep/[id]'
      ? 'sepolia'
      : router.pathname === '/deprize/arb/[id]'
        ? 'arbitrum'
        : undefined
  const forcedChain = forcedSlug ? v4SlugToV5Chain(forcedSlug) : undefined
  const rawId = router.query.id
  const numericId =
    typeof rawId === 'string' && /^\d+$/.test(rawId) ? Number(rawId) : undefined
  const goalFromSlug =
    typeof rawId === 'string' && !/^\d+$/.test(rawId)
      ? sharedGoalById(SEED_ATLAS, rawId)
      : undefined
  const { selectedChain } = useContext(ChainContextV5)
  const chain = forcedChain ?? selectedChain
  const chainSlug = getChainSlug(chain)
  const boundFromSlug = goalFromSlug
    ? findDePrizeIdForGoal(chainSlug, goalFromSlug.id)
    : undefined
  const deprizeId = numericId ?? boundFromSlug

  // Prefixed routes pin the registry. Otherwise follow the wallet / header chain.
  const competition = getDePrizeCompetition(chainSlug, deprizeId)
  const raceBinding = getDePrizeRaceBinding(chainSlug, deprizeId)
  const raceGoal = raceBinding ? sharedGoalById(SEED_ATLAS, raceBinding.sharedGoalId) : undefined
  const knownCompetition = isKnownDePrizeCompetition(chainSlug, deprizeId)
  const account = useActiveAccount()
  const userAddress = account?.address

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

  // Clicking a competitor opens the prediction window. Connecting and betting
  // happen inside that window.
  const handleBet = useCallback((index: number) => {
    setBetIndex(index)
  }, [])

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
    onrampQueryActive,
  ])

  const [forecastHashHandled, setForecastHashHandled] = useState(false)
  useEffect(() => {
    if (forecastHashHandled || !router.isReady) return
    if (typeof window === 'undefined') return
    if (window.location.hash !== '#deprize-forecast') return
    const el = document.getElementById('deprize-forecast')
    if (!el) return
    setForecastHashHandled(true)
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [forecastHashHandled, router.isReady, deprize, numOutcomes])

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

  // Everyone who put ETH behind an outcome. They belong on the callers list
  // next to the Citizens who wrote a prediction.
  const bettorAddresses = useMemo(
    () => [...new Set(activity.bets.map((bet) => bet.bettor.toLowerCase()))],
    [activity.bets],
  )

  const resolvedVector = useMemo(() => {
    if (!market.payoutDen || market.payoutDen <= 0n) return null
    const den = Number(market.payoutDen)
    if (!Number.isFinite(den) || den <= 0) return null
    return market.outcomes.map((outcome) => {
      const num = Number(market.payoutNums[outcome.index] ?? 0n)
      return Number.isFinite(num) ? num / den : 0
    })
  }, [market.payoutDen, market.payoutNums, market.outcomes])

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

  const pageNotices = useMemo<NoticeItem[]>(() => {
    const items: NoticeItem[] = []
    if (market.error) {
      items.push({
        id: 'market-error',
        tone: 'red',
        priority: 0,
        body: "Couldn't load market data — reload.",
      })
    }
    const notice = onrampReturn.notice
    if (notice?.kind === 'wrong-wallet') {
      items.push({
        id: 'onramp-wrong-wallet',
        tone: 'amber',
        priority: 1,
        body: `Connect the wallet you funded (${notice.fundedAddress}) to continue. The ETH is in that wallet.`,
      })
    } else if (notice?.kind === 'connect-wallet') {
      items.push({
        id: 'onramp-connect',
        tone: 'amber',
        priority: 2,
        body: 'Connect the wallet you funded to continue.',
      })
    } else if (notice?.kind === 'market-closed') {
      items.push({
        id: 'onramp-closed',
        tone: 'amber',
        priority: 3,
        body: notice.message,
      })
    }
    return items
  }, [market.error, onrampReturn.notice])

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
  // Unprefixed `/deprize/1` is Arbitrum's Harsh Mistress and Sepolia's Touchdown.
  // A prefixed path already picked a registry; otherwise ask, so a refresh on
  // the default chain does not open the other prize.
  if (!forcedSlug && numericId !== undefined) {
    const chains = findDePrizeChainSlugs(numericId)
    if (chains.length > 1) {
      const search = router.asPath.replace(/^[^?#]*/, '')
      return (
        <Shell
          title={`DePrize #${numericId}`}
          description={`DePrize #${numericId} is registered on more than one network.`}
        >
          <Notice tone="amber">
            DePrize #{numericId} is on{' '}
            {chains.map((slug, i) => (
              <span key={slug}>
                {i > 0 ? ' and ' : ''}
                <Link
                  href={`${deprizePrefixedHref(slug, numericId)}${search}`}
                  className="underline underline-offset-2 hover:text-amber-100"
                >
                  {deprizeChainLabel(slug)}
                </Link>
              </span>
            ))}
            .
          </Notice>
        </Shell>
      )
    }
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
    const elsewhere = findDePrizeChainSlugs(deprizeId).filter((slug) => slug !== chainSlug)
    return (
      <Shell title={shellTitle} description={competition.metaDescription}>
        <Notice tone="amber">
          {elsewhere.length === 0 ? (
            <>DePrize #{deprizeId} does not exist.</>
          ) : (
            <>
              DePrize #{deprizeId} is on{' '}
              {elsewhere.map((slug, i) => (
                <span key={slug}>
                  {i > 0 ? ' and ' : ''}
                  <Link
                    href={deprizePrefixedHref(slug, deprizeId)}
                    className="underline underline-offset-2 hover:text-amber-100"
                  >
                    {deprizeChainLabel(slug)}
                  </Link>
                </span>
              ))}
              .
            </>
          )}
        </Notice>
      </Shell>
    )
  }

  // "Open" next to a live market says nothing; badge only when something is off.
  const abnormalStatus = !!bettingBlockedReason && !bettingBlockedReason.startsWith('Loading')
  const showBadge = abnormalStatus || deprize.state !== DePrizeState.OPEN
  const explorerTxBase = EXPLORER_TX[chainSlug] ?? 'https://etherscan.io/tx/'
  const hasLineage = deprize.state === DePrizeState.SUPERSEDED

  return (
    <Shell title={shellTitle} description={competition.metaDescription}>
      <div className="flex flex-col gap-4 w-full lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <div className="flex flex-col gap-4 min-w-0 lg:col-start-1 lg:row-start-1">
        <PrizeHeader
          knownCompetition={knownCompetition}
          title={competition.title}
          deprizeId={deprizeId}
          showBadge={showBadge}
          state={deprize.state}
          statusLabelOverride={statusLabelOverride}
          badgeTitle={abnormalStatus ? bettingBlockedReason : undefined}
          abnormalStatus={abnormalStatus}
          raceGoal={raceGoal}
          winningTeamId={winningTeamId}
          teamContract={teamContract}
          showResolved={showResolved}
        />
        <OddsSection
          numOutcomes={numOutcomes}
          question={prizeQuestion(competition.tagline)}
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
        <NoticeStack items={pageNotices} />
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
        <ForecastSlot
          chainSlug={chainSlug}
          deprizeId={deprizeId as number}
          labels={predictionLabels}
          marketPercents={market.outcomes.map((o) => o.probability)}
          liveTipId={resolveLiveDePrizeId(chainSlug, deprizeId)}
          reported={!!market.payoutDen && market.payoutDen > 0n}
          resolvedVector={resolvedVector}
          numOutcomes={numOutcomes}
          rankedOutcomes={rankedOutcomes}
          teamIds={deprize.teamIds}
          raceBinding={raceBinding}
          teamContract={teamContract}
          outcomeColors={outcomeColors}
          // `loading` flips on wallet connect and the post-bet refresh, after the
          // payout read has already settled. Lock only until that denominator
          // is known, or Predict no-ops and the citizen forecast is never saved.
          marketLoading={market.marketConfigured && !market.payoutSettled}
          showResolved={showResolved}
          isRefundVector={showRefundVector}
          winningIndex={market.winningIndex}
          bettingOpen={bettingAllowed}
          tradingHalted={tradingHalted}
          userAddress={userAddress}
          withdrawnByTeamId={withdrawnByTeamId}
          onBet={handleBet}
          modalIndex={betIndex}
          onModalClose={() => setBetIndex(null)}
          resumeBet={onrampReturn.betIndex != null && betIndex === onrampReturn.betIndex}
          renderBet={
            account && market.marketAddress
              ? ({ index, onClose, onPlaced }) => (
                  <BetModal
                    embedded
                    deprizeId={deprizeId}
                    outcomeIndex={index}
                    teamName={
                      predictionLabels[index] || outcomeDisplayName(index, raceBinding)
                    }
                    probability={market.outcomes[index]?.probability ?? NaN}
                    numOutcomes={numOutcomes}
                    mintAddress={mintAddress}
                    marketAddress={market.marketAddress!}
                    jbProjectId={deprize.jbProjectId}
                    chain={chain}
                    account={account}
                    spendableEth={spendable}
                    initialAmountEth={onrampReturn.prefillEth}
                    fundsArrived={onrampReturn.fundsArrived}
                    onClose={onClose}
                    onDone={() => {
                      onPlaced()
                      refreshAll()
                    }}
                  />
                )
              : undefined
          }
        />
        <DePrizeQuestionCard
          description={raceGoal?.description}
          criteria={raceGoal?.criteria}
        />
        {isRaceBindingComplete(raceBinding?.outcomes) && (
          <p className="text-[11px] text-gray-600 leading-relaxed px-1">{ROSTER_DISCLAIMER}</p>
        )}
        </div>
        {/* A sticky column taller than the viewport hides its own bottom, and
            the patron and caller lists have no fixed length — so it scrolls. */}
        <aside className="min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:overscroll-contain">
        <PrizePoolSlot
          poolUsd={poolUsd}
          asOf={poolAsOf}
          poolEth={
            jbProjectId !== undefined && !isLoadingFunding
              ? Number(totalFunding) / Number(UNIT)
              : null
          }
          volumeEth={
            activity.error || (activity.loading && activity.bets.length === 0)
              ? null
              : activity.totalStakedEth
          }
          deprizeId={deprizeId}
          jbProjectId={jbProjectId}
          prizeTitle={competition.title}
          chain={chain}
          account={account}
          refreshNonce={refreshNonce}
          onFunded={refreshAll}
          labels={predictionLabels}
          bettorAddresses={bettorAddresses}
        />
        </aside>
        <div className="flex flex-col gap-4 min-w-0 lg:col-start-1 lg:row-start-2">
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
          chainSlug={chainSlug}
          state={deprize.state}
          supersededBy={competition.supersededBy}
        />
        </div>
      </div>

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
        <div className="w-full max-w-6xl mx-auto pt-6 sm:pt-8 pb-10 px-4 sm:px-5 md:px-0">
          {children}
        </div>
        <NoticeFooter />
      </Container>
    </div>
  )
}

