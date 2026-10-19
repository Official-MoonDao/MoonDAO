/// <reference types="node" />
import { expect } from 'chai'
import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  FIRST_RUN_EXCLUSION_SET,
  KitResubscribeBlocked,
  renewalStageDedupeKey,
  type CoverageInput,
} from '../lib/citizen/renewalCoverage'
import {
  DEFAULT_RENEWAL_SEQUENCE_IDS,
  DEFAULT_RENEWAL_TAG_IDS,
  kitAddTagRequest,
  kitSequenceRemoval,
  parseRenewalStageKey,
  planRenewalWrites,
  renewalSequenceIds,
  resolveRenewalTagIds,
  renewalTagNames,
  selectForwardRenewals,
  type PlannedRenewalWrite,
} from '../lib/citizen/renewalCoverageLive'
import {
  createKitMutator,
  executeRenewalWrites,
  runRenewalWritePass,
  type FetchLike,
  type RenewalRedis,
} from '../lib/citizen/renewalCoverageWrite'
import { parseExclusionEmails, saddExclusionEmails } from './load-renewal-exclusions'

const NOW = Date.UTC(2026, 9, 7)
const NOW_SEC = NOW / 1000
const DAY = 24 * 60 * 60

function expiresIn(days: number): number {
  return NOW_SEC + days * DAY
}

function activeRow(
  tokenId: string,
  days: number,
  extra: Partial<CoverageInput> = {}
): CoverageInput {
  return {
    tokenId,
    expiresAt: expiresIn(days),
    email: `person${tokenId}@example.com`,
    kitState: 'active' as string | null,
    kitSubscriberId: `${900000 + Number(tokenId)}`,
    suppressed: false,
    firstRunRedis: false,
    ...extra,
  }
}

function memoryRedis(seed?: { keys?: Record<string, string>; sets?: Record<string, string[]> }): {
  redis: RenewalRedis
  keys: Record<string, string>
  sets: Map<string, Set<string>>
  mutations: string[]
} {
  const keys = { ...(seed?.keys || {}) }
  const sets = new Map<string, Set<string>>()
  for (const [key, members] of Object.entries(seed?.sets || {})) {
    sets.set(key, new Set(members))
  }
  const mutations: string[] = []
  return {
    keys,
    sets,
    mutations,
    redis: {
      async get(key) {
        return keys[key] ?? null
      },
      async set(key, value) {
        mutations.push(`set ${key}`)
        keys[key] = value
      },
      async sadd(key, members) {
        mutations.push(`sadd ${key}`)
        const set = sets.get(key) || new Set<string>()
        members.forEach((member) => set.add(member))
        sets.set(key, set)
      },
      async srem(key, members) {
        mutations.push(`srem ${key}`)
        const set = sets.get(key) || new Set<string>()
        members.forEach((member) => set.delete(member))
        sets.set(key, set)
      },
      async smembers(key) {
        return [...(sets.get(key) || [])]
      },
    },
  }
}

function recordingFetch(): {
  calls: Array<{ method: string; url: string; body?: string }>
  fetchImpl: FetchLike
} {
  const calls: Array<{ method: string; url: string; body?: string }> = []
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ method: init?.method || 'GET', url, body: init?.body })
    return { ok: true, status: init?.method === 'DELETE' ? 204 : 200 }
  }
  return { calls, fetchImpl }
}

const LIVE_ENV = {
  RENEWAL_REMINDERS_LIVE: 'true',
  CONVERT_KIT_V4_API_KEY: 'kit-test-key',
  RENEWAL_REMINDER_TAG_ID: '11',
  RENEWAL_CATCHUP_MINUS7_TAG_ID: '12',
  RENEWAL_CATCHUP_EXPIRY_TAG_ID: '13',
  RENEWAL_CATCHUP_PLUS14_TAG_ID: '14',
  RENEWED_TAG_ID: '15',
}

const TAG_IDS = {
  reminder: '11',
  catchupMinus7: '12',
  catchupExpiry: '13',
  catchupPlus14: '14',
  renewed: '15',
}

function passArgs(
  overrides: Partial<Parameters<typeof runRenewalWritePass>[0]> = {}
): Parameters<typeof runRenewalWritePass>[0] {
  return {
    env: {},
    liveParam: undefined,
    rows: [],
    profiles: [],
    expiresAt: new Map(),
    nowMs: NOW,
    formIds: ['form'],
    typeformToken: 'token',
    exclusionsReady: true,
    exclusionSets: {
      suppressed: new Set<string>(),
      firstRunRedis: new Set<string>(),
    },
    allowKitReads: false,
    listTags: async () => [],
    ...overrides,
  }
}

