import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getAddress } from 'viem'
import { hashIp, recordTermsAcceptance } from '@/lib/deprize/acceptanceLog'
import { areAttestationsAccepted } from '@/lib/deprize/attestations'
import { DEPRIZE_TERMS_VERSION } from '@/lib/deprize/constants'
import { eligibilityMessage, isHexAddress } from '@/lib/deprize/eligibility'
import { getClientIp, getCountryFromHeaders, getRegionFromHeaders } from '@/lib/geo'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const walletRaw = typeof req.body?.wallet === 'string' ? req.body.wallet.trim() : ''
  const termsVersion =
    typeof req.body?.termsVersion === 'string' && req.body.termsVersion.trim()
      ? req.body.termsVersion.trim()
      : DEPRIZE_TERMS_VERSION
  const accepted = req.body?.accepted === true

  if (!isHexAddress(walletRaw)) {
    return res.status(400).json({
      ok: false,
      reason: 'invalid-wallet',
      message: eligibilityMessage('invalid-wallet'),
    })
  }
  if (!accepted || !areAttestationsAccepted(req.body?.attestations)) {
    return res.status(400).json({
      ok: false,
      reason: 'terms-not-accepted',
      message: eligibilityMessage('terms-not-accepted'),
    })
  }

  const wallet = getAddress(walletRaw)
  const logged = await recordTermsAcceptance({
    wallet,
    termsVersion,
    timestamp: new Date().toISOString(),
    country: getCountryFromHeaders(req),
    region: getRegionFromHeaders(req),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 180),
    ipHash: hashIp(getClientIp(req)),
    attestations: req.body.attestations,
    surface: 'accept-terms',
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

export default withMiddleware(handler, rateLimit)
