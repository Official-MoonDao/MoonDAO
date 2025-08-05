import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { getPrivyUserData } from '@/lib/privy'
import {
  hasAccessToResponse,
  fetchResponseFromFormIds,
} from '@/lib/typeform/hasAccessToResponse'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed')
  }

  const { accessToken, formId, responseId } = req.body

  try {
    // Validate required parameters
    if (!formId || !responseId) {
      return res.status(400).json({ message: 'Missing formId or responseId' })
    }

    if (!process.env.TYPEFORM_PERSONAL_ACCESS_TOKEN) {
      console.error('TYPEFORM_PERSONAL_ACCESS_TOKEN is not set')
      return res.status(500).json({ message: 'Server configuration error' })
    }

    // Get user data from Privy
    const privyUserData = await getPrivyUserData(accessToken as string)

    if (!privyUserData) {
      return res.status(401).json({ message: 'Invalid access token' })
    }

    const { walletAddresses } = privyUserData

    // Check if user has access to this response
    const { hasAccess, error, type, formIds } = await hasAccessToResponse(
      walletAddresses,
      responseId
    )

    if (!hasAccess) {
      return res.status(401).json({ message: error || 'Access denied' })
    }

    // First, find which form contains the response
    let targetFormId = formId
    if (formIds && formIds.length > 0) {
      const responseData = await fetchResponseFromFormIds(formIds, responseId)
      if (responseData && responseData.items && responseData.items.length > 0) {
        // Find the form ID from the response metadata or try each form
        for (const fId of formIds) {
          try {
            const checkRes = await fetch(
              `https://api.typeform.com/forms/${fId}/responses?included_response_ids=${responseId}`,
              {
                headers: {
                  Authorization: `Bearer ${process.env.TYPEFORM_PERSONAL_ACCESS_TOKEN}`,
                },
              }
            )
            if (checkRes.ok) {
              const checkData = await checkRes.json()
              if (checkData.total_items > 0) {
                targetFormId = fId
                break
              }
            }
          } catch (error) {
            continue
          }
        }
      }
    }

    // Delete the response from Typeform
    const deleteRes = await fetch(
      `https://api.typeform.com/forms/${targetFormId}/responses?included_response_ids=${responseId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${process.env.TYPEFORM_PERSONAL_ACCESS_TOKEN}`,
        },
      }
    )

    const data = await deleteRes.json()

    return res.status(200).json(data)
  } catch (error) {
    console.error('Error in typeform delete-response handler:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

export default withMiddleware(handler, authMiddleware)
