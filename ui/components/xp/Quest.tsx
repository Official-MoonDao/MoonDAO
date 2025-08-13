import { CheckBadgeIcon } from '@heroicons/react/24/outline'
import { getAccessToken } from '@privy-io/react-auth'
import XPVerifierABI from 'const/abis/XPVerifier.json'
import { DEFAULT_CHAIN_V5, XP_VERIFIERS } from 'const/config'
import { ComponentType, useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Chain, readContract } from 'thirdweb'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useHasClaimedFromVerifier } from '@/lib/xp'
import StandardButton from '@/components/layout/StandardButton'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

export type QuestIcon = ComponentType<{ className?: string }>

export type QuestItem = {
  verifier: any
  title: string
  description: string
  icon: QuestIcon
  type: 'on-chain' | 'off-chain'
  link?: string
  linkText?: string
}

type QuestProps = {
  selectedChain: Chain
  quest: QuestItem
  xpManagerContract: any
  variant?: 'onboarding' | 'weekly'
  userAddress?: `0x${string}`
}

export default function Quest({
  selectedChain,
  quest,
  variant = 'onboarding',
  userAddress,
  xpManagerContract,
}: QuestProps) {
  const verifierContract = useContract({
    address: quest.verifier.verifierAddress,
    abi: XPVerifierABI,
    chain: selectedChain,
  })

  const [xpAmount, setXpAmount] = useState(0)
  const [isLoadingXpAmount, setIsLoadingXpAmount] = useState(false)

  const [hasClaimed, setHasClaimed] = useState(false)
  const [isLoadingClaim, setIsLoadingClaim] = useState(false)

  const claimQuest = useCallback(async () => {
    if (!quest.verifier.route || !userAddress) return
    setIsLoadingClaim(true)
    try {
      const accessToken = await getAccessToken()
      const response = await fetch(quest.verifier.route, {
        method: 'POST',
        body: JSON.stringify({ user: userAddress, accessToken }),
      })
      const { eligable } = await response.json()
      if (eligable) {
        toast.success('Quest claimed successfully!', {
          duration: 3000,
          style: toastStyle,
        })
      } else {
        toast.error(
          'You are not eligible for this quest, please meet the requirements and try again.',
          {
            duration: 3000,
            style: toastStyle,
          }
        )
      }
    } catch (error) {
      console.error(error)
      toast.error('Something went wrong, please contact support.')
    } finally {
      setIsLoadingClaim(false)
    }
  }, [quest.verifier, userAddress])

  useEffect(() => {
    async function fetchXpAmount() {
      setIsLoadingXpAmount(true)
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
        console.log('xpAmount', xpAmount)
        setXpAmount(Number(xpAmount))
      }
      setIsLoadingXpAmount(false)
    }

    fetchXpAmount()
  }, [verifierContract, userAddress, quest.verifier.xpPerClaim])

  useEffect(() => {
    async function fetchHasClaimed() {
      if (xpManagerContract && userAddress) {
        const claimed = await readContract({
          contract: xpManagerContract,
          method: 'hasClaimedFromVerifier' as string,
          params: [userAddress, quest.verifier.verifierId],
        })
        setHasClaimed(Boolean(claimed))
      }
    }

    fetchHasClaimed()
  }, [xpManagerContract, userAddress, quest.verifier.verifierId])

  const isCompleted = Boolean(hasClaimed)

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
            <span className="text-yellow-400 text-xs font-medium flex items-center gap-2">
              +
              {isLoadingXpAmount ? (
                <LoadingSpinner height="h-4" width="w-4" />
              ) : (
                xpAmount
              )}{' '}
              XP
            </span>

            {!hasClaimed && quest.link && quest.linkText && (
              <StandardButton className={ctaButtonClasses} link={quest.link}>
                {quest.linkText}
              </StandardButton>
            )}

            {!hasClaimed && (
              <PrivyWeb3Button
                label="Claim"
                action={async () => {
                  await claimQuest()
                }}
                isDisabled={isLoadingClaim}
                requiredChain={DEFAULT_CHAIN_V5}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-3 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg text-xs"
                noPadding
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
