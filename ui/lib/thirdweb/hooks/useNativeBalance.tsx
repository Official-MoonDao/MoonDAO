import { useWallets } from '@privy-io/react-auth'
import { useContext, useEffect, useState } from 'react'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import { useActiveAccount } from 'thirdweb/react'
import PrivyWalletContext from '../../privy/privy-wallet-context'
import ChainContextV5 from '../chain-context-v5'
import { serverClient } from '../client'

export function useNativeBalance() {
  const account = useActiveAccount()
  const address = account?.address
  const { selectedChain } = useContext(ChainContextV5)
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
        provider = ethers5Adapter.provider.toEthers({
          client: serverClient,
          chain: selectedChain,
        })
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
