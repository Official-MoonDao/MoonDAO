import { secureHeaders } from 'middleware/secureHeaders'
import { NextApiRequest, NextApiResponse } from 'next'
import {
  validateCDPCredentials,
  makeCDPRequest,
  handleAPIError,
  BuyQuoteRequest,
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
      paymentAmount,
      destinationAddress,
      purchaseNetwork = 'ethereum',
      paymentCurrency = 'USD',
      purchaseCurrency = 'ETH',
      country = 'US',
      subdivision = 'NY',
      paymentMethod = 'CARD',
    }: BuyQuoteRequest = req.body

    if (!paymentAmount || !destinationAddress) {
      return res.status(400).json({
        error: 'Payment amount and destination address are required',
      })
    }

    // Validate CDP credentials
    const credentials = validateCDPCredentials()

    // Prepare request body for buy quote
    const requestBody = {
      country,
      destinationAddress,
      paymentAmount: paymentAmount.toString(),
      paymentCurrency,
      paymentMethod,
      purchaseCurrency,
      purchaseNetwork,
      subdivision,
    }

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
