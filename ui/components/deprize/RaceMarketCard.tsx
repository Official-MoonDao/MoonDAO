// One capability-race card for the /deprize index — Polymarket-style: an
// icon + title + status/pool header, then a ranked list of outcome rows each
// with a probability bar and a Buy button. Sources every race straight from
// the Moon Base Zero atlas (`SEED_ATLAS.sharedGoals`) so the index always
// matches what's on the globe, instead of raw on-chain registry ids that may
// include unrelated fixtures.
//
// A race bets for real once `competitions.ts` binds it to a deployed DePrize
// market (only one does today). Every other race still renders fully —
// odds, a pool figure, and a working Buy flow — backed by the local demo
// ledger in `lib/deprize/mockMarket.ts` so the whole product can be tested
// before every race has a contract.

import { useEffect, useMemo, useState } from 'react'
import type { Chain } from 'thirdweb'
import {
  findDePrizeIdForGoal,
  getDePrizeRaceBinding,
  isDePrizeGoalMarketBound,
} from '@/lib/deprize/competitions'
import { MarketStage, OUTCOME_COLORS, UNIT } from '@/lib/deprize/constants'
import { fmt, fmtPrizeEth } from '@/lib/deprize/format'
import { exitMockPosition, useMockMarket } from '@/lib/deprize/mockMarket'
import { isMintConfigured } from '@/lib/deprize/status'
import { useDePrizeGoalOdds } from '@/lib/deprize/useDePrizeGoalOdds'
import useTotalFunding from '@/lib/juicebox/useTotalFunding'
import { PROJECT_TYPE_COLOR, PROJECT_TYPE_LABEL } from '@/lib/lunar-atlas/display'
import type { Organization, Project, SharedGoal } from '@/lib/lunar-atlas/types'
import BetModal from '@/components/deprize/BetModal'
import CategoryIcon from '@/components/deprize/CategoryIcon'
import ClaimPanel from '@/components/deprize/ClaimPanel'
import DemoBetModal from '@/components/deprize/DemoBetModal'
import ExitPositionModal from '@/components/deprize/ExitPositionModal'
import toast from 'react-hot-toast'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'

export type IndexTab = 'all' | 'positions'

type Competitor = { project: Project; organization?: Organization }

type OutcomeRowVM = {
  projectId: string
  name: string
  color: string
  probability: number
  heldQty: number | undefined
  // Real-market only
  outcomeIndex: number | undefined
  positionId: bigint | undefined
  balanceWei: bigint | undefined
}

