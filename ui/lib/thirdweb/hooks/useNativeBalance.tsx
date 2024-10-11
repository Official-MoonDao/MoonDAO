import { useWallets } from '@privy-io/react-auth'
import { useContext, useEffect, useState } from 'react'
import PrivyWalletContext from '../../privy/privy-wallet-context'

export function useNativeBalance() {
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  const [nativeBalance, setNativeBalance] = useState<any>()

  useEffect(() => {
    const fetchBalanceAndListen = async () => {
      if (wallets[selectedWallet]) {
        const provider = await wallets[selectedWallet].getEthersProvider()
        const address = wallets[selectedWallet].address

        const getNativeBalance = async () => {
          const balance = await provider.getBalance(address)
          setNativeBalance((+balance / 10 ** 18).toFixed(5))
        }

        await getNativeBalance()

        // Listen for balance changes
        const handleBalanceChange = async () => {
          await getNativeBalance()
        }

        provider.on('block', handleBalanceChange)

        // Cleanup listener on unmount
        return () => {
          provider.off('block', handleBalanceChange)
        }
      }
    }

    fetchBalanceAndListen()
  }, [wallets, selectedWallet])

  return nativeBalance
}
