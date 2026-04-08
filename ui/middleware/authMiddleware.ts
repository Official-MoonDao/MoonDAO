import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../pages/api/auth/[...nextauth]'
import { verifyPrivyAuth } from '../lib/privy/privyAuth'
import { secureHeaders } from './secureHeaders'

export async function authMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => void
) {
  secureHeaders(res)

  // Try NextAuth session first
  const session = await getServerSession(req, res, authOptions)
  if (session) {
    next()
    return
  }

  // Fallback: check for Privy Bearer token
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    try {
      const verified = await verifyPrivyAuth(token)
      if (verified) {
        next()
        return
      }
    } catch (err) {
      // Privy verification failed, fall through to 401
    }
  }

  res.status(401).json('Unauthorized')
}
