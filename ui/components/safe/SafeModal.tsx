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

        {isNetworkMismatch ? (
          <SafeNetworkMismatch />
        ) : (
          <div>
            {/* Current Safe Info */}
            <div data-testid="safe-info" className="mb-8">
              <p data-testid="safe-address" className="text-gray-400 mb-2">
                {'Address: '}
                <Link
                  className="hover:underline"
                  href={`https://app.safe.global/home?safe=${
                    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'arb1' : 'sep'
                  }:${safeAddress}`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {safeAddress.slice(0, 6)}...{safeAddress.slice(-4)}
                </Link>
              </p>
            </div>

            {/* Signers Management */}
            <div data-testid="signers-section" className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <h3
                  data-testid="signers-title"
                  className="text-xl font-GoodTimes"
                >
                  Signers
                </h3>
                <Tooltip text="The signers are the addresses that are allowed to sign or execute transactions.">
                  ?
                </Tooltip>
              </div>
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
                  value={newSignerAddressOrENS}
                  onChange={(e) => setNewSignerAddressOrENS(e.target.value)}
                  placeholder="New signer address or ENS"
                  className="flex-1 bg-darkest-cool text-white px-4 py-2 rounded-lg"
                />
                <PrivyWeb3Button
                  dataTestId="add-signer-button"
                  className="rounded-full"
                  label="Add Signer"
                  action={handleAddSigner}
                  isDisabled={
                    !validateAddress(newSignerAddress) || isAddingSigner
                  }
                />
              </div>
            </div>

            {/* Threshold Management */}
            <div data-testid="threshold-section" className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <h3
                  data-testid="threshold-title"
                  className="text-xl font-GoodTimes"
                >
                  Threshold
                </h3>
                <Tooltip text="The threshold is the number of signers it will take in order to be able to execute a transaction.">
                  ?
                </Tooltip>
              </div>
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
                    disabled={owners.length < 2 || isChangingThreshold}
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
          </div>
        )}
      </div>
    </Modal>
  )
}
