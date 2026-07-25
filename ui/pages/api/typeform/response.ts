import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { getPrivyUserData } from '@/lib/privy'
import {
  hasAccessToResponse,
  fetchResponseFromFormIds,
} from '@/lib/typeform/hasAccessToResponse'
import { parseTypeformApiRequestBody } from '@/lib/typeform/parseApiRequestBody'
import {
  cacheTypeformAnswers,
  readCachedTypeformAnswers,
} from '@/lib/typeform/responseCache'

//https://github.com/mathio/nextjs-embed-demo/blob/main/pages/api/response.js

async function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function getResponse(formId: string, responseId: string) {
  // Bound the Typeform call so a stalled request can't hang the whole API route.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    return await fetch(
      `https://api.typeform.com/forms/${formId}/responses?included_response_ids=${responseId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.TYPEFORM_PERSONAL_ACCESS_TOKEN}`,
        },
        signal: controller.signal,
      },
    )
  } finally {
    clearTimeout(timeout)
  }
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

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed')
  }

  const parsedBody = parseTypeformApiRequestBody(req.body)
  if (!parsedBody) {
    return res.status(400).json({ message: 'Invalid request body' })
  }

  const { accessToken, responseId, formId, onboarding } = parsedBody

  try {
    if (!formId || !responseId) {
      return res.status(400).json({ message: 'Missing formId or responseId' })
    }

    if (!process.env.TYPEFORM_PERSONAL_ACCESS_TOKEN) {
      console.error('TYPEFORM_PERSONAL_ACCESS_TOKEN is not set')
      return res.status(500).json({ message: 'Server configuration error' })
    }

    // New citizen/team onboarding. The client polls this endpoint repeatedly
    // while Typeform indexes the submission, so the common case is "not ready
    // yet". To keep each poll cheap we do the readiness check FIRST (Redis
    // cache -> one Typeform read) and bail out fast with 404 when there's
    // nothing to return. The expensive Privy user fetch + on-chain IDOR check
    // only runs on the single request that actually has answers. The Bearer
    // token was already verified by authMiddleware, so no extra verify here.
    if (onboarding) {
      // Fast path: webhook caches answers within ~1s of submit (see /api/typeform/webhook).
      let answers = await readCachedTypeformAnswers(responseId as string)

      if (!answers) {
        const data = await retryGetResponse(formId as string, responseId as string, {
          maxAttempts: 1,
        })
        if (data?.items?.[0]) {
          answers = data.items[0].answers
          if (answers) {
            void cacheTypeformAnswers(responseId as string, answers)
          }
        }
      }

      if (!answers) {
        return res
          .status(404)
          .json({ message: 'Response not yet available from Typeform' })
      }

      // We have answers — confirm identity and prevent IDOR for responses
      // already minted on-chain before handing them back.
      const privyUserData = await getPrivyUserData(accessToken as string)
      if (!privyUserData) {
        return res.status(401).json({ message: 'Invalid access token' })
      }

      const { walletAddresses } = privyUserData
      const { hasAccess, error } = await hasAccessToResponse(
        walletAddresses,
        responseId as string
      )

      // Only block when we DEFINITIVELY determine the response is owned by a
      // different on-chain citizen/team. Transient infra failures (Tableland /
      // RPC rate limits surface as 'Internal server error') must NOT 403 the
      // user's own freshly-submitted onboarding response — the client can't
      // distinguish a 403 from "not ready yet" and would poll until timeout,
      // so a transient error here used to stall onboarding indefinitely.
      const DEFINITIVE_ACCESS_DENIALS = [
        'User is not a manager of the team',
        'User does not own the citizen nft',
      ]
      if (!hasAccess && error && DEFINITIVE_ACCESS_DENIALS.includes(error)) {
        return res.status(403).json({ message: 'Access denied to this response' })
      }

      return res.status(200).json({ answers })
    }

    const privyUserData = await getPrivyUserData(accessToken as string)
    if (!privyUserData) {
      return res.status(401).json({ message: 'Invalid access token' })
    }

    const { walletAddresses } = privyUserData

    // Profile updates: verify on-chain ownership before returning answers.
    const { hasAccess, error, formIds } = await hasAccessToResponse(
      walletAddresses,
      responseId as string
    )

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
