import { Redis } from '@upstash/redis'
import { authMiddleware } from 'middleware/authMiddleware'
import { secureHeaders } from 'middleware/secureHeaders'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import {
  validateCDPCredentials,
  makeCDPV2Request,
  handleAPIError,
  CreateOnrampOrderRequest,
  OnrampOrderPaymentMethod,
} from '../../../lib/coinbase'
import {
  detectUserState,
  isValidUSState,
  getCountryFromHeaders,
  getClientIp,
} from '../../../lib/geo'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
})

const MOCK_ONRAMP = process.env.NEXT_PUBLIC_MOCK_ONRAMP === 'true'
const VERIFICATION_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000 // 60 days

const VALID_PAYMENT_METHODS: OnrampOrderPaymentMethod[] = [
  'GUEST_CHECKOUT_APPLE_PAY',
  'GUEST_CHECKOUT_GOOGLE_PAY',
]

// Map a thirdweb/viem chain to the Coinbase onramp network name.
function getOnrampNetworkName(chain: any): string {
  const chainName = chain?.name?.toLowerCase() || ''
  const chainId = chain?.id

  switch (chainName) {
    case 'arbitrum':
    case 'arbitrum one':
    case 'arbitrum sepolia':
      return 'arbitrum'
    case 'base':
    case 'base sepolia':
    case 'base sepolia testnet':
      return 'base'
    case 'polygon':
      return 'polygon'
    case 'optimism':
      return 'optimism'
    case 'ethereum':
    case 'mainnet':
    case 'sepolia':
      return 'ethereum'
    default:
      switch (chainId) {
        case 42161:
        case 421614:
          return 'arbitrum'
        case 8453:
        case 84532:
          return 'base'
        case 137:
          return 'polygon'
        case 10:
        case 11155420:
          return 'optimism'
        case 1:
        case 11155111:
          return 'ethereum'
        default:
          return 'arbitrum'
      }
  }
}

