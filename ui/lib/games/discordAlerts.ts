/**
 * Discord posts for the mini games' daily leaderboards (Touchdown and Starship
 * Catch).
 *
 * Two kinds, both server-side and both from scores the leaderboard routes have
 * already verified by replaying the recorded inputs:
 *
 *   - First score: the first run of the day on a board, which opens it.
 *   - New #1: a run takes the top spot on today's mission from someone else.
 *     Both are capped per game and day, and neither is posted for a player
 *     improving a lead they already held, so one player cannot flood the channel.
 *   - Daily recap: once a day, the podium of yesterday's mission for every game.
 *
 * Nothing here is reachable from the browser: there is no share-button
 * trigger, because a click proves nothing about a score.
 *
 * Channel: general, like the app's other Discord alerts. Off the live board
 * (local, previews) the posts go to the test channel instead.
 *
 * Redis, under games:discord:<prod|dev>:
 *   cap:<game>:<mission>                     counter   first-score and new-#1 posts that day
 *   msg:<game>:<mission>:<mode>:<name key>   list      Discord message ids, for moderation
 *   recap:<mission>                          string    set once the recap is posted
 */
import type { Redis } from '@upstash/redis'
import { DEPLOYED_ORIGIN, GENERAL_CHANNEL_ID, TEST_CHANNEL_ID } from 'const/config'
import { escapeDiscordUserText } from '@/lib/discord/escapeUserText'
import { postDiscordChannelMessage, type DiscordPostResult } from '@/lib/discord/postChannelMessage'
import type { DiscordEmbed } from '@/lib/og/preview'
import { isLiveBoard } from '@/lib/touchdown/leaderboardStore'
import { missionDateLabel } from '@/lib/touchdown/mission'

export type GameId = 'touchdown' | 'catch'
export type GameModeId = 'easy' | 'pro'

export type GameInfo = { title: string; path: string; player: string; players: string }

export const GAMES: Record<GameId, GameInfo> = {
  touchdown: { title: 'Touchdown', path: '/touchdown', player: 'pilot', players: 'pilots' },
  catch: { title: 'Starship Catch', path: '/starship', player: 'pilot', players: 'pilots' },
}

export const GAME_IDS: GameId[] = ['touchdown', 'catch']
export const GAME_MODES: GameModeId[] = ['easy', 'pro']
const MODE_LABEL: Record<GameModeId, string> = { easy: 'Easy', pro: 'Pro' }

/** First-score and new-#1 posts per game per mission, across both modes. */
export const NEW_LEADER_DAILY_CAP = 6
/** Keys live a little past the board's own three weeks so moderation can still find old posts. */
const KEY_TTL_SECONDS = 22 * 24 * 60 * 60
const GAMES_EMBED_COLOR = 0xf59e0b
const POST_TIMEOUT_MS = 3000
const CHANNEL_ID_RE = /^\d{17,20}$/

export type Leader = { key: string; name: string; score: number }
export type PodiumEntry = { name: string; score: number }

type Env = Record<string, string | undefined>
type PostFn = typeof postDiscordChannelMessage

function prefix(env: Env = process.env): string {
  return `games:discord:${isLiveBoard(env) ? 'prod' : 'dev'}`
}

/** General on the live board, the test channel everywhere else. */
export function gamesChannelId(env: Env = process.env): string {
  return isLiveBoard(env) ? GENERAL_CHANNEL_ID : TEST_CHANNEL_ID
}

export type NewLeaderReason = 'not-today' | 'same-leader' | 'not-ahead' | 'daily-cap'

/**
 * Whether a verified run that just went on the board deserves a post. `previous`
 * is the day's #1 read before the run was saved.
 */
