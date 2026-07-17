import DePrizeMintABI from 'const/abis/DePrizeMint.json'
import LMSRWithTWAP from 'const/abis/LMSRWithTWAP.json'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { getContract, prepareContractCall, type Chain } from 'thirdweb'
import { UNIT } from '@/lib/deprize/constants'
import { fmt, toEth, toWei } from '@/lib/deprize/format'
import { betBudget, betSlice, quoteQtyForBudget } from '@/lib/deprize/quote'
import { deprizeReadChain, deprizeReadClient } from '@/lib/deprize/read'
import { sendDePrizeTx } from '@/lib/deprize/tx'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import client from '@/lib/thirdweb/client'
import Modal from '@/components/layout/Modal'
import StandardButton from '@/components/layout/StandardButton'

type BetModalProps = {
  deprizeId: number
  outcomeIndex: number
  teamName: string
  probability: number
  numOutcomes: number
  mintAddress: string
  marketAddress: string
  chain: Chain
  account: any
  spendableEth: number
  onClose: () => void
  onDone: (index: number, costEth: number, qtyEth: number) => void
}

// Quote against 99% of the budget so a little price drift doesn't revert the
// bet; the router still caps the actual spend at the full 95% budget.
const QUOTE_HEADROOM_NUM = 99n
const QUOTE_HEADROOM_DEN = 100n

