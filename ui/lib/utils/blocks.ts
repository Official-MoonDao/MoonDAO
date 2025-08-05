export const getBlocksInTimeframe = (chain: any, minutes: number): number => {
  // Block times in seconds for different chains
  const blockTimes: { [key: string]: number } = {
    arbitrum: 4, // ~4 seconds per block
    'arbitrum-sepolia': 4,
    sepolia: 12, // ~12 seconds per block
    ethereum: 12, // ~12 seconds per block
  }

  const chainName = chain.name?.toLowerCase() || 'arbitrum'
  const blockTime = blockTimes[chainName] || 4 // Default to Arbitrum timing

  return Math.floor((minutes * 60) / blockTime)
}