describe('renewal live gate', () => {
  it('writes nothing unless the env flag and live=1 are both set', async () => {
    const row = activeRow('1', 30, { email: 'unique-renewal-person@example.com' })
    const store = memoryRedis()
    store.redis.set = async () => {
      throw new Error('redis write')
    }
    const { calls, fetchImpl } = recordingFetch()
    const cases = [
      { env: {}, liveParam: undefined },
      { env: { RENEWAL_REMINDERS_LIVE: 'true' }, liveParam: undefined },
      { env: {}, liveParam: '1' },
      { env: { RENEWAL_REMINDERS_LIVE: 'TRUE' }, liveParam: '1' },
      { env: { RENEWAL_REMINDERS_LIVE: 'true' }, liveParam: 'true' },
    ]
    for (const gate of cases) {
      const result = await runRenewalWritePass(
        passArgs({
          env: gate.env,
          liveParam: gate.liveParam,
          rows: [row],
          redis: store.redis,
          fetchImpl,
        })
      )
      expect(result.live).to.equal(false)
      expect(result.writing).to.equal(false)
      expect(result.buckets.renewalReminder.planned).to.equal(1)
      expect(result.buckets.renewalReminder.executed).to.equal(0)
      expect(JSON.stringify(result)).to.not.include('unique-renewal-person@example.com')
      expect(result.actions[0].emailMasked).to.equal('u***@example.com')
    }
    const writes = calls.filter((call) => call.method === 'POST' || call.method === 'DELETE')
    expect(writes).to.deep.equal([])
  })
})

describe('late entrant routing', () => {
  it('gives day -30 the reminder tag and later first sightings a catch-up tag', () => {
    const rows = [
      activeRow('30', 30),
      activeRow('20', 20),
      activeRow('14', 14),
      activeRow('0', 0),
      activeRow('14', -14),
    ]
    rows[4].tokenId = '44'
    rows[4].kitSubscriberId = '900044'
    const plan = planRenewalWrites({
      rows,
      renewals: [],
      nowMs: NOW,
      writtenKeys: new Set(),
    })
    const byToken = new Map(plan.writes.map((write) => [write.tokenId, write]))
    expect(byToken.get('30')?.stage).to.equal('minus30')
    expect(byToken.get('30')?.ops.map((op) => op.tagKey)).to.deep.equal(['reminder'])
    expect(byToken.get('20')?.stage).to.equal('minus7')
    expect(byToken.get('20')?.ops.map((op) => op.tagKey)).to.deep.equal(['catchupMinus7'])
    expect(byToken.get('14')?.stage).to.equal('minus7')
    expect(byToken.get('0')?.stage).to.equal('expiry')
    expect(byToken.get('44')?.stage).to.equal('plus14')
    for (const write of plan.writes) {
      if (write.stage !== 'minus30') {
        expect(write.ops.some((op) => op.tagKey === 'reminder')).to.equal(false)
      }
    }
  })

  it('uses configured catch-up tag names and does not post the reminder tag', async () => {
    const store = memoryRedis()
    const { calls, fetchImpl } = recordingFetch()
    const result = await runRenewalWritePass(
      passArgs({
        env: {
          ...LIVE_ENV,
          RENEWAL_CATCHUP_MINUS7_TAG_NAME: 'Custom-Catchup-14',
        },
        liveParam: '1',
        rows: [activeRow('7', 20, { email: 'late-person@example.com' })],
        redis: store.redis,
        fetchImpl,
      })
    )
    expect(result.buckets.catchupMinus7.planned).to.equal(1)
    expect(result.buckets.catchupMinus7.executed).to.equal(1)
    expect(result.buckets.renewalReminder.planned).to.equal(0)
    expect(result.actions[0].ops).to.deep.equal([{ op: 'add', tag: 'Custom-Catchup-14' }])
    expect(calls.map((call) => call.method)).to.deep.equal(['POST'])
    expect(calls[0].url).to.equal('https://api.kit.com/v4/tags/12/subscribers/900007')
    expect(calls[0].url).to.not.include('late-person@example.com')
    expect(calls[0].body).to.equal('{}')
    expect(JSON.stringify(result)).to.not.include('late-person@example.com')
  })
})

