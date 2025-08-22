import { CheckBadgeIcon } from '@heroicons/react/24/outline'
import { getAccessToken, usePrivy } from '@privy-io/react-auth'
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
  getHighestQualifyingStage,
  getNextUnclamedThreshold,
  type StagedQuestProgress,
} from '@/lib/xp/staged-quest-info'
import StandardButton from '@/components/layout/StandardButton'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import Tooltip from '../layout/Tooltip'
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
    setError(null) // Clear any previous errors when starting a new claim
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
          console.log(`Transaction hash: ${txHash}`)
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
            toast.error(
              'Insufficient token balance to process claim. Please ensure you have enough tokens and try again.',
              {
                duration: 5000,
                style: toastStyle,
              }
            )
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

  // Streamlined styling with better visual hierarchy
  const getContainerClasses = () => {
    if (isCheckingClaimed || isPollingClaim) {
      return 'bg-white/5 border-white/10 animate-pulse backdrop-blur-sm'
    }
    if (isCompleted) {
      return 'bg-gradient-to-br from-green-500/10 via-green-500/5 to-emerald-500/10 border-green-500/30 shadow-lg shadow-green-500/20'
    }
    return 'bg-gradient-to-br from-white/5 via-white/3 to-white/5 border-white/20 hover:bg-gradient-to-br hover:from-white/10 hover:via-white/5 hover:to-white/10 hover:border-white/30 hover:shadow-2xl hover:shadow-white/20 transition-all duration-500 backdrop-blur-sm hover:scale-[1.02]'
  }

  const getIconClasses = () => {
    if (isCheckingClaimed || isPollingClaim) {
      return variant === 'weekly'
        ? 'bg-gradient-to-br from-purple-500/30 to-purple-600/20 text-purple-300 shadow-lg shadow-purple-500/20'
        : 'bg-gradient-to-br from-blue-500/30 to-blue-600/20 text-blue-300 shadow-lg shadow-blue-500/20'
    }
    if (isCompleted) {
      return 'bg-gradient-to-br from-green-500/30 to-emerald-500/20 text-green-300 shadow-lg shadow-green-500/20'
    }
    return variant === 'weekly'
      ? 'bg-gradient-to-br from-purple-500/30 to-purple-600/20 text-purple-300 shadow-lg shadow-purple-500/20 hover:scale-110 transition-transform duration-300'
      : 'bg-gradient-to-br from-blue-500/30 to-blue-600/20 text-blue-300 shadow-lg shadow-blue-500/20 hover:scale-110 transition-transform duration-300'
  }

  const getButtonClasses = () => {
    const baseClasses =
      'px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95'
    if (variant === 'weekly') {
      return `${baseClasses} bg-gradient-to-r from-purple-600 via-purple-500 to-purple-600 hover:from-purple-700 hover:via-purple-600 hover:to-purple-700 text-white`
    }
    return `${baseClasses} bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 hover:from-blue-700 hover:via-blue-600 hover:to-blue-700 text-white`
  }

  // Base classes for different error button types
  const getBaseErrorButtonClasses = useCallback((type: string) => {
    const baseClasses =
      'bg-gradient-to-r text-white font-medium py-2 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl text-sm transform hover:scale-105 active:scale-95'

    switch (type) {
      case 'github_link':
        return `${baseClasses} from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700`
      case 'info':
        return `${baseClasses} from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700`
      case 'warning':
        return `${baseClasses} from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700`
      case 'error':
        return `${baseClasses} from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700`
      default:
        return `${baseClasses} from-gray-600 to-slate-600 hover:from-gray-700 hover:to-slate-700`
    }
  }, [])

  // Function to get error button based on error message
  //
  // Error button configuration example:
  // quest.verifier.errorButtons = {
  //   "No GitHub account linked": {
  //     type: "github_link",
  //     text: "Link GitHub Account",
  //     className: "custom-classes"
  //   },
  //   "insufficient balance": {
  //     type: "retry",
  //     text: "Try Again",
  //     className: "bg-red-500"
  //   },
  //   "network error": {
  //     type: "refresh",
  //     text: "Refresh",
  //     className: "bg-blue-500"
  //   },
  //   "documentation": {
  //     type: "external_link",
  //     text: "View Docs",
  //     url: "https://docs.example.com"
  //   }
  // }
  const getErrorButton = useCallback(
    (errorMessage: string) => {
      console.log('getErrorButton called with:', errorMessage)
      console.log('quest.verifier.errorButtons:', quest.verifier.errorButtons)

      if (!quest.verifier.errorButtons) return null

      // Find the first error button that matches the error message
      const errorButtonConfig = Object.entries(
        quest.verifier.errorButtons
      ).find(([errorPattern]) => {
        console.log(
          'Checking pattern:',
          errorPattern,
          'against message:',
          errorMessage
        )
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

  return (
    <div
      className={`px-4 py-6 rounded-xl border transition-all duration-500 group relative overflow-hidden ${getContainerClasses()}`}
    >
      {/* Progress Background - Makes the whole card act as a progress bar */}
      {(quest.verifier.type === 'staged' &&
        stagedProgress &&
        !isLoadingStagedProgress) ||
      isCompleted ? (
        <>
          {/* Main Progress Gradient */}
          <div
            className="absolute inset-0 transition-all duration-1000 ease-out"
            style={{
              background: `linear-gradient(90deg, 
                rgba(34, 197, 94, 0.15) 0%, 
                rgba(34, 197, 94, 0.08) ${Math.min(
                  100,
                  (Number(userMetric) /
                    Number(getNextUnclamedThreshold(stagedProgress))) *
                    100
                )}%, 
                rgba(255, 255, 255, 0.02) ${Math.min(
                  100,
                  (Number(userMetric) /
                    Number(getNextUnclamedThreshold(stagedProgress))) *
                    100
                )}%, 
                rgba(255, 255, 255, 0.02) 100%)`,
            }}
          />

          {/* Animated Shimmer Effect */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: `linear-gradient(90deg, 
                  transparent 0%, 
                  rgba(34, 197, 94, 0.3) 25%, 
                  rgba(34, 197, 94, 0.6) 50%, 
                  rgba(34, 197, 94, 0.3) 75%, 
                  transparent 100%)`,
              backgroundSize: '200% 100%',
              animation: 'shimmer 10s ease-in-out infinite',
              width: `${Math.min(
                100,
                (Number(userMetric) /
                  Number(getNextUnclamedThreshold(stagedProgress))) *
                  100
              )}%`,
            }}
          />

          {/* Pulsing Progress Edge Glow */}
          {quest.verifier.type === 'staged' && !isCompleted && (
            <div
              className="absolute top-0 bottom-0 w-1 bg-gradient-to-b from-green-400 via-green-300 to-green-400 shadow-lg shadow-green-400/50 opacity-[0.35]"
              style={{
                left: `${Math.min(
                  100,
                  (Number(userMetric) /
                    Number(getNextUnclamedThreshold(stagedProgress))) *
                    100
                )}%`,
                transform: 'translateX(-50%)',
                animation: 'pulse-glow 2s ease-in-out infinite',
              }}
            />
          )}

          {/* CSS Animations */}
          <style jsx>{`
            @keyframes shimmer {
              0% {
                background-position: -200% 0;
              }
              100% {
                background-position: 200% 0;
              }
            }

            @keyframes pulse-glow {
              0%,
              100% {
                box-shadow: 0 0 20px rgba(34, 197, 94, 0.5),
                  0 0 40px rgba(34, 197, 94, 0.3),
                  0 0 60px rgba(34, 197, 94, 0.1);
              }
              50% {
                box-shadow: 0 0 30px rgba(34, 197, 94, 0.8),
                  0 0 60px rgba(34, 197, 94, 0.5),
                  0 0 90px rgba(34, 197, 94, 0.2);
              }
            }
          `}</style>
        </>
      ) : (
        <></>
      )}

      <div className="flex flex-col items-start gap-3 w-full relative z-10">
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-3">
            {/* Icon Section */}
            <div
              className={`p-2.5 rounded-xl flex-shrink-0 transition-all duration-500 ${getIconClasses()} h-10 w-10`}
            >
              <quest.icon className="w-5 h-5 group-hover:rotate-12 transition-transform duration-500" />
            </div>
            <div className="flex items-center gap-3">
              <h3
                className={`font-semibold text-base transition-all duration-300 ${
                  isCheckingClaimed || isPollingClaim
                    ? 'text-white'
                    : isCompleted
                    ? 'text-green-300 group-hover:from-green-400 group-hover:to-emerald-400'
                    : variant === 'weekly'
                    ? 'text-white group-hover:from-purple-400 group-hover:to-purple-300'
                    : 'text-white group-hover:from-blue-400 group-hover:to-blue-300'
                }`}
              >
                {quest.title}
              </h3>
              {isCompleted && (
                <CheckBadgeIcon className="w-5 h-5 text-green-400 flex-shrink-0 group-hover:scale-110 transition-transform duration-300" />
              )}
            </div>
          </div>

          {/* Stage and Threshold Info - Moved to upper right */}
          {quest.verifier.type === 'staged' &&
            stagedProgress &&
            !isLoadingStagedProgress && (
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-300 text-sm font-medium bg-gradient-to-r from-yellow-500/30 to-orange-500/30 px-2.5 py-1 rounded-full border border-yellow-400/30 shadow-lg shadow-yellow-500/20 backdrop-blur-sm">
                    Stage {getHighestQualifyingStage(stagedProgress)} of{' '}
                    {stagedProgress.stages.length}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white">
                  <span className="font-medium">{formattedUserMetric}</span>
                  <span className="text-gray-400">/</span>
                  <span className="font-medium">
                    {formattedNextUnclamedThreshold}
                  </span>
                  <span className="font-sm">
                    {`(${(
                      (Number(userMetric) /
                        Number(getNextUnclamedThreshold(stagedProgress))) *
                      100
                    ).toFixed(0)}%)`}
                  </span>
                </div>
              </div>
            )}
        </div>

        {/* Content Section */}
        <div className="flex-1 w-full space-y-3">
          {/* Description */}
          <p className="text-gray-300 text-sm leading-relaxed group-hover:text-gray-200 transition-colors duration-300">
            {quest.description}
          </p>

          {/* Progress Section */}
          <div className="w-full space-y-3">
            {quest.verifier.type === 'staged' ? (
              // Staged quest progress display
              <div className="w-full space-y-3">
                {isLoadingStagedProgress ? (
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <LoadingSpinner height="h-4" width="w-4" />
                    Loading progress...
                  </div>
                ) : stagedProgress ? (
                  <div className="flex items-start justify-between gap-4 w-full">
                    {/* XP Info Cards */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Ready to Claim Section */}
                      {stagedProgress.totalClaimableXP > 0 && (
                        <div className="text-green-300 text-sm font-medium bg-gradient-to-r from-green-500/20 to-emerald-500/20 px-2.5 py-1.5 rounded-lg border border-green-400/20 backdrop-blur-sm shadow-lg shadow-green-500/20">
                          Ready to Claim: +{stagedProgress.totalClaimableXP} XP
                          / +{stagedProgress.totalClaimableXP} MOONEY
                        </div>
                      )}

                      {/* Next Stage or Final Stage Section */}
                      {(() => {
                        if (
                          stagedProgress.isMaxStageReached &&
                          stagedProgress.currentUserMetric >=
                            getNextUnclamedThreshold(stagedProgress)
                        ) {
                          // Max stage reached - Purple
                          return (
                            <div className="text-purple-300 text-sm font-medium bg-gradient-to-r from-purple-500/20 to-violet-500/20 px-2.5 py-1.5 rounded-lg border border-purple-400/20 backdrop-blur-sm shadow-lg shadow-purple-500/20">
                              🏆 Max Stage Reached - Congratulations!
                            </div>
                          )
                        } else if (
                          stagedProgress.nextStageXP !== null &&
                          stagedProgress.userHighestStage !==
                            stagedProgress.stages.length - 1
                        ) {
                          // Next stage available - Blue
                          return (
                            <div className="text-blue-300 text-sm font-medium bg-gradient-to-r from-blue-500/20 to-cyan-500/20 px-2.5 py-1.5 rounded-lg border border-blue-400/20 backdrop-blur-sm shadow-lg shadow-blue-500/20">
                              Next Stage: +{stagedProgress.nextStageXP} XP / +
                              {stagedProgress.nextStageXP} MOONEY
                            </div>
                          )
                        } else {
                          // Final stage info - Orange
                          return (
                            <div className="text-orange-300 text-sm font-medium bg-gradient-to-r from-orange-500/20 to-amber-500/20 px-2.5 py-1.5 rounded-lg border border-orange-400/20 backdrop-blur-sm shadow-lg shadow-purple-500/20">
                              🎯 Final Stage: +{stagedProgress.nextStageXP} XP /
                              +{stagedProgress.nextStageXP} MOONEY
                            </div>
                          )
                        }
                      })()}
                    </div>

                    {/* Action Buttons - Right side */}
                    <div className="flex gap-2 flex-shrink-0">
                      {!isCompleted && !needsGitHubLink && (
                        <PrivyWeb3Button
                          label="Claim"
                          action={async () => {
                            await claimQuest()
                          }}
                          isDisabled={
                            isLoadingClaim ||
                            (quest.verifier.type === 'staged' &&
                              stagedProgress?.totalClaimableXP === 0)
                          }
                          requiredChain={DEFAULT_CHAIN_V5}
                          className="bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 hover:from-blue-700 hover:via-blue-600 hover:to-blue-700 text-white font-medium py-2 px-3 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
                          noPadding
                        />
                      )}

                      {getErrorButton(error || '') && (
                        <div className="flex justify-center">
                          {getErrorButton(error || '')}
                        </div>
                      )}

                      {!isCompleted &&
                        quest.link &&
                        quest.linkText &&
                        !needsGitHubLink && (
                          <StandardButton
                            className={getButtonClasses()}
                            link={quest.link}
                            target="_blank"
                          >
                            {quest.linkText}
                          </StandardButton>
                        )}
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-400 text-sm">
                    No progress data available
                  </span>
                )}
              </div>
            ) : (
              // Single quest XP display with buttons
              <div className="flex items-center justify-between gap-4 w-full">
                <span className="text-yellow-300 text-sm font-medium bg-gradient-to-r from-yellow-500/20 to-orange-500/20 px-2.5 py-1.5 rounded-lg border border-yellow-400/20 backdrop-blur-sm flex items-center justify-center">
                  +
                  {isLoadingXpAmount ? (
                    <div className="inline-flex items-center gap-1">
                      <LoadingSpinner height="h-4" width="w-4" />
                    </div>
                  ) : (
                    xpAmount
                  )}{' '}
                  XP / +
                  {isLoadingXpAmount ? (
                    <div className="inline-flex items-center gap-1">
                      <LoadingSpinner height="h-4" width="w-4" />
                    </div>
                  ) : (
                    xpAmount
                  )}{' '}
                  MOONEY
                </span>

                {/* Action Buttons - Right side */}
                <div className="flex items-center flex-row gap-2 flex-nowrap">
                  {!isCompleted && !needsGitHubLink && (
                    <div className="inline-block">
                      <PrivyWeb3Button
                        label="Claim"
                        action={async () => {
                          await claimQuest()
                        }}
                        isDisabled={isLoadingClaim}
                        requiredChain={DEFAULT_CHAIN_V5}
                        className="bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 hover:from-blue-700 hover:via-blue-600 hover:to-blue-700 text-white font-medium py-2 px-3 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
                        noPadding
                      />
                    </div>
                  )}

                  <div className="inline-block">
                    {getErrorButton(error || '')}
                  </div>

                  {!isCompleted &&
                    quest.link &&
                    quest.linkText &&
                    !needsGitHubLink && (
                      <div className="inline-block">
                        <StandardButton
                          className={getButtonClasses()}
                          link={quest.link}
                          target="_blank"
                        >
                          {quest.linkText}
                        </StandardButton>
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>

          {/* Status and Actions */}
          <div className="pt-2">
            {isCheckingClaimed ? (
              <></>
            ) : isPollingClaim ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-yellow-400 text-sm">
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
                  className="text-blue-400 hover:text-blue-300 text-sm underline transition-colors"
                >
                  Refresh Status
                </button>
              </div>
            ) : null}

            {/* Show error messages and dynamic error buttons */}
            {!isCompleted && error && (
              <div className="flex flex-col gap-2 w-full">
                {/* Dynamic error button if configured */}
                {/* Fallback error handling for specific error types */}
                {error.includes('ERC20: transfer amount exceeds balance') && (
                  <div className="bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-400/30 rounded-lg p-3 backdrop-blur-sm">
                    <p className="text-red-300 text-sm mb-2">
                      ⚠️ Insufficient token balance detected. This usually
                      means:
                    </p>
                    <ul className="text-red-200 text-xs space-y-1 ml-4">
                      <li>
                        • The contract doesn't have enough tokens to distribute
                      </li>
                      <li>
                        • There might be a temporary issue with the reward pool
                      </li>
                      <li>• The quest reward amount may need adjustment</li>
                    </ul>
                    <p className="text-red-200 text-xs mt-2">
                      💡 Try refreshing the data or retrying. If the issue
                      persists, please contact support.
                    </p>
                  </div>
                )}

                {/* Generic error display if no specific handling and no dynamic error button */}
                {!error.includes('ERC20: transfer amount exceeds balance') &&
                  !getErrorButton(error) && (
                    <div className="bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-400/30 rounded-lg p-3 backdrop-blur-sm">
                      <p className="text-red-300 text-sm">⚠️ {error}</p>
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
