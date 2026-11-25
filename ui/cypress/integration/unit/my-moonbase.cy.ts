/**
 * My Moonbase: which hardware a visitor's predictions unlock, and the rules of
 * the plot they build on.
 */

import { expect } from 'chai'
import { encodeForecastVote } from '../../../lib/deprize/forecastVote'
import { ATLAS_FORECAST_VOTE_IDS } from '../../../lib/forecasts/atlasBook'
import { SEED_ATLAS } from '../../../lib/lunar-atlas/seed'
import { DECOR, decorById } from '../../../lib/my-moonbase/decor'
import {
  GRID_CELLS,
  MAX_ITEMS,
  ROAD_E,
  ROAD_S,
  ROAD_W,
  addRoads,
  canPlace,
  cellAtM,
  cellKey,
  emptyLayout,
  footprintAnchor,
  footprintCenterM,
  moveItem,
  placeItem,
  removeItem,
  removeRoad,
  roadLinks,
  roadPath,
  sanitizeLayout,
  setItemRot,
  spanForRadius,
  type PlacedItem,
} from '../../../lib/my-moonbase/grid'
import {
  mergePicks,
  overlayForecastRows,
  picksFromBets,
  picksFromForecastRows,
  raceBooks,
} from '../../../lib/my-moonbase/picks'

const asset = (ref: string, x: number, z: number, span = 1): PlacedItem => ({
  id: `asset:${ref}`,
  kind: 'asset',
  ref,
  x,
  z,
  span,
  rot: 0,
})

const decor = (id: string, x: number, z: number, span = 1): PlacedItem => ({
  id,
  kind: 'decor',
  ref: 'street-light',
  x,
  z,
  span,
  rot: 0,
})

const vote = (allocation: Record<number, number>, n: number) =>
  JSON.parse(
    encodeForecastVote(
      Array.from({ length: n }, (_, i) => allocation[i] ?? 0),
      0
    )
  )