describe('renewed swap', () => {
  it('selects only expiries that moved forward past 30 days', () => {
    const openKey = renewalStageDedupeKey('9', expiresIn(10), 'minus30')
    const open = [
      {
        tokenId: '9',
        expiresAt: expiresIn(10),
        stage: 'minus30' as const,
        key: openKey,
      },
    ]
    const forward = selectForwardRenewals(open, new Map([['9', expiresIn(200)]]), NOW)
    expect(forward).to.have.length(1)
    expect(forward[0].expiresAt).to.equal(expiresIn(200))
    expect(forward[0].openMembers).to.deep.equal([openKey])

    const stillInside = selectForwardRenewals(open, new Map([['9', expiresIn(20)]]), NOW)
    expect(stillInside).to.deep.equal([])

    const passedWithoutRenewing = selectForwardRenewals(open, new Map([['9', expiresIn(-20)]]), NOW)
    expect(passedWithoutRenewing).to.deep.equal([])
  })

  it('adds Renewed and removes the reminder and catch-up tags', async () => {
    const openKey = renewalStageDedupeKey('9', expiresIn(10), 'minus7')
    const row = activeRow('9', 200, { email: 'renewed-person@example.com' })
    const plan = planRenewalWrites({
      rows: [],
      renewals: [{ ...row, openMembers: [openKey] }],
      nowMs: NOW,
      writtenKeys: new Set(),
    })
    expect(plan.writes).to.have.length(1)
    expect(plan.writes[0].stage).to.equal('renewed')
    expect(plan.writes[0].dedupeKey).to.equal(renewalStageDedupeKey('9', expiresIn(200), 'renewed'))
    expect(plan.writes[0].ops.map((op) => op.tagKey)).to.deep.equal([
      'renewed',
      'reminder',
      'catchupMinus7',
      'catchupExpiry',
      'catchupPlus14',
    ])
    expect(plan.writes[0].ops.filter((op) => op.op === 'add').map((op) => op.tagKey)).to.deep.equal(
      ['renewed']
    )

    const store = memoryRedis({ sets: { 'renewal:open': [openKey] } })
    const { calls, fetchImpl } = recordingFetch()
    const kit = createKitMutator(fetchImpl, 'kit-test-key')
    const result = await executeRenewalWrites({
      writing: true,
      writes: plan.writes,
      tagIds: TAG_IDS,
      sequenceIds: DEFAULT_RENEWAL_SEQUENCE_IDS,
      redis: store.redis,
      kit,
    })
    expect(result.failed).to.deep.equal([])
    expect(result.executedKeys).to.deep.equal([plan.writes[0].dedupeKey])
    expect(calls.map((call) => `${call.method} ${call.url}`)).to.deep.equal([
      'POST https://api.kit.com/v4/tags/15/subscribers/900009',
      'DELETE https://api.kit.com/v4/tags/11/subscribers/900009',
      'DELETE https://api.kit.com/v4/tags/12/subscribers/900009',
      'DELETE https://api.kit.com/v4/tags/13/subscribers/900009',
      'DELETE https://api.kit.com/v4/tags/14/subscribers/900009',
    ])
    expect(store.keys[plan.writes[0].dedupeKey]).to.equal('1')
    expect([...(store.sets.get('renewal:open') || [])]).to.deep.equal([])
    expect(JSON.stringify(plan.writes[0].emailMasked)).to.not.include('renewed-person@example.com')
  })
})

