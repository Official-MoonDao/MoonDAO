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
import { detectUserState, isValidUSState, getCountryFromHeaders } from '../../../lib/geo'

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
      country: providedCountry,
      subdivision,
      paymentMethod,
      channelId,
    }: BuyQuoteRequest = req.body

    if (!paymentAmount || !destinationAddress) {
      return res.status(400).json({
        error: 'Payment amount or purchase amount and destination address are required',
      })
    }

    // Detect country from headers if not provided
    const headerCountry = getCountryFromHeaders(req)
    let country = providedCountry || headerCountry || 'US'

    // Detect user's US state if not provided and country is US
    let detectedSubdivision = subdivision
    if (!detectedSubdivision && country === 'US') {
      try {
        const stateCode = await detectUserState(req, redis)
        if (stateCode && isValidUSState(stateCode)) {
          detectedSubdivision = stateCode
        }
      } catch (error) {
        console.error('Error detecting state:', error)
      }
    }

    const isConfirmedUS = country === 'US' && (providedCountry === 'US' || headerCountry === 'US')
    if (isConfirmedUS && !detectedSubdivision) {
      return res.status(400).json({
        error: 'State (subdivision) is required for US users',
        details:
          'Unable to detect your state automatically. Please provide a subdivision (state code) in your request.',
      })
    }

    // Validate CDP credentials
    const credentials = validateCDPCredentials()

    // Enforce minimum payment amount for card transactions
    // Coinbase requires minimum $2 USD for card purchases
    const MINIMUM_USD_AMOUNT = 2
    let adjustedPaymentAmount = parseFloat(paymentAmount.toString())

    if (paymentCurrency === 'USD' && adjustedPaymentAmount < MINIMUM_USD_AMOUNT) {
      adjustedPaymentAmount = MINIMUM_USD_AMOUNT
    }

    // Prepare request body for buy quote
    // Use purchaseAmount (crypto amount) if provided, otherwise use paymentAmount (fiat amount)
    const requestBody: any = {
      country,
      destinationAddress,
      purchaseCurrency,
      purchaseNetwork,
      paymentAmount: adjustedPaymentAmount.toString(),
      paymentCurrency,
    }

    if (!paymentMethod) {
      // CARD works in US (debit only) and 90+ other countries
      // This is safer than UNSPECIFIED which may not be accepted
      requestBody.paymentMethod = 'CARD'
    } else {
      requestBody.paymentMethod = paymentMethod
    }

    // Only include subdivision if we have a valid value
    if (detectedSubdivision) {
      requestBody.subdivision = detectedSubdivision
    }

    // Log request body for debugging (remove sensitive data in production)
    console.log('[buy-quote] Request body:', {
      ...requestBody,
      destinationAddress: requestBody.destinationAddress?.substring(0, 10) + '...',
    })

    // Call CDP buy quote endpoint
    const response = await makeCDPRequest('/onramp/v1/buy/quote', 'POST', requestBody, credentials)

    if (!response.ok) {
      const errorData = await response.text()
      let parsedError
      try {
        parsedError = JSON.parse(errorData)
      } catch {
        parsedError = { message: errorData }
      }

      // Provide clearer error messages for common issues
      if (
        parsedError.message?.includes('payment method') &&
        parsedError.message?.includes('not supported')
      ) {
        return res.status(response.status).json({
          error: 'Payment method not supported for this country',
          details: parsedError.message || errorData,
          status: response.status,
          suggestion:
            'Please specify a supported payment method for your country, or omit paymentMethod to use Coinbase defaults.',
        })
      }

      return res.status(response.status).json({
        error: 'Failed to get buy quote',
        details: parsedError.message || errorData,
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
