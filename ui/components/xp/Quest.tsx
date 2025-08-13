import { CheckBadgeIcon } from '@heroicons/react/24/outline'
import { getAccessToken } from '@privy-io/react-auth'
import XPVerifierABI from 'const/abis/XPVerifier.json'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import { ComponentType, useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Chain, readContract } from 'thirdweb'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import useContract from '@/lib/thirdweb/hooks/useContract'
import StandardButton from '@/components/layout/StandardButton'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

export type QuestIcon = ComponentType<{ className?: string }>

export type QuestItem = {
  verifier: any
  title: string
  description: string
  icon: QuestIcon
  type: 'on-chain' | 'off-chain'
  link?: string
  linkText?: string
}

type QuestProps = {
  selectedChain: Chain
  quest: QuestItem
  xpManagerContract: any
  variant?: 'onboarding' | 'weekly'
  userAddress?: `0x${string}`
  onClaimConfirmed?: () => void
}

export default function Quest({
  selectedChain,
  quest,
  variant = 'onboarding',
  userAddress,
  xpManagerContract,
  onClaimConfirmed,
}: QuestProps) {
  const verifierContract = useContract({
    address: quest.verifier.verifierAddress,
    abi: XPVerifierABI,
    chain: selectedChain,
  })

  const [xpAmount, setXpAmount] = useState(0)
  const [isLoadingXpAmount, setIsLoadingXpAmount] = useState(false)

  const [hasClaimed, setHasClaimed] = useState(false)
  const [isLoadingClaim, setIsLoadingClaim] = useState(false)
  const [isCheckingClaimed, setIsCheckingClaimed] = useState(true)
  const [isPollingClaim, setIsPollingClaim] = useState(false)
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const fetchHasClaimed = useCallback(
    async (polling = false) => {
      if (xpManagerContract && userAddress) {
        // Only show "Checking status..." if we're not already polling for confirmation
        if (!polling) {
          setIsCheckingClaimed(true)
        }
        const claimed = await readContract({
          contract: xpManagerContract,
          method: 'hasClaimedFromVerifier' as string,
          params: [userAddress, quest.verifier.verifierId],
        })
        setHasClaimed(Boolean(claimed))
        // Always clear checking status when not polling, regardless of result
        if (!polling) {
          setIsCheckingClaimed(false)
        }
        return Boolean(claimed)
      } else {
        // Always clear checking status when not polling
        if (!polling) {
          setIsCheckingClaimed(false)
        }
        return false
      }
    },
    [xpManagerContract, userAddress, quest.verifier.verifierId, isPollingClaim]
  )

  const pollForClaimConfirmation = useCallback(async () => {
    if (isPollingClaim) return // Prevent multiple polling instances

    // Clear any existing timeout
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current)
    }

    // Clear checking status before starting polling
    setIsCheckingClaimed(false)
    setIsPollingClaim(true)
    const maxAttempts = 30 // Poll for up to 30 attempts (30 seconds with 1s intervals)
    let attempts = 0

    const poll = async () => {
      try {
        const claimed = await fetchHasClaimed(true)
        if (claimed) {
          setIsPollingClaim(false)
          pollingTimeoutRef.current = null
          toast.success('Quest claim confirmed on blockchain!', {
            duration: 3000,
            style: toastStyle,
          })
          // Notify parent component to refresh user data
          if (onClaimConfirmed) {
            onClaimConfirmed()
          }
          return
        }

        attempts++
        if (attempts < maxAttempts) {
          pollingTimeoutRef.current = setTimeout(poll, 1000) // Check again in 1 second
        } else {
          setIsPollingClaim(false)
          pollingTimeoutRef.current = null
          toast.error(
            'Claim confirmation timed out. Please refresh to check status.',
            {
              duration: 5000,
              style: toastStyle,
            }
          )
        }
      } catch (error) {
        console.error('Error polling for claim confirmation:', error)
        setIsPollingClaim(false)
        pollingTimeoutRef.current = null
      }
    }

    // Start polling after initial delay
    pollingTimeoutRef.current = setTimeout(poll, 2000) // Start checking after 2 seconds
  }, [fetchHasClaimed, isPollingClaim, onClaimConfirmed])

  const claimQuest = useCallback(async () => {
    if (!quest.verifier.route || !userAddress) return
    setIsLoadingClaim(true)
    try {
      const accessToken = await getAccessToken()
      const response = await fetch(quest.verifier.route, {
        method: 'POST',
        body: JSON.stringify({ user: userAddress, accessToken }),
      })
      const { eligible, error } = await response.json()

      if (eligible) {
        toast.success(
          'Quest claimed successfully! Waiting for blockchain confirmation...',
          {
            duration: 3000,
            style: toastStyle,
          }
        )
        pollForClaimConfirmation()
      } else {
        if (error) {
          toast.error(error, {
            duration: 3000,
            style: toastStyle,
          })
        } else {
          toast.error(
            'You are not eligible for this quest, please meet the requirements and try again.',
            {
              duration: 3000,
              style: toastStyle,
            }
          )
        }
      }
    } catch (error) {
      console.error(error)
      toast.error('Something went wrong, please contact support.')
    } finally {
      setIsLoadingClaim(false)
    }
  }, [quest.verifier, userAddress, pollForClaimConfirmation])

  useEffect(() => {
    async function fetchXpAmount() {
      setIsLoadingXpAmount(true)
      if (quest.verifier.xpPerClaim) {
        setXpAmount(quest.verifier.xpPerClaim)
        setIsLoadingXpAmount(false)
        return
      }
      if (verifierContract && userAddress) {
        const xpAmount = await readContract({
          contract: verifierContract,
          method: 'xpPerClaim' as string,
          params: [],
        })
        console.log('xpAmount', xpAmount)
        setXpAmount(Number(xpAmount))
      }
      setIsLoadingXpAmount(false)
    }

    fetchXpAmount()
  }, [verifierContract, userAddress, quest.verifier.xpPerClaim])

  useEffect(() => {
    fetchHasClaimed()
  }, [fetchHasClaimed])

  // Cleanup polling timeout on unmount
  useEffect(() => {
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current)
        pollingTimeoutRef.current = null
      }
    }
  }, [])

  const isCompleted = Boolean(hasClaimed)

  const baseContainerClasses =
    isCheckingClaimed || isPollingClaim
      ? 'bg-white/5 border-white/10 animate-pulse'
      : isCompleted
      ? 'bg-green-500/10 border-green-500/30'
      : 'bg-white/5 border-white/10 hover:border-white/20'

  const variantColor = variant === 'weekly' ? 'purple' : 'blue'

  const iconWrapperClasses =
    isCheckingClaimed || isPollingClaim
      ? variantColor === 'purple'
        ? 'bg-purple-500/20'
        : 'bg-blue-500/20'
      : isCompleted
      ? 'bg-green-500/20'
      : variantColor === 'purple'
      ? 'bg-purple-500/20'
      : 'bg-blue-500/20'

  const iconColorClasses =
    isCheckingClaimed || isPollingClaim
      ? variantColor === 'purple'
        ? 'text-purple-400'
        : 'text-blue-400'
      : isCompleted
      ? 'text-green-400'
      : variantColor === 'purple'
      ? 'text-purple-400'
      : 'text-blue-400'

  const ctaButtonClasses =
    variantColor === 'purple'
      ? 'bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1 rounded-lg transition-all'
      : 'bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded-lg transition-all'

  return (
    <div
      className={`p-3 rounded-lg border transition-all h-24 flex items-center ${baseContainerClasses}`}
    >
      <div className="flex items-center gap-3 w-full">
        <div className={`p-2 rounded-lg flex-shrink-0 ${iconWrapperClasses}`}>
          <quest.icon className={`w-4 h-4 ${iconColorClasses}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h5
              className={`font-medium text-sm ${
                isCheckingClaimed || isPollingClaim
                  ? 'text-white'
                  : isCompleted
                  ? 'text-green-300'
                  : 'text-white'
              }`}
            >
              {quest.title}
            </h5>
            {isCompleted && (
              <CheckBadgeIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
            )}
          </div>
          <p className="text-gray-400 text-xs mb-2 line-clamp-1">
            {quest.description}
          </p>

          <div className="flex items-center gap-3">
            <span className="text-yellow-400 text-xs font-medium flex items-center gap-2">
              +
              {isLoadingXpAmount ? (
                <div className="flex items-center gap-1">
                  <LoadingSpinner height="h-4" width="w-4" />
                  <span className="text-gray-400">...</span>
                </div>
              ) : (
                xpAmount
              )}{' '}
              XP
            </span>

            {isCheckingClaimed ? (
              <div className="flex items-center gap-2 text-gray-400 text-xs">
                <LoadingSpinner height="h-4" width="w-4" />
                Checking status...
              </div>
            ) : isPollingClaim ? (
              <div className="flex items-center gap-2 text-yellow-400 text-xs">
                <LoadingSpinner height="h-4" width="w-4" />
                Waiting for blockchain confirmation...
              </div>
            ) : (
              <>
                {!hasClaimed && quest.link && quest.linkText && (
                  <StandardButton
                    className={ctaButtonClasses}
                    link={quest.link}
                  >
                    {quest.linkText}
                  </StandardButton>
                )}

                {!hasClaimed && (
                  <PrivyWeb3Button
                    label="Claim"
                    action={async () => {
                      await claimQuest()
                    }}
                    isDisabled={isLoadingClaim}
                    requiredChain={DEFAULT_CHAIN_V5}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-3 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg text-xs"
                    noPadding
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
