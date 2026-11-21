/// <reference types="node" />
/**
 * Mini games Discord alerts: when a run earns a new-#1 post, the daily recap,
 * and moderation taking posts down again.
 */
import type { Redis } from '@upstash/redis'
import { GENERAL_CHANNEL_ID, TEST_CHANNEL_ID } from 'const/config'
import {
  announceNewLeader,
  buildNewLeaderEmbed,
  buildRecapEmbed,
  gamesChannelId,
  NEW_LEADER_DAILY_CAP,
  planNewLeaderPost,
  postDailyRecap,
  removeLeaderPosts,
  type GameRecap,
} from '@/lib/games/discordAlerts'

const LIVE = { VERCEL_ENV: 'production' }
const CHANNEL = GENERAL_CHANNEL_ID

/** Just enough of @upstash/redis for these helpers. */
function fakeRedis() {
  const kv = new Map<string, any>()
  const api = {
    kv,
    async get(k: string) {
      return kv.has(k) ? kv.get(k) : null
    },
    async set(k: string, v: string, opts?: { nx?: boolean }) {
      if (opts?.nx && kv.has(k)) return null
      kv.set(k, v)
      return 'OK'
    },
    async incr(k: string) {
      const n = Number(kv.get(k) ?? 0) + 1
      kv.set(k, n)
      return n
    },
    async expire() {
      return 1
    },
    async del(k: string) {
      return kv.delete(k) ? 1 : 0
    },
    async rpush(k: string, v: string) {
      const list = kv.get(k) ?? []
      list.push(v)
      kv.set(k, list)
      return list.length
    },
    async lrange(k: string) {
      return kv.get(k) ?? []
    },
  }
  return api as typeof api & Redis
}

function recordingPost(messageId = '987654321098765432') {
  const calls: any[] = []
  const post = async (opts: any) => {
    calls.push(opts)
    return { ok: true as const, messageId }
  }
  return { calls, post: post as any }
}

const base = { mission: 10, today: 10, key: 'ada', score: 900, postedCount: 0 }
const rival = { key: 'bob', name: 'Bob', score: 800 }

describe('games discord: planNewLeaderPost', () => {
  it('posts when a run passes someone else for #1 today', () => {
    expect(planNewLeaderPost({ ...base, previous: rival })).to.deep.equal({ post: true })
  })

  it('skips yesterday’s late runs, the first score, own improvements and ties', () => {
    expect(planNewLeaderPost({ ...base, mission: 9, previous: rival })).to.deep.equal({ post: false, reason: 'not-today' })
    expect(planNewLeaderPost({ ...base })).to.deep.equal({ post: false, reason: 'no-rival' })
    expect(planNewLeaderPost({ ...base, previous: { ...rival, key: 'ada' } })).to.deep.equal({ post: false, reason: 'same-leader' })
    expect(planNewLeaderPost({ ...base, previous: { ...rival, score: 900 } })).to.deep.equal({ post: false, reason: 'not-ahead' })
    expect(planNewLeaderPost({ ...base, previous: { ...rival, score: 950 } })).to.deep.equal({ post: false, reason: 'not-ahead' })
  })

  it('stops at the daily cap', () => {
    expect(planNewLeaderPost({ ...base, previous: rival, postedCount: NEW_LEADER_DAILY_CAP })).to.deep.equal({
      post: false,
      reason: 'daily-cap',
    })
  })
})

describe('games discord: channel', () => {
  it('posts to general on the live board and the test channel everywhere else', () => {
    expect(gamesChannelId(LIVE)).to.equal(GENERAL_CHANNEL_ID)
    expect(gamesChannelId({ VERCEL_ENV: 'preview' })).to.equal(TEST_CHANNEL_ID)
    expect(gamesChannelId({ NODE_ENV: 'development' })).to.equal(TEST_CHANNEL_ID)
  })
})

describe('games discord: embeds', () => {
  it('escapes player names so they cannot ping or format', () => {
    const embed = buildNewLeaderEmbed({
      game: 'catch',
      mode: 'pro',
      mission: 10,
      name: '@everyone *Ada*',
      score: 1240,
      previous: { key: 'bob', name: 'Bob_', score: 1100 },
      origin: 'https://moondao.com',
    })
    expect(embed.title).to.equal('🏆 New #1 on Starship Catch (Pro)')
    expect(embed.description).to.contain('@​everyone \\*Ada\\*')
    expect(embed.description).to.contain('Bob\\_ (1,100)')
    expect(embed.description).to.contain('**1,240** points')
    expect(embed.url).to.equal('https://moondao.com/starship')
  })

  it('builds one recap of every game that was played, and nothing for an empty day', () => {
    const recaps: GameRecap[] = [
      {
        game: 'touchdown',
        modes: [
          { mode: 'easy', top: [{ name: 'Ada', score: 900 }, { name: 'Bob', score: 800 }], total: 2 },
          { mode: 'pro', top: [], total: 0 },
        ],
      },
      { game: 'catch', modes: [{ mode: 'easy', top: [], total: 0 }, { mode: 'pro', top: [{ name: 'Cy', score: 50 }], total: 1 }] },
    ]
    const embed = buildRecapEmbed(10, recaps, 'https://moondao.com')!
    expect(embed.title).to.contain('Mission 10')
    expect(embed.description).to.contain('**[Touchdown](https://moondao.com/touchdown)**\nEasy: 🥇 Ada 900 · 🥈 Bob 800 (2 pilots)')
    expect(embed.description).to.contain('**[Starship Catch](https://moondao.com/starship)**\nPro: 🥇 Cy 50 (1 pilot)')
    // An unplayed mode gets no line.
    expect(embed.description).not.to.contain('Easy: 🥇 Cy')

    const empty = recaps.map((r) => ({ ...r, modes: r.modes.map((m) => ({ ...m, top: [], total: 0 })) }))
    expect(buildRecapEmbed(10, empty)).to.equal(null)
  })
})

