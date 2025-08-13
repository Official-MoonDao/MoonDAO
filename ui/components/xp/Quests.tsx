import {
  TrophyIcon,
  StarIcon,
  FireIcon,
  GiftIcon,
  CheckBadgeIcon,
  ShoppingBagIcon,
  UserGroupIcon,
  BanknotesIcon,
  BoltIcon,
} from '@heroicons/react/24/outline'
import XPManagerABI from 'const/abis/XPManager.json'
import { XP_MANAGER_ADDRESSES, XP_VERIFIERS } from 'const/config'
import { useCallback, useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Address,
  prepareContractCall,
  sendAndConfirmTransaction,
} from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import {
  getCompleteUserXPInfo,
  formatXP,
  type CompleteUserXPInfo,
} from '@/lib/xp/user-info'
import StandardButton from '@/components/layout/StandardButton'
import Quest, { type QuestItem } from '@/components/xp/Quest'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

type QuestsProps = {}

const onboardingQuests: QuestItem[] = [
  {
    title: 'Own a Citizen NFT',
    description: 'Own a Citizen NFT to get XP',
    verifier: XP_VERIFIERS[0],
    icon: BanknotesIcon,
    link: '/citizen',
    linkText: 'Get Citizen',
    type: 'on-chain',
  },
  {
    title: 'Has Voting Power',
    description: 'Stake MOONEY to get vMOONEY and voting power',
    verifier: XP_VERIFIERS[1],
    icon: BoltIcon,
    link: '/lock',
    linkText: 'Stake Now',
    type: 'off-chain',
  },
  {
    title: 'Has Voted',
    description: 'Participate in governance by voting on a proposal',
    verifier: XP_VERIFIERS[2],
    icon: CheckBadgeIcon,
    link: '/vote',
    linkText: 'Vote Now',
    type: 'off-chain',
  },
]

const weeklyQuests: QuestItem[] = [
  //   {
  //     id: 'weekly-vote',
  //     title: 'Weekly Voter',
  //     description: 'Vote on at least 3 proposals this week',
  //     xpReward: 25,
  //     mooneyReward: 50,
  //     completed: false,
  //     icon: CheckBadgeIcon,
  //     progress: 1,
  //     target: 3,
  //     action: '/governance',
  //     actionText: 'Vote',
  //   },
  //   {
  //     id: 'team-join',
  //     title: 'Join a Team',
  //     description: 'Become a member of a MoonDAO team',
  //     xpReward: 50,
  //     mooneyReward: 100,
  //     completed: false,
  //     verifierId: 5, // example placeholder if a verifier exists
  //     icon: UserGroupIcon,
  //     action: '/network',
  //     actionText: 'Browse Teams',
  //   },
  //   {
  //     id: 'marketplace-visit',
  //     title: 'Explore Marketplace',
  //     description: 'Check out items in the MoonDAO marketplace',
  //     xpReward: 15,
  //     mooneyReward: 25,
  //     completed: false,
  //     icon: ShoppingBagIcon,
  //     action: '/marketplace',
  //     actionText: 'Explore',
  //   },
]

