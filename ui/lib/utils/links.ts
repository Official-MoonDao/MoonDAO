export function isValidYouTubeUrl(url: string): boolean {
  if (!url || url.trim().length === 0) return false

  const youtubeRegex =
    /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+(\S+)?$/
  return youtubeRegex.test(url.trim())
}

/**
 * Returns true when `value` is a string that node's `fetch()` can actually
 * handle as a URL — i.e. an http(s):// address, an ipfs:// URI, or an
 * ipns:// URI.  Anything else (empty string, lone punctuation, malformed
 * data left over in Tableland rows, etc.) is rejected so the caller can
 * skip it instead of letting `fetch()` throw `ERR_INVALID_URL` on the
 * server and silently dropping records.
 */
export function isFetchableUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed.length === 0) return false
  return (
    /^https?:\/\/[^\s]+$/i.test(trimmed) ||
    /^ipfs:\/\/[^\s]+$/i.test(trimmed) ||
    /^ipns:\/\/[^\s]+$/i.test(trimmed)
  )
}
