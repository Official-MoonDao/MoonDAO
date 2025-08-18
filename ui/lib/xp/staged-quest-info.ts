import { Address, readContract } from 'thirdweb'
import { ThirdwebContract } from 'thirdweb'

export type Stage = {
  threshold: bigint
  xpAmount: bigint
  active: boolean
}

export type StagedQuestProgress = {
  stages: Stage[]
  userHighestStage: number
  currentUserMetric: number
  nextClaimableStage: number | null
  nextStageThreshold: number | null
  nextStageXP: number | null
  totalClaimableXP: number
  progressToNext: number
  isMaxStageReached: boolean
}

/**
 * Get comprehensive staged quest progress for a user
 */
export async function getStagedQuestProgress(
  verifierContract: ThirdwebContract,
  userAddress: Address,
  userMetric: number
): Promise<StagedQuestProgress> {
  const [allStages, userHighestStage, nextClaimableStage, totalClaimableXP] =
    await Promise.all([
      readContract({
        contract: verifierContract,
        method: 'getAllStages' as any,
        params: [],
      }),
      readContract({
        contract: verifierContract,
        method: 'getUserHighestStage' as any,
        params: [userAddress],
      }),
      readContract({
        contract: verifierContract,
        method: 'getNextClaimableStage' as any,
        params: [userAddress, BigInt(userMetric)],
      }),
      readContract({
        contract: verifierContract,
        method: 'calculateTotalClaimableXP' as any,
        params: [userAddress, BigInt(userMetric)],
      }),
    ])

  console.log('ALL STAGES', allStages)
  console.log('USER HIGHEST STAGE', userHighestStage)
  console.log('NEXT CLAIMABLE STAGE', nextClaimableStage)
  console.log('TOTAL CLAIMABLE XP', totalClaimableXP)

  const stages = (allStages as any[]).map((stage) => ({
    threshold: stage.threshold as bigint,
    xpAmount: stage.xpAmount as bigint,
    active: stage.active as boolean,
  }))

  const userHighestStageNum = Number(userHighestStage)
  const nextClaimableStageNum = Number(nextClaimableStage)
  const isValidNextStage =
    nextClaimableStageNum !== Number.MAX_SAFE_INTEGER &&
    nextClaimableStageNum < stages.length

  const nextStageIndex = isValidNextStage ? nextClaimableStageNum : null
  const nextStage = nextStageIndex !== null ? stages[nextStageIndex] : null

  // Calculate progress to next stage
  let progressToNext = 0
  if (nextStage && nextStageIndex !== null) {
    const currentStageThreshold =
      nextStageIndex > 0 ? Number(stages[nextStageIndex - 1].threshold) : 0
    const nextStageThreshold = Number(nextStage.threshold)

    // Use the same logic as getNextUnclamedThreshold for consistency
    const displayThreshold = getNextUnclamedThreshold({
      stages,
      currentUserMetric: userMetric,
    } as StagedQuestProgress)

    if (userMetric >= displayThreshold) {
      progressToNext = 100 // Ready to claim
    } else {
      // For voting power, show progress from 0 to target threshold
      const progress = userMetric / displayThreshold
      progressToNext = Math.min(100, Math.max(0, progress * 100))

      console.log('DEBUG - Progress details:', {
        userMetric,
        displayThreshold,
        progress,
        progressToNext,
      })
    }
  } else if (stages.length > 0 && userHighestStageNum >= stages.length - 1) {
    progressToNext = 100 // Max stage reached
  }

  const isMaxStageReached = userHighestStageNum >= stages.length - 1

  return {
    stages,
    userHighestStage: userHighestStageNum,
    currentUserMetric: userMetric,
    nextClaimableStage: nextStageIndex,
    nextStageThreshold: nextStage ? Number(nextStage.threshold) : null,
    nextStageXP: nextStage ? Number(nextStage.xpAmount) : null,
    totalClaimableXP: Number(totalClaimableXP),
    progressToNext,
    isMaxStageReached,
  }
}

/**
 * Format stage numbers for display (1-indexed)
 */
export function formatStageDisplay(stageIndex: number): string {
  return `Stage ${stageIndex + 1}`
}

/**
 * Get user's current level based on completed stages
 */
export function getCurrentLevel(userHighestStage: number): number {
  return userHighestStage + 1
}

/**
 * Get progress summary text
 */
export function getProgressSummary(progress: StagedQuestProgress): string {
  if (progress.isMaxStageReached) {
    return 'Max level reached!'
  }

  if (progress.nextClaimableStage !== null && progress.totalClaimableXP > 0) {
    return `Ready to claim ${progress.totalClaimableXP} XP!`
  }

  if (progress.nextStageThreshold !== null) {
    const remaining = progress.nextStageThreshold - progress.currentUserMetric
    return `${remaining} more needed for next level`
  }

  return 'No progress available'
}

export function getHighestQualifyingStage(
  progress: StagedQuestProgress
): number {
  const { stages, currentUserMetric } = progress

  // Find the highest stage threshold that the user's metric exceeds
  let highestQualifyingStage = 0
  for (let i = 0; i < stages.length; i++) {
    if (currentUserMetric >= Number(stages[i].threshold)) {
      highestQualifyingStage = i + 1 // +1 for display (1-indexed)
    } else {
      break
    }
  }

  // If they don't qualify for any stage yet, show stage 1 (working toward stage 0)
  return Math.max(1, highestQualifyingStage)
}

/**
 * Get the threshold for the next unclaimed/unachieved stage
 */
export function getNextUnclamedThreshold(
  progress: StagedQuestProgress
): number {
  const { stages, currentUserMetric } = progress

  // Find the first stage threshold that the user hasn't reached yet
  for (let i = 0; i < stages.length; i++) {
    if (currentUserMetric < Number(stages[i].threshold)) {
      return Number(stages[i].threshold)
    }
  }

  // If they qualify for all stages, return the highest threshold
  return stages.length > 0 ? Number(stages[stages.length - 1].threshold) : 0
}
