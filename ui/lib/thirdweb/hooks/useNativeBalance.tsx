import { useWallets } from '@privy-io/react-auth'
import { useContext, useEffect, useState, useCallback } from 'react'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'

export function useNativeBalance() {
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()
  const [nativeBalance, setNativeBalance] = useState<any>()

  const getNativeBalance = useCallback(async () => {
    const wallet = wallets[selectedWallet]
    if (!wallet) return

    // IMPORTANT: Do NOT auto-switch chains here!
    // This hook runs in the background (every 5 seconds) and is used across the app.
    // Auto-switching chains in a background hook causes race conditions:
    // 1. Single-tab: The wallets array updates trigger repeated effect runs
    // 2. Multi-tab: Different tabs with different selectedChain values fight over the wallet's chain
    // 
    // Chain switching should ONLY happen in response to explicit user actions
    // (e.g., clicking a "Switch Network" button), not automatically.
    //
    // This hook simply fetches the balance from whatever chain the wallet is currently on.

    try {
      const provider = await wallet.getEthersProvider()
      const balance = await provider.getBalance(wallet.address)
      setNativeBalance(Number(+balance?.toString() / 10 ** 18).toFixed(7))
    } catch (error: any) {
      console.warn('Failed to fetch native balance:', error.message)
    }
  }, [wallets, selectedWallet])

  useEffect(() => {
    const interval = setInterval(() => {
      getNativeBalance()
    }, 5000)
    getNativeBalance()
    return () => clearInterval(interval)
  }, [getNativeBalance])

  return { nativeBalance, refetch: getNativeBalance }
}
