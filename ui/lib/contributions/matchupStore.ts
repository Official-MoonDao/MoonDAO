// Upstash Redis storage for the head-to-head contribution matchup prototype.
//
// Keys:
//   contrib-vote:wins                 HASH contributionId -> matchups won
//   contrib-vote:matchups             HASH contributionId -> matchups judged
//   contrib-vote:log                  LIST of JSON picks {voter, winner, loser, ts}
//   contrib-vote:issued:<matchupId>   JSON {a, b, voter}, expires after an hour
//   contrib-vote:voter:<id>:pairs     SET of pair keys this voter has judged
//   contrib-vote:voter:<id>:day:<d>   picks this voter made on UTC day d
//
// A pick must reference a matchup the server issued to the same voter, and an
// issued matchup can be used once, so a client can't vote on arbitrary pairs
// or replay a pick.
import crypto from 'crypto'
import { Redis } from '@upstash/redis'
import { MAX_VOTES_PER_DAY, pairKey, type MatchupStats } from './matchups'

const WINS_KEY = 'contrib-vote:wins'
const MATCHUPS_KEY = 'contrib-vote:matchups'
const LOG_KEY = 'contrib-vote:log'
const ISSUED_TTL_SECONDS = 60 * 60
const DAY_TTL_SECONDS = 2 * 24 * 60 * 60

type IssuedMatchup = { a: string; b: string; voter: string }

let redisClient: Redis | null = null

export function getMatchupRedis(): Redis | null {
  if (redisClient) return redisClient
  const url = process.env.UPSTASH_REDIS_URL
  const token = process.env.UPSTASH_REDIS_TOKEN
  if (!url || !token) return null
  redisClient = new Redis({ url, token })
  return redisClient
}

const issuedKey = (id: string) => `contrib-vote:issued:${id}`
const pairsKey = (voter: string) => `contrib-vote:voter:${voter}:pairs`
const dayKey = (voter: string, now = new Date()) =>
  `contrib-vote:voter:${voter}:day:${now.toISOString().slice(0, 10)}`

function toCounts(raw: Record<string, unknown> | null): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw || {})) out[k] = Number(v) || 0
  return out
}

export async function getMatchupStats(redis: Redis): Promise<MatchupStats> {
  const [wins, matchups] = await Promise.all([
    redis.hgetall<Record<string, unknown>>(WINS_KEY),
    redis.hgetall<Record<string, unknown>>(MATCHUPS_KEY),
  ])
  return { wins: toCounts(wins), matchups: toCounts(matchups) }
}

export async function getVoterState(
  redis: Redis,
  voter: string
): Promise<{ judgedPairs: Set<string>; votesToday: number }> {
  const [pairs, today] = await Promise.all([
    redis.smembers(pairsKey(voter)),
    redis.get<number>(dayKey(voter)),
  ])
  return {
    judgedPairs: new Set(pairs as string[]),
    votesToday: Number(today) || 0,
  }
}

export async function issueMatchup(
  redis: Redis,
  voter: string,
  a: string,
  b: string
): Promise<string> {
  const id = crypto.randomUUID()
  const value: IssuedMatchup = { a, b, voter }
  await redis.set(issuedKey(id), JSON.stringify(value), {
    ex: ISSUED_TTL_SECONDS,
  })
  return id
}

export type RecordPickResult =
  | { ok: true; votesToday: number }
  | { ok: false; status: number; message: string }

// `winnerId` null means the voter skipped: the matchup is consumed but
// nothing is counted.
export async function recordPick(
  redis: Redis,
  voter: string,
  matchupId: string,
  winnerId: string | null
): Promise<RecordPickResult> {
  const raw = await redis.getdel<IssuedMatchup | string>(issuedKey(matchupId))
  const issued: IssuedMatchup | null =
    typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!issued || issued.voter !== voter) {
    return {
      ok: false,
      status: 410,
      message: 'This matchup expired or was already used. Load a new one.',
    }
  }

  const today = dayKey(voter)
  if (winnerId === null) {
    const votesToday = Number(await redis.get<number>(today)) || 0
    return { ok: true, votesToday }
  }

  if (winnerId !== issued.a && winnerId !== issued.b) {
    return { ok: false, status: 400, message: 'Winner is not in this matchup.' }
  }
  const loserId = winnerId === issued.a ? issued.b : issued.a

  const votesToday = await redis.incr(today)
  if (votesToday === 1) await redis.expire(today, DAY_TTL_SECONDS)
  if (votesToday > MAX_VOTES_PER_DAY) {
    await redis.decr(today)
    return {
      ok: false,
      status: 429,
      message: `You've made ${MAX_VOTES_PER_DAY} picks today. Come back tomorrow.`,
    }
  }

  const pipeline = redis.pipeline()
  pipeline.hincrby(WINS_KEY, winnerId, 1)
  pipeline.hincrby(MATCHUPS_KEY, winnerId, 1)
  pipeline.hincrby(MATCHUPS_KEY, loserId, 1)
  pipeline.sadd(pairsKey(voter), pairKey(winnerId, loserId))
  pipeline.lpush(
    LOG_KEY,
    JSON.stringify({ voter, winner: winnerId, loser: loserId, ts: Date.now() })
  )
  await pipeline.exec()

  return { ok: true, votesToday }
}
