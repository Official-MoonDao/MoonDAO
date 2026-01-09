import { Redis } from '@upstash/redis'
import { authMiddleware } from 'middleware/authMiddleware'
import { secureHeaders } from 'middleware/secureHeaders'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import {
  validateCDPCredentials,
  makeCDPRequest,
  handleAPIError,
  BuyQuoteRequest,
} from '../../../lib/coinbase'
import { detectUserState, isValidUSState } from '../../../lib/geo'

// Initialize Redis client for geolocation caching
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
})

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  secureHeaders(res)

  try {
    const {
      paymentAmount,
      destinationAddress,
      purchaseNetwork = 'ethereum',
      paymentCurrency = 'USD',
      purchaseCurrency = 'ETH',
      country = 'US',
      subdivision,
      paymentMethod = 'CARD',
      channelId,
    }: BuyQuoteRequest = req.body

    if (!paymentAmount || !destinationAddress) {
      return res.status(400).json({
        error:
          'Payment amount or purchase amount and destination address are required',
      })
    }

    // Detect user's US state if not provided
    let detectedSubdivision = subdivision
    if (!detectedSubdivision) {
      try {
        const stateCode = await detectUserState(req, redis)
        if (stateCode && isValidUSState(stateCode)) {
          detectedSubdivision = stateCode
        }
      } catch (error) {
        console.error('Error detecting state:', error)
      }
    }

    // For US users, subdivision (state) is required by Coinbase
    if (country === 'US' && !detectedSubdivision) {
      return res.status(400).json({
        error: 'State (subdivision) is required for US users',
        details: 'Unable to detect your state automatically. Please provide a subdivision (state code) in your request.',
      })
    }

    // Validate CDP credentials
    const credentials = validateCDPCredentials()

    // Prepare request body for buy quote
    // Use purchaseAmount (crypto amount) if provided, otherwise use paymentAmount (fiat amount)
    const requestBody: any = {
      country,
      destinationAddress,
      paymentMethod,
      purchaseCurrency,
      purchaseNetwork,
    }

    // Only include subdivision if we have a valid value
    if (detectedSubdivision) {
      requestBody.subdivision = detectedSubdivision
    }

    requestBody.paymentAmount = paymentAmount.toString()
    requestBody.paymentCurrency = paymentCurrency

    // Call CDP buy quote endpoint
    const response = await makeCDPRequest(
      '/onramp/v1/buy/quote',
      'POST',
      requestBody,
      credentials
    )

    if (!response.ok) {
      const errorData = await response.text()
      return res.status(response.status).json({
        error: 'Failed to get buy quote',
        details: errorData,
        status: response.status,
      })
    }

    const data = await response.json()

    // Extract relevant quote information
    return res.status(200).json({
      quote: data,
      purchaseAmount: data.purchaseAmount,
      paymentTotal: data.paymentTotal,
      coinbaseFee: data.coinbaseFee,
      networkFee: data.networkFee,
      quoteId: data.quoteId,
    })
  } catch (error: any) {
    const errorResponse = handleAPIError(error, 'buy quote generation')
    return res.status(errorResponse.status).json(errorResponse.body)
  }
}

export default withMiddleware(handler, authMiddleware)
