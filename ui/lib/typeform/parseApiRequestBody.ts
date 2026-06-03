/**
 * Next.js may deliver `req.body` as a parsed object (application/json) or a raw
 * string (legacy callers). Normalize before destructuring route params.
 */
export function parseTypeformApiRequestBody(
  body: unknown,
): Record<string, unknown> | null {
  try {
    if (typeof body === 'string') {
      return JSON.parse(body || '{}') as Record<string, unknown>
    }
    if (body && typeof body === 'object') {
      return body as Record<string, unknown>
    }
    return {}
  } catch {
    return null
  }
}