// Map known v2 error types to clearer, user-facing messages.
function friendlyErrorForType(errorType?: string, fallback?: string): string {
  switch (errorType) {
    case 'guest_region_forbidden':
      return 'Coinbase guest checkout is not available in your region. Try MoonPay instead, or sign in with a Coinbase account.'
    case 'guest_permission_denied':
      return 'Your account is not permitted to use Coinbase guest checkout. Try MoonPay instead, or sign in with a Coinbase account.'
    case 'guest_transaction_limit':
      return 'This purchase would exceed your weekly Coinbase guest limit. Please try a smaller amount or wait until next week.'
    case 'guest_transaction_count':
      return 'You have reached the lifetime Coinbase guest checkout limit. Please sign in with a Coinbase account.'
    case 'phone_number_verification_expired':
      return 'Your phone number verification has expired. Please re-verify your phone number and try again.'
    case 'network_not_tradable':
      return 'The selected asset cannot be purchased on this network in your location.'
    default:
      return fallback || 'Unable to create the Coinbase order. Please try again.'
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  secureHeaders(res)

  try {
    const {
      destinationAddress,
      selectedChain,
      destinationNetwork: providedNetwork,
      ethAmount,
      paymentMethod,
      email,
      phoneNumber,
      phoneNumberVerifiedAt,
      agreementAcceptedAt,
      partnerUserRef,
      domain: providedDomain,
    } = req.body || {}

    // Required field validation
    if (!destinationAddress) {
      return res.status(400).json({ error: 'destinationAddress is required' })
    }
    if (!email || !phoneNumber) {
      return res
        .status(400)
        .json({ error: 'A verified email and phone number are required' })
    }
    if (!phoneNumberVerifiedAt) {
      return res.status(400).json({ error: 'phoneNumberVerifiedAt is required' })
    }
    if (!agreementAcceptedAt) {
      return res.status(400).json({
        error: 'You must accept the Coinbase guest checkout terms to continue',
      })
    }
    if (!partnerUserRef) {
      return res.status(400).json({ error: 'partnerUserRef is required' })
    }
    if (!ethAmount || Number(ethAmount) <= 0) {
      return res.status(400).json({ error: 'A valid ethAmount is required' })
    }

    const method: OnrampOrderPaymentMethod = VALID_PAYMENT_METHODS.includes(
      paymentMethod
    )
      ? paymentMethod
      : 'GUEST_CHECKOUT_APPLE_PAY'

    // Phone verification must be < 60 days old (Coinbase requirement)
    const verifiedAtMs = new Date(phoneNumberVerifiedAt).getTime()
    if (!Number.isFinite(verifiedAtMs)) {
      return res
        .status(400)
        .json({ error: 'phoneNumberVerifiedAt is not a valid date' })
    }
    if (Date.now() - verifiedAtMs > VERIFICATION_MAX_AGE_MS) {
      return res.status(400).json({
        error:
          'Your phone number verification has expired. Please re-verify your phone number and try again.',
        errorType: 'phone_number_verification_expired',
      })
    }

    // Headless guest onramp is US-only. Confirm the user is in the US.
    const headerCountry = getCountryFromHeaders(req)
    if (headerCountry && headerCountry !== 'US') {
      return res.status(403).json({
        error:
          'Coinbase Apple Pay / Google Pay checkout is only available in the US. Please use MoonPay instead.',
        errorType: 'guest_region_forbidden',
      })
    }

    // Best-effort US state detection (helps avoid region/asset mismatches).
    try {
      const stateCode = await detectUserState(req, redis)
      if (stateCode && !isValidUSState(stateCode)) {
        return res.status(403).json({
          error:
            'Coinbase Apple Pay / Google Pay checkout is only available in the US. Please use MoonPay instead.',
          errorType: 'guest_region_forbidden',
        })
      }
    } catch (error) {
      console.error('[create-onramp-order] state detection error:', error)
    }

    const destinationNetwork =
      providedNetwork || getOnrampNetworkName(selectedChain)

    // Sandbox orders never charge a real card — gate behind the mock flag.
    const userRef = MOCK_ONRAMP
      ? `sandbox-${partnerUserRef}`
      : String(partnerUserRef)

    const clientIp = getClientIp(req)

    const orderBody: CreateOnrampOrderRequest & { clientIp?: string } = {
      destinationAddress,
      destinationNetwork,
      purchaseAmount: Number(ethAmount).toFixed(8),
      purchaseCurrency: 'ETH',
      paymentCurrency: 'USD',
      paymentMethod: method,
      email,
      phoneNumber,
      phoneNumberVerifiedAt,
      agreementAcceptedAt,
      partnerUserRef: userRef,
      ...(providedDomain ? { domain: providedDomain } : {}),
      ...(clientIp && clientIp !== '0.0.0.0' ? { clientIp } : {}),
    }

    const credentials = validateCDPCredentials()

    const response = await makeCDPV2Request(
      '/platform/v2/onramp/orders',
      'POST',
      orderBody,
      credentials
    )

    if (!response.ok) {
      const errorText = await response.text()
      let parsed: any
      try {
        parsed = JSON.parse(errorText)
      } catch {
        parsed = { errorMessage: errorText }
      }

      console.error('[create-onramp-order] CDP error:', {
        status: response.status,
        errorType: parsed?.errorType,
        errorMessage: parsed?.errorMessage,
        correlationId: parsed?.correlationId,
      })

      return res.status(response.status).json({
        error: friendlyErrorForType(parsed?.errorType, parsed?.errorMessage),
        errorType: parsed?.errorType,
        details: parsed?.errorMessage,
      })
    }

    const data = await response.json()

    return res.status(200).json({
      order: data?.order,
      paymentLink: data?.paymentLink,
    })
  } catch (error: any) {
    const errorResponse = handleAPIError(error, 'create onramp order')
    return res.status(errorResponse.status).json(errorResponse.body)
  }
}

export default withMiddleware(handler, authMiddleware)
