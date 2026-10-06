import { ethers } from 'ethers'

export type CitizenshipMooneyLog = {
  amount: bigint
  /** Checkout stake only. Deposits omit this. */
  locked?: boolean
  txHash: string
  blockNumber: number
  logIndex: number
}

const pendingKey = (address: string) => `moondao.citizenshipMooney.pending.${address.toLowerCase()}`

/**
 * MOONEY still waiting to be locked. A checkout lock (Stake locked=true and the
 * Deposit in that same transaction) does not consume an earlier unlocked stake.
 * A later lock from the citizen's wallet does.
 */
export function claimableCitizenshipMooney(
  stakes: CitizenshipMooneyLog[],
  deposits: CitizenshipMooneyLog[]
): bigint {
  const lockedTxs = new Set(
    stakes.filter((stake) => stake.locked).map((stake) => stake.txHash.toLowerCase())
  )
  const events = [
    ...stakes
      .filter((stake) => !stake.locked)
      .map((stake) => ({ ...stake, kind: 'stake' as const })),
    ...deposits
      .filter((deposit) => !lockedTxs.has(deposit.txHash.toLowerCase()))
      .map((deposit) => ({ ...deposit, kind: 'deposit' as const })),
  ].sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber
    return a.logIndex - b.logIndex
  })

  let pending = BigInt(0)
  for (const event of events) {
    if (event.kind === 'stake') {
      pending += event.amount
      continue
    }
    pending = pending > event.amount ? pending - event.amount : BigInt(0)
  }
  return pending
}

export function rememberUnlockedCitizenshipMooney(address: string, amount: bigint) {
  if (typeof window === 'undefined' || amount <= BigInt(0)) return
  const key = pendingKey(address)
  const previous = readUnlockedCitizenshipMooney(address)
  window.localStorage.setItem(key, (previous + amount).toString())
}

export function readUnlockedCitizenshipMooney(address: string): bigint {
  if (typeof window === 'undefined') return BigInt(0)
  try {
    return BigInt(window.localStorage.getItem(pendingKey(address)) || '0')
  } catch {
    return BigInt(0)
  }
}

export function clearUnlockedCitizenshipMooney(address: string) {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(pendingKey(address))
}

const ceilingKey = (address: string) => `moondao.citizenshipMooney.ceiling.${address.toLowerCase()}`

/**
 * After a dashboard lock, keep the remainder and ignore a stale log read that
 * still counts MOONEY just locked. The ceiling expires so a later purchase
 * can show up once the previous deposit is indexed.
 */
export function noteCitizenshipMooneyLocked(
  address: string,
  lockedAmount: bigint,
  pendingBefore: bigint
) {
  if (typeof window === 'undefined' || lockedAmount <= BigInt(0)) return
  const next = pendingBefore > lockedAmount ? pendingBefore - lockedAmount : BigInt(0)
  if (next === BigInt(0)) window.localStorage.removeItem(pendingKey(address))
  else window.localStorage.setItem(pendingKey(address), next.toString())
  window.localStorage.setItem(
    ceilingKey(address),
    JSON.stringify({ amount: next.toString(), until: Date.now() + 120_000 })
  )
}

export function readClaimCeiling(address: string): bigint | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(ceilingKey(address))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { amount?: string; until?: number }
    if (!parsed || Date.now() >= Number(parsed.until)) {
      window.localStorage.removeItem(ceilingKey(address))
      return null
    }
    return BigInt(parsed.amount || '0')
  } catch {
    return null
  }
}

export function clearClaimCeiling(address: string) {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(ceilingKey(address))
}

/**
 * Combine the amount saved at checkout with stake and deposit logs.
 * A ceiling is the remainder just after this wallet locked, so a log read
 * that has not seen that deposit yet cannot offer the same MOONEY again.
 */
export function mergeCitizenshipMooneyClaim(input: {
  saved: bigint
  chainAmount: bigint
  chainOk: boolean
  sawStake: boolean
  balance: bigint
  ceiling: bigint | null
}): { pending: bigint; clearSaved: boolean; clearCeiling: boolean } {
  let pending = input.saved
  let clearSaved = false
  let clearCeiling = false

  if (input.chainOk) {
    if (input.chainAmount > BigInt(0)) {
      pending = input.chainAmount > input.saved ? input.chainAmount : input.saved
    } else if (input.sawStake || input.balance < input.saved) {
      clearSaved = true
      pending = BigInt(0)
    }
  }

  if (input.ceiling != null) {
    // An empty log read has not seen the stake, so it is not proof the lock landed.
    const logsCaughtUp =
      input.chainOk &&
      input.chainAmount <= input.ceiling &&
      (input.sawStake || input.chainAmount > BigInt(0))
    if (!logsCaughtUp) {
      pending = input.ceiling
      clearSaved = false
    } else {
      clearCeiling = true
      pending = input.chainAmount
      clearSaved = input.chainAmount === BigInt(0)
    }
  }

  return { pending, clearSaved, clearCeiling }
}

export function formatMooneyAmount(wei: bigint): string {
  const whole = Number(wei) / 1e18
  if (!Number.isFinite(whole)) return '0'
  if (whole >= 100) return Math.round(whole).toLocaleString()
  if (whole >= 1) return whole.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return whole.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

export function decodeStakeLog(log: {
  data: string
  topics?: string[]
  transactionHash?: string
  blockNumber?: number
  logIndex?: number
}): CitizenshipMooneyLog | null {
  const topic = log.topics?.[0]
  if (topic?.toLowerCase() !== ethers.utils.id('Stake(address,uint256,bool)').toLowerCase()) {
    return null
  }
  const decoded = ethers.utils.defaultAbiCoder.decode(['uint256', 'bool'], log.data)
  return {
    amount: BigInt(decoded[0].toString()),
    locked: Boolean(decoded[1]),
    txHash: log.transactionHash ?? '',
    blockNumber: Number(log.blockNumber ?? 0),
    logIndex: Number(log.logIndex ?? 0),
  }
}

export function decodeDepositLog(log: {
  data: string
  topics?: string[]
  transactionHash?: string
  blockNumber?: number
  logIndex?: number
}): CitizenshipMooneyLog | null {
  const topic = log.topics?.[0]
  if (
    topic?.toLowerCase() !==
    ethers.utils.id('Deposit(address,uint256,uint256,int128,uint256)').toLowerCase()
  ) {
    return null
  }
  const decoded = ethers.utils.defaultAbiCoder.decode(['uint256', 'int128', 'uint256'], log.data)
  return {
    amount: BigInt(decoded[0].toString()),
    txHash: log.transactionHash ?? '',
    blockNumber: Number(log.blockNumber ?? 0),
    logIndex: Number(log.logIndex ?? 0),
  }
}
