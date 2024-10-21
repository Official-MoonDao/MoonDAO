import { useWallets } from '@privy-io/react-auth'
import { useContext, useEffect, useState } from 'react'
import PrivyWalletContext from '../../privy/privy-wallet-context'

export function useNativeBalance() {
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  const [nativeBalance, setNativeBalance] = useState<any>()

  useEffect(() => {
    let provider: any

    async function handleBalanceChange() {
      const address = wallets[selectedWallet].address
      const balance = await provider.getBalance(address)
      setNativeBalance((+balance / 10 ** 18).toFixed(5))
    }

    async function getBalanceAndListen() {
      if (wallets[selectedWallet]) {
        provider = await wallets[selectedWallet].getEthersProvider()
        await handleBalanceChange()

        provider.on('block', handleBalanceChange)
      }
    }

    getBalanceAndListen()

    // Cleanup listener on unmount
    return () => {
      if (provider) {
        provider.off('block', handleBalanceChange)
      }
    }
  }, [wallets, selectedWallet])

  return nativeBalance
}
