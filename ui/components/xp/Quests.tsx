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
import { usePrivy } from '@privy-io/react-auth'
import { useMemo, useState } from 'react'
import StandardButton from '@/components/layout/StandardButton'
import Quest, { type QuestItem } from '@/components/xp/Quest'

type QuestsProps = {}

const onboardingQuests: QuestItem[] = [
  {
    id: 'owns-citizen-nft',
    title: 'Own a Citizen NFT',
    description: 'Own a Citizen NFT to get XP',
    verifierId: 1,
    icon: BanknotesIcon,
    route: '/xp/owns-citizen-nft',
    actionText: 'Get Citizen',
  },
  {
    id: 'has-voting-power',
    title: 'Has Voting Power',
    description: 'Stake MOONEY to get vMOONEY and voting power',
    verifierId: 2,
    icon: BoltIcon,
    route: '/xp/has-voting-power',
    actionText: 'Stake Now',
  },
  {
    id: 'has-voted',
    title: 'Has Voted',
    description: 'Participate in governance by voting on a proposal',
    verifierId: 3,
    icon: CheckBadgeIcon,
    route: '/xp/has-voted',
    actionText: 'Vote Now',
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
  const { user } = usePrivy()
  const userAddress = useMemo(
    () => user?.wallet?.address as `0x${string}` | undefined,
    [user]
  )
  const [userLevel, setUserLevel] = useState(1)
  const [currentXP, setCurrentXP] = useState(0)
  const [xpForNextLevel, setXpForNextLevel] = useState(0)
  const [xpProgress, setXpProgress] = useState(0)
  const [nextLevelReward, setNextLevelReward] = useState(0)
  const [onboardingCompleted, setOnboardingCompleted] = useState(0)
  const [onboardingTotal, setOnboardingTotal] = useState(0)
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false)
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
            Level {userLevel}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <StandardButton
            className="text-purple-300 text-sm hover:text-purple-200 transition-all bg-purple-600/20 hover:bg-purple-600/30 px-3 py-1 rounded-lg"
            link={'/home'}
          >
            View All Quests
          </StandardButton>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-white text-xs font-medium">
                {currentXP} / {xpForNextLevel} XP
              </div>
              <div className="text-xs text-gray-400">
                Next:{' '}
                <span className="text-yellow-400 font-medium">
                  {nextLevelReward.toLocaleString()} MOONEY
                </span>
              </div>
            </div>
            <div className="w-32">
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-yellow-400 to-orange-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${xpProgress}%` }}
                ></div>
              </div>
            </div>
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
                key={quest.id}
                quest={quest}
                variant="onboarding"
                userAddress={userAddress}
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
                key={quest.id}
                quest={quest}
                variant="weekly"
                userAddress={userAddress}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
