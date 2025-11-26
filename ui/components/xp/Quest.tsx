import { CheckBadgeIcon } from '@heroicons/react/24/outline'
import { getAccessToken, usePrivy } from '@privy-io/react-auth'
import ERC20ABI from 'const/abis/ERC20.json'
import StagedXPVerifierABI from 'const/abis/StagedXPVerifier.json'
import XPVerifierABI from 'const/abis/XPVerifier.json'
import { DEFAULT_CHAIN_V5, MOONEY_ADDRESSES } from 'const/config'
import React, {
  ComponentType,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import toast from 'react-hot-toast'
import { Chain, getContract, readContract } from 'thirdweb'
import CitizenContext from '@/lib/citizen/citizen-context'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import { getChainSlug } from '@/lib/thirdweb/chain'
import client from '@/lib/thirdweb/client'
import useContract from '@/lib/thirdweb/hooks/useContract'
import {
  getStagedQuestProgress,
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
  action?: () => void
  actionText?: string
  modalButton?: React.ComponentType<any>
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
  const { citizen } = useContext(CitizenContext)
  const { linkGithub } = usePrivy()
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
  const [needsGitHubLink, setNeedsGitHubLink] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Retry utility function with exponential backoff
  const retryWithBackoff = useCallback(
    async <T,>(
      fn: () => Promise<T>,
      maxRetries: number = 3,
      baseDelay: number = 1000
    ): Promise<T> => {
      let lastError: Error

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await fn()
        } catch (error) {
          lastError = error as Error

          if (attempt === maxRetries) {
            throw lastError
          }

          // Exponential backoff with jitter
          const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }

      throw lastError!
    },
    []
  )

  const formattedUserMetric = quest.verifier.metricFormatting
    ? quest.verifier.metricFormatting(userMetric).toLocaleString()
    : userMetric.toLocaleString()

  const formattedNextUnclamedThreshold = quest.verifier.metricFormatting
    ? quest.verifier
        .metricFormatting(getNextUnclamedThreshold(stagedProgress))
        .toLocaleString()
    : stagedProgress
    ? getNextUnclamedThreshold(stagedProgress).toLocaleString()
    : 0

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
    [xpManagerContract, userAddress, quest.verifier.verifierId]
  )

  // Function to fetch user metric from the quest's API endpoint with retry logic
  const fetchUserMetric = useCallback(async (): Promise<number> => {
    if (!quest.verifier.route || !userAddress || !quest.verifier.metricKey) {
      return 0
    }

    try {
      return await retryWithBackoff(
        async () => {
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
            throw new Error(
              `Failed to fetch user metric: ${response.statusText}`
            )
          }

          const data = await response.json()

          if (data.error) {
            console.log('Error fetching user metric:', data.error)

            // Check if this is a GitHub linking error
            if (data.error.includes('No GitHub account linked')) {
              console.log('Setting GitHub linking error:', data.error)
              setNeedsGitHubLink(true)
              setError(data.error) // Set the error so getErrorButton can use it
            } else {
              console.log('Setting other error:', data.error)
              setNeedsGitHubLink(false)
              setError(data.error) // Set other errors as well
            }

            return 0
          }

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
        },
        3,
        1000
      ) // 3 retries with 1 second base delay
    } catch (error) {
      console.error('Error fetching user metric after retries:', error)
      return 0
    }
  }, [
    quest.verifier.route,
    quest.verifier.metricKey,
    userAddress,
    retryWithBackoff,
  ])

  // Simplified staged progress fetching with retry logic
  const fetchStagedProgress = useCallback(async () => {
    if (quest.verifier.type !== 'staged' || !verifierContract || !userAddress)
      return

    setIsLoadingStagedProgress(true)
    try {
      // Get user metric from quest's backend/oracle with retry
      const metric = await fetchUserMetric()
      setUserMetric(metric)

      // Get progress with real user metric, also with retry
      const progress = await retryWithBackoff(
        async () => {
          return await getStagedQuestProgress(
            verifierContract,
            userAddress,
            metric
          )
        },
        3,
        1000
      )

      setStagedProgress(progress)
    } catch (error) {
      console.error('Error fetching staged progress after retries:', error)
    } finally {
      setIsLoadingStagedProgress(false)
    }
  }, [
    verifierContract,
    userAddress,
    quest.verifier.type,
    fetchUserMetric,
    retryWithBackoff,
  ])

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
        const claimed = await fetchHasClaimed(true)
        if (claimed) {
          setIsPollingClaim(false)
          pollingTimeoutRef.current = null
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
            const finalCheck = await fetchHasClaimed(true)
            if (finalCheck) {
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
            'Claim confirmation timed out. The transaction may have succeeded - please refresh.',
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
    setError(null) // Clear any previous errors when starting a new claim
    try {
      const defaultChainSlug = getChainSlug(DEFAULT_CHAIN_V5)
      const mooneyContract = getContract({
        address: MOONEY_ADDRESSES[defaultChainSlug],
        chain: DEFAULT_CHAIN_V5,
        client: client,
        abi: ERC20ABI as any,
      })

      const xpManagerMooneyBalance = await readContract({
        contract: mooneyContract,
        method: 'balanceOf' as string,
        params: [xpManagerContract.address],
      })

      if (+xpManagerMooneyBalance.toString() / 1e18 < xpAmount) {
        return toast.error('Insufficient rewards. Please contact support.', {
          duration: 5000,
          style: toastStyle,
        })
      }

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

      // Check if this is a GitHub linking error
      if (error && error.includes('No GitHub account linked')) {
        setNeedsGitHubLink(true)
        setError(error) // Set the error so getErrorButton can use it
        toast.error(error, {
          duration: 5000,
          style: toastStyle,
        })
        return
      }

      if (eligible) {
        if (txHash) {
          console.log('Quest claim successful, txHash:', txHash)
          setError(null) // Clear any previous errors
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

          // Handle specific ERC20 balance error
          if (error.includes('ERC20: transfer amount exceeds balance')) {
            setError(error) // Store the error for UI display
            toast.error('Insufficient rewards. Please contact support.', {
              duration: 5000,
              style: toastStyle,
            })
            // Set a flag to show helpful guidance
            setNeedsGitHubLink(false) // Reset this flag
          } else {
            setError(error) // Store the error for UI display
            toast.error(error, {
              duration: 3000,
              style: toastStyle,
            })
          }
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

      // Handle specific ERC20 balance error in catch block as well
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      if (errorMessage.includes('ERC20: transfer amount exceeds balance')) {
        setError(errorMessage) // Store the error for UI display
        toast.error(
          'Insufficient token balance to process claim. Please ensure you have enough tokens and try again.',
          {
            duration: 5000,
            style: toastStyle,
          }
        )
      } else {
        setError(errorMessage) // Store the error for UI display
        toast.error(`Claim failed: ${errorMessage}`, {
          duration: 3000,
          style: toastStyle,
        })
      }
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
    // Only clear errors on quest change, not on every mount
    if (quest.verifier.verifierId !== undefined) {
      setError(null)
    }

    // For single quests with GitHub dependencies, fetch user metric to check for GitHub linking errors
    if (
      quest.verifier.type !== 'staged' &&
      quest.verifier.errorButtons &&
      quest.verifier.errorButtons[
        'No GitHub account linked to your Privy account'
      ]
    ) {
      fetchUserMetric()
    }
  }, [
    fetchHasClaimed,
    quest.verifier.verifierId,
    quest.verifier.type,
    quest.verifier.errorButtons,
    fetchUserMetric,
  ])

  // Cleanup polling timeout on unmount
  useEffect(() => {
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current)
        pollingTimeoutRef.current = null
      }
    }
  }, [])

  const isCompleted =
    quest.verifier.type === 'staged'
      ? stagedProgress?.currentUserMetric &&
        stagedProgress?.currentUserMetric >=
          stagedProgress?.stages[stagedProgress.stages.length - 1]?.threshold &&
        stagedProgress?.totalClaimableXP === 0
      : Boolean(hasClaimed)

  // Simple, clean styling
  const getContainerClasses = () => {
    if (isCheckingClaimed || isPollingClaim) {
      return 'bg-slate-800/50 border-slate-700/50 animate-pulse'
    }
    if (isCompleted) {
      return 'bg-slate-800/50 border-green-500/50'
    }
    return 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600 transition-colors duration-200'
  }

  const getIconClasses = () => {
    if (isCompleted) {
      return 'bg-green-500/20 text-green-400'
    }
    if (variant === 'weekly') {
      return 'bg-purple-500/20 text-purple-400'
    }
    return 'bg-blue-500/20 text-blue-400'
  }

  const getButtonClasses = () => {
    const baseClasses = 'px-3 py-1.5 rounded-md font-medium text-sm transition-colors duration-200'
    if (variant === 'weekly') {
      return `${baseClasses} bg-purple-500 hover:bg-purple-600 text-white`
    }
    return `${baseClasses} bg-blue-500 hover:bg-blue-600 text-white`
  }

  // Simplified error button classes
  const getBaseErrorButtonClasses = useCallback((type: string) => {
    const baseClasses = 'px-4 py-2 rounded-md font-medium text-sm transition-colors duration-200 min-w-[80px] h-[36px]'

    switch (type) {
      case 'github_link':
        return `${baseClasses} bg-green-500 hover:bg-green-600 text-white`
      case 'info':
        return `${baseClasses} bg-blue-500 hover:bg-blue-600 text-white`
      case 'warning':
        return `${baseClasses} bg-yellow-500 hover:bg-yellow-600 text-white`
      case 'error':
        return `${baseClasses} bg-red-500 hover:bg-red-600 text-white`
      default:
        return `${baseClasses} bg-gray-500 hover:bg-gray-600 text-white`
    }
  }, [])

  const getErrorButton = useCallback(
    (errorMessage: string) => {
      if (!quest.verifier.errorButtons) return null

      // Find the first error button that matches the error message
      const errorButtonConfig = Object.entries(
        quest.verifier.errorButtons
      ).find(([errorPattern]) => {
        return errorMessage.includes(errorPattern)
      })

      if (!errorButtonConfig) return null

      const [pattern, config]: any = errorButtonConfig

      // Merge base classes with custom classes if provided
      const buttonClasses = config.className
        ? `${getBaseErrorButtonClasses(config.type)} ${config.className}`
        : getBaseErrorButtonClasses(config.type)

      switch (config.type) {
        case 'github_link':
          return (
            <button
              onClick={async () => {
                try {
                  await linkGithub()
                  // After linking, refresh the quest data
                  if (quest.verifier.type === 'staged') {
                    await fetchStagedProgress()
                  } else {
                    await fetchUserMetric()
                  }
                  setNeedsGitHubLink(false)
                  setError(null) // Clear any errors after successful GitHub linking
                } catch (error) {
                  console.error('Error linking GitHub:', error)
                  toast.error(
                    'Failed to link GitHub account. Please try again.'
                  )
                }
              }}
              className={buttonClasses}
            >
              {config.text}
            </button>
          )

        case 'retry':
          return (
            <button
              onClick={() => {
                setError(null) // Clear error before retry
                claimQuest()
              }}
              className={buttonClasses}
            >
              {config.text}
            </button>
          )

        case 'refresh':
          return (
            <button
              onClick={() => {
                setError(null) // Clear error before refresh
                if (quest.verifier.type === 'staged') {
                  fetchStagedProgress()
                } else {
                  fetchUserMetric()
                }
                fetchHasClaimed()
              }}
              className={buttonClasses}
            >
              {config.text}
            </button>
          )

        case 'external_link':
          return (
            <a
              href={config.url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses}
            >
              {config.text}
            </a>
          )

        case 'custom_action':
          return (
            <button
              onClick={() => {
                if (config.onClick) {
                  config.onClick(errorMessage)
                }
              }}
              className={buttonClasses}
            >
              {config.text}
            </button>
          )

        default:
          return (
            <button
              onClick={() => {
                // Default action
                console.log('Default error button clicked')
              }}
              className={buttonClasses}
            >
              {config.text}
            </button>
          )
      }
    },
    [
      quest.verifier.errorButtons,
      getBaseErrorButtonClasses,
      linkGithub,
      quest.verifier.type,
      fetchStagedProgress,
      fetchUserMetric,
      claimQuest,
      fetchHasClaimed,
    ]
  )

  const ModalButton = quest?.modalButton || null

  return (
    <div className={`p-4 rounded-lg border ${getContainerClasses()}`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`p-2 rounded-lg flex-shrink-0 ${getIconClasses()}`}>
          <quest.icon className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-sm">
                {quest.title}
              </h3>
              {isCompleted && (
                <CheckBadgeIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
              )}
            </div>
            
            {/* Stage indicator for staged quests */}
            {quest.verifier.type === 'staged' && stagedProgress && !isLoadingStagedProgress && (
              <span className="text-xs text-slate-400 flex-shrink-0">
                Stage {Math.min((stagedProgress.nextClaimableStage ?? -1) + 2, stagedProgress.stages.length)} / {stagedProgress.stages.length}
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-slate-400 text-xs mb-3 leading-relaxed">
            {quest.description}
          </p>

          {/* Progress for staged quests */}
          {quest.verifier.type === 'staged' && !isLoadingStagedProgress && stagedProgress && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">
                  {formattedUserMetric} / {formattedNextUnclamedThreshold}
                </span>
                <span className="text-slate-400">
                  {((Number(userMetric) / Number(getNextUnclamedThreshold(stagedProgress))) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-1.5">
                <div
                  className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (Number(userMetric) / Number(getNextUnclamedThreshold(stagedProgress))) * 100)}%`
                  }}
                />
              </div>
            </div>
          )}

          {/* XP and Actions */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* XP Display */}
            <div className="flex items-center gap-2 flex-wrap">
              {quest.verifier.type === 'staged' ? (
                <>
                  {stagedProgress?.totalClaimableXP && stagedProgress.totalClaimableXP > 0 && (
                    <span className="text-xs font-medium text-green-400 bg-green-500/20 px-2 py-1 rounded">
                      +{stagedProgress.totalClaimableXP} MOONEY
                    </span>
                  )}
                  {stagedProgress?.nextStageXP !== null && stagedProgress?.nextStageXP !== undefined && stagedProgress?.nextStageXP > 0 && !stagedProgress?.isMaxStageReached && (
                    <span className="text-xs text-slate-400">
                      Next: +{stagedProgress.nextStageXP} MOONEY
                    </span>
                  )}
                  {stagedProgress?.isMaxStageReached && (
                    <span className="text-xs font-medium text-purple-400">
                      Max Stage 🏆
                    </span>
                  )}
                </>
              ) : (
                <>
                  {xpAmount > 0 && (
                    <span className="text-xs font-medium text-yellow-400 bg-yellow-500/20 px-2 py-1 rounded">
                      {isLoadingXpAmount ? (
                        <LoadingSpinner height="h-3" width="w-3" />
                      ) : (
                        `+${xpAmount} MOONEY`
                      )}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {!isCompleted && !needsGitHubLink && (quest.verifier.type !== 'staged' || (stagedProgress?.totalClaimableXP && stagedProgress.totalClaimableXP > 0)) && (
                <PrivyWeb3Button
                  label="Claim"
                  action={async () => await claimQuest()}
                  isDisabled={isLoadingClaim}
                  requiredChain={DEFAULT_CHAIN_V5}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium px-4 py-2 rounded-md text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px] h-[36px]"
                  noPadding
                  noGradient
                />
              )}

              {error && getErrorButton(error)}

              {!isCompleted && quest.link && quest.linkText && !needsGitHubLink && (
                <StandardButton
                  className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-4 py-2 rounded-md text-sm transition-colors duration-200 min-w-[80px] h-[36px] flex items-center justify-center"
                  link={quest.link === 'citizenProfile' ? `/citizen/${generatePrettyLinkWithId(citizen.name, citizen.id)}` : quest.link}
                  target={quest.link.startsWith('/') || quest.link === 'citizenProfile' ? '_self' : '_blank'}
                >
                  {quest.linkText}
                </StandardButton>
              )}

              {!isCompleted && quest.action && quest.actionText && !needsGitHubLink && (
                <button onClick={quest.action} className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-4 py-2 rounded-md text-sm transition-colors duration-200 min-w-[80px] h-[36px]">
                  {quest.actionText}
                </button>
              )}

              {!isCompleted && ModalButton && <ModalButton />}
            </div>
          </div>

          {/* Status Messages */}
          {isPollingClaim && (
            <div className="flex items-center gap-2 text-yellow-400 text-xs mt-2">
              <LoadingSpinner height="h-3" width="w-3" />
              <span>Confirming on blockchain...</span>
            </div>
          )}

          {/* Error Messages - Hide eligibility requirement errors */}
          {!isCompleted && error && !error.includes('You need at least') && (
            <div className="mt-2 bg-red-500/20 border border-red-500/30 rounded p-2">
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
