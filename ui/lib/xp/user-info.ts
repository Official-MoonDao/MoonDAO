import { Address } from 'thirdweb'
import { readContract } from 'thirdweb'
import { ThirdwebContract } from 'thirdweb'

export type UserXPInfo = {
  totalXP: bigint
  claimedVerifiers: bigint[]
}

export type XPLevelConfig = {
  thresholds: bigint[]
  levels: bigint[]
  active: boolean
}

export type ERC20RewardConfig = {
  tokenAddress: string
  conversionRate: bigint
  active: boolean
}

export type UserLevelStatus = {
  currentLevel: number
  nextLevel: number | null
  currentLevelXP: bigint
  nextLevelXP: bigint | null
  progressToNext: number
  xpForCurrentLevel: bigint
  xpForNextLevel: bigint | null
}

export type CompleteUserXPInfo = {
  xpInfo: UserXPInfo
  levelConfig: XPLevelConfig
  erc20Config: ERC20RewardConfig
  levelStatus: UserLevelStatus
}

export type AllLevelInfo = {
  thresholds: bigint[]
  levels: bigint[]
  userLevel: bigint
  currentUserXP: bigint
  nextLevel: bigint
  xpRequired: bigint
  xpProgress: bigint
}

/**
 * Get comprehensive user XP information
 */
