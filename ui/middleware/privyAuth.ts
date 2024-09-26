import { getIronSession } from 'iron-session'
import { NextApiRequest, NextApiResponse } from 'next'
import { SessionData, sessionOptions } from '@/lib/iron-session/iron-session'
import { verifyPrivyAuth } from '@/lib/privy/privyAuth'
import { secureHeaders } from './secureHeaders'

export async function privyAuth(
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => void
) {
  const origin = req.headers.origin

  if (origin !== process.env.ALLOWED_ORIGIN) {
    return res.status(403).json({ error: 'Access Denied' })
  }

  secureHeaders(res)

  const accessToken = req.headers.authorization?.replace('Bearer ', '')
  const auth = await verifyPrivyAuth(accessToken)

  const session = await getIronSession<SessionData>(req, res, sessionOptions)

  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

  if (
    auth &&
    session &&
    session.accessToken === accessToken &&
    session.auth.appId === privyAppId &&
    auth.appId === privyAppId
  ) {
    next()
  } else {
    res.status(401).json('Unauthorized')
  }
}
