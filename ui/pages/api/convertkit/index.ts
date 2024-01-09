import dotenv from 'dotenv'
import type { NextApiRequest, NextApiResponse } from 'next'
import apiKeyMiddleware from '../../../lib/mongodb/models/middleware'

dotenv.config()

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req

  const auth = await apiKeyMiddleware(req, res)
  if (!auth) return

  switch (method) {
    case 'POST':
      try {
        const { userEmail } = req.body
        const formId = '6052865'
        const convertKitEndpoint = `https://api.convertkit.com/v3/forms/${formId}/subscribe`
        const result = await fetch(convertKitEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            api_key: process.env.NEXT_PUBLIC_CONVERT_KIT_API_KEY,
            email: userEmail,
          }),
        })
        const data = await result.json()
        console.log(data)
        res.status(200).json({ success: true })
      } catch (error) {
        console.log(error)
        res.status(400).json({ success: false })
      }
      break
    default:
      res.status(400).json({ success: false })
      break
  }
}
