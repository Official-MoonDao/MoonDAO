import { secureHeaders } from 'middleware/secureHeaders'
import { NextApiRequest, NextApiResponse } from 'next'
import {
  validateCDPCredentials,
  makeCDPRequest,
  handleAPIError,
  SessionTokenRequest,
} from '../../../lib/coinbase'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  secureHeaders(res)

  try {
    const {
      address,
      blockchains = ['ethereum', 'base'],
      assets = ['ETH', 'USDC'],
    }: SessionTokenRequest = req.body

    if (!address) {
      return res.status(400).json({ error: 'Address is required' })
    }

    // Validate CDP credentials
    const credentials = validateCDPCredentials()

    // Prepare request body for CDP session token API
    const requestBody = {
      addresses: [
        {
          address: address,
          blockchains: blockchains,
        },
      ],
      assets: assets,
    }

    // Call CDP session token endpoint
    const response = await makeCDPRequest(
      '/onramp/v1/token',
      'POST',
      requestBody,
      credentials
    )

    if (!response.ok) {
      const errorData = await response.text()
      return res.status(response.status).json({
        error: 'Failed to generate session token',
        details: errorData,
        status: response.status,
      })
    }

    const data = await response.json()

    return res.status(200).json({
      sessionToken: data?.token,
      channelId: data?.channel_id,
    })
  } catch (error: any) {
    const errorResponse = handleAPIError(error, 'session token generation')
    return res.status(errorResponse.status).json(errorResponse.body)
  }
}
