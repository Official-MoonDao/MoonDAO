import TeamABI from 'const/abis/Team.json'
import { DEPRIZE_MINT_ADDRESSES, TEAM_ADDRESSES } from 'const/config'
import { useLogin } from '@privy-io/react-auth'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getContract, type Chain } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { eth_getBalance, getRpcClient } from 'thirdweb/rpc'
import {
  DePrizeState,
  DEPRIZE_STATE_META,
  GAS_RESERVE_ETH,
  MarketStage,
  OUTCOME_COLORS,
  UNIT,
} from '@/lib/deprize/constants'
import { fmt, fmtPrizeEth } from '@/lib/deprize/format'
import { deprizeReadChain, deprizeReadClient } from '@/lib/deprize/read'
import {
  deprizeListBucket,
  isMintConfigured,
  reconcileBettingStatus,
} from '@/lib/deprize/status'
import { useDePrize, useDePrizeCount } from '@/lib/deprize/useDePrize'
import { useDePrizeLaunchpadToken } from '@/lib/deprize/useDePrizeLaunchpad'
import { useDePrizeMarket } from '@/lib/deprize/useDePrizeMarket'
import useRegionRestriction from '@/lib/geo/useRegionRestriction'
import useTotalFunding from '@/lib/juicebox/useTotalFunding'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'
import BetModal from '@/components/deprize/BetModal'
import DePrizeTeamLink, { useDePrizeTeamName } from '@/components/deprize/DePrizeTeamLink'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

type BetTarget = {
  deprizeId: number
  outcomeIndex: number
  teamName: string
  probability: number
  numOutcomes: number
  marketAddress: string
  jbProjectId?: bigint
}

function ProviderOddsRow({
  teamId,
  teamContract,
  probability,
  color,
  bettingOpen,
  onBet,
}: {
  teamId: bigint
  teamContract: any
  probability: number
  color: string
  bettingOpen: boolean
  onBet: (teamName: string) => void
}) {
  const name = useDePrizeTeamName(teamId, teamContract)
  const pct = Number.isFinite(probability) ? fmt(probability, 0) : undefined

  return (
    <div
      className={`w-full flex items-center gap-3 min-w-0 px-3 py-2.5 rounded-xl ${
        bettingOpen
          ? 'bg-indigo-500/10 border border-indigo-400/30'
          : 'bg-white/[0.03] border border-white/[0.06]'
      }`}
    >
      <DePrizeTeamLink
        teamId={teamId}
        teamContract={teamContract}
        color={color}
        className="flex-1"
        size={28}
      />
      <span className="shrink-0 min-w-[3rem] px-2 py-1.5 rounded-lg text-sm font-semibold tabular-nums text-center text-gray-300 bg-white/5 border border-white/10">
        {pct !== undefined ? `${pct}%` : '—'}
      </span>
      {bettingOpen && (
        <button
          type="button"
          onClick={() => onBet(name || `Team #${teamId.toString()}`)}
          className="shrink-0 px-4 py-1.5 rounded-lg text-sm font-semibold
            bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white
            transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
          aria-label={
            pct !== undefined ? `Bet on ${name} at ${pct}%` : `Bet on ${name}`
          }
        >
          Bet
        </button>
      )}
    </div>
  )
}

function DePrizeCardSkeleton() {
  return (
    <div
      className="rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 border border-white/[0.08] overflow-hidden animate-pulse"
      aria-hidden
    >
      <div className="p-4 sm:p-5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-5 w-32 rounded bg-white/10" />
          <div className="h-4 w-56 max-w-full rounded bg-white/5" />
          <div className="h-3 w-24 rounded bg-white/5" />
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="h-6 w-16 rounded-full bg-white/10" />
          <div className="h-6 w-20 rounded bg-white/10" />
          <div className="h-3 w-14 rounded bg-white/5" />
        </div>
      </div>
      <div className="px-4 sm:px-5 pb-4 sm:pb-5 flex flex-col gap-2">
        <div className="h-3 w-20 rounded bg-white/5" />
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]"
          >
            <div className="w-7 h-7 rounded-full bg-white/10 shrink-0" />
            <div className="h-4 flex-1 rounded bg-white/5" />
            <div className="h-8 w-14 rounded-lg bg-white/10 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

function DePrizeListSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading DePrizes">
      {Array.from({ length: count }, (_, i) => (
        <DePrizeCardSkeleton key={i} />
      ))}
      <span className="sr-only">Loading DePrizes…</span>
    </div>
  )
}

