import LMSRWithTWAP from 'const/abis/LMSRWithTWAP.json'
import TeamABI from 'const/abis/Team.json'
import { DEPRIZE_MINT_ADDRESSES, TEAM_ADDRESSES } from 'const/config'
import { useLogin } from '@privy-io/react-auth'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { eth_getBalance, getRpcClient } from 'thirdweb/rpc'
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
import { fmt } from '@/lib/deprize/format'
import { buildAmounts } from '@/lib/deprize/quote'
import { deprizeReadChain, deprizeReadClient, rpcRead } from '@/lib/deprize/read'
import { formatBettingCloses, isMintConfigured, reconcileBettingStatus } from '@/lib/deprize/status'
import { useDePrize } from '@/lib/deprize/useDePrize'
import { useDePrizeMarket } from '@/lib/deprize/useDePrizeMarket'
import useRegionRestriction from '@/lib/geo/useRegionRestriction'
import useTotalFunding from '@/lib/juicebox/useTotalFunding'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import StandardButton from '@/components/layout/StandardButton'
import BetModal from '@/components/deprize/BetModal'
import ClaimPanel from '@/components/deprize/ClaimPanel'
import DePrizeAdminPanel from '@/components/deprize/DePrizeAdminPanel'
import DePrizeTeamCard from '@/components/deprize/DePrizeTeamCard'
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
          : 'bg-white/10 text-gray-200 border-white/20'
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${tone}`}>
      {labelOverride ?? meta?.label ?? 'Unknown'}
    </span>
  )
}

export default function DePrizeDetailPage() {
  const router = useRouter()
  const rawId = router.query.id
  const deprizeId = typeof rawId === 'string' && /^\d+$/.test(rawId) ? Number(rawId) : undefined

  // Follow the app's live selected chain (wallet / header dropdown), not the
  // build-time default — otherwise switching networks never re-queries DePrize.
  const { selectedChain: chain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(chain)
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

  const mintAddress = DEPRIZE_MINT_ADDRESSES[chainSlug] ?? ''

  const [refreshNonce, setRefreshNonce] = useState(0)
  const [nativeBalance, setNativeBalance] = useState<number | undefined>()
  const [sellQuotes, setSellQuotes] = useState<Map<number, number>>(new Map())
  const [costBasis, setCostBasis] = useState<Record<number, number>>({})
  const [betIndex, setBetIndex] = useState<number | null>(null)
  const [exitIndex, setExitIndex] = useState<number | null>(null)

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
  const bettingAllowed =
    !!deprize?.bettingOpen &&
    mintConfigured &&
    !region.isRestricted &&
    !region.isLoading &&
    !region.isError &&
    !tradingHalted
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
        mintConfigured,
        registryState: deprize.state,
      })
    : { effectiveDescription: undefined, statusLabelOverride: undefined }

  const winningTeamName = market.winningIndex >= 0 ? `Team #${market.winningIndex + 1}` : undefined

  // --- Render states ---
  if (!registryConfigured) {
    return (
      <Shell>
        <Notice tone="amber">
          The DePrize registry isn&apos;t configured on{' '}
          <span className="font-mono">{chainSlug}</span> yet.
        </Notice>
      </Shell>
    )
  }
  if (!router.isReady) {
    return (
      <Shell>
        <div className="p-8 text-center text-gray-400">Loading DePrize…</div>
      </Shell>
    )
  }
  if (deprizeId === undefined) {
    return (
      <Shell>
        <Notice tone="amber">Invalid DePrize id.</Notice>
      </Shell>
    )
  }
  if (error) {
    return (
      <Shell>
        <Notice tone="red">Couldn&apos;t load this DePrize: {error}</Notice>
      </Shell>
    )
  }
  if (!deprize || (deprizeId !== undefined && deprize.deprizeId !== deprizeId)) {
    return (
      <Shell>
        <div className="p-8 text-center text-gray-400">Loading DePrize…</div>
      </Shell>
    )
  }
  if (deprize.state === DePrizeState.NONE) {
    return (
      <Shell>
        <Notice tone="amber">DePrize #{deprizeId} does not exist.</Notice>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="flex flex-col gap-6 w-full max-w-[860px] mx-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 border border-white/10">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
              <h1 className="text-white font-GoodTimes text-lg sm:text-xl">DePrize #{deprizeId}</h1>
              {deprize && (
                <StateBadge
                  state={deprize.state}
                  labelOverride={statusLabelOverride}
                  toneOverride={statusLabelOverride ? 'amber' : undefined}
                />
              )}
            </div>
            <StandardButton
              onClick={refreshAll}
              disabled={market.loading}
              className="rounded-full"
              backgroundColor="bg-white/10"
            >
              {market.loading ? 'Refreshing…' : 'Refresh'}
            </StandardButton>
          </div>
          <p className="text-gray-300 text-sm mt-2">
            Back the provider you think will win the right to fly Frank + a community Candidate to
            space.
          </p>
          {effectiveDescription && (
            <p className="text-gray-500 text-sm mt-1">{effectiveDescription}</p>
          )}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat label="Prize pool">
              {jbProjectId !== undefined && !isLoadingFunding
                ? `${fmt(Number(totalFunding) / Number(UNIT))} ETH`
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
        </div>

        {/* Cancellation notice */}
        {deprize?.cancellationPending && (
          <Notice tone="red">
            A cancellation has been announced for this DePrize. New bets are paused during the 7-day
            notice window. If the cancellation goes through, all positions are refunded.
          </Notice>
        )}

        {/* Geo notice */}
        {region.isRestricted && (
          <Notice tone="amber">
            Betting isn&apos;t available in your region. You can still view live odds and, if you
            hold a position, claim or cash out.
          </Notice>
        )}

        {/* Live odds */}
        {numOutcomes > 0 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-gray-900 to-blue-900/20 border border-white/10">
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
            Couldn&apos;t fully load market data: {market.error}. Try Refresh.
          </Notice>
        )}

        {/* Team cards */}
        {numOutcomes > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="title-text-colors text-lg font-GoodTimes">Providers</h3>
            {market.outcomes.map((o) => {
              const teamId = deprize?.teamIds[o.index] ?? 0n
              const invested = costBasis[o.index] ?? 0
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
                <DePrizeTeamCard
                  key={o.index}
                  outcome={o}
                  teamId={teamId}
                  teamContract={teamContract}
                  color={OUTCOME_COLORS[o.index % OUTCOME_COLORS.length]}
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
                />
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
            winningTeamName={winningTeamName}
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
          teamName={`Team #${betIndex + 1}`}
          probability={market.outcomes[betIndex]?.probability ?? NaN}
          numOutcomes={numOutcomes}
          mintAddress={mintAddress}
          marketAddress={market.marketAddress}
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
          teamName={`Team #${exitIndex + 1}`}
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
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-fadeIn flex flex-col items-center">
      <Head
        title="DePrize"
        description="Back a provider to fly Frank White to space, and win if they do."
      />
      <Container>
        <ContentLayout
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
          centerHeader
          centerHeaderWidth="860px"
          preFooter={<NoticeFooter />}
        >
          <div className="w-full max-w-[860px] mx-auto">{children}</div>
        </ContentLayout>
      </Container>
    </div>
  )
}

function Stat({
  label,
  title,
  children,
}: {
  label: string
  title?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className={`text-gray-400 text-xs ${title ? 'cursor-help' : ''}`} title={title}>
        {label}
      </p>
      <p className="text-white text-sm font-semibold">{children}</p>
    </div>
  )
}

function Notice({ tone, children }: { tone: 'amber' | 'red'; children: React.ReactNode }) {
  const cls =
    tone === 'amber'
      ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
      : 'bg-red-500/10 border-red-500/30 text-red-200'
  return <div className={`p-4 rounded-2xl border text-sm ${cls}`}>{children}</div>
}
