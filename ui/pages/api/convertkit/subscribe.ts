import { NextApiRequest, NextApiResponse } from 'next'
import { sanitizeKitFields } from '@/lib/analytics/attribution'

async function subscribeToForm(formId: string, email: string, fields?: Record<string, string>) {
  const formResultEndpoint = `https://api.convertkit.com/v3/forms/${formId}/subscribe`
  const payload: Record<string, unknown> = {
    api_key: process.env.CONVERT_KIT_API_KEY,
    email,
  }
  if (fields && Object.keys(fields).length) payload.fields = fields
  return fetch(formResultEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'POST':
      try {
        const { email, formId } = req.body
        const fields = sanitizeKitFields(req.body?.fields)
        let response = await subscribeToForm(formId, email, fields)
        // Kit rejects the whole subscribe when a custom field has not been
        // created yet. Retry the email signup without fields so attribution
        // cannot drop the signup. The response status stays 200 when the
        // request itself completes, matching the previous route.
        if (!response.ok && fields) {
          response = await subscribeToForm(formId, email)
        }
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