export default function Quests({}: QuestsProps) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const account = useActiveAccount()
  const userAddress = account?.address as Address
  const [userInfo, setUserInfo] = useState<CompleteUserXPInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [onboardingCompleted, setOnboardingCompleted] = useState(0)
  const [onboardingTotal, setOnboardingTotal] = useState(0)
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false)

  const xpManagerContract = useContract({
    address: XP_MANAGER_ADDRESSES[chainSlug],
    abi: XPManagerABI,
    chain: selectedChain,
  })

  const fetchUserData = useCallback(async () => {
    if (!userAddress || !xpManagerContract) return

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
  }, [fetchUserData])

  // Callback to refresh user data when a quest is claimed
  const handleQuestClaimConfirmed = useCallback(() => {
    console.log('Quest claim confirmed, refreshing user data...')
    fetchUserData()
  }, [fetchUserData])

  // Computed values from userInfo
  const currentXP = userInfo ? Number(userInfo.xpInfo.totalXP) : 0
  const availableRewards = userInfo
    ? Number(userInfo.xpInfo.availableRewards)
    : 0

  const thresholdStatus = userInfo?.thresholdStatus
  const currentThresholdLevel = thresholdStatus
    ? thresholdStatus.currentThreshold >= 0
      ? thresholdStatus.currentThreshold + 2 // Level 2+ when threshold reached
      : 1 // Level 1 when below first threshold
    : 1
  const nextThresholdXP = thresholdStatus
    ? Number(thresholdStatus.nextThresholdXP)
    : 0
  const progressToNext = thresholdStatus ? thresholdStatus.progressToNext : 0
  const nextRewardAmount = thresholdStatus
    ? Number(thresholdStatus.nextRewardAmount)
    : 0

  const claimRewards = useCallback(async () => {
    if (!userAddress || !xpManagerContract || !account) return

    try {
      const transaction = prepareContractCall({
        contract: xpManagerContract,
        method: 'claimERC20Rewards' as string,
        params: [],
      })

      const receipt = await sendAndConfirmTransaction({
        transaction,
        account,
      })

      if (receipt) {
        toast.success('Rewards claimed successfully!')
        // Refresh user data to update available rewards and next rewards
        fetchUserData()
      } else {
        toast.error('Failed to claim rewards.')
      }
    } catch (error) {
      console.error('Error claiming rewards:', error)
      toast.error('Failed to claim rewards.')
    }
  }, [account, userAddress, xpManagerContract, fetchUserData])

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
            Level {currentThresholdLevel}
          </div>
        </div>

        <div className="flex items-center flex-col md:flex-row gap-2">
          <StandardButton
            className="text-purple-300 text-sm hover:text-purple-200 transition-all bg-purple-600/20 hover:bg-purple-600/30 px-3 py-1 rounded-lg"
            link={'/home'}
          >
            View All Quests
          </StandardButton>

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
                    {nextThresholdXP > 0 &&
                      ` / ${formatXP(BigInt(nextThresholdXP))}`}
                  </>
                )}
              </div>
              <div className="text-xs text-gray-400 flex items-center gap-2">
                {isLoading ? (
                  <div className="flex items-center gap-2 text-right">
                    Loading rewards...
                  </div>
                ) : availableRewards > 0 ? (
                  <span className="text-green-400 font-medium">
                    {availableRewards / 1e18} MOONEY Available!
                  </span>
                ) : nextRewardAmount > 0 ? (
                  <>
                    Next:{' '}
                    <span className="text-yellow-400 font-medium">
                      {nextRewardAmount / 1e18} MOONEY
                    </span>
                  </>
                ) : (
                  <span className="text-gray-500">Max threshold reached</span>
                )}
              </div>
            </div>
            <div className="w-32">
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-yellow-400 to-orange-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressToNext}%` }}
                ></div>
              </div>
            </div>
            <PrivyWeb3Button
              label="Claim MOONEY"
              action={claimRewards}
              isDisabled={availableRewards === 0 || isLoading}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-3 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              noPadding
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-white flex items-center gap-2 text-sm">
              <FireIcon className="w-4 h-4 text-orange-400" />
              Onboarding ({onboardingCompleted}/{onboardingTotal})
            </h4>
            {isOnboardingComplete && (
              <div className="flex items-center gap-1 text-green-400 text-xs font-medium bg-green-500/20 px-2 py-1 rounded-full">
                <GiftIcon className="w-3 h-3" />
                1000 MOONEY!
              </div>
            )}
          </div>

          <div className="space-y-2">
            {onboardingQuests.map((quest) => (
              <Quest
                key={quest.verifier.verifierId}
                selectedChain={selectedChain}
                quest={quest}
                variant="onboarding"
                userAddress={userAddress}
                xpManagerContract={xpManagerContract}
                onClaimConfirmed={handleQuestClaimConfirmed}
              />
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-medium text-white mb-3 flex items-center gap-2 text-sm">
            <StarIcon className="w-4 h-4 text-purple-400" />
            Weekly Quests
          </h4>

          <div className="space-y-2">
            {weeklyQuests.slice(0, 2).map((quest) => (
              <Quest
                key={quest.verifier.verifierId}
                selectedChain={selectedChain}
                quest={quest}
                variant="weekly"
                userAddress={userAddress}
                xpManagerContract={xpManagerContract}
                onClaimConfirmed={handleQuestClaimConfirmed}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
