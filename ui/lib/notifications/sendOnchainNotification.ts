import { getAccessToken } from '@privy-io/react-auth'

/**
 * POSTs a fire-and-forget Discord notification for an on-chain action.
 *
 * Use this for any client-side call to one of our `*-notification` API routes
 * (leaderboard delegation, proposal vote, retroactive distribution, …).
 *
 * Why a shared helper:
 *
 *  1. Every notification route is wrapped in `authMiddleware`, which short-
 *     circuits with 401 unless the request includes either a valid NextAuth
 *     session cookie OR an `Authorization: Bearer ${accessToken}` header.
 *     The NextAuth cookie isn't always present for Privy-only flows (race
 *     after sign-in, expired session, blocked third-party cookies), so we
 *     always send the Bearer header — otherwise the message silently never
 *     gets posted.
 *
 *  2. Discord and our own routes occasionally blip on 5xx / network. A small
 *     bounded retry loop with backoff prevents single transient failures
 *     from dropping notifications without spamming on permanent errors.
 *
 *  3. Surfacing failures via `console.warn` (instead of swallowing with
 *     `.catch(() => {})`) makes regressions visible in the browser console
 *     so we don't end up debugging "sometimes it doesn't fire" again.
 *
 * The call is fire-and-forget from the caller's perspective; we never throw
 * and never block the UI flow. Returns `true` when Discord acked, `false`
 * otherwise.
 */
export async function sendOnchainNotification(
  /** API route path, e.g. `/api/proposals/vote-notification`. */
  path: string,
  /** Body fields specific to this notification (txHash + anything the route
   *  expects). The helper will inject `accessToken` automatically. */
  body: Record<string, unknown>,
  options: {
    /** Tag used in console logs to identify this notification kind. */
    label?: string
    /** Total attempts including the first try. Defaults to 3. */
    maxAttempts?: number
    /** Base linear backoff between retries in ms. Defaults to 1500ms. */
    backoffMs?: number
  } = {}
): Promise<boolean> {
  const label = options.label ?? path
  const maxAttempts = options.maxAttempts ?? 3
  const backoffMs = options.backoffMs ?? 1500

  try {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      console.warn(`[${label}] skipped: missing accessToken`)
      return false
    }
    if (!body.txHash) {
      console.warn(`[${label}] skipped: missing txHash`)
      return false
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const resp = await fetch(path, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ ...body, accessToken }),
        })
        if (resp.ok) return true

        // 4xx (other than 408 / 429) means the server rejected the request
        // for a permanent reason — retrying won't help. Log and bail.
        if (
          resp.status >= 400 &&
          resp.status < 500 &&
          resp.status !== 408 &&
          resp.status !== 429
        ) {
          const errBody = await resp.text().catch(() => '')
          console.warn(`[${label}] failed (${resp.status}): ${errBody}`)
          return false
        }
      } catch (fetchErr) {
        if (attempt === maxAttempts - 1) throw fetchErr
      }
      await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)))
    }
  } catch (err) {
    console.warn(`[${label}] error:`, err)
  }
  return false
}
