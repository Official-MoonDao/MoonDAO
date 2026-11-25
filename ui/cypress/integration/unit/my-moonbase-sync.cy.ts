/**
 * My Moonbase, saved and shared: which copy of a base stands when the browser
 * and the account differ, what a save accepts, and what a share link carries.
 */
import type { Redis } from '@upstash/redis'
import { expect } from 'chai'
import { SEED_ATLAS } from '../../../lib/lunar-atlas/seed'
import { readBaseById, readBaseByOwner, writeBase } from '../../../lib/my-moonbase/baseStore'
import { DECOR } from '../../../lib/my-moonbase/decor'
import {
  DEFAULT_BASE_NAME,
  GRID_CELLS,
  MAX_ITEMS,
  cellKey,
  emptyLayout,
  type MoonbaseLayout,
  type PlacedItem,
} from '../../../lib/my-moonbase/grid'
import { basePlanSvg } from '../../../lib/my-moonbase/ogCard'
import {
  BASE_ID_ALPHABET,
  BASE_ID_LENGTH,
  baseCounts,
  baseIdFromBytes,
  baseSharePath,
  baseShareText,
  baseShareUrl,
  isBaseId,
  publicBaseName,
  racesLine,
} from '../../../lib/my-moonbase/share'
import {
  MAX_ITEM_ID_LENGTH,
  placeableAssetIds,
  sanitizeIncomingLayout,
} from '../../../lib/my-moonbase/storedLayout'
import {
  isBarePlot,
  parseSyncMeta,
  reconcile,
  sameLayout,
  type SavedBase,
  type SyncMeta,
} from '../../../lib/my-moonbase/sync'

const WALLET = '0x00000000000000000000000000000000000000aa'
const OTHER_WALLET = '0x00000000000000000000000000000000000000bb'
const ASSET_IDS = placeableAssetIds(SEED_ATLAS)
const [ASSET_A, ASSET_B] = Array.from(ASSET_IDS)
const SCENERY = DECOR[0]

function asset(ref: string, x: number, z: number, span = 2, id = `item-${ref}`): PlacedItem {
  return { id, kind: 'asset', ref, x, z, span, rot: 0 }
}

function layoutWith(items: PlacedItem[], roads: string[] = [], name = DEFAULT_BASE_NAME) {
  return { ...emptyLayout(), name, items, roads } as MoonbaseLayout
}

function saved(layout: MoonbaseLayout, updatedAt = 1000): SavedBase {
  return { id: 'abcdefghjk', layout, updatedAt }
}

function meta(patch: Partial<SyncMeta> = {}): SyncMeta {
  return { owner: WALLET, savedAt: 1000, dirty: false, shareId: 'abcdefghjk', ...patch }
}

/** Just enough of @upstash/redis for the base store. */
function fakeRedis() {
  const store = new Map<string, string>()
  const api = {
    store,
    async get(key: string) {
      return store.get(key) ?? null
    },
    async set(key: string, value: string, options?: { nx?: boolean }) {
      if (options?.nx && store.has(key)) return null
      store.set(key, value)
      return 'OK'
    },
    async del(key: string) {
      return store.delete(key) ? 1 : 0
    },
  }
  return api as unknown as typeof api & Redis
}

