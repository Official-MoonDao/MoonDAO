import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req

  switch (method) {
    case 'GET':
      try {
        const nonce = process.env.NEXT_PUBLIC_MONGO_MOONDAO_API_KEY
        res.status(200).json({ nonce })
      } catch (error) {
        res.status(400).json({ success: false })
      }
      break
  }
}
