import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import type { Hex } from 'viem'
import { hashIp } from '@/lib/deprize/acceptanceLog'
import { EMPTY_ATTESTATIONS } from '@/lib/deprize/attestations'
import {
  complianceSignerAddress,
  mintAddressForChain,
  permitTtlSeconds,
  signCompliancePermit,
} from '@/lib/deprize/compliancePermit'
import { DEPRIZE_TERMS_VERSION } from '@/lib/deprize/constants'
import { verifyHouseAgentRequest } from '@/lib/deprize/houseAgents'
import { buildPermitIssuanceRecord, recordPermitIssuance } from '@/lib/deprize/permitLog'
import { screenWallet } from '@/lib/deprize/sanctions'
import { getClientIp } from '@/lib/geo'

// Permits for MoonDAO's labeled house agent wallets (lib/deprize/houseAgents.ts).
// Public bettors use /api/deprize/permit.
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const check = verifyHouseAgentRequest(req.body, Date.now())
  if (!check.ok) {
    return res.status(check.status).json({ allowed: false, error: check.error })
  }
  const { wallet, deprizeId, chainId } = check.request

  const mintAddress = mintAddressForChain(chainId)
  if (!/^0x[a-fA-F0-9]{40}$/.test(mintAddress) || !complianceSignerAddress()) {
    return res.status(503).json({ allowed: false, error: 'Permits are unavailable' })
  }

  const sanctions = await screenWallet(wallet)
  if (sanctions.failed) {
    return res.status(503).json({ allowed: false, error: 'Screening unavailable' })
  }
  if (sanctions.isSanctioned) {
    return res.status(403).json({ allowed: false, error: 'This wallet cannot participate' })
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
    const issuance = buildPermitIssuanceRecord({
      wallet: wallet as Hex,
      deprizeId: BigInt(deprizeId),
      deadline,
      chainId,
      mintAddress: mintAddress as Hex,
      issuedAt: new Date().toISOString(),
      country: null,
      region: null,
      ipHash: hashIp(getClientIp(req)) ?? '',
      connectionKind: 'hosting',
      eligibilityReason: 'house-agent',
      termsVersion: DEPRIZE_TERMS_VERSION,
      attestations: EMPTY_ATTESTATIONS,
    })
    if (!(await recordPermitIssuance(issuance))) {
      return res.status(503).json({ allowed: false, error: 'Could not record the permit' })
    }
    return res.status(200).json({
      allowed: true,
      deadline: deadline.toString(),
      signature,
      mintAddress,
      permitHash: issuance.permitHash,
    })
  } catch (err) {
    console.error('[deprize] house agent permit failed', err)
    return res.status(503).json({ allowed: false, error: 'Permits are unavailable' })
  }
}

export default withMiddleware(handler, rateLimit)
