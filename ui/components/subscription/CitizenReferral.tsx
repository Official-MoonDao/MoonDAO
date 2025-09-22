import {
  XMarkIcon,
  UserPlusIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { getAccessToken } from '@privy-io/react-auth'
import { utils as ethersUtils } from 'ethers'
import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import FormInput from '../forms/FormInput'
import Modal from '../layout/Modal'
import StandardButton from '../layout/StandardButton'

type Citizen = {
  id: string
  name: string
  owner: string
  displayName: string
}

type CitizenReferralProps = {
  className?: string
  label?: string
  onSuccess?: () => void
  onError?: () => void
}

export default function CitizenReferral({
  className = '',
  label = 'Record Citizen Referral',
  onSuccess,
  onError,
}: CitizenReferralProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [referrerAddress, setReferrerAddress] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Citizen[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedCitizen, setSelectedCitizen] = useState<Citizen | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Search for citizens
  const searchCitizens = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    // For numeric queries (token IDs), allow single digits
    // For text queries (names), require at least 2 characters
    const isNumeric = /^\d+$/.test(query.trim())
    if (!isNumeric && query.length < 2) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(
        `/api/citizens/search?q=${encodeURIComponent(query)}`
      )
      const data = await response.json()

      if (response.ok) {
        setSearchResults(data.citizens || [])
        setShowDropdown(true)
      } else {
        console.error('Search error:', data.message)
        setSearchResults([])
        setShowDropdown(false)
      }
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
      setShowDropdown(false)
    } finally {
      setIsSearching(false)
    }
  }

  // Handle search input changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setSelectedCitizen(null)
    setReferrerAddress('')

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Set new timeout for search
    searchTimeoutRef.current = setTimeout(() => {
      searchCitizens(value)
    }, 300)
  }

  // Handle citizen selection
  const handleCitizenSelect = (citizen: Citizen) => {
    setSelectedCitizen(citizen)
    setReferrerAddress(citizen.owner)
    setSearchQuery(citizen.displayName)
    setShowDropdown(false)
  }

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  const handleSubmitReferral = async () => {
    if (!referrerAddress.trim()) {
      toast.error('Please select a referrer from the search results')
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

      const response = await fetch('/api/xp/citizen-referred', {
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
      setSearchQuery('')
      setSelectedCitizen(null)
      setSearchResults([])
      setShowDropdown(false)
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
        className={`'px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 flex items-center justify-center gap-1' ${className}`}
        onClick={() => setIsModalOpen(true)}
      >
        <UserPlusIcon className="w-4 h-4" />
        Record Referral
      </StandardButton>

      {isModalOpen && (
        <Modal id="san-referral-modal-backdrop" setEnabled={setIsModalOpen}>
          <div className="flex flex-col gap-6 items-start justify-start w-[100vw] md:w-[500px] p-6 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl h-screen md:h-auto md:min-h-[600px] md:max-h-[95vh] overflow-y-auto">
            {/* Header */}
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                  <UserPlusIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    Record Citizen Referral
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
            <div className="w-full space-y-6 pb-4">
              {/* Info Section */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-white mb-2">
                  How it works
                </h3>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>
                    • Search for the person who referred you by name or token ID
                  </li>
                  <li>• They must own a valid citizen NFT</li>
                  <li>• This action cannot be undone</li>
                </ul>
              </div>

              {/* Citizen Search Input */}
              <div className="w-full relative" ref={dropdownRef}>
                <label className="block text-sm font-medium text-white mb-2">
                  Search for Referrer *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Search by name or token ID..."
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {isSearching && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>

                {/* Search Results Dropdown */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-white/20 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((citizen) => (
                      <button
                        key={citizen.id}
                        onClick={() => handleCitizenSelect(citizen)}
                        className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors border-b border-white/10 last:border-b-0"
                      >
                        <div className="text-white font-medium">
                          {citizen.displayName}
                        </div>
                        <div className="text-gray-400 text-sm truncate">
                          {citizen.owner}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* No Results */}
                {showDropdown &&
                  searchResults.length === 0 &&
                  searchQuery.trim().length > 0 &&
                  (searchQuery.length >= 2 ||
                    /^\d+$/.test(searchQuery.trim())) &&
                  !isSearching && (
                    <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-white/20 rounded-xl shadow-lg p-4">
                      <div className="text-gray-400 text-center">
                        No citizens found
                      </div>
                    </div>
                  )}
              </div>

              {/* Selected Citizen Display */}
              {selectedCitizen && (
                <div className="w-full bg-white/5 border border-white/20 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">
                        {selectedCitizen.displayName}
                      </div>
                      <div className="text-gray-400 text-sm">
                        {selectedCitizen.owner}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedCitizen(null)
                        setReferrerAddress('')
                        setSearchQuery('')
                      }}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}

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
                  disabled={isSubmitting || !selectedCitizen}
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
