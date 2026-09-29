/** Arbitrum One. The live DePrizeMint there is the pre-permit router. */
export const ARBITRUM_ONE_CHAIN_ID = 42161

/**
 * Arbitrum One's deployed mint exposes
 * `bet(uint256,uint256,uint256,uint256)` and does not check a CompliancePermit.
 * Sepolia's mint takes the permit deadline and signature as the last two args.
 */
export function arbitrumMintUsesLegacyBet(chainId: number): boolean {
  return chainId === ARBITRUM_ONE_CHAIN_ID
}

/** ABI fragment for the Arbitrum One mint. Do not use this on Sepolia. */
export const LEGACY_MINT_BET_ABI = [
  {
    type: 'function',
    name: 'bet',
    stateMutability: 'payable',
    inputs: [
      { name: 'deprizeId', type: 'uint256' },
      { name: 'outcomeIndex', type: 'uint256' },
      { name: 'outcomeTokenAmount', type: 'uint256' },
      { name: 'maxCost', type: 'uint256' },
    ],
    outputs: [],
  },
] as const
