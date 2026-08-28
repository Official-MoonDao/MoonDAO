import { useState } from 'react'
import toast from 'react-hot-toast'
import { fireDePrizeConfetti } from '@/lib/deprize/confetti'
import { fmt } from '@/lib/deprize/format'
import { placeMockBet } from '@/lib/deprize/mockMarket'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import Modal from '@/components/layout/Modal'
import StandardButton from '@/components/layout/StandardButton'

type DemoBetModalProps = {
  sharedGoalId: string
  projectIds: string[]
  impliedOdds: Record<string, number> | undefined
  projectId: string
  teamName: string
  probability: number
  address: string | undefined
  onClose: () => void
  onDone: () => void
}

/**
 * Simulated bet for capability races without a bound on-chain DePrize market
 * yet. Visually mirrors `BetModal` so the demo flow feels like the real one,
 * but never touches a wallet — it just writes to the local demo ledger in
 * `lib/deprize/mockMarket.ts`. Clearly labeled everywhere so nobody mistakes
 * it for a real transaction.
 */
export default function DemoBetModal({
  sharedGoalId,
  projectIds,
  impliedOdds,
  projectId,
  teamName,
  probability,
  address,
  onClose,
  onDone,
}: DemoBetModalProps) {
  const [betAmount, setBetAmount] = useState('')
  const [busy, setBusy] = useState(false)

  const betAmountNum = Number(betAmount) || 0
  const price = Math.max(probability / 100, 0.01)
  const projectedQty = betAmountNum > 0 ? betAmountNum / price : undefined

  const placeBet = () => {
    if (betAmountNum <= 0) {
      toast.error('Enter an amount to bet.', { style: toastStyle })
      return
    }
    setBusy(true)
    try {
      const { qty } = placeMockBet(
        sharedGoalId,
        projectIds,
        impliedOdds,
        projectId,
        address,
        betAmountNum,
      )
      fireDePrizeConfetti()
      toast.success(
        `Demo bet placed on ${teamName}: ${fmt(betAmountNum)} ETH → up to ≈ ${fmt(qty)} ETH if it wins.`,
        { style: toastStyle, duration: 8000 },
      )
      onDone()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal id="deprize-demo-bet" setEnabled={(v) => !v && onClose()} title={`Back ${teamName}`}>
      <div className="flex flex-col gap-4 w-full">
        <div className="p-3 rounded-xl bg-fuchsia-500/10 border border-fuchsia-400/30 text-fuchsia-200 text-xs leading-snug">
          <span className="font-semibold">Demo market.</span> This race doesn&apos;t have a live
          on-chain market yet, so this bet is simulated — no real ETH moves. It only updates the
          odds and position shown in this browser.
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Chance to win</span>
          <span className="text-white font-semibold">
            {Number.isFinite(probability) ? `${fmt(probability, 0)}%` : '—'}
          </span>
        </div>

        <div>
          <label className="text-xs text-gray-400">How much do you want to bet? (Demo ETH)</label>
          <input
            type="number"
            min="0"
            step="any"
            autoFocus
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            placeholder="e.g. 0.01"
            className="mt-1 w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
          />
          <div className="flex gap-2 mt-2 flex-wrap">
            {['0.01', '0.05', '0.1'].map((a) => (
              <button
                key={a}
                onClick={() => setBetAmount(a)}
                className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 text-xs"
              >
                {a} ETH
              </button>
            ))}
          </div>
        </div>

        {betAmountNum > 0 && (
          <div className="p-4 rounded-xl bg-black/30 border border-white/10 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">To win if it wins</span>
              <span className="text-moon-green text-lg font-bold">
                ≈ {projectedQty !== undefined ? fmt(projectedQty) : '—'} ETH
              </span>
            </div>
            <p className="text-gray-500 text-[11px] mt-1">Demo payout — illustrative only.</p>
          </div>
        )}

        <StandardButton
          onClick={placeBet}
          disabled={busy || betAmountNum <= 0}
          className="rounded-full w-full"
          backgroundColor="bg-fuchsia-600"
        >
          {busy
            ? 'Placing demo bet…'
            : betAmountNum > 0
              ? `Place demo bet of ${fmt(betAmountNum)} ETH`
              : 'Enter an amount'}
        </StandardButton>
      </div>
    </Modal>
  )
}
