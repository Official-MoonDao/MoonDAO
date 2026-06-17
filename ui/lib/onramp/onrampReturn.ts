/**
 * Short-lived breadcrumb used to return a user to the page they were funding
 * from after a fiat onramp.
 *
 * Privy's in-app fiat onramp (MoonPay) exposes no return-URL option, and a
 * provider's KYC / 3-D Secure step can perform a top-level browser redirect.
 * When that happens the user is dropped back at the site root instead of the
 * flow they were in (e.g. citizen creation), losing their place. We persist the
 * originating path right before opening the widget and, on the next full page
 * load, send the user back there (see OnrampReturnHandler).
 *
 * localStorage (not sessionStorage) is used so the breadcrumb survives a
 * provider redirect that returns in a new tab. A short TTL bounds staleness so
 * an abandoned attempt can't redirect the user much later.
 */

const KEY = 'moondao.onrampReturn'
// Matches the onramp balance-poll window (see MoonPayOnramp pollMaxMinutes).
const TTL_MS = 45 * 60 * 1000

type OnrampReturn = { path: string; ts: number }

/**
 * Remember the current location so we can return here after the onramp. Pass an
 * explicit path to override the default (current pathname + query). A return to
 * the site root is never stored — there is nothing to resume there.
 */
export function setOnrampReturn(path?: string): void {
  if (typeof window === 'undefined') return
  try {
    const target = path || window.location.pathname + window.location.search
    if (!target || target === '/') return
    const payload: OnrampReturn = { path: target, ts: Date.now() }
    window.localStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    // Storage may be unavailable (private mode, quota) — degrade gracefully.
  }
}

export function clearOnrampReturn(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // no-op
  }
}

/**
 * Read and remove the breadcrumb. Returns the stored path if present and still
 * within the TTL, otherwise null. Consuming clears it so it only fires once.
 */
export function consumeOnrampReturn(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    window.localStorage.removeItem(KEY)
    const parsed = JSON.parse(raw) as OnrampReturn
    if (!parsed?.path || typeof parsed.ts !== 'number') return null
    if (Date.now() - parsed.ts > TTL_MS) return null
    return parsed.path
  } catch {
    return null
  }
}
