import { useWallets } from '@privy-io/react-auth'
import Safe, { EthersAdapter } from '@safe-global/protocol-kit'
import {
  SafeTransaction,
  SafeTransactionData,
  SafeTransactionDataPartial,
} from '@safe-global/safe-core-sdk-types'
import { ethers } from 'ethers'
import { useContext, useEffect, useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import PrivyWalletContext from '../privy/privy-wallet-context'
import useSafeApiKit from './useSafeApiKit'

export default function useSafe(safeAddress: string) {
  const account = useActiveAccount()
  const address = account?.address
  const { wallets } = useWallets()
  const { selectedWallet } = useContext(PrivyWalletContext)

  const [safe, setSafe] = useState<Safe>()
  const safeApiKit = useSafeApiKit()

  async function queueSafeTx(
    safeTransactionData: SafeTransactionData | SafeTransactionDataPartial
  ) {
    try {
      const safeTx = await safe?.createTransaction({
        safeTransactionData,
      })
      const safeTxHash = await safe?.getTransactionHash(
        safeTx as SafeTransaction
      )

      if (!safeTx || !safeTxHash)
        throw new Error('Failed to create transaction or get transaction hash')

      const signature = await safe?.signTransactionHash(safeTxHash)

      if (!signature) throw new Error('Failed to sign transaction hash')

      await safeApiKit?.proposeTransaction({
        safeAddress,
        safeTransactionData: safeTx.data,
        safeTxHash,
        senderAddress: address,
        senderSignature: signature.data,
      })
    } catch (err) {
      console.log(err)
    }
  }

  useEffect(() => {
    async function getSafe() {
      const privyProvider = await wallets[selectedWallet]?.getEthereumProvider()
      const provider = new ethers.providers.Web3Provider(privyProvider)
      const signer = provider?.getSigner()

      if (signer) {
        const ethAdapter = new EthersAdapter({
          ethers,
          signerOrProvider: signer,
        })

        const safe = await Safe.create({
          ethAdapter,
          safeAddress,
        })

        setSafe(safe)
      }
    }
    getSafe()
  }, [wallets, selectedWallet, safeAddress])

  return { safe, queueSafeTx }
}
