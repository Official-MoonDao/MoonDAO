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
      subdivision,
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
