import { authMiddleware } from 'middleware/authMiddleware'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import type { Hex } from 'viem'
import { hashIp, recordTermsAcceptance } from '@/lib/deprize/acceptanceLog'
import {
  mintAddressForChain,
  permitTtlSeconds,
  signCompliancePermit,
} from '@/lib/deprize/compliancePermit'
import { DEPRIZE_TERMS_VERSION } from '@/lib/deprize/constants'
import { eligibilityMessage, isNonProdBypassEnabled } from '@/lib/deprize/eligibility'
import { runEligibilityChecks } from '@/lib/deprize/runEligibility'
import { walletFromSession } from '@/lib/deprize/sessionWallet'
import { getClientIp, getCountryFromHeaders } from '@/lib/geo'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const claimedWallet = typeof req.body?.wallet === 'string' ? req.body.wallet.trim() : ''
  const wallet = await walletFromSession(req, res, claimedWallet)
  const deprizeId = Number(req.body?.deprizeId)
  const chainId = Number(req.body?.chainId)
  const accepted = req.body?.accepted === true
  const requestedTermsVersion =
    typeof req.body?.termsVersion === 'string' ? req.body.termsVersion.trim() : ''

  if (!wallet) {
    return res.status(400).json({
      allowed: false,
      reason: 'invalid-wallet',
      message: eligibilityMessage('invalid-wallet'),
    })
  }
  if (!Number.isInteger(deprizeId) || deprizeId < 0) {
    return res.status(400).json({ error: 'Invalid deprizeId' })
  }
  if (!Number.isInteger(chainId) || chainId <= 0) {
    return res.status(400).json({ error: 'Invalid chainId' })
  }
  if (!accepted || requestedTermsVersion !== DEPRIZE_TERMS_VERSION) {
    return res.status(400).json({
      allowed: false,
      reason: 'terms-not-accepted',
      message: eligibilityMessage('terms-not-accepted'),
    })
  }

  const mintAddress = mintAddressForChain(chainId)
  if (!/^0x[a-fA-F0-9]{40}$/.test(mintAddress)) {
    return res.status(503).json({
      allowed: false,
      reason: 'permit-unavailable',
      message: eligibilityMessage('permit-unavailable'),
    })
  }

  const decision = await runEligibilityChecks(req, wallet)
  if (!decision.allowed) {
    return res.status(403).json({
      ...decision,
      message: eligibilityMessage(decision.reason),
    })
  }

  const termsVersion = DEPRIZE_TERMS_VERSION
  const logged = await recordTermsAcceptance({
    wallet,
    termsVersion,
    timestamp: new Date().toISOString(),
    country: decision.country ?? getCountryFromHeaders(req),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 180),
    ipHash: hashIp(getClientIp(req)),
  })
  if (!logged && !isNonProdBypassEnabled()) {
    return res.status(503).json({
      allowed: false,
      reason: 'screening-unavailable',
      message: 'Could not record acceptance. Try again shortly.',
    })
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + permitTtlSeconds())
  try {
    const signature = await signCompliancePermit({
      wallet: wallet as Hex,
      deprizeId: BigInt(deprizeId),
      deadline,
      chainId,
      mintAddress: mintAddress as Hex,
    })
    return res.status(200).json({
      allowed: true,
      reason: decision.reason,
      country: decision.country,
      deadline: deadline.toString(),
      signature,
      mintAddress,
    })
  } catch (err) {
    console.error('[deprize] permit sign failed', err)
    return res.status(503).json({
      allowed: false,
      reason: 'permit-unavailable',
      message: eligibilityMessage('permit-unavailable'),
    })
  }
}

export default withMiddleware(handler, authMiddleware, rateLimit)