export async function getUserXPInfo(
  xpManagerContract: ThirdwebContract,
  userAddress: Address
): Promise<UserXPInfo> {
  const [totalXP, claimedVerifiers] = await Promise.all([
    readContract({
      contract: xpManagerContract,
      method: 'getTotalXP' as any,
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
    claimedVerifiers: claimedVerifiers as bigint[],
  }
}

/**
 * Get XP level configuration
 */
export async function getXPLevelConfig(
  xpManagerContract: ThirdwebContract
): Promise<XPLevelConfig> {
  const [thresholds, levels, active] = (await readContract({
    contract: xpManagerContract,
    method: 'getXPLevels' as any,
    params: [],
  })) as [bigint[], bigint[], boolean]

  return {
    thresholds,
    levels,
    active,
  }
}

/**
 * Get ERC20 reward configuration
 */
export async function getERC20RewardConfig(
  xpManagerContract: ThirdwebContract
): Promise<ERC20RewardConfig> {
  const [tokenAddress, conversionRate, active] = (await readContract({
    contract: xpManagerContract,
    method: 'getERC20RewardConfig' as any,
    params: [],
  })) as [string, bigint, boolean]

  return {
    tokenAddress,
    conversionRate,
    active,
  }
}

/**
 * Get user's current level
 */
export async function getUserLevel(
  xpManagerContract: ThirdwebContract,
  userAddress: Address
): Promise<bigint> {
  return readContract({
    contract: xpManagerContract,
    method: 'getUserLevel' as any,
    params: [userAddress],
  }) as Promise<bigint>
}

/**
 * Get level information for a specific XP amount
 */
export async function getLevelForXP(
  xpManagerContract: ThirdwebContract,
  xpAmount: bigint
): Promise<bigint> {
  return readContract({
    contract: xpManagerContract,
    method: 'getLevelForXP' as any,
    params: [xpAmount],
  }) as Promise<bigint>
}

/**
 * Get next level information for a user
 */
export async function getNextLevelInfo(
  xpManagerContract: ThirdwebContract,
  userAddress: Address
): Promise<{ nextLevel: bigint; xpRequired: bigint; xpProgress: bigint }> {
  const [nextLevel, xpRequired, xpProgress] = (await readContract({
    contract: xpManagerContract,
    method: 'getNextLevelInfo' as any,
    params: [userAddress],
  })) as [bigint, bigint, bigint]

  return {
    nextLevel,
    xpRequired,
    xpProgress,
  }
}

/**
 * Get all level information for display purposes
 */
export async function getAllLevelInfo(
  xpManagerContract: ThirdwebContract,
  userAddress: Address
): Promise<AllLevelInfo> {
  const [
    thresholds,
    levels,
    userLevel,
    currentUserXP,
    nextLevel,
    xpRequired,
    xpProgress,
  ] = (await readContract({
    contract: xpManagerContract,
    method: 'getAllLevelInfo' as any,
    params: [userAddress],
  })) as [bigint[], bigint[], bigint, bigint, bigint, bigint, bigint]

  return {
    thresholds,
    levels,
    userLevel,
    currentUserXP,
    nextLevel,
    xpProgress,
    xpRequired,
  }
}

/**
 * Get available ERC20 rewards for a user
 */
export async function getAvailableERC20Reward(
  xpManagerContract: ThirdwebContract,
  userAddress: Address
): Promise<bigint> {
  return readContract({
    contract: xpManagerContract,
    method: 'getAvailableERC20Reward' as any,
    params: [userAddress],
  }) as Promise<bigint>
}

/**
 * Calculate user's level status using the new contract methods
 */
export async function calculateLevelStatus(
  xpManagerContract: ThirdwebContract,
  userAddress: Address
): Promise<UserLevelStatus> {
  const [userLevel, nextLevelInfo] = await Promise.all([
    getUserLevel(xpManagerContract, userAddress),
    getNextLevelInfo(xpManagerContract, userAddress),
  ])

  const currentLevel = Number(userLevel)
  const nextLevel =
    nextLevelInfo.nextLevel > 0 ? Number(nextLevelInfo.nextLevel) : null
  const currentLevelXP = nextLevelInfo.xpProgress
  const nextLevelXP =
    nextLevelInfo.xpRequired > 0 ? nextLevelInfo.xpRequired : null

  // Calculate progress to next level
  let progressToNext = 0
  if (
    nextLevel !== null &&
    nextLevelXP !== null &&
    nextLevelXP > currentLevelXP
  ) {
    // Find the current level's XP threshold (0 for level 1, or get from levelConfig)
    let currentLevelThreshold = BigInt(0) // Default for level 1

    // Calculate progress: (currentXP - currentLevelThreshold) / (nextLevelThreshold - currentLevelThreshold)
    const xpSinceCurrentLevel = currentLevelXP - currentLevelThreshold
    const xpNeededForNextLevel = nextLevelXP - currentLevelThreshold

    if (xpNeededForNextLevel > BigInt(0)) {
      progressToNext = Math.min(
        100,
        Math.max(
          0,
          Number((xpSinceCurrentLevel * BigInt(100)) / xpNeededForNextLevel)
        )
      )
    }
  } else if (currentLevel > 0 && nextLevel === null) {
    progressToNext = 100 // At max level
    console.log('DEBUG: User at max level, setting progress to 100%')
  }

  return {
    currentLevel,
    nextLevel,
    currentLevelXP,
    nextLevelXP,
    progressToNext,
    xpForCurrentLevel: currentLevelXP,
    xpForNextLevel: nextLevelXP,
  }
}

/**
 * Get complete user information including XP, levels, and ERC20 rewards
 */
export async function getCompleteUserXPInfo(
  xpManagerContract: ThirdwebContract,
  userAddress: Address
): Promise<CompleteUserXPInfo> {
  const [xpInfo, levelConfig, erc20Config, levelStatus] = await Promise.all([
    getUserXPInfo(xpManagerContract, userAddress),
    getXPLevelConfig(xpManagerContract),
    getERC20RewardConfig(xpManagerContract),
    calculateLevelStatus(xpManagerContract, userAddress),
  ])

  return {
    xpInfo,
    levelConfig,
    erc20Config,
    levelStatus,
  }
}

/**
 * Calculate available ERC20 rewards based on conversion rate
 */
export function calculateAvailableERC20Rewards(
  totalXP: bigint,
  claimedRewards: bigint,
  conversionRate: bigint
): bigint {
  const totalEarned = totalXP * conversionRate
  if (totalEarned > claimedRewards) {
    return totalEarned - claimedRewards
  }
  return BigInt(0)
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
