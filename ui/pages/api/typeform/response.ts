import { ethers } from 'ethers'
import { NextApiRequest, NextApiResponse } from 'next'
import Nonce from '@/lib/mongodb/models/Nonce'
import dbConnect from '@/lib/mongodb/mongo'
import { verifyPrivyAuth } from '@/lib/privy/privyAuth'

//https://github.com/mathio/nextjs-embed-demo/blob/main/pages/api/response.js

async function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

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

async function retryGetResponse(formId: string, responseId: string) {
  let result: any
  let data: any = {}
  let totalItems = 0
  let counter = 1

  while (totalItems === 0 && counter < 5) {
    result = await getResponse(formId, responseId)
    data = await result.json()
    ;(totalItems = data.total_items), await wait(1000)
    counter += 1
  }

  return result.ok ? data : null
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

  const { formId, responseId } = req.query

  const data = await retryGetResponse(formId as string, responseId as string)

  if (!data) {
    return res
      .status(500)
      .json({ message: 'Error while fetching from typeform api' })
  }

  const response = data.items[0]
  if (!response) {
    return res.status(404).json({ message: 'Response not found' })
  }

  return res.status(200).json({
    answers: response.answers,
  })
}
