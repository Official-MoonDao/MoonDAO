import { useWallets } from '@privy-io/react-auth'
import { useContext, useEffect, useState } from 'react'
import PrivyWalletContext from '../../privy/privy-wallet-context'

export function useNativeBalance() {
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  const [nativeBalance, setNativeBalance] = useState<any>()

  async function getNativeBalance() {
    const provider = await wallets[selectedWallet].getEthersProvider()
    const balance = await provider.getBalance(wallets[selectedWallet].address)
    setNativeBalance((+balance / 10 ** 18).toFixed(5))
  }

  useEffect(() => {
    if (wallets[selectedWallet]) getNativeBalance()
  }, [wallets, selectedWallet])

  return nativeBalance
}
