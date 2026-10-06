import assert from 'node:assert/strict'
import type { GiftInviteStore, GiftTxRecord } from '../lib/marketplace/giftInviteIssuance'
import {
  issueMarketplaceGiftInvite,
  readyMarketplaceGiftToken,
} from '../lib/marketplace/giftInviteIssuance'

/**
 * In-memory stand-in for the Redis gift-tx record and the invite key.
 * insertIfAbsent is atomic the way SET NX is: the first caller wins.
 */
function memoryStore() {
  let record: GiftTxRecord | null = null
  const live = new Set<string>()
  let creates = 0
  let failMark = false
  const store: GiftInviteStore = {
    insertIfAbsent: async (next) => {
      if (record) return false
      record = { ...next, payer: next.payer.toLowerCase(), issued: false }
      return true
    },
    read: async () => (record ? { ...record } : null),
    inviteState: async (token) => (live.has(token) ? 'live' : 'missing'),
    createInvite: async (token) => {
      creates += 1
      live.add(token)
      return true
    },
    markIssued: async () => {
      if (failMark || !record) return false
      record = { ...record, issued: true }
      return true
    },
  }
  return {
    store,
    live,
    creates: () => creates,
    record: () => record,
    setFailMark: (value: boolean) => {
      failMark = value
    },
    dropInvite: (token: string) => {
      live.delete(token)
    },
  }
}

describe('marketplace gift invite issuance', () => {
  it('two retries of one payment create a single invite', async () => {
    const mem = memoryStore()
    const first = await issueMarketplaceGiftInvite(mem.store, {
      payer: '0xAbC',
      newToken: 'token-a',
    })
    const second = await issueMarketplaceGiftInvite(mem.store, {
      payer: '0xabc',
      newToken: 'token-b',
    })
    assert.equal(first.ok, true)
    assert.equal(second.ok, true)
    if (!first.ok || !second.ok) return
    assert.equal(first.token, 'token-a')
    assert.equal(second.token, 'token-a')
    assert.equal(first.alreadyIssued, false)
    assert.equal(second.alreadyIssued, true)
    assert.equal(mem.creates(), 1)
    assert.deepEqual([...mem.live], ['token-a'])
    assert.equal(mem.record()?.issued, true)
  })

  it('parallel callers share the token the first reservation stored', async () => {
    const mem = memoryStore()
    const [left, right] = await Promise.all([
      issueMarketplaceGiftInvite(mem.store, { payer: '0xabc', newToken: 'token-a' }),
      issueMarketplaceGiftInvite(mem.store, { payer: '0xabc', newToken: 'token-b' }),
    ])
    assert.equal(left.ok && right.ok, true)
    if (!left.ok || !right.ok) return
    assert.equal(left.token, right.token)
    assert.equal(mem.live.size, 1)
    assert.ok(left.token === 'token-a' || left.token === 'token-b')
  })

  it('a spent invite is not written back on retry', async () => {
    const mem = memoryStore()
    const first = await issueMarketplaceGiftInvite(mem.store, {
      payer: '0xabc',
      newToken: 'token-a',
    })
    assert.equal(first.ok, true)
    if (!first.ok) return
    mem.dropInvite(first.token)
    const retry = await issueMarketplaceGiftInvite(mem.store, {
      payer: '0xabc',
      newToken: 'token-b',
    })
    assert.equal(retry.ok, true)
    if (!retry.ok) return
    assert.equal(retry.token, 'token-a')
    assert.equal(retry.alreadyIssued, true)
    assert.equal(mem.creates(), 1)
    assert.equal(mem.live.has('token-a'), false)
    assert.equal(mem.live.has('token-b'), false)
  })

  it('a failed mark is retried without a second token', async () => {
    const mem = memoryStore()
    mem.setFailMark(true)
    const failed = await issueMarketplaceGiftInvite(mem.store, {
      payer: '0xabc',
      newToken: 'token-a',
    })
    assert.deepEqual(failed, { ok: false, reason: 'unavailable' })
    assert.equal(mem.creates(), 1)
    assert.equal(mem.record()?.issued, false)
    mem.setFailMark(false)
    const retry = await issueMarketplaceGiftInvite(mem.store, {
      payer: '0xabc',
      newToken: 'token-b',
    })
    assert.equal(retry.ok, true)
    if (!retry.ok) return
    assert.equal(retry.token, 'token-a')
    assert.equal(mem.creates(), 1)
    assert.equal(mem.record()?.issued, true)
  })

  it('a different payer cannot take the reserved token', async () => {
    const mem = memoryStore()
    const first = await issueMarketplaceGiftInvite(mem.store, {
      payer: '0xabc',
      newToken: 'token-a',
    })
    const other = await issueMarketplaceGiftInvite(mem.store, {
      payer: '0xdef',
      newToken: 'token-b',
    })
    assert.equal(first.ok, true)
    assert.deepEqual(other, { ok: false, reason: 'mismatch' })
    assert.equal(mem.creates(), 1)
    assert.equal(mem.live.has('token-b'), false)
  })

  it('store outage does not create an invite', async () => {
    const mem = memoryStore()
    mem.store.insertIfAbsent = async () => null
    const outage = await issueMarketplaceGiftInvite(mem.store, {
      payer: '0xabc',
      newToken: 'token-a',
    })
    assert.deepEqual(outage, { ok: false, reason: 'unavailable' })
    assert.equal(mem.creates(), 0)
    assert.equal(mem.record(), null)
  })

  it('readyGiftToken returns the issued token and nothing before that', async () => {
    const mem = memoryStore()
    assert.deepEqual(await readyMarketplaceGiftToken(mem.store, '0xabc'), { status: 'absent' })
    const issued = await issueMarketplaceGiftInvite(mem.store, {
      payer: '0xAbC',
      newToken: 'token-a',
    })
    assert.equal(issued.ok, true)
    assert.deepEqual(await readyMarketplaceGiftToken(mem.store, '0xabc'), {
      status: 'ready',
      token: 'token-a',
    })
    assert.deepEqual(await readyMarketplaceGiftToken(mem.store, '0xdef'), { status: 'mismatch' })
    mem.store.read = async () => {
      throw new Error('redis down')
    }
    assert.deepEqual(await readyMarketplaceGiftToken(mem.store, '0xabc'), {
      status: 'unavailable',
    })
  })
})
