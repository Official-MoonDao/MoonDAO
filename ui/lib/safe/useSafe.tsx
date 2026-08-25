/*
 * Hook for interacting with a Gnosis Safe.
 * The Safe is initialized with the chain specified in the ChainContextV5 context aka "selectedChain", this ensures that the app and the safe are always on the same chain.
 */
import { useWallets } from '@privy-io/react-auth'
import { SafeMultisigTransactionListResponse } from '@safe-global/api-kit'
import Safe from '@safe-global/protocol-kit'
import {
  SafeTransaction,
  SafeTransactionData,
  SafeTransactionDataPartial,
  TransactionOptions,
} from '@safe-global/safe-core-sdk-types'
import ERC20ABI from 'const/abis/ERC20.json'
import { ethers } from 'ethers'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import { Chain } from 'thirdweb/chains'
import { useActiveAccount } from 'thirdweb/react'
import { getWalletEthersProvider } from '../privy/getWalletEthersProvider'
import PrivyWalletContext from '../privy/privy-wallet-context'
import ChainContextV5 from '../thirdweb/chain-context-v5'
import client from '../thirdweb/client'
import useSafeApiKit from './useSafeApiKit'

export type PendingTransaction =
  SafeMultisigTransactionListResponse['results'][0]

export type SafeData = {
  safe: Safe | undefined
  currentNonce: number | null
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
  isLoadingTransactions: boolean
  transactionsToSign: PendingTransaction[]
  transactionsToExecute: PendingTransaction[]
  signPendingTransaction: (safeTxHash: string) => Promise<any>
  fetchPendingTransactions: (options?: { silent?: boolean }) => Promise<void>
  rejectTransaction: (safeTxHash: string) => Promise<string>
  sendFunds: (
    to: string,
    amount: string,
    tokenAddress?: string
  ) => Promise<string>
}

