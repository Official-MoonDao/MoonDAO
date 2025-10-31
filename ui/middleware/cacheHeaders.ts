import type { NextApiResponse } from 'next'

/**
 * Sets CDN cache headers for Vercel Edge caching
 * @param res - Next.js API response object
 * @param ttl - Time to live in seconds (s-maxage)
 * @param swr - Stale-while-revalidate time in seconds
 * @param vary - Optional Vary header values (comma-separated string)
 */
export function setCDNCacheHeaders(
  res: NextApiResponse,
  ttl: number,
  swr: number,
  vary?: string
): void {
  const cacheControl = `s-maxage=${ttl}, stale-while-revalidate=${swr}`

  res.setHeader('Cache-Control', cacheControl)
  res.setHeader('CDN-Cache-Control', cacheControl)

  if (vary) {
    res.setHeader('Vary', vary)
  }
}
