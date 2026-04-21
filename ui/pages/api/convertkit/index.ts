import dotenv from 'dotenv'
import type { NextApiRequest, NextApiResponse } from 'next'

dotenv.config()

// Simple static API-key check. Replaces the previous Mongo-backed
// `apiKeyMiddleware`, whose secondary signature-verification path was only
// used by the now-archived Ticket-to-Space sweepstakes UI.
function checkApiKey(req: NextApiRequest, res: NextApiResponse): boolean {
  const expected = process.env.NEXT_PUBLIC_MONGO_MOONDAO_API_KEY
  const provided = req.headers['moondao-api-key']
  if (expected && provided === expected) return true
  res.status(401).json({ success: false, message: 'Unauthorized' })
  return false
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req

  if (!checkApiKey(req, res)) return

  switch (method) {
    case 'POST':
      try {
        const { userEmail, name } = req.body
        const formId = '6052865'
        const formResultEndpoint = `https://api.convertkit.com/v3/forms/${formId}/subscribe`
        const response = await fetch(formResultEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            api_key: process.env.NEXT_PUBLIC_CONVERT_KIT_API_KEY,
            email: userEmail,
            first_name: name,
          }),
        })
        const data = await response.json()
        console.log(data)

        const tagId = '4416101'
        const tagResultEndpoint = `https://api.convertkit.com/v3/tags/${tagId}/subscribe`
        await fetch(tagResultEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            api_key: process.env.NEXT_PUBLIC_CONVERT_KIT_API_KEY,
            email: userEmail,
          }),
        })
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
