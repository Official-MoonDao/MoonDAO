import { useMemo } from 'react'
import {
  TOKEN_DISTRIBUTION_DATA,
  TokenDistributionSegment,
} from '../utils/tokenData'

export interface UseTokenDistributionReturn {
  data: TokenDistributionSegment[]
  total: number
}

export function useTokenDistribution(): UseTokenDistributionReturn {
  const data = useMemo(() => TOKEN_DISTRIBUTION_DATA, [])
  
  const total = useMemo(() => {
    return data.reduce((sum, item) => sum + item.value, 0)
  }, [data])

  return {
    data,
    total,
  }
}