describe('my moonbase sync', () => {
  const built = layoutWith([asset(ASSET_A, 4, 4)], [cellKey(1, 1)])
  const rebuilt = layoutWith([asset(ASSET_A, 10, 10)], [cellKey(1, 1)])

  it('leaves an untouched plot alone and saves a built one when the account has none', () => {
    const base = { address: WALLET, meta: null, remote: null }
    expect(reconcile({ ...base, local: emptyLayout() })).to.equal('keep')
    expect(reconcile({ ...base, local: built })).to.equal('push')
    // A name alone is work worth keeping.
    expect(reconcile({ ...base, local: layoutWith([], [], 'Shackleton Yard') })).to.equal('push')
  })

  it('does nothing when the two copies already match', () => {
    const copy = JSON.parse(JSON.stringify(built)) as MoonbaseLayout
    expect(reconcile({ address: WALLET, local: built, meta: null, remote: saved(copy) })).to.equal(
      'keep'
    )
  })

  it('takes the account copy on a browser that holds nothing of its own', () => {
    expect(
      reconcile({ address: WALLET, local: emptyLayout(), meta: null, remote: saved(built) })
    ).to.equal('adopt')
  })

  it('takes a newer account copy when this browser has no unsaved edits', () => {
    expect(
      reconcile({ address: WALLET, local: built, meta: meta(), remote: saved(rebuilt, 2000) })
    ).to.equal('adopt')
  })

  it('saves unsaved edits made on top of the copy the account still holds', () => {
    expect(
      reconcile({
        address: WALLET,
        local: rebuilt,
        meta: meta({ dirty: true }),
        remote: saved(built, 1000),
      })
    ).to.equal('push')
  })

  it('asks when both copies moved on', () => {
    expect(
      reconcile({
        address: WALLET,
        local: rebuilt,
        meta: meta({ dirty: true }),
        remote: saved(built, 2000),
      })
    ).to.equal('conflict')
  })

  it('asks before a base built signed out replaces the one an account already has', () => {
    expect(
      reconcile({ address: WALLET, local: rebuilt, meta: null, remote: saved(built) })
    ).to.equal('conflict')
    // The same when the browser last saved under a different wallet.
    expect(
      reconcile({
        address: WALLET,
        local: rebuilt,
        meta: meta({ owner: OTHER_WALLET }),
        remote: saved(built),
      })
    ).to.equal('conflict')
  })

  it('matches the wallet whatever its letter case', () => {
    expect(
      reconcile({
        address: WALLET.toUpperCase().replace('0X', '0x'),
        local: built,
        meta: meta(),
        remote: saved(rebuilt, 2000),
      })
    ).to.equal('adopt')
  })

  it('compares layouts by what stands on them', () => {
    expect(sameLayout(built, JSON.parse(JSON.stringify(built)))).to.equal(true)
    expect(sameLayout(built, rebuilt)).to.equal(false)
    expect(sameLayout(built, { ...built, name: 'Renamed' })).to.equal(false)
    expect(sameLayout(built, { ...built, roads: [] })).to.equal(false)
    expect(isBarePlot(emptyLayout())).to.equal(true)
    expect(isBarePlot(built)).to.equal(false)
  })

  it('reads back only a complete record of the last save', () => {
    const good = meta({ dirty: true })
    expect(parseSyncMeta(JSON.parse(JSON.stringify(good)))).to.deep.equal(good)
    expect(parseSyncMeta(null)).to.equal(null)
    expect(parseSyncMeta('not a record')).to.equal(null)
    expect(parseSyncMeta({ ...good, savedAt: 'yesterday' })).to.equal(null)
    expect(parseSyncMeta({ ...good, owner: 12 })).to.equal(null)
    expect(parseSyncMeta({ ...good, owner: WALLET.toUpperCase() })).to.equal(null)
    // Anything but a plain "not edited" counts as edited, so nothing is dropped unsaved.
    expect(parseSyncMeta({ owner: WALLET, savedAt: 1000 })).to.deep.equal({
      owner: WALLET,
      savedAt: 1000,
      dirty: true,
      shareId: '',
    })
  })
})

describe('my moonbase saved layouts', () => {
  it('keeps a layout the builder would produce', () => {
    const sent = layoutWith(
      [
        asset(ASSET_A, 4, 4, 3),
        { id: 'tree', kind: 'decor', ref: SCENERY.id, x: 20, z: 20, span: SCENERY.span, rot: 1 },
      ],
      [cellKey(0, 0), cellKey(1, 0)],
      'Shackleton Yard'
    )
    const kept = sanitizeIncomingLayout(JSON.parse(JSON.stringify(sent)), ASSET_IDS)
    expect(kept).to.not.equal(null)
    expect(sameLayout(kept as MoonbaseLayout, sent)).to.equal(true)
  })

  it('refuses what is not a layout, rather than saving an empty plot over a base', () => {
    expect(sanitizeIncomingLayout(null, ASSET_IDS)).to.equal(null)
    expect(sanitizeIncomingLayout('layout', ASSET_IDS)).to.equal(null)
    expect(sanitizeIncomingLayout({ v: 1, items: [] }, ASSET_IDS)).to.equal(null)
    expect(sanitizeIncomingLayout({ v: 99, items: [], roads: [] }, ASSET_IDS)).to.equal(null)
    const tooMany = Array.from({ length: MAX_ITEMS + 1 }, (_, i) =>
      asset(ASSET_A, 0, 0, 1, `i${i}`)
    )
    expect(sanitizeIncomingLayout({ v: 1, items: tooMany, roads: [] }, ASSET_IDS)).to.equal(null)
  })

  it('drops hardware it does not know, oversized footprints and overlong ids', () => {
    const kept = sanitizeIncomingLayout(
      {
        v: 1,
        name: 'Yard',
        items: [
          asset('not-in-the-atlas', 0, 0),
          asset(ASSET_A, 4, 4, GRID_CELLS + 1),
          asset(ASSET_B, 10, 10, 2, 'x'.repeat(MAX_ITEM_ID_LENGTH + 1)),
          { id: 'rock', kind: 'decor', ref: 'no-such-scenery', x: 1, z: 1, span: 1, rot: 0 },
        ],
        roads: [cellKey(0, 0), 'nonsense', cellKey(GRID_CELLS, 0)],
      },
      ASSET_IDS
    )
    expect(kept?.items).to.deep.equal([])
    expect(kept?.roads).to.deep.equal([cellKey(0, 0)])
  })

  it('keeps one of each asset and nothing overlapping or off the plot', () => {
    const kept = sanitizeIncomingLayout(
      {
        v: 1,
        name: 'Yard',
        items: [
          asset(ASSET_A, 4, 4, 2, 'first'),
          asset(ASSET_A, 20, 20, 2, 'again'),
          asset(ASSET_B, 5, 5, 2, 'on-top'),
        ],
        roads: [],
      },
      ASSET_IDS
    )
    expect(kept?.items.map((item) => item.id)).to.deep.equal(['first'])
    const offPlot = sanitizeIncomingLayout(
      { v: 1, name: 'Yard', items: [asset(ASSET_A, GRID_CELLS - 1, 0, 2)], roads: [] },
      ASSET_IDS
    )
    expect(offPlot?.items).to.deep.equal([])
  })

  it('takes scenery footprints from the catalogue, not from the request', () => {
    const kept = sanitizeIncomingLayout(
      {
        v: 1,
        name: 'Yard',
        items: [{ id: 'rock', kind: 'decor', ref: SCENERY.id, x: 3, z: 3, span: 30, rot: 0 }],
        roads: [],
      },
      ASSET_IDS
    )
    expect(kept?.items[0].span).to.equal(SCENERY.span)
  })
})

