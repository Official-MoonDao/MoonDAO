import { CheckBadgeIcon } from '@heroicons/react/24/outline'
import { ComponentType, useMemo } from 'react'
import { useHasClaimedFromVerifier } from '@/lib/xp'
import StandardButton from '@/components/layout/StandardButton'

export type QuestIcon = ComponentType<{ className?: string }>

export type QuestItem = {
  id: string
  title: string
  description: string
  icon: QuestIcon
  type: 'on-chain' | 'off-chain'
  route?: string
  action?: string
  actionText?: string
  progress?: number
  target?: number
  verifierId?: bigint | number
  xpReward?: number
  mooneyReward?: number
}

type QuestProps = {
  quest: QuestItem
  variant?: 'onboarding' | 'weekly'
  userAddress?: `0x${string}`
}

export default function Quest({
  quest,
  variant = 'onboarding',
  userAddress,
}: QuestProps) {
  const verifierIdBigInt = useMemo(() => {
    if (typeof quest.verifierId === 'number') return BigInt(quest.verifierId)
    return quest.verifierId
  }, [quest.verifierId])

  // For OwnsCitizenNFT (verifierId 1), we can use a simple context since the verifier ignores it
  // For oracle-based verifiers, we'll skip the completion check for now since they require dynamic context
  const shouldCheckCompletion =
    quest.verifierId === 1 || quest.verifierId === BigInt(1)
  const simpleContext =
    '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}` // Simple context for OwnsCitizenNFT

  const { claimed } = useHasClaimedFromVerifier({
    user: userAddress,
    verifierId: verifierIdBigInt,
    context: shouldCheckCompletion ? simpleContext : undefined,
  })

  const isCompleted = Boolean(claimed)

  const baseContainerClasses = isCompleted
    ? 'bg-green-500/10 border-green-500/30'
    : 'bg-white/5 border-white/10 hover:border-white/20'

  const variantColor = variant === 'weekly' ? 'purple' : 'blue'

  const iconWrapperClasses = isCompleted
    ? 'bg-green-500/20'
    : variantColor === 'purple'
    ? 'bg-purple-500/20'
    : 'bg-blue-500/20'

  const iconColorClasses = isCompleted
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
                isCompleted ? 'text-green-300' : 'text-white'
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
            <span className="text-yellow-400 text-xs font-medium">
              +{quest.xpReward} XP
            </span>
            {typeof quest.mooneyReward === 'number' && (
              <span className="text-blue-400 text-xs font-medium">
                +{quest.mooneyReward} MOONEY
              </span>
            )}

            {!isCompleted && quest.action && quest.actionText && (
              <StandardButton className={ctaButtonClasses} link={quest.action}>
                {quest.actionText}
              </StandardButton>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
