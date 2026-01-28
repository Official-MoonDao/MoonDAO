import { ThirdwebContract, readContract, Address } from 'thirdweb'
import { ONBOARDING_QUEST_IDS, XP_VERIFIERS } from './config'
import XPVerifierABI from 'const/abis/XPVerifier.json'
import StagedXPVerifierABI from 'const/abis/StagedXPVerifier.json'

export type OnboardingStatus = {
  currentQuestIndex: number
  isComplete: boolean
  completedQuests: number[]
  nextQuest: any | null
}

/**
 * Check if a quest is completed based on its type
 */
export async function isQuestCompleted(
  verifierContract: ThirdwebContract,
  userAddress: Address,
  questType: string
): Promise<boolean> {
  try {
    if (questType === 'staged') {
      // For staged quests, check if user has completed at least stage 1
      const userHighestStage = await readContract({
        contract: verifierContract,
        method: 'function userHighestStage(address) view returns (uint256)',
        params: [userAddress],
      })
      return Number(userHighestStage) > 0
    } else {
      // For single quests, check if user has claimed
      const hasClaimed = await readContract({
        contract: verifierContract,
        method: 'function hasClaimed(address) view returns (bool)',
        params: [userAddress],
      })
      return hasClaimed as boolean
    }
  } catch (error) {
    console.error('Error checking quest completion:', error)
    return false
  }
}

/**
 * Get the current onboarding status for a user
 */
export async function getOnboardingStatus(
  userAddress: Address,
  selectedChain: any,
  getContract: (verifierAddress: string, type: string) => ThirdwebContract
): Promise<OnboardingStatus> {
  const completedQuests: number[] = []
  let currentQuestIndex = 0

  // Check each onboarding quest in order
  for (let i = 0; i < ONBOARDING_QUEST_IDS.length; i++) {
    const questId = ONBOARDING_QUEST_IDS[i]
    const quest = XP_VERIFIERS.find((v) => v.verifierId === questId)

    if (!quest) continue

    const verifierContract = getContract(
      quest.verifierAddress,
      quest.type || 'single'
    )

    const isCompleted = await isQuestCompleted(
      verifierContract,
      userAddress,
      quest.type || 'single'
    )

    if (isCompleted) {
      completedQuests.push(questId)
      currentQuestIndex = i + 1
    } else {
      // Stop at the first incomplete quest
      break
    }
  }

  const isComplete = currentQuestIndex >= ONBOARDING_QUEST_IDS.length
  const nextQuestId = isComplete
    ? null
    : ONBOARDING_QUEST_IDS[currentQuestIndex]
  const nextQuest = nextQuestId
    ? XP_VERIFIERS.find((v) => v.verifierId === nextQuestId)
    : null

  return {
    currentQuestIndex,
    isComplete,
    completedQuests,
    nextQuest,
  }
}

/**
 * Get quests organized by category with lock status
 */
export function getOrganizedQuests(onboardingStatus: OnboardingStatus) {
  const onboardingQuests = ONBOARDING_QUEST_IDS.map((id, index) => {
    const quest = XP_VERIFIERS.find((v) => v.verifierId === id)
    return {
      ...quest,
      isLocked: index > onboardingStatus.currentQuestIndex,
      isCompleted: onboardingStatus.completedQuests.includes(id),
      isCurrent: index === onboardingStatus.currentQuestIndex,
    }
  })

  const advancedQuests = XP_VERIFIERS.filter(
    (v) => v.category === 'advanced'
  ).map((quest) => ({
    ...quest,
    isLocked: !onboardingStatus.isComplete,
    isCompleted: false,
    isCurrent: false,
  }))

  return {
    onboarding: onboardingQuests,
    advanced: advancedQuests,
  }
}

/**
 * Get the featured quest (for dashboard when onboarding is complete)
 */
export function getFeaturedQuest() {
  // Return "Votes" as the featured quest
  return XP_VERIFIERS.find((v) => v.verifierId === 1)
}
