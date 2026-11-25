import { CK_NETWORK_SIGNUP_TAG_ID } from 'const/config'

// The tag ID is interpolated into the ConvertKit URL, so only known IDs may pass.
const ALLOWED_TAG_IDS = new Set([CK_NETWORK_SIGNUP_TAG_ID])
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isAllowedTagRequest(email: unknown, tagId: unknown): boolean {
  return (
    typeof email === 'string' &&
    EMAIL_RE.test(email) &&
    typeof tagId === 'string' &&
    ALLOWED_TAG_IDS.has(tagId)
  )
}
