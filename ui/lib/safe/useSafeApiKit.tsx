import { useWallets } from '@privy-io/react-auth'
import SafeApiKit from '@safe-global/api-kit'
import { EthersAdapter } from '@safe-global/protocol-kit'
import { ethers } from 'ethers'
import { useContext, useEffect, useState } from 'react'
import PrivyWalletContext from '../privy/privy-wallet-context'

export default function useSafeApiKit() {
  const [safeApiKit, setSafeApiKit] = useState<any>()
  const { wallets } = useWallets()
  const { selectedWallet } = useContext(PrivyWalletContext)

  useEffect(() => {
    async function getSafeApiKit() {
      const privyProvider = await wallets[selectedWallet]?.getEthereumProvider()
      const provider = new ethers.providers.Web3Provider(privyProvider)
      const signer = provider?.getSigner()

      if (!signer) return

      const ethAdapter = new EthersAdapter({
        ethers,
        signerOrProvider: signer,
      })

      const safeNetwork =
        process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'arbitrum' : 'sepolia'

      const txServiceUrl = `https://safe-transaction-${safeNetwork}.safe.global`

      const apiKit = new SafeApiKit({
        txServiceUrl,
        ethAdapter,
      })

      setSafeApiKit(apiKit)
    }

    getSafeApiKit()
  }, [wallets, selectedWallet])

  return safeApiKit
}
