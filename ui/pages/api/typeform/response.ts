import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { getPrivyUserData } from '@/lib/privy'
import {
  hasAccessToResponse,
  fetchResponseFromFormIds,
} from '@/lib/typeform/hasAccessToResponse'

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
    try {
      result = await getResponse(formId, responseId)
      data = await result.json()

      if (!result.ok) {
        console.error(
          `Typeform API error: ${result.status} - ${
            data.description || 'Unknown error'
          }`
        )
        if (counter >= 4) {
          return null
        }
      } else {
        totalItems = data.total_items
      }

      await wait(1000)
      counter += 1
    } catch (error) {
      console.error(`Error on attempt ${counter}:`, error)
      counter += 1
      if (counter < 5) {
        await wait(1000)
      }
    }
  }

  return result?.ok ? data : null
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed')
  }

  const { accessToken, responseId, formId } = JSON.parse(req.body)

  try {
    const privyUserData = await getPrivyUserData(accessToken as string)

    if (!privyUserData) {
      return res.status(401).json({ message: 'Invalid access token' })
    }

    const { walletAddresses } = privyUserData

    if (!formId || !responseId) {
      return res.status(400).json({ message: 'Missing formId or responseId' })
    }

    if (!process.env.TYPEFORM_PERSONAL_ACCESS_TOKEN) {
      console.error('TYPEFORM_PERSONAL_ACCESS_TOKEN is not set')
      return res.status(500).json({ message: 'Server configuration error' })
    }

    // Check if user has access to this response
    const { hasAccess, error, formIds } = await hasAccessToResponse(
      walletAddresses,
      responseId
    )

    if (!hasAccess) {
      return res.status(401).json({ message: error || 'Access denied' })
    }

    // Fetch response from the appropriate form IDs based on type
    let data: any = null
    if (formIds && formIds.length > 0) {
      data = await fetchResponseFromFormIds(formIds, responseId as string)
    }

    // Fallback to the original formId if no data found from type-specific forms
    if (!data && formId) {
      data = await retryGetResponse(formId as string, responseId as string)
    }

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
  } catch (error) {
    console.error('Error in typeform response handler:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

export default withMiddleware(handler, authMiddleware)
