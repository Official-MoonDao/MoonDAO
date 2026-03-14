import { NextApiRequest, NextApiResponse } from 'next'

const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET
const ALLOWED_PATHS = ['/overview-vote']

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { secret, path } = req.body ?? {}

  if (!REVALIDATE_SECRET || secret !== REVALIDATE_SECRET) {
    return res.status(401).json({ message: 'Invalid secret' })
  }

  if (!path || typeof path !== 'string' || !ALLOWED_PATHS.includes(path)) {
    return res.status(400).json({ message: 'Invalid path' })
  }

  try {
    await res.revalidate(path)
    return res.json({ revalidated: true })
  } catch {
    return res.status(500).json({ message: 'Error revalidating' })
  }
}
