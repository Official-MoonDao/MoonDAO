import { NextApiResponse } from 'next'

export async function secureHeaders(res: NextApiResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  )
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self';"
  )
}
