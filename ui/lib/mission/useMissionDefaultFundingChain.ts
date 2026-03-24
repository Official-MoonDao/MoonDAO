import { useWallets } from '@privy-io/react-auth'
import { useContext, useEffect, useRef } from 'react'
import {
  fetchNativeBalanceWei,
  pickChainWithMaxNativeBalance,
  switchPrivyWalletToChainIfNeeded,
} from '@/lib/mission/contributeModalDefaultChain'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import type { Chain } from '@/lib/rpc/chains'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'

/**
 * Pick Arbitrum / Base / Ethereum (or Sepolia / Optimism Sepolia on testnet) with the largest
 * native balance for `address`, sync chain context, then switch the Privy wallet once Privy
 * wallets are ready. Runs from the mission profile so it applies even when only the header
 * contribute button is mounted (no full pay card).
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
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()
  const { refetch: refetchNativeBalance } = useNativeBalance()

  const selectedChainIdRef = useRef(selectedChain.id)
  selectedChainIdRef.current = selectedChain.id
  const walletsRef = useRef(wallets)
  walletsRef.current = wallets
  const selectedWalletRef = useRef(selectedWallet)
  selectedWalletRef.current = selectedWallet

  const appliedForAddressRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled) return

    if (!address) {
      appliedForAddressRef.current = null
      return
    }

    if (wallets.length === 0) return

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

      await switchPrivyWalletToChainIfNeeded(
        walletsRef.current[selectedWalletRef.current],
        best
      )

      refetchNativeBalance()
    })()

    return () => {
      cancelled = true
    }
  }, [
    enabled,
    address,
    chains,
    setSelectedChain,
    refetchNativeBalance,
    wallets.length,
  ])
}
