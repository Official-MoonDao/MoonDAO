// Featured card for a live on-chain DePrize that is not bound to a Moon Base
// Zero race (today: Arbitrum #1, The Moon Is A Harsh Mistress). The index's
// RaceMarketCard grid only covers atlas races, so without this the real
// Arbitrum competition would never appear on /deprize.
import TeamABI from 'const/abis/Team.json'
import { DEPRIZE_MINT_ADDRESSES, TEAM_ADDRESSES } from 'const/config'
import { useMemo, useState } from 'react'
import { getContract, type Chain } from 'thirdweb'
import { getDePrizeCompetition } from '@/lib/deprize/competitions'
import { DePrizeState, MarketStage, OUTCOME_COLORS, UNIT } from '@/lib/deprize/constants'
import { fmt, fmtPrizeEth } from '@/lib/deprize/format'
import { isMintConfigured, reconcileBettingStatus } from '@/lib/deprize/status'
import { useDePrize } from '@/lib/deprize/useDePrize'
import { useDePrizeMarket } from '@/lib/deprize/useDePrizeMarket'
import useTotalFunding from '@/lib/juicebox/useTotalFunding'
import client from '@/lib/thirdweb/client'
import BetModal from '@/components/deprize/BetModal'
import { useDePrizeTeamName } from '@/components/deprize/DePrizeTeamLink'

type Props = {
  deprizeId: number
  chain: Chain
  chainSlug: string
  account: any
  userAddress?: string
  spendableEth: number
  bettingBlockedReason?: string
  onConnectWallet: () => void
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
  onConnectWallet,
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
  const { totalFunding, isLoading: poolLoading } = useTotalFunding(jbProjectId, chain)
  const poolEth =
    jbProjectId !== undefined && !poolLoading ? Number(totalFunding ?? 0) / Number(UNIT) : undefined

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

  const statusTone =
    deprize?.state === DePrizeState.OPEN && market.stage === MarketStage.Paused
      ? 'paused'
      : deprize?.state === DePrizeState.OPEN &&
        !!deprize?.bettingOpen &&
        !betting.bettingBlockedReason
      ? 'live'
      : 'other'
  const statusLabel =
    statusTone === 'live'
      ? 'Live'
      : statusTone === 'paused'
      ? 'Paused'
      : registryLoading
      ? '…'
      : DEPRIZE_STATE_META_LABEL(deprize?.state)

  const detailHref = `/deprize/${deprizeId}`
  const betOutcome = betIndex !== null ? market.outcomes[betIndex] : undefined

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-indigo-950/50 backdrop-blur-xl border border-indigo-400/25 shadow-xl overflow-hidden">
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 border border-indigo-400/30 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-200 mb-1.5">
              ★ Live on Arbitrum
            </span>
            <a
              href={detailHref}
              className="block min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-lg"
            >
              <p className="text-white font-GoodTimes text-xl sm:text-2xl leading-snug">
                {competition.title}
              </p>
            </a>
            <p className="mt-1.5 text-sm text-gray-400 max-w-xl">{competition.tagline}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
              <span>DePrize #{deprizeId}</span>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  statusTone === 'live'
                    ? 'text-moon-green border-moon-green/40 bg-moon-green/15'
                    : statusTone === 'paused'
                    ? 'text-amber-300 border-amber-500/40 bg-amber-500/15'
                    : 'text-gray-300 border-white/20 bg-white/10'
                }`}
              >
                {statusLabel}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-white text-2xl sm:text-3xl font-bold tabular-nums">
              {poolLoading ? '…' : poolEth !== undefined ? fmtPrizeEth(poolEth) : '—'}
              <span className="text-sm font-medium text-gray-400 ml-1.5">ETH</span>
            </p>
            <p className="text-gray-500 text-[10px] uppercase tracking-wide">prize pool</p>
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
                {bettingEnabled ? (
                  <button
                    type="button"
                    onClick={() => setBetIndex(o.index)}
                    className="relative z-10 shrink-0 px-2.5 py-1 rounded-md text-xs font-semibold
                      bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white
                      transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
                  >
                    Buy
                  </button>
                ) : !account ? (
                  <button
                    type="button"
                    onClick={onConnectWallet}
                    className="relative z-10 shrink-0 px-2.5 py-1 rounded-md text-xs font-semibold
                      bg-white/10 hover:bg-white/15 text-white transition-all"
                  >
                    Connect
                  </button>
                ) : null}
              </div>
            )
          })}
          {!registryLoading && ranked.length === 0 && (
            <p className="text-sm text-gray-500 py-2">
              Loading market… or switch your wallet to Arbitrum.
            </p>
          )}
        </div>

        {bettingBlockedReason && (
          <p className="mt-3 text-xs text-amber-200/90">{bettingBlockedReason}</p>
        )}

        <a
          href={detailHref}
          className="mt-4 inline-flex text-sm text-indigo-300 hover:text-indigo-200 transition-colors"
        >
          Open full market →
        </a>
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

function DEPRIZE_STATE_META_LABEL(state: DePrizeState | undefined): string {
  if (state === undefined || state === DePrizeState.NONE) return 'Unavailable'
  if (state === DePrizeState.OPEN) return 'Open'
  if (state === DePrizeState.SETTLED || state === DePrizeState.M1_RELEASED) return 'Resolved'
  if (state === DePrizeState.CANCELLED || state === DePrizeState.NO_WINNER) return 'Closed'
  return 'In progress'
}
