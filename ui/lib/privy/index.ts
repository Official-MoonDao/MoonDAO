import { verifyPrivyAuth } from './privyAuth'

export interface PrivyUserData {
  walletAddresses: string[]
  discordAccount: any
  userData: any
}

export async function getPrivyUserData(
  accessToken: string
): Promise<PrivyUserData | null> {
  try {
    // Verify Privy auth and get user data
    console.log('ACCESS TOKEN', accessToken)
    const verifiedClaims = await verifyPrivyAuth(accessToken)
    if (!verifiedClaims) {
      return null
    }

    // Fetch user data with linked accounts from Privy API
    const userResponse = await fetch(
      `https://auth.privy.io/api/v1/users/${verifiedClaims.userId}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.NEXT_PUBLIC_PRIVY_APP_ID}:${process.env.PRIVY_APP_SECRET}`
          ).toString('base64')}`,
          'privy-app-id': process.env.NEXT_PUBLIC_PRIVY_APP_ID as string,
        },
      }
    )

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user data from Privy')
    }

    const userData = await userResponse.json()
    const walletAddresses: string[] = []
    let discordAccount: any = null

    // Extract wallet addresses from the user's linked accounts
    if (userData.linked_accounts) {
      for (const account of userData.linked_accounts) {
        if (account.type === 'wallet' && account.address) {
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
    }
  } catch (error) {
    console.error('Error fetching Privy user data:', error)
    return null
  }
}
