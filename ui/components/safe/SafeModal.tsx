import { XMarkIcon } from '@heroicons/react/20/solid'
import { ethers } from 'ethers'
import Link from 'next/link'
import { useState } from 'react'
import toast from 'react-hot-toast'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { SafeData } from '@/lib/safe/useSafe'
import useNetworkMismatch from '@/lib/thirdweb/hooks/useNetworkMismatch'
import { useENS } from '@/lib/utils/hooks/useENS'
import Modal from '../layout/Modal'
import Tooltip from '../layout/Tooltip'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import SafeNetworkMismatch from './SafeNetworkMismatch'

type SafeModalProps = {
  safeData: SafeData
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
  const [newSignerAddressOrENS, setNewSignerAddressOrENS] = useState('')
  const [newThreshold, setNewThreshold] = useState<number>(safeData.threshold)
  const [isAddingSigner, setIsAddingSigner] = useState(false)
  const [isChangingThreshold, setIsChangingThreshold] = useState(false)
  const isNetworkMismatch = useNetworkMismatch()

  const ens = useENS(newSignerAddressOrENS)
  const newSignerAddress = ens?.data?.address || newSignerAddressOrENS

  const {
    owners,
    addSigner,
    removeSigner,
    changeThreshold,
    fetchPendingTransactions,
  } = safeData

  const validateAddress = (address: string) => {
    return ethers.utils.isAddress(address)
  }

  const handleAddSigner = async () => {
    if (!validateAddress(newSignerAddress)) {
      toast.error('Invalid address.', { style: toastStyle })
      return
    }

    if (owners.includes(newSignerAddress)) {
      toast.error('Signer already exists.', { style: toastStyle })
      return
    }

    try {
      setIsAddingSigner(true)
      await addSigner(newSignerAddress)
      setNewSignerAddressOrENS('')
      setEnabled(false)
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
      setEnabled(false)
    } catch (error) {
      console.error('Error removing signer:', error)
    }
  }

  const handleChangeThreshold = async () => {
    if (newThreshold < 1 || newThreshold > owners.length) {
      toast.error('Invalid threshold value.', { style: toastStyle })
      return
    }

    try {
      setIsChangingThreshold(true)
      await changeThreshold(newThreshold)
      setNewThreshold(0)
      setEnabled(false)
    } catch (error) {
      console.error('Error changing threshold:', error)
    } finally {
      setIsChangingThreshold(false)
    }
  }

  return (
    <Modal id="safe-modal" setEnabled={setEnabled}>
      <div className="w-screen md:w-[550px] mx-auto bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white">
        {/* Header */}
        <div
          data-testid="safe-modal-header"
          className="flex items-center justify-between p-6 border-b border-white/10"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <div>
              <h2
                data-testid="safe-modal-title"
                className="text-xl font-semibold text-white"
              >
                Safe Settings
              </h2>
              <p className="text-gray-300 text-sm">
                Manage signers and threshold
              </p>
            </div>
          </div>
          <button
            data-testid="safe-modal-close"
            id="close-modal"
            type="button"
            className="p-2 hover:bg-white/10 rounded-full transition-colors duration-200"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-5 w-5 text-gray-300 hover:text-white" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {isNetworkMismatch ? (
            <SafeNetworkMismatch />
          ) : (
            <>
              {/* Current Safe Info */}
              <div
                data-testid="safe-info"
                className="bg-black/20 border border-white/10 rounded-lg p-4"
              >
                <p className="text-gray-300 text-sm mb-2">Safe Address</p>
                <p
                  data-testid="safe-address"
                  className="text-white font-mono text-sm"
                >
                  <Link
                    className="hover:text-blue-400 transition-colors"
                    href={`https://app.safe.global/home?safe=${
                      process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
                        ? 'arb1'
                        : 'sep'
                    }:${safeAddress}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {safeAddress.slice(0, 6)}...{safeAddress.slice(-4)}
                  </Link>
                </p>
              </div>

              {/* Signers Management */}
              <div data-testid="signers-section" className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3
                    data-testid="signers-title"
                    className="text-lg font-semibold text-white"
                  >
                    Signers
                  </h3>
                  <Tooltip text="The signers are the addresses that are allowed to sign or execute transactions.">
                    ?
                  </Tooltip>
                </div>
                <div data-testid="signers-list" className="space-y-2">
                  {owners.map((owner: string) => (
                    <div
                      key={owner}
                      data-testid={`signer-${owner}`}
                      className="flex items-center justify-between bg-black/20 border border-white/10 rounded-lg p-4 hover:bg-black/30 transition-colors"
                    >
                      <SafeOwner owner={owner} />
                      {owners.length > 1 && (
                        <button
                          data-testid={`remove-signer-${owner}`}
                          onClick={() => handleRemoveSigner(owner)}
                          className="text-red-400 hover:text-red-300 transition-colors text-sm font-medium"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div
                  data-testid="add-signer-section"
                  className="flex gap-3 flex-col md:flex-row"
                >
                  <input
                    data-testid="new-signer-input"
                    type="text"
                    value={newSignerAddressOrENS}
                    onChange={(e) => setNewSignerAddressOrENS(e.target.value)}
                    placeholder="New signer address or ENS"
                    className="flex-1 bg-black/20 border border-white/10 rounded-lg p-3 text-white placeholder-gray-400 hover:bg-black/30 hover:border-white/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  />
                  <PrivyWeb3Button
                    dataTestId="add-signer-button"
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white py-3 px-6 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    label="Add Signer"
                    action={handleAddSigner}
                    isDisabled={
                      !validateAddress(newSignerAddress) || isAddingSigner
                    }
                  />
                </div>
              </div>

              {/* Threshold Management */}
              <div data-testid="threshold-section" className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3
                    data-testid="threshold-title"
                    className="text-lg font-semibold text-white"
                  >
                    Threshold
                  </h3>
                  <Tooltip text="The threshold is the number of signers it will take in order to be able to execute a transaction.">
                    ?
                  </Tooltip>
                </div>
                <div
                  data-testid="threshold-controls"
                  className="flex flex-col md:flex-row gap-4 items-center"
                >
                  <div
                    data-testid="threshold-input-group"
                    className="flex items-center gap-3"
                  >
                    <input
                      data-testid="threshold-input"
                      type="number"
                      value={newThreshold || ''}
                      onChange={(e) => setNewThreshold(Number(e.target.value))}
                      min={1}
                      max={owners.length}
                      placeholder="New threshold"
                      className="w-24 bg-black/20 border border-white/10 rounded-lg p-3 text-white placeholder-gray-400 hover:bg-black/30 hover:border-white/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 disabled:opacity-50"
                      disabled={owners.length < 2 || isChangingThreshold}
                    />
                    <span
                      data-testid="threshold-max"
                      className="text-gray-300 text-sm"
                    >
                      / {owners.length}
                    </span>
                  </div>
                  <PrivyWeb3Button
                    dataTestId="update-threshold-button"
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white py-3 px-6 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    label="Update Threshold"
                    action={handleChangeThreshold}
                    isDisabled={
                      isChangingThreshold ||
                      owners.length < 2 ||
                      !newThreshold ||
                      newThreshold === 0 ||
                      newThreshold > owners.length ||
                      newThreshold === safeData.threshold
                    }
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
