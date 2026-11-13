/**
 * Touchdown leaderboard store on the site's existing Upstash Redis.
 *
 * Per day and mode:
 *   <prefix>:z:<mission>:<mode>   sorted set   name key -> best score
 *   <prefix>:n:<mission>:<mode>   hash         name key -> display name
 *   <prefix>:a:<mission>:<mode>   hash         name key -> attempts
 *
 * All-time, per mode (never expires):
 *   <prefix>:ath:z:<mode>         sorted set   name key -> best score on any day
 *   <prefix>:ath:n:<mode>         hash         name key -> display name
 *
 * Boards expire after three weeks. Only the production deployment uses the
 * live prefix (see isLiveBoard), so local and preview testing never writes to
 * the live board.
 */
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { BOARD_SIZE, nameKey, type BoardEntry, type Submission } from './leaderboard'
import type { ModeId } from './modes'

const TTL_SECONDS = 21 * 24 * 60 * 60

export function leaderboardRedis(env: Record<string, string | undefined> = process.env): Redis | null {
  const url = env.UPSTASH_REDIS_URL
  const token = env.UPSTASH_REDIS_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

/**
 * Only the production deployment writes to the live board. Local development
 * and preview deployments share a separate one, even when they are pointed at
 * mainnet (which local .env files often are).
 */
export function isLiveBoard(env: Record<string, string | undefined> = process.env): boolean {
  if (env.VERCEL_ENV) return env.VERCEL_ENV === 'production'
  return env.NODE_ENV === 'production' && env.NEXT_PUBLIC_CHAIN === 'mainnet'
}

function prefix(env: Record<string, string | undefined> = process.env): string {
  return `touchdown:lb:${isLiveBoard(env) ? 'prod' : 'dev'}`
}

function keys(mission: number, mode: ModeId) {
  const p = prefix()
  return {
    scores: `${p}:z:${mission}:${mode}`,
    names: `${p}:n:${mission}:${mode}`,
    attempts: `${p}:a:${mission}:${mode}`,
  }
}

function allTimeKeys(mode: ModeId) {
  const p = prefix()
  return { scores: `${p}:ath:z:${mode}`, names: `${p}:ath:n:${mode}` }
}
/** Pilots kept on the all-time list; only the top one is shown. */
const ALL_TIME_KEEP = 100

/** Submissions per IP. Generous for real play (a flight takes about a minute), tight for a script. */
export function submitLimiter(redis: Redis): Ratelimit {
  return new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '10 m'), prefix: `${prefix()}:rl` })
}

export async function readBoard(
  redis: Redis,
  mission: number,
  mode: ModeId
): Promise<{ top: BoardEntry[]; total: number }> {
  const k = keys(mission, mode)
  const [flat, total] = await Promise.all([
    redis.zrange<(string | number)[]>(k.scores, 0, BOARD_SIZE - 1, { rev: true, withScores: true }),
    redis.zcard(k.scores),
  ])
  const ids: string[] = []
  const scores: number[] = []
  for (let i = 0; i + 1 < flat.length; i += 2) {
    ids.push(String(flat[i]))
    scores.push(Number(flat[i + 1]))
  }
  if (!ids.length) return { top: [], total: 0 }
  const [names, attempts] = await Promise.all([
    redis.hmget<Record<string, string | null>>(k.names, ...ids),
    redis.hmget<Record<string, string | number | null>>(k.attempts, ...ids),
  ])
  const top = ids.map((id, i) => ({
    name: String(names?.[id] ?? id),
    score: scores[i],
    attempts: Math.max(1, Number(attempts?.[id] ?? 1)),
  }))
  return { top, total }
}

