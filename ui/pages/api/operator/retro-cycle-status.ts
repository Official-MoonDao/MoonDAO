import type { NextApiRequest, NextApiResponse } from 'next'
import { getRetroCycleOverride } from '@/lib/operator/retroCycle'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const override = await getRetroCycleOverride()
  return res.status(200).json(override)
}
