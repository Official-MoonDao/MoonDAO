import { NextApiRequest, NextApiResponse } from 'next'
import { verifyPrivyAuth } from '@/lib/privy/privyAuth'

async function getResponse(formId: string, responseId: string) {
  return await fetch(
    `https://api.typeform.com/forms/${formId}/responses?included_response_ids=${responseId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.TYPEFORM_PERSONAL_ACCESS_TOKEN}`,
      },
    }
  )
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed')
  }

  const auth = await verifyPrivyAuth(req.headers.authorization)

  if (!auth) {
    return res.status(401).json('Unauthorized')
  }

  const { formId, responseId } = req.body

  const deleteRes = await fetch(
    `https://api.typeform.com/forms/${formId}/responses?included_response_ids=${responseId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${process.env.TYPEFORM_PERSONAL_ACCESS_TOKEN}`,
      },
    }
  )

  const data = await deleteRes.json()

  return res.status(200).json(data)
}
