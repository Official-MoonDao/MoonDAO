import { getAddress } from 'viem'
import { isHexAddress } from './eligibility'

/** Pick a session wallet. A claimed address must belong to the session. */
export function selectSessionWallet(
  wallets: string[],
  claimedWallet?: string | null
): string | null {
  const owned = wallets.filter((addr) => isHexAddress(addr))
  if (owned.length === 0) return null

  const claimed = claimedWallet?.trim() || ''
  if (claimed) {
    if (!isHexAddress(claimed)) return null
    const match = owned.find((w) => w.toLowerCase() === claimed.toLowerCase())
    return match ? getAddress(match) : null
  }

  if (owned.length === 1) return getAddress(owned[0])
  return null
}
