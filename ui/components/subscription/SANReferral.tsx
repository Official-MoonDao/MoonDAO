import { XMarkIcon, UserPlusIcon } from '@heroicons/react/24/outline'
import { getAccessToken } from '@privy-io/react-auth'
import { utils as ethersUtils } from 'ethers'
import { useState } from 'react'
import toast from 'react-hot-toast'
import FormInput from '../forms/FormInput'
import Modal from '../layout/Modal'
import StandardButton from '../layout/StandardButton'

type SANReferralProps = {
  className?: string
  label?: string
  onSuccess?: () => void
  onError?: () => void
}

export default function SANReferral({
  className = '',
  label = 'Record SAN Referral',
  onSuccess,
  onError,
}: SANReferralProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [referrerAddress, setReferrerAddress] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmitReferral = async () => {
    if (!referrerAddress.trim()) {
      toast.error('Please enter a referrer address')
      return
    }

    // Validate address format
    if (!ethersUtils.isAddress(referrerAddress)) {
      toast.error('Please enter a valid Ethereum address')
      return
    }

    setIsSubmitting(true)

    try {
      const accessToken = await getAccessToken()

      const response = await fetch('/api/xp/san-referred', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          referrerAddress: referrerAddress.trim(),
          accessToken: accessToken,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to record referral')
      }

      toast.success('SAN referral recorded successfully!')
      setIsModalOpen(false)
      setReferrerAddress('')
      onSuccess?.()
    } catch (error: any) {
      console.error('Error recording SAN referral:', error)
      toast.error(error.message || 'Failed to record referral')
      onError?.()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <StandardButton
        className={`bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white py-3 rounded-xl font-medium transition-all duration-200 w-full h-12 flex items-center justify-center text-sm gap-1 whitespace-nowrap ${className}`}
        onClick={() => setIsModalOpen(true)}
      >
        <UserPlusIcon className="w-4 h-4" />
        Referral
      </StandardButton>

      {isModalOpen && (
        <Modal id="san-referral-modal-backdrop" setEnabled={setIsModalOpen}>
          <div className="flex flex-col gap-6 items-start justify-start w-[100vw] md:w-[500px] p-6 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl h-screen md:h-auto md:max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                  <UserPlusIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    Record SAN Referral
                  </h1>
                  <p className="text-gray-300 text-sm">
                    Assign a referrer to your citizen NFT
                  </p>
                </div>
              </div>
              <button
                id="close-modal"
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => setIsModalOpen(false)}
              >
                <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
              </button>
            </div>

            {/* Content */}
            <div className="w-full space-y-6">
              {/* Info Section */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-white mb-2">
                  How it works
                </h3>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• Enter the address of the person who referred you</li>
                  <li>• They must own a valid citizen NFT</li>
                  <li>• This action cannot be undone</li>
                </ul>
              </div>

              {/* Referrer Address Input */}
              <div className="w-full">
                <FormInput
                  id="referrer-address-input"
                  label="Referrer Address *"
                  value={referrerAddress}
                  onChange={({ target }: any) =>
                    setReferrerAddress(target.value)
                  }
                  placeholder="0x..."
                  mode="modern"
                  maxLength={42}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 w-full">
                <button
                  className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all duration-200 flex-1 border border-white/20"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium transition-all duration-200 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleSubmitReferral}
                  disabled={isSubmitting || !referrerAddress.trim()}
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Recording...</span>
                    </div>
                  ) : (
                    'Record Referral'
                  )}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