describe('games discord: announceNewLeader', () => {
  const args = { game: 'touchdown' as const, mode: 'easy' as const, mission: 10, today: 10, key: 'ada', name: 'Ada', score: 900, previous: rival }

  it('posts, counts toward the cap, and remembers the message for moderation', async () => {
    const redis = fakeRedis()
    const { calls, post } = recordingPost()
    const result = await announceNewLeader(redis, args, { post, env: LIVE })
    expect(result).to.deep.equal({ posted: true })
    expect(calls).to.have.length(1)
    expect(calls[0].channelId).to.equal(CHANNEL)
    expect(redis.kv.get('games:discord:prod:cap:touchdown:10')).to.equal(1)
    expect(redis.kv.get('games:discord:prod:msg:touchdown:10:easy:ada')).to.deep.equal([`${CHANNEL}:987654321098765432`])
  })

  it('stays quiet once the day’s cap is used', async () => {
    const redis = fakeRedis()
    redis.kv.set('games:discord:prod:cap:touchdown:10', NEW_LEADER_DAILY_CAP)
    const { calls, post } = recordingPost()
    expect(await announceNewLeader(redis, args, { post, env: LIVE })).to.deep.equal({ posted: false, reason: 'daily-cap' })
    expect(calls).to.have.length(0)
  })

  it('never throws into the score route', async () => {
    const redis = fakeRedis()
    const post = (async () => {
      throw new Error('boom')
    }) as any
    expect(await announceNewLeader(redis, args, { post, env: LIVE })).to.deep.equal({ posted: false, reason: 'error' })
  })
})

describe('games discord: removeLeaderPosts', () => {
  it('deletes the Discord messages a removed name earned', async () => {
    const redis = fakeRedis()
    const key = 'games:discord:prod:msg:catch:10:pro:ada'
    redis.kv.set(key, [`${CHANNEL}:111111111111111111`, `${CHANNEL}:222222222222222222`])
    const urls: string[] = []
    const fetchImpl = (async (url: string, init: any) => {
      expect(init.method).to.equal('DELETE')
      urls.push(url)
      return { ok: !url.endsWith('2222'), status: url.endsWith('2222') ? 404 : 204 }
    }) as any
    const n = await removeLeaderPosts(redis, { game: 'catch', mission: 10, mode: 'pro', key: 'ada' }, { fetchImpl, botToken: 't', env: LIVE })
    expect(n).to.equal(2)
    expect(urls[0]).to.equal(`https://discord.com/api/v10/channels/${CHANNEL}/messages/111111111111111111`)
    expect(redis.kv.has(key)).to.equal(false)
  })
})

describe('games discord: postDailyRecap', () => {
  const played: GameRecap[] = [{ game: 'catch', modes: [{ mode: 'easy', top: [{ name: 'Ada', score: 5 }], total: 1 }] }]

  it('posts once per mission', async () => {
    const redis = fakeRedis()
    const { calls, post } = recordingPost()
    const read = async () => played
    expect(await postDailyRecap(redis, 9, read, { post, env: LIVE })).to.deep.equal({ posted: true, mission: 9 })
    expect(await postDailyRecap(redis, 9, read, { post, env: LIVE })).to.deep.equal({
      posted: false,
      mission: 9,
      reason: 'already-posted',
    })
    expect(calls).to.have.length(1)
  })

  it('frees the slot when Discord rejects the post, so the next run retries', async () => {
    const redis = fakeRedis()
    const post = (async () => ({ ok: false, status: 500, retryable: true, reason: 'discord-retryable' })) as any
    expect(await postDailyRecap(redis, 9, async () => played, { post, env: LIVE })).to.deep.equal({
      posted: false,
      mission: 9,
      reason: 'discord-retryable',
    })
    expect(redis.kv.has('games:discord:prod:recap:9')).to.equal(false)
  })

  it('posts nothing for a day nobody played', async () => {
    const redis = fakeRedis()
    const { calls, post } = recordingPost()
    expect(await postDailyRecap(redis, 9, async () => [], { post, env: LIVE })).to.deep.equal({
      posted: false,
      mission: 9,
      reason: 'nobody-played',
    })
    expect(calls).to.have.length(0)
  })
})
