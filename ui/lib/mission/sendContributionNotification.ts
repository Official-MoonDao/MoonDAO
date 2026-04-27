/**
 * Posts to `/api/mission/contribution-notification` with retry/backoff.
 *
 * Why this exists: the same-chain (Arbitrum) and cross-chain (Ethereum) flows
 * in `MissionContributeModal` previously had near-duplicate retry loops that
 * each only matched a couple of very specific server-generated 400 messages.
 * In practice that meant any 5xx, network error, or message we didn't think to
 * list was a fatal one-and-done — which on Ethereum surfaced as missing
 * Discord notifications.
 *
 * Behavior:
 * - Retries on network errors and any 5xx response (transient backend or
 *   platform timeouts).
 * - Retries on a small allowlist of known-transient 4xx messages (RPC race
 *   between the wallet's node and the server's node, Etherscan blip, Discord
 *   API blip, etc).
 * - Treats explicit validation/auth/replay messages as fatal — there's no
 *   point hammering them.
 * - Uses `keepalive: true` so the request can complete even if the user
 *   closes the tab right after submitting the on-chain transaction. This is
 *   especially important for cross-chain contributions where the success UI
 *   is shown immediately and the notification is fired in the background.
 */

export interface ContributionNotificationBody {
  txHash: string
  // Privy's `getAccessToken()` is typed `string | null`; we forward whatever
  // we got and let the server's auth check reject if it's missing.
  accessToken: string | null
  txChainSlug: string
  projectId: any
  contributorEmail: string
  newsletterOptIn: boolean
  isCrossChain?: boolean
  memo?: string
}

export interface ContributionNotificationResult {
  ok: boolean
  status: number
  message: string
  attempts: number
}

const RETRYABLE_MESSAGE_FRAGMENTS = [
  // Server-side `waitForReceipt` lost the race against the wallet's RPC.
  'Transaction not found',
  // Cross-chain log scan ran before the server's node indexed the receipt.
  'No CrossChainPayInitiated event found',
  // Same-chain Pay log scan ran before the server's node indexed the receipt.
  'No Pay event found',
  // Etherscan blip on price lookup.
  'Failed to get ETH price',
  // Discord API rate-limit / transient 5xx — bubbled up as 400 by the handler.
  'Failed to send message to Discord',
]

function isRetryable(status: number, message: string): boolean {
  // Network error or any server-side failure / platform timeout.
  if (status === 0 || status >= 500) return true
  return RETRYABLE_MESSAGE_FRAGMENTS.some((fragment) =>
    message.includes(fragment)
  )
}

export async function sendContributionNotification(
  body: ContributionNotificationBody,
  options: {
    maxAttempts?: number
    /**
     * When true, the underlying fetch uses `keepalive: true` so the first
     * attempt survives a tab close. Note that JS callbacks (and therefore
     * retries) cannot run after the page is unloaded, so keepalive only
     * affects the in-flight request — it does not magically schedule retries.
     */
    keepalive?: boolean
    /** Hook for logging in callers without coupling to console. */
    onAttemptError?: (info: {
      attempt: number
      status: number
      message: string
      willRetry: boolean
    }) => void
  } = {}
): Promise<ContributionNotificationResult> {
  const { maxAttempts = 5, keepalive = false, onAttemptError } = options
  const serializedBody = JSON.stringify(body)

  let lastStatus = 0
  let lastMessage = ''

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const resp = await fetch('/api/mission/contribution-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: serializedBody,
        keepalive,
      })

      lastStatus = resp.status
      const data: any = await resp.json().catch(() => ({}))
      lastMessage = data?.message || ''

      if (resp.ok) {
        return {
          ok: true,
          status: resp.status,
          message: lastMessage,
          attempts: attempt + 1,
        }
      }

      const willRetry =
        isRetryable(resp.status, lastMessage) && attempt < maxAttempts - 1
      onAttemptError?.({
        attempt: attempt + 1,
        status: resp.status,
        message: lastMessage,
        willRetry,
      })

      if (!willRetry) {
        return {
          ok: false,
          status: resp.status,
          message: lastMessage,
          attempts: attempt + 1,
        }
      }
    } catch (err: any) {
      lastStatus = 0
      lastMessage = err?.message || 'Network error'
      const willRetry = attempt < maxAttempts - 1
      onAttemptError?.({
        attempt: attempt + 1,
        status: 0,
        message: lastMessage,
        willRetry,
      })
      if (!willRetry) {
        return {
          ok: false,
          status: 0,
          message: lastMessage,
          attempts: attempt + 1,
        }
      }
    }

    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
  }

  return {
    ok: false,
    status: lastStatus,
    message: lastMessage,
    attempts: maxAttempts,
  }
}
