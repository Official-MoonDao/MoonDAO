import { authMiddleware } from 'middleware/authMiddleware'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { DePrizeState, resolvePayoutVector } from '@/lib/deprize/constants'
import { resolveLiveDePrizeId } from '@/lib/deprize/competitions'
import { readServerMarket } from '@/lib/deprize/serverMarket'
import { parseBookParams } from '@/lib/forecasts/bookParams'
import { forecastChainId } from '@/lib/forecasts/constants'
import { brierScore, brierSkillScore, timeAveragedBrier } from '@/lib/forecasts/brier'
import { privyUserIdFromRequest } from '@/lib/forecasts/identity'
import { UnknownForecastSchemaError } from '@/lib/forecasts/schema'
import {
  getForecastRedis,
  readHistory,
  readLatest,
  readVoid,
  writeVoid,
} from '@/lib/forecasts/store'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const book = parseBookParams(req.query)
  if (!book.ok) return res.status(400).json({ error: book.error })

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
      // Observable tombstone is best-effort.
    }
  }

  try {
    const tombstone = await readVoid(redis, book.chainSlug, book.deprizeId)
    const latest = await readLatest(redis, book.chainSlug, book.deprizeId, userId)
    const history = await readHistory(redis, book.chainSlug, book.deprizeId, userId)

    if (tombstone) {
      return res.status(200).json({
        weights: latest?.weights ?? null,
        vector: latest?.vector ?? null,
        updatedAt: latest?.updatedAt ?? null,
        calls: history.length,
        scoreState: 'void',
        reason: tombstone.reason,
        liveTipId: tombstone.liveTipId,
      })
    }

    const chainId = forecastChainId(book.chainSlug)
    let scoreState: string = 'awaiting-resolution'
    let score: Record<string, unknown> | undefined
    if (chainId != null) {
      const snap = await readServerMarket({
        chainSlug: book.chainSlug,
        chainId,
        deprizeId: book.deprizeId,
        numOutcomes: latest?.vector.length ?? history[0]?.vector.length ?? 2,
        registryState: DePrizeState.OPEN,
      }).catch(() => null)
      if (snap && snap.payoutDenominator > 0n) {
        const interpreted = resolvePayoutVector(snap.payoutNumerators, snap.payoutDenominator)
        if (interpreted.isRefundVector) {
          scoreState = 'not-scorable'
        } else if (snap.resolvedAtMs == null) {
          scoreState = 'awaiting-resolution-timestamp'
        } else if (latest) {
          const den = Number(snap.payoutDenominator)
          const resolvedVector = snap.payoutNumerators.map((n) => Number(n) / den)
          try {
            const averaged = timeAveragedBrier(
              history,
              new Date(snap.resolvedAtMs).toISOString(),
              resolvedVector
            )
            if (averaged) {
              const skill = brierSkillScore(averaged.brier, resolvedVector)
              scoreState = 'scored'
              score = {
                rawBrier: averaged.brier,
                skill,
                daysScored: averaged.daysScored,
                lastBrier: brierScore(latest.vector, resolvedVector),
              }
            } else {
              scoreState = 'awaiting-resolution'
            }
          } catch {
            scoreState = 'not-scorable'
          }
        }
      }
    }

    return res.status(200).json({
      weights: latest?.weights ?? null,
      vector: latest?.vector ?? null,
      updatedAt: latest?.updatedAt ?? null,
      calls: history.length,
      scoreState,
      score,
    })
  } catch (err) {
    if (err instanceof UnknownForecastSchemaError) {
      return res.status(409).json({ error: 'unknown-schema' })
    }
    throw err
  }
}

export default withMiddleware(handler, authMiddleware, rateLimit)
