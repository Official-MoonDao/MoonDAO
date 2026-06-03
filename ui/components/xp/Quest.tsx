import { CheckBadgeIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline'
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
  getNextUnclamedThreshold,
  getProgressThreshold,
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

  // For single (non-staged) quests: whether the user actually meets the
  // requirement. `null` = not yet determined (don't show a Claim button until
  // we know), `false` = not eligible, `true` = eligible. This prevents showing
  // a "Claim" button for a quest the user hasn't completed.
  const [singleQuestEligible, setSingleQuestEligible] = useState<
    boolean | null
  >(null)

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
      maxRetries: number = 2,
      baseDelay: number = 500
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

          // Exponential backoff with light jitter (capped so the worst case
          // stays bounded and a flaky quest can't hang the card for minutes).
          const delay = Math.min(
            4000,
            baseDelay * Math.pow(2, attempt) + Math.random() * 300
          )
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }

      throw lastError!
    },
    []
  )

  // fetch wrapper that aborts after `timeoutMs` so a slow/cold serverless
  // route can't hang the card on "Loading progress..." indefinitely. A timed-
  // out attempt throws and is then retried by retryWithBackoff.
  const fetchWithTimeout = useCallback(
    async (input: string, init: RequestInit = {}, timeoutMs = 8000) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        return await fetch(input, { ...init, signal: controller.signal })
      } finally {
        clearTimeout(timer)
      }
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
      const verifierId = quest.verifier?.verifierId
      // Guard: a 42-char `0x...` address is required. An empty / malformed
      // address makes viem throw deep in its ABI encoder with messages like
      // "Cannot read properties of undefined (reading 'buffer')".
      const isValidAddress =
        typeof userAddress === 'string' &&
        userAddress.startsWith('0x') &&
        userAddress.length === 42

      if (
        xpManagerContract &&
        isValidAddress &&
        verifierId !== undefined &&
        verifierId !== null
      ) {
        // Only show "Checking status..." if we're not already polling for confirmation
        if (!polling) {
          setIsCheckingClaimed(true)
        }

        try {
          const claimed = await readContract({
            contract: xpManagerContract,
            method: 'hasClaimedFromVerifier' as string,
            params: [userAddress, BigInt(verifierId)],
          })

          setHasClaimed(Boolean(claimed))
          if (!polling) {
            setIsCheckingClaimed(false)
          }
          return Boolean(claimed)
        } catch (err) {
          // Common causes: contract not deployed on current chain, RPC
          // returned `0x`, decode error, network blip. Treat as "not claimed"
          // so the UI stays usable instead of crashing the page.
          console.error('Error reading hasClaimedFromVerifier:', err)
          setHasClaimed(false)
          if (!polling) {
            setIsCheckingClaimed(false)
          }
          return false
        }
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

          const response = await fetchWithTimeout(
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
    fetchWithTimeout,
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

      // For staged quests xpAmount stays 0 (set by xpPerClaim, not used for staged).
      // Use the actual claimable XP from staged progress so the check isn't a no-op.
      const isQuestStaged = quest.verifier.type === 'staged'
      const balanceCheckAmount = isQuestStaged
        ? (stagedProgress?.totalClaimableXP ?? 0)
        : xpAmount

      if (+xpManagerMooneyBalance.toString() / 1e18 < balanceCheckAmount) {
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

      // Parse the body first: the API returns its real failure reason in
      // `{ error }` even on non-2xx responses. Throwing on `!response.ok`
      // before reading the body collapses every server error into a useless
      // "HTTP 500:" message and hides the actual cause.
      let data: any = null
      try {
        data = await response.json()
      } catch {
        // Non-JSON body (e.g. gateway/proxy error page)
      }

      if (!response.ok) {
        const serverError =
          data?.error || `HTTP ${response.status}: ${response.statusText}`
        throw new Error(serverError)
      }

      const { eligible, error, txHash } = data || {}

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
  }, [quest.verifier, userAddress, pollForClaimConfirmation, stagedProgress, xpAmount])

  useEffect(() => {
    async function fetchXpAmount() {
      setIsLoadingXpAmount(true)

      try {
        if (quest.verifier.type === 'staged') {
          // For staged quests, show total claimable XP instead of fixed amount
          await fetchStagedProgress()
          return
        }

        if (quest.verifier.xpPerClaim) {
          setXpAmount(quest.verifier.xpPerClaim)
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
      } catch (err) {
        console.error('Error fetching XP amount:', err)
        setXpAmount(0)
      } finally {
        setIsLoadingXpAmount(false)
      }
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

    // For single (non-staged) quests, fetch the user metric to determine real
    // eligibility. This both surfaces GitHub-linking errors AND lets us hide
    // the Claim button until the user has actually completed the requirement.
    if (quest.verifier.type !== 'staged') {
      // Reset to null immediately so any stale Claim button disappears while
      // the new fetch is in flight (e.g. when userAddress or quest changes).
      setSingleQuestEligible(null)
      fetchUserMetric()
        .then((metric) => {
          setUserMetric(metric)
          setSingleQuestEligible(metric >= 1)
        })
        .catch(console.error)
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

  // Bounded auto-retry for staged quests: if a fetch finished but produced no
  // progress (transient network/RPC hiccup), quietly retry a few times with a
  // short backoff instead of leaving the card stuck until a manual refresh.
  const autoRetryCountRef = useRef(0)
  useEffect(() => {
    if (quest.verifier.type !== 'staged') return
    if (!userAddress || !verifierContract) return
    if (stagedProgress || isLoadingStagedProgress) {
      // Got data (or a fetch is in flight) — reset the counter for next time.
      if (stagedProgress) autoRetryCountRef.current = 0
      return
    }
    if (autoRetryCountRef.current >= 3) return

    const attempt = autoRetryCountRef.current
    autoRetryCountRef.current += 1
    const delay = 1500 * (attempt + 1)
    const timer = setTimeout(() => {
      fetchStagedProgress()
    }, delay)
    return () => clearTimeout(timer)
  }, [
    quest.verifier.type,
    userAddress,
    verifierContract,
    stagedProgress,
    isLoadingStagedProgress,
    fetchStagedProgress,
  ])

  const isCompleted: boolean =
    quest.verifier.type === 'staged'
      ? Boolean(
          stagedProgress?.currentUserMetric &&
            stagedProgress?.currentUserMetric >=
              stagedProgress?.stages[stagedProgress.stages.length - 1]
                ?.threshold &&
            stagedProgress?.totalClaimableXP === 0
        )
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

  // Consistent secondary (navigation / action) button styling used in the
  // unified footer action row.
  const getSecondaryButtonClasses = () => {
    const base =
      'w-full sm:flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center'
    return variant === 'weekly'
      ? `${base} bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white`
      : `${base} bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white`
  }

  // Base classes for different error button types
  const getBaseErrorButtonClasses = useCallback((type: string) => {
    const baseClasses =
      'w-full sm:w-auto sm:min-w-[120px] md:min-w-[130px] bg-gradient-to-r text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl text-sm transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center'

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
  const QuestIcon = quest.icon

  // ---- Unified, consistent display values (shared by every quest type) ----
  const isStaged = quest.verifier.type === 'staged'
  const metricFmt = quest.verifier.metricFormatting

  // Reward shown in the header badge: staged shows the next stage reward,
  // single shows its fixed reward.
  const rewardAmount = isStaged
    ? stagedProgress?.nextStageXP ??
      Number(
        stagedProgress?.stages?.[stagedProgress.stages.length - 1]?.xpAmount ??
          0
      )
    : xpAmount

  // Amount currently claimable.
  const claimAmount = isStaged
    ? stagedProgress?.totalClaimableXP ?? 0
    : xpAmount

  // Only show "Claim" when the user genuinely has something to claim:
  //  - staged: the contract reports claimable XP from thresholds they crossed
  //  - single: they actually meet the requirement (metric >= 1)
  const canClaim =
    !isCompleted &&
    !needsGitHubLink &&
    (isStaged
      ? (stagedProgress?.totalClaimableXP ?? 0) > 0
      : singleQuestEligible === true)

  // Progress is unified: staged quests show real progress toward the relevant
  // threshold, single quests show a simple binary (0% / 100%) bar so every
  // card has the same visual structure. For staged quests with claimable XP,
  // `getProgressThreshold` targets the COMPLETED-but-unclaimed stage so the bar
  // shows e.g. 5 / 5 (100%) until the user claims, then advances to 5 / 10.
  const singleQuestDone = isCompleted || singleQuestEligible === true
  const hasClaimableStage =
    isStaged && (stagedProgress?.totalClaimableXP ?? 0) > 0
  const progressTargetRaw = isStaged
    ? Number(getProgressThreshold(stagedProgress))
    : 1
  const progressTarget = Math.max(1, progressTargetRaw)
  // When a stage is completed but unclaimed, cap the numerator at the stage
  // threshold so it reads 5 / 5 rather than e.g. 7 / 5.
  const stagedDisplayMetric = hasClaimableStage
    ? Math.min(Number(userMetric), progressTargetRaw)
    : Number(userMetric)
  const progressCurrent = isStaged
    ? stagedDisplayMetric
    : singleQuestDone
    ? 1
    : 0
  const progressPct = Math.min(
    100,
    Math.max(0, Math.round((progressCurrent / progressTarget) * 100))
  )
  const progressLabelCurrent = isStaged
    ? metricFmt
      ? metricFmt(stagedDisplayMetric)
      : stagedDisplayMetric.toLocaleString()
    : isCompleted
    ? 'Complete'
    : singleQuestEligible === true
    ? 'Ready to claim'
    : singleQuestEligible === null
    ? 'Checking...'
    : 'Not started'
  const progressLabelTarget = isStaged
    ? metricFmt
      ? metricFmt(progressTargetRaw)
      : progressTargetRaw.toLocaleString()
    : ''

  return (
    <div
      className={`w-full p-4 sm:p-5 rounded-xl border transition-all duration-300 group relative overflow-hidden flex flex-col ${getContainerClasses()}`}
    >
      {/* Body: header + progress (grows to keep footer aligned across cards) */}
      <div className="flex flex-col gap-4 w-full relative z-10 min-w-0 flex-1">
        {/* Header: icon + title/description + reward badge */}
        <div className="flex items-start gap-3 w-full min-w-0">
          <div
            className={`p-2.5 rounded-xl flex-shrink-0 transition-all duration-300 ${getIconClasses()} h-10 w-10`}
          >
            <QuestIcon className="w-5 h-5" />
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3
                className={`font-semibold text-sm sm:text-base leading-tight break-words ${
                  isCompleted ? 'text-green-300' : 'text-white'
                }`}
              >
                {quest.title}
              </h3>
              {isCompleted && (
                <CheckBadgeIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
              )}
            </div>
            <p className="text-gray-400 text-xs sm:text-sm leading-snug mt-0.5 break-words">
              {quest.description}
            </p>
          </div>

          <div className="flex-shrink-0">
            <span className="inline-flex items-center text-green-300 text-xs font-semibold bg-green-500/15 px-2.5 py-1 rounded-full border border-green-400/25 whitespace-nowrap">
              {(isStaged && (isLoadingStagedProgress || !stagedProgress)) ||
              (!isStaged && isLoadingXpAmount) ? (
                <LoadingSpinner height="h-3" width="w-3" />
              ) : (
                `+${rewardAmount.toLocaleString()}`
              )}
              <span className="ml-1 hidden sm:inline">MOONEY</span>
            </span>
          </div>
        </div>

        {/* Progress (consistent across all quest types) */}
        <div className="w-full">
          {isStaged && !stagedProgress ? (
            isLoadingStagedProgress ? (
              <div className="flex items-center gap-2 text-gray-400 text-xs">
                <LoadingSpinner height="h-4" width="w-4" />
                Loading progress...
              </div>
            ) : (
              // Fetch finished without data (network/RPC hiccup). Don't sit on
              // a fake "Loading..." forever — let the user retry immediately.
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-gray-400">Couldn't load progress.</span>
                <button
                  onClick={() => fetchStagedProgress()}
                  className="text-blue-400 hover:text-blue-300 underline transition-colors flex-shrink-0"
                >
                  Retry
                </button>
              </div>
            )
          ) : (
            <div className="flex flex-col gap-1.5 w-full min-w-0">
              <div className="flex items-center justify-between text-xs gap-2">
                <span className="text-gray-300 font-medium truncate min-w-0">
                  {progressLabelCurrent}
                  {progressLabelTarget ? ` / ${progressLabelTarget}` : ''}
                </span>
                <span className="text-gray-400 font-medium flex-shrink-0">
                  {progressPct}%
                </span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${
                    isCompleted
                      ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                      : variant === 'weekly'
                      ? 'bg-gradient-to-r from-purple-500 to-purple-400'
                      : 'bg-gradient-to-r from-blue-500 to-blue-400'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer: status + actions (consistent bottom row on every card) */}
      <div className="mt-4 w-full relative z-10">
        {isPollingClaim ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-yellow-400 text-sm">
              <LoadingSpinner height="h-4" width="w-4" />
              Confirming on-chain...
            </div>
            <button
              onClick={async () => {
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
                  if (onClaimConfirmed) onClaimConfirmed()
                }
              }}
              className="text-blue-400 hover:text-blue-300 text-sm underline transition-colors"
            >
              Refresh
            </button>
          </div>
        ) : isCheckingClaimed ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <LoadingSpinner height="h-4" width="w-4" />
            Checking status...
          </div>
        ) : isCompleted ? (
          <div className="flex items-center gap-2 text-green-300 text-sm font-medium">
            <CheckBadgeIcon className="w-5 h-5 text-green-400" />
            Quest completed
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            {/* Primary action: claim */}
            {canClaim && (
              <PrivyWeb3Button
                label={`Claim +${claimAmount.toLocaleString()} $MOONEY`}
                action={async () => {
                  await claimQuest()
                }}
                isDisabled={isLoadingClaim}
                requiredChain={DEFAULT_CHAIN_V5}
                className="w-full sm:flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                noPadding
                noGradient
              />
            )}

            {/* Error-driven action (e.g. link GitHub) */}
            {getErrorButton(error || '')}

            {/* Secondary: copy referral link */}
            {quest.action &&
              quest.actionText?.includes('Copy Referral Link') &&
              citizen?.owner && (
                <button
                  onClick={quest.action}
                  className={`${getSecondaryButtonClasses()} gap-2`}
                >
                  <ClipboardDocumentIcon className="w-4 h-4 flex-shrink-0" />
                  Copy Referral Link
                </button>
              )}

            {/* Secondary: generic action */}
            {quest.action &&
              quest.actionText &&
              !quest.actionText.includes('Copy Referral Link') &&
              !needsGitHubLink && (
                <button
                  onClick={quest.action}
                  className={getSecondaryButtonClasses()}
                >
                  {quest.actionText}
                </button>
              )}

            {/* Secondary: navigation link */}
            {quest.link && quest.linkText && !needsGitHubLink && (
              <StandardButton
                className={getSecondaryButtonClasses()}
                link={
                  quest.link === 'citizenProfile'
                    ? `/citizen/${generatePrettyLinkWithId(
                        citizen?.metadata?.name ?? citizen?.name,
                        citizen?.id
                      )}`
                    : quest.link
                }
                target={
                  quest.link.startsWith('/') ||
                  quest.link === 'citizenProfile'
                    ? '_self'
                    : '_blank'
                }
              >
                {quest.linkText}
              </StandardButton>
            )}

            {/* Secondary: modal (e.g. referral) */}
            {ModalButton && (
              <ModalButton className={getSecondaryButtonClasses()} />
            )}
          </div>
        )}

        {/* Error details */}
        {!isCompleted && error && (
          <div className="mt-2 w-full">
            {error.includes('ERC20: transfer amount exceeds balance') ? (
              <div className="bg-red-500/15 border border-red-400/30 rounded-lg p-3">
                <p className="text-red-300 text-sm mb-1">
                  ⚠️ Insufficient reward pool balance.
                </p>
                <p className="text-red-200 text-xs">
                  The reward pool may be temporarily depleted. Please try again
                  later or contact support.
                </p>
              </div>
            ) : !getErrorButton(error) ? (
              <div className="bg-red-500/15 border border-red-400/30 rounded-lg p-3">
                <p className="text-red-300 text-sm">⚠️ {error}</p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
