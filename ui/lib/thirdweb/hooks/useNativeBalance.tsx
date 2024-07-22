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

  useEffect(() => {
    async function getNativeBalance() {
      if (!sdk) return
      const provider = sdk.getProvider()
      const balance = await provider.getBalance(wallets[selectedWallet].address)
      setNativeBalance((+balance / 10 ** 18).toFixed(5))
    }

    if (sdk && wallets[selectedWallet]) getNativeBalance()
  }, [wallets, selectedWallet, selectedChain, sdk])

  return nativeBalance
}
