'use client'

import { useEffect, useState } from 'react'
import { fetchNativeBalanceWei, pickChainWithMaxNativeBalance } from '@/lib/mission/contributeModalDefaultChain'
import type { Chain } from '@/lib/rpc/chains'

type FundingPickState = {
  pickReady: boolean
  recommendedChain: Chain | null
}

const initialPick: FundingPickState = {
  pickReady: false,
  recommendedChain: null,
}

/**
 * Compare native balance on Arbitrum / Base / Ethereum (or testnet equivalents) and remember which
 * chain holds the most ETH — **without** changing `selectedChain`. The app defaults to Arbitrum
 * (`DEFAULT_CHAIN_V5`); the mission banner can suggest switching when another chain has more.
 *
 * Single useState keeps hook layout minimal (avoids dispatcher issues when parent hook counts vary).
 */
export function useMissionDefaultFundingChain({
  enabled,
  address,
  chains,
}: {
  enabled: boolean
  address: string | undefined
  chains: Chain[]
}): { fundingPickReady: boolean; recommendedChain: Chain | null } {
  const [pick, setPick] = useState<FundingPickState>(initialPick)

  useEffect(() => {
    if (!enabled) {
      setPick(initialPick)
      return
    }

    if (!address) {
      setPick(initialPick)
      return
    }

    if (chains.length === 0) {
      setPick(initialPick)
      return
    }

    setPick({ pickReady: false, recommendedChain: null })
    let cancelled = false

    ;(async () => {
      const entries = await Promise.all(
        chains.map(async (chain) => {
          const wei = await fetchNativeBalanceWei(chain, address)
          return { chain, wei }
        })
      )
      if (cancelled) return

      const best = pickChainWithMaxNativeBalance(entries, chains)
      setPick({ pickReady: true, recommendedChain: best })
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, address, chains])

  return {
    fundingPickReady: pick.pickReady,
    recommendedChain: pick.recommendedChain,
  }
}
