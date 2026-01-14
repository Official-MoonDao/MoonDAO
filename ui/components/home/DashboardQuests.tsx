import {
  TrophyIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import XPManagerABI from 'const/abis/XPManager.json'
import XPVerifierABI from 'const/abis/XPVerifier.json'
import StagedXPVerifierABI from 'const/abis/StagedXPVerifier.json'
import { XP_MANAGER_ADDRESSES } from 'const/config'
import Link from 'next/link'
import { useCallback, useContext, useEffect, useState } from 'react'
import { Address } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useXPVerifiers } from '@/lib/xp/config'
import { getOnboardingStatus, getFeaturedQuest, type OnboardingStatus } from '@/lib/xp/onboarding'
import Quest from '@/components/xp/Quest'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'

type DashboardQuestsProps = {
  selectedChain: any
}

export default function DashboardQuests({ selectedChain }: DashboardQuestsProps) {
  const chainSlug = getChainSlug(selectedChain)
  const account = useActiveAccount()
  const userAddress = account?.address as Address
  const xpVerifiers = useXPVerifiers()
  
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const xpManagerContract = useContract({
    address: XP_MANAGER_ADDRESSES[chainSlug],
    abi: XPManagerABI,
    chain: selectedChain,
  })

  // Helper to get contract
  const getContractForVerifier = useCallback((verifierAddress: string, type: string) => {
    return {
      address: verifierAddress,
      abi: type === 'staged' ? StagedXPVerifierABI : XPVerifierABI,
      chain: selectedChain,
    } as any
  }, [selectedChain])

  // Fetch onboarding status
  useEffect(() => {
    async function fetchStatus() {
      if (!userAddress) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const status = await getOnboardingStatus(
          userAddress,
          selectedChain,
          getContractForVerifier
        )
        setOnboardingStatus(status)
      } catch (error) {
        console.error('Error fetching onboarding status:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStatus()
  }, [userAddress, selectedChain, getContractForVerifier])

  // Callback to refresh when a quest is claimed
  const handleQuestClaimConfirmed = useCallback(async () => {
    if (!userAddress) return
    
    // Refresh onboarding status
    const status = await getOnboardingStatus(
      userAddress,
      selectedChain,
      getContractForVerifier
    )
    setOnboardingStatus(status)
  }, [userAddress, selectedChain, getContractForVerifier])

  // Determine which quest to display
  const displayQuest = onboardingStatus?.isComplete 
    ? getFeaturedQuest() 
    : onboardingStatus?.nextQuest

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner height="h-6" width="w-6" />
      </div>
    )
  }

  if (!displayQuest) {
    return (
      <div className="text-center py-6 text-slate-400">
        <p>No quests available at this time.</p>
      </div>
    )
  }

  const isFeatured = onboardingStatus?.isComplete

  return (
    <div className="space-y-3">
      {isFeatured && (
        <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium mb-2">
          <SparklesIcon className="w-5 h-5" />
          Featured Quest
        </div>
      )}
      
      <Quest
        key={`verifier-${displayQuest.verifierId}-${displayQuest.verifierAddress}`}
        selectedChain={selectedChain}
        quest={{
          verifier: displayQuest,
          title: displayQuest.title,
          description: displayQuest.description,
          icon: displayQuest.icon,
          link: displayQuest.link,
          linkText: displayQuest.linkText,
          action: displayQuest.action,
          actionText: displayQuest.actionText,
          modalButton: displayQuest.modalButton,
        }}
        variant="onboarding"
        userAddress={userAddress}
        xpManagerContract={xpManagerContract}
        onClaimConfirmed={handleQuestClaimConfirmed}
      />
      
      <div className="text-center pt-2">
        <Link
          href="/quests"
          className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
        >
          View all quests →
        </Link>
      </div>
      
      <p className="text-xs text-slate-400 text-center">
        {'By claiming quests you agree to the '}
        <Link
          href="/terms-of-service"
          className="text-blue-500 hover:text-blue-400 hover:underline transition-colors"
        >
          {'Terms of Service'}
        </Link>
      </p>
    </div>
  )
}
