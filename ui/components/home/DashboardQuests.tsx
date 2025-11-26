import {
  TrophyIcon,
} from '@heroicons/react/24/outline'
import XPManagerABI from 'const/abis/XPManager.json'
import { XP_MANAGER_ADDRESSES } from 'const/config'
import Link from 'next/link'
import { useCallback, useContext, useEffect, useState } from 'react'
import { Address } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useXPVerifiers } from '@/lib/xp/config'
import Quest from '@/components/xp/Quest'

type DashboardQuestsProps = {
  selectedChain: any
}

export default function DashboardQuests({ selectedChain }: DashboardQuestsProps) {
  const chainSlug = getChainSlug(selectedChain)
  const account = useActiveAccount()
  const userAddress = account?.address as Address
  const xpVerifiers = useXPVerifiers()

  const xpManagerContract = useContract({
    address: XP_MANAGER_ADDRESSES[chainSlug],
    abi: XPManagerABI,
    chain: selectedChain,
  })

  // Callback to refresh when a quest is claimed
  const handleQuestClaimConfirmed = useCallback(() => {
    // Could add refresh logic here if needed
  }, [])

  // Show only first 4 quests for compact display
  const displayedQuests = xpVerifiers.slice(0, 4)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
      
      {xpVerifiers.length > 4 && (
        <div className="text-center pt-2">
          <Link
            href="/quests"
            className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
          >
            View all quests →
          </Link>
        </div>
      )}
      
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
