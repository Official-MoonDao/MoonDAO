// Featured card for a live on-chain DePrize that is not bound to a Moon Base
// Zero race (today: Arbitrum #1, The Moon Is A Harsh Mistress). The index's
// RaceMarketCard grid only covers atlas races, so without this the real
// Arbitrum competition would never appear on /deprize.
import TeamABI from 'const/abis/Team.json'
import { DEPRIZE_MINT_ADDRESSES, TEAM_ADDRESSES } from 'const/config'
import { useMemo, useState } from 'react'
import { getContract, type Chain } from 'thirdweb'
import { deprizePrefixedHref, getDePrizeCompetition } from '@/lib/deprize/competitions'
import {
  DEPRIZE_PREDICT_CTA,
  DEPRIZE_TERMS_VERSION,
  DePrizeState,
  OUTCOME_COLORS,
  UNIT,
} from '@/lib/deprize/constants'
import { payloadCopy, payloadCopyMode } from '@/lib/deprize/payloadPurse'
import { fmt } from '@/lib/deprize/format'
import { isMintConfigured, reconcileBettingStatus } from '@/lib/deprize/status'
import { useDePrize } from '@/lib/deprize/useDePrize'
import { useDePrizeMarket } from '@/lib/deprize/useDePrizeMarket'
import { useDePrizePrizePool } from '@/lib/deprize/useDePrizePrizePool'
import client from '@/lib/thirdweb/client'
import BetModal from '@/components/deprize/BetModal'
import { TOUCH } from '@/components/deprize/detail/primitives'
import EthUsd from '@/components/deprize/EthUsd'
import { useDePrizeTeamName } from '@/components/deprize/DePrizeTeamLink'

type Props = {
  deprizeId: number
  chain: Chain
  chainSlug: string
  account: any
  userAddress?: string
  spendableEth: number
  bettingBlockedReason?: string
  onDone: () => void
}

function OutcomeName({ teamId, teamContract }: { teamId: bigint; teamContract: any }) {
  const name = useDePrizeTeamName(teamId, teamContract)
  return <>{name}</>
}

