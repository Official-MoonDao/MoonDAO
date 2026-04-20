import type { NextApiRequest, NextApiResponse } from 'next'
import { getSenateVoteOverride } from '@/lib/operator/senateVote'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const override = await getSenateVoteOverride()
  return res.status(200).json(override)
}
