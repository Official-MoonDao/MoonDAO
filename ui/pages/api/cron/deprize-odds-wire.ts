import type { NextApiRequest, NextApiResponse } from 'next'
import { DEPLOYED_ORIGIN } from 'const/config'
import { getDePrizeCompetition, resolveLiveDePrizeId } from '@/lib/deprize/competitions'
import { DePrizeState } from '@/lib/deprize/constants'
import {
  buildOddsWireEmbed,
  nextOddsWireSnapshot,
  oddsWireWatchIds,
  parseOddsWireSnapshot,
  planOddsWirePost,
  ODDS_WIRE_ALERT_STREAK,
} from '@/lib/deprize/oddsWire'
import { authorizeCronRequest, cronSecretFromRequest } from '@/lib/deprize/reconcile'
import { readServerMarket } from '@/lib/deprize/serverMarket'
import { postDiscordChannelMessage } from '@/lib/discord/postChannelMessage'
import { deprizeOutcomeLabels } from '@/lib/discord/outcomeLabels'
import { DEFAULT_DEPRIZE_CHAIN } from '@/lib/discord/prizeArg'
import { getOddsWireRedis, oddsWireKeys } from '@/lib/discord/oddsWireStore'
import { forecastChainId } from '@/lib/forecasts/constants'

type Health = {
  streak: number
  lastError?: string
  lastOkAt?: number
  lastPostAt?: number
}

async function maybeAlert(health: Health, prizeId: number, error: string) {
  if (health.streak < ODDS_WIRE_ALERT_STREAK) return
  if (health.streak !== ODDS_WIRE_ALERT_STREAK) return
  const url = process.env.DEPRIZE_OPS_ALERT_WEBHOOK_URL
  if (!url) return
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `Odds wire alert: sepolia #${prizeId} failed ${health.streak} runs. ${error}`,
    }),
  }).catch(() => {})
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = authorizeCronRequest({
    production: process.env.NEXT_PUBLIC_ENV === 'prod',
    expectedSecret: process.env.CRON_SECRET,
    providedSecret: cronSecretFromRequest(req),
  })
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message })

  const channelId = process.env.DEPRIZE_ODDS_WIRE_CHANNEL_ID
  const configured = /^\d{17,20}$/.test(channelId || '')
  const redis = getOddsWireRedis()
  const chainSlug = DEFAULT_DEPRIZE_CHAIN
  const chainId = forecastChainId(chainSlug) ?? 11155111
  const site = String(DEPLOYED_ORIGIN || 'https://moondao.com').replace(/\/$/, '')

  const skipped = {
    belowThreshold: 0,
    cooldown: 0,
    dailyCap: 0,
    marketClosed: 0,
    lockHeld: 0,
  }
  const rebaselined: Array<{ prizeId: string; reason: string }> = []
  const errors: string[] = []
  let posted = 0
  let checked = 0

  if (!configured) {
    errors.push('DEPRIZE_ODDS_WIRE_CHANNEL_ID unset or invalid')
    return res.status(500).json({
      ok: false,
      configured: false,
      checked: 0,
      posted: 0,
      skipped,
      rebaselined,
      errors,
    })
  }
  if (!redis) {
    errors.push('redis-unavailable')
    return res.status(500).json({
      ok: false,
      configured: true,
      checked: 0,
      posted: 0,
      skipped,
      rebaselined,
      errors,
    })
  }

  const ids = oddsWireWatchIds(chainSlug)
  for (const deprizeId of ids) {
    const keys = oddsWireKeys(chainSlug, deprizeId)
    try {
      const locked = await redis.set(keys.lock, '1', { nx: true, ex: 300 })
      if (!locked) {
        skipped.lockHeld += 1
        continue
      }
      checked += 1
      const labels = deprizeOutcomeLabels(chainSlug, deprizeId)
      const snap = await readServerMarket({
        chainSlug,
        chainId,
        deprizeId,
        numOutcomes: Math.max(labels.length, 2),
        registryState: DePrizeState.OPEN,
      })
      const liveTip = resolveLiveDePrizeId(chainSlug, deprizeId)
      const closed =
        !snap ||
        snap.shouldSurfaceResolution ||
        (liveTip != null && liveTip !== deprizeId)
      const current = snap?.probabilitiesNormalized ?? []
      const raw = await redis.get<string>(keys.snapshot)
      const rawPresent = raw != null && raw !== ''
      const previous = parseOddsWireSnapshot(
        typeof raw === 'string' || raw == null ? raw : JSON.stringify(raw)
      )
      const now = Date.now()
      const plan = planOddsWirePost({
        previous,
        current,
        closed,
        now,
        unparseable: rawPresent && !previous,
      })

      if (plan.reason === 'below-threshold') skipped.belowThreshold += 1
      if (plan.reason === 'cooldown') skipped.cooldown += 1
      if (plan.reason === 'daily-cap') skipped.dailyCap += 1
      if (plan.reason === 'market-closed') skipped.marketClosed += 1
      if (
        plan.reason === 'first-run' ||
        plan.reason === 'unparseable-baseline' ||
        plan.reason === 'outcome-set-changed'
      ) {
        rebaselined.push({ prizeId: String(deprizeId), reason: plan.reason })
      }

      let postedResult = null
      if (plan.post && snap) {
        const competition = getDePrizeCompetition(chainSlug, deprizeId)
        postedResult = await postDiscordChannelMessage({
          channelId: channelId as string,
          embeds: [
            buildOddsWireEmbed({
              title: competition.title || `DePrize #${deprizeId}`,
              deprizeId,
              site,
              labels,
              current,
              previous: previous?.p ?? current,
            }),
          ],
        })
        if (postedResult.ok) {
          posted += 1
        } else {
          errors.push(`post:${deprizeId}:${postedResult.reason}`)
        }
      }

      const next = nextOddsWireSnapshot({
        previous,
        current,
        plan,
        posted: postedResult,
        now,
      })
      if (next.write) {
        try {
          await redis.set(keys.snapshot, JSON.stringify(next.value))
        } catch (err) {
          if (plan.post && postedResult?.ok) {
            errors.push(`snapshot-set-failed:${deprizeId}`)
          } else {
            errors.push(`snapshot-set:${deprizeId}`)
          }
        }
      }

      const prevHealth = ((await redis.get(keys.health)) as Health | null) ?? { streak: 0 }
      const health: Health = {
        streak: 0,
        lastOkAt: now,
        lastPostAt: postedResult?.ok ? now : prevHealth.lastPostAt,
      }
      await redis.set(keys.health, health)
    } catch (err: any) {
      errors.push(`${deprizeId}:${err?.message || 'failed'}`)
      try {
        const prevHealth = ((await redis.get(keys.health)) as Health | null) ?? { streak: 0 }
        const health: Health = {
          streak: (prevHealth.streak || 0) + 1,
          lastError: String(err?.message || 'failed'),
          lastOkAt: prevHealth.lastOkAt,
          lastPostAt: prevHealth.lastPostAt,
        }
        await redis.set(keys.health, health)
        await maybeAlert(health, deprizeId, health.lastError || '')
      } catch {
        // health write is best-effort
      }
    }
  }

  const payload = {
    ok: errors.length === 0,
    configured: true,
    checked,
    posted,
    skipped,
    rebaselined,
    errors,
  }
  return res.status(errors.length ? 500 : 200).json(payload)
}

export default handler
