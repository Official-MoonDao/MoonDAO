import { XMarkIcon } from '@heroicons/react/20/solid'
import { ethers } from 'ethers'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useActiveAccount } from 'thirdweb/react'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { PendingTransaction } from '@/lib/safe/useSafe'
import { useENS } from '@/lib/utils/hooks/useENS'
import Modal from '../layout/Modal'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

interface SafeModalProps {
  safeData: any
  safeAddress: string
  isEnabled: boolean
  setEnabled: (enabled: boolean) => void
}

function SafeOwner({ owner }: { owner: string }) {
  const { data: ens } = useENS(owner)
  return (
    <span className="text-gray-300">
      {ens?.name ? ens.name : `${owner.slice(0, 6)}...${owner.slice(-4)}`}
    </span>
  )
}

export default function SafeModal({
  safeData,
  safeAddress,
  isEnabled,
  setEnabled,
}: SafeModalProps) {
  const [newSignerAddress, setNewSignerAddress] = useState('')
  const [newThreshold, setNewThreshold] = useState<number>(safeData.threshold)
  const [isAddingSigner, setIsAddingSigner] = useState(false)
  const [isChangingThreshold, setIsChangingThreshold] = useState(false)

  const account = useActiveAccount()
  const address = account?.address

  const {
    safe,
    owners,
    threshold,
    pendingTransactions,
    transactionsToSign,
    transactionsToExecute,
    addSigner,
    removeSigner,
    changeThreshold,
    signPendingTransaction,
    executeTransaction,
    fetchPendingTransactions,
    rejectTransaction,
  } = safeData

  const validateAddress = (address: string) => {
    return ethers.utils.isAddress(address)
  }

  const handleAddSigner = async () => {
    if (!validateAddress(newSignerAddress)) {
      toast.error('Invalid Ethereum address', { style: toastStyle })
      return
    }

    try {
      setIsAddingSigner(true)
      await addSigner(newSignerAddress)
      setNewSignerAddress('')
    } catch (error) {
      console.error('Error adding signer:', error)
    } finally {
      setIsAddingSigner(false)
    }
  }

  const handleRemoveSigner = async (signerAddress: string) => {
    try {
      await removeSigner(signerAddress)
      await new Promise((resolve) => setTimeout(resolve, 2000))
      await fetchPendingTransactions()
    } catch (error) {
      console.error('Error removing signer:', error)
    }
  }

  const handleChangeThreshold = async () => {
    if (newThreshold < 1 || newThreshold > owners.length) {
      toast.error('Invalid threshold value', { style: toastStyle })
      return
    }

    try {
      setIsChangingThreshold(true)
      await changeThreshold(newThreshold)
      setNewThreshold(0)
    } catch (error) {
      console.error('Error changing threshold:', error)
    } finally {
      setIsChangingThreshold(false)
    }
  }

  const handleSignTransaction = async (safeTxHash: string) => {
    try {
      await signPendingTransaction(safeTxHash)
      toast.success('Transaction signed successfully', { style: toastStyle })
    } catch (error) {
      console.error('Error signing transaction:', error)
      toast.error('Failed to sign transaction', { style: toastStyle })
    }
  }

  const handleExecuteTransaction = async (safeTxHash: string) => {
    try {
      await executeTransaction(safeTxHash)
      toast.success('Transaction executed successfully', { style: toastStyle })
    } catch (error) {
      console.error('Error executing transaction:', error)
      toast.error('Failed to execute transaction', { style: toastStyle })
    }
  }

  const handleRejectTransaction = async (safeTxHash: string) => {
    try {
      await rejectTransaction(safeTxHash)
      toast.success('Transaction rejected successfully', { style: toastStyle })
    } catch (error) {
      console.error('Error rejecting transaction:', error)
      toast.error('Failed to reject transaction', { style: toastStyle })
    }
  }

  const groupTransactionsByNonce = (transactions: PendingTransaction[]) => {
    const groupedTxs = transactions.reduce((acc, tx) => {
      if (!acc[tx.nonce]) {
        acc[tx.nonce] = []
      }
      acc[tx.nonce].push(tx)
      return acc
    }, {} as { [key: number]: PendingTransaction[] })

    return Object.entries(groupedTxs).map(([nonce, txs]) => ({
      nonce: Number(nonce),
      transactions: txs,
    }))
  }

  return (
    <Modal id="safe-modal" setEnabled={setEnabled}>
      <div
        data-testid="safe-modal-content"
        className="bg-dark-cool rounded-[2vmax] p-8 max-w-2xl w-full relative md:min-w-[600px]"
      >
        <div
          data-testid="safe-modal-header"
          className="w-full flex items-center justify-between"
        >
          <h1
            data-testid="safe-modal-title"
            className="text-2xl font-GoodTimes "
          >
            Safe
          </h1>
          <button
            data-testid="safe-modal-close"
            id="close-modal"
            type="button"
            className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>

        {/* Current Safe Info */}
        <div data-testid="safe-info" className="mb-8">
          <p data-testid="safe-address" className="text-gray-400 mb-2">
            Address: {safeAddress.slice(0, 6)}...{safeAddress.slice(-4)}
          </p>
        </div>

        {/* Signers Management */}
        <div data-testid="signers-section" className="mb-8">
          <h3
            data-testid="signers-title"
            className="text-xl font-GoodTimes mb-4"
          >
            Signers
          </h3>
          <div data-testid="signers-list" className="space-y-4">
            {owners.map((owner: string) => (
              <div
                key={owner}
                data-testid={`signer-${owner}`}
                className="flex items-center justify-between bg-darkest-cool p-4 rounded-lg"
              >
                <SafeOwner owner={owner} />
                {owners.length > 1 && (
                  <button
                    data-testid={`remove-signer-${owner}`}
                    onClick={() => handleRemoveSigner(owner)}
                    className="text-red-500 hover:text-red-400"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          <div
            data-testid="add-signer-section"
            className="mt-4 flex gap-4 flex-col md:flex-row"
          >
            <input
              data-testid="new-signer-input"
              type="text"
              value={newSignerAddress}
              onChange={(e) => setNewSignerAddress(e.target.value)}
              placeholder="New signer address"
              className="flex-1 bg-darkest-cool text-white px-4 py-2 rounded-lg"
            />
            <PrivyWeb3Button
              dataTestId="add-signer-button"
              className="rounded-full"
              label="Add Signer"
              action={handleAddSigner}
              isDisabled={!validateAddress(newSignerAddress) || isAddingSigner}
            />
          </div>
        </div>

        {/* Threshold Management */}
        <div data-testid="threshold-section" className="mb-8">
          <h3
            data-testid="threshold-title"
            className="text-xl font-GoodTimes mb-4"
          >
            Threshold
          </h3>
          <div
            data-testid="threshold-controls"
            className="flex flex-col md:flex-row gap-4 justify-between"
          >
            <div
              data-testid="threshold-input-group"
              className="flex items-center gap-2"
            >
              <input
                data-testid="threshold-input"
                type="number"
                value={newThreshold || ''}
                onChange={(e) => setNewThreshold(Number(e.target.value))}
                min={1}
                max={owners.length}
                placeholder="New threshold"
                className="w-20 bg-darkest-cool text-white px-4 py-2 rounded-lg"
              />
              <span data-testid="threshold-max" className="text-gray-400">
                / {owners.length}
              </span>
            </div>
            <PrivyWeb3Button
              dataTestId="update-threshold-button"
              className="rounded-full"
              label="Update Threshold"
              action={handleChangeThreshold}
              isDisabled={!newThreshold || isChangingThreshold}
            />
          </div>
        </div>

        {/* Transactions */}
        <div data-testid="transactions-section">
          <h3
            data-testid="transactions-title"
            className="text-xl font-GoodTimes mb-4"
          >
            Transactions
          </h3>

          {transactionsToSign.length > 0 && (
            <div data-testid="transactions-list" className="space-y-4">
              {groupTransactionsByNonce(transactionsToSign).map(
                ({ nonce, transactions }) => {
                  const hasRejectionInGroup = transactions.some(
                    (tx) =>
                      tx.data === '0x' ||
                      tx.data === null ||
                      tx.dataDecoded?.method === 'rejectTransaction' ||
                      tx.dataDecoded?.method === 'Reject Transaction' ||
                      tx.dataDecoded?.method?.toLowerCase().includes('reject')
                  )

                  return (
                    <div
                      key={nonce}
                      data-testid={`transaction-group-${nonce}`}
                      className="bg-moon-indigo p-4 rounded-lg"
                    >
                      {transactions.length > 1 && (
                        <div
                          data-testid={`duplicate-nonce-warning-${nonce}`}
                          className="mb-4 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg"
                        >
                          <p className="text-yellow-500 text-sm">
                            ⚠️ Multiple transactions with the same nonce (
                            {nonce}). Only one can be executed.
                          </p>
                        </div>
                      )}

                      {transactions.map((tx) => {
                        const hasSigned = tx.confirmations.some(
                          (conf) =>
                            conf.owner.toLowerCase() === address?.toLowerCase()
                        )
                        const canExecute =
                          tx.confirmations.length >= threshold && !tx.isExecuted

                        const isRejectionTx =
                          tx.data === '0x' ||
                          tx.data === null ||
                          tx.dataDecoded?.method === 'rejectTransaction' ||
                          tx.dataDecoded?.method === 'Reject Transaction' ||
                          tx.dataDecoded?.method
                            ?.toLowerCase()
                            .includes('reject')

                        const method = isRejectionTx
                          ? 'Reject Transaction'
                          : tx.dataDecoded?.method || 'Unknown Method'

                        return (
                          <div
                            key={tx.safeTxHash}
                            data-testid={`transaction-${tx.safeTxHash}`}
                            className="border-t border-gray-700 pt-4 mt-4 first:border-t-0 first:pt-0 first:mt-0"
                          >
                            <p
                              data-testid={`transaction-method-${tx.safeTxHash}`}
                              className="text-gray-300 mb-2 flex items-center gap-2"
                            >
                              {method}
                            </p>
                            <p
                              data-testid={`transaction-to-${tx.safeTxHash}`}
                              className="text-gray-300 mb-2"
                            >
                              To: <span className="text-sm">{tx.to}</span>
                            </p>
                            <p
                              data-testid={`transaction-value-${tx.safeTxHash}`}
                              className="text-gray-300 mb-2"
                            >
                              Value: {ethers.utils.formatEther(tx.value)} ETH
                            </p>
                            <p
                              data-testid={`transaction-confirmations-${tx.safeTxHash}`}
                              className="text-gray-300 mb-2"
                            >
                              Confirmations: {tx.confirmations.length}/
                              {tx.confirmationsRequired}
                            </p>
                            <div
                              data-testid={`transaction-actions-${tx.safeTxHash}`}
                              className="flex items-center gap-2"
                            >
                              {!hasSigned && !hasRejectionInGroup && (
                                <>
                                  <PrivyWeb3Button
                                    dataTestId={`sign-transaction-${tx.safeTxHash}`}
                                    className="rounded-full"
                                    label="Sign"
                                    action={() =>
                                      handleSignTransaction(tx.safeTxHash)
                                    }
                                  />
                                  <PrivyWeb3Button
                                    dataTestId={`reject-transaction-${tx.safeTxHash}`}
                                    className="rounded-full bg-red-500 hover:bg-red-600"
                                    label="Reject"
                                    action={() =>
                                      handleRejectTransaction(tx.safeTxHash)
                                    }
                                  />
                                </>
                              )}

                              {!hasSigned && hasRejectionInGroup && (
                                <PrivyWeb3Button
                                  dataTestId={`sign-transaction-with-rejection-${tx.safeTxHash}`}
                                  className="rounded-full"
                                  label="Sign"
                                  action={() =>
                                    handleSignTransaction(tx.safeTxHash)
                                  }
                                />
                              )}

                              {hasSigned && (
                                <span
                                  data-testid={`signed-status-${tx.safeTxHash}`}
                                  className="text-green-500 text-sm"
                                >
                                  ✓ You have signed this transaction
                                </span>
                              )}
                              {canExecute && (
                                <PrivyWeb3Button
                                  dataTestId={`execute-transaction-${tx.safeTxHash}`}
                                  className="rounded-full"
                                  label="Execute"
                                  action={() =>
                                    handleExecuteTransaction(tx.safeTxHash)
                                  }
                                />
                              )}
                              {hasSigned &&
                                !tx.isExecuted &&
                                !hasRejectionInGroup && (
                                  <PrivyWeb3Button
                                    dataTestId={`reject-after-sign-${tx.safeTxHash}`}
                                    className="rounded-full bg-red-500 hover:bg-red-600"
                                    label="Reject"
                                    action={() =>
                                      handleRejectTransaction(tx.safeTxHash)
                                    }
                                  />
                                )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                }
              )}
            </div>
          )}

          {transactionsToSign.length === 0 && (
            <p data-testid="no-transactions-message" className="text-gray-400">
              No pending transactions
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
