import { privyAuth } from 'middleware/privyAuth'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed')
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

export default withMiddleware(handler, privyAuth)
