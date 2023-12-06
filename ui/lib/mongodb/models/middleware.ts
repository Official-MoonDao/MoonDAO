import { NextApiRequest, NextApiResponse } from 'next'

const apiKeyMiddleware = (req: NextApiRequest, res: NextApiResponse) => {
  const apiKey = req.headers['moondao-api-key']

  if (apiKey !== process.env.NEXT_PUBLIC_MONGO_MOONDAO_API_KEY) {
    res.status(401).json({ success: false, message: 'Unauthorized' })
    return false
  }
  return true
}

export default apiKeyMiddleware