describe('sequence removal', () => {
  const configured = ['111', '222', '333', '444']

  function renewedWrites(tokenIds: string[]) {
    return planRenewalWrites({
      rows: [],
      renewals: tokenIds.map((tokenId) => ({
        ...activeRow(tokenId, 200, { email: `renewed-${tokenId}@example.com` }),
        openMembers: [renewalStageDedupeKey(tokenId, expiresIn(10), 'minus7')],
      })),
      nowMs: NOW,
      writtenKeys: new Set(),
    }).writes
  }

  it('makes zero calls when the live flag is off', async () => {
    const removals: string[] = []
    const { calls, fetchImpl } = recordingFetch()
    const base = createKitMutator(fetchImpl, 'kit-test-key')
    const kit = {
      addTag: base.addTag.bind(base),
      removeTag: base.removeTag.bind(base),
      async removeFromSequence(sequenceId: string, subscriberId: string, state: string | null) {
        removals.push(`${subscriberId}:${sequenceId}`)
        return base.removeFromSequence(sequenceId, subscriberId, state)
      },
    }
    const store = memoryRedis()
    const gated = await executeRenewalWrites({
      writing: false,
      writes: renewedWrites(['9']),
      tagIds: TAG_IDS,
      sequenceIds: configured,
      redis: store.redis,
      kit,
    })
    expect(gated.sequenceAttempted).to.equal(0)
    expect(gated.executedKeys).to.deep.equal([])
    expect(removals).to.deep.equal([])
    expect(calls).to.deep.equal([])
    expect(store.mutations).to.deep.equal([])

    const dry = await runRenewalWritePass(
      passArgs({
        env: { RENEWAL_SEQUENCE_IDS: configured.join(',') },
        liveParam: undefined,
        rows: [activeRow('1', 30, { email: 'dry-sequence-person@example.com' })],
        redis: memoryRedis().redis,
        fetchImpl,
      })
    )
    expect(dry.writing).to.equal(false)
    expect(dry.sequenceRemoval.attempted).to.equal(0)
    expect(dry.sequenceRemoval.failed).to.equal(0)
    expect(dry.sequenceRemoval.status).to.equal('unsupported')
    expect(dry.sequenceRemoval.sequenceIds).to.deep.equal(configured)
    expect(calls).to.deep.equal([])
    expect(JSON.stringify(dry)).to.not.include('dry-sequence-person@example.com')
  })

  it('removes a renewal from exactly the configured sequences', async () => {
    const removals: string[] = []
    const { calls, fetchImpl } = recordingFetch()
    const base = createKitMutator(fetchImpl, 'kit-test-key')
    const kit = {
      addTag: base.addTag.bind(base),
      removeTag: base.removeTag.bind(base),
      async removeFromSequence(sequenceId: string, subscriberId: string, state: string | null) {
        removals.push(`${subscriberId}:${sequenceId}`)
        return base.removeFromSequence(sequenceId, subscriberId, state)
      },
    }
    const direct = kitSequenceRemoval('2929996', '900009', 'active')
    expect(direct).to.deep.equal({ status: 'unsupported' })
    expect(calls).to.deep.equal([])

    const store = memoryRedis()
    const writes = renewedWrites(['9'])
    const result = await executeRenewalWrites({
      writing: true,
      writes,
      tagIds: TAG_IDS,
      sequenceIds: configured,
      redis: store.redis,
      kit,
    })
    expect(removals).to.deep.equal(configured.map((id) => `900009:${id}`))
    expect(result.sequenceAttempted).to.equal(configured.length)
    expect(result.sequenceFailures).to.deep.equal([])
    expect(result.executedKeys).to.deep.equal([writes[0].dedupeKey])
    expect(calls.map((call) => call.url)).to.deep.equal([
      'https://api.kit.com/v4/tags/15/subscribers/900009',
      'https://api.kit.com/v4/tags/11/subscribers/900009',
      'https://api.kit.com/v4/tags/12/subscribers/900009',
      'https://api.kit.com/v4/tags/13/subscribers/900009',
      'https://api.kit.com/v4/tags/14/subscribers/900009',
    ])
    for (const call of calls) {
      expect(call.url).to.not.include('/unsubscribe')
      expect(call.url).to.not.include('/sequences/')
      expect(call.url).to.not.include('/v3/')
    }
    expect(
      DEFAULT_RENEWAL_SEQUENCE_IDS.some((id) => removals.some((entry) => entry.endsWith(id)))
    ).to.equal(false)

    const reminder = planRenewalWrites({
      rows: [activeRow('1', 30)],
      renewals: [],
      nowMs: NOW,
      writtenKeys: new Set(),
    })
    removals.length = 0
    await executeRenewalWrites({
      writing: true,
      writes: reminder.writes,
      tagIds: TAG_IDS,
      sequenceIds: configured,
      redis: memoryRedis().redis,
      kit,
    })
    expect(removals).to.deep.equal([])

    removals.length = 0
    const again = await executeRenewalWrites({
      writing: true,
      writes,
      tagIds: TAG_IDS,
      sequenceIds: configured,
      redis: store.redis,
      kit,
    })
    expect(again.sequenceAttempted).to.equal(0)
    expect(removals).to.deep.equal([])
  })

  it('keeps processing sequences after one failure', async () => {
    const removals: string[] = []
    const { calls, fetchImpl } = recordingFetch()
    const base = createKitMutator(fetchImpl, 'kit-test-key')
    const kit = {
      addTag: base.addTag.bind(base),
      removeTag: base.removeTag.bind(base),
      async removeFromSequence(sequenceId: string, subscriberId: string, state: string | null) {
        removals.push(`${subscriberId}:${sequenceId}`)
        if (sequenceId === '222') throw new Error('sequence failed')
        return base.removeFromSequence(sequenceId, subscriberId, state)
      },
    }
    const store = memoryRedis()
    const writes = renewedWrites(['9', '10'])
    const result = await executeRenewalWrites({
      writing: true,
      writes,
      tagIds: TAG_IDS,
      sequenceIds: configured,
      redis: store.redis,
      kit,
    })
    expect(removals).to.deep.equal([
      ...configured.map((id) => `900009:${id}`),
      ...configured.map((id) => `900010:${id}`),
    ])
    expect(result.sequenceFailures).to.deep.equal([
      { tokenId: '9', sequenceId: '222' },
      { tokenId: '10', sequenceId: '222' },
    ])
    expect(result.failed).to.deep.equal([])
    expect(result.executedKeys).to.deep.equal(writes.map((write) => write.dedupeKey))
    expect(calls.some((call) => call.url.includes('/unsubscribe'))).to.equal(false)
    expect(calls.some((call) => call.url.includes('/sequences/'))).to.equal(false)

    removals.length = 0
    const again = await executeRenewalWrites({
      writing: true,
      writes,
      tagIds: TAG_IDS,
      sequenceIds: configured,
      redis: store.redis,
      kit,
    })
    expect(removals).to.deep.equal([])
    expect(again.sequenceAttempted).to.equal(0)
    expect(store.keys[writes[0].dedupeKey]).to.equal('1')
    expect(store.keys[writes[1].dedupeKey]).to.equal('1')
  })
})

