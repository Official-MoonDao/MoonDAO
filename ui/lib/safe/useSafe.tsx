import Safe, { EthersAdapter } from '@safe-global/protocol-kit'
import {
  SafeTransaction,
  SafeTransactionData,
  SafeTransactionDataPartial,
} from '@safe-global/safe-core-sdk-types'
import { useAddress, useSDK } from '@thirdweb-dev/react'
import { ethers } from 'ethers'
import { useEffect, useState } from 'react'
import useSafeApiKit from './useSafeApiKit'

export default function useSafe(safeAddress: string) {
  const address = useAddress()
  const sdk = useSDK()
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
      const signer = sdk?.getSigner()
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
  }, [sdk, safeAddress])

  return { safe, queueSafeTx }
}
