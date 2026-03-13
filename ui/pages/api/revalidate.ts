import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { path } = req.query

  if (!path || typeof path !== 'string') {
    return res.status(400).json({ message: 'Path parameter is required' })
  }

  try {
    await res.revalidate(path)
    return res.json({ revalidated: true })
  } catch {
    return res.status(500).json({ message: 'Error revalidating' })
  }
}
