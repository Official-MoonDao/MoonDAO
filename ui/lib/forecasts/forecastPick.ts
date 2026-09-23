import { FORECAST_COPY } from '@/lib/forecasts/forecastCopy'

export type TapPlan =
  | { action: 'write'; index: number }
  | { action: 'ignore'; reason: 'locked' | 'writing' | 'already-saved' }
  | { action: 'connect' }
  | { action: 'need-citizen' }

export type TapInput = {
  index: number
  savedPick: number | null
  writing: boolean
  connected: boolean
  isCitizen: boolean
  locked: boolean
}

/** First match wins: locked, writing, disconnected, not a Citizen, already saved, write. */
export function tapPlan(input: TapInput): TapPlan {
  if (input.locked) return { action: 'ignore', reason: 'locked' }
  if (input.writing) return { action: 'ignore', reason: 'writing' }
  if (!input.connected) return { action: 'connect' }
  if (!input.isCitizen) return { action: 'need-citizen' }
  if (input.savedPick === input.index) return { action: 'ignore', reason: 'already-saved' }
  return { action: 'write', index: input.index }
}

export type UndoPlan =
  | { action: 'write'; index: number }
  | { action: 'clear' }
  | { action: 'ignore'; reason: 'locked' | 'writing' | 'nothing-to-undo' }

export type UndoInput = {
  savedPick: number | null
  previousPick: number | null
  writing: boolean
  locked: boolean
}

export function undoPlan(input: UndoInput): UndoPlan {
  if (input.locked) return { action: 'ignore', reason: 'locked' }
  if (input.writing) return { action: 'ignore', reason: 'writing' }
  if (input.savedPick == null) return { action: 'ignore', reason: 'nothing-to-undo' }
  if (input.previousPick != null && input.previousPick !== input.savedPick) {
    return { action: 'write', index: input.previousPick }
  }
  return { action: 'clear' }
}

export function canUndo(input: {
  savedPick: number | null
  writing: boolean
  locked: boolean
}): boolean {
  return input.savedPick != null && !input.writing && !input.locked
}

export function pickLabel(input: { picked: boolean; saved: boolean }): string {
  if (input.saved) return FORECAST_COPY.predicted
  if (input.picked) return 'Predicting…'
  return FORECAST_COPY.predictThis
}

/** One outcome carries the whole prediction. A pick is a single index, not a spread. */
export function allocationForPick(picked: number | null, n: number): number[] {
  const out = Array.from({ length: n }, () => 0)
  if (picked == null || picked < 0 || picked >= n) return out
  out[picked] = 100
  return out
}

export function pickFromAllocation(allocation: readonly number[]): number | null {
  let best = -1
  for (let i = 0; i < allocation.length; i++) {
    if ((allocation[i] ?? 0) > (allocation[best] ?? 0)) best = i
  }
  return best >= 0 && (allocation[best] ?? 0) > 0 ? best : null
}
