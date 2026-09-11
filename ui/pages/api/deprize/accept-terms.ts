import { authMiddleware } from 'middleware/authMiddleware'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { hashIp, recordTermsAcceptance } from '@/lib/deprize/acceptanceLog'
import { DEPRIZE_TERMS_VERSION } from '@/lib/deprize/constants'
import { eligibilityMessage } from '@/lib/deprize/eligibility'
import { walletFromSession } from '@/lib/deprize/sessionWallet'
import { getClientIp, getCountryFromHeaders } from '@/lib/geo'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const claimedWallet = typeof req.body?.wallet === 'string' ? req.body.wallet.trim() : ''
  const wallet = await walletFromSession(req, res, claimedWallet)
  const requestedTermsVersion =
    typeof req.body?.termsVersion === 'string' ? req.body.termsVersion.trim() : ''
  const accepted = req.body?.accepted === true

  if (!wallet) {
    return res.status(400).json({
      ok: false,
      reason: 'invalid-wallet',
      message: eligibilityMessage('invalid-wallet'),
    })
  }
  if (!accepted || requestedTermsVersion !== DEPRIZE_TERMS_VERSION) {
    return res.status(400).json({
      ok: false,
      reason: 'terms-not-accepted',
      message: eligibilityMessage('terms-not-accepted'),
    })
  }

  const termsVersion = DEPRIZE_TERMS_VERSION
  const logged = await recordTermsAcceptance({
    wallet,
    termsVersion,
    timestamp: new Date().toISOString(),
    country: getCountryFromHeaders(req),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 180),
    ipHash: hashIp(getClientIp(req)),
  })

  if (!logged) {
    return res.status(503).json({
      ok: false,
      reason: 'screening-unavailable',
      message: 'Could not record acceptance. Try again shortly.',
    })
  }

  return res.status(200).json({ ok: true, wallet, termsVersion })
}

export default withMiddleware(handler, authMiddleware, rateLimit)
