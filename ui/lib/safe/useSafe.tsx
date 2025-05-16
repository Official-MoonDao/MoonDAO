import { useWallets } from '@privy-io/react-auth'
import Safe, { EthersAdapter } from '@safe-global/protocol-kit'
import {
  SafeTransaction,
  SafeTransactionData,
  SafeTransactionDataPartial,
  TransactionOptions,
} from '@safe-global/safe-core-sdk-types'
import { ethers } from 'ethers'
import { useContext, useEffect, useState } from 'react'
import PrivyWalletContext from '../privy/privy-wallet-context'
import useSafeApiKit from './useSafeApiKit'

export interface PendingTransaction {
  safeTxHash: string
  to: string
  value: string
  data: string
  operation: number
  nonce: number
  submissionDate: string
  modified: string
  blockNumber: number | null
  transactionHash: string | null
  safeTxGas: string
  baseGas: string
  gasPrice: string
  gasToken: string
  refundReceiver: string
  confirmationsRequired: number
  confirmations: Array<{
    owner: string
    submissionDate: string
    transactionHash: string | null
    signature: string
  }>
  signatures: string | null
  isExecuted: boolean
  isSuccessful: boolean | null
}

export default function useSafe(safeAddress: string) {
  const { wallets } = useWallets()
  const { selectedWallet } = useContext(PrivyWalletContext)

  const [safe, setSafe] = useState<Safe>()
  const safeApiKit = useSafeApiKit()
  const [lastSafeTxHash, setLastSafeTxHash] = useState<string | null>(null)
  const [lastSafeTxExecuted, setLastSafeTxExecuted] = useState<boolean | null>(
    null
  )
  const [owners, setOwners] = useState<string[]>([])
  const [threshold, setThreshold] = useState<number>(0)
  const [pendingTransactions, setPendingTransactions] = useState<
    PendingTransaction[]
  >([])
  const [transactionsToSign, setTransactionsToSign] = useState<
    PendingTransaction[]
  >([])
  const [transactionsToExecute, setTransactionsToExecute] = useState<
    PendingTransaction[]
  >([])

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

  async function addSigner(newSigner: string) {
    if (!safe) throw new Error('Safe not initialized')

    const safeTransactionData: SafeTransactionData = {
      to: safeAddress,
      value: '0',
      data: safe
        .getContractManager()
        .safeContract.interface.encodeFunctionData('addOwnerWithThreshold', [
          newSigner,
          threshold,
        ]),
      operation: 0,
      safeTxGas: '1000000',
      baseGas: '0',
      gasPrice: '0',
      gasToken: ethers.constants.AddressZero,
      refundReceiver: ethers.constants.AddressZero,
      nonce: await safe.getNonce(),
    }

    return queueSafeTx(safeTransactionData)
  }

  async function removeSigner(signerToRemove: string) {
    if (!safe) throw new Error('Safe not initialized')

    const newThreshold = Math.max(1, threshold - 1)
    const safeTransactionData: SafeTransactionData = {
      to: safeAddress,
      value: '0',
      data: safe
        .getContractManager()
        .safeContract.interface.encodeFunctionData('removeOwner', [
          signerToRemove,
          newThreshold,
        ]),
      operation: 0,
      safeTxGas: '1000000',
      baseGas: '0',
      gasPrice: '0',
      gasToken: ethers.constants.AddressZero,
      refundReceiver: ethers.constants.AddressZero,
      nonce: await safe.getNonce(),
    }

    return queueSafeTx(safeTransactionData)
  }

  async function changeThreshold(newThreshold: number) {
    if (!safe) throw new Error('Safe not initialized')
    if (newThreshold < 1 || newThreshold > owners.length) {
      throw new Error('Invalid threshold value')
    }

    const safeTransactionData: SafeTransactionData = {
      to: safeAddress,
      value: '0',
      data: safe
        .getContractManager()
        .safeContract.interface.encodeFunctionData('changeThreshold', [
          newThreshold,
        ]),
      operation: 0,
      safeTxGas: '1000000',
      baseGas: '0',
      gasPrice: '0',
      gasToken: ethers.constants.AddressZero,
      refundReceiver: ethers.constants.AddressZero,
      nonce: await safe.getNonce(),
    }

    return queueSafeTx(safeTransactionData)
  }

  async function executeTransaction(safeTxHash: string) {
    if (!safe) throw new Error('Safe not initialized')

    const safeTx = await safeApiKit?.getTransaction(safeTxHash)
    if (!safeTx) throw new Error('Transaction not found')

    const safeTransactionData: SafeTransactionData = {
      to: safeTx.to,
      value: safeTx.value,
      data: safeTx.data,
      operation: safeTx.operation,
      safeTxGas: safeTx.safeTxGas,
      baseGas: safeTx.baseGas,
      gasPrice: safeTx.gasPrice,
      gasToken: safeTx.gasToken,
      refundReceiver: safeTx.refundReceiver,
      nonce: safeTx.nonce,
    }

    const safeTx2 = await safe.createTransaction({ safeTransactionData })
    const signature = await safe.signTransactionHash(safeTxHash)

    if (!signature) throw new Error('Failed to sign transaction')

    const options: TransactionOptions = {
      gasLimit: '1000000',
    }

    const executeTx = await safe.executeTransaction(safeTx2, options)
    return executeTx
  }

  async function fetchPendingTransactions() {
    if (!safeApiKit || !safe) return

    try {
      const pendingTxs = await safeApiKit.getPendingTransactions(safeAddress)
      setPendingTransactions(pendingTxs.results)

      // Filter transactions that need current user's signature
      const currentAddress = wallets?.[selectedWallet]?.address
      if (currentAddress) {
        const toSign = pendingTxs.results.filter(
          (tx: PendingTransaction) =>
            !tx.confirmations.some(
              (conf: { owner: string }) =>
                conf.owner.toLowerCase() === currentAddress.toLowerCase()
            )
        )
        setTransactionsToSign(toSign)

        // Filter transactions that can be executed (have enough signatures)
        const toExecute = pendingTxs.results.filter(
          (tx: PendingTransaction) =>
            tx.confirmations.length >= threshold && !tx.isExecuted
        )
        setTransactionsToExecute(toExecute)
      }
    } catch (err) {
      console.error('Error fetching pending transactions:', err)
    }
  }

  async function signPendingTransaction(safeTxHash: string) {
    if (!safe) throw new Error('Safe not initialized')

    try {
      const signature = await safe.signTransactionHash(safeTxHash)
      if (!signature) throw new Error('Failed to sign transaction')

      await safeApiKit?.confirmTransaction(safeTxHash, signature.data)
      await fetchPendingTransactions() // Refresh the list
      return signature
    } catch (err) {
      console.error('Error signing transaction:', err)
      throw err
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

        // Get current owners and threshold
        const currentOwners = await safe.getOwners()
        const currentThreshold = await safe.getThreshold()
        setOwners(currentOwners)
        setThreshold(currentThreshold)

        // Initial fetch of pending transactions
        await fetchPendingTransactions()
      }
    }
    getSafe()
  }, [wallets, selectedWallet, safeAddress])

  // Poll for new pending transactions
  useEffect(() => {
    const interval = setInterval(fetchPendingTransactions, 10000) // Check every 10 seconds
    return () => clearInterval(interval)
  }, [safeApiKit, safe, wallets, selectedWallet, safeAddress])

  useEffect(() => {
    if (!lastSafeTxHash) return

    const checkExecution = async () => {
      const isExecuted = await monitorTransactionExecution(lastSafeTxHash)
      if (isExecuted) {
        setLastSafeTxExecuted(isExecuted)
        await fetchPendingTransactions() // Refresh the list after execution
      }
    }

    const interval = setInterval(checkExecution, 5000) // Check every 5 seconds
    return () => clearInterval(interval)
  }, [lastSafeTxHash])

  return {
    safe,
    queueSafeTx,
    lastSafeTxExecuted,
    addSigner,
    removeSigner,
    changeThreshold,
    executeTransaction,
    owners,
    threshold,
    pendingTransactions,
    transactionsToSign,
    transactionsToExecute,
    signPendingTransaction,
    fetchPendingTransactions,
  }
}