describe('renewal dedupe writes', () => {
  it('skips a stage that was already written', async () => {
    const key = renewalStageDedupeKey('1', expiresIn(30), 'minus30')
    const plan = planRenewalWrites({
      rows: [activeRow('1', 30)],
      renewals: [],
      nowMs: NOW,
      writtenKeys: new Set([key]),
    })
    expect(plan.writes).to.deep.equal([])
    expect(plan.skipped.deduped).to.equal(1)

    const store = memoryRedis()
    const firstFetch = recordingFetch()
    const first = await runRenewalWritePass(
      passArgs({
        env: LIVE_ENV,
        liveParam: '1',
        rows: [activeRow('1', 30, { email: 'dedupe-person@example.com' })],
        redis: store.redis,
        fetchImpl: firstFetch.fetchImpl,
      })
    )
    expect(first.buckets.renewalReminder.executed).to.equal(1)
    expect(store.keys[key]).to.equal('1')
    expect(firstFetch.calls).to.have.length(1)

    const secondFetch = recordingFetch()
    const second = await runRenewalWritePass(
      passArgs({
        env: LIVE_ENV,
        liveParam: '1',
        rows: [activeRow('1', 30, { email: 'dedupe-person@example.com' })],
        redis: store.redis,
        fetchImpl: secondFetch.fetchImpl,
      })
    )
    expect(second.buckets.renewalReminder.planned).to.equal(0)
    expect(second.skipped.deduped).to.equal(1)
    expect(
      secondFetch.calls.filter((call) => call.method === 'POST' || call.method === 'DELETE')
    ).to.deep.equal([])
  })

  it('does not tag again when the dedupe key already exists', async () => {
    const row = activeRow('3', 30)
    const plan = planRenewalWrites({
      rows: [row],
      renewals: [],
      nowMs: NOW,
      writtenKeys: new Set(),
    })
    const store = memoryRedis({ keys: { [plan.writes[0].dedupeKey]: '1' } })
    const { calls, fetchImpl } = recordingFetch()
    const kit = createKitMutator(fetchImpl, 'kit-test-key')
    const result = await executeRenewalWrites({
      writing: true,
      writes: plan.writes,
      tagIds: TAG_IDS,
      sequenceIds: DEFAULT_RENEWAL_SEQUENCE_IDS,
      redis: store.redis,
      kit,
    })
    expect(result.executedKeys).to.deep.equal([])
    expect(calls).to.deep.equal([])
  })
})

describe('renewal exclusions', () => {
  it('holds the Oct 2 list on pre-expiry stages and still tags expiry', async () => {
    const rows = [
      activeRow('1', 30, { suppressed: true, email: 'suppressed-person@example.com' }),
      activeRow('2', 20, { firstRunRedis: true, email: 'firstrun-person@example.com' }),
      activeRow('3', 0, { firstRunRedis: true, email: 'expiry-person@example.com' }),
    ]
    const plan = planRenewalWrites({
      rows,
      renewals: [],
      nowMs: NOW,
      writtenKeys: new Set(),
    })
    expect(plan.writes.map((write) => write.tokenId)).to.deep.equal(['3'])
    expect(plan.writes[0].stage).to.equal('expiry')
    expect(plan.skipped.suppressed).to.equal(1)
    expect(plan.skipped.firstRun).to.equal(1)

    const { calls, fetchImpl } = recordingFetch()
    const result = await runRenewalWritePass(
      passArgs({
        env: LIVE_ENV,
        liveParam: '1',
        rows,
        redis: memoryRedis().redis,
        fetchImpl,
      })
    )
    expect(result.buckets.renewalReminder.executed).to.equal(0)
    expect(result.buckets.catchupMinus7.executed).to.equal(0)
    expect(result.buckets.catchupExpiry.executed).to.equal(1)
    expect(calls.map((call) => call.method)).to.deep.equal(['POST'])
    const encoded = JSON.stringify(result)
    expect(encoded).to.not.include('suppressed-person@example.com')
    expect(encoded).to.not.include('firstrun-person@example.com')
    expect(encoded).to.not.include('expiry-person@example.com')
  })

  it('blocks live writes when an exclusion set was not read', async () => {
    const { calls, fetchImpl } = recordingFetch()
    const result = await runRenewalWritePass(
      passArgs({
        env: LIVE_ENV,
        liveParam: '1',
        exclusionsReady: false,
        rows: [activeRow('1', 30)],
        redis: memoryRedis().redis,
        fetchImpl,
      })
    )
    expect(result.live).to.equal(false)
    expect(result.buckets.renewalReminder.executed).to.equal(0)
    expect(result.reason).to.include('Exclusion sets')
    expect(calls).to.deep.equal([])
  })
})

