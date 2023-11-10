import { NextApiRequest, NextApiResponse } from 'next'

const apiKeyMiddleware = (req: NextApiRequest, res: NextApiResponse) => {
  const apiKey = req.headers['moondao-api-key']

  if (apiKey !== process.env.MONGO_MOONDAO_API_KEY) {
    return res.status(401).json({ success: false, message: 'Unauthorized' })
  }
}

export default apiKeyMiddleware
