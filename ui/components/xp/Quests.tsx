import {
  TrophyIcon,
  StarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline'
import XPManagerABI from 'const/abis/XPManager.json'
import { XP_MANAGER_ADDRESSES } from 'const/config'
import { useCallback, useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Address } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { XP_VERIFIERS } from '@/lib/xp/config'
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
  const [isExpanded, setIsExpanded] = useState(false)

  const xpManagerContract = useContract({
    address: XP_MANAGER_ADDRESSES[chainSlug],
    abi: XPManagerABI,
    chain: selectedChain,
  })

  const fetchUserData = useCallback(async () => {
    if (!userAddress || !xpManagerContract) {
      console.log('fetchUserData: missing required data', {
        userAddress,
        xpManagerContract: !!xpManagerContract,
      })
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
          userInfo.xpInfo.claimedERC20Rewards,
          userInfo.erc20Config.conversionRate
        )
      : BigInt(0)

  // Format conversion rate for display
  const conversionRateDisplay = userInfo?.erc20Config.active
    ? Number(userInfo.erc20Config.conversionRate) / 1e18
    : 0

  // Get quests to display based on expanded state
  const displayedQuests = isExpanded ? XP_VERIFIERS : XP_VERIFIERS.slice(0, 4)
  const hasMoreQuests = XP_VERIFIERS.length > 4

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-white text-lg flex items-center gap-2">
            <TrophyIcon className="w-5 h-5 text-yellow-400" />
            Quest Progress
          </h3>
          <div className="flex items-center gap-1 text-yellow-400 text-xs font-medium bg-yellow-400/20 px-2 py-1 rounded-full">
            <StarIcon className="w-3 h-3" />
            Level {currentLevel}
          </div>
        </div>

        <div className="flex items-center flex-col md:flex-row gap-2">
          <div className="flex items-center gap-3 flex-col md:flex-row">
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
              <div className="text-xs text-gray-400 flex items-center gap-2">
                {isLoading ? (
                  <div className="flex items-center gap-2 text-right">
                    Loading rewards...
                  </div>
                ) : userInfo?.erc20Config.active ? (
                  availableRewards > 0 ? (
                    <span className="text-green-400 font-medium">
                      {Number(availableRewards) / 1e18} MOONEY Available!
                    </span>
                  ) : nextLevel ? (
                    <>
                      Next Level:{' '}
                      <span className="text-yellow-400 font-medium">
                        Level {nextLevel}
                      </span>
                    </>
                  ) : (
                    <span className="text-gray-500">Max level reached!</span>
                  )
                ) : (
                  <span className="text-gray-500">No rewards configured</span>
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
        </div>
      </div>

      {/* View All Button */}
      {hasMoreQuests && (
        <div className="flex justify-center mb-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600/20 to-purple-600/20 hover:from-blue-600/30 hover:to-purple-600/30 border border-blue-500/30 hover:border-blue-500/50 text-blue-300 hover:text-blue-200 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 backdrop-blur-sm"
          >
            {isExpanded ? (
              <>
                <ChevronUpIcon className="w-4 h-4" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDownIcon className="w-4 h-4" />
                View All ({XP_VERIFIERS.length} Quests)
              </>
            )}
          </button>
        </div>
      )}

      <div className="w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedQuests.map((verifier: any) => (
            <Quest
              key={verifier.verifierId}
              selectedChain={selectedChain}
              quest={{
                verifier,
                title: verifier.title,
                description: verifier.description,
                icon: verifier.icon,
                link: verifier.link,
                linkText: verifier.linkText,
              }}
              variant="onboarding"
              userAddress={userAddress}
              xpManagerContract={xpManagerContract}
              onClaimConfirmed={handleQuestClaimConfirmed}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
