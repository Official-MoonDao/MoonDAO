import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { getPrivyUserData } from '@/lib/privy'
import { verifyPrivyAuth } from '@/lib/privy/privyAuth'
import { hasAccessToResponse, fetchResponseFromFormIds } from '@/lib/typeform/hasAccessToResponse'

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
    },
  )
}

async function retryGetResponse(
  formId: string,
  responseId: string,
  options?: { maxAttempts?: number; delayMs?: number },
) {
  const maxAttempts = options?.maxAttempts ?? 5
  const delayMs = options?.delayMs ?? 700

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await getResponse(formId, responseId)
      const data = await result.json()

      if (result.ok && data.total_items > 0 && data.items?.[0]) {
        return data
      }

      if (!result.ok) {
        console.error(
          `Typeform API error: ${result.status} - ${data.description || 'Unknown error'}`,
        )
      }
    } catch (error) {
      console.error(`Error on attempt ${attempt}:`, error)
    }

    if (attempt < maxAttempts) {
      await wait(delayMs)
    }
  }

  return null
}

function responsePayload(data: any) {
  const response = data.items[0]
  return { answers: response.answers }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed')
  }

  const { accessToken, responseId, formId, onboarding } = JSON.parse(req.body)

  try {
    if (!formId || !responseId) {
      return res.status(400).json({ message: 'Missing formId or responseId' })
    }

    if (!process.env.TYPEFORM_PERSONAL_ACCESS_TOKEN) {
      console.error('TYPEFORM_PERSONAL_ACCESS_TOKEN is not set')
      return res.status(500).json({ message: 'Server configuration error' })
    }

    // New citizen/team onboarding: verify token only (no Privy user API fetch per poll).
    // Client handles retry backoff; server does one quick Typeform read per request.
    if (onboarding) {
      const verified = await verifyPrivyAuth(accessToken as string)
      if (!verified) {
        return res.status(401).json({ message: 'Invalid access token' })
      }

      // Get user's wallet addresses to prevent IDOR for already-minted responses
      const privyUserData = await getPrivyUserData(accessToken as string)
      if (!privyUserData) {
        return res.status(401).json({ message: 'Invalid access token' })
      }

      const { walletAddresses } = privyUserData

      // Check if this responseId is already minted on-chain. If it is, verify ownership.
      const { hasAccess, error } = await hasAccessToResponse(walletAddresses, responseId)

      // If the response is on-chain and the user doesn't have access, deny
      if (error && error !== 'Response not found' && !hasAccess) {
        return res.status(403).json({ message: 'Access denied to this response' })
      }

      const data = await retryGetResponse(formId as string, responseId as string, {
        maxAttempts: 1,
      })
      if (data?.items?.[0]) {
        return res.status(200).json(responsePayload(data))
      }
      return res.status(404).json({ message: 'Response not yet available from Typeform' })
    }

    const privyUserData = await getPrivyUserData(accessToken as string)
    if (!privyUserData) {
      return res.status(401).json({ message: 'Invalid access token' })
    }

    const { walletAddresses } = privyUserData

    // Profile updates: verify on-chain ownership before returning answers.
    const { hasAccess, error, formIds } = await hasAccessToResponse(walletAddresses, responseId)

    if (!hasAccess) {
      return res.status(401).json({ message: error || 'Access denied' })
    }

    let data: any = null
    if (formIds && formIds.length > 0) {
      data = await fetchResponseFromFormIds(formIds, responseId as string)
    }

    if (!data && formId) {
      data = await retryGetResponse(formId as string, responseId as string)
    }

    if (!data) {
      return res.status(500).json({ message: 'Error while fetching from typeform api' })
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
