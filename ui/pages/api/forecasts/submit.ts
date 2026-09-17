import { authMiddleware } from 'middleware/authMiddleware'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { DePrizeState } from '@/lib/deprize/constants'
import { resolveLiveDePrizeId } from '@/lib/deprize/competitions'
import { readServerMarket } from '@/lib/deprize/serverMarket'
import { parseBookParams } from '@/lib/forecasts/bookParams'
import {
  FORECAST_COOLDOWN_MS,
  FORECAST_MAX_ENTRIES_PER_UTC_DAY,
  forecastChainId,
} from '@/lib/forecasts/constants'
import { sanitizeDisplayName } from '@/lib/forecasts/displayName'
import { privyUserIdFromRequest } from '@/lib/forecasts/identity'
import { UnknownForecastSchemaError } from '@/lib/forecasts/schema'
import {
  entriesOnUtcDay,
  getForecastRedis,
  readHistory,
  readLatest,
  readVoid,
  writeForecast,
  writeProfile,
  writeVoid,
} from '@/lib/forecasts/store'
import { serializeLatest, validateWeights } from '@/lib/forecasts/weights'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const book = parseBookParams(req.body ?? {})
  if (!book.ok) return res.status(400).json({ error: book.error })

  const parsed = validateWeights(req.body?.weights)
  if (!parsed.ok) {
    return res.status(400).json({ error: 'invalid-weights', rule: parsed.rule })
  }

  const userId = await privyUserIdFromRequest(req)
  if (!userId) return res.status(401).json({ error: 'unauthorized' })

  const redis = getForecastRedis()
  if (!redis) return res.status(503).json({ error: 'store-unavailable' })

  const liveTipId = resolveLiveDePrizeId(book.chainSlug, book.deprizeId)
  if (liveTipId !== book.deprizeId) {
    try {
      await writeVoid(redis, book.chainSlug, book.deprizeId, {
        v: 1,
        reason: 'superseded',
        at: new Date().toISOString(),
        liveTipId,
      })
    } catch {
      // Tombstone is best-effort; the 409 is the user-facing contract.
    }
    return res.status(409).json({
      error: 'superseded',
      liveTipId,
    })
  }

  try {
    const tombstone = await readVoid(redis, book.chainSlug, book.deprizeId)
    if (tombstone) {
      return res.status(409).json({
        error: 'void',
        reason: tombstone.reason,
        liveTipId: tombstone.liveTipId,
      })
    }
  } catch (err) {
    if (err instanceof UnknownForecastSchemaError) {
      return res.status(409).json({ error: 'unknown-schema' })
    }
    throw err
  }

  const chainId = forecastChainId(book.chainSlug)
  if (chainId != null) {
    try {
      const snap = await readServerMarket({
        chainSlug: book.chainSlug,
        chainId,
        deprizeId: book.deprizeId,
        numOutcomes: parsed.weights.length,
        registryState: DePrizeState.OPEN,
      })
      if (snap && snap.payoutDenominator > 0n) {
        return res.status(409).json({ error: 'market-reported' })
      }
      if (snap && snap.marginalPrices.length !== parsed.weights.length) {
        return res.status(400).json({ error: 'invalid-weights', rule: 'length' })
      }
    } catch {
      return res.status(503).json({ error: 'market-unavailable' })
    }
  }

  let history
  let latest
  try {
    latest = await readLatest(redis, book.chainSlug, book.deprizeId, userId)
    history = await readHistory(redis, book.chainSlug, book.deprizeId, userId)
  } catch (err) {
    if (err instanceof UnknownForecastSchemaError) {
      return res.status(409).json({ error: 'unknown-schema' })
    }
    throw err
  }

  const now = new Date()
  const at = now.toISOString()
  if (latest && Date.parse(latest.updatedAt) + FORECAST_COOLDOWN_MS > now.getTime()) {
    const retryAfterSec = Math.ceil(
      (Date.parse(latest.updatedAt) + FORECAST_COOLDOWN_MS - now.getTime()) / 1000
    )
    return res.status(429).json({ error: 'cooldown', retryAfterSec })
  }

  const day = at.slice(0, 10)
  if (entriesOnUtcDay(history, day) >= FORECAST_MAX_ENTRIES_PER_UTC_DAY) {
    return res.status(429).json({ error: 'daily-cap', retryAfterSec: 3600 })
  }

  const stored = serializeLatest(parsed.weights, at)
  await writeForecast({
    redis,
    chainSlug: book.chainSlug,
    deprizeId: book.deprizeId,
    userId,
    latest: stored,
    historyEntry: { v: 1, at, vector: stored.vector },
  })

  if (req.body?.profileOptIn === true || typeof req.body?.displayName === 'string') {
    await writeProfile(redis, userId, {
      v: 1,
      displayName: sanitizeDisplayName(String(req.body?.displayName || '')),
      optIn: req.body?.profileOptIn === true,
      updatedAt: at,
    })
  }

  return res.status(200).json({
    ok: true,
    vector: stored.vector,
    weights: stored.weights,
    updatedAt: stored.updatedAt,
    calls: history.length + 1,
  })
}

export default withMiddleware(handler, authMiddleware, rateLimit)
