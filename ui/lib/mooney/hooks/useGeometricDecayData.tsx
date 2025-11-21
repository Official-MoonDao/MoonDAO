import { useMemo } from 'react'
import {
  generateQuarterlyData,
  getDecayScheduleInfo,
  GeometricDecayConfig,
  QuarterlyDataPoint,
} from '../utils/geometricDecay'

export interface UseGeometricDecayDataReturn {
  quarterlyData: QuarterlyDataPoint[]
  scheduleInfo: ReturnType<typeof getDecayScheduleInfo>
}

export function useGeometricDecayData(
  config?: Partial<GeometricDecayConfig>,
  numQuarters: number = 7
): UseGeometricDecayDataReturn {
  const quarterlyData = useMemo(() => {
    return generateQuarterlyData(config as GeometricDecayConfig, numQuarters)
  }, [config, numQuarters])

  const scheduleInfo = useMemo(() => {
    return getDecayScheduleInfo()
  }, [])

  return {
    quarterlyData,
    scheduleInfo,
  }
}

