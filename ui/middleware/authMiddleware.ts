import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../pages/api/auth/[...nextauth]'
import { secureHeaders } from './secureHeaders'

export async function authMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => void
) {
  const origin = req.headers.origin

  if (origin !== process.env.ALLOWED_ORIGIN) {
    return res.status(403).json({ error: 'Access Denied' })
  }

  secureHeaders(res)

  const session = await getServerSession(req, res, authOptions)

  if (session) {
    next()
  } else {
    res.status(401).json('Unauthorized')
  }
}