type DePrizeBucket = 'live' | 'closed'

function ClosedOutcomeLine({
  state,
  winningTeamId,
  teamContract,
}: {
  state: DePrizeState
  winningTeamId: bigint
  teamContract: any
}) {
  if (winningTeamId > 0n) {
    return (
      <p className="text-moon-green text-sm mt-3 font-medium flex items-center gap-2 flex-wrap">
        <span className="text-gray-400 font-normal">Winner</span>
        <DePrizeTeamLink
          teamId={winningTeamId}
          teamContract={teamContract}
          nameOnly
          className="text-moon-green"
        />
      </p>
    )
  }
  if (state === DePrizeState.NO_WINNER) {
    return <p className="text-amber-300/90 text-sm mt-3">No winner — equal refunds</p>
  }
  if (state === DePrizeState.CANCELLED) {
    return <p className="text-amber-300/90 text-sm mt-3">Cancelled — refunds available</p>
  }
  if (state === DePrizeState.M2_FAILED) {
    return <p className="text-amber-300/90 text-sm mt-3">Delivery failed — refunds available</p>
  }
  return null
}

function DePrizeListRow({
  deprizeId,
  teamContract,
  chain,
  activeTab,
  onBet,
  onStatus,
}: {
  deprizeId: number
  teamContract: any
  chain: Chain
  activeTab: DePrizeBucket
  onBet: (target: BetTarget) => void
  onStatus: (deprizeId: number, bucket: DePrizeBucket | 'none') => void
}) {
  const { deprize } = useDePrize(deprizeId, chain)
  const numOutcomes = deprize?.teamIds.length ?? 0

  const market = useDePrizeMarket({
    deprizeId,
    conditionId: deprize?.conditionId,
    numOutcomes,
    chain,
    registryState: deprize?.state,
  })

  // useTotalFunding returns BigInt(0) for a missing projectId / while reads are
  // in flight, so gate the display on a real project id and !isLoading.
  // Read Juicebox on the same chain as the DePrize registry (jbTerminal.pay
  // settles on-chain with the mint router), not the build-time default.
  const jbProjectId = deprize && deprize.jbProjectId > 0n ? Number(deprize.jbProjectId) : undefined
  const { totalFunding, isLoading: isLoadingFunding } = useTotalFunding(jbProjectId, chain)
  const prizeEth =
    jbProjectId !== undefined && !isLoadingFunding ? Number(totalFunding) / Number(UNIT) : undefined
  const launchpad = useDePrizeLaunchpadToken(jbProjectId, chain)
  const missionHref = launchpad.missionHref

  // Top 3 providers by live implied odds (desc). Fall back to registry order
  // while prices are still loading so the card still previews the field.
  const topProviders = useMemo(() => {
    if (!deprize?.teamIds.length) return []
    const rows = deprize.teamIds.map((teamId, index) => ({
      index,
      teamId,
      probability: market.outcomes[index]?.probability ?? NaN,
    }))
    const ranked = [...rows].sort((a, b) => {
      const ap = Number.isFinite(a.probability) ? a.probability : -1
      const bp = Number.isFinite(b.probability) ? b.probability : -1
      return bp - ap
    })
    return ranked.slice(0, 3)
  }, [deprize?.teamIds, market.outcomes])

  const chainSlug = getChainSlug(chain)
  const mintConfigured = isMintConfigured(DEPRIZE_MINT_ADDRESSES[chainSlug] ?? '')
  // Prefer a confirmed market address over the load spinner. `market.loading`
  // flaps on every refresh; treating that as "unbound" hid Live cards while
  // the tab count still said they were live.
  const marketBound = !!market.marketAddress && !/^0x0+$/.test(market.marketAddress)
    ? true
    : market.loading
      ? undefined
      : false

  // Live = bettable / paused-but-bound / mid-lifecycle. Former = terminal,
  // winner-declared (SETTLED/M1), or OPEN shells with no bound market.
  const bucket: DePrizeBucket | 'none' | 'loading' = !deprize
    ? 'loading'
    : deprizeListBucket({
        state: deprize.state,
        isTerminal: deprize.isTerminal,
        mintConfigured,
        marketBound,
        marketStage: market.stage,
        // Only block on loading when we still don't know if a market is bound.
        marketLoading: market.loading && marketBound === undefined,
      })
  useEffect(() => {
    if (bucket === 'live' || bucket === 'closed' || bucket === 'none') {
      onStatus(deprizeId, bucket)
    }
  }, [bucket, deprizeId, onStatus])

  if (!deprize) return null
  if (deprize.state === DePrizeState.NONE) return null
  // Still resolving market binding — mount quietly so the parent count can settle.
  if (bucket === 'loading') return null
  if (bucket !== activeTab) return null

  const meta = DEPRIZE_STATE_META[deprize.state]
  // Match the detail page: registry OPEN alone is not enough — LMSR must be
  // Running and DePrizeMint must have setMarket, or the Bet modal invites reverts.
  const tradingHalted = market.stage !== undefined && market.stage !== MarketStage.Running
  const bettingOpen =
    !!deprize.bettingOpen &&
    market.mintBound &&
    mintConfigured &&
    !tradingHalted &&
    market.stage === MarketStage.Running
  // Single source of truth for badge + subheader (don't show "Accepting bets"
  // while paused / unbound — that copy comes from registry meta alone).
  const { statusLabelOverride, effectiveDescription } = reconcileBettingStatus({
    bettingOpen: deprize.bettingOpen,
    marketStage: market.stage,
    mintConfigured: mintConfigured && market.mintBound,
    registryState: deprize.state,
    marketBound,
  })
  const badgeLabel = statusLabelOverride ?? meta?.label ?? '—'
  const hasOdds = topProviders.some((p) => Number.isFinite(p.probability))
  const detailHref = `/deprize/${deprizeId}`

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 backdrop-blur-xl border border-white/[0.08] hover:border-white/20 transition-colors overflow-hidden shadow-lg">
      {/*
        Plain <a> (not next/link): client-side transitions to /deprize/[id] can
        hang with an in-flight route and never complete. A full document
        navigation is reliable and matches user expectation for "open this card".
      */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          {/*
            Plain <a> (not next/link): client-side transitions to /deprize/[id] can
            hang with an in-flight route and never complete. A full document
            navigation is reliable and matches user expectation for "open this card".
          */}
          <a
            href={detailHref}
            className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-lg"
          >
            <p className="text-white font-GoodTimes text-lg">DePrize #{deprizeId}</p>
            <p className="text-gray-400 text-sm mt-1">
              {effectiveDescription || meta?.description || 'Loading…'}
            </p>
            <p className="text-sky-300/90 text-xs mt-2 font-medium">View details →</p>
          </a>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium border ${
                bettingOpen
                  ? 'bg-moon-green/20 text-moon-green border-moon-green/40'
                  : statusLabelOverride
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-white/10 text-gray-200 border-white/20'
              }`}
            >
              {badgeLabel}
            </span>
            {missionHref ? (
              <a
                href={missionHref}
                title="Open the launchpad prize pool"
                className="text-right rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 group"
              >
                <p className="text-white text-lg font-bold tabular-nums group-hover:text-indigo-200 transition-colors">
                  {prizeEth !== undefined ? fmtPrizeEth(prizeEth) : '—'}
                  <span className="text-sm font-medium text-gray-400 ml-1">ETH</span>
                </p>
                <p className="text-indigo-300/90 text-[11px] underline-offset-2 group-hover:underline">
                  prize pool
                </p>
              </a>
            ) : (
              <div className="text-right">
                <p className="text-white text-lg font-bold tabular-nums">
                  {prizeEth !== undefined ? fmtPrizeEth(prizeEth) : '—'}
                  <span className="text-sm font-medium text-gray-400 ml-1">ETH</span>
                </p>
                <p className="text-gray-500 text-[11px]">prize pool</p>
              </div>
            )}
          </div>
        </div>
        {bucket === 'closed' && (
          <ClosedOutcomeLine
            state={deprize.state}
            winningTeamId={deprize.winningTeamId}
            teamContract={teamContract}
          />
        )}
      </div>

      <div className="px-4 sm:px-5 pb-4 sm:pb-5 flex flex-col gap-2 min-w-0">
        <p className="text-gray-500 text-[11px] uppercase tracking-wide">
          {hasOdds ? 'Live odds' : 'Providers'}
        </p>
        {topProviders.length === 0 ? (
          <p className="text-gray-500 text-sm">Loading providers…</p>
        ) : (
          topProviders.map((p) => (
            <ProviderOddsRow
              key={p.teamId.toString()}
              teamId={p.teamId}
              teamContract={teamContract}
              probability={p.probability}
              color={OUTCOME_COLORS[p.index % OUTCOME_COLORS.length]}
              bettingOpen={bettingOpen}
              onBet={(teamName) => {
                if (!market.marketAddress) return
                onBet({
                  deprizeId,
                  outcomeIndex: p.index,
                  teamName,
                  probability: p.probability,
                  numOutcomes,
                  marketAddress: market.marketAddress,
                  jbProjectId: deprize.jbProjectId,
                })
              }}
            />
          ))
        )}
        {deprize && deprize.teamIds.length > 3 && (
          <p className="text-gray-500 text-xs mt-1">
            +{deprize.teamIds.length - 3} more on the detail page
          </p>
        )}
      </div>
    </div>
  )
}

export default function DePrizeIndexContent() {
  // Follow the app's live selected chain (wallet / header dropdown), not the
  // build-time default — otherwise switching networks never re-queries DePrize.
  const { selectedChain: chain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(chain)
  const { count, loading, error: countError, registryConfigured } = useDePrizeCount(chain)
  const account = useActiveAccount()
  const { login } = useLogin()
  const region = useRegionRestriction()
  const mintAddress = DEPRIZE_MINT_ADDRESSES[chainSlug] ?? ''

  const [betTarget, setBetTarget] = useState<BetTarget | null>(null)
  const [spendableEth, setSpendableEth] = useState(0)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [activeTab, setActiveTab] = useState<DePrizeBucket>('live')
  const [statusMap, setStatusMap] = useState<Record<number, DePrizeBucket | 'none'>>({})

  // Rows report their bucket (live / former) as their on-chain state resolves.
  const handleStatus = useCallback((id: number, bucket: DePrizeBucket | 'none') => {
    setStatusMap((prev) => (prev[id] === bucket ? prev : { ...prev, [id]: bucket }))
  }, [])

  // Reset the bucket map when the chain or the DePrize count changes so stale
  // ids from another network can't linger in the tab counts.
  useEffect(() => {
    setStatusMap({})
  }, [chain.id, count])

  const liveCount = useMemo(
    () => Object.values(statusMap).filter((s) => s === 'live').length,
    [statusMap],
  )
  const closedCount = useMemo(
    () => Object.values(statusMap).filter((s) => s === 'closed').length,
    [statusMap],
  )
  const resolvedCount = useMemo(() => Object.keys(statusMap).length, [statusMap])
  const stillResolving = count !== undefined && resolvedCount < count
  const activeCount = activeTab === 'live' ? liveCount : closedCount

  const readChain = useMemo(() => deprizeReadChain(chain.id), [chain.id])

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

  // Spendable native ETH for the BetModal (keep a little back for gas).
  useEffect(() => {
    if (!account?.address) {
      setSpendableEth(0)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const bal = await eth_getBalance(
          getRpcClient({ client: deprizeReadClient, chain: readChain }),
          { address: account.address },
        )
        if (!cancelled) {
          setSpendableEth(Math.max(0, Number(bal) / Number(UNIT) - GAS_RESERVE_ETH))
        }
      } catch {
        if (!cancelled) setSpendableEth(0)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [account?.address, readChain, refreshNonce])

  const handleBet = useCallback(
    (target: BetTarget) => {
      if (region.isRestricted || region.isLoading || region.isError) return
      if (!account) {
        login()
        return
      }
      setBetTarget(target)
    },
    [account, login, region.isError, region.isLoading, region.isRestricted],
  )

  return (
    <div className="animate-fadeIn flex flex-col items-center">
      <Head
        title="DePrize"
        description="Back a team in open challenges — live odds, growing prize pools, payouts when a winner is declared."
      />
      <Container>
        <ContentLayout
          header="DePrize"
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
          centerHeader
          centerHeaderWidth="760px"
          description="Open challenges with live odds. Back the team you think will win — every bet grows the prize pool."
          preFooter={<NoticeFooter />}
        >
          <div className="flex flex-col gap-4 w-full max-w-[760px] mx-auto">
            {region.isRestricted && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
                Betting isn&apos;t available in your region. You can still browse live odds and
                prize pools.
              </div>
            )}
            {!registryConfigured ? (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
                The DePrize registry isn&apos;t configured on{' '}
                <span className="font-mono">{chainSlug}</span> yet.
              </div>
            ) : loading && count === undefined ? (
              <DePrizeListSkeleton count={2} />
            ) : countError && count === undefined ? (
              <div className="p-8 text-center text-amber-200/90 text-sm">
                Couldn&apos;t load DePrizes. Please refresh and try again.
              </div>
            ) : !count || count === 0 ? (
              <div className="p-8 text-center text-gray-400">
                No DePrizes have been registered yet.
              </div>
            ) : (
              <>
                {/* Live / Former tabs */}
                <div
                  role="tablist"
                  aria-label="DePrize status"
                  className="flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10 self-start max-w-full"
                >
                  {(
                    [
                      { id: 'live' as const, label: 'Live', n: liveCount },
                      { id: 'closed' as const, label: 'Former', n: closedCount },
                    ]
                  ).map((t) => (
                    <button
                      key={t.id}
                      role="tab"
                      aria-selected={activeTab === t.id}
                      onClick={() => setActiveTab(t.id)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
                        activeTab === t.id
                          ? 'bg-white/15 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {t.label}
                      {!stillResolving && (
                        <span className="ml-1.5 tabular-nums text-xs opacity-70">{t.n}</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Rows: every DePrize mounts (to resolve its bucket) but each
                    self-hides unless it matches the active tab. */}
                {Array.from({ length: count }, (_, i) => (
                  <DePrizeListRow
                    key={i + 1}
                    deprizeId={i + 1}
                    teamContract={teamContract}
                    chain={chain}
                    activeTab={activeTab}
                    onBet={handleBet}
                    onStatus={handleStatus}
                  />
                ))}

                {/* Only skeleton when this tab has nothing to show yet. Once any
                    matching card is up, don't append another — remaining ids may
                    belong to the other tab and would look like a phantom listing. */}
                {stillResolving && activeCount === 0 ? (
                  <DePrizeListSkeleton count={2} />
                ) : !stillResolving && activeCount === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    {activeTab === 'live'
                      ? 'No live DePrizes right now. Check the Former tab for past challenges.'
                      : 'No former DePrizes yet.'}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </ContentLayout>
      </Container>

      {betTarget && account && (
        <BetModal
          deprizeId={betTarget.deprizeId}
          outcomeIndex={betTarget.outcomeIndex}
          teamName={betTarget.teamName}
          probability={betTarget.probability}
          numOutcomes={betTarget.numOutcomes}
          mintAddress={mintAddress}
          marketAddress={betTarget.marketAddress}
          jbProjectId={betTarget.jbProjectId}
          chain={chain}
          account={account}
          spendableEth={spendableEth}
          onClose={() => setBetTarget(null)}
          onDone={(index, costEth) => {
            // Persist cost basis so the detail page's P&L matches index bets.
            const user = account.address
            const marketAddr = betTarget.marketAddress
            if (typeof window !== 'undefined' && user && marketAddr) {
              const key = `deprize:costBasis:v1:${marketAddr}:${user}`
              try {
                const raw = window.localStorage.getItem(key)
                const prev = raw ? (JSON.parse(raw) as Record<number, number>) : {}
                const next = {
                  ...prev,
                  [index]: Math.max(0, (prev[index] ?? 0) + costEth),
                }
                window.localStorage.setItem(key, JSON.stringify(next))
              } catch {
                /* quota / private mode */
              }
            }
            setRefreshNonce((n) => n + 1)
            setBetTarget(null)
          }}
        />
      )}
    </div>
  )
}