describe('my moonbase picks', () => {
  const goals = SEED_ATLAS.sharedGoals

  it('gives every race with a field a book, and none to a one-entrant race', () => {
    const books = raceBooks('arbitrum', goals)
    const byGoal = new Map(books.map((book) => [book.goalId, book]))
    for (const goal of goals) {
      expect(byGoal.has(goal.id), goal.id).to.equal(goal.projectIds.length >= 2)
    }
  })

  it('saves a DePrize race under its prize id and the rest under their atlas ids', () => {
    const books = raceBooks('arbitrum', goals)
    const touchdown = books.find((book) => book.goalId === 'shared-next-landing')
    expect(touchdown?.voteId).to.equal(1)
    expect(touchdown?.deprizeId).to.equal(1)
    // Arbitrum First Tracks is a prize, but keeps the atlas id its free
    // predictions were saved under.
    const rovers = books.find((book) => book.goalId === 'shared-first-tracks')
    expect(rovers?.voteId).to.equal(ATLAS_FORECAST_VOTE_IDS['shared-first-tracks'])
    expect(rovers?.deprizeId).to.equal(2)
    const ice = books.find((book) => book.goalId === 'shared-ice')
    expect(ice?.voteId).to.equal(ATLAS_FORECAST_VOTE_IDS['shared-ice'])
    expect(ice?.deprizeId).to.equal(undefined)
  })

  it('never shares a vote id between two races', () => {
    for (const chain of ['arbitrum', 'sepolia', 'ethereum']) {
      const ids = raceBooks(chain, goals).map((book) => book.voteId)
      expect(new Set(ids).size, chain).to.equal(ids.length)
    }
  })

  it('only names competitors that are in the race', () => {
    for (const book of raceBooks('arbitrum', goals)) {
      const goal = goals.find((g) => g.id === book.goalId)!
      for (const projectId of book.outcomeIds) {
        if (projectId !== undefined) {
          expect(goal.projectIds, `${book.goalId}:${projectId}`).to.include(projectId)
        }
      }
    }
  })

  it('maps a saved slot back to the competitor that holds it', () => {
    const books = raceBooks('arbitrum', goals)
    // Slot 4 of Arbitrum Touchdown is Chang'e-7; slot 2 of First Tracks is MAPP.
    const picks = picksFromForecastRows(
      [
        { voteId: 1, vote: vote({ 4: 100 }, 7) },
        { voteId: ATLAS_FORECAST_VOTE_IDS['shared-first-tracks'], vote: vote({ 2: 100 }, 5) },
      ],
      books
    )
    expect(picks).to.deep.equal([
      { goalId: 'shared-next-landing', projectId: 'cnsa-change-7', source: 'forecast' },
      { goalId: 'shared-first-tracks', projectId: 'lunar-outpost-mapp', source: 'forecast' },
    ])
  })

  it('accepts the vote as the JSON string the gateway can also return', () => {
    const books = raceBooks('arbitrum', goals)
    const picks = picksFromForecastRows(
      [{ voteId: 1, vote: encodeForecastVote([100, 0, 0, 0, 0, 0, 0], 0) }],
      books
    )
    expect(picks.map((pick) => pick.projectId)).to.deep.equal(['astrobotic-griffin'])
  })

  it('unlocks every competitor a split prediction puts weight on', () => {
    const books = raceBooks('arbitrum', goals)
    const picks = picksFromForecastRows([{ voteId: 1, vote: vote({ 0: 60, 2: 40 }, 7) }], books)
    expect(picks.map((pick) => pick.projectId)).to.deep.equal([
      'astrobotic-griffin',
      'firefly-blue-ghost',
    ])
  })

  it('ignores rows for other votes and payloads it cannot read', () => {
    const books = raceBooks('arbitrum', goals)
    const picks = picksFromForecastRows(
      [
        { voteId: 2, vote: vote({ 0: 100 }, 7) },
        { voteId: 1, vote: { v: 1, a: { 40: 100 }, vp: 0 } },
        { voteId: 1, vote: 'not json' },
        { voteId: 1, vote: null },
      ],
      books
    )
    expect(picks).to.deep.equal([])
  })

  it('counts a held bet as a pick, and an empty balance as nothing', () => {
    const touchdown = raceBooks('arbitrum', goals).find(
      (book) => book.goalId === 'shared-next-landing'
    )
    const picks = picksFromBets(touchdown, [
      { index: 0, balance: 0 },
      { index: 6, balance: 0.25 },
    ])
    expect(picks).to.deep.equal([
      { goalId: 'shared-next-landing', projectId: 'spacex-starship-hls', source: 'bet' },
    ])
    expect(picksFromBets(undefined, [{ index: 0, balance: 1 }])).to.deep.equal([])
  })

  it('merges one asset backed in two races, or two ways, into one entry', () => {
    const merged = mergePicks([
      { goalId: 'shared-next-landing', projectId: 'cnsa-change-7', source: 'forecast' },
      { goalId: 'shared-ice', projectId: 'cnsa-change-7', source: 'forecast' },
      { goalId: 'shared-next-landing', projectId: 'cnsa-change-7', source: 'bet' },
      { goalId: 'shared-first-tracks', projectId: 'cmu-iris', source: 'forecast' },
    ])
    expect(merged).to.deep.equal([
      {
        projectId: 'cnsa-change-7',
        goalIds: ['shared-next-landing', 'shared-ice'],
        sources: ['forecast', 'bet'],
      },
      { projectId: 'cmu-iris', goalIds: ['shared-first-tracks'], sources: ['forecast'] },
    ])
  })

  it('lets a just-saved prediction stand in for the race row the gateway has not caught up on', () => {
    const books = raceBooks('arbitrum', goals)
    const tracks = ATLAS_FORECAST_VOTE_IDS['shared-first-tracks']
    const rows = [
      { voteId: 1, vote: vote({ 4: 100 }, 7) },
      { voteId: tracks, vote: vote({ 2: 100 }, 5) },
    ]
    // Changed Touchdown to slot 0, then removed First Tracks.
    const shown = overlayForecastRows(
      rows,
      [
        { voteId: 1, index: 6 },
        { voteId: 1, index: 0 },
        { voteId: tracks, index: null },
      ],
      books
    )
    expect(picksFromForecastRows(shown, books).map((pick) => pick.projectId)).to.deep.equal([
      'astrobotic-griffin',
    ])
    expect(overlayForecastRows(rows, [], books)).to.deep.equal(rows)
    // A slot the race does not have is dropped, not written as a pick.
    expect(
      picksFromForecastRows(overlayForecastRows([], [{ voteId: 1, index: 40 }], books), books)
    ).to.deep.equal([])
  })
})

