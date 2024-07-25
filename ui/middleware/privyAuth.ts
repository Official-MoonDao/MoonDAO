import { NextApiRequest, NextApiResponse } from 'next'
import { verifyPrivyAuth } from '@/lib/privy/privyAuth'

export async function privyAuth(
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => void
) {
  const auth = await verifyPrivyAuth(req.headers.authorization)

  if (auth && auth.appId === process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
    next()
  } else {
    res.status(401).json('Unauthorized')
  }
}
