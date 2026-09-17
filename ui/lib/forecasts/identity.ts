import type { NextApiRequest } from 'next'
import { verifyPrivyAuth } from '@/lib/privy/privyAuth'

export async function privyUserIdFromRequest(req: NextApiRequest): Promise<string | null> {
  const header = req.headers.authorization
  const token =
    typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return null
  const claims = await verifyPrivyAuth(token)
  if (!claims) return null
  const id = claims.userId || claims.sub
  return typeof id === 'string' && id.length > 0 ? id : null
}
