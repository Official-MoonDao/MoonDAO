import { useWallets } from '@privy-io/react-auth'
import Safe, { EthersAdapter } from '@safe-global/protocol-kit'
import {
  SafeTransaction,
  SafeTransactionData,
  SafeTransactionDataPartial,
} from '@safe-global/safe-core-sdk-types'
import { ethers } from 'ethers'
import { useContext, useEffect, useState } from 'react'
import PrivyWalletContext from '../privy/privy-wallet-context'
import useSafeApiKit from './useSafeApiKit'

export default function useSafe(safeAddress: string) {
  const { wallets } = useWallets()
  const { selectedWallet } = useContext(PrivyWalletContext)

  const [safe, setSafe] = useState<Safe>()
  const safeApiKit = useSafeApiKit()
  const [lastSafeTxHash, setLastSafeTxHash] = useState<string | null>(null)
  const [lastSafeTxExecuted, setLastSafeTxExecuted] = useState<boolean | null>(
    null
  )

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
        senderAddress: wallets?.[selectedWallet]?.address,
        senderSignature: signature.data,
      })

      setLastSafeTxHash(safeTxHash)
      return safeTxHash
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async function monitorTransactionExecution(safeTxHash: string) {
    if (!safeApiKit) return null

    try {
      const tx = await safeApiKit.getTransaction(safeTxHash)
      return tx.isExecuted
    } catch (err) {
      console.error('Error monitoring transaction:', err)
      return null
    }
  }

  useEffect(() => {
    async function getSafe() {
      const provider = await wallets?.[selectedWallet]?.getEthersProvider()
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

  useEffect(() => {
    if (!lastSafeTxHash) return

    const checkExecution = async () => {
      const isExecuted = await monitorTransactionExecution(lastSafeTxHash)
      if (isExecuted) {
        setLastSafeTxExecuted(isExecuted)
      }
    }

    const interval = setInterval(checkExecution, 5000) // Check every 5 seconds
    return () => clearInterval(interval)
  }, [lastSafeTxHash])

  return { safe, queueSafeTx, lastSafeTxExecuted }
}
