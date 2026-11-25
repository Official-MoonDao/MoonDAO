import { rateLimit } from 'middleware/rateLimit'
import { secureHeaders } from 'middleware/secureHeaders'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { isAllowedTagRequest } from '@/lib/convert-kit/tagRequest'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  secureHeaders(res)
  const { method } = req

  switch (method) {
    case 'POST':
      try {
        const { email, tagId } = req.body
        if (!isAllowedTagRequest(email, tagId)) {
          return res.status(400).json({ success: false })
        }
        const formResultEndpoint = `https://api.convertkit.com/v3/tags/${tagId}/subscribe`
        const response = await fetch(formResultEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            api_key: process.env.CONVERT_KIT_API_KEY,
            email,
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

export default withMiddleware(handler, rateLimit)
