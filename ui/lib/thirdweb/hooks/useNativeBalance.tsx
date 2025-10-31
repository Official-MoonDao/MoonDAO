import { useWallets } from '@privy-io/react-auth'
import { useContext, useEffect, useState, useCallback } from 'react'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import ChainContextV5 from '../chain-context-v5'

export function useNativeBalance() {
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { selectedChain } = useContext(ChainContextV5)
  const { wallets } = useWallets()
  const [nativeBalance, setNativeBalance] = useState<any>()

  const getNativeBalance = useCallback(async () => {
    const wallet = wallets[selectedWallet]
    if (!wallet) return
    await wallet.switchChain(selectedChain.id)
    const provider = await wallet.getEthersProvider()
    const balance = await provider.getBalance(wallet.address)
    setNativeBalance(Number(+balance?.toString() / 10 ** 18).toFixed(7))
  }, [wallets, selectedWallet, selectedChain])

  useEffect(() => {
    const interval = setInterval(() => {
      getNativeBalance()
    }, 5000)
    getNativeBalance()
    return () => clearInterval(interval)
  }, [getNativeBalance])

  return { nativeBalance, refetch: getNativeBalance }
}
