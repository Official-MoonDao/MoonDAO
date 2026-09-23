export type RowAction = {
  kind: 'bet' | 'predict'
  role: 'primary' | 'secondary'
  enabled: boolean
  reason?: 'locked' | 'need-citizen'
}

export function rowActions(input: {
  restricted: boolean
  bettingOpen: boolean
  locked: boolean
  isCitizen: boolean
  connected: boolean
}): RowAction[] {
  const predict: RowAction = {
    kind: 'predict',
    role: 'primary',
    enabled: true,
  }
  if (input.locked) {
    predict.enabled = false
    predict.reason = 'locked'
  } else if (input.connected && !input.isCitizen) {
    predict.enabled = false
    predict.reason = 'need-citizen'
  }

  if (input.bettingOpen && !input.restricted) {
    predict.role = 'secondary'
    return [{ kind: 'bet', role: 'primary', enabled: true }, predict]
  }
  return [predict]
}
