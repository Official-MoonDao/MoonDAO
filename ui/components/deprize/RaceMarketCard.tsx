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
import toast from 'react-hot-toast'
import type { Chain } from 'thirdweb'
import {
  deprizeForecastHref,
  deprizePrefixedHref,
  findDePrizeIdForGoal,
  getDePrizeRaceBinding,
  isCompetitiveRace,
  isDePrizeGoalMarketBound,
} from '@/lib/deprize/competitions'
import {
  DEPRIZE_PREDICT_CTA,
  DEPRIZE_RESTRICTED_PREDICT_COPY,
  MarketStage,
  OUTCOME_COLORS,
  UNIT,
} from '@/lib/deprize/constants'
import { fmt } from '@/lib/deprize/format'
import { exitMockPosition, useMockMarket } from '@/lib/deprize/mockMarket'
import { raceCardHeading } from '@/lib/deprize/raceCardHeading'
import { isMintConfigured } from '@/lib/deprize/status'
import { useDePrizeGoalOdds } from '@/lib/deprize/useDePrizeGoalOdds'
import useTotalFunding from '@/lib/juicebox/useTotalFunding'
import {
  goalIndexCategory,
  PROJECT_TYPE_COLOR,
  PROJECT_TYPE_LABEL,
} from '@/lib/lunar-atlas/display'
import type { Organization, Project, SharedGoal } from '@/lib/lunar-atlas/types'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import BetModal from '@/components/deprize/BetModal'
import CategoryIcon from '@/components/deprize/CategoryIcon'
import ClaimPanel from '@/components/deprize/ClaimPanel'
import DemoBetModal from '@/components/deprize/DemoBetModal'
import ExitPositionModal from '@/components/deprize/ExitPositionModal'
import HeroOddsChart from '@/components/deprize/HeroOddsChart'
import MarketHero from '@/components/deprize/MarketHero'
import MarketOutcomeRow from '@/components/deprize/MarketOutcomeRow'
import PrizeAvailable from '@/components/deprize/PrizeAvailable'

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

function RaceCardTitle({
  goal,
  titleClassName,
}: {
  goal: { id: string; title: string }
  titleClassName: string
}) {
  const { name, subtitle } = raceCardHeading(goal)
  return (
    <>
      <p className={titleClassName}>{name}</p>
      {subtitle && (
        <p className="mt-0.5 text-[11px] sm:text-xs leading-snug text-gray-400 line-clamp-2">
          {subtitle}
        </p>
      )}
    </>
  )
}

function MoonbaseLink({ goalId }: { goalId: string }) {
  return (
    <a
      href={`/moonbase?race=${goalId}`}
      className="shrink-0 text-[11px] text-indigo-300/90 hover:text-indigo-200 transition-colors"
    >
      See in Moonbase
    </a>
  )
}

function PredictLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="inline-flex px-3 py-1 rounded-full text-xs font-semibold
        bg-white/10 hover:bg-white/15 text-white transition-all
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
    >
      {DEPRIZE_PREDICT_CTA}
    </a>
  )
}

