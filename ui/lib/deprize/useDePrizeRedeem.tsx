import ConditionalTokensABI from 'const/abis/ConditionalTokens.json'
import DePrizeRedeemABI from 'const/abis/DePrizeRedeem.json'
import {
  CONDITIONAL_TOKEN_ADDRESSES,
  DEPRIZE_REDEEM_ADDRESSES,
} from 'const/config'
import { useEffect, useMemo, useState } from 'react'
import { getContract, type Chain } from 'thirdweb'
import { deprizeReadChain, deprizeReadClient, rpcRead } from './read'
import { getChainSlug } from '@/lib/thirdweb/chain'

export type UseDePrizeRedeemResult = {
  helperAddress: string
  helperConfigured: boolean
  previewWei: bigint | undefined
  approved: boolean | undefined
}

/**
 * Reads the DePrizeRedeem helper's `previewRedeem` for the connected wallet plus
 * whether the wallet has granted the helper CTF operator approval. Drives the
 * claim panel. Re-reads when `refreshNonce` bumps (after a redeem/approve).
 */
export function useDePrizeRedeemPreview(params: {
  deprizeId: number | string | undefined
  chain: Chain
  userAddress?: string
  resolved: boolean
  refreshNonce?: number
}): UseDePrizeRedeemResult {
  const { deprizeId, chain, userAddress, resolved, refreshNonce } = params
  const chainSlug = getChainSlug(chain)
  const readChain = useMemo(() => deprizeReadChain(chain.id), [chain.id])

  const helperAddress = DEPRIZE_REDEEM_ADDRESSES[chainSlug] ?? ''
  const ctfAddress = CONDITIONAL_TOKEN_ADDRESSES[chainSlug] ?? ''
  const validHelper = /^0x[0-9a-fA-F]{40}$/.test(helperAddress)

  const [previewWei, setPreviewWei] = useState<bigint | undefined>()
  const [approved, setApproved] = useState<boolean | undefined>()

  const helper = useMemo(() => {
    if (!validHelper) return undefined
    return getContract({
      client: deprizeReadClient,
      chain: readChain,
      address: helperAddress,
      abi: DePrizeRedeemABI as any,
    })
  }, [validHelper, helperAddress, readChain])
  const ctf = useMemo(() => {
    if (!ctfAddress) return undefined
    return getContract({
      client: deprizeReadClient,
      chain: readChain,
      address: ctfAddress,
      abi: ConditionalTokensABI as any,
    })
  }, [ctfAddress, readChain])

  useEffect(() => {
    setPreviewWei(undefined)
    setApproved(undefined)
    if (!helper || !ctf || !userAddress || !deprizeId) return
    if (!/^\d+$/.test(String(deprizeId))) return
    let cancelled = false
    ;(async () => {
      const [preview, isApproved] = await Promise.all([
        rpcRead<bigint>({
          contract: helper,
          method: 'previewRedeem' as string,
          params: [BigInt(deprizeId as any), userAddress],
        }).catch(() => undefined),
        rpcRead<boolean>({
          contract: ctf,
          method: 'isApprovedForAll' as string,
          params: [userAddress, helperAddress],
        }).catch(() => undefined),
      ])
      if (cancelled) return
      setPreviewWei(preview)
      setApproved(isApproved)
    })()
    return () => {
      cancelled = true
    }
  }, [helper, ctf, userAddress, deprizeId, helperAddress, resolved, refreshNonce])

  return {
    helperAddress,
    helperConfigured: validHelper,
    previewWei,
    approved,
  }
}
