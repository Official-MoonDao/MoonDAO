import ConditionalTokensABI from 'const/abis/ConditionalTokens.json'
import LMSRWithTWAP from 'const/abis/LMSRWithTWAP.json'
import { CONDITIONAL_TOKEN_ADDRESSES } from 'const/config'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { getContract, prepareContractCall, type Chain } from 'thirdweb'
import { UNIT } from '@/lib/deprize/constants'
import { fmt } from '@/lib/deprize/format'
import { buildAmounts } from '@/lib/deprize/quote'
import { deprizeReadChain, deprizeReadClient, rpcRead } from '@/lib/deprize/read'
import { sendDePrizeTx } from '@/lib/deprize/tx'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { getChainSlug } from '@/lib/thirdweb/chain'
import client from '@/lib/thirdweb/client'
import Modal from '@/components/layout/Modal'
import StandardButton from '@/components/layout/StandardButton'

type ExitPositionModalProps = {
  outcomeIndex: number
  teamName: string
  balanceWei: bigint
  numOutcomes: number
  marketAddress: string
  chain: Chain
  account: any
  onClose: () => void
  onDone: () => void
}

export default function ExitPositionModal({
  outcomeIndex,
  teamName,
  balanceWei,
  numOutcomes,
  marketAddress,
  chain,
  account,
  onClose,
  onDone,
}: ExitPositionModalProps) {
  const [quoteEth, setQuoteEth] = useState<number | undefined>()
  const [busy, setBusy] = useState(false)

  const ctfAddress = CONDITIONAL_TOKEN_ADDRESSES[getChainSlug(chain)] ?? ''

  // Writes go through the app's shared client (consistent with the connected
  // account); reads go through the batching-disabled client on the RPC edge.
  const lmsr = useMemo(
    () =>
      getContract({
        client,
        chain,
        address: marketAddress,
        abi: LMSRWithTWAP.abi as any,
      }),
    [chain, marketAddress]
  )
  const lmsrRead = useMemo(
    () =>
      getContract({
        client: deprizeReadClient,
        chain: deprizeReadChain(chain.id),
        address: marketAddress,
        abi: LMSRWithTWAP.abi as any,
      }),
    [chain.id, marketAddress]
  )
  const ctf = useMemo(
    () =>
      getContract({
        client,
        chain,
        address: ctfAddress,
        abi: ConditionalTokensABI as any,
      }),
    [chain, ctfAddress]
  )
  const ctfRead = useMemo(
    () =>
      getContract({
        client: deprizeReadClient,
        chain: deprizeReadChain(chain.id),
        address: ctfAddress,
        abi: ConditionalTokensABI as any,
      }),
    [chain.id, ctfAddress]
  )

  // Live quote of what selling the full position returns right now: calcNetCost
  // with a negative amount returns negative collateral (what the LMSR pays back).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const amounts = buildAmounts(outcomeIndex, -balanceWei, numOutcomes)
        const net = await rpcRead<bigint>({
          contract: lmsrRead,
          method: 'calcNetCost' as string,
          params: [amounts],
        })
        if (!cancelled) setQuoteEth(Number(-net) / Number(UNIT))
      } catch {
        if (!cancelled) setQuoteEth(undefined)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [lmsrRead, outcomeIndex, balanceWei, numOutcomes])

  const cashOut = async () => {
    if (!account) return
    setBusy(true)
    try {
      // The market must be an operator on the seller's CTF tokens to pull them.
      const approved = await rpcRead<boolean>({
        contract: ctfRead,
        method: 'isApprovedForAll' as string,
        params: [account.address, marketAddress],
      }).catch(() => false)
      if (!approved) {
        toast.loading('Approving…', { id: 'approve', style: toastStyle })
        await sendDePrizeTx(
          account,
          prepareContractCall({
            contract: ctf,
            method: 'setApprovalForAll' as string,
            params: [marketAddress, true],
          })
        )
        toast.dismiss('approve')
      }
      const amounts = buildAmounts(outcomeIndex, -balanceWei, numOutcomes)
      const net = await rpcRead<bigint>({
        contract: lmsrRead,
        method: 'calcNetCost' as string,
        params: [amounts],
      }) // negative: collateral returned
      const limit = (net * 99n) / 100n // 1% slippage floor
      toast.loading('Cashing out…', { id: 'sell', style: toastStyle })
      await sendDePrizeTx(
        account,
        prepareContractCall({
          contract: lmsr,
          method: 'trade' as string,
          params: [amounts, limit],
        })
      )
      toast.dismiss('sell')
      toast.success(
        `Cashed out ${teamName} for ≈ ${fmt(Number(-net) / Number(UNIT))} ETH.`,
        { style: toastStyle }
      )
      onDone()
      onClose()
    } catch (err: any) {
      toast.dismiss('approve')
      toast.dismiss('sell')
      console.error('[deprize] cash out failed', err)
      toast.error(err?.shortMessage || err?.message || 'Cash out failed.', {
        style: toastStyle,
        duration: 8000,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal id="deprize-exit" setEnabled={(v) => !v && onClose()} title={`Cash out ${teamName}`}>
      <div className="flex flex-col gap-4 w-full">
        <p className="text-gray-300 text-sm">
          Sell your full position back to the market at the current price. You get ETH now instead
          of waiting for the DePrize to settle.
        </p>
        <div className="p-4 rounded-xl bg-black/30 border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">You receive (est.)</span>
            <span className="text-moon-green text-lg font-bold">
              {quoteEth !== undefined ? `≈ ${fmt(quoteEth)} ETH` : '…'}
            </span>
          </div>
          <p className="text-gray-500 text-[11px] mt-1">
            Final amount may vary slightly with price movement (1% slippage allowed).
          </p>
        </div>
        <StandardButton
          onClick={cashOut}
          disabled={busy || balanceWei <= 0n}
          className="rounded-full w-full"
          backgroundColor="bg-moon-orange"
        >
          {busy ? 'Cashing out…' : 'Cash out'}
        </StandardButton>
      </div>
    </Modal>
  )
}
