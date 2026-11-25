/// <reference types="node" />
/// <reference types="mocha" />
import assert from 'assert'
import { CK_NETWORK_SIGNUP_TAG_ID } from 'const/config'
import type { NextApiRequest, NextApiResponse } from 'next'
import { isAllowedTagRequest } from '../lib/convert-kit/tagRequest'
import { toPublicDiscordMembers } from '../lib/discord/publicMembers'
import {
  PROJECT_ACTIVE,
  PROJECT_ENDED,
  PROJECT_PENDING,
  PROJECT_VOTE_FAILED,
} from '../lib/nance/types'
import {
  isDecidedMemberVote,
  isSnapshotVoteRow,
  snapshotRetryDecision,
} from '../lib/proposals/memberVoteSnapshotRetry'
import { createIpRateLimit } from '../middleware/rateLimit'

function mockReq(method: string): NextApiRequest {
  return {
    method,
    url: '/api/test',
    headers: { 'x-real-ip': '203.0.113.8' },
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as NextApiRequest
}

function mockRes() {
  const res = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    payload: undefined as unknown,
    setHeader(name: string, value: string) {
      res.headers[name] = value
      return res
    },
    status(code: number) {
      res.statusCode = code
      return res
    },
    json(body: unknown) {
      res.payload = body
      return res
    },
  }
  return res
}

function fakeLimiter(success: boolean) {
  const keys: string[] = []
  return {
    keys,
    async limit(key: string) {
      keys.push(key)
      return { success, reset: Date.now() + 90_000 }
    },
  }
}

async function run(limiter: ReturnType<typeof fakeLimiter>, method: string) {
  const res = mockRes()
  let nextCalled = false
  await createIpRateLimit('test', limiter)(
    mockReq(method),
    res as unknown as NextApiResponse,
    () => {
      nextCalled = true
    }
  )
  return { res, nextCalled }
}

describe('createIpRateLimit', () => {
  const originalEnv = process.env.NEXT_PUBLIC_ENV
  afterEach(() => {
    process.env.NEXT_PUBLIC_ENV = originalEnv
  })

  it('does nothing outside prod', async () => {
    process.env.NEXT_PUBLIC_ENV = 'dev'
    const limiter = fakeLimiter(false)
    const { nextCalled } = await run(limiter, 'POST')
    assert.equal(nextCalled, true)
    assert.deepEqual(limiter.keys, [])
  })

  it('leaves non-POST requests to the general limiter', async () => {
    process.env.NEXT_PUBLIC_ENV = 'prod'
    const limiter = fakeLimiter(false)
    const { nextCalled } = await run(limiter, 'GET')
    assert.equal(nextCalled, true)
    assert.deepEqual(limiter.keys, [])
  })

  it('keys POSTs on the client IP alone', async () => {
    process.env.NEXT_PUBLIC_ENV = 'prod'
    const limiter = fakeLimiter(true)
    const { nextCalled } = await run(limiter, 'POST')
    assert.equal(nextCalled, true)
    assert.deepEqual(limiter.keys, ['test:203.0.113.8'])
  })

  it('answers 429 with Retry-After once the cap is hit', async () => {
    process.env.NEXT_PUBLIC_ENV = 'prod'
    const { res, nextCalled } = await run(fakeLimiter(false), 'POST')
    assert.equal(nextCalled, false)
    assert.equal(res.statusCode, 429)
    assert.ok(Number(res.headers['Retry-After']) >= 1)
    assert.equal(res.headers['X-RateLimit-Reason'], 'test')
  })
})

