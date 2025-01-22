import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../pages/api/auth/[...nextauth]'
import { secureHeaders } from './secureHeaders'

export async function authMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => void
) {
  secureHeaders(res)

  const session = await getServerSession(req, res, authOptions)

  if (session) {
    next()
  } else {
    res.status(401).json('Unauthorized')
  }
}
