/**
 * Fail closed when CRON_SECRET is unset. The only callers of the renewal
 * reminder route are the GitHub Actions workflows, and both send the bearer secret.
 */
export function authorizeRenewalCron(
  expectedSecret: string | undefined,
  provided: string | undefined
):
  | { ok: true }
  | { ok: false; status: 401; body: { message: 'Unauthorized' } }
  | {
      ok: false
      status: 503
      body: { ok: false; message: 'CRON_SECRET is not configured' }
    } {
  if (!expectedSecret?.trim()) {
    return {
      ok: false,
      status: 503,
      body: { ok: false, message: 'CRON_SECRET is not configured' },
    }
  }
  if (provided !== expectedSecret) {
    return { ok: false, status: 401, body: { message: 'Unauthorized' } }
  }
  return { ok: true }
}
