import { createHash } from 'crypto'

/** Reject submits that happen sooner than this after the form mounted. */
export const MIN_SUBMIT_MS = 3000

const FUTURE_SKEW_MS = 60 * 1000

/**
 * Small list we maintain in repo. Add a domain when it shows up in signup logs.
 * Match the registrable domain, so sub.mailinator.com is included.
 */
export const DISPOSABLE_EMAIL_DOMAINS = [
  '10minutemail.com',
  '10minutemail.net',
  'burnermail.io',
  'discard.email',
  'dispostable.com',
  'dropmail.me',
  'emailondeck.com',
  'fakeinbox.com',
  'getairmail.com',
  'getnada.com',
  'grr.la',
  'guerrillamail.biz',
  'guerrillamail.com',
  'guerrillamail.de',
  'guerrillamail.info',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'inboxkitten.com',
  'jetable.org',
  'mailcatch.com',
  'maildrop.cc',
  'mailforspam.com',
  'mailinator.com',
  'mailnesia.com',
  'mailnull.com',
  'mintemail.com',
  'moakt.com',
  'mohmal.com',
  'mytemp.email',
  'sharklasers.com',
  'spam4.me',
  'spamgourmet.com',
  'temp-mail.org',
  'tempinbox.com',
  'tempmail.com',
  'tempr.email',
  'throwawaymail.com',
  'tmpmail.net',
  'tmpmail.org',
  'trash-mail.com',
  'trashmail.com',
  'trashmail.de',
  'trashmail.me',
  'trashmail.net',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
] as const

const DISPOSABLE = new Set<string>(DISPOSABLE_EMAIL_DOMAINS)

const TEST_DOMAINS = new Set(['example.com', 'example.org', 'example.net', 'test.com'])

export type SubscriberFilterReason =
  | 'honeypot'
  | 'too_fast'
  | 'gmail_dots'
  | 'gserviceaccount'
  | 'noreply'
  | 'test'
  | 'disposable'

export function splitEmail(email: string): { local: string; domain: string } | null {
  const trimmed = email.trim().toLowerCase()
  const at = trimmed.lastIndexOf('@')
  if (at <= 0 || at === trimmed.length - 1) return null
  return { local: trimmed.slice(0, at), domain: trimmed.slice(at + 1) }
}

/** Gmail dots and plus-tags collapse so rate limits see one mailbox. */
export function normalizeEmail(email: string): string {
  const parts = splitEmail(email)
  if (!parts) return email.trim().toLowerCase()
  let { local, domain } = parts
  if (domain === 'googlemail.com') domain = 'gmail.com'
  const plus = local.indexOf('+')
  if (domain === 'gmail.com') {
    if (plus >= 0) local = local.slice(0, plus)
    local = local.replace(/\./g, '')
  } else if (plus > 0) {
    local = local.slice(0, plus)
  }
  return `${local}@${domain}`
}

export function emailLogRef(email: string): { domain: string; localHash: string } {
  const normalized = normalizeEmail(email)
  const parts = splitEmail(normalized)
  const local = parts?.local || 'unknown'
  const domain = parts?.domain || 'unknown'
  const localHash = createHash('sha256').update(local).digest('hex').slice(0, 12)
  return { domain, localHash }
}

export function isDisposableDomain(domain: string): boolean {
  const host = domain.trim().toLowerCase().replace(/\.+$/, '')
  if (!host || DISPOSABLE.has(host)) return DISPOSABLE.has(host)
  const labels = host.split('.')
  for (let i = 1; i < labels.length - 1; i++) {
    if (DISPOSABLE.has(labels.slice(i).join('.'))) return true
  }
  return false
}

function isNoreply(local: string): boolean {
  const compact = local.toLowerCase().replace(/[._-]/g, '')
  return compact === 'noreply' || compact === 'donotreply'
}

function isTestAddress(local: string, domain: string): boolean {
  const value = local.toLowerCase()
  if (value === 'test' || value === 'testing' || value === 'testuser') return true
  if (value.startsWith('test+') || value.startsWith('test.') || value.startsWith('test_'))
    return true
  return TEST_DOMAINS.has(domain)
}

export function submissionTooFast(formStartedAt: unknown, now: number): boolean {
  if (typeof formStartedAt !== 'number' || !Number.isFinite(formStartedAt)) return true
  if (formStartedAt > now + FUTURE_SKEW_MS) return true
  return now - formStartedAt < MIN_SUBMIT_MS
}

/**
 * Bot and junk signups. Null means the address can be sent to Kit.
 * Callers show the normal success screen for any non-null reason.
 */
export function classifySubscriber(input: {
  email: string
  company?: unknown
  formStartedAt?: unknown
  now: number
  /**
   * Newsletter submits always pass a start time. Other callers of the same
   * route (citizen network signup) do not, and must still reach Kit.
   */
  enforceTiming?: boolean
}): SubscriberFilterReason | null {
  if (typeof input.company === 'string' && input.company.trim()) return 'honeypot'
  if (input.enforceTiming !== false && submissionTooFast(input.formStartedAt, input.now)) {
    return 'too_fast'
  }

  const parts = splitEmail(input.email)
  if (!parts) return null
  const { local, domain } = parts
  if (input.email.toLowerCase().includes('gserviceaccount')) return 'gserviceaccount'
  if (isNoreply(local)) return 'noreply'
  if (isTestAddress(local, domain)) return 'test'
  if (
    (domain === 'gmail.com' || domain === 'googlemail.com') &&
    (local.match(/\./g) || []).length >= 3
  ) {
    return 'gmail_dots'
  }
  if (isDisposableDomain(domain)) return 'disposable'
  return null
}
