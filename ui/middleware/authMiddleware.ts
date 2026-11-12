import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { verifyPrivyAuth } from '../lib/privy/privyAuth'
import { authOptions } from '../pages/api/auth/[...nextauth]'
import { secureHeaders } from './secureHeaders'

function createAuthMiddleware(options: { allowGuest: boolean }) {
  return async function (req: NextApiRequest, res: NextApiResponse, next: () => void) {
    secureHeaders(res)

    // Privy Bearer first — avoids a NextAuth session lookup on every poll during onboarding.
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      try {
        const verified = await verifyPrivyAuth(token, options)
        if (verified) {
          next()
          return
        }
      } catch (err) {
        // Privy verification failed, fall through to session / 401
      }
    }

    // NextAuth only issues sessions to full users (see [...nextauth]).
    const session = await getServerSession(req, res, authOptions)
    if (session) {
      next()
      return
    }

    res.status(401).json('Unauthorized')
  }
}

export const authMiddleware = createAuthMiddleware({ allowGuest: false })

/** Also admits Privy guest accounts. Use only on routes built for guests. */
export const guestAuthMiddleware = createAuthMiddleware({ allowGuest: true })
