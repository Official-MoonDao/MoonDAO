/**
 * Which forecast wallet is on screen across a guest upgrade.
 *
 * `login()` turns a guest into an account in place. The guest flag drops
 * before that same wallet becomes the active account, so `live` is missing
 * while the visitor is still authenticated. Logout drops the held wallet so
 * the next account cannot inherit this forecast.
 */
export function retainForecastWriter<T>(input: {
  live: T | undefined
  held: T | undefined
  authenticated: boolean
}): { writer: T | undefined; held: T | undefined } {
  if (input.live) return { writer: input.live, held: input.live }
  if (!input.authenticated) return { writer: undefined, held: undefined }
  return { writer: input.held, held: input.held }
}

/**
 * Whether a dead forecast session may be replaced with a guest.
 *
 * A signed-in account only retries its access token. `authenticated &&
 * !isGuest` is that account, including the gap above where the guest flag
 * has dropped and the wallet is not the active account yet. The active
 * account is unset for that gap and for a real guest, so it cannot be the
 * gate. An account that is already attached is not renewed either.
 */
export function canRenewForecastGuest(input: {
  account: unknown
  authenticated: boolean
  isGuest: boolean
}): boolean {
  return !input.account && !(input.authenticated && !input.isGuest)
}
