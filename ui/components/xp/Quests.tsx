import {
  TrophyIcon,
  StarIcon,
  ArrowRightIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline'
import XPManagerABI from 'const/abis/XPManager.json'
import XPVerifierABI from 'const/abis/XPVerifier.json'
import StagedXPVerifierABI from 'const/abis/StagedXPVerifier.json'
import { XP_MANAGER_ADDRESSES } from 'const/config'
import Link from 'next/link'
import { useCallback, useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Address } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useXPVerifiers } from '@/lib/xp/config'
import {
  getCompleteUserXPInfo,
  formatXP,
  calculateAvailableERC20Rewards,
  type CompleteUserXPInfo,
} from '@/lib/xp/user-info'
import { getOnboardingStatus, getOrganizedQuests, type OnboardingStatus } from '@/lib/xp/onboarding'
import Quest from '@/components/xp/Quest'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'

type QuestsProps = {}

export default function Quests({}: QuestsProps) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const account = useActiveAccount()
  const userAddress = account?.address as Address
  const [userInfo, setUserInfo] = useState<CompleteUserXPInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null)
  const xpVerifiers = useXPVerifiers()

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

  const fetchUserData = useCallback(async () => {
    if (!userAddress || !xpManagerContract) {
      return
    }

    setIsLoading(true)
    try {
      const completeInfo = await getCompleteUserXPInfo(
        xpManagerContract,
        userAddress
      )
      setUserInfo(completeInfo)

      // Also fetch onboarding status
      const status = await getOnboardingStatus(
        userAddress,
        selectedChain,
        getContractForVerifier
      )
      setOnboardingStatus(status)
    } catch (error) {
      console.error('Error fetching user XP info:', error)
    } finally {
      setIsLoading(false)
    }
  }, [userAddress, xpManagerContract, selectedChain, getContractForVerifier])

  useEffect(() => {
    fetchUserData()
  }, [fetchUserData, xpManagerContract, userAddress])

  // Callback to refresh user data when a quest is claimed
  const handleQuestClaimConfirmed = useCallback(() => {
    fetchUserData()
  }, [fetchUserData])

  // Computed values from userInfo
  const currentXP = userInfo ? Number(userInfo.xpInfo.totalXP) : 0
  const currentLevel = userInfo?.levelStatus.currentLevel || 0
  const nextLevel = userInfo?.levelStatus.nextLevel
  const progressToNext = userInfo?.levelStatus.progressToNext || 0
  const nextLevelXP = userInfo?.levelStatus.nextLevelXP

  // Calculate available ERC20 rewards
  const availableRewards =
    userInfo && userInfo.erc20Config.active
      ? calculateAvailableERC20Rewards(
          userInfo.xpInfo.totalXP,
          BigInt(0),
          userInfo.erc20Config.conversionRate
        )
      : BigInt(0)

  // Format conversion rate for display
  const conversionRateDisplay = userInfo?.erc20Config.active
    ? Number(userInfo.erc20Config.conversionRate) / 1e18
    : 0

  // Get organized quests
  const organizedQuests = onboardingStatus 
    ? getOrganizedQuests(onboardingStatus) 
    : { onboarding: [], advanced: [] }

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-white text-lg flex items-center gap-2">
            <TrophyIcon className="w-5 h-5 text-yellow-400" />
            Quests
          </h3>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner height="h-8" width="w-8" />
        </div>
      ) : (
        <div className="w-full space-y-8">
          {/* Onboarding Quest Flow */}
          <div>
            <h4 className="text-white font-semibold text-md mb-4 flex items-center gap-2">
              <StarIcon className="w-5 h-5 text-blue-400" />
              Onboarding Path
            </h4>
            <div className="space-y-4">
              {organizedQuests.onboarding.map((quest: any, index: number) => (
                <div key={`onboarding-${quest.verifierId}`} className="relative">
                  {/* Quest Card with lock overlay */}
                  <div className={`relative transition-all duration-300 ${
                    quest.isLocked ? 'opacity-40' : 'opacity-100'
                  }`}>
                    <Quest
                      selectedChain={selectedChain}
                      quest={{
                        verifier: quest,
                        title: quest.title,
                        description: quest.description,
                        icon: quest.icon,
                        link: quest.link,
                        linkText: quest.linkText,
                        action: quest.action,
                        actionText: quest.actionText,
                        modalButton: quest.modalButton,
                      }}
                      variant="onboarding"
                      userAddress={userAddress}
                      xpManagerContract={xpManagerContract}
                      onClaimConfirmed={handleQuestClaimConfirmed}
                      isLocked={quest.isLocked}
                    />
                    
                    {/* Blur overlay for locked quests */}
                    {quest.isLocked && (
                      <div className="absolute inset-0 backdrop-blur-sm bg-black/20 rounded-2xl flex items-center justify-center pointer-events-none z-10">
                        <div className="text-center">
                          <LockClosedIcon className="w-8 h-8 text-white/60 mx-auto mb-2" />
                          <p className="text-white/80 text-sm font-medium">
                            Complete previous quest to unlock
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Arrow connector between quests */}
                  {index < organizedQuests.onboarding.length - 1 && (
                    <div className="flex justify-center my-3">
                      <ArrowRightIcon className={`w-6 h-6 rotate-90 transition-colors ${
                        quest.isCompleted ? 'text-green-400' : 'text-gray-500'
                      }`} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Advanced Quests - Only show if onboarding is complete */}
          {onboardingStatus?.isComplete && organizedQuests.advanced.length > 0 && (
            <div>
              <div className="border-t border-white/10 pt-6 mb-4"></div>
              <h4 className="text-white font-semibold text-md mb-4 flex items-center gap-2">
                <TrophyIcon className="w-5 h-5 text-yellow-400" />
                Advanced Quests
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {organizedQuests.advanced.map((quest: any) => (
                  <Quest
                    key={`advanced-${quest.verifierId}`}
                    selectedChain={selectedChain}
                    quest={{
                      verifier: quest,
                      title: quest.title,
                      description: quest.description,
                      icon: quest.icon,
                      link: quest.link,
                      linkText: quest.linkText,
                      action: quest.action,
                      actionText: quest.actionText,
                      modalButton: quest.modalButton,
                    }}
                    variant="onboarding"
                    userAddress={userAddress}
                    xpManagerContract={xpManagerContract}
                    onClaimConfirmed={handleQuestClaimConfirmed}
                  />
                ))}
              </div>
            </div>
          )}

          {!onboardingStatus?.isComplete && (
            <div className="text-center py-6 border-t border-white/10">
              <p className="text-slate-400 text-sm">
                Complete the onboarding path to unlock advanced quests!
              </p>
            </div>
          )}
        </div>
      )}

      <p className="w-full text-center text-sm text-slate-300 mt-6 pt-4 border-t border-white/10">
        {'By proceeding with claiming quests you agree to the '}
        <Link
          href="/terms-of-service"
          className="text-blue-500 hover:text-blue-400 hover:underline transition-colors"
        >
          {'Terms of Service.'}
        </Link>
      </p>
    </div>
  )
}