/** The top pilot on the day before `mission`, if anyone landed. */
export async function readYesterdaysWinner(
  redis: Redis,
  mission: number,
  mode: ModeId
): Promise<{ name: string; score: number } | undefined> {
  if (mission < 2) return undefined
  const k = keys(mission - 1, mode)
  const flat = await redis.zrange<(string | number)[]>(k.scores, 0, 0, { rev: true, withScores: true })
  if (flat.length < 2) return undefined
  const id = String(flat[0])
  const name = await redis.hget<string>(k.names, id)
  return { name: String(name ?? id), score: Number(flat[1]) }
}

async function topOf(
  redis: Redis,
  scoresKey: string,
  namesKey: string
): Promise<{ id: string; name: string; score: number } | undefined> {
  const flat = await redis.zrange<(string | number)[]>(scoresKey, 0, 0, { rev: true, withScores: true })
  if (flat.length < 2) return undefined
  const id = String(flat[0])
  const name = await redis.hget<string>(namesKey, id)
  return { id, name: String(name ?? id), score: Number(flat[1]) }
}

/**
 * The best score ever saved in a mode. The list is filled as scores are
 * saved; the first time it is read empty, it is seeded from the daily boards
 * that still exist (up to `today`).
 */
export async function readAllTimeHigh(
  redis: Redis,
  mode: ModeId,
  today: number
): Promise<{ name: string; score: number } | undefined> {
  const a = allTimeKeys(mode)
  let best = await topOf(redis, a.scores, a.names)
  if (!best) {
    const missions: number[] = []
    for (let m = Math.max(1, today - 21); m <= today; m++) missions.push(m)
    const tops = await Promise.all(
      missions.map((m) => {
        const k = keys(m, mode)
        return topOf(redis, k.scores, k.names)
      })
    )
    for (const t of tops) {
      if (!t) continue
      await Promise.all([
        redis.zadd(a.scores, { gt: true }, { score: t.score, member: t.id }),
        redis.hset(a.names, { [t.id]: t.name }),
      ])
      if (!best || t.score > best.score) best = t
    }
  }
  return best ? { name: best.name, score: best.score } : undefined
}

/** Rank a score would hold today: one more than the number of strictly better scores. */
export async function rankOf(redis: Redis, mission: number, mode: ModeId, score: number): Promise<number> {
  const better = await redis.zcount(keys(mission, mode).scores, `(${score}`, '+inf')
  return better + 1
}

/** Record an attempt; keep the pilot's best score. Returns the rank of their best. */
export async function submitScore(redis: Redis, s: Submission): Promise<number> {
  const k = keys(s.mission, s.mode)
  const id = nameKey(s.name)
  await Promise.all([
    redis.zadd(k.scores, { gt: true }, { score: s.score, member: id }),
    redis.hset(k.names, { [id]: s.name }),
    redis.hincrby(k.attempts, id, 1),
  ])
  const a = allTimeKeys(s.mode)
  await Promise.all([
    redis.zadd(a.scores, { gt: true }, { score: s.score, member: id }),
    redis.hset(a.names, { [id]: s.name }),
  ])
  await redis.zremrangebyrank(a.scores, 0, -(ALL_TIME_KEEP + 1))
  await Promise.all([
    redis.expire(k.scores, TTL_SECONDS),
    redis.expire(k.names, TTL_SECONDS),
    redis.expire(k.attempts, TTL_SECONDS),
  ])
  const best = await redis.zscore(k.scores, id)
  return rankOf(redis, s.mission, s.mode, Number(best ?? s.score))
}

/** Moderation: remove a pilot from a day's board and from the all-time list. */
export async function removeEntry(redis: Redis, mission: number, mode: ModeId, name: string): Promise<boolean> {
  const k = keys(mission, mode)
  const id = nameKey(name)
  const removed = await redis.zrem(k.scores, id)
  const a = allTimeKeys(mode)
  await Promise.all([
    redis.hdel(k.names, id),
    redis.hdel(k.attempts, id),
    redis.zrem(a.scores, id),
    redis.hdel(a.names, id),
  ])
  return removed > 0
}