describe('member vote snapshot retry', () => {
  const base = {
    decidedPassed: true,
    tallyPassed: true,
    hasSnapshotRow: false,
    votingPowerUnavailable: false,
  }

  it('only runs on decided votes', () => {
    assert.equal(isDecidedMemberVote(PROJECT_ACTIVE), true)
    assert.equal(isDecidedMemberVote(PROJECT_VOTE_FAILED), true)
    assert.equal(isDecidedMemberVote(PROJECT_PENDING), false)
    assert.equal(isDecidedMemberVote(PROJECT_ENDED), false)
    assert.equal(isDecidedMemberVote(String(PROJECT_ACTIVE)), false)
  })

  it('writes when the recount matches the decision', () => {
    assert.deepEqual(snapshotRetryDecision(base), { write: true })
    assert.deepEqual(snapshotRetryDecision({ ...base, decidedPassed: false, tallyPassed: false }), {
      write: true,
    })
  })

  it('skips the write when a snapshot row already exists', () => {
    const decision = snapshotRetryDecision({
      ...base,
      hasSnapshotRow: true,
      votingPowerUnavailable: true,
    })
    assert.deepEqual(decision, {
      write: false,
      status: 200,
      body: { written: true, alreadyExisted: true },
    })
  })

  it('refuses when voting power could not be fetched', () => {
    const decision = snapshotRetryDecision({ ...base, votingPowerUnavailable: true })
    assert.equal(decision.write, false)
    assert.equal(!decision.write && decision.status, 503)
  })

  it('refuses a recount that disagrees with the recorded result', () => {
    for (const [decidedPassed, tallyPassed] of [
      [true, false],
      [false, true],
    ]) {
      const decision = snapshotRetryDecision({ ...base, decidedPassed, tallyPassed })
      assert.equal(!decision.write && decision.status, 409)
    }
  })

  it('tells the snapshot sentinel apart from voter rows', () => {
    assert.equal(isSnapshotVoteRow({ vote: { kind: 'snapshot' } }), true)
    assert.equal(isSnapshotVoteRow({ vote: '{"kind":"snapshot","closeBlocks":{}}' }), true)
    assert.equal(isSnapshotVoteRow({ vote: '{"1":100}' }), false)
    assert.equal(isSnapshotVoteRow({ vote: 'not json' }), false)
    assert.equal(isSnapshotVoteRow({}), false)
  })
})

describe('ConvertKit tag requests', () => {
  it('accepts the network signup tag with a valid email', () => {
    assert.equal(isAllowedTagRequest('ada@moondao.com', CK_NETWORK_SIGNUP_TAG_ID), true)
  })

  it('rejects other tags, including path tricks', () => {
    assert.equal(isAllowedTagRequest('ada@moondao.com', '4416101'), false)
    assert.equal(
      isAllowedTagRequest('ada@moondao.com', `../forms/${CK_NETWORK_SIGNUP_TAG_ID}`),
      false
    )
    assert.equal(isAllowedTagRequest('ada@moondao.com', Number(CK_NETWORK_SIGNUP_TAG_ID)), false)
  })

  it('rejects missing or malformed emails', () => {
    assert.equal(isAllowedTagRequest('', CK_NETWORK_SIGNUP_TAG_ID), false)
    assert.equal(isAllowedTagRequest('not-an-email', CK_NETWORK_SIGNUP_TAG_ID), false)
    assert.equal(isAllowedTagRequest(['ada@moondao.com'], CK_NETWORK_SIGNUP_TAG_ID), false)
  })
})

describe('Discord member search results', () => {
  it('keeps only public profile fields', () => {
    const members = [
      {
        nick: 'Ada',
        roles: ['123'],
        joined_at: '2022-01-01T00:00:00Z',
        user: {
          id: '42',
          username: 'ada',
          global_name: 'Ada L',
          avatar: 'abc',
          email: 'ada@moondao.com',
        },
      },
    ]
    assert.deepEqual(toPublicDiscordMembers(members), [
      { user: { id: '42', username: 'ada', global_name: 'Ada L', avatar: 'abc' } },
    ])
  })

  it('returns an empty list for an unexpected response', () => {
    assert.deepEqual(toPublicDiscordMembers({ message: 'Unknown Guild' }), [])
    assert.deepEqual(toPublicDiscordMembers(null), [])
  })
})
