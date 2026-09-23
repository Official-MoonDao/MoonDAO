/// <reference types="node" />
import { citizenFromCaller } from '@/lib/forecasts/callerIdentity'
import type { ForecastCaller } from '@/lib/forecasts/consensusTypes'
import {
  ROSTER_FRESH_WINDOW_MS,
  mergeCallerRoster,
  notifyRoster,
  pruneRosterOverlays,
  readRosterNeedsFresh,
  rosterWithinFreshWindow,
  subscribeRoster,
  type RosterStore,
} from '@/lib/forecasts/rosterRefresh'

const ADDR = '0x69864c02847ca377458fa6e20ffe378cc2e5140b'
const LABELS = ['Griffin Mission One', 'Other']

function memoryStore(): RosterStore & { values: Map<string, string> } {
  const values = new Map<string, string>()
  return {
    values,
    getItem(key: string) {
      return values.has(key) ? (values.get(key) as string) : null
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
  }
}

function caller(address: string, allocation: number[], name = 'Citizen'): ForecastCaller {
  return {
    voterAddress: address,
    citizenId: name === address ? '' : 36,
    citizenName: name,
    allocation,
    weight: 0,
    storedVmooney: 0,
    liveVmooney: 0,
    updatedAt: 1,
    brier: null,
    skill: null,
  }
}

describe('roster fresh window', () => {
  it('is fresh only inside the post-write window', () => {
    const savedAt = 1_000
    expect(rosterWithinFreshWindow(null, savedAt)).to.equal(false)
    expect(rosterWithinFreshWindow(Number.NaN, savedAt)).to.equal(false)
    expect(rosterWithinFreshWindow(savedAt, savedAt)).to.equal(true)
    expect(rosterWithinFreshWindow(savedAt, savedAt + ROSTER_FRESH_WINDOW_MS - 1)).to.equal(true)
    expect(rosterWithinFreshWindow(savedAt, savedAt + ROSTER_FRESH_WINDOW_MS)).to.equal(false)
    expect(rosterWithinFreshWindow(savedAt + 10, savedAt)).to.equal(false)
  })

  it('reads a session timestamp back as needs-fresh for a few minutes', () => {
    const store = memoryStore()
    const now = 5_000
    notifyRoster(
      {
        chain: 'sepolia',
        deprizeId: 2,
        address: ADDR.toUpperCase(),
        pick: 'Griffin Mission One',
        removed: false,
      },
      now,
      store
    )
    expect(readRosterNeedsFresh('sepolia', 2, now + 1_000, store)).to.equal(true)
    expect(readRosterNeedsFresh('sepolia', 2, now + ROSTER_FRESH_WINDOW_MS, store)).to.equal(false)
    expect(readRosterNeedsFresh('arbitrum', 2, now + 1_000, store)).to.equal(false)
  })

  it('notifies subscribers with a lowercased address and can unsubscribe', () => {
    const seen: string[] = []
    const unsubscribe = subscribeRoster((notice) => {
      seen.push(`${notice.address}:${notice.removed ? 'removed' : notice.pick}`)
    })
    notifyRoster(
      {
        chain: 'sepolia',
        deprizeId: 2,
        address: '0xAbC',
        pick: 'Griffin Mission One',
        removed: false,
      },
      10,
      memoryStore()
    )
    unsubscribe()
    notifyRoster(
      {
        chain: 'sepolia',
        deprizeId: 2,
        address: '0xAbC',
        removed: true,
      },
      11,
      memoryStore()
    )
    expect(seen).to.deep.equal(['0xabc:Griffin Mission One'])
  })
})

describe('roster optimistic rows', () => {
  it('keeps a save the fresh response has not indexed yet', () => {
    const overlays = [{ address: ADDR, pick: 'Griffin Mission One', removed: false }]
    const merged = mergeCallerRoster([], overlays, LABELS)
    expect(merged.map((row) => row.voterAddress)).to.deep.equal([ADDR])
    expect(merged[0].allocation[0]).to.equal(100)
    expect(pruneRosterOverlays(overlays, [], LABELS)).to.have.length(1)
  })

  it('drops the overlay once the server pick matches and hides a clear still on the server', () => {
    const indexed = [caller(ADDR, [100, 0])]
    const saved = [{ address: ADDR, pick: 'Griffin Mission One', removed: false }]
    expect(pruneRosterOverlays(saved, indexed, LABELS)).to.have.length(0)

    const cleared = [{ address: ADDR, removed: true }]
    expect(mergeCallerRoster(indexed, cleared, LABELS)).to.have.length(0)
    expect(pruneRosterOverlays(cleared, indexed, LABELS)).to.have.length(1)
    expect(pruneRosterOverlays(cleared, [], LABELS)).to.have.length(0)
  })
})

describe('consensus citizen name', () => {
  it('uses the leaderboard citizen when the name is not the address', () => {
    const named = citizenFromCaller(caller(ADDR, [100, 0], 'Citizen'))
    expect(named.citizen?.name).to.equal('Citizen')
    expect(named.citizen?.id).to.equal(36)
    expect(named.fallbackName).to.equal(undefined)

    const addressNamed = citizenFromCaller(caller(ADDR, [100, 0], ADDR))
    expect(addressNamed.citizen).to.equal(undefined)
    expect(addressNamed.fallbackName).to.equal(undefined)

    const nameOnly = citizenFromCaller({
      ...caller(ADDR, [100, 0], 'Citizen'),
      citizenId: '',
    })
    expect(nameOnly.citizen).to.equal(undefined)
    expect(nameOnly.fallbackName).to.equal('Citizen')
  })
})
