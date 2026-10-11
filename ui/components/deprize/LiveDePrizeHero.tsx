// Featured card for a live on-chain DePrize that is not bound to a Moon Base
// Zero race (today: Arbitrum #1, The Moon Is A Harsh Mistress). The index's
// RaceMarketCard grid only covers atlas races, so without this the real
// Arbitrum competition would never appear on /deprize.
import TeamABI from 'const/abis/Team.json'
import { DEPRIZE_MINT_ADDRESSES, TEAM_ADDRESSES } from 'const/config'
import { useMemo, useState } from 'react'
import { getContract, type Chain } from 'thirdweb'
import { deprizePrefixedHref, getDePrizeCompetition } from '@/lib/deprize/competitions'
import { DEPRIZE_PREDICT_CTA, DePrizeState, OUTCOME_COLORS, UNIT } from '@/lib/deprize/constants'
import { isMintConfigured, reconcileBettingStatus } from '@/lib/deprize/status'
import { useDePrize } from '@/lib/deprize/useDePrize'
import { useDePrizeMarket } from '@/lib/deprize/useDePrizeMarket'
import { useDePrizePrizePool } from '@/lib/deprize/useDePrizePrizePool'
import client from '@/lib/thirdweb/client'
import BetModal from '@/components/deprize/BetModal'
import { useDePrizeTeamNames } from '@/components/deprize/DePrizeTeamLink'
import HeroOddsChart from '@/components/deprize/HeroOddsChart'
import MarketHero from '@/components/deprize/MarketHero'
import MarketOutcomeRow from '@/components/deprize/MarketOutcomeRow'
import PrizeAvailable from '@/components/deprize/PrizeAvailable'
import { TOUCH } from '@/components/deprize/detail/primitives'

type Props = {
  deprizeId: number
  chain: Chain
  chainSlug: string
  account: any
  userAddress?: string
  spendableEth: number
  bettingBlockedReason?: string
  onDone: () => void
  /** False while this slide is off-screen in the carousel — skips the chart's log scan. */
  active?: boolean
}

const HERO_ROWS = 5

export default function LiveDePrizeHero({
  deprizeId,
  chain,
  chainSlug,
  account,
  userAddress,
  spendableEth,
  bettingBlockedReason,
  onDone,
  active = true,
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
  const poolEth = balanceWei != null && !poolLoading ? Number(balanceWei) / Number(UNIT) : undefined

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
  const teamNames = useDePrizeTeamNames(deprize?.teamIds, teamContract)

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

  const colors = useMemo(
    () => (deprize?.teamIds ?? []).map((_, i) => OUTCOME_COLORS[i % OUTCOME_COLORS.length]),
    [deprize?.teamIds]
  )

  const ranked = useMemo(() => {
    if (!deprize?.teamIds.length) return []
    return deprize.teamIds
      .map((teamId, index) => ({
        index,
        teamId,
        color: colors[index],
        probability: market.outcomes[index]?.probability ?? 0,
      }))
      .sort((a, b) => b.probability - a.probability)
  }, [deprize?.teamIds, market.outcomes, colors])

  const detailHref = deprizePrefixedHref(chainSlug, deprizeId)
  const forecastHref = `${detailHref}#deprize-forecast`
  const betOutcome = betIndex !== null ? market.outcomes[betIndex] : undefined
  const showPredict = !!bettingBlockedReason
  const more = ranked.length - HERO_ROWS

  return (
    <>
      <MarketHero
        eyebrow={
          <>
            <span className="inline-flex items-center gap-1.5 font-semibold text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              Live
            </span>
            <span className="text-gray-600">·</span>
            <span>{chain.name ?? 'On-chain'}</span>
          </>
        }
        title={competition.title}
        subtitle={competition.tagline}
        href={detailHref}
        rows={
          <>
            {ranked.slice(0, HERO_ROWS).map((o) => (
              <MarketOutcomeRow
                key={o.index}
                size="hero"
                name={teamNames[o.index] ?? `Team #${o.teamId.toString()}`}
                color={o.color}
                probability={o.probability}
                showOdds
                heldQty={
                  (market.outcomes[o.index]?.balance ?? 0) > 0
                    ? market.outcomes[o.index]?.balance
                    : undefined
                }
                onPredict={bettingEnabled ? () => setBetIndex(o.index) : undefined}
              />
            ))}
            {more > 0 && (
              <a href={detailHref} className="mt-1 text-xs text-gray-500 hover:text-gray-300">
                +{more} more
              </a>
            )}
            {!registryLoading && ranked.length === 0 && (
              <p className="py-2 text-sm text-gray-500">
                Loading market… or switch your wallet to Arbitrum.
              </p>
            )}
          </>
        }
        chart={
          active && numOutcomes > 0 ? (
            <HeroOddsChart
              deprizeId={deprizeId}
              market={market}
              chain={chain}
              labels={teamNames}
              colors={colors}
            />
          ) : null
        }
        pool={<PrizeAvailable eth={poolEth} loading={poolLoading} />}
        footer={
          <div className="flex flex-wrap items-center gap-3">
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
              className="text-sm text-indigo-300 hover:text-indigo-200 transition-colors"
            >
              Open market →
            </a>
          </div>
        }
        notice={
          showPredict ? (
            <p className="mt-3 text-xs text-amber-200/90">{bettingBlockedReason}</p>
          ) : undefined
        }
      />

      {betOutcome && account && market.marketAddress && (
        <BetModal
          deprizeId={deprizeId}
          outcomeIndex={betIndex!}
          teamName={teamNames[betIndex!] ?? `Team #${betIndex}`}
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
    </>
  )
}
