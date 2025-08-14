import { CheckBadgeIcon, StarIcon } from '@heroicons/react/24/outline'
import { getAccessToken } from '@privy-io/react-auth'
import StagedXPVerifierABI from 'const/abis/StagedXPVerifier.json'
import XPVerifierABI from 'const/abis/XPVerifier.json'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import { ComponentType, useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Chain, readContract } from 'thirdweb'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import useContract from '@/lib/thirdweb/hooks/useContract'
import {
  getStagedQuestProgress,
  formatStageDisplay,
  getCurrentLevel,
  getProgressSummary,
  getHighestQualifyingStage,
  getNextUnclamedThreshold,
  type StagedQuestProgress,
} from '@/lib/xp/staged-quest-info'
import StandardButton from '@/components/layout/StandardButton'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

export type QuestIcon = ComponentType<{ className?: string }>

export type QuestItem = {
  verifier: any
  title: string
  description: string
  icon: QuestIcon
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
    abi: quest.verifier.type === 'staged' ? StagedXPVerifierABI : XPVerifierABI,
    chain: selectedChain,
  })

  const [xpAmount, setXpAmount] = useState(0)
  const [isLoadingXpAmount, setIsLoadingXpAmount] = useState(false)

  // Staged quest state
  const [stagedProgress, setStagedProgress] =
    useState<StagedQuestProgress | null>(null)
  const [isLoadingStagedProgress, setIsLoadingStagedProgress] = useState(false)
  const [userMetric, setUserMetric] = useState(0)

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

        console.log(
          `Checking hasClaimedFromVerifier for user: ${userAddress}, verifierId: ${quest.verifier.verifierId}`
        )

        const claimed = await readContract({
          contract: xpManagerContract,
          method: 'hasClaimedFromVerifier' as string,
          params: [userAddress, quest.verifier.verifierId],
        })

        console.log(`hasClaimedFromVerifier result: ${claimed}`)

        setHasClaimed(Boolean(claimed))
        // Always clear checking status when not polling, regardless of result
        if (!polling) {
          setIsCheckingClaimed(false)
        }
        return Boolean(claimed)
      } else {
        console.log('Missing xpManagerContract or userAddress')
        // Always clear checking status when not polling
        if (!polling) {
          setIsCheckingClaimed(false)
        }
        return false
      }
    },
    [xpManagerContract, userAddress, quest.verifier.verifierId]
  )

  // claimQuest will be defined after pollForClaimConfirmation

  // Function to fetch user metric from the quest's API endpoint
  const fetchUserMetric = useCallback(async (): Promise<number> => {
    if (!quest.verifier.route || !userAddress || !quest.verifier.metricKey) {
      return 0
    }

    try {
      const accessToken = await getAccessToken()
      if (!accessToken) {
        throw new Error('No access token available')
      }

      const response = await fetch(
        `${quest.verifier.route}?user=${userAddress}&accessToken=${accessToken}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch user metric: ${response.statusText}`)
      }

      const data = await response.json()

      // Extract the metric using the configured metricKey
      const metricValue = data[quest.verifier.metricKey]

      // Handle different data types
      if (typeof metricValue === 'string') {
        return parseInt(metricValue) || 0
      } else if (typeof metricValue === 'number') {
        return metricValue
      } else if (typeof metricValue === 'boolean') {
        return metricValue ? 1 : 0
      }

      return 0
    } catch (error) {
      console.error('Error fetching user metric:', error)
      return 0
    }
  }, [quest.verifier.route, quest.verifier.metricKey, userAddress])

  // Simplified staged progress fetching - just get stages and user's highest claimed stage
  const fetchStagedProgress = useCallback(async () => {
    if (quest.verifier.type !== 'staged' || !verifierContract || !userAddress)
      return

    setIsLoadingStagedProgress(true)
    try {
      // Get user metric from quest's backend/oracle
      const metric = await fetchUserMetric()
      setUserMetric(metric)

      // Get progress with real user metric
      const progress = await getStagedQuestProgress(
        verifierContract,
        userAddress,
        metric
      )

      console.log('PROGRESS', progress)

      setStagedProgress(progress)
    } catch (error) {
      console.error('Error fetching staged progress:', error)
    } finally {
      setIsLoadingStagedProgress(false)
    }
  }, [verifierContract, userAddress, quest.verifier.type, fetchUserMetric])

  // Define pollForClaimConfirmation after fetchStagedProgress
  const pollForClaimConfirmation = useCallback(async () => {
    if (isPollingClaim) return // Prevent multiple polling instances

    // Clear any existing timeout
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current)
    }

    // Clear checking status before starting polling
    setIsCheckingClaimed(false)
    setIsPollingClaim(true)
    const maxAttempts = 60 // Poll for up to 60 attempts (increased for blockchain delays)
    let attempts = 0

    const poll = async () => {
      try {
        console.log(
          `Polling attempt ${
            attempts + 1
          }/${maxAttempts} for quest claim confirmation...`
        )
        const claimed = await fetchHasClaimed(true)
        console.log(`Poll result: claimed = ${claimed}`)

        if (claimed) {
          setIsPollingClaim(false)
          pollingTimeoutRef.current = null
          console.log('Quest claim confirmed on blockchain!')
          toast.success('Quest claim confirmed on blockchain!', {
            duration: 3000,
            style: toastStyle,
          })

          // Refresh staged quest data for staged quests
          if (quest.verifier.type === 'staged') {
            await fetchStagedProgress()
          }

          // Notify parent component to refresh user data
          if (onClaimConfirmed) {
            onClaimConfirmed()
          }
          return
        }

        attempts++
        if (attempts < maxAttempts) {
          // Use longer intervals for better blockchain state consistency
          const delay = attempts < 5 ? 2000 + attempts * 1000 : 2000
          pollingTimeoutRef.current = setTimeout(poll, delay)
        } else {
          setIsPollingClaim(false)
          pollingTimeoutRef.current = null
          console.error(`Polling timed out after ${maxAttempts} attempts`)

          // Final check with a fresh contract read to be sure
          try {
            console.log('Performing final hasClaimedFromVerifier check...')
            const finalCheck = await fetchHasClaimed(true)
            if (finalCheck) {
              console.log('Final check confirmed claim!')
              toast.success('Quest claim confirmed on blockchain!', {
                duration: 3000,
                style: toastStyle,
              })
              if (quest.verifier.type === 'staged') {
                await fetchStagedProgress()
              }
              if (onClaimConfirmed) {
                onClaimConfirmed()
              }
              return
            }
          } catch (finalError) {
            console.error('Final check failed:', finalError)
          }

          toast.error(
            'Claim confirmation timed out. The transaction may have succeeded - please refresh to check your XP.',
            {
              duration: 8000,
              style: toastStyle,
            }
          )
        }
      } catch (error) {
        console.error('Error polling for claim confirmation:', error)
        setIsPollingClaim(false)
        pollingTimeoutRef.current = null
        toast.error(
          'Error checking claim status. Please refresh and try again.',
          {
            duration: 5000,
            style: toastStyle,
          }
        )
      }
    }

    // Start polling after initial delay - give blockchain more time
    pollingTimeoutRef.current = setTimeout(poll, 3000) // Start checking after 3 seconds
  }, [
    fetchHasClaimed,
    isPollingClaim,
    onClaimConfirmed,
    quest.verifier.type,
    fetchStagedProgress,
  ])

  const claimQuest = useCallback(async () => {
    if (!quest.verifier.route || !userAddress) return
    setIsLoadingClaim(true)
    try {
      const accessToken = await getAccessToken()
      const response = await fetch(quest.verifier.route, {
        method: 'POST',
        body: JSON.stringify({ user: userAddress, accessToken }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      const { eligible, error, txHash } = data

      console.log('Quest claim response:', data)

      if (eligible) {
        if (txHash) {
          console.log(`Transaction hash: ${txHash}`)
          toast.success(
            'Quest claimed successfully! Waiting for blockchain confirmation...',
            {
              duration: 3000,
              style: toastStyle,
            }
          )
          pollForClaimConfirmation()
        } else {
          console.warn(
            'Quest claim was eligible but no transaction hash returned'
          )
          toast.error('Claim failed: No transaction hash returned')
        }
      } else {
        if (error) {
          console.error('Quest claim error:', error)
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
      console.error('Quest claim error:', error)
      toast.error(
        `Claim failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
    } finally {
      setIsLoadingClaim(false)
    }
  }, [quest.verifier, userAddress, pollForClaimConfirmation])

  useEffect(() => {
    async function fetchXpAmount() {
      setIsLoadingXpAmount(true)

      if (quest.verifier.type === 'staged') {
        // For staged quests, show total claimable XP instead of fixed amount
        await fetchStagedProgress()
        setIsLoadingXpAmount(false)
        return
      }

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
        setXpAmount(Number(xpAmount))
      }
      setIsLoadingXpAmount(false)
    }

    fetchXpAmount()
  }, [
    verifierContract,
    userAddress,
    quest.verifier.xpPerClaim,
    quest.verifier.type,
    fetchStagedProgress,
  ])

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
            {quest.verifier.type === 'staged' ? (
              // Staged quest progress display
              <div className="flex items-center gap-3 flex-1">
                {isLoadingStagedProgress ? (
                  <div className="flex items-center gap-2 text-gray-400 text-xs">
                    <LoadingSpinner height="h-4" width="w-4" />
                    Loading progress...
                  </div>
                ) : stagedProgress ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-yellow-400 text-xs font-medium bg-yellow-400/20 px-2 py-1 rounded-full">
                        Stage {getHighestQualifyingStage(stagedProgress)}
                      </div>
                    </div>

                    <div className="text-xs text-white">
                      {stagedProgress.currentUserMetric} /{' '}
                      {getNextUnclamedThreshold(stagedProgress)}
                    </div>

                    <div className="w-16">
                      <div className="w-full bg-gray-700 rounded-full h-1.5">
                        <div
                          className="bg-gradient-to-r from-yellow-400 to-orange-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${stagedProgress.progressToNext}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="text-yellow-400 text-xs font-medium">
                      {stagedProgress.totalClaimableXP > 0
                        ? `+${stagedProgress.totalClaimableXP} XP`
                        : stagedProgress.isMaxStageReached
                        ? 'Max reached'
                        : 'Complete stages'}
                    </div>
                  </>
                ) : (
                  <span className="text-gray-400 text-xs">
                    No progress data
                  </span>
                )}
              </div>
            ) : (
              // Single quest XP display
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
            )}

            {isCheckingClaimed ? (
              <div className="flex items-center gap-2 text-gray-400 text-xs">
                <LoadingSpinner height="h-4" width="w-4" />
                Checking status...
              </div>
            ) : isPollingClaim ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-yellow-400 text-xs">
                  <LoadingSpinner height="h-4" width="w-4" />
                  Waiting for blockchain confirmation...
                </div>
                <button
                  onClick={async () => {
                    console.log('Manual refresh triggered')
                    const claimed = await fetchHasClaimed(false)
                    if (claimed) {
                      setIsPollingClaim(false)
                      if (pollingTimeoutRef.current) {
                        clearTimeout(pollingTimeoutRef.current)
                        pollingTimeoutRef.current = null
                      }
                      toast.success('Quest claim confirmed!', {
                        duration: 3000,
                        style: toastStyle,
                      })
                      if (onClaimConfirmed) {
                        onClaimConfirmed()
                      }
                    }
                  }}
                  className="text-blue-400 hover:text-blue-300 text-xs underline"
                >
                  Refresh Status
                </button>
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
                    label={
                      quest.verifier.type === 'staged' &&
                      stagedProgress?.totalClaimableXP &&
                      stagedProgress.totalClaimableXP > 0
                        ? `Claim ${stagedProgress.totalClaimableXP} XP`
                        : 'Claim'
                    }
                    action={async () => {
                      await claimQuest()
                    }}
                    isDisabled={
                      isLoadingClaim ||
                      (quest.verifier.type === 'staged' &&
                        stagedProgress?.totalClaimableXP === 0) // Check if no XP available to claim
                    }
                    requiredChain={DEFAULT_CHAIN_V5}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-3 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg text-xs disabled:opacity-50 disabled:cursor-not-allowed"
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
