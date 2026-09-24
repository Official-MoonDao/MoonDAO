import { createContext } from 'react'

/** What the prediction window's single button should do once a bet amount is set. */
export type BetPrimaryAction = {
  kind: 'fund' | 'place'
  label: string
  disabled: boolean
}

export type BetPrimaryActionApi = {
  report: (action: BetPrimaryAction | null) => void
  setRun: (run: () => void) => void
}

export const BetPrimaryActionContext = createContext<BetPrimaryActionApi | null>(null)

export function predictionActionLabel(args: {
  writing: boolean
  saved: boolean
  bet: BetPrimaryAction | null
}): string {
  if (args.bet?.kind === 'fund') return 'Add funds to your wallet'
  if (args.bet?.kind === 'place') return args.bet.label
  if (args.writing) return 'Predicting…'
  if (args.saved) return 'Predicted'
  return 'Predict'
}
