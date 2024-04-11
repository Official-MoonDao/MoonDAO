import { NextApiRequest, NextApiResponse } from 'next'
import { NEWSLETTER_FORM_ID } from '../../../const/config'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req

  switch (method) {
    case 'POST':
      try {
        const { email } = req.body
        const formResultEndpoint = `https://api.convertkit.com/v3/forms/${NEWSLETTER_FORM_ID}/subscribe`
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
