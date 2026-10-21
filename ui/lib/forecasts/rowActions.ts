export type RowAction = {
  kind: 'bet' | 'predict'
  role: 'primary' | 'secondary'
  enabled: boolean
  reason?: 'locked' | 'need-citizen' | 'restricted'
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
  }

  if (!input.bettingOpen) return [predict]

  // Restricted visitors still see Add ETH. It stays disabled, and the
  // prediction itself is the action they can take.
  if (input.restricted) {
    return [
      { kind: 'bet', role: 'secondary', enabled: false, reason: 'restricted' },
      predict,
    ]
  }

  predict.role = 'secondary'
  return [{ kind: 'bet', role: 'primary', enabled: true }, predict]
}
