import { useWallets } from '@privy-io/react-auth'
import { useContext, useEffect } from 'react'
import {
  useActiveAccount,
  useActiveWalletChain,
  useWalletBalance,
} from 'thirdweb/react'
import PrivyWalletContext from '../../privy/privy-wallet-context'
import client from '../client'

export function useNativeBalance() {
  const account = useActiveAccount()
  const address = account?.address
  const activeWalletChain = useActiveWalletChain()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  const { data: nativeBalance, refetch } = useWalletBalance({
    client,
    address: address,
    chain: activeWalletChain,
  })

  useEffect(() => {
    const interval = setInterval(() => {
      refetch()
    }, 5000)
    return () => clearInterval(interval)
  }, [address, wallets, selectedWallet])

  return Number(nativeBalance?.displayValue).toFixed(7)
}