export function planNewLeaderPost(args: {
  mission: number
  today: number
  key: string
  score: number
  previous?: Leader
  postedCount: number
  cap?: number
}): { post: true } | { post: false; reason: NewLeaderReason } {
  // Yesterday's mission still takes late runs; the recap covers those.
  if (args.mission !== args.today) return { post: false, reason: 'not-today' }
  // No `previous` means an empty board: this is the day's first score, which posts too.
  if (args.previous) {
    if (args.previous.key === args.key) return { post: false, reason: 'same-leader' }
    // Ties share the top spot; only a strictly higher score takes it.
    if (!(args.score > args.previous.score)) return { post: false, reason: 'not-ahead' }
  }
  if (args.postedCount >= (args.cap ?? NEW_LEADER_DAILY_CAP)) return { post: false, reason: 'daily-cap' }
  return { post: true }
}

function points(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

function playUrl(game: GameId, origin: string = DEPLOYED_ORIGIN): string {
  return `${origin.replace(/\/$/, '')}${GAMES[game].path}`
}

export function buildNewLeaderEmbed(args: {
  game: GameId
  mode: GameModeId
  mission: number
  name: string
  score: number
  /** The #1 this run passed; absent for the day's first score. */
  previous?: Leader
  origin?: string
}): DiscordEmbed {
  const game = GAMES[args.game]
  const url = playUrl(args.game, args.origin)
  const mode = MODE_LABEL[args.mode]
  const name = `**${escapeDiscordUserText(args.name)}**`
  const score = `**${points(args.score)}** points`
  const opener = args.previous
    ? {
        title: `🏆 New #1 on ${game.title} (${mode})`,
        text:
          `${name} took the top spot on today's mission with ${score}, ` +
          `passing ${escapeDiscordUserText(args.previous.name)} (${points(args.previous.score)}).`,
      }
    : {
        title: `🚀 First on the board: ${game.title} (${mode})`,
        text: `${name} set the first score on today's mission: ${score}. Who can beat it?`,
      }
  return {
    title: opener.title,
    description: `${opener.text}\n\n[Play today's mission](${url})`,
    url,
    color: GAMES_EMBED_COLOR,
    footer: { text: `Mission ${args.mission} · ${missionDateLabel(args.mission)}` },
  }
}

export type GameRecap = { game: GameId; modes: { mode: GameModeId; top: PodiumEntry[]; total: number }[] }

const MEDALS = ['🥇', '🥈', '🥉']

/** One embed with every game's podium for `mission`, or null when nobody played. */
export function buildRecapEmbed(mission: number, recaps: GameRecap[], origin?: string): DiscordEmbed | null {
  const sections: string[] = []
  for (const recap of recaps) {
    const game = GAMES[recap.game]
    const lines: string[] = []
    for (const m of recap.modes) {
      if (!m.top.length) continue
      const podium = m.top
        .slice(0, 3)
        .map((e, i) => `${MEDALS[i]} ${escapeDiscordUserText(e.name)} ${points(e.score)}`)
        .join(' · ')
      const count = `${m.total} ${m.total === 1 ? game.player : game.players}`
      lines.push(`${MODE_LABEL[m.mode]}: ${podium} (${count})`)
    }
    if (lines.length) sections.push(`**[${game.title}](${playUrl(recap.game, origin)})**\n${lines.join('\n')}`)
  }
  if (!sections.length) return null
  return {
    title: `🌕 Yesterday's mini game podiums: Mission ${mission}`,
    description: `${sections.join('\n\n')}\n\nA new mission is live now. Can you take the top spot?`,
    color: GAMES_EMBED_COLOR,
    footer: { text: missionDateLabel(mission) },
  }
}

function msgKey(game: GameId, mission: number, mode: GameModeId, key: string, env?: Env): string {
  return `${prefix(env)}:msg:${game}:${mission}:${mode}:${key}`
}

/**
 * Post a first-score or new-#1 alert if the run earned one. Never throws, and keeps the
 * Discord call short so the score response is not held up.
 */
export async function announceNewLeader(
  redis: Redis,
  args: {
    game: GameId
    mode: GameModeId
    mission: number
    today: number
    key: string
    name: string
    score: number
    previous?: Leader
  },
  deps: { post?: PostFn; env?: Env } = {}
): Promise<{ posted: boolean; reason?: string }> {
  try {
    const channelId = gamesChannelId(deps.env)
    const capKey = `${prefix(deps.env)}:cap:${args.game}:${args.mission}`
    const postedCount = Number((await redis.get<number>(capKey)) ?? 0)
    const plan = planNewLeaderPost({ ...args, postedCount })
    if (!plan.post) return { posted: false, reason: plan.reason }

    await redis.incr(capKey)
    await redis.expire(capKey, KEY_TTL_SECONDS)
    const embed = buildNewLeaderEmbed(args)
    const result: DiscordPostResult = await (deps.post ?? postDiscordChannelMessage)({
      channelId,
      embeds: [embed],
      timeoutMs: POST_TIMEOUT_MS,
    })
    if (!result.ok) return { posted: false, reason: result.reason }
    if (result.messageId) {
      const k = msgKey(args.game, args.mission, args.mode, args.key, deps.env)
      await redis.rpush(k, `${channelId}:${result.messageId}`)
      await redis.expire(k, KEY_TTL_SECONDS)
    }
    return { posted: true }
  } catch (err) {
    console.error('[games discord] new leader alert failed', err)
    return { posted: false, reason: 'error' }
  }
}

/**
 * Moderation: when a name is removed from a board, take down the new-#1 posts
 * it earned that day too. Returns how many Discord messages were deleted.
 */
export async function removeLeaderPosts(
  redis: Redis,
  args: { game: GameId; mode: GameModeId; mission: number; key: string },
  deps: { fetchImpl?: typeof fetch; botToken?: string; env?: Env } = {}
): Promise<number> {
  try {
    const k = msgKey(args.game, args.mission, args.mode, args.key, deps.env)
    const refs = (await redis.lrange<string>(k, 0, -1)) ?? []
    const token = deps.botToken ?? process.env.DISCORD_BOT_TOKEN
    if (!refs.length || !token) return 0
    const doFetch = deps.fetchImpl ?? fetch
    let deleted = 0
    for (const ref of refs) {
      const [channelId, messageId] = String(ref).split(':')
      if (!CHANNEL_ID_RE.test(channelId ?? '') || !/^\d{17,20}$/.test(messageId ?? '')) continue
      const res = await doFetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bot ${token}` },
      }).catch(() => null)
      // 404: already gone, which is what we wanted.
      if (res && (res.ok || res.status === 404)) deleted++
    }
    await redis.del(k)
    return deleted
  } catch (err) {
    console.error('[games discord] removing posts failed', err)
    return 0
  }
}

export type RecapOutcome =
  | { posted: true; mission: number }
  | { posted: false; mission: number; reason: 'already-posted' | 'nobody-played' | string }

/** Post the recap for `mission` once. A failed post frees the slot so the next run retries. */
export async function postDailyRecap(
  redis: Redis,
  mission: number,
  readRecaps: (mission: number) => Promise<GameRecap[]>,
  deps: { post?: PostFn; env?: Env; origin?: string } = {}
): Promise<RecapOutcome> {
  const channelId = gamesChannelId(deps.env)
  const doneKey = `${prefix(deps.env)}:recap:${mission}`
  const claimed = await redis.set(doneKey, String(Date.now()), { nx: true, ex: KEY_TTL_SECONDS })
  if (claimed !== 'OK') return { posted: false, mission, reason: 'already-posted' }

  try {
    const embed = buildRecapEmbed(mission, await readRecaps(mission), deps.origin)
    // Keep the claim: an empty day stays empty, no need to look again.
    if (!embed) return { posted: false, mission, reason: 'nobody-played' }
    const result = await (deps.post ?? postDiscordChannelMessage)({ channelId, embeds: [embed] })
    if (!result.ok) {
      await redis.del(doneKey)
      return { posted: false, mission, reason: result.reason }
    }
    return { posted: true, mission }
  } catch (err) {
    await redis.del(doneKey).catch(() => {})
    throw err
  }
}
