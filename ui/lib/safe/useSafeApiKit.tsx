import { useWallets } from '@privy-io/react-auth'
import SafeApiKit from '@safe-global/api-kit'
import { useContext, useEffect, useState } from 'react'
import PrivyWalletContext from '../privy/privy-wallet-context'
import ChainContextV5 from '../thirdweb/chain-context-v5'

export default function useSafeApiKit() {
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { selectedChain } = useContext(ChainContextV5)
  const { wallets } = useWallets()

  const [safeApiKit, setSafeApiKit] = useState<any>()

  useEffect(() => {
    async function getSafeApiKit() {
      const apiKit = new SafeApiKit({
        chainId: BigInt(selectedChain.id),
      })

      setSafeApiKit(apiKit)
    }
    getSafeApiKit()
  }, [wallets, selectedWallet, selectedChain])

  return safeApiKit
}