describe('never re-add Kit subscribers', () => {
  const optedOut = ['cancelled', 'unsubscribed', 'bounced', 'complained']

  it('plans no tag and no subscriber create for opt-out or typeform-only rows', async () => {
    const rows = [
      ...optedOut.map((state, index) =>
        activeRow(String(index + 1), 30, { kitState: state, email: `${state}-person@example.com` })
      ),
      activeRow('8', 12, {
        kitState: null,
        kitSubscriberId: null,
        email: 'typeform-only@example.com',
      }),
      activeRow('9', 12, { kitState: 'inactive', email: 'inactive-person@example.com' }),
    ]
    const plan = planRenewalWrites({
      rows,
      renewals: [],
      nowMs: NOW,
      writtenKeys: new Set(),
    })
    expect(plan.writes).to.deep.equal([])
    expect(plan.skipped.kitOptOut).to.equal(4)
    expect(plan.skipped.typeformOnly).to.equal(1)
    expect(plan.skipped.kitNotActive).to.equal(1)

    const { calls, fetchImpl } = recordingFetch()
    const result = await runRenewalWritePass(
      passArgs({
        env: LIVE_ENV,
        liveParam: '1',
        rows,
        redis: memoryRedis().redis,
        fetchImpl,
      })
    )
    expect(result.buckets.typeformOnly.planned).to.equal(0)
    expect(result.buckets.typeformOnly.executed).to.equal(0)
    expect(result.buckets.typeformOnly.reported).to.equal(1)
    expect(
      calls.filter((call) => call.method === 'POST' || call.method === 'DELETE')
    ).to.deep.equal([])
    expect(JSON.stringify(result)).to.not.include('typeform-only@example.com')
    expect(JSON.stringify(result)).to.not.include('unsubscribed-person@example.com')
  })

  it('refuses to build a tag request for an unsubscribed subscriber', async () => {
    expect(() => kitAddTagRequest('11', '55', 'unsubscribed')).to.throw(KitResubscribeBlocked)
    const { calls, fetchImpl } = recordingFetch()
    const kit = createKitMutator(fetchImpl, 'kit-test-key')
    let caught = false
    try {
      await kit.addTag('11', '55', 'unsubscribed')
    } catch (error) {
      caught = error instanceof KitResubscribeBlocked
    }
    expect(caught).to.equal(true)
    expect(calls).to.deep.equal([])

    const forged: PlannedRenewalWrite = {
      tokenId: '5',
      expiresAt: expiresIn(30),
      emailMasked: 'u***@example.com',
      subscriberId: '55',
      kitState: 'unsubscribed',
      stage: 'minus30',
      bucket: 'renewalReminder',
      dedupeKey: renewalStageDedupeKey('5', expiresIn(30), 'minus30'),
      ops: [{ op: 'add', tagKey: 'reminder' }],
      openMembers: [],
    }
    const store = memoryRedis()
    const executed = await executeRenewalWrites({
      writing: false,
      writes: [forged],
      tagIds: TAG_IDS,
      sequenceIds: DEFAULT_RENEWAL_SEQUENCE_IDS,
      redis: store.redis,
      kit,
    })
    expect(executed.executedKeys).to.deep.equal([])
    expect(store.mutations).to.deep.equal([])
    expect(calls).to.deep.equal([])

    const liveAttempt = await executeRenewalWrites({
      writing: true,
      writes: [forged],
      tagIds: TAG_IDS,
      sequenceIds: DEFAULT_RENEWAL_SEQUENCE_IDS,
      redis: store.redis,
      kit,
    })
    expect(liveAttempt.failed).to.deep.equal([{ tokenId: '5', stage: 'minus30' }])
    expect(liveAttempt.executedKeys).to.deep.equal([])
    expect(store.keys[forged.dedupeKey]).to.equal(undefined)
    expect(calls).to.deep.equal([])
  })
})