describe('my moonbase base store', () => {
  const first = layoutWith([asset(ASSET_A, 4, 4)])
  const second = layoutWith([asset(ASSET_A, 9, 9)])

  it('gives a base one share id for life and finds it by that id', async () => {
    const redis = fakeRedis()
    const created = await writeBase(redis, WALLET, first, null, { now: 1000 })
    expect(created.ok).to.equal(true)
    expect(isBaseId(created.base.id)).to.equal(true)

    const updated = await writeBase(redis, WALLET, second, created.base.updatedAt, { now: 2000 })
    expect(updated.ok).to.equal(true)
    expect(updated.base.id).to.equal(created.base.id)

    const found = await readBaseById(redis, created.base.id)
    expect(found?.owner).to.equal(WALLET)
    expect(sameLayout(found?.base.layout as MoonbaseLayout, second)).to.equal(true)
    expect((await readBaseByOwner(redis, WALLET.toUpperCase().replace('0X', '0x')))?.id).to.equal(
      created.base.id
    )
  })

  it('refuses a save made on top of a copy that has since changed', async () => {
    const redis = fakeRedis()
    const created = await writeBase(redis, WALLET, first, null, { now: 1000 })
    await writeBase(redis, WALLET, second, created.base.updatedAt, { now: 2000 })

    const stale = await writeBase(redis, WALLET, first, created.base.updatedAt, { now: 3000 })
    expect(stale.ok).to.equal(false)
    expect(stale.base.updatedAt).to.equal(2000)
    expect(
      sameLayout((await readBaseByOwner(redis, WALLET))?.layout as MoonbaseLayout, second)
    ).to.equal(true)

    const forced = await writeBase(redis, WALLET, first, null, { force: true, now: 3000 })
    expect(forced.ok).to.equal(true)
    expect(forced.base.id).to.equal(created.base.id)
  })

  it('never hands out a version older than the one it replaces', async () => {
    const redis = fakeRedis()
    const created = await writeBase(redis, WALLET, first, null, { now: 5000 })
    const updated = await writeBase(redis, WALLET, second, 5000, { now: 100 })
    expect(updated.base.updatedAt).to.be.greaterThan(created.base.updatedAt)
  })

  it('keeps one of two saves that were both made against the same copy', async () => {
    const redis = fakeRedis()
    const created = await writeBase(redis, WALLET, first, null, { now: 1000 })
    expect(created.ok).to.equal(true)

    const [left, right] = await Promise.all([
      writeBase(redis, WALLET, first, created.base.updatedAt, { now: 2000 }),
      writeBase(redis, WALLET, second, created.base.updatedAt, { now: 2000 }),
    ])
    const winner = left.ok ? left : right
    const loser = left.ok ? right : left
    expect(winner.ok).to.equal(true)
    expect(loser.ok).to.equal(false)
    const stored = await readBaseByOwner(redis, WALLET)
    expect(stored?.updatedAt).to.equal(winner.base.updatedAt)
    expect(sameLayout(stored?.layout as MoonbaseLayout, winner.base.layout)).to.equal(true)
    expect(loser.base.updatedAt).to.equal(stored?.updatedAt)
    expect(sameLayout(loser.base.layout, winner.base.layout)).to.equal(true)
  })

  it('keeps one of two first saves instead of dropping a base both browsers think was stored', async () => {
    const redis = fakeRedis()
    const [left, right] = await Promise.all([
      writeBase(redis, WALLET, first, null, { now: 1000 }),
      writeBase(redis, WALLET, second, null, { now: 1000 }),
    ])
    const winner = left.ok ? left : right
    const loser = left.ok ? right : left
    expect(winner.ok).to.equal(true)
    expect(loser.ok).to.equal(false)
    const stored = await readBaseByOwner(redis, WALLET)
    expect(stored?.id).to.equal(winner.base.id)
    expect(sameLayout(stored?.layout as MoonbaseLayout, winner.base.layout)).to.equal(true)
    expect(sameLayout(loser.base.layout, winner.base.layout)).to.equal(true)
    const found = await readBaseById(redis, winner.base.id)
    expect(found?.owner).to.equal(WALLET)
  })

  it('keeps each wallet to its own base', async () => {
    const redis = fakeRedis()
    const mine = await writeBase(redis, WALLET, first, null)
    const theirs = await writeBase(redis, OTHER_WALLET, second, null)
    expect(mine.base.id).to.not.equal(theirs.base.id)
    expect((await readBaseById(redis, theirs.base.id))?.owner).to.equal(OTHER_WALLET)
  })

  it('finds nothing behind an id that was never given out', async () => {
    const redis = fakeRedis()
    expect(await readBaseById(redis, 'abcdefghjk')).to.equal(null)
    expect(await readBaseById(redis, '../etc/passwd')).to.equal(null)
  })
})

