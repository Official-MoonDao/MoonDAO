import { useWallets } from '@privy-io/react-auth'
import SafeApiKit from '@safe-global/api-kit'
import { EthersAdapter } from '@safe-global/protocol-kit'
import { ethers } from 'ethers'
import { useContext, useEffect, useState } from 'react'
import PrivyWalletContext from '../privy/privy-wallet-context'

export default function useSafeApiKit() {
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  const [safeApiKit, setSafeApiKit] = useState<any>()

  useEffect(() => {
    async function getSafeApiKit() {
      const wallet = wallets[selectedWallet]
      const signer = await wallet?.getEthersProvider()
      if (!wallet || !signer) return

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
