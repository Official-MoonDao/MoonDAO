import { PrivyClient } from '@privy-io/server-auth'
import { isPrivyGuest } from './guest'

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID as string,
  process.env.PRIVY_APP_SECRET as string
)

// When set, the ES256 public key lets the SDK verify the JWT **locally** with no
// network round-trip. Without it, verifyAuthToken fetches the JWKS from Privy on
// every request, which can stall indefinitely on flaky connectivity and hang the
// whole API route (this auth check runs in middleware before any handler logic).
// Env vars store newlines as the literal characters "\n"; the PEM needs real
// newlines, so normalize them back. Empty string -> undefined (network path).
const PRIVY_VERIFICATION_KEY =
  process.env.PRIVY_VERIFICATION_KEY?.replace(/\\n/g, '\n') || undefined

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ])
}

/**
 * Guest accounts are rejected unless `allowGuest` is set. A guest costs
 * nothing to create, so only routes built for guests may accept one.
 */
export async function verifyPrivyAuth(
  accessToken: string = '',
  options: { allowGuest?: boolean } = {}
) {
  try {
    const verifiedClaims = await withTimeout(
      privy.verifyAuthToken(accessToken, PRIVY_VERIFICATION_KEY),
      // Local verification is instant; cap the network fallback so a stalled
      // JWKS fetch fails closed (401) instead of hanging the request forever.
      8000,
      'privy.verifyAuthToken'
    )
    if (!options.allowGuest && (await isPrivyGuest(verifiedClaims.userId))) {
      return undefined
    }
    return verifiedClaims
  } catch (err) {
    console.log('Token verification failed.', err)
  }
}
