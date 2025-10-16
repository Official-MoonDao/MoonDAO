import { useWallets } from '@privy-io/react-auth'
import { useContext, useEffect, useState } from 'react'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import ChainContextV5 from '../chain-context-v5'

export function useNativeBalance() {
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { selectedChain } = useContext(ChainContextV5)
  const { wallets } = useWallets()
  const [nativeBalance, setNativeBalance] = useState<any>()
  useEffect(() => {
    async function getNativeBalance() {
      const wallet = wallets[selectedWallet]
      await wallet.switchChain(selectedChain.id)
      if (!wallet) return
      const provider = await wallet.getEthersProvider()
      const balance = await provider.getBalance(wallet.address)
      setNativeBalance(Number(+balance?.toString() / 10 ** 18).toFixed(7))
    }

    const interval = setInterval(() => {
      getNativeBalance()
    }, 5000)
    getNativeBalance()
    return () => clearInterval(interval)
  }, [wallets, selectedWallet, selectedChain])

  return nativeBalance
}
