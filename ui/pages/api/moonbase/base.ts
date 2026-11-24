/**
 * The My Moonbase layout saved to an account.
 *
 *   GET  ?wallet=0x…                              the caller's saved base, or null
 *   PUT  { wallet, layout, expected, force? }     save it; 409 with the saved copy when
 *                                                 `expected` is not the copy on record
 *
 * Both need a Privy session that owns `wallet`. Guests are admitted: a base is
 * built from free predictions, and a guest can make those.
 *
 * A shared base is read by its share id in pages/moonbase/base/[id].tsx, on
 * the server, so no route hands out a base by wallet to anyone but its owner.
 */
import { guestAuthMiddleware } from 'middleware/authMiddleware'
import { getTrustedClientIp, rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { SEED_ATLAS } from '@/lib/lunar-atlas/seed'
import { baseCallerWallet } from '@/lib/my-moonbase/baseAuth'
import {
  baseRedis,
  forgetVisitorPicks,
  readBaseByOwner,
  saveLimiter,
  writeBase,
} from '@/lib/my-moonbase/baseStore'
import { placeableAssetIds, sanitizeIncomingLayout } from '@/lib/my-moonbase/storedLayout'

export const config = { api: { bodyParser: { sizeLimit: '128kb' } } }

const ASSET_IDS = placeableAssetIds(SEED_ATLAS)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET' && req.method !== 'PUT') {
    res.setHeader('Allow', 'GET, PUT')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const redis = baseRedis()
  // 501, not 503: the builder retries a 503 and gives up on this.
  if (!redis) return res.status(501).json({ error: 'Saving is not set up on this server.' })

  try {
    const claimed = req.method === 'GET' ? req.query.wallet : req.body?.wallet
    const wallet = await baseCallerWallet(req, redis, Array.isArray(claimed) ? claimed[0] : claimed)
    if (!wallet) return res.status(401).json({ error: 'Sign in again to save your base.' })

    if (req.method === 'GET') {
      return res.status(200).json({ base: await readBaseByOwner(redis, wallet) })
    }

    const limited = await saveLimiter(redis).limit(`${wallet}:${getTrustedClientIp(req)}`)
    if (!limited.success) {
      return res.status(429).json({ error: 'Saving too often. Your base will save again shortly.' })
    }

    const layout = sanitizeIncomingLayout(req.body?.layout, ASSET_IDS)
    if (!layout) return res.status(400).json({ error: 'That is not a base this site can save.' })
    const expected =
      typeof req.body?.expected === 'number' && Number.isFinite(req.body.expected)
        ? req.body.expected
        : null

    const result = await writeBase(redis, wallet, layout, expected, {
      force: req.body?.force === true,
    })
    if (!result.ok) return res.status(409).json({ base: result.base })
    await forgetVisitorPicks(redis, wallet)
    return res.status(200).json({ id: result.base.id, updatedAt: result.base.updatedAt })
  } catch (err) {
    console.error('[my-moonbase] base save failed', err)
    return res.status(503).json({ error: 'Could not reach the save service. Try again.' })
  }
}

export default withMiddleware(handler, guestAuthMiddleware, rateLimit)
