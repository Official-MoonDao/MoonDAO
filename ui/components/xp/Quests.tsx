import {
  TrophyIcon,
  StarIcon,
} from '@heroicons/react/24/outline'
import XPManagerABI from 'const/abis/XPManager.json'
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
import Quest from '@/components/xp/Quest'

type QuestsProps = {}

export default function Quests({}: QuestsProps) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const account = useActiveAccount()
  const userAddress = account?.address as Address
  const [userInfo, setUserInfo] = useState<CompleteUserXPInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const xpVerifiers = useXPVerifiers()

  const xpManagerContract = useContract({
    address: XP_MANAGER_ADDRESSES[chainSlug],
    abi: XPManagerABI,
    chain: selectedChain,
  })

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
    } catch (error) {
      console.error('Error fetching user XP info:', error)
    } finally {
      setIsLoading(false)
    }
  }, [userAddress, xpManagerContract])

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

  // Display all quests
  const displayedQuests = xpVerifiers

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-white text-lg flex items-center gap-2">
            <TrophyIcon className="w-5 h-5 text-yellow-400" />
            Quests
          </h3>
        </div>

        {/* <div className="flex items-center flex-col md:flex-row gap-2">
          <div className="flex items-center gap-3 flex-col md:flex-row">
            <div className="flex items-center gap-1 text-yellow-400 text-xs font-medium bg-yellow-400/20 px-2 py-1 rounded-full">
              <StarIcon className="w-3 h-3" />
              Level {currentLevel}
            </div>
            <div className="text-right">
              <div className="text-white text-xs font-medium">
                {isLoading ? (
                  <div className="flex items-center gap-2 text-right">
                    Loading XP...
                  </div>
                ) : (
                  <>
                    {formatXP(BigInt(currentXP))} XP
                    {nextLevelXP && ` / ${formatXP(nextLevelXP)}`}
                  </>
                )}
              </div>
            </div>
            <div className="w-24">
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-yellow-400 to-orange-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressToNext}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div> */}
      </div>

      <div className="w-full mt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedQuests.map((verifier: any) => (
            <Quest
              key={`verifier-${verifier.verifierId}-${verifier.verifierAddress}`}
              selectedChain={selectedChain}
              quest={{
                verifier,
                title: verifier.title,
                description: verifier.description,
                icon: verifier.icon,
                link: verifier.link,
                linkText: verifier.linkText,
                action: verifier.action,
                actionText: verifier.actionText,
                modalButton: verifier.modalButton,
              }}
              variant="onboarding"
              userAddress={userAddress}
              xpManagerContract={xpManagerContract}
              onClaimConfirmed={handleQuestClaimConfirmed}
            />
          ))}
        </div>
        <p className="w-full text-center text-sm text-slate-300 mt-4">
          {'By proceeding with claiming quests you agree to the '}
          <Link
            href="/terms-of-service"
            className="text-blue-500 hover:text-blue-400 hover:underline transition-colors"
          >
            {'Terms of Service.'}
          </Link>
        </p>
      </div>
    </div>
  )
}
