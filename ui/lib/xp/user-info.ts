import { Address } from 'thirdweb'
import { readContract } from 'thirdweb'
import { ThirdwebContract } from 'thirdweb'

export type UserXPInfo = {
  totalXP: bigint
  highestThresholdReached: bigint
  availableRewards: bigint
  claimedVerifierCount: bigint
  claimedVerifiers: bigint[]
}

export type ThresholdInfo = {
  tokenAddress: string
  thresholds: bigint[]
  rewardAmounts: bigint[]
  active: boolean
}

export type UserThresholdStatus = {
  currentThreshold: number // Index of current threshold (-1 if below first threshold)
  nextThreshold: number // Index of next threshold (-1 if at max)
  currentThresholdXP: bigint // XP amount of current threshold (0 if below first)
  nextThresholdXP: bigint // XP amount of next threshold (0 if at max)
  progressToNext: number // Percentage progress to next threshold (0-100)
  nextRewardAmount: bigint // Reward amount for next threshold
}

export type CompleteUserInfo = {
  xpInfo: UserXPInfo
  thresholdConfig: ThresholdInfo
  thresholdStatus: UserThresholdStatus
}

/**
 * Get comprehensive user XP information
 */
export async function getUserXPInfo(
  xpManagerContract: ThirdwebContract,
  userAddress: Address
): Promise<UserXPInfo> {
  const [
    totalXP,
    highestThresholdReached,
    availableRewards,
    claimedVerifierCount,
    claimedVerifiers,
  ] = await Promise.all([
    readContract({
      contract: xpManagerContract,
      method: 'getTotalXP' as any,
      params: [userAddress],
    }),

    readContract({
      contract: xpManagerContract,
      method: 'highestThresholdReached' as any,
      params: [userAddress],
    }),

    readContract({
      contract: xpManagerContract,
      method: 'getAvailableERC20Reward' as any,
      params: [userAddress],
    }),

    readContract({
      contract: xpManagerContract,
      method: 'getClaimedVerifierCount' as any,
      params: [userAddress],
    }),

    readContract({
      contract: xpManagerContract,
      method: 'getClaimedVerifiers' as any,
      params: [userAddress],
    }),
  ])

  return {
    totalXP: totalXP as bigint,
    highestThresholdReached: highestThresholdReached as bigint,
    availableRewards: availableRewards as bigint,
    claimedVerifierCount: claimedVerifierCount as bigint,
    claimedVerifiers: claimedVerifiers as bigint[],
  }
}

/**
 * Get threshold configuration
 */
export async function getThresholdConfig(
  xpManagerContract: ThirdwebContract
): Promise<ThresholdInfo> {
  const [tokenAddress, thresholds, rewardAmounts, active] = (await readContract(
    {
      contract: xpManagerContract,
      method: 'getERC20RewardConfig' as any,
      params: [],
    }
  )) as [string, bigint[], bigint[], boolean]

  return {
    tokenAddress,
    thresholds,
    rewardAmounts,
    active,
  }
}

/**
 * Calculate user's threshold status
 */
export function calculateThresholdStatus(
  userXP: bigint,
  thresholds: bigint[],
  rewardAmounts: bigint[]
): UserThresholdStatus {
  if (thresholds.length === 0) {
    return {
      currentThreshold: -1,
      nextThreshold: -1,
      currentThresholdXP: BigInt(0),
      nextThresholdXP: BigInt(0),
      progressToNext: 0,
      nextRewardAmount: BigInt(0),
    }
  }

  // Find current threshold
  let currentThreshold = -1
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (userXP >= thresholds[i]) {
      currentThreshold = i
      break
    }
  }

  // Find next threshold
  const nextThreshold =
    currentThreshold + 1 < thresholds.length ? currentThreshold + 1 : -1

  // Calculate values
  const currentThresholdXP =
    currentThreshold >= 0 ? thresholds[currentThreshold] : BigInt(0)
  const nextThresholdXP =
    nextThreshold >= 0 ? thresholds[nextThreshold] : BigInt(0)
  const nextRewardAmount =
    nextThreshold >= 0 ? rewardAmounts[nextThreshold] : BigInt(0)

  // Calculate progress to next threshold
  let progressToNext = 0
  if (nextThreshold >= 0) {
    const currentBase =
      currentThreshold >= 0 ? thresholds[currentThreshold] : BigInt(0)
    const nextTarget = thresholds[nextThreshold]
    const userProgress = userXP - currentBase
    const totalNeeded = nextTarget - currentBase

    if (totalNeeded > BigInt(0)) {
      progressToNext = Math.min(
        100,
        Number((userProgress * BigInt(100)) / totalNeeded)
      )
    }
  } else if (currentThreshold >= 0) {
    progressToNext = 100 // At max threshold
  }

  return {
    currentThreshold,
    nextThreshold,
    currentThresholdXP,
    nextThresholdXP,
    progressToNext,
    nextRewardAmount,
  }
}

/**
 * Get complete user information including XP, thresholds, and status
 */
export async function getCompleteUserInfo(
  xpManagerContract: ThirdwebContract,
  userAddress: Address
): Promise<CompleteUserInfo> {
  const [xpInfo, thresholdConfig] = await Promise.all([
    getUserXPInfo(xpManagerContract, userAddress),
    getThresholdConfig(xpManagerContract),
  ])

  const thresholdStatus = calculateThresholdStatus(
    xpInfo.totalXP,
    thresholdConfig.thresholds,
    thresholdConfig.rewardAmounts
  )

  return {
    xpInfo,
    thresholdConfig,
    thresholdStatus,
  }
}

/**
 * Check if user has claimed from a specific verifier
 */
export async function hasUserClaimedFromVerifier(
  xpManagerContract: ThirdwebContract,
  userAddress: Address,
  verifierId: bigint
): Promise<boolean> {
  return readContract({
    contract: xpManagerContract,
    method: 'hasClaimedFromVerifier' as any,
    params: [userAddress, verifierId],
  }) as Promise<boolean>
}

/**
 * Helper to format XP numbers for display
 */
export function formatXP(xp: bigint): string {
  return xp.toLocaleString()
}

/**
 * Helper to format reward amounts for display
 */
export function formatReward(amount: bigint, decimals: number = 18): string {
  const divisor = BigInt(10 ** decimals)
  const wholePart = amount / divisor
  const fractionalPart = amount % divisor

  if (fractionalPart === BigInt(0)) {
    return wholePart.toLocaleString()
  }

  // Show up to 2 decimal places for non-zero fractional parts
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0')
  const trimmed = fractionalStr.replace(/0+$/, '').slice(0, 2)

  return `${wholePart.toLocaleString()}${trimmed ? '.' + trimmed : ''}`
}