export default function BetModal({
  deprizeId,
  outcomeIndex,
  teamName,
  probability,
  numOutcomes,
  mintAddress,
  marketAddress,
  chain,
  account,
  spendableEth,
  onClose,
  onDone,
}: BetModalProps) {
  const [betAmount, setBetAmount] = useState('')
  const [quote, setQuote] = useState<{ qty: number } | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [busy, setBusy] = useState(false)

  const betAmountWei = useMemo(() => toWei(betAmount), [betAmount])
  const betAmountNum = Number(betAmountWei) / Number(UNIT)
  const sliceEth = toEth(betSlice(betAmountWei)) ?? 0

  const canBet = /^0x[0-9a-fA-F]{40}$/.test(mintAddress)
  const insufficient =
    betAmountNum > 0 && betAmountNum > spendableEth + 1e-12

  // Quote reads go through the batching-disabled read client on the thirdweb
  // RPC edge (RPC batching silently breaks decodes in this thirdweb version).
  const lmsr = useMemo(
    () =>
      getContract({
        client: deprizeReadClient,
        chain: deprizeReadChain(chain.id),
        address: marketAddress,
        abi: LMSRWithTWAP.abi as any,
      }),
    [chain.id, marketAddress]
  )
  const mint = useMemo(
    () =>
      canBet
        ? getContract({ client, chain, address: mintAddress, abi: DePrizeMintABI as any })
        : undefined,
    [canBet, chain, mintAddress]
  )

  // Live payout quote: the real, price-impact-aware token amount the 95% budget
  // buys (each winning token redeems 1:1 for ETH, so qty == potential payout).
  useEffect(() => {
    if (betAmountWei <= 0n) {
      setQuote(null)
      setQuoting(false)
      return
    }
    let cancelled = false
    setQuote(null)
    setQuoting(true)
    const t = setTimeout(async () => {
      try {
        const budget = betBudget(betAmountWei)
        const target = (budget * QUOTE_HEADROOM_NUM) / QUOTE_HEADROOM_DEN
        const qty = await quoteQtyForBudget(lmsr, outcomeIndex, target, numOutcomes)
        if (!cancelled) setQuote({ qty: Number(qty) / Number(UNIT) })
      } catch (err) {
        console.warn('[deprize] payout quote failed', err)
        if (!cancelled) setQuote(null)
      } finally {
        if (!cancelled) setQuoting(false)
      }
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [betAmountWei, lmsr, outcomeIndex, numOutcomes])

  const placeBet = async () => {
    if (!account || !mint) return
    if (betAmountWei <= 0n) {
      toast.error('Enter an amount to bet.', { style: toastStyle })
      return
    }
    setBusy(true)
    toast.loading('Quoting…', { id: 'quote', style: toastStyle })
    try {
      const budget = betBudget(betAmountWei)
      const target = (budget * QUOTE_HEADROOM_NUM) / QUOTE_HEADROOM_DEN
      const qty = await quoteQtyForBudget(lmsr, outcomeIndex, target, numOutcomes)
      if (qty <= 0n) throw new Error('Bet too small for this market.')
      toast.dismiss('quote')
      toast.loading('Placing bet…', { id: 'bet', style: toastStyle })
      // The router splits msg.value (5% slice -> Juicebox / $OVERVIEW, 95% ->
      // market) and caps the trade cost at the 95% budget (maxCost), refunding
      // any unspent ETH.
      await sendDePrizeTx(
        account,
        prepareContractCall({
          contract: mint,
          method: 'bet' as string,
          params: [BigInt(deprizeId), BigInt(outcomeIndex), qty, budget],
          value: betAmountWei,
        })
      )
      toast.dismiss('bet')
      const qtyNum = Number(qty) / Number(UNIT)
      toast.success(
        `Backed ${teamName} with ${fmt(betAmountNum)} ETH. To win ≈ ${fmt(qtyNum)} ETH if it wins.`,
        { style: toastStyle, duration: 8000 }
      )
      onDone(outcomeIndex, betAmountNum, qtyNum)
      onClose()
    } catch (err: any) {
      toast.dismiss('quote')
      toast.dismiss('bet')
      console.error('[deprize] bet failed', err)
      toast.error(err?.shortMessage || err?.message || 'Bet failed.', {
        style: toastStyle,
        duration: 8000,
      })
    } finally {
      setBusy(false)
    }
  }

  const betMult = quote && betAmountNum > 0 ? quote.qty / betAmountNum : undefined

  return (
    <Modal id="deprize-bet" setEnabled={(v) => !v && onClose()} title={`Back ${teamName}`}>
      <div className="flex flex-col gap-4 w-full">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Chance to win</span>
          <span className="text-white font-semibold">
            {Number.isFinite(probability) ? `${fmt(probability, 0)}%` : '—'}
          </span>
        </div>

        <div>
          <label className="text-xs text-gray-400">How much do you want to bet? (ETH)</label>
          <input
            type="number"
            min="0"
            step="any"
            autoFocus
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            placeholder="e.g. 0.01"
            className="mt-1 w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            {spendableEth > 0 && (
              <button
                onClick={() => setBetAmount(String(Math.floor(spendableEth * 1e6) / 1e6))}
                className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 text-xs"
              >
                Max ({fmt(spendableEth)})
              </button>
            )}
          </div>
        </div>

        {/* Payout + fee/slice breakdown */}
        {betAmountNum > 0 && (
          <div className="p-4 rounded-xl bg-black/30 border border-white/10 flex flex-col gap-1">
            {quote ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">To win if it wins</span>
                  <span className="text-moon-green text-lg font-bold">
                    ≈ {fmt(quote.qty)} ETH
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-xs">Payout multiple</span>
                  <span className="text-gray-300 text-xs">
                    {betMult ? `${fmt(betMult, 2)}x` : '—'}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-gray-400 text-sm">
                {quoting ? 'Calculating payout…' : 'Enter an amount'}
              </p>
            )}
            <div className="flex items-center justify-between mt-1">
              <span className="text-gray-500 text-xs">
                Prize contribution (5% → $OVERVIEW)
              </span>
              <span className="text-gray-300 text-xs">{fmt(sliceEth)} ETH</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">Market fee (1%)</span>
              <span className="text-gray-300 text-xs">on the 95% traded</span>
            </div>
          </div>
        )}

        {/* Honest disclosure required by the design doc's UX principles. */}
        <p className="text-amber-300/90 text-[11px] leading-snug">
          5% of every bet funds the prize pool (you receive $OVERVIEW for it). If the DePrize is
          cancelled or ends with no winner, positions are refunded pro-rata (1/N per token), so a
          bet placed at odds above the average may recover less than you put in.
        </p>

        {!canBet ? (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
            Betting isn&apos;t live yet on this network — the bet router is not deployed. Check back
            soon.
          </div>
        ) : insufficient ? (
          <p className="text-amber-300 text-sm">
            You only have ≈ {fmt(spendableEth)} ETH available (a little is kept back for gas). Lower
            your bet or add funds.
          </p>
        ) : (
          <StandardButton
            onClick={placeBet}
            disabled={busy || betAmountWei <= 0n}
            className="rounded-full w-full"
            backgroundColor="bg-moon-green"
          >
            {busy
              ? 'Placing bet…'
              : betAmountNum > 0
                ? `Bet ${fmt(betAmountNum)} ETH`
                : 'Enter an amount'}
          </StandardButton>
        )}
      </div>
    </Modal>
  )
}
