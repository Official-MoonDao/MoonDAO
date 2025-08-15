import { NextApiRequest, NextApiResponse } from 'next'

// CORS headers for cross-origin access on public endpoints
export function setPublicHeaders(res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*') // Allow all origins
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Max-Age', '86400') // Cache preflight for 24 hours
}

// Complete middleware function that handles both headers and OPTIONS requests
export async function publicHeadersMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => void
) {
  // Set CORS headers for all requests
  setPublicHeaders(res)

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  next()
}
