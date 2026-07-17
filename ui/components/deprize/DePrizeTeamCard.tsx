import { getNFT } from 'thirdweb/extensions/erc721'
import { useReadContract } from 'thirdweb/react'
import { fmt } from '@/lib/deprize/format'
import type { Outcome } from '@/lib/deprize/useDePrizeMarket'
import IPFSRenderer from '@/components/layout/IPFSRenderer'
import StandardButton from '@/components/layout/StandardButton'

type DePrizeTeamCardProps = {
  outcome: Outcome
  teamId: bigint
  teamContract: any
  color: string
  loading: boolean
  // Lifecycle-derived display flags
  resolved: boolean
  isRefundVector: boolean
  isWinningSlot: boolean
  // Value display (ETH). redeemValue set once resolved; sellQuote while trading.
  redeemValueEth?: number
  sellQuoteEth?: number
  investedEth: number
  // Actions + gating
  bettingOpen: boolean
  tradingHalted: boolean
  busy: boolean
  userConnected: boolean
  onBet: (index: number) => void
  onCashOut: (index: number) => void
}

export default function DePrizeTeamCard({
  outcome,
  teamId,
  teamContract,
  color,
  loading,
  resolved,
  isRefundVector,
  isWinningSlot,
  redeemValueEth,
  sellQuoteEth,
  investedEth,
  bettingOpen,
  tradingHalted,
  busy,
  userConnected,
  onBet,
  onCashOut,
}: DePrizeTeamCardProps) {
  const { data: teamNFT } = useReadContract(getNFT, {
    contract: teamContract,
    tokenId: BigInt(teamId),
    queryOptions: { enabled: !!teamContract },
  })

  const teamName = (teamNFT as any)?.metadata?.name || `Team #${teamId.toString()}`
  const teamImage = (teamNFT as any)?.metadata?.image || ''

  const holding = Number.isFinite(outcome.balance) && outcome.balance > 0
  const realizedValue = resolved ? redeemValueEth : sellQuoteEth
  const pnl =
    realizedValue !== undefined && investedEth > 0
      ? realizedValue - investedEth
      : undefined

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-br from-gray-900 to-blue-900/20 border border-white/10">
      {/* Top row: chance/result · team identity · actions */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-[110px]">
          <span
            className="inline-block w-2.5 h-8 rounded-full shrink-0"
            style={{ background: color }}
          />
          <div>
            <p
              className={`text-2xl font-bold leading-none ${
                resolved
                  ? isWinningSlot
                    ? 'text-moon-green'
                    : isRefundVector
                      ? 'text-white'
                      : 'text-gray-500'
                  : 'text-white'
              }`}
            >
              {resolved
                ? isWinningSlot
                  ? 'WON'
                  : isRefundVector
                    ? 'Refund'
                    : 'Lost'
                : Number.isNaN(outcome.probability)
                  ? loading
                    ? '…'
                    : '—'
                  : `${fmt(outcome.probability, 0)}%`}
            </p>
            {!resolved && <p className="text-gray-500 text-[10px] mt-1">chance</p>}
          </div>
        </div>

        <div className="flex-1 min-w-[150px] flex items-center gap-3">
          {teamImage && (
            <IPFSRenderer
              className="rounded-full"
              src={teamImage}
              width={40}
              height={40}
              alt={teamName}
            />
          )}
          <p className="text-white font-semibold">{teamName}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {bettingOpen && !tradingHalted && (
            <StandardButton
              onClick={() => onBet(outcome.index)}
              disabled={busy || !userConnected}
              className="rounded-full"
              backgroundColor="bg-moon-green"
            >
              Back this team
            </StandardButton>
          )}
          {holding && !tradingHalted && !resolved && (
            <StandardButton
              onClick={() => onCashOut(outcome.index)}
              disabled={busy || !userConnected}
              className="rounded-full"
              backgroundColor="bg-moon-orange"
            >
              {sellQuoteEth !== undefined
                ? `Cash out ≈ ${fmt(sellQuoteEth)} ETH`
                : 'Cash out'}
            </StandardButton>
          )}
        </div>
      </div>

      {/* Position summary */}
      {holding && (
        <div className={`mt-3 grid gap-2 ${resolved ? 'grid-cols-2' : 'grid-cols-3'}`}>
          <div className="rounded-xl bg-black/30 border border-white/10 px-3 py-2">
            <p className="text-[10px] text-gray-500">
              {resolved ? 'Claimable' : 'Cash out'}
            </p>
            <p className="text-sm font-semibold text-white">
              {resolved
                ? redeemValueEth !== undefined
                  ? `${fmt(redeemValueEth)} ETH`
                  : '—'
                : tradingHalted
                  ? '—'
                  : sellQuoteEth !== undefined
                    ? `${fmt(sellQuoteEth)} ETH`
                    : '…'}
            </p>
          </div>
          {!resolved && (
            <div className="rounded-xl bg-black/30 border border-white/10 px-3 py-2">
              <p className="text-[10px] text-gray-500">If this wins</p>
              <p className="text-sm font-semibold text-moon-green">
                {fmt(outcome.balance)} ETH
              </p>
            </div>
          )}
          <div className="rounded-xl bg-black/30 border border-white/10 px-3 py-2">
            <p className="text-[10px] text-gray-500">Profit</p>
            <p
              className={`text-sm font-semibold ${
                pnl === undefined
                  ? 'text-gray-400'
                  : pnl >= 0
                    ? 'text-moon-green'
                    : 'text-red-400'
              }`}
            >
              {pnl === undefined ? '—' : `${pnl >= 0 ? '+' : ''}${fmt(pnl)} ETH`}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
