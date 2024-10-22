import { useWallets } from '@privy-io/react-auth'
import { useAddress } from '@thirdweb-dev/react'
import { useContext, useEffect, useState } from 'react'
import PrivyWalletContext from '../../privy/privy-wallet-context'

export function useNativeBalance() {
  const address = useAddress()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  const [nativeBalance, setNativeBalance] = useState<any>()

  useEffect(() => {
    let provider: any
    let isMounted = true

    async function handleBalanceChange() {
      if (!isMounted) return
      const balance = await provider.getBalance(wallets[selectedWallet].address)
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

    // Cleanup listener on unmount or when selectedWallet changes
    return () => {
      isMounted = false
      if (provider) {
        provider.off('block', handleBalanceChange)
      }
    }
  }, [address, wallets, selectedWallet])

  return nativeBalance
}
