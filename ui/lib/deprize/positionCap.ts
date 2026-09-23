import { UNIT } from './constants'

/** Generation-1 single-bet cap. GTM G7: well below the 10 ETH pilot figure. */
export const DEPRIZE_MAX_BET_WEI = UNIT

export function betExceedsCap(amountWei: bigint): boolean {
  return amountWei > DEPRIZE_MAX_BET_WEI
}

export function remainingBetCapWei(amountWei: bigint): bigint {
  if (amountWei >= DEPRIZE_MAX_BET_WEI) return 0n
  return DEPRIZE_MAX_BET_WEI - amountWei
}
