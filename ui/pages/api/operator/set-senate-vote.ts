import { getServerSession } from 'next-auth/next'
import { isOperator } from 'middleware/isOperator'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getPrivyUserData } from '@/lib/privy'
import { setSenateVoteOverride } from '@/lib/operator/senateVote'
import { authOptions } from '../auth/[...nextauth]'

type Body = {
  enabled: boolean
  note?: string
  expiresAt?: string | null
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = (req.body ?? {}) as Body
  if (typeof body.enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled (boolean) is required' })
  }

  let setBy: string | undefined
  try {
    const session = await getServerSession(req, res, authOptions)
    if (session?.accessToken) {
      const privyUserData = await getPrivyUserData(session.accessToken)
      setBy = privyUserData?.walletAddresses?.[0]
    }
  } catch (err) {
    console.warn('Could not derive setBy address:', err)
  }

  let expiresAt: Date | null | undefined
  if (body.expiresAt === null) {
    expiresAt = null
  } else if (typeof body.expiresAt === 'string') {
    const d = new Date(body.expiresAt)
    if (Number.isNaN(d.getTime())) {
      return res.status(400).json({ error: 'expiresAt must be a valid ISO date' })
    }
    expiresAt = d
  }

  try {
    const result = await setSenateVoteOverride({
      enabled: body.enabled,
      setBy,
      note: body.note,
      expiresAt,
    })
    return res.status(200).json(result)
  } catch (err: any) {
    console.error('set-senate-vote failed:', err)
    return res.status(500).json({ error: err?.message || 'Failed to set flag' })
  }
}

export default withMiddleware(handler, isOperator)
