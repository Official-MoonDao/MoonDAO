const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidContributorEmail(email: string | undefined | null): boolean {
  if (!email || typeof email !== 'string') return false
  const trimmed = email.trim()
  return trimmed.length <= 254 && EMAIL_RE.test(trimmed)
}
