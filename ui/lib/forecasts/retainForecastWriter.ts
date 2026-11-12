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
