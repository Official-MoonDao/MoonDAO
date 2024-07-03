import { PrivyClient } from '@privy-io/server-auth'

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID as string,
  process.env.PRIVY_APP_SECRET as string
)

export async function verifyPrivyAuth(auth: any) {
  try {
    const accessToken = auth.replace('Bearer ', '')
    const verifiedClaims = await privy.verifyAuthToken(accessToken)
    return verifiedClaims
  } catch (err) {
    console.log('Token verification failed.')
  }
}
