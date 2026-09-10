import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { eligibilityMessage, isHexAddress } from '@/lib/deprize/eligibility'
import { runEligibilityChecks } from '@/lib/deprize/runEligibility'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const walletRaw = typeof req.query.wallet === 'string' ? req.query.wallet : ''
  const wallet = walletRaw ? walletRaw.trim() : null
  if (wallet && !isHexAddress(wallet)) {
    return res.status(400).json({
      allowed: false,
      reason: 'invalid-wallet',
      country: null,
      message: eligibilityMessage('invalid-wallet'),
    })
  }

  const decision = await runEligibilityChecks(req, wallet)
  return res.status(200).json({
    ...decision,
    message: eligibilityMessage(decision.reason),
  })
}

export default withMiddleware(handler, rateLimit)
