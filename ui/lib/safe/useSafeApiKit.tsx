import { useWallets } from '@privy-io/react-auth'
import SafeApiKit from '@safe-global/api-kit'
import Safe from '@safe-global/protocol-kit'
import { useContext, useEffect, useState } from 'react'
import PrivyWalletContext from '../privy/privy-wallet-context'
import ChainContextV5 from '../thirdweb/chain-context-v5'

export default function useSafeApiKit(safeAddress: string) {
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { selectedChain } = useContext(ChainContextV5)
  const { wallets } = useWallets()

  const [safeApiKit, setSafeApiKit] = useState<any>()
  const [protocolKit, setProtocolKit] = useState<any>()

  useEffect(() => {
    async function getSafeApiKit() {
      const apiKit = new SafeApiKit({
        chainId: BigInt(selectedChain.id),
      })
      setSafeApiKit(apiKit)
    }

    async function getProtocolKit() {
      const privyProvider = await wallets[selectedWallet]?.getEthereumProvider()

      if (!privyProvider) return

      const protoKit = await Safe.init({
        provider: privyProvider as any,
        safeAddress,
      })
      setProtocolKit(protoKit)
    }
    getSafeApiKit()
    getProtocolKit()
  }, [selectedWallet, wallets, selectedChain, safeAddress])

  return { safeApiKit, protocolKit }
}
