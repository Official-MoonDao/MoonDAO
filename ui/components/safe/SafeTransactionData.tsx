import { ethers } from 'ethers'
import { PendingTransaction } from '@/lib/safe/useSafe'

type SafeTransactionDataProps = {
  transaction: PendingTransaction
  expanded: boolean
  onToggle: () => void
}

export default function SafeTransactionData({
  transaction,
  expanded,
  onToggle,
}: SafeTransactionDataProps) {
  const isEthTransfer =
    (transaction.data === '0x' || transaction.data === null) &&
    ethers.BigNumber.from(transaction.value).gt(0)

  const isRejectionTx =
    transaction.dataDecoded?.method === 'rejectTransaction' ||
    transaction.dataDecoded?.method === 'Reject Transaction' ||
    transaction.dataDecoded?.method?.toLowerCase().includes('reject') ||
    ((transaction.data === '0x' || transaction.data === null) &&
      ethers.BigNumber.from(transaction.value).eq(0))

  const renderTransactionDetails = () => {
    if (isEthTransfer) {
      return (
        <div className="space-y-2">
          <p className="text-gray-300">Type: ETH Transfer</p>
          <p className="text-gray-300">
            Amount: {ethers.utils.formatEther(transaction.value)} ETH
          </p>
        </div>
      )
    }

    if (isRejectionTx) {
      return (
        <div className="space-y-2">
          <p className="text-gray-300">Type: Transaction Rejection</p>
          <p className="text-gray-300">Nonce: {transaction.nonce}</p>
        </div>
      )
    }

    if (transaction.dataDecoded?.method === 'addOwnerWithThreshold') {
      const [newOwner, newThreshold] = transaction.dataDecoded.parameters || []
      return (
        <div className="space-y-2">
          <p className="text-gray-300">Type: Add Signer</p>
          <p className="text-gray-300">New Signer: {newOwner?.value}</p>
          <p className="text-gray-300">New Threshold: {newThreshold?.value}</p>
        </div>
      )
    }

    if (transaction.dataDecoded?.method === 'removeOwner') {
      const [prevOwner, ownerToRemove, newThreshold] =
        transaction.dataDecoded.parameters || []
      return (
        <div className="space-y-2">
          <p className="text-gray-300">Type: Remove Signer</p>
          <p className="text-gray-300">
            Signer to Remove: {ownerToRemove?.value}
          </p>
          <p className="text-gray-300">New Threshold: {newThreshold?.value}</p>
        </div>
      )
    }

    if (transaction.dataDecoded?.method === 'changeThreshold') {
      const [newThreshold] = transaction.dataDecoded.parameters || []
      return (
        <div className="space-y-2">
          <p className="text-gray-300">Type: Change Threshold</p>
          <p className="text-gray-300">New Threshold: {newThreshold?.value}</p>
        </div>
      )
    }

    // // Handle send transactions
    // if (
    //   transaction.dataDecoded?.method === 'transfer' ||
    //   transaction.dataDecoded?.method === 'transferFrom'
    // ) {
    //   const [to, value] = transaction.dataDecoded.parameters || []
    //   return (
    //     <div className="space-y-2">
    //       <p className="text-gray-300">Type: Token Transfer</p>
    //       <p className="text-gray-300">To: {to?.value}</p>
    //       <p className="text-gray-300">
    //         Amount: {ethers.utils.formatUnits(value?.value || '0', 18)}
    //       </p>
    //     </div>
    //   )
    // }

    // For other transaction types, show the raw data
    return (
      <div className="space-y-2">
        <p className="text-gray-300">
          Method: {transaction.dataDecoded?.method || 'Unknown'}
        </p>
        {transaction.dataDecoded?.parameters && (
          <div className="mt-2">
            <p className="text-gray-300">Parameters:</p>
            <pre className="text-xs text-gray-300 whitespace-pre-wrap mt-1">
              {JSON.stringify(transaction.dataDecoded.parameters, null, 2)}
            </pre>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="text-sm text-gray-400 hover:text-gray-300 flex items-center gap-2"
        data-testid={`toggle-data-${transaction.safeTxHash}`}
      >
        {expanded ? '▼' : '▶'} Show Transaction Details
      </button>
      {expanded && (
        <div
          className="mt-2 p-3 bg-gray-800/50 rounded-lg overflow-x-auto"
          data-testid={`transaction-data-${transaction.safeTxHash}`}
        >
          {renderTransactionDetails()}
        </div>
      )}
    </div>
  )
}
