import { useWallets } from '@privy-io/react-auth'
import { ethers } from 'ethers'
import { useContext, useState } from 'react'
import { toast } from 'react-hot-toast'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import { PendingTransaction, SafeData } from '@/lib/safe/useSafe'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useNetworkMistmatch from '@/lib/thirdweb/hooks/useNetworkMistmatch'
import StandardButton from '../layout/StandardButton'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import SafeExecutionDisclaimer from './SafeExecutionDisclaimer'

type SafeTransactionsProps = {
  address: string | undefined
  safeData: SafeData
}

export default function SafeTransactions({
  address,
  safeData,
}: SafeTransactionsProps) {
  const {
    safe,
    signPendingTransaction,
    executeTransaction,
    rejectTransaction,
    threshold,
    pendingTransactions,
  } = safeData
  const { selectedChain } = useContext(ChainContextV5)
  const { wallets } = useWallets()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const [expandedTx, setExpandedTx] = useState<string | null>(null)
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [selectedTxHash, setSelectedTxHash] = useState<string | null>(null)

  const isNetworkMismatch = useNetworkMistmatch()

  const handleSignTransaction = async (safeTxHash: string) => {
    try {
      await signPendingTransaction(safeTxHash)
      toast.success('Transaction signed successfully!', { style: toastStyle })
    } catch (error) {
      console.error('Error signing transaction:', error)
      toast.error('Failed to sign transaction.', { style: toastStyle })
    }
  }

  const handleExecuteTransaction = async (safeTxHash: string) => {
    setSelectedTxHash(safeTxHash)
    setShowDisclaimer(true)
  }

  const handleRejectTransaction = async (safeTxHash: string) => {
    try {
      await rejectTransaction(safeTxHash)
    } catch (error) {
      console.error('Error rejecting transaction:', error)
      toast.error('Failed to reject transaction.', { style: toastStyle })
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
    <div
      className="max-h-[800px] overflow-y-auto"
      data-testid="transactions-section"
    >
      <h3
        data-testid="transactions-title"
        className="text-xl font-GoodTimes mb-4"
      >
        Transactions
      </h3>

      {pendingTransactions.length > 0 && (
        <div data-testid="transactions-list" className="space-y-4">
          {groupTransactionsByNonce(pendingTransactions).map(
            ({ nonce, transactions }) => {
              const hasRejectionInGroup = transactions.some(
                (tx) =>
                  tx.dataDecoded?.method === 'rejectTransaction' ||
                  tx.dataDecoded?.method === 'Reject Transaction' ||
                  tx.dataDecoded?.method?.toLowerCase().includes('reject') ||
                  ((tx.data === '0x' || tx.data === null) &&
                    ethers.BigNumber.from(tx.value).eq(0))
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
                        ⚠️ Multiple transactions with the same nonce ({nonce}).
                        Only one can be executed.
                      </p>
                    </div>
                  )}

                  {transactions.map((tx: any) => {
                    const hasSigned = tx.confirmations.some(
                      (conf: any) =>
                        conf.owner.toLowerCase() === address?.toLowerCase()
                    )
                    const canExecute =
                      tx.confirmations.length >= threshold &&
                      !tx.isExecuted &&
                      tx.nonce === safeData?.currentNonce

                    const canSign =
                      tx.confirmations.length < threshold &&
                      !tx.isExecuted &&
                      tx.nonce === safeData?.currentNonce

                    const isEthTransfer =
                      (tx.data === '0x' || tx.data === null) &&
                      ethers.BigNumber.from(tx.value).gt(0)

                    const isRejectionTx =
                      tx.dataDecoded?.method === 'rejectTransaction' ||
                      tx.dataDecoded?.method === 'Reject Transaction' ||
                      tx.dataDecoded?.method
                        ?.toLowerCase()
                        .includes('reject') ||
                      ((tx.data === '0x' || tx.data === null) &&
                        ethers.BigNumber.from(tx.value).eq(0))

                    const method = isEthTransfer
                      ? 'Transfer ETH'
                      : isRejectionTx
                      ? 'Reject Transaction'
                      : tx.dataDecoded?.method || 'Unknown Method'

                    return (
                      <div
                        key={tx.safeTxHash}
                        data-testid={`transaction-${tx.safeTxHash}`}
                        className="border-t border-gray-700 pt-4 mt-4 first:border-t-0 first:pt-0 first:mt-0"
                      >
                        <p
                          data-testid={`transaction-nonce-${tx.nonce}`}
                          className="text-gray-300 mb-2"
                        >
                          Nonce: {tx.nonce}
                        </p>
                        <hr className="my-2 opacity-60" />
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

                        {/* Transaction Data Dropdown */}
                        <div className="mb-4">
                          <button
                            onClick={() =>
                              setExpandedTx(
                                expandedTx === tx.safeTxHash
                                  ? null
                                  : tx.safeTxHash
                              )
                            }
                            className="text-sm text-gray-400 hover:text-gray-300 flex items-center gap-2"
                            data-testid={`toggle-data-${tx.safeTxHash}`}
                          >
                            {expandedTx === tx.safeTxHash ? '▼' : '▶'} Show
                            Transaction Data
                          </button>
                          {expandedTx === tx.safeTxHash && (
                            <div
                              className="mt-2 p-3 bg-gray-800/50 rounded-lg overflow-x-auto"
                              data-testid={`transaction-data-${tx.safeTxHash}`}
                            >
                              <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                                {JSON.stringify(
                                  tx.dataDecoded || tx.data,
                                  null,
                                  2
                                )}
                              </pre>
                            </div>
                          )}
                        </div>

                        <div
                          data-testid={`transaction-actions-${tx.safeTxHash}`}
                          className="flex items-center gap-2"
                        >
                          {!hasSigned && !hasRejectionInGroup && (
                            <>
                              {canSign && (
                                <PrivyWeb3Button
                                  dataTestId={`sign-transaction-${tx.safeTxHash}`}
                                  className="rounded-full"
                                  label="Sign"
                                  action={() =>
                                    handleSignTransaction(tx.safeTxHash)
                                  }
                                />
                              )}
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

                          {!hasSigned && hasRejectionInGroup && canSign && (
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

      {isNetworkMismatch ? (
        <div>
          <p>Please switch to {selectedChain.name} to view transactions.</p>
          <StandardButton
            className="mt-2 gradient-2 rounded-full"
            onClick={() => {
              wallets[selectedWallet].switchChain(selectedChain.id)
            }}
          >
            Switch Network
          </StandardButton>
        </div>
      ) : pendingTransactions.length === 0 ? (
        <p data-testid="no-transactions-message" className="text-gray-400">
          No pending transactions
        </p>
      ) : (
        <></>
      )}

      {showDisclaimer && selectedTxHash && (
        <SafeExecutionDisclaimer
          safeData={safeData}
          setEnabled={setShowDisclaimer}
          safeTxHash={selectedTxHash}
          onExecute={executeTransaction}
        />
      )}
    </div>
  )
}