export default function LiveDePrizeHero({
  deprizeId,
  chain,
  chainSlug,
  account,
  userAddress,
  spendableEth,
  bettingBlockedReason,
  onDone,
}: Props) {
  const competition = getDePrizeCompetition(chainSlug, deprizeId)
  const { deprize, loading: registryLoading } = useDePrize(deprizeId, chain)
  const numOutcomes = deprize?.teamIds.length ?? 0

  const market = useDePrizeMarket({
    deprizeId,
    conditionId: deprize?.conditionId,
    numOutcomes,
    chain,
    userAddress,
    registryState: deprize?.state,
  })

  const jbProjectId = deprize && deprize.jbProjectId > 0n ? Number(deprize.jbProjectId) : undefined
  const { balanceWei, loading: poolLoading } = useDePrizePrizePool(jbProjectId, chain.id)
  const poolEth =
    balanceWei != null && !poolLoading ? Number(balanceWei) / Number(UNIT) : undefined

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
    [chain, chainSlug]
  )

  const mintAddress = DEPRIZE_MINT_ADDRESSES[chainSlug] ?? ''
  const betting = reconcileBettingStatus({
    registryState: deprize?.state ?? DePrizeState.NONE,
    bettingOpen: !!deprize?.bettingOpen,
    marketStage: market.stage,
    mintConfigured: isMintConfigured(mintAddress),
    marketBound: market.mintBound,
  })

  const bettingEnabled =
    !!account &&
    !!deprize?.bettingOpen &&
    !betting.bettingBlockedReason &&
    !bettingBlockedReason &&
    !!market.marketAddress

  const [betIndex, setBetIndex] = useState<number | null>(null)

  const ranked = useMemo(() => {
    if (!deprize?.teamIds.length) return []
    return deprize.teamIds
      .map((teamId, index) => ({
        index,
        teamId,
        color: OUTCOME_COLORS[index % OUTCOME_COLORS.length],
        probability: market.outcomes[index]?.probability ?? 0,
      }))
      .sort((a, b) => b.probability - a.probability)
  }, [deprize?.teamIds, market.outcomes])

  const detailHref = deprizePrefixedHref(chainSlug, deprizeId)
  const forecastHref = `${detailHref}#deprize-forecast`
  const betOutcome = betIndex !== null ? market.outcomes[betIndex] : undefined
  const showPredict = !!bettingBlockedReason

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-indigo-950/50 backdrop-blur-xl border border-indigo-400/25 shadow-xl overflow-hidden">
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div className="min-w-0">
            <a
              href={detailHref}
              className="block min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-lg"
            >
              <p className="text-white font-GoodTimes text-xl sm:text-2xl leading-snug">
                {competition.title}
              </p>
            </a>
            <p className="mt-1.5 text-sm text-gray-400 max-w-xl">{competition.tagline}</p>
          </div>
          {/* Wrapped onto its own line on a phone, this block kept its right
              alignment and read as detached from the prize it belongs to. */}
          <div className="w-full sm:w-auto text-left sm:text-right sm:shrink-0">
            <p className="text-white text-2xl sm:text-3xl font-bold tabular-nums">
              {poolLoading ? (
                '…'
              ) : (
                <EthUsd
                  eth={poolEth}
                  prize
                  layout="below"
                  className="text-white text-2xl sm:text-3xl font-bold tabular-nums"
                  usdClassName="text-gray-400 text-sm font-medium"
                />
              )}
            </p>
            <p className="text-gray-500 text-[10px] uppercase tracking-wide">
              {payloadCopy('heroPoolLabel', payloadCopyMode(DEPRIZE_TERMS_VERSION))}
            </p>
          </div>
        </div>

        {ranked.length > 0 && (
          <div className="flex w-full h-2 rounded-full overflow-hidden bg-white/5 mb-4">
            {ranked.map((o) => (
              <div
                key={o.index}
                style={{
                  width: `${Math.max(0, Math.min(100, o.probability))}%`,
                  background: o.color,
                }}
              />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          {ranked.map((o) => {
            const pct = Number.isFinite(o.probability) ? fmt(o.probability, 0) : undefined
            return (
              <div
                key={o.index}
                className="relative flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 overflow-hidden"
              >
                <div
                  className="absolute inset-y-0 left-0 opacity-[0.14] pointer-events-none"
                  style={{
                    width: `${Math.max(0, Math.min(100, o.probability))}%`,
                    background: o.color,
                  }}
                />
                <span
                  className="relative z-10 w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: o.color }}
                />
                <span className="relative z-10 flex-1 min-w-0 truncate text-sm text-white/90">
                  <OutcomeName teamId={o.teamId} teamContract={teamContract} />
                </span>
                <span className="relative z-10 shrink-0 text-sm font-semibold tabular-nums text-gray-200">
                  {pct !== undefined ? `${pct}%` : '—'}
                </span>
                {bettingEnabled && (
                  <button
                    type="button"
                    onClick={() => setBetIndex(o.index)}
                    className={`relative z-10 shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold
                      bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white
                      transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 ${TOUCH}`}
                  >
                    Buy
                  </button>
                )}
              </div>
            )
          })}
          {!registryLoading && ranked.length === 0 && (
            <p className="text-sm text-gray-500 py-2">
              Loading market… or switch your wallet to Arbitrum.
            </p>
          )}
        </div>

        {showPredict && (
          <p className="mt-3 text-xs text-amber-200/90">{bettingBlockedReason}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {showPredict && (
            <a
              href={forecastHref}
              className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold
                bg-white/10 hover:bg-white/15 text-white transition-all
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 ${TOUCH}`}
            >
              {DEPRIZE_PREDICT_CTA}
            </a>
          )}
          <a
            href={detailHref}
            className="inline-flex text-sm text-indigo-300 hover:text-indigo-200 transition-colors"
          >
            Open full market →
          </a>
        </div>
      </div>

      {betOutcome && account && market.marketAddress && (
        <BetModal
          deprizeId={deprizeId}
          outcomeIndex={betIndex!}
          teamName={
            // Resolved on the detail page via NFT; here the modal just needs a label.
            `Team #${deprize?.teamIds[betIndex!]?.toString() ?? betIndex}`
          }
          probability={betOutcome.probability}
          numOutcomes={numOutcomes}
          mintAddress={mintAddress}
          marketAddress={market.marketAddress}
          jbProjectId={deprize?.jbProjectId}
          chain={chain}
          account={account}
          spendableEth={spendableEth}
          onClose={() => setBetIndex(null)}
          onDone={() => {
            setBetIndex(null)
            onDone()
          }}
        />
      )}
    </div>
  )
}
