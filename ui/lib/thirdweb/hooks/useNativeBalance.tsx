import { useWallets } from '@privy-io/react-auth'
import { useSDK } from '@thirdweb-dev/react'
import { useContext, useEffect, useState } from 'react'
import PrivyWalletContext from '../../privy/privy-wallet-context'
import ChainContext from '../chain-context'

export function useNativeBalance() {
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { selectedChain } = useContext(ChainContext)
  const { wallets } = useWallets()
  const sdk = useSDK()

  const [nativeBalance, setNativeBalance] = useState<any>()

  async function getNativeBalance() {
    const provider = await sdk.getProvider()
    const balance = await provider.getBalance(wallets[selectedWallet].address)
    setNativeBalance((+balance / 10 ** 18).toFixed(5))
  }

  useEffect(() => {
    if (wallets[selectedWallet]) getNativeBalance()
  }, [wallets, selectedWallet, selectedChain])

  return nativeBalance
}
