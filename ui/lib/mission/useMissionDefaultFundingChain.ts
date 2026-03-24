import { useContext, useEffect, useRef } from 'react'
import { fetchNativeBalanceWei, pickChainWithMaxNativeBalance } from '@/lib/mission/contributeModalDefaultChain'
import type { Chain } from '@/lib/rpc/chains'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'

/**
 * Pick Arbitrum / Base / Ethereum (or Sepolia / Optimism Sepolia on testnet) with the largest
 * native balance for `address` and set `selectedChain` in context only.
 *
 * Does **not** call `wallet.switchChain` (avoids background races with `useNativeBalance` and
 * multi-tab). The user switches via `PrivyWeb3Button` (“Switch Network”) before contributing.
 */
export function useMissionDefaultFundingChain({
  enabled,
  address,
  chains,
}: {
  enabled: boolean
  address: string | undefined
  chains: Chain[]
}) {
  const { selectedChain, setSelectedChain } = useContext(ChainContextV5)

  const selectedChainIdRef = useRef(selectedChain.id)
  selectedChainIdRef.current = selectedChain.id

  const appliedForAddressRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled) return

    if (!address) {
      appliedForAddressRef.current = null
      return
    }

    if (chains.length === 0) return

    if (appliedForAddressRef.current === address) return

    const startedChainId = selectedChainIdRef.current
    let cancelled = false

    ;(async () => {
      const entries = await Promise.all(
        chains.map(async (chain) => {
          const wei = await fetchNativeBalanceWei(chain, address)
          return { chain, wei }
        })
      )
      if (cancelled) return
      if (selectedChainIdRef.current !== startedChainId) return

      const best = pickChainWithMaxNativeBalance(entries, chains)
      setSelectedChain(best)
      appliedForAddressRef.current = address
    })()

    return () => {
      cancelled = true
    }
  }, [
    enabled,
    address,
    chains,
    setSelectedChain,
  ])
}
