import { useWallets } from '@privy-io/react-auth'
import { ethers } from 'ethers'
import { useContext, useState } from 'react'
import { toast } from 'react-hot-toast'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import {
  deriveTransactionActions,
  getRecipientAddress,
  getTransactionMethod,
  groupHasRejection,
  groupTransactionsByNonce,
  isEthTransfer,
  isTokenTransfer,
} from '@/lib/safe/safeTransactionActions'
import { SafeData } from '@/lib/safe/useSafe'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useNetworkMismatch from '@/lib/thirdweb/hooks/useNetworkMismatch'
import StandardButton from '../layout/StandardButton'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import SafeExecutionDisclaimer from './SafeExecutionDisclaimer'
import SafeTransactionData from './SafeTransactionData'

type SafeTransactionsProps = {
  address: string | undefined
  safeData: SafeData
}

const SIGN_BTN_CLASS =
  'rounded-full px-5 py-2 text-sm font-semibold shadow-lg shadow-purple-500/20 transition-all duration-200 hover:scale-105'
const EXECUTE_BTN_CLASS =
  'rounded-full px-5 py-2 text-sm font-semibold bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:scale-105'
const REJECT_BTN_CLASS =
  'rounded-full px-5 py-2 text-sm font-semibold bg-transparent border border-red-500/40 text-red-300 hover:bg-red-500/10 hover:border-red-500/60 transition-all duration-200'

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

  const isNetworkMismatch = useNetworkMismatch()

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

  return (
    <div
      className="max-h-[600px] overflow-y-auto pr-1"
      data-testid="transactions-section"
    >
      <div className="flex items-center justify-between mb-4">
        <h3
          data-testid="transactions-title"
          className="text-lg font-GoodTimes text-white"
        >
          Recent Transactions
        </h3>
        {pendingTransactions.length > 0 && (
          <span className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs text-slate-300">
            {pendingTransactions.length} pending
          </span>
        )}
      </div>

      {pendingTransactions.length > 0 && (
        <div data-testid="transactions-list" className="space-y-4">
          {groupTransactionsByNonce(pendingTransactions).map(
            ({ nonce, transactions }) => {
              const hasRejectionInGroup = groupHasRejection(transactions)

              return (
                <div
                  key={nonce}
                  data-testid={`transaction-group-${nonce}`}
                  className={
                    transactions.length > 1
                      ? 'rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-2 space-y-2'
                      : 'space-y-2'
                  }
                >
                  {transactions.length > 1 && (
                    <div
                      data-testid={`duplicate-nonce-warning-${nonce}`}
                      className="flex items-start gap-2 px-2 pt-1"
                    >
                      <span className="text-amber-400 mt-0.5 text-xs">⚠</span>
                      <p className="text-amber-300/90 text-xs leading-relaxed">
                        Multiple transactions share nonce {nonce}. Only one can
                        be executed — the others will be invalidated.
                      </p>
                    </div>
                  )}

                  {transactions.map((tx: any) => {
                    const confirmations = tx.confirmations || []

                    const {
                      requiredConfirmations,
                      showSignButton,
                      showRejectButton,
                      showSignWithRejectionButton,
                      showSignedStatus,
                      showExecuteButton,
                      showRejectAfterSignButton,
                      showBlockedIndicator,
                    } = deriveTransactionActions(tx, {
                      threshold,
                      currentNonce: safeData?.currentNonce,
                      address,
                      hasRejectionInGroup,
                    })

                    const method = getTransactionMethod(tx)
                    const recipientAddress = getRecipientAddress(tx)

                    const isTransfer = isEthTransfer(tx) || isTokenTransfer(tx)
                    const methodBadgeClass = isTransfer
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : method === 'Reject Transaction'
                      ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                      : 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/30'

                    return (
                      <div
                        key={tx.safeTxHash}
                        data-testid={`transaction-${tx.safeTxHash}`}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/20"
                      >
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <span
                            data-testid={`transaction-method-${tx.safeTxHash}`}
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${methodBadgeClass}`}
                          >
                            {method}
                          </span>
                          <span
                            data-testid={`transaction-nonce-${tx.nonce}`}
                            className="text-xs text-slate-500"
                          >
                            Nonce: {tx.nonce}
                          </span>
                        </div>

                        <div className="space-y-2.5 mb-4">
                          <div className="flex items-start justify-between gap-4 text-sm">
                            <span className="text-slate-500 shrink-0">To</span>
                            <span
                              data-testid={`transaction-to-${tx.safeTxHash}`}
                              className="font-mono text-slate-200 text-right break-all"
                            >
                              {recipientAddress}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-sm">
                            <span className="text-slate-500 shrink-0">
                              Value
                            </span>
                            <span
                              data-testid={`transaction-value-${tx.safeTxHash}`}
                              className="text-slate-200"
                            >
                              {ethers.utils.formatEther(tx.value)} ETH
                            </span>
                          </div>
                        </div>

                        <div
                          data-testid={`transaction-confirmations-${tx.safeTxHash}`}
                          className="mb-4"
                        >
                          <div className="flex items-center justify-between text-slate-400 text-sm mb-1.5">
                            <span>
                              Confirmations: {confirmations.length}/
                              {requiredConfirmations}
                            </span>
                            {confirmations.length >= requiredConfirmations ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                Fully signed
                              </span>
                            ) : (
                              <span className="text-amber-400 font-medium">
                                {requiredConfirmations - confirmations.length}{' '}
                                more needed
                              </span>
                            )}
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-black/30 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (confirmations.length /
                                    Math.max(requiredConfirmations, 1)) *
                                    100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>

                        <SafeTransactionData
                          transaction={tx}
                          expanded={expandedTx === tx.safeTxHash}
                          onToggle={() =>
                            setExpandedTx(
                              expandedTx === tx.safeTxHash
                                ? null
                                : tx.safeTxHash
                            )
                          }
                        />

                        <div
                          data-testid={`transaction-actions-${tx.safeTxHash}`}
                          className="flex items-center flex-wrap gap-2"
                        >
                          {showSignButton && (
                            <PrivyWeb3Button
                              dataTestId={`sign-transaction-${tx.safeTxHash}`}
                              className={SIGN_BTN_CLASS}
                              noPadding
                              label="Sign"
                              action={() =>
                                handleSignTransaction(tx.safeTxHash)
                              }
                            />
                          )}
                          {showRejectButton && (
                            <PrivyWeb3Button
                              dataTestId={`reject-transaction-${tx.safeTxHash}`}
                              className={REJECT_BTN_CLASS}
                              noGradient
                              noPadding
                              label="Reject"
                              action={() =>
                                handleRejectTransaction(tx.safeTxHash)
                              }
                            />
                          )}

                          {showSignWithRejectionButton && (
                            <PrivyWeb3Button
                              dataTestId={`sign-transaction-with-rejection-${tx.safeTxHash}`}
                              className={SIGN_BTN_CLASS}
                              noPadding
                              label="Sign"
                              action={() =>
                                handleSignTransaction(tx.safeTxHash)
                              }
                            />
                          )}

                          {showSignedStatus && (
                            <span
                              data-testid={`signed-status-${tx.safeTxHash}`}
                              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-emerald-300 text-xs font-medium"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              You have signed this transaction
                            </span>
                          )}
                          {showExecuteButton && (
                            <PrivyWeb3Button
                              dataTestId={`execute-transaction-${tx.safeTxHash}`}
                              className={EXECUTE_BTN_CLASS}
                              noGradient
                              noPadding
                              label="Execute"
                              action={() =>
                                handleExecuteTransaction(tx.safeTxHash)
                              }
                            />
                          )}
                          {showRejectAfterSignButton && (
                            <PrivyWeb3Button
                              dataTestId={`reject-after-sign-${tx.safeTxHash}`}
                              className={REJECT_BTN_CLASS}
                              noGradient
                              noPadding
                              label="Reject"
                              action={() =>
                                handleRejectTransaction(tx.safeTxHash)
                              }
                            />
                          )}
                          {showBlockedIndicator && (
                            <span
                              data-testid={`blocked-by-nonce-${tx.safeTxHash}`}
                              className="inline-flex items-center gap-1.5 text-amber-400 text-xs"
                            >
                              Ready to execute once nonce{' '}
                              {safeData?.currentNonce} is processed first.
                            </span>
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
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-amber-300 text-sm mb-3">
            Please switch to {selectedChain.name} to view and act on
            transactions.
          </p>
          <StandardButton
            className="gradient-2 rounded-full text-sm"
            onClick={() => {
              wallets[selectedWallet].switchChain(selectedChain.id)
            }}
          >
            Switch Network
          </StandardButton>
        </div>
      ) : pendingTransactions.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
          <p className="text-3xl mb-2 opacity-40">✓</p>
          <p
            data-testid="no-transactions-message"
            className="text-slate-400 text-sm"
          >
            No pending transactions
          </p>
        </div>
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