describe('renewed tag clearance', () => {
  it('removes Renewed at the next cycle and does not unsubscribe', async () => {
    const row = activeRow('9', 30, { hasRenewedTag: true, email: 'return-person@example.com' })
    const plan = planRenewalWrites({
      rows: [row],
      renewals: [],
      nowMs: NOW,
      writtenKeys: new Set(),
      renewedPresentTokenIds: new Set(['9']),
    })
    expect(plan.writes).to.have.length(1)
    expect(plan.writes[0].ops).to.deep.equal([
      { op: 'remove', tagKey: 'renewed' },
      { op: 'add', tagKey: 'reminder' },
    ])

    const stillOut = planRenewalWrites({
      rows: [activeRow('9', 200, { hasRenewedTag: true })],
      renewals: [],
      nowMs: NOW,
      writtenKeys: new Set(),
    })
    expect(stillOut.writes).to.deep.equal([])

    const store = memoryRedis({ sets: { 'renewal:renewed-present': ['9'] } })
    const { calls, fetchImpl } = recordingFetch()
    const kit = createKitMutator(fetchImpl, 'kit-test-key')
    const executed = await executeRenewalWrites({
      writing: true,
      writes: plan.writes,
      tagIds: TAG_IDS,
      sequenceIds: DEFAULT_RENEWAL_SEQUENCE_IDS,
      redis: store.redis,
      kit,
    })
    expect(executed.failed).to.deep.equal([])
    expect(calls.map((call) => `${call.method} ${call.url}`)).to.deep.equal([
      'DELETE https://api.kit.com/v4/tags/15/subscribers/900009',
      'POST https://api.kit.com/v4/tags/11/subscribers/900009',
    ])
    expect(calls.some((call) => call.url.toLowerCase().includes('unsubscribe'))).to.equal(false)
    expect([...(store.sets.get('renewal:renewed-present') || [])]).to.deep.equal([])

    const optedOut = planRenewalWrites({
      rows: [activeRow('4', 30, { kitState: 'unsubscribed', hasRenewedTag: true })],
      renewals: [],
      nowMs: NOW,
      writtenKeys: new Set(),
    })
    expect(optedOut.writes).to.deep.equal([])
    expect(optedOut.skipped.kitOptOut).to.equal(1)
  })

  it('reads a legacy minus14 dedupe key as the -7 stage', () => {
    const parsed = parseRenewalStageKey(`renewal:9:${expiresIn(10)}:minus14`)
    expect(parsed?.stage).to.equal('minus7')
    expect(parsed?.key).to.include(':minus14')
  })
})

describe('renewal tag id resolution', () => {
  it('prefers an env id and otherwise matches the configured name', () => {
    const names = renewalTagNames({
      RENEWAL_CATCHUP_EXPIRY_TAG_NAME: 'Custom-Expiry',
    })
    expect(names.catchupExpiry).to.equal('Custom-Expiry')
    expect(names.reminder).to.equal('Renewal-Reminder')
    const resolved = resolveRenewalTagIds(names, { RENEWAL_REMINDER_TAG_ID: '77' }, [
      { id: '12', name: 'Renewal-Catchup-minus7' },
      { id: '13', name: 'Custom-Expiry' },
      { id: '14', name: 'Renewal-Catchup-plus14' },
      { id: '15', name: 'Renewed' },
    ])
    expect(resolved.ids.reminder).to.equal('77')
    expect(resolved.ids.catchupExpiry).to.equal('13')
    expect(resolved.missing).to.deep.equal([])

    const defaults = resolveRenewalTagIds(renewalTagNames({}), {}, [])
    expect(defaults.ids).to.deep.equal(DEFAULT_RENEWAL_TAG_IDS)
    const overridden = resolveRenewalTagIds(
      renewalTagNames({}),
      { RENEWAL_CATCHUP_MINUS7_TAG_ID: '99' },
      []
    )
    expect(overridden.ids.catchupMinus7).to.equal('99')
    expect(defaults.missing).to.deep.equal([])
    const renamed = resolveRenewalTagIds(
      renewalTagNames({ RENEWAL_REMINDER_TAG_NAME: 'Other-Reminder' }),
      {},
      []
    )
    expect(renamed.ids.reminder).to.equal(null)
    expect(renamed.ids.renewed).to.equal(DEFAULT_RENEWAL_TAG_IDS.renewed)
    expect(renamed.missing).to.deep.equal(['Other-Reminder'])
    expect(renewalSequenceIds({})).to.deep.equal([...DEFAULT_RENEWAL_SEQUENCE_IDS])
    expect(renewalSequenceIds({ RENEWAL_SEQUENCE_IDS: '8, 9,8' })).to.deep.equal(['8', '9'])
    expect(() => renewalSequenceIds({ RENEWAL_SEQUENCE_IDS: '12,nope' })).to.throw(
      'RENEWAL_SEQUENCE_IDS'
    )
  })

  it('writes the default tag ids when the account list is unavailable', async () => {
    const store = memoryRedis()
    const { calls, fetchImpl } = recordingFetch()
    const result = await runRenewalWritePass(
      passArgs({
        env: {
          RENEWAL_REMINDERS_LIVE: 'true',
          CONVERT_KIT_V4_API_KEY: 'kit-test-key',
        },
        liveParam: '1',
        rows: [activeRow('1', 30, { email: 'default-tag-person@example.com' })],
        redis: store.redis,
        fetchImpl,
        listTags: async () => {
          throw new Error('tag list failed')
        },
      })
    )
    expect(result.writing).to.equal(true)
    expect(result.tagIds).to.deep.equal(DEFAULT_RENEWAL_TAG_IDS)
    expect(result.missingTags).to.deep.equal([])
    expect(calls.map((call) => call.url)).to.deep.equal([
      `https://api.kit.com/v4/tags/${DEFAULT_RENEWAL_TAG_IDS.reminder}/subscribers/900001`,
    ])
    expect(result.sequenceRemoval.attempted).to.equal(0)
    expect(JSON.stringify(result)).to.not.include('default-tag-person@example.com')
  })
})

