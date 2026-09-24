export type CitizenProbeStatus = 'citizen' | 'none' | 'expired' | 'error'

export type CitizenProbe = {
  status: CitizenProbeStatus
  tokenId?: string
}

/**
 * A forecast is signed by the active wallet, and consensus only counts that
 * address. Another connected wallet can hold the Citizen; that is not "mint
 * one," and a failed read is not "you have no Citizen."
 */
export function classifyCitizenProbes(input: {
  active: CitizenProbeStatus
  others: readonly { address: string; status: CitizenProbeStatus }[]
}): {
  isCitizen: boolean
  lookupFailed: boolean
  expired: boolean
  linkedCitizenAddress?: string
} {
  if (input.active === 'citizen') {
    return { isCitizen: true, lookupFailed: false, expired: false }
  }

  const linked = input.others.find((row) => row.status === 'citizen' && row.address)
  if (linked) {
    return {
      isCitizen: false,
      lookupFailed: false,
      expired: false,
      linkedCitizenAddress: linked.address,
    }
  }

  const expiredLinked = input.others.find((row) => row.status === 'expired' && row.address)
  // The active wallet is the only one that can sign. A failed read there is
  // not "another wallet lapsed" — the user needs a retry.
  if (input.active === 'expired' || (expiredLinked && input.active !== 'error')) {
    return {
      isCitizen: false,
      lookupFailed: false,
      expired: true,
      ...(input.active !== 'expired' && expiredLinked
        ? { linkedCitizenAddress: expiredLinked.address }
        : {}),
    }
  }

  const failed = input.active === 'error' || input.others.some((row) => row.status === 'error')
  return {
    isCitizen: false,
    lookupFailed: failed,
    expired: false,
  }
}

function errorText(err: unknown, depth = 0): string {
  if (!err || typeof err !== 'object' || depth > 4) return ''
  const value = err as {
    reason?: unknown
    shortMessage?: unknown
    message?: unknown
    cause?: unknown
  }
  return [value.reason, value.shortMessage, value.message, errorText(value.cause, depth + 1)]
    .filter((part) => typeof part === 'string' && part)
    .join(' ')
}

export function isNoTokenOwnedError(err: unknown): boolean {
  return /No token owned/i.test(errorText(err))
}
