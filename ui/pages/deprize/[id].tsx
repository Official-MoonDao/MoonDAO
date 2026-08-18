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
  getDePrizeCompetition,
  getDePrizeGenerationNumber,
  getDePrizeRaceBinding,
  isCompetitorClaimed,
  isKnownDePrizeCompetition,
  isRaceBindingComplete,
} from '@/lib/deprize/competitions'
import { SEED_ATLAS, orgById, projectById } from '@/lib/lunar-atlas'
import { orgColor } from '@/lib/lunar-atlas/display'
import {
  DePrizeState,
  DEPRIZE_STATE_META,
  GAS_RESERVE_ETH,
  MarketStage,
  OUTCOME_COLORS,
  positionRedeemValue,
  shouldSurfaceResolution,
  UNIT,
} from '@/lib/deprize/constants'
import { fmt, fmtPrizeEth } from '@/lib/deprize/format'
import { buildAmounts } from '@/lib/deprize/quote'
import { deprizeReadChain, deprizeReadClient, rpcRead } from '@/lib/deprize/read'
import { formatBettingCloses, isMintConfigured, reconcileBettingStatus } from '@/lib/deprize/status'
import { useDePrize } from '@/lib/deprize/useDePrize'
import { useDePrizeLaunchpadToken } from '@/lib/deprize/useDePrizeLaunchpad'
import { useDePrizeMarket } from '@/lib/deprize/useDePrizeMarket'
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
import DePrizeComingSoon from '@/components/deprize/DePrizeComingSoon'
import DePrizeTeamCard from '@/components/deprize/DePrizeTeamCard'
import DePrizeTeamLink, { useDePrizeTeamName } from '@/components/deprize/DePrizeTeamLink'
import ExitPositionModal from '@/components/deprize/ExitPositionModal'

const OddsHistoryChart = dynamic(() => import('@/components/deprize/OddsHistoryChart'), {
  ssr: false,
})

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

export default function DePrizeDetailPage() {
  const { selectedChain } = useContext(ChainContextV5)
  // AUDIT[plan Phase 6.3]: keep the coming-soon gate until Phase 5 verify is
  // green and DEPRIZE_* arbitrum addresses are filled in const/config.ts.
  if (getChainSlug(selectedChain) === 'arbitrum') {
    return <DePrizeComingSoon />
  }
  return <DePrizeDetailContent />
}