function StatusPill({
  label,
  tone,
}: {
  label: string
  tone: 'live' | 'paused' | 'demo' | 'resolved' | 'concept'
}) {
  const cls: Record<typeof tone, string> = {
    live: 'text-moon-green border-moon-green/40 bg-moon-green/15',
    paused: 'text-amber-300 border-amber-500/40 bg-amber-500/15',
    demo: 'text-fuchsia-200 border-fuchsia-400/30 bg-fuchsia-500/10',
    resolved: 'text-gray-300 border-white/20 bg-white/10',
    concept: 'text-fuchsia-200 border-fuchsia-400/30 bg-fuchsia-500/10',
  } as const
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls[tone]}`}
    >
      {label}
    </span>
  )
}

function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold text-red-400">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
      Live
    </span>
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
  active = true,
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
  /** Featured only: false while the carousel slide is off-screen, which skips its chart. */
  active?: boolean
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
            (o) => !o.field && o.projectId === c.project.id
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
    [competitors, bound, binding, live.outcomes, live.oddsByProjectId, demo.odds, demo.positions]
  )

  // The chart plots market outcomes in on-chain order, including the open field.
  const chartSeries = useMemo(() => {
    const byProject = new Map(outcomes.map((o) => [o.projectId, o]))
    const rows = (binding?.outcomes ?? []).map((o) => {
      const row = o.field ? undefined : byProject.get(o.projectId)
      return { label: row?.name ?? 'Open field', color: row?.color ?? '#6b7280' }
    })
    return { labels: rows.map((r) => r.label), colors: rows.map((r) => r.color) }
  }, [binding, outcomes])

  const heldOutcomes = useMemo(() => outcomes.filter((o) => !!o.heldQty), [outcomes])
  const hasPosition = heldOutcomes.length > 0
  useEffect(() => {
    onHasPosition(goal.id, hasPosition)
  }, [goal.id, hasPosition, onHasPosition])

  // A single entrant has nowhere for odds to point — see isCompetitiveRace.
  // Every odds bar, Buy button, and pool figure below is gated on this so a
  // capability nobody has committed to building yet reads as an open goal,
  // not a market with a "leading" competitor priced at 100%.
  const hasRace = isCompetitiveRace(competitors.length)

  const tradingHalted = live.tradingHalted
  // Whether the on-chain market itself is tradable, independent of region —
  // drives the status pill so "Paused" always reflects the real market state.
  const marketTradable =
    !!live.bettingOpen &&
    live.mintBound &&
    isMintConfigured(live.mintAddress) &&
    !tradingHalted &&
    live.stage === MarketStage.Running
  // Buy and live odds only exist on a bound on-chain market. Unbound races
  // are a planning list: company names, no mock prices, no demo pool.
  const bettingOpenReal = marketTradable && !bettingBlockedReason
  // The index no longer banners the region block. Betting stays closed; the
  // sentence itself is not repeated on the card.
  const shownBlockedReason =
    bettingBlockedReason === DEPRIZE_RESTRICTED_PREDICT_COPY ? undefined : bettingBlockedReason
  const showLiveMarket = bound && hasRace
  const bettingEnabled = showLiveMarket && bettingOpenReal
  const forecastHref =
    bound && !!bettingBlockedReason && deprizeId !== undefined
      ? deprizeForecastHref(deprizeId)
      : undefined

  // Stage is unknown until the first market read returns. Treating that as
  // "not Running" painted every live race as Paused, then flipped to Live.
  // Later polls set `loading` again; those must not hide a status we already have.
  const awaitingMarket = bound && hasRace && !live.resolved && live.stage === undefined
  const statusTone: 'live' | 'paused' | 'demo' | 'resolved' | 'concept' | null = !hasRace
    ? 'concept'
    : !bound
    ? 'demo'
    : live.resolved
    ? 'resolved'
    : awaitingMarket
    ? null
    : marketTradable
    ? 'live'
    : 'paused'
  const statusLabel = statusTone
    ? {
        live: 'Live',
        paused: 'Paused',
        demo: 'Planned',
        resolved: 'Resolved',
        concept: 'Planned',
      }[statusTone]
    : null
  // Live and Planned are the section headings. The pill stays for a market
  // that is paused or already settled, which those headings do not say.
  const showStatusPill = statusTone === 'paused' || statusTone === 'resolved'

  const category = goalIndexCategory(goal) ?? 'other'
  const categoryLabel = PROJECT_TYPE_LABEL[category]
  const categoryColor = PROJECT_TYPE_COLOR[category]

  const poolEth = bound ? realPoolEth : demo.pool
  const poolLoading = bound && live.jbProjectId !== undefined && isLoadingFunding

  // Always the prize page. Bound races resolve the slug to the live DePrize;
  // unbound ones render the atlas detail at the same URL. Never moonbase —
  // the globe is a secondary link from the prize page, not the destination.
  const detailHref = deprizePrefixedHref(chainSlug, deprizeId ?? goal.id)

  const ranked = useMemo(
    () => [...outcomes].sort((a, b) => (b.probability || 0) - (a.probability || 0)),
    [outcomes]
  )
  // Unbound races keep roster order. Sorting them by mock odds would present
  // a fake leader.
  const ordered = showLiveMarket ? ranked : outcomes
  const top = ordered.slice(0, 4)
  const more = ordered.length - top.length

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
    toast.success(`Cashed out ${outcome.name} (demo) for ≈ ${fmt(valueEth)} ETH.`, {
      style: toastStyle,
    })
    onDone()
  }

  const betOutcome =
    realBetIndex !== null ? outcomes.find((o) => o.outcomeIndex === realBetIndex) : undefined
  const demoBetOutcome = demoBetProjectId
    ? outcomes.find((o) => o.projectId === demoBetProjectId)
    : undefined

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
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.035] overflow-hidden">
        <div className="p-4 sm:p-5 flex items-start gap-3">
          <div
            className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
            style={{
              background: `${categoryColor}22`,
              border: `1px solid ${categoryColor}55`,
              color: categoryColor,
            }}
          >
            <CategoryIcon category={category} className="w-5 h-5" />
          </div>
          <a
            href={detailHref}
            className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-lg"
          >
            <RaceCardTitle
              goal={goal}
              titleClassName="text-white font-heading font-semibold text-base"
            />
            <p className="text-gray-500 text-xs mt-0.5">{categoryLabel}</p>
          </a>
          <MoonbaseLink goalId={goal.id} />
          {showStatusPill && statusLabel && statusTone && (
            <StatusPill label={statusLabel} tone={statusTone} />
          )}
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
    const gridTop = ordered.slice(0, 3)
    const gridMore = ordered.length - gridTop.length
    return (
      <div className="flex h-full flex-col rounded-xl border border-white/[0.08] bg-white/[0.035] transition-colors hover:border-white/20 hover:bg-white/[0.05]">
        <a
          href={detailHref}
          className="flex items-start gap-3 rounded-t-xl px-4 pt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          <div
            className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: `${categoryColor}1f`, color: categoryColor }}
          >
            <CategoryIcon category={category} className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <RaceCardTitle
              goal={goal}
              titleClassName="text-white font-heading font-semibold text-[15px] leading-snug"
            />
          </div>
        </a>

        <div className="mt-2 flex items-center gap-1.5 px-4 text-[11px] text-gray-400">
          {statusTone === 'live' && (
            <>
              <LiveDot />
              <span className="text-gray-600">·</span>
            </>
          )}
          <span className="truncate">{categoryLabel}</span>
          {goal.targetWindow && statusTone !== 'live' && (
            <>
              <span className="text-gray-600">·</span>
              <span className="tabular-nums">
                {goal.targetWindow.from ?? '?'}–{goal.targetWindow.to ?? '?'}
              </span>
            </>
          )}
          {showStatusPill && statusLabel && statusTone && (
            <StatusPill label={statusLabel} tone={statusTone} />
          )}
        </div>

        <div className="flex flex-1 flex-col px-4 pb-3 pt-2">
          {gridTop.map((o) => (
            <MarketOutcomeRow
              key={o.projectId}
              name={o.name}
              color={o.color}
              probability={o.probability}
              showOdds={showLiveMarket}
              heldQty={o.heldQty}
              onPredict={bettingEnabled ? () => handleBet(o) : undefined}
            />
          ))}
          {gridMore > 0 && (
            <a
              href={detailHref}
              className="mt-1 text-[11px] text-gray-500 transition-colors hover:text-gray-300"
            >
              +{gridMore} more
            </a>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-white/[0.06] text-[11px] text-gray-500 flex items-center justify-between gap-2">
          {showLiveMarket ? (
            <span className="min-w-0">
              <PrizeAvailable eth={poolEth} loading={poolLoading} size="footer" />
            </span>
          ) : !hasRace ? (
            <span>No committed developer — not an active competition</span>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-3 shrink-0">
            {forecastHref && <PredictLink href={forecastHref} />}
            <MoonbaseLink goalId={goal.id} />
          </span>
        </div>

        {marketModals}
      </div>
    )
  }

  // --- Featured view: hero card for the top of the index ---
  if (variant === 'featured') {
    const featuredTop = ordered.slice(0, 5)
    const featuredMore = ordered.length - featuredTop.length
    const heading = raceCardHeading(goal)
    return (
      <>
        <MarketHero
          eyebrow={
            <>
              <CategoryIcon category={category} className="w-3.5 h-3.5" />
              <span>{categoryLabel}</span>
              {statusTone === 'live' && (
                <>
                  <span className="text-gray-600">·</span>
                  <LiveDot />
                </>
              )}
              {goal.targetWindow && (
                <>
                  <span className="text-gray-600">·</span>
                  <span className="tabular-nums">
                    {goal.targetWindow.from ?? '?'}–{goal.targetWindow.to ?? '?'}
                  </span>
                </>
              )}
              {showStatusPill && statusLabel && statusTone && (
                <StatusPill label={statusLabel} tone={statusTone} />
              )}
            </>
          }
          title={heading.name}
          subtitle={heading.subtitle}
          href={detailHref}
          rows={
            <>
              {featuredTop.map((o) => (
                <MarketOutcomeRow
                  key={o.projectId}
                  size="hero"
                  name={o.name}
                  color={o.color}
                  probability={o.probability}
                  showOdds={showLiveMarket}
                  heldQty={o.heldQty}
                  onPredict={bettingEnabled ? () => handleBet(o) : undefined}
                />
              ))}
              {featuredMore > 0 && (
                <a
                  href={detailHref}
                  className="mt-1 text-xs text-gray-500 transition-colors hover:text-gray-300"
                >
                  +{featuredMore} more · View all →
                </a>
              )}
            </>
          }
          chart={
            showLiveMarket && active && chartSeries.labels.length > 0 ? (
              <HeroOddsChart
                deprizeId={live.deprizeId}
                market={live.market}
                chain={chain}
                labels={chartSeries.labels}
                colors={chartSeries.colors}
                refreshNonce={refreshNonce}
              />
            ) : !hasRace ? (
              <div className="flex h-full min-h-[160px] items-center justify-center rounded-xl border border-dashed border-white/10 px-6 text-center text-xs text-gray-500">
                No committed developer yet
              </div>
            ) : null
          }
          pool={showLiveMarket ? <PrizeAvailable eth={poolEth} loading={poolLoading} /> : undefined}
          footer={
            <div className="flex flex-wrap items-center gap-3">
              {forecastHref && <PredictLink href={forecastHref} />}
              <MoonbaseLink goalId={goal.id} />
            </div>
          }
          notice={
            bound && marketTradable && shownBlockedReason ? (
              <p className="mt-2 text-amber-300/80 text-[11px]">{shownBlockedReason}</p>
            ) : undefined
          }
        />
        {marketModals}
      </>
    )
  }

  // --- Market list view ---
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.035] hover:border-white/20 transition-colors overflow-hidden">
      <div className="p-4 sm:p-5 flex items-start gap-3">
        <div
          className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
          style={{
            background: `${categoryColor}22`,
            border: `1px solid ${categoryColor}55`,
            color: categoryColor,
          }}
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
                <RaceCardTitle
                  goal={goal}
                  titleClassName="text-white font-heading font-semibold text-base sm:text-lg leading-snug"
                />
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
                {showStatusPill && statusLabel && statusTone && (
                  <StatusPill label={statusLabel} tone={statusTone} />
                )}
                <MoonbaseLink goalId={goal.id} />
              </div>
            </div>
            <div className="text-right shrink-0">
              {showLiveMarket ? (
                <>
                  <PrizeAvailable eth={poolEth} loading={poolLoading} />
                </>
              ) : !hasRace ? (
                <p className="text-gray-500 text-[11px] max-w-[9rem]">No committed developer yet</p>
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex flex-col">
            {top.map((o) => (
              <MarketOutcomeRow
                key={o.projectId}
                name={o.name}
                color={o.color}
                probability={o.probability}
                showOdds={showLiveMarket}
                heldQty={o.heldQty}
                onPredict={bettingEnabled ? () => handleBet(o) : undefined}
              />
            ))}
            {more > 0 && (
              <a
                href={detailHref}
                className="text-gray-500 hover:text-gray-300 text-xs mt-0.5 transition-colors"
              >
                +{more} more · View all →
              </a>
            )}
          </div>

          {forecastHref && (
            <div className="mt-3">
              <PredictLink href={forecastHref} />
            </div>
          )}
          {bound && marketTradable && shownBlockedReason && (
            <p className="mt-2 text-amber-300/80 text-[11px]">{shownBlockedReason}</p>
          )}
        </div>
      </div>

      {marketModals}
    </div>
  )
}
