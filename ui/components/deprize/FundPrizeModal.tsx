import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  DEPRIZE_TERMS_URL,
  FUND_CONFIRM_ABOVE_WEI,
  FUND_GEO_OPEN,
  FUND_MIN_WEI,
  UNIT,
} from '@/lib/deprize/constants'
import { useDePrizeRestricted } from '@/lib/deprize/deprizeRestrictedContext'
import { fmtEthWithUsd } from '@/lib/deprize/format'
import { sendDePrizeTx } from '@/lib/deprize/tx'
import { useDePrizeChainGuard } from '@/lib/deprize/useDePrizeChainGuard'
import { useDePrizeLaunchpadToken } from '@/lib/deprize/useDePrizeLaunchpad'
import { toWei } from '@/lib/deprize/format'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { prepareJBPay } from '@/lib/juicebox/payProject'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import client from '@/lib/thirdweb/client'
import DePrizeAvailabilityLegend from '@/components/deprize/DePrizeAvailabilityLegend'
import Modal from '@/components/layout/Modal'
import StandardButton from '@/components/layout/StandardButton'
import type { Chain } from 'thirdweb'

export default function FundPrizeModal(props: {
  deprizeId: number
  jbProjectId: number
  prizeTitle: string
  chain: Chain
  account: any
  onClose: () => void
  onDone: (payer: string) => void
}) {
  const { deprizeId, jbProjectId, prizeTitle, chain, account, onClose, onDone } = props
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmedLarge, setConfirmedLarge] = useState(false)
  const restricted = useDePrizeRestricted()
  const { wrongNetwork, chainLabel, switching, switchToChain } = useDePrizeChainGuard(chain)
  if (!(FUND_GEO_OPEN || !restricted)) return null
  const { ethPrice } = useETHPrice(1)
  const launchpad = useDePrizeLaunchpadToken(jbProjectId, chain)
  const wallet = typeof account?.address === 'string' ? account.address : ''

  const amountWei = useMemo(() => toWei(amount), [amount])
  const belowMin = amountWei > 0n && amountWei < FUND_MIN_WEI
  const needsConfirm = amountWei >= FUND_CONFIRM_ABOVE_WEI
  const minEth = Number(FUND_MIN_WEI) / Number(UNIT)

  async function submit() {
    if (!wallet || amountWei < FUND_MIN_WEI || wrongNetwork) return
    if (needsConfirm && !confirmedLarge) return
    setBusy(true)
    try {
      const userMemo = memo.trim().slice(0, 80)
      const tx = prepareJBPay({
        client,
        chain,
        projectId: jbProjectId,
        amountWei,
        beneficiary: wallet,
        minReturnedTokens: 0n,
        memo: `DePrize #${deprizeId}:${userMemo ? ` ${userMemo}` : ''}`,
      })
      const receipt = await sendDePrizeTx(account, tx)
      if (receipt?.status && receipt.status !== 'success') {
        toast.error("The contribution didn't go through. Nothing was charged beyond gas.", {
          style: toastStyle,
        })
        return
      }
      toast.success('Contribution sent. The wall updates within about a minute.', {
        style: toastStyle,
      })
      onDone(wallet)
      onClose()
    } catch (err: any) {
      const msg = `${err?.message || ''} ${err?.shortMessage || ''}`.toLowerCase()
      if (msg.includes('user rejected') || msg.includes('denied') || msg.includes('rejected')) {
        toast('Cancelled', { style: toastStyle })
        return
      }
      toast.error(err?.shortMessage || err?.message || 'Contribution failed.', {
        style: toastStyle,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal id="deprize-fund" setEnabled={(v) => !v && onClose()} title="Fund the prize">
      <div className="flex flex-col gap-4 text-sm">
        <div className="space-y-1 text-gray-300">
          <p className="text-white font-semibold">
            You&apos;re adding ETH to the {prizeTitle} prize pool.
          </p>
          <p>
            <span className="text-gray-400">You get:</span> a bigger prize for whoever wins · your
            name on the patrons wall
            {launchpad.symbol ? ` · ${launchpad.symbol} project tokens from the launchpad` : ''}.
          </p>
          <p>
            <span className="text-gray-400">You don&apos;t get:</span> a bet, a position, or a
            payout if a competitor wins. This does not move the odds.
          </p>
          <p>This is not refundable by MoonDAO.</p>
          <p className="text-xs text-gray-500">
            No minimum token amount is guaranteed for this contribution.
          </p>
        </div>

        <label className="text-xs text-gray-400">
          Amount (ETH) — minimum {minEth} ETH
          <input
            type="number"
            min={minEth}
            step="any"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              setConfirmedLarge(false)
            }}
            className="mt-1 w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white"
          />
        </label>
        {amountWei > 0n && (
          <p className="text-white/55 text-xs">{fmtEthWithUsd(Number(amountWei) / Number(UNIT), ethPrice)}</p>
        )}
        {belowMin && (
          <p className="text-amber-300 text-xs">Minimum contribution is {minEth} ETH.</p>
        )}
        {needsConfirm && (
          <label className="flex items-start gap-2 text-xs text-amber-200">
            <input
              type="checkbox"
              checked={confirmedLarge}
              onChange={(e) => setConfirmedLarge(e.target.checked)}
            />
            I understand this sends {fmtEthWithUsd(Number(amountWei) / Number(UNIT), ethPrice)} and
            cannot be reversed.
          </label>
        )}

        <label className="text-xs text-gray-400">
          Optional memo (on-chain only; not shown on the wall)
          <input
            type="text"
            maxLength={80}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="mt-1 w-full px-4 py-2 bg-white/5 border border-white/20 rounded-xl text-white"
          />
        </label>

        {wrongNetwork ? (
          <StandardButton
            onClick={switchToChain}
            disabled={switching}
            className="rounded-full w-full"
            backgroundColor="bg-white/10"
          >
            {switching ? 'Switching…' : `Switch wallet to ${chainLabel}`}
          </StandardButton>
        ) : (
          <StandardButton
            onClick={submit}
            disabled={
              busy || !wallet || amountWei < FUND_MIN_WEI || (needsConfirm && !confirmedLarge)
            }
            className="rounded-full w-full"
            backgroundColor="bg-white/10"
          >
            {busy ? 'Sending…' : 'Donate to the prize pool'}
          </StandardButton>
        )}

        <a href={DEPRIZE_TERMS_URL} className="text-xs text-indigo-300 underline">
          DePrize Terms
        </a>
        <DePrizeAvailabilityLegend />
      </div>
    </Modal>
  )
}
