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

    if (userMetric >= nextStageThreshold) {
      progressToNext = 100 // Ready to claim
    } else if (nextStageThreshold > currentStageThreshold) {
      const progress =
        (userMetric - currentStageThreshold) /
        (nextStageThreshold - currentStageThreshold)
      progressToNext = Math.min(100, Math.max(0, progress * 100))
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