function DePrizeDetailContent() {
  const router = useRouter()
  const rawId = router.query.id
  const deprizeId = typeof rawId === 'string' && /^\d+$/.test(rawId) ? Number(rawId) : undefined

  // Follow the app's live selected chain (wallet / header dropdown), not the
  // build-time default — otherwise switching networks never re-queries DePrize.
  const { selectedChain: chain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(chain)
  const competition = getDePrizeCompetition(chainSlug, deprizeId)
  const raceBinding = getDePrizeRaceBinding(chainSlug, deprizeId)
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

  const [refreshNonce, setRefreshNonce] = useState(0)
  const [nativeBalance, setNativeBalance] = useState<number | undefined>()
  const [sellQuotes, setSellQuotes] = useState<Map<number, number>>(new Map())
  const [costBasis, setCostBasis] = useState<Record<number, number>>({})
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

  // Cost basis (per market + wallet) for profit display.
  const costStorageKey = useMemo(
    () =>
      market.marketAddress && userAddress
        ? `deprize:costBasis:v1:${market.marketAddress}:${userAddress}`
        : null,
    [market.marketAddress, userAddress],
  )
  useEffect(() => {
    if (!costStorageKey || typeof window === 'undefined') {
      setCostBasis({})
      return
    }
    try {
      const raw = window.localStorage.getItem(costStorageKey)
      setCostBasis(raw ? (JSON.parse(raw) as Record<number, number>) : {})
    } catch {
      setCostBasis({})
    }
  }, [costStorageKey])
  const persistCostBasis = useCallback(
    (next: Record<number, number>) => {
      if (costStorageKey && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(costStorageKey, JSON.stringify(next))
        } catch {
          /* ignore */
        }
      }
    },
    [costStorageKey],
  )
  const addCostBasis = useCallback(
    (index: number, deltaEth: number) => {
      setCostBasis((prev) => {
        const next = { ...prev, [index]: Math.max(0, (prev[index] ?? 0) + deltaEth) }
        persistCostBasis(next)
        return next
      })
    },
    [persistCostBasis],
  )
  const resetCostBasis = useCallback(
    (index: number) => {
      setCostBasis((prev) => {
        const next = { ...prev, [index]: 0 }
        persistCostBasis(next)
        return next
      })
    },
    [persistCostBasis],
  )
  const clearCostBasis = useCallback(() => {
    setCostBasis({})
    if (costStorageKey && typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(costStorageKey)
      } catch {
        /* ignore */
      }
    }
  }, [costStorageKey])

  const refreshAll = useCallback(() => {
    market.refresh()
    refreshRegistry()
    setRefreshNonce((n) => n + 1)
    setTimeout(() => {
      market.refresh()
      refreshRegistry()
      setRefreshNonce((n) => n + 1)
    }, 2500)
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
            return [o.index, Number(-net) / Number(UNIT)] as [number, number]
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

  const spendable = Math.max(0, (nativeBalance ?? 0) - GAS_RESERVE_ETH)
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

  // Moon Base Zero "Back this team" deep-links here with ?outcome=N.
  useEffect(() => {
    if (!router.isReady || numOutcomes <= 0) return
    const raw = router.query.outcome
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return
    const idx = Number(raw)
    if (idx < 0 || idx >= numOutcomes) return
    const el = document.getElementById(`deprize-outcome-${idx}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (userAddress && bettingAllowed) setBetIndex(idx)
  }, [
    router.isReady,
    router.query.outcome,
    numOutcomes,
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

  const { effectiveDescription, statusLabelOverride } = deprize
    ? reconcileBettingStatus({
        bettingOpen: deprize.bettingOpen,
        marketStage: market.stage,
        mintConfigured: mintConfigured && market.mintBound,
        registryState: deprize.state,
        marketBound,
      })
    : { effectiveDescription: undefined, statusLabelOverride: undefined }

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

  const shellTitle =
    knownCompetition && deprizeId !== undefined
      ? `DePrize #${deprizeId} — ${competition.title}`
      : deprizeId !== undefined
        ? `DePrize #${deprizeId}`
        : competition.title

  // --- Render states ---
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
  if (!router.isReady) {
    return (
      <Shell title={shellTitle} description={competition.metaDescription}>
        <div className="p-8 text-center text-gray-400">Loading DePrize…</div>
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

  return (
    <Shell title={shellTitle} description={competition.metaDescription}>
      <div className="flex flex-col gap-6 w-full max-w-[860px] mx-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 backdrop-blur-xl border border-white/[0.08] shadow-lg">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
              <h1 className="text-white font-GoodTimes text-lg sm:text-xl">
                {knownCompetition
                  ? `DePrize #${deprizeId} — ${competition.title}`
                  : `DePrize #${deprizeId}`}
              </h1>
              {deprize && (
                <StateBadge
                  state={deprize.state}
                  labelOverride={statusLabelOverride}
                  toneOverride={statusLabelOverride ? 'amber' : undefined}
                />
              )}
              {knownCompetition && generationNumber > 1 && (
                <span className="px-3 py-1 rounded-full text-xs font-medium border bg-white/10 text-gray-200 border-white/20">
                  Generation {generationNumber}
                </span>
              )}
            </div>
            <Link
              href="/deprize"
              className="shrink-0 text-sm text-indigo-300/90 hover:text-indigo-200 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 rounded"
            >
              ← All prizes
            </Link>
          </div>
          <p className="text-gray-300 text-sm mt-2">{competition.tagline}</p>
          {deprize?.state === DePrizeState.SUPERSEDED && (
            <p className="text-amber-200/90 text-sm mt-2">
              This generation was superseded
              {competition.supersededBy
                ? ` by DePrize #${competition.supersededBy}`
                : ''}
              . New bets are closed; you can still sell your position at the market price. Odds for
              this race live on the current generation.
              {competition.supersededBy && (
                <>
                  {' '}
                  <Link
                    href={`/deprize/${competition.supersededBy}`}
                    className="underline underline-offset-2 hover:text-amber-100"
                  >
                    Open generation {generationNumber + 1}
                  </Link>
                </>
              )}
            </p>
          )}
          {competition.supersedes !== undefined && deprize?.state !== DePrizeState.SUPERSEDED && (
            <p className="text-gray-500 text-xs mt-2">
              Continues from{' '}
              <Link
                href={`/deprize/${competition.supersedes}`}
                className="text-indigo-300/90 underline underline-offset-2 hover:text-indigo-200"
              >
                generation {generationNumber - 1} (DePrize #{competition.supersedes})
              </Link>
              . Legacy positions remain sellable there until the race settles.
            </p>
          )}
          {effectiveDescription && (
            <p className="text-gray-500 text-sm mt-1">{effectiveDescription}</p>
          )}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat
              label="Prize pool"
              href={launchpad.missionHref}
              title={launchpad.missionHref ? 'Open the launchpad prize pool' : undefined}
            >
              {jbProjectId !== undefined && !isLoadingFunding
                ? `${fmtPrizeEth(Number(totalFunding) / Number(UNIT))} ETH`
                : '—'}
            </Stat>
            <Stat label="Providers">{numOutcomes || '—'}</Stat>
            <Stat
              label="Betting closes"
              title="After this time the market can be locked and moved to winner determination. Until then, betting stays open."
            >
              {deprize && deprize.sunset > 0n ? formatBettingCloses(deprize.sunset) : '—'}
            </Stat>
          </div>
          {winningTeamId > 0n && (
            <div className="mt-4 flex items-center gap-2 flex-wrap px-3 py-2.5 rounded-xl bg-moon-green/10 border border-moon-green/35">
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
              <div className="mt-4 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
                {deprize.state === DePrizeState.NO_WINNER
                  ? 'No winner — positions redeem on an equal-payout basis.'
                  : deprize.state === DePrizeState.CANCELLED
                    ? 'Cancelled — refunds are available.'
                    : 'Delivery failed after Milestone 1 — refunds are available.'}
              </div>
            )}
        </div>

        {/* Cancellation notice */}
        {deprize?.cancellationPending && (
          <Notice tone="red">
            A cancellation has been announced for this DePrize. New bets are paused during the 7-day
            notice window. If the cancellation goes through, all positions are refunded.
          </Notice>
        )}

        {/* Geo notice — also when country is unresolved (default-deny). */}
        {(region.isRestricted || (!region.isLoading && !region.isError && !region.country)) && (
          <Notice tone="amber">
            Betting isn&apos;t available in your region. You can still view live odds and, if you
            hold a position, claim or cash out.
          </Notice>
        )}

        {/* Live odds */}
        {numOutcomes > 0 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 backdrop-blur-xl border border-white/[0.08] shadow-lg">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div>
                <p className="text-white font-semibold">Live odds</p>
                <p className="text-gray-500 text-xs">Implied chance over time</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {market.outcomes.map((o) => (
                  <div key={o.index} className="flex items-center gap-1.5">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ background: OUTCOME_COLORS[o.index % OUTCOME_COLORS.length] }}
                    />
                    <span className="text-gray-300 text-xs">
                      #{o.index + 1}
                      {Number.isNaN(o.probability) ? '' : ` · ${fmt(o.probability, 0)}%`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <OddsHistoryChart
              history={market.oddsHistory}
              labels={market.outcomes.map((o) => `Team #${o.index + 1}`)}
              colors={OUTCOME_COLORS}
              domainStartMs={market.marketStartMs}
            />
            {market.marketStartMs !== undefined && (
              <p className="text-gray-500 text-[11px] mt-2">
                Axis spans the market since it opened
                {` (${new Date(market.marketStartMs).toLocaleDateString()})`}. Detailed odds samples
                collect while this page is open.
              </p>
            )}
          </div>
        )}

        {/* Connect prompt */}
        {!userAddress && bettingAllowed && (
          <div className="p-4 sm:p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-indigo-100 text-sm font-medium">
              Connect a wallet to back a team, cash out, or claim.
            </p>
            <button
              onClick={() => login()}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm font-semibold transition-all"
            >
              Connect Wallet
            </button>
          </div>
        )}

        {/* Market load error (non-fatal) */}
        {market.error && (
          <Notice tone="red">
            Couldn&apos;t fully load market data: {market.error}. Reload the page and try again.
          </Notice>
        )}

        {/* Team cards */}
        {numOutcomes > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="title-text-colors text-lg font-GoodTimes">Providers</h3>
            {isRaceBindingComplete(raceBinding?.outcomes) && (
              <p className="text-gray-500 text-xs leading-relaxed max-w-3xl">
                {ROSTER_DISCLAIMER}
              </p>
            )}
            {market.outcomes.map((o) => {
              const teamId = deprize?.teamIds[o.index] ?? 0n
              const invested = costBasis[o.index] ?? 0
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
              const redeemValueEth =
                showResolved && o.balanceWei !== undefined
                  ? Number(
                      positionRedeemValue(
                        o.balanceWei,
                        market.payoutNums[o.index] ?? 0n,
                        market.payoutDen ?? 0n,
                      ),
                    ) / Number(UNIT)
                  : undefined
              return (
                <div id={`deprize-outcome-${o.index}`} key={o.index}>
                <DePrizeTeamCard
                  outcome={o}
                  teamId={teamId}
                  teamContract={teamContract}
                  color={
                    isField
                      ? OUTCOME_COLORS[o.index % OUTCOME_COLORS.length]
                      : claimed
                        ? orgColor(atlasOrg)
                        : '#9ca3af'
                  }
                  loading={market.loading}
                  resolved={showResolved}
                  isRefundVector={showRefundVector}
                  isWinningSlot={showResolved && o.index === market.winningIndex}
                  redeemValueEth={redeemValueEth}
                  sellQuoteEth={sellQuotes.get(o.index)}
                  investedEth={invested}
                  bettingOpen={bettingAllowed}
                  tradingHalted={tradingHalted}
                  busy={false}
                  userConnected={!!userAddress}
                  onBet={(i) => setBetIndex(i)}
                  onCashOut={(i) => setExitIndex(i)}
                  isField={isField}
                  withdrawn={!!withdrawnByTeamId[teamId.toString()]}
                  hrefOverride={
                    outcomeBinding?.projectId
                      ? `/moonbase/${outcomeBinding.projectId}`
                      : undefined
                  }
                  nameOverride={atlasOrg?.name || atlasProject?.name}
                  imageOverride={claimed ? atlasOrg?.logoURI : undefined}
                  unclaimed={!isField && !!outcomeBinding && !claimed}
                />
                </div>
              )
            })}
          </div>
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
            jbProjectId={deprize?.jbProjectId}
            refreshNonce={refreshNonce}
            onDone={() => {
              clearCostBasis()
              refreshAll()
            }}
          />
        )}

        {/* Admin */}
        {deprize && (
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
        )}
      </div>

      {/* Bet modal */}
      {betIndex !== null && deprize && market.marketAddress && account && (
        <BetModal
          deprizeId={deprizeId}
          outcomeIndex={betIndex}
          teamName={
            raceBinding?.outcomes[betIndex]?.field
              ? 'Open Field'
              : `Team #${betIndex + 1}`
          }
          probability={market.outcomes[betIndex]?.probability ?? NaN}
          numOutcomes={numOutcomes}
          mintAddress={mintAddress}
          marketAddress={market.marketAddress}
          jbProjectId={deprize.jbProjectId}
          chain={chain}
          account={account}
          spendableEth={spendable}
          onClose={() => setBetIndex(null)}
          onDone={(index, costEth) => {
            addCostBasis(index, costEth)
            refreshAll()
          }}
        />
      )}

      {/* Exit modal */}
      {exitIndex !== null && market.marketAddress && account && (
        <ExitPositionModal
          deprizeId={deprizeId}
          outcomeIndex={exitIndex}
          teamName={
            raceBinding?.outcomes[exitIndex]?.field
              ? 'Open Field'
              : `Team #${exitIndex + 1}`
          }
          balanceWei={market.outcomes[exitIndex]?.balanceWei ?? 0n}
          positionId={market.outcomes[exitIndex]?.positionId ?? 0n}
          numOutcomes={numOutcomes}
          marketAddress={market.marketAddress}
          chain={chain}
          account={account}
          onClose={() => setExitIndex(null)}
          onDone={() => {
            resetCostBasis(exitIndex)
            refreshAll()
          }}
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
      <Head title={title} description={description} />
      <Container>
        <div className="w-full max-w-[860px] mx-auto pt-6 sm:pt-8 pb-10 px-4 sm:px-5 md:px-0">
          {children}
        </div>
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
