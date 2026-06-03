import { getAccessToken } from '@privy-io/react-auth'

const DEFAULT_MAX_RETRIES = 12
const INITIAL_DELAY_MS = 600
const MAX_DELAY_MS = 2500

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Poll until Typeform indexes a fresh response. Uses short backoff (not 5s fixed).
 * Prefer handleTypeformSubmission for onboarding — it uses a single request loop.
 */
export default async function waitForResponse(
  formId: string,
  responseId: string,
  maxRetries: number = DEFAULT_MAX_RETRIES,
  options?: { onboarding?: boolean }
): Promise<boolean> {
  const accessToken = await getAccessToken()

  const authHeaders: HeadersInit = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : {}

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(`/api/typeform/response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          accessToken,
          responseId,
          formId,
          onboarding: options?.onboarding ?? false,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.answers) {
          return true
        }
      } else {
        console.error(`API call failed with status: ${res.status}`)
      }
    } catch (error) {
      console.error('Error in waitForResponse:', error)
    }

    if (attempt < maxRetries - 1) {
      const delay = Math.min(INITIAL_DELAY_MS + attempt * 400, MAX_DELAY_MS)
      await sleep(delay)
    }
  }

  throw new Error(`Failed to get response after ${maxRetries} attempts`)
}
