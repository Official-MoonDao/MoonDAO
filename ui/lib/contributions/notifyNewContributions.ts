// Posts a Discord notification for each NEW community contribution submitted
// through the Community Circle Google Form.
//
// Why this exists / how it works:
//   Contributions are submitted via an external Google Form that writes rows to
//   a Google Sheet. The app only ever *reads* that sheet (see
//   `getSheetContributions`), so there is no server-side hook we can fire on
//   submit. Instead this module is polled on a schedule (a GitHub Actions cron
//   hits `/api/cron/contribution-notifications`), diffs the sheet against the
//   set of rows we've already announced, and posts the new ones to the same
//   Discord "network notifications" channel used for citizens/teams/jobs.
//
//   Dedup + first-run seeding live in Upstash Redis (the same store used for
//   citizen invites and rate limiting):
//     - `contributions:notified`        SET of already-announced row hashes
//     - `contributions:notified:seeded` flag set after the initial backfill
//   On the very first run we record every existing row as "seen" WITHOUT
//   posting, so turning this on doesn't dump the entire historical backlog into
//   Discord. After that, only genuinely new rows are announced.
import crypto from 'crypto'
import { Redis } from '@upstash/redis'
import { DEPLOYED_ORIGIN, GENERAL_CHANNEL_ID, TEST_CHANNEL_ID } from 'const/config'
import {
  getSheetContributions,
  type Contribution,
} from '@/lib/contributions/getSheetContributions'

const NOTIFIED_SET_KEY = 'contributions:notified'
const SEEDED_FLAG_KEY = 'contributions:notified:seeded'

// Per-run lock so overlapping cron invocations can't both read the seen-set and
// double-post the same row (the gap between SMEMBERS and SADD). The release is a
// compare-and-delete keyed on a unique token, so a slow run can never delete a
// lock that a later run has already acquired.
const LOCK_KEY = 'contributions:notify:lock'
const LOCK_TTL_SECONDS = 120
const RELEASE_LOCK_SCRIPT =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end'

// Cap posts per run so a sudden burst (or a misconfiguration) can't spam the
// channel or trip Discord's rate limiter. Anything beyond this is picked up on
// the next poll, since rows are only marked seen after a successful post.
const MAX_PER_RUN = 8

// Same channel selection the rest of the network notifications use.
const NOTIFICATION_CHANNEL_ID =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
    ? GENERAL_CHANNEL_ID
    : TEST_CHANNEL_ID

export type NotifyResult = {
  ok: boolean
  /** Set when the run only seeded the dedup store (first run). */
  seeded?: boolean
  /** Number of contributions posted to Discord this run. */
  posted?: number
  /** Total contribution rows currently in the sheet. */
  total?: number
  /** New rows that remain unposted (deferred to the next run / failed). */
  pending?: number
  /** Set when another run held the lock and this invocation was skipped. */
  locked?: boolean
  /** Populated when ok is false. */
  reason?: string
}

let redisClient: Redis | null = null

function getRedis(): Redis | null {
  if (redisClient) return redisClient
  const url = process.env.UPSTASH_REDIS_URL
  const token = process.env.UPSTASH_REDIS_TOKEN
  if (!url || !token) return null
  redisClient = new Redis({ url, token })
  return redisClient
}

// Stable per-row identity. Timestamp + wallet + description is unique enough to
// survive sheet re-ordering and never collides for distinct submissions.
function contributionKey(c: Contribution): string {
  return crypto
    .createHash('sha1')
    .update(`${c.timestamp}|${c.walletAddress}|${c.description}`)
    .digest('hex')
}

function truncate(text: string, max: number): string {
  const t = text.trim()
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

function buildContent(c: Contribution): string {
  const who =
    c.name && c.name !== 'Anonymous'
      ? `**${c.name}**`
      : c.walletAddress
      ? `**${c.walletAddress.slice(0, 6)}…${c.walletAddress.slice(-4)}**`
      : '**Someone**'

  const lines = [`## 🚀 New Contribution from ${who}`]
  if (c.area) lines.push(`**Area:** ${c.area}`)
  if (c.description) lines.push(truncate(c.description, 1500))
  if (c.links) {
    const url = c.links.startsWith('http') ? c.links : `https://${c.links}`
    lines.push(`🔗 ${url}`)
  }
  lines.push(`\nView all contributions → ${DEPLOYED_ORIGIN}/contributions`)
  return lines.join('\n')
}

async function postToDiscord(content: string): Promise<boolean> {
  const token = process.env.DISCORD_BOT_TOKEN
  if (!token) {
    console.error('[contribution-notify] DISCORD_BOT_TOKEN not set')
    return false
  }
  try {
    const resp = await fetch(
      `https://discord.com/api/v10/channels/${NOTIFICATION_CHANNEL_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${token}`,
        },
        body: JSON.stringify({ content }),
      }
    )
    if (!resp.ok) {
      const body = await resp.text().catch(() => '')
      console.error(
        `[contribution-notify] Discord post failed (${resp.status}): ${body}`
      )
      return false
    }
    return true
  } catch (err) {
    console.error('[contribution-notify] Discord post error:', err)
    return false
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function notifyNewContributions(): Promise<NotifyResult> {
  const redis = getRedis()
  if (!redis) {
    console.error(
      '[contribution-notify] Redis not configured (UPSTASH_REDIS_URL / UPSTASH_REDIS_TOKEN)'
    )
    return { ok: false, reason: 'redis-unconfigured' }
  }

  const lockToken = crypto.randomBytes(16).toString('hex')
  const acquired = await redis.set(LOCK_KEY, lockToken, {
    nx: true,
    ex: LOCK_TTL_SECONDS,
  })
  if (acquired !== 'OK') {
    // Another run is in flight; skip rather than risk a double-post.
    return { ok: true, locked: true, posted: 0 }
  }

  try {
    const contributions = await getSheetContributions()
    // `getSheetContributions` returns newest-first; post oldest-first so the
    // Discord feed reads chronologically.
    const ordered = [...contributions].reverse()
    const keys = ordered.map(contributionKey)

    const seeded = await redis.get(SEEDED_FLAG_KEY)
    if (!seeded) {
      if (keys.length > 0) {
        await redis.sadd(NOTIFIED_SET_KEY, keys[0], ...keys.slice(1))
      }
      await redis.set(SEEDED_FLAG_KEY, '1')
      return { ok: true, seeded: true, posted: 0, total: keys.length }
    }

    if (ordered.length === 0) {
      return { ok: true, seeded: false, posted: 0, total: 0 }
    }

    const seen = new Set(await redis.smembers(NOTIFIED_SET_KEY))
    const newOnes: { c: Contribution; key: string }[] = []
    for (let i = 0; i < ordered.length; i++) {
      if (!seen.has(keys[i])) newOnes.push({ c: ordered[i], key: keys[i] })
    }

    let posted = 0
    for (const { c, key } of newOnes.slice(0, MAX_PER_RUN)) {
      const ok = await postToDiscord(buildContent(c))
      if (!ok) break // leave unseen so the next run retries
      await redis.sadd(NOTIFIED_SET_KEY, key)
      posted++
      await sleep(400) // be gentle with Discord's rate limiter
    }

    return {
      ok: true,
      seeded: false,
      posted,
      total: keys.length,
      pending: Math.max(0, newOnes.length - posted),
    }
  } finally {
    try {
      await redis.eval(RELEASE_LOCK_SCRIPT, [LOCK_KEY], [lockToken])
    } catch (err) {
      console.warn('[contribution-notify] lock release failed:', err)
    }
  }
}
