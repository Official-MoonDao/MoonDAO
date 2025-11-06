import { XMarkIcon } from '@heroicons/react/20/solid'
import { ethers } from 'ethers'
import { useState } from 'react'
import toast from 'react-hot-toast'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { SafeData } from '@/lib/safe/useSafe'
import ConditionCheckbox from '../layout/ConditionCheckbox'
import Modal from '../layout/Modal'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import SafeTransactionData from './SafeTransactionData'

type SafeModalProps = {
  safeData: SafeData
  setEnabled: (enabled: boolean) => void
  safeTxHash?: string
  onExecute?: (safeTxHash: string) => Promise<void>
}

export default function SafeExecutionDisclaimer({
  safeData,
  setEnabled,
  safeTxHash,
  onExecute,
}: SafeModalProps) {
  const [agreedToDisclaimer, setAgreedToDisclaimer] = useState(false)
  const [expandedTx, setExpandedTx] = useState(false)

  const transaction = safeData.pendingTransactions.find(
    (tx) => tx.safeTxHash === safeTxHash
  )

  const isEthTransfer =
    transaction &&
    (transaction.data === '0x' || transaction.data === null) &&
    ethers.BigNumber.from(transaction.value).gt(0)

  const isRejectionTx =
    transaction &&
    (transaction.dataDecoded?.method === 'rejectTransaction' ||
      transaction.dataDecoded?.method === 'Reject Transaction' ||
      transaction.dataDecoded?.method?.toLowerCase().includes('reject') ||
      ((transaction.data === '0x' || transaction.data === null) &&
        ethers.BigNumber.from(transaction.value).eq(0)))

  const method = transaction
    ? isEthTransfer
      ? 'Transfer ETH'
      : isRejectionTx
      ? 'Reject Transaction'
      : transaction.dataDecoded?.method || 'Unknown Method'
    : ''

  // Get recipient address - for token transfers, show the actual recipient
  // For ETH transfers, use transaction.to directly
  const recipientAddress =
    transaction &&
    (transaction.dataDecoded?.method === 'transfer' ||
      transaction.dataDecoded?.method === 'transferFrom')
      ? transaction.dataDecoded.method === 'transfer'
        ? transaction.dataDecoded.parameters?.[0]?.value
        : transaction.dataDecoded.parameters?.[1]?.value
      : transaction?.to

  const handleExecute = async () => {
    if (!safeTxHash || !onExecute) return

    try {
      await onExecute(safeTxHash)
      setEnabled(false)
      toast.success('Transaction executed successfully!', { style: toastStyle })
    } catch (error) {
      console.error('Error executing transaction:', error)
      toast.error('Failed to execute transaction', { style: toastStyle })
    }
  }

  if (!transaction) return null

  return (
    <Modal id="safe-modal" setEnabled={setEnabled}>
      <div
        data-testid="safe-modal-content"
        className="bg-dark-cool rounded-[2vmax] p-8 max-w-2xl min-w-[350px] w-full relative md:min-w-[600px]"
      >
        <div
          data-testid="safe-modal-header"
          className="w-full flex items-center justify-between"
        >
          <h1
            data-testid="safe-modal-title"
            className="text-2xl font-GoodTimes"
          >
            Safe Execution Disclaimer
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

        <div className="bg-moon-indigo p-4 rounded-lg mt-4">
          <p className="text-gray-300 mb-2 flex items-center gap-2">{method}</p>
          <p className="text-gray-300 mb-2">
            To: <span className="text-sm">{recipientAddress}</span>
          </p>
          <p className="text-gray-300 mb-2">
            Value: {ethers.utils.formatEther(transaction.value)} ETH
          </p>
          <p className="text-gray-300 mb-2">Nonce: {transaction.nonce}</p>
          <p className="text-gray-300 mb-2">
            Confirmations: {transaction?.confirmations?.length || 0}/
            {transaction?.confirmationsRequired || 0}
          </p>

          <SafeTransactionData
            transaction={transaction}
            expanded={expandedTx}
            onToggle={() => setExpandedTx(!expandedTx)}
          />
        </div>

        <p className="text-white my-4">
          Please be aware that executing a Safe transaction requires careful
          consideration. By proceeding, you confirm that you understand the
          implications of this transaction and have verified all transaction
          details.
        </p>
        <ConditionCheckbox
          label="I understand and agree to execute this transaction."
          agreedToCondition={agreedToDisclaimer}
          setAgreedToCondition={setAgreedToDisclaimer}
        />
        <PrivyWeb3Button
          label="Execute Transaction"
          className="w-full mt-4 rounded-full"
          action={handleExecute}
          isDisabled={!agreedToDisclaimer}
        />
      </div>
    </Modal>
  )
}
