import { fetchPrivyUserRecord, isGuestRecord, rememberPrivyUser } from './guest'
import { verifyPrivyAuth } from './privyAuth'

export interface PrivyUserData {
  walletAddresses: string[]
  discordAccount: any
  userData: any
  isGuest: boolean
}

/** Guests are rejected unless `allowGuest` is set (see `verifyPrivyAuth`). */
export async function getPrivyUserData(
  accessToken: string,
  options: { allowGuest?: boolean } = {}
): Promise<PrivyUserData | null> {
  try {
    // The user record below says whether this is a guest, so skip the
    // separate guest lookup in verifyPrivyAuth.
    const verifiedClaims = await verifyPrivyAuth(accessToken, { allowGuest: true })
    if (!verifiedClaims) {
      return null
    }

    const userData = await fetchPrivyUserRecord(verifiedClaims.userId)
    const isGuest = isGuestRecord(userData)
    rememberPrivyUser(verifiedClaims.userId, isGuest)
    if (isGuest && !options.allowGuest) {
      return null
    }

    const walletAddresses: string[] = []
    let discordAccount: any = null

    // Extract wallet addresses from the user's linked accounts
    if (userData.linked_accounts) {
      for (const account of userData.linked_accounts) {
        if ((account.type === 'wallet' || account.type === 'smart_wallet') && account.address) {
          walletAddresses.push(account.address)
        }
        // Find the Discord account
        if (account.type === 'discord_oauth') {
          discordAccount = account
        }
      }
    }

    return {
      walletAddresses,
      discordAccount,
      userData,
      isGuest,
    }
  } catch (error) {
    console.error('Error fetching Privy user data:', error)
    return null
  }
}

export async function addressBelongsToPrivyUser(
  accessToken: string,
  address: string
): Promise<boolean> {
  const privyUserData = await getPrivyUserData(accessToken)
  if (!privyUserData) {
    return false
  }
  if (privyUserData.walletAddresses.length === 0) {
    return false
  }
  return privyUserData.walletAddresses
    .map((addr) => addr.toLowerCase())
    .includes(address.toLowerCase())
}