describe('renewal exclusion loader', () => {
  it('dry run prints a count and never the addresses', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'renewal-exclude-'))
    const csvPath = path.join(dir, 'batch.csv')
    fs.writeFileSync(
      csvPath,
      'email,note\nLate@Example.com,hello\nlate@example.com,dup\nSecond@Example.com,x\nnot-an-email,\n'
    )
    const parsed = parseExclusionEmails(fs.readFileSync(csvPath, 'utf8'))
    expect(parsed).to.deep.equal(['late@example.com', 'second@example.com'])

    const result = spawnSync(
      process.execPath,
      [
        '-r',
        'ts-node/register',
        path.join(__dirname, 'load-renewal-exclusions.ts'),
        '--csv',
        csvPath,
        '--dry-run',
      ],
      {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8',
        env: {
          ...process.env,
          UPSTASH_REDIS_URL: '',
          UPSTASH_REDIS_TOKEN: '',
        },
      }
    )
    expect(result.status).to.equal(0)
    expect(result.stdout).to.equal('count=2\n')
    expect(result.stdout).to.not.include('@')
    expect(result.stderr).to.equal('')
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('SADDs lowercase emails into the first-run set', async () => {
    const seen: Array<{ key: string; members: string[] }> = []
    const added = await saddExclusionEmails(
      ['Person@Example.com', 'person@example.com', 'Other@Example.com'],
      async (key, members) => {
        seen.push({ key, members })
        return members.length
      }
    )
    expect(added).to.equal(2)
    expect(seen).to.deep.equal([
      { key: FIRST_RUN_EXCLUSION_SET, members: ['person@example.com', 'other@example.com'] },
    ])
  })
})

describe('renewal live workflow and write guards', () => {
  const root = path.join(__dirname, '..')
  const workflow = fs.readFileSync(
    path.join(root, '../.github/workflows/citizen-renewal-reminders.yml'),
    'utf8'
  )
  const writeSource = fs.readFileSync(
    path.join(root, 'lib/citizen/renewalCoverageWrite.ts'),
    'utf8'
  )
  const liveSource = fs.readFileSync(path.join(root, 'lib/citizen/renewalCoverageLive.ts'), 'utf8')
  const scriptSource = fs.readFileSync(
    path.join(root, 'scripts/load-renewal-exclusions.ts'),
    'utf8'
  )

  it('schedules a report and keeps the live query behind the manual input', () => {
    expect(workflow).to.include('schedule:')
    expect(workflow).to.include('workflow_dispatch')
    expect(workflow).to.include('CRON_SECRET')
    expect(workflow).to.include('QUERY="dryRun=1"')
    expect(workflow).to.include('LIVE_INPUT')
    expect(workflow).to.not.include('citizen-renewal-reminders?live=1')
    expect(workflow).to.not.include('\u2014')
  })

  it('does not create subscribers or call form or sequence subscribe', () => {
    const source = `${writeSource}\n${liveSource}`
    expect(source).to.not.include('https://api.kit.com/v4/subscribers')
    expect(source).to.not.include('/forms/')
    expect(source).to.not.include('https://api.kit.com/v4/sequences')
    expect(source).to.not.include('https://api.convertkit.com/v3/sequences')
    expect(source).to.not.include("'/sequences/")
    expect(source).to.not.include('"/sequences/')
    expect(source).to.not.include('`/sequences/')
    expect(source).to.not.include('email_address')
    expect(source).to.include('/v4/tags/')
    expect(source).to.include("status: 'unsupported'")
    expect(`${source}\n${scriptSource}`).to.not.include('\u2014')
    expect(`${source}\n${scriptSource}`).to.not.include('\u2013')
  })

  it('never calls the global unsubscribe endpoint', () => {
    const source = `${writeSource}\n${liveSource}`
    expect(source).to.not.include('https://api.kit.com/v4/subscribers/')
    expect(source).to.not.include('/v3/unsubscribe')
    expect(source).to.not.include('api.convertkit.com/v3/unsubscribe')
    expect(source).to.not.match(/\/unsubscribe['"`]/)
    expect(source).to.not.include('PUT /unsubscribe')
    expect(source).to.not.include("'/unsubscribe'")
    expect(source).to.not.include('"/unsubscribe"')
  })
})
