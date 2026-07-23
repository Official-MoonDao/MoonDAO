import ConditionalTokensABI from 'const/abis/ConditionalTokens.json'
import DePrizeRedeemABI from 'const/abis/DePrizeRedeem.json'
import { CONDITIONAL_TOKEN_ADDRESSES } from 'const/config'
import confetti from 'canvas-confetti'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { getContract, prepareContractCall, type Chain } from 'thirdweb'
import { fmt, formatPrizeTokenLabel, toEth } from '@/lib/deprize/format'
import { sendDePrizeTx } from '@/lib/deprize/tx'
import { useDePrizeLaunchpadToken } from '@/lib/deprize/useDePrizeLaunchpad'
import { useDePrizeRedeemPreview } from '@/lib/deprize/useDePrizeRedeem'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { getChainSlug } from '@/lib/thirdweb/chain'
import client from '@/lib/thirdweb/client'
import StandardButton from '@/components/layout/StandardButton'

type ClaimPanelProps = {
  deprizeId: number
  chain: Chain
  account: any
  resolved: boolean
  isRefundVector: boolean
  winningTeamName?: string
  /** Juicebox project id this DePrize tops up — for the refund-token label. */
  jbProjectId?: number | bigint
  refreshNonce: number
  onDone: () => void
}

export default function ClaimPanel({
  deprizeId,
  chain,
  account,
  resolved,
  isRefundVector,
  winningTeamName,
  jbProjectId,
  refreshNonce,
  onDone,
}: ClaimPanelProps) {
  const launchpad = useDePrizeLaunchpadToken(jbProjectId, chain)
  const prizeToken = formatPrizeTokenLabel(launchpad.symbol)
  const userAddress = account?.address
  const [busy, setBusy] = useState(false)
  const [claimed, setClaimed] = useState(false)

  // Local success flag is per-session; clear it when the holder or DePrize changes
  // so a wallet switch cannot leave the previous address's "Claimed" UI stuck.
  useEffect(() => {
    setClaimed(false)
  }, [userAddress, deprizeId])

  const { helperAddress, helperConfigured, previewWei, approved } =
    useDePrizeRedeemPreview({
      deprizeId,
      chain,
      userAddress,
      resolved,
      refreshNonce,
    })

  const ctfAddress = CONDITIONAL_TOKEN_ADDRESSES[getChainSlug(chain)] ?? ''

  const helper = useMemo(
    () =>
      helperConfigured
        ? getContract({ client, chain, address: helperAddress, abi: DePrizeRedeemABI as any })
        : undefined,
    [helperConfigured, chain, helperAddress]
  )
  const ctf = useMemo(
    () =>
      ctfAddress
        ? getContract({ client, chain, address: ctfAddress, abi: ConditionalTokensABI as any })
        : undefined,
    [chain, ctfAddress]
  )

  if (!resolved) return null

  const claimEth = toEth(previewWei)
  const nothingToClaim = claimEth !== undefined && claimEth <= 0

  const fireConfetti = () =>
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 },
      shapes: ['circle', 'star'],
      colors: ['#ffffff', '#FFD700', '#00FFFF', '#ff69b4', '#8A2BE2'],
    })

  const approveHelper = async () => {
    if (!account || !ctf) return
    setBusy(true)
    try {
      await sendDePrizeTx(
        account,
        prepareContractCall({
          contract: ctf,
          method: 'setApprovalForAll' as string,
          params: [helperAddress, true],
        })
      )
      toast.success('Approved. You can claim now.', { style: toastStyle })
      onDone()
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || 'Approve failed.', {
        style: toastStyle,
        duration: 8000,
      })
    } finally {
      setBusy(false)
    }
  }

  const claim = async () => {
    if (!account || !helper) return
    setBusy(true)
    toast.loading('Claiming…', { id: 'claim', style: toastStyle })
    try {
      await sendDePrizeTx(
        account,
        prepareContractCall({
          contract: helper,
          method: 'redeem' as string,
          params: [BigInt(deprizeId)],
        })
      )
      toast.dismiss('claim')
      setClaimed(true)
      fireConfetti()
      toast.success(
        claimEth !== undefined
          ? `Claimed ≈ ${fmt(claimEth)} ETH.`
          : 'Claimed.',
        { style: toastStyle, duration: 8000 }
      )
      onDone()
    } catch (err: any) {
      toast.dismiss('claim')
      console.error('[deprize] claim failed', err)
      toast.error(err?.shortMessage || err?.message || 'Claim failed.', {
        style: toastStyle,
        duration: 10000,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
      <p className="text-emerald-200 text-sm">
        {isRefundVector
          ? 'No winner — every position is refunded'
          : winningTeamName
            ? `${winningTeamName} won`
            : 'Resolved'}
      </p>

      {!userAddress ? (
        <p className="text-white text-lg font-semibold mt-1">
          Connect your wallet to claim.
        </p>
      ) : !helperConfigured ? (
        <p className="text-gray-300 text-sm mt-2">
          The claim helper isn&apos;t configured on this network yet. You can still redeem your
          positions directly on the Conditional Tokens contract.
        </p>
      ) : nothingToClaim || claimed ? (
        <p className="text-white text-2xl font-bold mt-1">
          {claimed ? 'Claimed' : 'Nothing to claim'}
        </p>
      ) : (
        <>
          <p className="text-white text-2xl font-bold mt-1">
            {claimEth !== undefined ? `${fmt(claimEth)} ETH` : '…'}
          </p>
          <div className="mt-3">
            <StandardButton
              onClick={approved ? claim : approveHelper}
              disabled={busy}
              className="rounded-full"
              backgroundColor="bg-moon-green"
            >
              {busy ? 'Working…' : approved ? 'Claim' : 'Approve'}
            </StandardButton>
          </div>
        </>
      )}

      {isRefundVector && userAddress && (
        <p className="text-gray-400 text-[11px] mt-3 leading-snug">
          The 5% you contributed to the prize pool is refunded separately: burn your {prizeToken}
          {launchpad.name ? ` (${launchpad.name})` : ''} for a pro-rata ETH cash-out on this
          DePrize&apos;s launchpad Juicebox project (the standard mission refund flow). That leg is
          independent of the claim above.
        </p>
      )}
    </div>
  )
}
