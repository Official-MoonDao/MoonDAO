import { XMarkIcon } from '@heroicons/react/20/solid'
import { ethers } from 'ethers'
import { useState } from 'react'
import toast from 'react-hot-toast'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import useSafe from '@/lib/safe/useSafe'
import { useENS } from '@/lib/utils/hooks/useENS'
import Modal from '../layout/Modal'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

interface SafeModalProps {
  safeAddress: string
  isEnabled: boolean
  setEnabled: (enabled: boolean) => void
}

function SafeOwner({ owner }: { owner: string }) {
  const { data: ens } = useENS(owner)
  return (
    <span className="text-gray-300">
      {ens ? ens.name : `${owner.slice(0, 6)}...${owner.slice(-4)}`}
    </span>
  )
}

export default function SafeModal({
  safeAddress,
  isEnabled,
  setEnabled,
}: SafeModalProps) {
  const [newSignerAddress, setNewSignerAddress] = useState('')
  const [newThreshold, setNewThreshold] = useState<number>(0)
  const [isAddingSigner, setIsAddingSigner] = useState(false)
  const [isChangingThreshold, setIsChangingThreshold] = useState(false)

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
  } = useSafe(safeAddress)

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
      toast.success('Signer added successfully', { style: toastStyle })
      setNewSignerAddress('')
    } catch (error) {
      console.error('Error adding signer:', error)
      toast.error('Failed to add signer', { style: toastStyle })
    } finally {
      setIsAddingSigner(false)
    }
  }

  const handleRemoveSigner = async (signerAddress: string) => {
    try {
      await removeSigner(signerAddress)
      toast.success('Signer removed successfully', { style: toastStyle })
    } catch (error) {
      console.error('Error removing signer:', error)
      toast.error('Failed to remove signer', { style: toastStyle })
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
      toast.success('Threshold updated successfully', { style: toastStyle })
      setNewThreshold(0)
    } catch (error) {
      console.error('Error changing threshold:', error)
      toast.error('Failed to update threshold', { style: toastStyle })
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

  return (
    <Modal id="safe-modal" setEnabled={setEnabled}>
      <div className="bg-dark-cool rounded-[2vmax] p-8 max-w-2xl w-full relative">
        <button
          onClick={() => setEnabled(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>

        <h2 className="text-2xl font-GoodTimes mb-6">Safe Management</h2>

        {/* Current Safe Info */}
        <div className="mb-8">
          <h3 className="text-xl font-GoodTimes mb-4">Safe Information</h3>
          <p className="text-gray-400 mb-2">Address: {safeAddress}</p>
          <p className="text-gray-400 mb-2">Current Threshold: {threshold}</p>
        </div>

        {/* Signers Management */}
        <div className="mb-8">
          <h3 className="text-xl font-GoodTimes mb-4">Signers</h3>
          <div className="space-y-4">
            {owners.map((owner) => (
              <div
                key={owner}
                className="flex items-center justify-between bg-darkest-cool p-4 rounded-lg"
              >
                <SafeOwner owner={owner} />
                <button
                  onClick={() => handleRemoveSigner(owner)}
                  className="text-red-500 hover:text-red-400"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-4">
            <input
              type="text"
              value={newSignerAddress}
              onChange={(e) => setNewSignerAddress(e.target.value)}
              placeholder="New signer address"
              className="flex-1 bg-darkest-cool text-white px-4 py-2 rounded-lg"
            />
            <PrivyWeb3Button
              label="Add Signer"
              action={handleAddSigner}
              isDisabled={!validateAddress(newSignerAddress) || isAddingSigner}
            />
          </div>
        </div>

        {/* Threshold Management */}
        <div className="mb-8">
          <h3 className="text-xl font-GoodTimes mb-4">Threshold</h3>
          <div className="flex gap-4">
            <input
              type="number"
              value={newThreshold || ''}
              onChange={(e) => setNewThreshold(Number(e.target.value))}
              min={1}
              max={owners.length}
              placeholder="New threshold"
              className="flex-1 bg-darkest-cool text-white px-4 py-2 rounded-lg"
            />
            <PrivyWeb3Button
              label="Update Threshold"
              action={handleChangeThreshold}
              isDisabled={!newThreshold || isChangingThreshold}
            />
          </div>
        </div>

        {/* Pending Transactions */}
        <div>
          <h3 className="text-xl font-GoodTimes mb-4">Pending Transactions</h3>

          {/* Transactions to Sign */}
          {transactionsToSign.length > 0 && (
            <div className="mb-6">
              <h4 className="text-lg font-GoodTimes mb-2">
                Need Your Signature
              </h4>
              <div className="space-y-4">
                {transactionsToSign.map((tx) => (
                  <div
                    key={tx.safeTxHash}
                    className="bg-darkest-cool p-4 rounded-lg"
                  >
                    <p className="text-gray-300 mb-2">To: {tx.to}</p>
                    <p className="text-gray-300 mb-2">
                      Value: {ethers.utils.formatEther(tx.value)} ETH
                    </p>
                    <PrivyWeb3Button
                      label="Sign Transaction"
                      action={() => handleSignTransaction(tx.safeTxHash)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transactions to Execute */}
          {transactionsToExecute.length > 0 && (
            <div>
              <h4 className="text-lg font-GoodTimes mb-2">Ready to Execute</h4>
              <div className="space-y-4">
                {transactionsToExecute.map((tx) => (
                  <div
                    key={tx.safeTxHash}
                    className="bg-[#2A2A2A] p-4 rounded-lg"
                  >
                    <p className="text-gray-300 mb-2">To: {tx.to}</p>
                    <p className="text-gray-300 mb-2">
                      Value: {ethers.utils.formatEther(tx.value)} ETH
                    </p>
                    <PrivyWeb3Button
                      label="Execute Transaction"
                      action={() => handleExecuteTransaction(tx.safeTxHash)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {transactionsToSign.length === 0 &&
            transactionsToExecute.length === 0 && (
              <p className="text-gray-400">No pending transactions</p>
            )}
        </div>
      </div>
    </Modal>
  )
}