function StatusPill({ label, tone }: { label: string; tone: 'live' | 'paused' | 'demo' | 'resolved' }) {
  const cls: Record<typeof tone, string> = {
    live: 'text-moon-green border-moon-green/40 bg-moon-green/15',
    paused: 'text-amber-300 border-amber-500/40 bg-amber-500/15',
    demo: 'text-fuchsia-200 border-fuchsia-400/30 bg-fuchsia-500/10',
    resolved: 'text-gray-300 border-white/20 bg-white/10',
  } as const
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls[tone]}`}>
      {label}
    </span>
  )
}

function OutcomeBetRow({
  outcome,
  bettingEnabled,
  onBet,
  onCashOut,
}: {
  outcome: OutcomeRowVM
  bettingEnabled: boolean
  onBet: () => void
  onCashOut?: () => void
}) {
  const pct = Number.isFinite(outcome.probability) ? fmt(outcome.probability, 0) : undefined
  return (
    <div className="relative flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 opacity-[0.14] pointer-events-none"
        style={{
          width: `${Math.max(0, Math.min(100, outcome.probability))}%`,
          background: outcome.color,
        }}
      />
      <span className="relative z-10 w-2 h-2 rounded-full shrink-0" style={{ background: outcome.color }} />
      <span className="relative z-10 flex-1 min-w-0 truncate text-sm text-white/90">{outcome.name}</span>
      {!!outcome.heldQty && (
        <span className="relative z-10 shrink-0 text-[10px] font-medium text-moon-green">
          Holding {fmt(outcome.heldQty, 3)}
        </span>
      )}
      <span className="relative z-10 w-9 shrink-0 text-right text-sm font-semibold tabular-nums text-gray-200">
        {pct !== undefined ? `${pct}%` : '—'}
      </span>
      {bettingEnabled && (
        <button
          type="button"
          onClick={onBet}
          className="relative z-10 shrink-0 px-3 py-1 rounded-md text-xs font-semibold
            bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white
            transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
        >
          Buy
        </button>
      )}
      {onCashOut && (
        <button
          type="button"
          onClick={onCashOut}
          className="relative z-10 shrink-0 px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wide
            bg-white/5 hover:bg-indigo-500/15 text-white border border-white/10 hover:border-indigo-400/35 transition-all"
        >
          Cash out
        </button>
      )}
    </div>
  )
}

export type RaceCardVariant = 'list' | 'grid' | 'featured'

export default function RaceMarketCard({
  goal,
  competitors,
  chain,
  chainSlug,
  account,
  userAddress,
  spendableEth,
  refreshNonce,
  activeTab,
  bettingBlockedReason,
  onConnectWallet,
  onHasPosition,
  onDone,
  variant = 'list',
}: {
  goal: SharedGoal
  competitors: Competitor[]
  chain: Chain
  chainSlug: string
  account: any
  userAddress: string | undefined
  spendableEth: number
  refreshNonce: number
  activeTab: IndexTab
  /** Set when region/geo rules block *real* (on-chain) betting. Demo markets ignore it. */
  bettingBlockedReason: string | undefined
  onConnectWallet: () => void
  onHasPosition: (sharedGoalId: string, has: boolean) => void
  onDone: () => void
  /** 'list' (default, full-width row) · 'grid' (compact tile) · 'featured' (hero card). */
  variant?: RaceCardVariant
}) {
  const bound = isDePrizeGoalMarketBound(chainSlug, goal.id)
  const deprizeId = bound ? findDePrizeIdForGoal(chainSlug, goal.id) : undefined
  const binding = deprizeId !== undefined ? getDePrizeRaceBinding(chainSlug, deprizeId) : undefined

  // Real on-chain bridge — cheap no-op RPC-wise when the race isn't bound
  // (deprizeId stays undefined, so useDePrize/useDePrizeMarket short-circuit).
  const live = useDePrizeGoalOdds(chain, goal.id, userAddress)

  const { totalFunding, isLoading: isLoadingFunding } = useTotalFunding(live.jbProjectId, chain)
  const realPoolEth =
    live.jbProjectId !== undefined && !isLoadingFunding
      ? Number(totalFunding) / Number(UNIT)
      : undefined

  const projectIds = useMemo(() => competitors.map((c) => c.project.id), [competitors])
  const impliedOdds = goal.market?.impliedOdds
  const demo = useMockMarket(goal.id, projectIds, impliedOdds, userAddress)

  const outcomes: OutcomeRowVM[] = useMemo(
    () =>
      competitors.map((c, i) => {
        const color = OUTCOME_COLORS[i % OUTCOME_COLORS.length]
        if (bound) {
          const outcomeIndex = binding?.outcomes.findIndex(
            (o) => !o.field && o.projectId === c.project.id,
          )
          const idx = outcomeIndex !== undefined && outcomeIndex >= 0 ? outcomeIndex : undefined
          const marketOutcome = idx !== undefined ? live.outcomes[idx] : undefined
          const probability = (live.oddsByProjectId?.[c.project.id] ?? 0) * 100
          return {
            projectId: c.project.id,
            name: c.project.name,
            color,
            probability,
            heldQty:
              marketOutcome && Number.isFinite(marketOutcome.balance) && marketOutcome.balance > 0
                ? marketOutcome.balance
                : undefined,
            outcomeIndex: idx,
            positionId: marketOutcome?.positionId,
            balanceWei: marketOutcome?.balanceWei,
          }
        }
        const pos = demo.positions[c.project.id]
        return {
          projectId: c.project.id,
          name: c.project.name,
          color,
          probability: demo.odds[c.project.id] ?? 0,
          heldQty: pos && pos.qty > 0 ? pos.qty : undefined,
          outcomeIndex: undefined,
          positionId: undefined,
          balanceWei: undefined,
        }
      }),
    [competitors, bound, binding, live.outcomes, live.oddsByProjectId, demo.odds, demo.positions],
  )

  const heldOutcomes = useMemo(() => outcomes.filter((o) => !!o.heldQty), [outcomes])
  const hasPosition = heldOutcomes.length > 0
  useEffect(() => {
    onHasPosition(goal.id, hasPosition)
  }, [goal.id, hasPosition, onHasPosition])

  const tradingHalted = live.tradingHalted
  // Whether the on-chain market itself is tradable, independent of region —
  // drives the status pill so "Paused" always reflects the real market state.
  const marketTradable =
    !!live.bettingOpen &&
    live.mintBound &&
    isMintConfigured(live.mintAddress) &&
    !tradingHalted &&
    live.stage === MarketStage.Running
  // Whether the Buy button actually opens — the market must be tradable AND
  // region rules must allow real bets (demo markets skip this entirely).
  const bettingOpenReal = marketTradable && !bettingBlockedReason
  const bettingEnabled = bound ? bettingOpenReal : true // demo markets never gate

  const statusTone: 'live' | 'paused' | 'demo' | 'resolved' = !bound
    ? 'demo'
    : live.resolved
      ? 'resolved'
      : marketTradable
        ? 'live'
        : 'paused'
  const statusLabel = { live: 'Live', paused: 'Paused', demo: 'Demo', resolved: 'Resolved' }[statusTone]

  const category = goal.category ?? 'other'
  const categoryLabel = PROJECT_TYPE_LABEL[category]
  const categoryColor = PROJECT_TYPE_COLOR[category]

  const poolEth = bound ? realPoolEth : demo.pool
  const poolLoading = bound && live.jbProjectId !== undefined && isLoadingFunding

  const detailHref = bound ? `/deprize/${deprizeId}` : `/moonbase?race=${goal.id}`

  const ranked = useMemo(
    () => [...outcomes].sort((a, b) => (b.probability || 0) - (a.probability || 0)),
    [outcomes],
  )
  const top = ranked.slice(0, 4)
  const more = ranked.length - top.length

  // Bet targets — only one of these is ever open at a time.
  const [realBetIndex, setRealBetIndex] = useState<number | null>(null)
  const [realExitOutcome, setRealExitOutcome] = useState<OutcomeRowVM | null>(null)
  const [demoBetProjectId, setDemoBetProjectId] = useState<string | null>(null)

  const handleBet = (outcome: OutcomeRowVM) => {
    if (!userAddress) {
      onConnectWallet()
      return
    }
    if (bound) {
      if (!bettingOpenReal || outcome.outcomeIndex === undefined || !live.marketAddress) return
      setRealBetIndex(outcome.outcomeIndex)
    } else {
      setDemoBetProjectId(outcome.projectId)
    }
  }

  const handleDemoExit = (outcome: OutcomeRowVM) => {
    const valueEth = exitMockPosition(goal.id, outcome.projectId, userAddress)
    toast.success(`Cashed out ${outcome.name} (demo) for ≈ ${fmt(valueEth)} ETH.`, { style: toastStyle })
    onDone()
  }

  const betOutcome = realBetIndex !== null ? outcomes.find((o) => o.outcomeIndex === realBetIndex) : undefined
  const demoBetOutcome = demoBetProjectId ? outcomes.find((o) => o.projectId === demoBetProjectId) : undefined

  // Bet/exit modals are identical across variants — rendered once, reused below.
  const marketModals = (
    <>
      {betOutcome && account && live.marketAddress && deprizeId !== undefined && (
        <BetModal
          deprizeId={deprizeId}
          outcomeIndex={betOutcome.outcomeIndex!}
          teamName={betOutcome.name}
          probability={betOutcome.probability}
          numOutcomes={live.numOutcomes}
          mintAddress={live.mintAddress}
          marketAddress={live.marketAddress}
          jbProjectId={live.jbProjectId}
          chain={chain}
          account={account}
          spendableEth={spendableEth}
          onClose={() => setRealBetIndex(null)}
          onDone={() => {
            onDone()
            setRealBetIndex(null)
          }}
        />
      )}
      {demoBetOutcome && (
        <DemoBetModal
          sharedGoalId={goal.id}
          projectIds={projectIds}
          impliedOdds={impliedOdds}
          projectId={demoBetOutcome.projectId}
          teamName={demoBetOutcome.name}
          probability={demoBetOutcome.probability}
          address={userAddress}
          onClose={() => setDemoBetProjectId(null)}
          onDone={onDone}
        />
      )}
    </>
  )

  // --- "My Positions" view: only render if this race is held ---
  if (activeTab === 'positions') {
    if (!hasPosition) return null
    return (
      <div className="rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 backdrop-blur-xl border border-white/[0.08] overflow-hidden shadow-lg">
        <div className="p-4 sm:p-5 flex items-start gap-3">
          <div
            className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: `${categoryColor}22`, border: `1px solid ${categoryColor}55`, color: categoryColor }}
          >
            <CategoryIcon category={category} className="w-5 h-5" />
          </div>
          <a href={detailHref} className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-lg">
            <p className="text-white font-GoodTimes text-base">{goal.title}</p>
            <p className="text-gray-500 text-xs mt-0.5">{categoryLabel}</p>
          </a>
          <StatusPill label={statusLabel} tone={statusTone} />
        </div>
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 flex flex-col gap-2">
          {heldOutcomes.map((o) => (
            <div
              key={o.projectId}
              className="flex items-center justify-between gap-3 flex-wrap px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{o.name}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {bound && live.resolved
                    ? o.outcomeIndex === live.winningIndex
                      ? 'Won'
                      : live.isRefundVector
                        ? 'Refund'
                        : 'Lost'
                    : `${fmt(o.heldQty ?? 0)} ${bound ? 'ETH' : 'demo ETH'} if wins`}
                </p>
              </div>
              {bound ? (
                !live.resolved &&
                !tradingHalted && (
                  <button
                    type="button"
                    onClick={() => setRealExitOutcome(o)}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide
                      bg-white/5 hover:bg-indigo-500/15 text-white border border-white/10 hover:border-indigo-400/35 transition-all"
                  >
                    Cash out
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => handleDemoExit(o)}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide
                    bg-white/5 hover:bg-fuchsia-500/15 text-white border border-white/10 hover:border-fuchsia-400/35 transition-all"
                >
                  Cash out (demo)
                </button>
              )}
            </div>
          ))}
        </div>
        {bound && live.resolved && deprizeId !== undefined && account && (
          <div className="px-4 sm:px-5 pb-4 sm:pb-5">
            <ClaimPanel
              deprizeId={deprizeId}
              chain={chain}
              account={account}
              resolved={live.resolved}
              isRefundVector={live.isRefundVector}
              jbProjectId={live.jbProjectId}
              refreshNonce={refreshNonce}
              onDone={onDone}
            />
          </div>
        )}
        {realExitOutcome && account && live.marketAddress && deprizeId !== undefined && (
          <ExitPositionModal
            deprizeId={deprizeId}
            outcomeIndex={realExitOutcome.outcomeIndex!}
            teamName={realExitOutcome.name}
            balanceWei={realExitOutcome.balanceWei ?? 0n}
            positionId={realExitOutcome.positionId ?? 0n}
            numOutcomes={live.numOutcomes}
            marketAddress={live.marketAddress}
            chain={chain}
            account={account}
            onClose={() => setRealExitOutcome(null)}
            onDone={() => {
              onDone()
              setRealExitOutcome(null)
            }}
          />
        )}
      </div>
    )
  }

  // --- Grid view: compact tile for the Polymarket-style browse grid ---
  if (variant === 'grid') {
    const gridTop = ranked.slice(0, 3)
    const gridMore = ranked.length - gridTop.length
    return (
      <div className="rounded-xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 backdrop-blur-xl border border-white/[0.08] hover:border-white/20 transition-colors overflow-hidden shadow-lg flex flex-col h-full">
        <a
          href={detailHref}
          className="p-4 flex items-start gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          <div
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${categoryColor}22`, border: `1px solid ${categoryColor}55`, color: categoryColor }}
          >
            <CategoryIcon category={category} className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white font-GoodTimes text-sm leading-snug line-clamp-2">{goal.title}</p>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500">
              <span className="truncate">{categoryLabel}</span>
              <StatusPill label={statusLabel} tone={statusTone} />
            </div>
          </div>
        </a>

        <div className="px-4 pb-3 flex flex-col gap-1.5 flex-1">
          {gridTop.map((o) => {
            const pct = Number.isFinite(o.probability) ? fmt(o.probability, 0) : undefined
            return (
              <div
                key={o.projectId}
                className="relative flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 overflow-hidden"
              >
                <div
                  className="absolute inset-y-0 left-0 opacity-[0.14] pointer-events-none"
                  style={{ width: `${Math.max(0, Math.min(100, o.probability))}%`, background: o.color }}
                />
                <span className="relative z-10 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: o.color }} />
                <span className="relative z-10 flex-1 min-w-0 truncate text-xs text-white/90">{o.name}</span>
                <span className="relative z-10 shrink-0 text-xs font-semibold tabular-nums text-gray-200">
                  {pct !== undefined ? `${pct}%` : '—'}
                </span>
                {bettingEnabled && (
                  <button
                    type="button"
                    onClick={() => handleBet(o)}
                    className="relative z-10 shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold
                      bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white
                      transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
                  >
                    Buy
                  </button>
                )}
              </div>
            )
          })}
          {gridMore > 0 && (
            <a href={detailHref} className="text-gray-500 hover:text-gray-300 text-[11px] mt-0.5 transition-colors">
              +{gridMore} more
            </a>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-white/[0.06] text-[11px] text-gray-500 truncate">
          <span className="text-gray-300 font-semibold tabular-nums">
            {poolLoading ? '…' : poolEth !== undefined ? fmtPrizeEth(poolEth) : '—'}
          </span>{' '}
          ETH {bound ? 'pool' : 'demo'}
        </div>

        {marketModals}
      </div>
    )
  }

  // --- Featured view: hero card for the top of the index ---
  if (variant === 'featured') {
    const featuredTop = ranked.slice(0, 6)
    const featuredMore = ranked.length - featuredTop.length
    return (
      <div className="rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-indigo-950/50 backdrop-blur-xl border border-indigo-400/25 shadow-xl overflow-hidden">
        <div className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: `${categoryColor}22`, border: `1px solid ${categoryColor}55`, color: categoryColor }}
              >
                <CategoryIcon category={category} className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 border border-indigo-400/30 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-200 mb-1.5">
                  ★ Featured Race
                </span>
                <a
                  href={detailHref}
                  className="block min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-lg"
                >
                  <p className="text-white font-GoodTimes text-xl sm:text-2xl leading-snug">{goal.title}</p>
                </a>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
                  <span>{categoryLabel}</span>
                  {goal.targetWindow && (
                    <>
                      <span className="text-gray-600">·</span>
                      <span>
                        {goal.targetWindow.from ?? '?'}–{goal.targetWindow.to ?? '?'}
                      </span>
                    </>
                  )}
                  <StatusPill label={statusLabel} tone={statusTone} />
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-white text-2xl sm:text-3xl font-bold tabular-nums">
                {poolLoading ? '…' : poolEth !== undefined ? fmtPrizeEth(poolEth) : '—'}
                <span className="text-sm font-medium text-gray-400 ml-1.5">ETH</span>
              </p>
              <p className="text-gray-500 text-[10px] uppercase tracking-wide">
                {bound ? 'prize pool' : 'demo pool'}
              </p>
            </div>
          </div>

          <div className="flex w-full h-2 rounded-full overflow-hidden bg-white/5 mb-4">
            {ranked.map((o) => (
              <div
                key={o.projectId}
                style={{ width: `${Math.max(0, Math.min(100, o.probability))}%`, background: o.color }}
              />
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            {featuredTop.map((o) => (
              <OutcomeBetRow key={o.projectId} outcome={o} bettingEnabled={bettingEnabled} onBet={() => handleBet(o)} />
            ))}
            {featuredMore > 0 && (
              <a href={detailHref} className="text-gray-500 hover:text-gray-300 text-xs mt-0.5 transition-colors">
                +{featuredMore} more · View all →
              </a>
            )}
          </div>

          {bound && marketTradable && bettingBlockedReason && (
            <p className="mt-2 text-amber-300/80 text-[11px]">{bettingBlockedReason}</p>
          )}
        </div>

        {marketModals}
      </div>
    )
  }

  // --- Market list view ---
  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 backdrop-blur-xl border border-white/[0.08] hover:border-white/20 transition-colors overflow-hidden shadow-lg">
      <div className="p-4 sm:p-5 flex items-start gap-3">
        <div
          className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: `${categoryColor}22`, border: `1px solid ${categoryColor}55`, color: categoryColor }}
        >
          <CategoryIcon category={category} className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <a
                href={detailHref}
                className="min-w-0 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-lg"
              >
                <p className="text-white font-GoodTimes text-base sm:text-lg leading-snug">{goal.title}</p>
              </a>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
                <span>{categoryLabel}</span>
                {goal.targetWindow && (
                  <>
                    <span className="text-gray-600">·</span>
                    <span>
                      {goal.targetWindow.from ?? '?'}–{goal.targetWindow.to ?? '?'}
                    </span>
                  </>
                )}
                <StatusPill label={statusLabel} tone={statusTone} />
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-white text-base sm:text-lg font-bold tabular-nums">
                {poolLoading ? '…' : poolEth !== undefined ? fmtPrizeEth(poolEth) : '—'}
                <span className="text-xs font-medium text-gray-400 ml-1">ETH</span>
              </p>
              <p className="text-gray-500 text-[10px] uppercase tracking-wide">
                {bound ? 'prize pool' : 'demo pool'}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-1.5">
            {top.map((o) => (
              <OutcomeBetRow
                key={o.projectId}
                outcome={o}
                bettingEnabled={bettingEnabled}
                onBet={() => handleBet(o)}
              />
            ))}
            {more > 0 && (
              <a href={detailHref} className="text-gray-500 hover:text-gray-300 text-xs mt-0.5 transition-colors">
                +{more} more · View all →
              </a>
            )}
          </div>

          {bound && marketTradable && bettingBlockedReason && (
            <p className="mt-2 text-amber-300/80 text-[11px]">{bettingBlockedReason}</p>
          )}
        </div>
      </div>

      {marketModals}
    </div>
  )
}