export default function useSafe(
  safeAddress: string,
  selectedChain?: Chain
): SafeData {
  const account = useActiveAccount()
  const { wallets } = useWallets()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { selectedChain: contextChain } = useContext(ChainContextV5)
  if (!selectedChain) {
    selectedChain = contextChain
  }

  const [safe, setSafe] = useState<Safe>()
  const safeApiKit = useSafeApiKit(selectedChain)
  const [lastSafeTxHash, setLastSafeTxHash] = useState<string | null>(null)
  const [lastSafeTxExecuted, setLastSafeTxExecuted] = useState<boolean | null>(
    null
  )
  const [owners, setOwners] = useState<string[]>([])
  const [threshold, setThreshold] = useState<number>(0)
  const [pendingTransactions, setPendingTransactions] = useState<
    PendingTransaction[]
  >([])
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true)
  const [currentNonce, setCurrentNonce] = useState<number | null>(null)
  const pendingTxRequestId = useRef(0)

  const transactionsToSign = useMemo(
    () => pendingTransactions.filter((tx) => !tx.isExecuted),
    [pendingTransactions]
  )

  const transactionsToExecute = useMemo(
    () =>
      pendingTransactions.filter(
        (tx) =>
          !tx.isExecuted &&
          (tx.confirmations?.length ?? 0) >=
            (tx.confirmationsRequired ?? threshold)
      ),
    [pendingTransactions, threshold]
  )

  async function getCurrentNonce() {
    if (!safe) return null
    try {
      const nonce = await safe?.getNonce()
      setCurrentNonce(nonce)
    } catch (err) {
      console.error('Error getting current nonce:', err)
    }
  }

  async function getNextNonce(): Promise<number | undefined> {
    if (!safe || !safeApiKit) throw new Error('Safe not initialized')

    try {
      const currentNonce = await safe.getNonce()

      const pendingTxs = await safeApiKit.getPendingTransactions(safeAddress)

      // Find the highest nonce among pending transactions
      const highestPendingNonce = pendingTxs.results.reduce(
        (highest: number, tx: PendingTransaction) => {
          return Math.max(highest, tx.nonce)
        },
        -1
      )

      return Math.max(currentNonce, highestPendingNonce + 1)
    } catch (err) {
      console.error('Error getting next nonce:', err)
    }
  }

  async function queueSafeTx(
    safeTransactionData: SafeTransactionData | SafeTransactionDataPartial
  ) {
    try {
      const nextNonce = await getNextNonce()

      // Create a new transaction with the next available nonce
      const safeTx = await safe?.createTransaction({
        transactions: [
          {
            ...safeTransactionData,
          },
        ],
        options: {
          nonce: nextNonce,
        },
      })
      const safeTxHash = await safe?.getTransactionHash(
        safeTx as SafeTransaction
      )

      if (!safeTx || !safeTxHash)
        throw new Error('Failed to create transaction or get transaction hash')

      const signature = await safe?.signHash(safeTxHash)

      if (!signature) throw new Error('Failed to sign transaction hash')

      await safeApiKit?.proposeTransaction({
        safeAddress,
        safeTransactionData: safeTx.data,
        safeTxHash,
        senderAddress: wallets?.[selectedWallet]?.address,
        senderSignature: signature.data,
      })

      // Reset execution tracking so the new transaction is monitored. Without
      // this, a stale `true` from a previously executed tx makes the monitoring
      // effect bail out and the new tx's execution is never detected.
      setLastSafeTxExecuted(false)
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

  const createSafeTransactionData = (
    method: string,
    args: any[]
  ): SafeTransactionDataPartial => {
    if (!safe) throw new Error('Safe not initialized')
    const contractManager = safe.getContractManager()
    return {
      to: safeAddress,
      value: '0',
      data: (contractManager.safeContract as any).encode(method, args),
      operation: 0,
      safeTxGas: '1000000',
      baseGas: '0',
      gasPrice: '0',
      gasToken: ethers.constants.AddressZero,
      refundReceiver: ethers.constants.AddressZero,
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

    const safeTransactionData = createSafeTransactionData(
      'addOwnerWithThreshold',
      [newSigner, newThreshold ?? threshold]
    )

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

    const safeTransactionData = createSafeTransactionData('removeOwner', [
      prevOwner,
      signerToRemove,
      newThreshold,
    ])

    return queueSafeTx(safeTransactionData)
  }

  async function changeThreshold(newThreshold: number) {
    if (!safe) throw new Error('Safe not initialized')
    if (newThreshold < 1 || newThreshold > owners.length) {
      throw new Error('Invalid threshold value')
    }

    const safeTransactionData = createSafeTransactionData('changeThreshold', [
      newThreshold,
    ])

    return queueSafeTx(safeTransactionData)
  }

  async function executeTransaction(safeTxHash: string) {
    if (!safe) throw new Error('Safe not initialized')

    const safeTx = await safeApiKit?.getTransaction(safeTxHash)
    if (!safeTx) throw new Error('Transaction not found')

    // Get current threshold directly from Safe instance
    const currentThreshold = await safe.getThreshold()

    if (
      safeTx.confirmations &&
      safeTx.confirmations.length < currentThreshold
    ) {
      throw new Error(
        `Not enough confirmations. Need ${currentThreshold}, have ${safeTx.confirmations.length}`
      )
    }

    // Get current gas price
    const provider = await getWalletEthersProvider(wallets?.[selectedWallet])
    if (!provider) throw new Error('No provider available')
    const gasPrice = await provider.getGasPrice()

    // For rejection transactions, we need to ensure we have enough gas
    const isRejectionTx =
      safeTx.data === '0x' ||
      safeTx.dataDecoded?.method?.toLowerCase().includes('reject')

    const options: TransactionOptions = {
      gasLimit: isRejectionTx ? '3000000' : '2000000', // Higher gas limit for rejections
      maxFeePerGas: gasPrice.mul(3).toString(), // Higher max fee for rejections
      maxPriorityFeePerGas: gasPrice.mul(2).toString(), // Higher priority fee for rejections
    }

    try {
      // Execute the existing transaction directly
      // Type cast to handle version mismatch between @safe-global packages
      const executeTx = await safe.executeTransaction(safeTx as any, options)

      // Get the transaction hash from the execution response
      const txHash = executeTx.hash

      if (!txHash) {
        throw new Error('No transaction hash returned from execution')
      }

      // Wait for transaction receipt with a longer timeout for rejections
      const receipt: any = await Promise.race([
        provider.waitForTransaction(txHash, 1), // Wait for 1 confirmation
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Transaction timeout')),
            isRejectionTx ? 120000 : 60000
          )
        ),
      ])

      if (receipt.status === 0) {
        console.error('Transaction failed with receipt:', receipt)
        throw new Error('Transaction failed')
      }

      // Wait for Safe API to update
      let isExecuted = false
      let attempts = 0
      const maxAttempts = isRejectionTx ? 24 : 12 // Longer wait for rejections

      while (!isExecuted && attempts < maxAttempts) {
        const tx = await safeApiKit?.getTransaction(safeTxHash)
        if (tx?.isExecuted) {
          isExecuted = true
          await refreshSafeState()
          break
        }
        await new Promise((resolve) =>
          setTimeout(resolve, isRejectionTx ? 10000 : 5000)
        )
        attempts++
      }

      if (!isExecuted) {
        console.warn(
          'Safe API has not updated yet, but transaction was successful'
        )
        await refreshSafeState()
      }

      return executeTx
    } catch (error: any) {
      console.error('Error executing transaction:', error)
      if (error.message.includes('timeout')) {
        throw new Error('Transaction timed out waiting for confirmation')
      }
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

      // Create and sign the transaction directly instead of using queueSafeTx
      const safeTx = await safe.createTransaction({
        transactions: [safeTransactionData],
      })
      const newSafeTxHash = await safe.getTransactionHash(safeTx)

      if (!safeTx || !newSafeTxHash)
        throw new Error('Failed to create transaction or get transaction hash')

      const signature = await safe.signHash(newSafeTxHash)

      if (!signature) throw new Error('Failed to sign transaction hash')

      await safeApiKit.proposeTransaction({
        safeAddress,
        safeTransactionData: safeTx.data,
        safeTxHash: newSafeTxHash,
        senderAddress: wallets?.[selectedWallet]?.address,
        senderSignature: signature.data,
      })

      // Reset execution tracking so the new (rejection) transaction is
      // monitored; see queueSafeTx for why a stale `true` would suppress it.
      setLastSafeTxExecuted(false)
      setLastSafeTxHash(newSafeTxHash)
      return newSafeTxHash
    } catch (err) {
      console.error('Error rejecting transaction:', err)
      throw err
    }
  }

  async function initializeSafe() {
    if (!account?.address) return null

    const wallet = wallets?.[selectedWallet]
    const provider: any = await wallet?.getEthereumProvider()

    if (!provider) return null
    if (selectedChain?.id !== +wallet?.chainId.split(':')[1]) return null

    try {
      const newSafe = await Safe.init({
        provider,
        signer: account.address,
        safeAddress,
      })

      // Owners/threshold are required to init; nonce is not. Fetch it
      // separately so an RPC blip cannot skip setSafe.
      const [currentOwners, currentThreshold] = await Promise.all([
        newSafe.getOwners(),
        newSafe.getThreshold(),
      ])

      setOwners(currentOwners)
      setThreshold(currentThreshold)
      setSafe(newSafe)

      try {
        const nonce = await newSafe.getNonce()
        setCurrentNonce(nonce)
      } catch (nonceErr) {
        console.error('Error getting current nonce:', nonceErr)
      }

      return newSafe
    } catch (err) {
      console.error('Error initializing Safe:', err)
      return null
    }
  }

  async function refreshSafeState() {
    if (!account) return

    try {
      await Promise.all([
        initializeSafe(),
        fetchPendingTransactions({ silent: true }),
      ])
    } catch (err) {
      console.error('Error refreshing Safe state:', err)
    }
  }

  // Reads straight from the Safe Transaction Service, so it deliberately does
  // not depend on the protocol-kit `Safe` instance. Gating on `safe` meant the
  // queue couldn't load until a wallet was connected on the matching chain and
  // several RPC round-trips had completed, which is what made the tab sit on
  // "No pending transactions" for the first ~30s.
  const fetchPendingTransactions = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!safeApiKit || !safeAddress) {
        pendingTxRequestId.current += 1
        setPendingTransactions([])
        setIsLoadingTransactions(false)
        return
      }

      const requestId = ++pendingTxRequestId.current
      if (!silent) setIsLoadingTransactions(true)
      try {
        const pendingTxs = await safeApiKit.getPendingTransactions(safeAddress)
        if (requestId !== pendingTxRequestId.current) return
        setPendingTransactions(pendingTxs.results)
      } catch (err) {
        console.error('Error fetching pending transactions:', err)
      } finally {
        if (requestId === pendingTxRequestId.current) {
          setIsLoadingTransactions(false)
        }
      }
    },
    [safeApiKit, safeAddress]
  )

  async function signPendingTransaction(safeTxHash: string) {
    if (!safe) throw new Error('Safe not initialized')

    try {
      const signature = await safe.signHash(safeTxHash)
      if (!signature) throw new Error('Failed to sign transaction')

      await safeApiKit?.confirmTransaction(safeTxHash, signature.data)
      await fetchPendingTransactions() // Refresh the list
      return signature
    } catch (err) {
      console.error('Error signing transaction:', err)
      throw err
    }
  }

  async function sendFunds(to: string, amount: string, tokenAddress?: string) {
    if (!safe) throw new Error('Safe not initialized')

    // Get the provider from the wallet
    const provider: any = await getWalletEthersProvider(wallets?.[selectedWallet])
    if (!provider) throw new Error('No provider available')

    let safeTransactionData: SafeTransactionDataPartial

    if (tokenAddress) {
      // Check ERC20 balance using thirdweb
      const contract = getContract({
        client,
        address: tokenAddress,
        chain: selectedChain!,
        abi: ERC20ABI as any,
      })

      if (!contract) throw new Error('Failed to initialize token contract')

      const balance = await readContract({
        contract,
        method: 'balanceOf' as any,
        params: [safeAddress],
      })

      if (!balance) throw new Error('Failed to fetch token balance')

      // Convert scientific notation to decimal string if needed
      const amountStr = amount.includes('e')
        ? Number(amount).toLocaleString('fullwide', { useGrouping: false })
        : amount

      // Convert amount to a proper string representation without scientific notation
      const amountBN = ethers.BigNumber.from(amountStr)
      const formattedAmount = amountBN.toString()

      if (BigInt(balance) < BigInt(formattedAmount)) {
        throw new Error(
          `Insufficient token balance. Required: ${formattedAmount}, Available: ${balance.toString()}`
        )
      }

      // Get the encoded transfer data
      const erc20Interface = new ethers.utils.Interface([
        'function transfer(address to, uint256 amount) returns (bool)',
      ])
      const data = erc20Interface.encodeFunctionData('transfer', [
        to,
        formattedAmount,
      ])

      safeTransactionData = {
        to: tokenAddress,
        value: '0',
        data,
        operation: 0,
        safeTxGas: '1000000',
        baseGas: '0',
        gasPrice: '0',
        gasToken: ethers.constants.AddressZero,
        refundReceiver: ethers.constants.AddressZero,
      }
    } else {
      // Check ETH balance
      const balance = await provider.getBalance(safeAddress)
      const amountBN = ethers.BigNumber.from(amount)

      if (balance.lt(amountBN)) {
        throw new Error(
          `Insufficient ETH balance. Required: ${ethers.utils.formatEther(
            amount
          )}, Available: ${ethers.utils.formatEther(balance)}`
        )
      }

      safeTransactionData = {
        to,
        value: amount,
        data: '0x',
        operation: 0,
        safeTxGas: '1000000',
        baseGas: '0',
        gasPrice: '0',
        gasToken: ethers.constants.AddressZero,
        refundReceiver: ethers.constants.AddressZero,
      }
    }

    return queueSafeTx(safeTransactionData)
  }

  // Load the queue as soon as we know which Safe to ask about, in parallel
  // with (and independent of) wallet-dependent Safe initialization below.
  useEffect(() => {
    setPendingTransactions([])
    fetchPendingTransactions()

    return () => {
      // Invalidate in-flight responses so a slower previous Safe cannot
      // overwrite the queue after navigation.
      pendingTxRequestId.current += 1
    }
  }, [fetchPendingTransactions])

  useEffect(() => {
    initializeSafe()
  }, [wallets, selectedWallet, safeAddress, account])

  // Background refresh of the Safe state. Only poll once a Safe is actually
  // initialized, at a relaxed cadence, and never while the tab is hidden —
  // this hook is mounted on team/project pages where users mostly read.
  // Silent so a periodic refetch never swaps the rendered queue for a spinner.
  useEffect(() => {
    if (!safe) return
    const interval = setInterval(async () => {
      if (document.hidden) return
      await Promise.all([
        fetchPendingTransactions({ silent: true }),
        getCurrentNonce(),
      ])
    }, 30000)
    return () => clearInterval(interval)
  }, [safe, fetchPendingTransactions])

  // Tight 5s polling is only justified while a queued transaction is being
  // monitored; stop as soon as it executes.
  useEffect(() => {
    if (!lastSafeTxHash || lastSafeTxExecuted) return

    const checkExecution = async () => {
      const isExecuted = await monitorTransactionExecution(lastSafeTxHash)
      if (isExecuted) {
        setLastSafeTxExecuted(isExecuted)
        await fetchPendingTransactions({ silent: true })
      }
    }

    const interval = setInterval(checkExecution, 5000)
    return () => clearInterval(interval)
  }, [lastSafeTxHash, lastSafeTxExecuted])

  return {
    safe,
    currentNonce,
    queueSafeTx,
    lastSafeTxExecuted,
    addSigner,
    removeSigner,
    changeThreshold,
    executeTransaction,
    owners,
    threshold,
    pendingTransactions,
    isLoadingTransactions,
    transactionsToSign,
    transactionsToExecute,
    signPendingTransaction,
    fetchPendingTransactions,
    rejectTransaction,
    sendFunds,
  } as SafeData
}
