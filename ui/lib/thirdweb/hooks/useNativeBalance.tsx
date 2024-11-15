import { useWallets } from '@privy-io/react-auth'
import { useAddress, useSDK } from '@thirdweb-dev/react'
import { useContext, useEffect, useState } from 'react'
import PrivyWalletContext from '../../privy/privy-wallet-context'

export function useNativeBalance() {
  const sdk = useSDK()
  const address = useAddress()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  const [nativeBalance, setNativeBalance] = useState<any>()

  useEffect(() => {
    let provider: any
    let isMounted = true

    const wallet = wallets[selectedWallet]

    async function handleBalanceChange() {
      if (!isMounted) return
      try {
        const balance = await provider.getBalance(wallet.address)
        setNativeBalance((+balance / 10 ** 18).toFixed(5))
      } catch (err) {}
    }

    async function getBalanceAndListen() {
      if (wallet) {
        provider = sdk?.getProvider()
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
  }, [sdk, address, wallets, selectedWallet])

  return nativeBalance
}
