// "Also on this landing" — the side markets attached to a race, under the
// competitor roster in SharedGoalPanel.
//
// Touchdown asks which operator lands next. These ask what the landing looks
// like. Rules of record: docs/DEPRIZE_SIDE_MARKETS.md.
//
// One market is expanded at a time, by design. The panel already mounts a
// single DePrize market for the open race (the "mount one market" rule in
// docs/DEPRIZE_PHASE_B1.md), and this page is also running a WebGL scene —
// fanning out a poll per side market would multiply that cost for rows the
// user has not looked at. Collapsed rows render from the curator prior, which
// needs no chain read at all.

import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import DemoBetModal from '@/components/deprize/DemoBetModal'
import { fmt } from '@/lib/deprize/format'
import { exitMockPosition, useMockMarket } from '@/lib/deprize/mockMarket'
import {
  getSideMarketsForGoal,
  sideMarketDemoKey,
  sideMarketPriorOdds,
  type SideMarket,
} from '@/lib/deprize/sideMarkets'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'

type SideMarketsSectionProps = {
  chainSlug?: string
  /** Parent race. Side markets attach to this, they never own it. */
  parentGoalId: string
  userAddress?: string
  onConnectWallet?: () => void
  /** Bump the parent's refresh after a demo bet or cash out. */
  onDone?: () => void
}

export default function SideMarketsSection({
  chainSlug,
  parentGoalId,
  userAddress,
  onConnectWallet,
  onDone,
}: SideMarketsSectionProps) {
  const markets = getSideMarketsForGoal(chainSlug ?? '', parentGoalId)
  const [openKey, setOpenKey] = useState<string | null>(null)

  // A stale expansion from a previous race would mount the wrong market.
  useEffect(() => setOpenKey(null), [parentGoalId])

  if (markets.length === 0) return null

  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/40">
        Also on this landing
      </h3>
      <p className="mb-2 text-[11px] leading-relaxed text-white/40">
        The race above asks who lands next. These ask what the landing looks
        like.
      </p>
      <div className="space-y-2">
        {markets.map((market) => (
          <SideMarketRow
            key={market.key}
            market={market}
            expanded={openKey === market.key}
            onToggle={() =>
              setOpenKey((current) => (current === market.key ? null : market.key))
            }
            userAddress={userAddress}
            onConnectWallet={onConnectWallet}
            onDone={onDone}
          />
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-white/40">
        A side market has no purse and no competitor. Nobody is paid for causing
        one of these outcomes.
      </p>
    </div>
  )
}

function SideMarketRow({
  market,
  expanded,
  onToggle,
  userAddress,
  onConnectWallet,
  onDone,
}: {
  market: SideMarket
  expanded: boolean
  onToggle: () => void
  userAddress?: string
  onConnectWallet?: () => void
  onDone?: () => void
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-white/90">
            {market.label}
          </span>
          <span className="mt-0.5 block text-[11px] leading-snug text-white/45">
            {market.question}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {market.status === 'live' ? (
            <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-200">
              Live
            </span>
          ) : (
            <span
              className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-fuchsia-200"
              title="No on-chain market yet — betting here is simulated and only updates odds shown in this browser."
            >
              Demo
            </span>
          )}
          <ChevronDownIcon
            className={`h-4 w-4 text-white/40 transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </span>
      </button>

      {expanded && (
        <SideMarketOutcomes
          market={market}
          userAddress={userAddress}
          onConnectWallet={onConnectWallet}
          onDone={onDone}
        />
      )}
    </div>
  )
}

/**
 * Outcome rows for one expanded side market.
 *
 * Split out so `useMockMarket` only mounts for the market actually on screen —
 * a hook in the parent would run for every row whether or not it is open.
 */
function SideMarketOutcomes({
  market,
  userAddress,
  onConnectWallet,
  onDone,
}: {
  market: SideMarket
  userAddress?: string
  onConnectWallet?: () => void
  onDone?: () => void
}) {
  const demoKey = sideMarketDemoKey(market.key)
  const outcomeKeys = market.outcomes.map((o) => o.key)
  const priors = sideMarketPriorOdds(market)
  const demo = useMockMarket(demoKey, outcomeKeys, priors, userAddress)
  const [betKey, setBetKey] = useState<string | null>(null)

  // Highest chance first, ties keep definition order. Never sort the
  // definition itself: outcome order is the CTF slot order once registered.
  const ranked = [...market.outcomes].sort(
    (a, b) => (demo.odds[b.key] ?? 0) - (demo.odds[a.key] ?? 0)
  )

  const handleBack = (key: string) => {
    if (!userAddress) {
      onConnectWallet?.()
      return
    }
    setBetKey(key)
  }

  const handleExit = (key: string, label: string) => {
    const valueEth = exitMockPosition(demoKey, key, userAddress)
    toast.success(`Cashed out ${label} (demo) for \u2248 ${fmt(valueEth)} ETH.`, {
      style: toastStyle,
    })
    onDone?.()
  }

  return (
    <div className="border-t border-white/10 px-3 pb-3 pt-2">
      <ul className="space-y-1.5">
        {ranked.map((outcome) => {
          const pct = demo.odds[outcome.key] ?? outcome.prior * 100
          const position = demo.positions[outcome.key]
          return (
            <li
              key={outcome.key}
              className="relative overflow-hidden rounded-md border border-white/10 bg-white/[0.02]"
            >
              <div
                aria-hidden
                className="absolute inset-y-0 left-0 bg-fuchsia-400/[0.14]"
                style={{ width: `${Math.round(pct)}%` }}
              />
              <div className="relative px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm text-white/90">
                    {outcome.label}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-white">
                    {Math.round(pct)}%
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-white/45">
                  {outcome.criterion}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleBack(outcome.key)}
                    className="rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-2.5 py-0.5 text-[11px] font-medium text-fuchsia-100 transition hover:bg-fuchsia-500/20"
                  >
                    {userAddress ? 'Back this' : 'Connect'}
                  </button>
                  {position && (
                    <>
                      <span className="text-[11px] text-white/45">
                        You hold {fmt(position.qty)} · cost {fmt(position.costEth)} ETH
                      </span>
                      <button
                        type="button"
                        onClick={() => handleExit(outcome.key, outcome.label)}
                        className="rounded-full border border-white/15 px-2.5 py-0.5 text-[11px] text-white/70 transition hover:bg-white/10"
                      >
                        Cash out
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <p className="mt-2 text-[11px] leading-relaxed text-white/35">
        {market.status === 'live'
          ? 'Live market-implied probabilities.'
          : 'Illustrative curator priors — live odds replace these when the market opens.'}
      </p>

      {betKey !== null && (
        <DemoBetModal
          sharedGoalId={demoKey}
          projectIds={outcomeKeys}
          impliedOdds={priors}
          projectId={betKey}
          teamName={
            market.outcomes.find((o) => o.key === betKey)?.label ?? 'this outcome'
          }
          probability={demo.odds[betKey] ?? 0}
          address={userAddress}
          kind="market"
          onClose={() => setBetKey(null)}
          onDone={() => onDone?.()}
        />
      )}
    </div>
  )
}
