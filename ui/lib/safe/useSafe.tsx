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

export type PendingTransaction = {
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
  dataDecoded: {
    method: string
    args: any[]
  } | null
}

export type SafeData = {
  safe: Safe | undefined
  queueSafeTx: (
    safeTransactionData: SafeTransactionData | SafeTransactionDataPartial
  ) => Promise<string>
  lastSafeTxExecuted: boolean | null
  addSigner: (newSigner: string, newThreshold?: number) => Promise<string>
  removeSigner: (signerToRemove: string) => Promise<string>
  changeThreshold: (newThreshold: number) => Promise<string>
  executeTransaction: (safeTxHash: string) => Promise<any>
  owners: string[]
  threshold: number
  pendingTransactions: PendingTransaction[]
  transactionsToSign: PendingTransaction[]
  transactionsToExecute: PendingTransaction[]
  signPendingTransaction: (safeTxHash: string) => Promise<any>
  fetchPendingTransactions: () => Promise<void>
  rejectTransaction: (safeTxHash: string) => Promise<string>
}

export default function useSafe(safeAddress: string): SafeData {
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

  async function addSigner(newSigner: string, newThreshold?: number) {
    if (!safe) throw new Error('Safe not initialized')

    // If newThreshold is provided, validate it
    if (newThreshold !== undefined) {
      if (newThreshold < 1 || newThreshold > owners.length + 1) {
        throw new Error('Invalid threshold value')
      }
    }

    const safeTransactionData: SafeTransactionData = {
      to: safeAddress,
      value: '0',
      data: safe
        .getContractManager()
        .safeContract.encode('addOwnerWithThreshold', [
          newSigner,
          newThreshold ?? threshold,
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

    // Get current owners to find the previous owner
    const currentOwners = await safe.getOwners()
    const signerIndex = currentOwners.findIndex(
      (owner) => owner.toLowerCase() === signerToRemove.toLowerCase()
    )
    if (signerIndex === -1) {
      throw new Error('Signer not found in owners list')
    }
    // In the Safe contract, owners are stored in a linked list
    // The prevOwner needs to be the address that points to the owner we want to remove
    // If we're removing the first owner, the prevOwner should be SENTINEL_OWNERS (0x1)
    // Otherwise, it should be the owner that comes before in the array
    const prevOwner =
      signerIndex === 0
        ? '0x0000000000000000000000000000000000000001' // SENTINEL_OWNERS
        : currentOwners[signerIndex - 1]

    const newThreshold = Math.max(1, threshold - 1)

    const safeTransactionData: SafeTransactionData = {
      to: safeAddress,
      value: '0',
      data: safe
        .getContractManager()
        .safeContract.encode('removeOwner', [
          prevOwner,
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
        .safeContract.encode('changeThreshold', [newThreshold]),
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

    // Get current threshold directly from Safe instance
    const currentThreshold = await safe.getThreshold()

    if (safeTx.confirmations.length < currentThreshold) {
      throw new Error(
        `Not enough confirmations. Need ${currentThreshold}, have ${safeTx.confirmations.length}`
      )
    }

    // Get current gas price
    const provider = await wallets?.[selectedWallet]?.getEthersProvider()
    if (!provider) throw new Error('No provider available')
    const gasPrice = await provider.getGasPrice()

    const options: TransactionOptions = {
      gasLimit: '2000000',
      maxFeePerGas: gasPrice.mul(2).toString(),
      maxPriorityFeePerGas: gasPrice.toString(),
    }

    try {
      // Execute the existing transaction directly
      const executeTx = await safe.executeTransaction(safeTx, options)
      console.log('Transaction executed:', executeTx)

      // Get the transaction hash from the execution response
      const txHash = executeTx.hash

      if (!txHash) {
        throw new Error('No transaction hash returned from execution')
      }

      const receipt = await provider.waitForTransaction(txHash)

      if (receipt.status === 0) {
        throw new Error('Transaction failed')
      }

      let isExecuted = false
      let attempts = 0
      const maxAttempts = 60

      while (!isExecuted && attempts < maxAttempts) {
        const tx = await safeApiKit?.getTransaction(safeTxHash)
        console.log('Transaction status:', tx)

        if (tx?.isExecuted) {
          console.log('Transaction confirmed as executed')
          isExecuted = true
          await refreshSafeState()
          break
        }

        if (receipt.status === 1) {
          console.log(
            'Transaction receipt indicates success, waiting for Safe API to update...'
          )
          await new Promise((resolve) => setTimeout(resolve, 10000))
        } else {
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
        attempts++
      }

      if (!isExecuted) {
        console.error('Transaction execution status check timed out')
        if (receipt.status === 1) {
          console.log(
            'Transaction was successful but Safe API has not updated yet'
          )
          await refreshSafeState()
          return executeTx
        }
        throw new Error('Transaction execution status check timed out')
      }

      return executeTx
    } catch (error) {
      console.error('Error executing transaction:', error)
      throw error
    }
  }

  async function rejectTransaction(safeTxHash: string) {
    if (!safe || !safeApiKit) throw new Error('Safe not initialized')

    try {
      // Get the transaction to reject
      const tx = await safeApiKit.getTransaction(safeTxHash)
      if (!tx) throw new Error('Transaction not found')

      // Create a rejection transaction with the same nonce
      const safeTransactionData: SafeTransactionData = {
        to: safeAddress,
        value: '0',
        data: '0x', // Empty data for rejection
        operation: 0,
        safeTxGas: '1000000',
        baseGas: '0',
        gasPrice: '0',
        gasToken: ethers.constants.AddressZero,
        refundReceiver: ethers.constants.AddressZero,
        nonce: tx.nonce, // Use the same nonce as the transaction we're rejecting
      }

      return queueSafeTx(safeTransactionData)
    } catch (err) {
      console.error('Error rejecting transaction:', err)
      throw err
    }
  }

  async function refreshSafeState() {
    if (!safe) return

    try {
      const currentOwners = await safe.getOwners()
      const currentThreshold = await safe.getThreshold()

      setOwners(currentOwners)
      setThreshold(currentThreshold)

      await new Promise((resolve) => setTimeout(resolve, 100))

      await fetchPendingTransactions()

      const provider = await wallets?.[selectedWallet]?.getEthersProvider()
      const signer = provider?.getSigner()
      if (signer) {
        const ethAdapter = new EthersAdapter({
          ethers,
          signerOrProvider: signer,
        })

        const newSafe = await Safe.create({
          ethAdapter,
          safeAddress,
        })

        setSafe(newSafe)
      }
    } catch (err) {
      console.error('Error refreshing Safe state:', err)
    }
  }

  async function fetchPendingTransactions() {
    if (!safeApiKit || !safe) return

    try {
      const pendingTxs = await safeApiKit.getPendingTransactions(safeAddress)
      setPendingTransactions(pendingTxs.results)

      const currentThreshold = await safe.getThreshold()
      const currentAddress = wallets?.[selectedWallet]?.address

      if (currentAddress) {
        // Show all pending transactions, but mark which ones need signing
        const toSign = pendingTxs.results.filter((tx: PendingTransaction) => {
          const hasSigned = tx.confirmations.some(
            (conf: { owner: string }) =>
              conf.owner.toLowerCase() === currentAddress.toLowerCase()
          )
          return !tx.isExecuted // Show all non-executed transactions
        })
        setTransactionsToSign(toSign)

        // Filter transactions that can be executed
        const toExecute = pendingTxs.results.filter(
          (tx: PendingTransaction) => {
            return tx.confirmations.length >= currentThreshold && !tx.isExecuted
          }
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
        await refreshSafeState()
      }
    }
    getSafe()
  }, [wallets, selectedWallet, safeAddress])

  useEffect(() => {
    const interval = setInterval(async () => {
      await refreshSafeState()
    }, 5000)
    return () => clearInterval(interval)
  }, [safeApiKit, safe, wallets, selectedWallet, safeAddress])

  useEffect(() => {
    if (!lastSafeTxHash) return

    const checkExecution = async () => {
      const isExecuted = await monitorTransactionExecution(lastSafeTxHash)
      if (isExecuted) {
        setLastSafeTxExecuted(isExecuted)
        await fetchPendingTransactions()
      }
    }

    const interval = setInterval(checkExecution, 5000)
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
    rejectTransaction,
  } as SafeData
}
