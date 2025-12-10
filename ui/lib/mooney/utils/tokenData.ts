export interface TokenDistributionSegment {
  name: string
  value: number
  color: string
  amount: number
  description: string
}

export const TOKEN_DISTRIBUTION_DATA: TokenDistributionSegment[] = [
  {
    name: 'Circulating',
    value: 29.85,
    color: '#EF4444',
    amount: 727.19,
    description:
      'Tokens currently in circulation and available for trading on exchanges.',
  },
  {
    name: 'Locked',
    value: 18.97,
    color: '#F59E0B',
    amount: 462.13,
    description:
      'Tokens locked by users for governance voting power(vMOONEY).',
  },
  {
    name: 'Liquidity',
    value: 18.76,
    color: '#8B5CF6',
    amount: 457.25,
    description:
      'Tokens provided to liquidity pools on decentralized exchanges.',
  },
  {
    name: 'Projects System',
    value: 16.70,
    color: '#10B981',
    amount: 407.41,
    description:
      "Tokens reserved for quarterly rewards for projects that contribute to MoonDAO's mission.",
  },
  {
    name: 'DAO Treasury',
    value: 15.72,
    color: '#3B82F6',
    amount: 383.1,
    description:
      'Unallocated tokens released through governace for operational expenses and project funding.',
  },
]

export const TOTAL_SUPPLY = 2.53 // in billions
export const TOTAL_SUPPLY_DISPLAY = '2.53B'

export const DISTRIBUTION_LAST_UPDATED = 'July 7th 2025'

