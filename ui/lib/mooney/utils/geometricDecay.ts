export interface GeometricDecayConfig {
  startingAmount: number
  reductionRate: number
  startingQuarter: string
  startingYear: number
  startingQuarterNumber: number
}

export interface QuarterlyDataPoint {
  quarter: string
  year: number
  quarterNumber: number
  value: number
  valueDisplay: string
  x: number
  y: number
}

export const DEFAULT_DECAY_CONFIG: GeometricDecayConfig = {
  startingAmount: 15_000_000,
  reductionRate: 0.05,
  startingQuarter: 'Q4 2022',
  startingYear: 2022,
  startingQuarterNumber: 4,
}

export function calculateGeometricDecay(
  startingAmount: number,
  reductionRate: number,
  quarterIndex: number
): number {
  return startingAmount * Math.pow(1 - reductionRate, quarterIndex)
}

export function formatQuarterLabel(
  year: number,
  quarterNumber: number
): string {
  return `Q${quarterNumber} ${year.toString().slice(-2)}`
}

export function formatValue(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }
  return value.toFixed(0)
}

export function generateQuarterlyData(
  config: GeometricDecayConfig = DEFAULT_DECAY_CONFIG,
  numQuarters: number = 7
): QuarterlyDataPoint[] {
  const data: QuarterlyDataPoint[] = []
  const startX = 35
  const endX = 315
  const xStep = (endX - startX) / (numQuarters - 1)

  const predefinedYPositions = [30, 45, 60, 75, 90, 100, 110]

  for (let i = 0; i < numQuarters; i++) {
    const value = calculateGeometricDecay(
      config.startingAmount,
      config.reductionRate,
      i
    )
    
    let currentYear = config.startingYear
    let currentQuarter = config.startingQuarterNumber
    
    for (let j = 0; j < i; j++) {
      currentQuarter++
      if (currentQuarter > 4) {
        currentQuarter = 1
        currentYear++
      }
    }

    const quarterLabel = formatQuarterLabel(currentYear, currentQuarter)
    const x = startX + i * xStep
    const y = predefinedYPositions[i] || 115

    data.push({
      quarter: quarterLabel,
      year: currentYear,
      quarterNumber: currentQuarter,
      value,
      valueDisplay: formatValue(value),
      x: Math.round(x),
      y: Math.round(y),
    })
  }

  return data
}

export function getDecayScheduleInfo() {
  return {
    startingQuarter: DEFAULT_DECAY_CONFIG.startingQuarter,
    startingAmount: DEFAULT_DECAY_CONFIG.startingAmount,
    reductionRate: DEFAULT_DECAY_CONFIG.reductionRate,
    reductionRatePercent: DEFAULT_DECAY_CONFIG.reductionRate * 100,
    scheduleType: 'Geometric Decay',
    lockPeriod: '4-year vMOONEY lock',
  }
}

