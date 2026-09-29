import { ethers } from 'ethers'
import { useState } from 'react'
import toast from 'react-hot-toast'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import {
  getRecipientAddress,
  getTransactionMethod,
  isTokenTransfer,
  resolveTokenHint,
  TokenBalanceHint,
} from '@/lib/safe/safeTransactionActions'
import { SafeData } from '@/lib/safe/useSafe'
import ConditionCheckbox from '../layout/ConditionCheckbox'
import Modal from '../layout/Modal'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import SafeTransactionAmount from './SafeTransactionAmount'
import SafeTransactionData from './SafeTransactionData'

type SafeModalProps = {
  safeData: SafeData
  setEnabled: (enabled: boolean) => void
  safeTxHash?: string
  onExecute?: (safeTxHash: string) => Promise<void>
  tokenBalances?: TokenBalanceHint[] | null
}

export default function SafeExecutionDisclaimer({
  safeData,
  setEnabled,
  safeTxHash,
  onExecute,
  tokenBalances,
}: SafeModalProps) {
  const [agreedToDisclaimer, setAgreedToDisclaimer] = useState(false)
  const [expandedTx, setExpandedTx] = useState(false)

  const transaction = safeData.pendingTransactions.find((tx) => tx.safeTxHash === safeTxHash)

  const tokenHint = transaction ? resolveTokenHint(transaction, tokenBalances) : null
  const method = transaction ? getTransactionMethod(transaction, tokenHint?.symbol) : ''
  const recipientAddress = transaction ? getRecipientAddress(transaction) : undefined
  const showTokenOrEthAmount =
    !!transaction &&
    (isTokenTransfer(transaction) ||
      ((transaction.data === '0x' || transaction.data === null) &&
        ethers.BigNumber.from(transaction.value).gt(0)))

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
    <Modal id="safe-modal" setEnabled={setEnabled} title="Safe Execution Disclaimer" size="2xl">
      <div data-testid="safe-modal-content" className="space-y-4">
        <div className="bg-moon-indigo p-4 rounded-lg">
          <p className="text-gray-300 mb-2 flex items-center gap-2">{method}</p>
          <p className="text-gray-300 mb-2">
            To: <span className="text-sm">{recipientAddress}</span>
          </p>
          {showTokenOrEthAmount ? (
            <div className="mb-2">
              <SafeTransactionAmount transaction={transaction} tokenBalances={tokenBalances} />
            </div>
          ) : (
            <p className="text-gray-300 mb-2">
              Value: {ethers.utils.formatEther(transaction.value)} ETH
            </p>
          )}
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
          Please be aware that executing a Safe transaction requires careful consideration. By
          proceeding, you confirm that you understand the implications of this transaction and have
          verified all transaction details.
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
