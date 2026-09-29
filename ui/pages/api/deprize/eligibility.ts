import { authMiddleware } from 'middleware/authMiddleware'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { eligibilityMessage, shouldMockSepoliaEligibility } from '@/lib/deprize/eligibility'
import { countryForDePrize } from '@/lib/deprize/mockCountry'
import { mockedEligibilityResult, runEligibilityChecks } from '@/lib/deprize/runEligibility'
import { getCountryFromHeaders } from '@/lib/geo'
import { walletFromSession } from '@/lib/deprize/sessionWallet'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const claimedWallet = typeof req.query.wallet === 'string' ? req.query.wallet.trim() : ''
  const wallet = await walletFromSession(req, res, claimedWallet || null)
  if (claimedWallet && !wallet) {
    return res.status(400).json({
      allowed: false,
      reason: 'invalid-wallet',
      country: null,
      message: eligibilityMessage('invalid-wallet'),
    })
  }

  const chainId = Number(req.query.chainId)
  if (shouldMockSepoliaEligibility(chainId)) {
    const mockHeader = req.headers['x-deprize-mock-country']
    const decision = mockedEligibilityResult(
      countryForDePrize({
        headerCountry: getCountryFromHeaders(req),
        mockHeader: Array.isArray(mockHeader) ? mockHeader[0] : mockHeader,
      })
    )
    return res.status(200).json({
      ...decision,
      message: eligibilityMessage(decision.reason),
    })
  }

  const decision = await runEligibilityChecks(req, wallet, { surface: 'eligibility' })
  return res.status(200).json({
    ...decision,
    message: eligibilityMessage(decision.reason),
  })
}

export default withMiddleware(handler, authMiddleware, rateLimit)