describe('my moonbase plot', () => {
  it('sizes a footprint to the ground the hardware covers', () => {
    expect(spanForRadius(0.2)).to.equal(1)
    expect(spanForRadius(3)).to.equal(1)
    expect(spanForRadius(3.1)).to.equal(2)
    expect(spanForRadius(31)).to.equal(11)
    expect(spanForRadius(0)).to.equal(1)
    expect(spanForRadius(10_000)).to.equal(GRID_CELLS)
  })

  it('centres a footprint on the pointed cell and keeps it on the plot', () => {
    expect(footprintAnchor({ x: 10, z: 10 }, 1)).to.deep.equal({ x: 10, z: 10 })
    expect(footprintAnchor({ x: 10, z: 10 }, 3)).to.deep.equal({ x: 9, z: 9 })
    expect(footprintAnchor({ x: 0, z: 0 }, 5)).to.deep.equal({ x: 0, z: 0 })
    expect(footprintAnchor({ x: GRID_CELLS - 1, z: GRID_CELLS - 1 }, 5)).to.deep.equal({
      x: GRID_CELLS - 5,
      z: GRID_CELLS - 5,
    })
  })

  it('round-trips a cell through meters', () => {
    for (const cell of [
      { x: 0, z: 0 },
      { x: 17, z: 23 },
      { x: GRID_CELLS - 1, z: GRID_CELLS - 1 },
    ]) {
      const centre = footprintCenterM(cell.x, cell.z, 1)
      expect(cellAtM(centre.x, centre.z)).to.deep.equal(cell)
    }
    expect(cellAtM(10_000, 0)).to.equal(null)
  })

  it('refuses ground that is off the plot, taken, or paved', () => {
    let layout = placeItem(emptyLayout(), asset('im-nova-c', 5, 5, 3))
    layout = addRoads(layout, [{ x: 12, z: 5 }])
    expect(canPlace(layout, { x: 7, z: 7, span: 2 })).to.equal(false)
    expect(canPlace(layout, { x: 8, z: 8, span: 2 })).to.equal(true)
    expect(canPlace(layout, { x: 11, z: 4, span: 2 })).to.equal(false)
    expect(canPlace(layout, { x: GRID_CELLS - 1, z: 0, span: 2 })).to.equal(false)
    expect(canPlace(layout, { x: -1, z: 0, span: 1 })).to.equal(false)
  })

  it('places one of each asset and any number of the same scenery', () => {
    let layout = placeItem(emptyLayout(), asset('im-nova-c', 0, 0))
    const again = placeItem(layout, { ...asset('im-nova-c', 4, 4), id: 'second' })
    expect(again).to.equal(layout)
    layout = placeItem(layout, decor('a', 2, 0))
    layout = placeItem(layout, decor('b', 3, 0))
    expect(layout.items).to.have.length(3)
  })

  it('stops at the item cap', () => {
    let layout = emptyLayout()
    for (let i = 0; i < MAX_ITEMS + 5; i++) {
      layout = placeItem(layout, decor(`d${i}`, i % GRID_CELLS, Math.floor(i / GRID_CELLS)))
    }
    expect(layout.items).to.have.length(MAX_ITEMS)
  })

  it('moves an item across its own footprint but not onto another', () => {
    let layout = placeItem(emptyLayout(), asset('im-nova-c', 5, 5, 3))
    layout = placeItem(layout, decor('light', 10, 5))
    const nudged = moveItem(layout, 'asset:im-nova-c', { x: 6, z: 5 })
    expect(nudged.items[0]).to.include({ x: 6, z: 5 })
    const blocked = moveItem(layout, 'asset:im-nova-c', { x: 8, z: 5 })
    expect(blocked).to.equal(layout)
  })

  it('returns the same layout when an edit changes nothing', () => {
    const layout = addRoads(placeItem(emptyLayout(), decor('light', 1, 1)), [{ x: 3, z: 3 }])
    expect(removeItem(layout, 'missing')).to.equal(layout)
    expect(setItemRot(layout, 'light', 0)).to.equal(layout)
    expect(removeRoad(layout, { x: 9, z: 9 })).to.equal(layout)
    expect(addRoads(layout, [{ x: 3, z: 3 }])).to.equal(layout)
    expect(addRoads(layout, [{ x: 1, z: 1 }])).to.equal(layout)
  })

  it('draws a road as a straight run or one right-angle bend', () => {
    expect(roadPath({ x: 2, z: 2 }, { x: 2, z: 2 })).to.deep.equal([{ x: 2, z: 2 }])
    expect(roadPath({ x: 2, z: 2 }, { x: 4, z: 2 })).to.deep.equal([
      { x: 2, z: 2 },
      { x: 3, z: 2 },
      { x: 4, z: 2 },
    ])
    expect(roadPath({ x: 3, z: 3 }, { x: 1, z: 5 })).to.deep.equal([
      { x: 3, z: 3 },
      { x: 2, z: 3 },
      { x: 1, z: 3 },
      { x: 1, z: 4 },
      { x: 1, z: 5 },
    ])
  })

  it('paves around an item rather than under it', () => {
    const layout = placeItem(emptyLayout(), decor('light', 3, 2))
    const paved = addRoads(layout, roadPath({ x: 2, z: 2 }, { x: 4, z: 2 }))
    expect(paved.roads.sort()).to.deep.equal([cellKey(2, 2), cellKey(4, 2)])
  })

  it('joins a road tile to its neighbours', () => {
    const roads = new Set([cellKey(5, 5), cellKey(6, 5), cellKey(4, 5), cellKey(5, 6)])
    expect(roadLinks(roads, { x: 5, z: 5 })).to.equal(ROAD_E | ROAD_S | ROAD_W)
    expect(roadLinks(roads, { x: 6, z: 5 })).to.equal(ROAD_W)
    expect(roadLinks(new Set([cellKey(0, 0)]), { x: 0, z: 0 })).to.equal(0)
  })

  it('rebuilds a saved layout and drops what it cannot trust', () => {
    const spanFor = (kind: string, ref: string) =>
      kind === 'asset' ? (ref === 'im-nova-c' ? 2 : undefined) : decorById(ref)?.span
    const restored = sanitizeLayout(
      {
        v: 1,
        name: 'Shackleton Heights',
        items: [
          // Saved with a stale footprint: the catalogue's span wins.
          { id: 'a', kind: 'asset', ref: 'im-nova-c', x: 4, z: 4, span: 9, rot: 2 },
          // Overlaps the lander once it is its real size.
          { id: 'b', kind: 'decor', ref: 'street-light', x: 5, z: 5, span: 1, rot: 0 },
          { id: 'c', kind: 'decor', ref: 'street-light', x: 8, z: 8, span: 1, rot: 7 },
          { id: 'd', kind: 'asset', ref: 'retired-project', x: 20, z: 20, span: 1, rot: 0 },
          { id: 'e', kind: 'decor', ref: 'street-light', x: 999, z: 0, span: 1, rot: 0 },
          { id: 'c', kind: 'decor', ref: 'street-light', x: 12, z: 12, span: 1, rot: 0 },
          'junk',
        ],
        roads: [cellKey(0, 0), cellKey(4, 4), 'nope', cellKey(999, 1), cellKey(0, 0)],
      },
      spanFor
    )
    expect(restored.name).to.equal('Shackleton Heights')
    expect(restored.items).to.deep.equal([
      { id: 'a', kind: 'asset', ref: 'im-nova-c', x: 4, z: 4, span: 2, rot: 2 },
      { id: 'c', kind: 'decor', ref: 'street-light', x: 8, z: 8, span: 1, rot: 0 },
    ])
    expect(restored.roads).to.deep.equal([cellKey(0, 0)])
  })

  it('starts empty from anything that is not a layout', () => {
    for (const raw of [null, undefined, 'x', 3, [], { v: 2, items: [] }]) {
      expect(sanitizeLayout(raw, () => 1)).to.deep.equal(emptyLayout())
    }
  })

  it('gives every piece of scenery a footprint that fits the plot', () => {
    const ids = DECOR.map((item) => item.id)
    expect(new Set(ids).size).to.equal(ids.length)
    for (const item of DECOR) {
      expect(item.span).to.be.within(1, GRID_CELLS)
    }
  })
})
