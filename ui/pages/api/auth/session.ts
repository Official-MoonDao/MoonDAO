// Inside your Next.js API route
import { getIronSession } from 'iron-session'
import { secureHeaders } from 'middleware/secureHeaders'
import { NextApiRequest, NextApiResponse } from 'next'
import { sessionOptions, SessionData } from '@/lib/iron-session/iron-session'
import { verifyPrivyAuth } from '@/lib/privy/privyAuth'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const origin = req.headers.origin

  if (origin !== process.env.ALLOWED_ORIGIN) {
    return res.status(403).json({ error: 'Access Denied' })
  }

  secureHeaders(res)

  if (req.method === 'POST') {
    const { type } = req.body
    const accessToken = req.headers.authorization?.replace('Bearer ', '')
    const auth = await verifyPrivyAuth(accessToken)

    if (!auth || auth.appId !== process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
      return res.status(401).json('Unauthorized')
    }

    const session = await getIronSession<SessionData>(req, res, sessionOptions)

    if (type === 'save') {
      if (accessToken && auth) {
        session.accessToken = accessToken
        session.auth = auth
        await session.save()
      } else {
        session.destroy()
      }
    } else {
      session.destroy()
    }

    res.status(200).json({ loggedIn: true })
  } else {
    res.status(405).send('Method Not Allowed')
  }
}