describe('my moonbase share links', () => {
  it('makes ids from the unambiguous alphabet only', () => {
    const id = baseIdFromBytes(Uint8Array.from({ length: 16 }, (_, i) => i * 17))
    expect(id).to.have.length(BASE_ID_LENGTH)
    expect(isBaseId(id)).to.equal(true)
    for (const char of id) expect(BASE_ID_ALPHABET).to.include(char)
    expect(isBaseId('0OIl1abcde')).to.equal(false)
    expect(isBaseId('abc')).to.equal(false)
    expect(isBaseId(42)).to.equal(false)
    expect(isBaseId(['abcdefghjk'])).to.equal(false)
  })

  it('builds a link that says how it was shared and carries no wallet', () => {
    const url = baseShareUrl('https://moondao.com/', 'abcdefghjk', 'x')
    expect(url).to.equal(
      'https://moondao.com/moonbase/base/abcdefghjk?utm_source=x&utm_medium=social&utm_campaign=moonbase_share'
    )
    expect(baseSharePath('abcdefghjk')).to.equal('/moonbase/base/abcdefghjk')
    expect(url).to.not.include('0x')
  })

  it('shows visitors a clean name, or the default in place of one it will not show', () => {
    expect(publicBaseName('  Shackleton   Yard ')).to.equal('Shackleton Yard')
    expect(publicBaseName('')).to.equal(DEFAULT_BASE_NAME)
    expect(publicBaseName(undefined)).to.equal(DEFAULT_BASE_NAME)
    expect(publicBaseName('Yard\u202e\u0007')).to.equal('Yard')
    expect(publicBaseName('Tranquility', 'tranquility')).to.equal(DEFAULT_BASE_NAME)
    expect(publicBaseName('月面基地')).to.equal('月面基地')
  })

  it('writes a post that counts the races predicted', () => {
    expect(racesLine(3, 11)).to.equal('3 of 11 races predicted')
    expect(racesLine(0, 11)).to.equal('')
    expect(racesLine(20, 11)).to.equal('11 of 11 races predicted')
    expect(baseShareText('Shackleton Yard', 3, 11)).to.include('Shackleton Yard')
    expect(baseShareText('Shackleton Yard', 3, 11)).to.include('3 of 11 races predicted.')
    expect(baseShareText(DEFAULT_BASE_NAME, 0, 11)).to.not.include('races predicted')
  })

  it('counts what stands on a base and draws each piece on the preview plan', () => {
    const layout = layoutWith(
      [
        asset(ASSET_A, 4, 4),
        { id: 'rock', kind: 'decor', ref: SCENERY.id, x: 20, z: 20, span: SCENERY.span, rot: 0 },
      ],
      [cellKey(0, 0), cellKey(1, 0), 'nonsense']
    )
    expect(baseCounts(layout)).to.deep.equal({ assets: 1, scenery: 1, roads: 3 })
    const plan = basePlanSvg(layout, () => '#ff0000')
    expect(plan).to.include('fill="#ff0000"')
    // The ground and its clip, two road tiles, and a lot each for the asset and the scenery.
    expect(plan.match(/<rect /g)).to.have.length(1 + 1 + 2 + 2)
    // A colour that is not a colour never reaches the markup.
    expect(basePlanSvg(layout, () => '"/><script>')).to.not.include('script')
  })
})
