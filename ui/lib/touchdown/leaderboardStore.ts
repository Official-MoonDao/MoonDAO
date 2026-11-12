/**
 * Touchdown leaderboard store on the site's existing Upstash Redis.
 *
 * Per day and mode:
 *   <prefix>:z:<mission>:<mode>   sorted set   name key -> best score
 *   <prefix>:n:<mission>:<mode>   hash         name key -> display name
 *   <prefix>:a:<mission>:<mode>   hash         name key -> attempts
 *
 * Boards expire after three weeks. Development and production use different
 * prefixes, so local testing never writes to the live board.
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

function prefix(env: Record<string, string | undefined> = process.env): string {
  return `touchdown:lb:${env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'prod' : 'dev'}`
}

function keys(mission: number, mode: ModeId) {
  const p = prefix()
  return {
    scores: `${p}:z:${mission}:${mode}`,
    names: `${p}:n:${mission}:${mode}`,
    attempts: `${p}:a:${mission}:${mode}`,
  }
}

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
  await Promise.all([
    redis.expire(k.scores, TTL_SECONDS),
    redis.expire(k.names, TTL_SECONDS),
    redis.expire(k.attempts, TTL_SECONDS),
  ])
  const best = await redis.zscore(k.scores, id)
  return rankOf(redis, s.mission, s.mode, Number(best ?? s.score))
}

/** Moderation: remove a pilot from a day's board. */
export async function removeEntry(redis: Redis, mission: number, mode: ModeId, name: string): Promise<boolean> {
  const k = keys(mission, mode)
  const id = nameKey(name)
  const removed = await redis.zrem(k.scores, id)
  await Promise.all([redis.hdel(k.names, id), redis.hdel(k.attempts, id)])
  return removed > 0
}
