/// <reference types="node" />

/**
 * Acceptance: every Moon Base Zero race takes free predictions.
 *
 * A race with no DePrize predicts under a reserved Forecasts voteId, one outcome
 * per competitor. These ids are stored on chain, so they must never collide with
 * a prize id, never repeat, and never silently drop a race added to the atlas.
 * Outcome slots are the same kind of id: a roster edit must not move a saved
 * pick onto another team.
 */
import {
  ATLAS_FORECAST_OUTCOMES,
  ATLAS_FORECAST_VOTE_IDS,
  ATLAS_FORECAST_VOTE_ID_BASE,
  atlasForecastBook,
} from '../../../../lib/forecasts/atlasBook'
import { SEED_ATLAS } from '../../../../lib/lunar-atlas/seed'

describe('atlas forecast book', () => {
  it('reserves a vote id for every race in the atlas', () => {
    for (const goal of SEED_ATLAS.sharedGoals) {
      expect(ATLAS_FORECAST_VOTE_IDS[goal.id], `no vote id for ${goal.id}`).to.be.a('number')
    }
  })

  it('has no stale entries for races the atlas no longer has', () => {
    const goalIds = new Set(SEED_ATLAS.sharedGoals.map((g) => g.id))
    for (const id of Object.keys(ATLAS_FORECAST_VOTE_IDS)) {
      expect(goalIds.has(id), `${id} is not an atlas race`).to.equal(true)
    }
  })

  it('never repeats an id, and stays above any prize id', () => {
    const ids = Object.values(ATLAS_FORECAST_VOTE_IDS)
    expect(new Set(ids).size).to.equal(ids.length)
    for (const id of ids) {
      expect(Number.isInteger(id)).to.equal(true)
      expect(id).to.be.greaterThan(ATLAS_FORECAST_VOTE_ID_BASE)
    }
  })

  it('opens a book for every race with at least two competitors', () => {
    for (const goal of SEED_ATLAS.sharedGoals) {
      const book = atlasForecastBook(goal.id, goal.projectIds)
      if (goal.projectIds.length < 2) {
        expect(book, goal.id).to.equal(undefined)
        // A new name does not invent a slot. The race stays closed until the
        // frozen map gives the field two written-out outcomes.
        expect(atlasForecastBook(goal.id, [...goal.projectIds, 'new-entrant']), goal.id).to.equal(
          undefined
        )
        continue
      }
      expect(book, goal.id).to.not.equal(undefined)
      expect(book!.outcomeIds).to.have.length(book!.numOutcomes)
      const seen = new Set<number>()
      for (const projectId of goal.projectIds) {
        const index = book!.outcomeIndexOf(projectId)
        expect(index, `${goal.id}:${projectId}`).to.be.a('number')
        expect(index!).to.be.at.least(0)
        expect(index!).to.be.below(book!.numOutcomes)
        expect(seen.has(index!), `${goal.id}:${projectId}`).to.equal(false)
        seen.add(index!)
        expect(book!.outcomeIds[index!]).to.equal(projectId)
      }
      expect(book!.outcomeIndexOf('not-in-this-race')).to.equal(undefined)
    }
  })

  it('keeps each competitor on the same slot when the roster changes shape', () => {
    for (const goal of SEED_ATLAS.sharedGoals) {
      if (goal.projectIds.length < 2) continue
      const book = atlasForecastBook(goal.id, goal.projectIds)!
      const reversed = atlasForecastBook(goal.id, [...goal.projectIds].reverse())!
      const inserted = atlasForecastBook(goal.id, ['new-entrant', ...goal.projectIds])!
      expect(reversed.outcomeIds, goal.id).to.deep.equal(book.outcomeIds)
      expect(inserted.outcomeIds, goal.id).to.deep.equal(book.outcomeIds)
      expect(inserted.numOutcomes, goal.id).to.equal(book.numOutcomes)
      expect(inserted.outcomeIndexOf('new-entrant')).to.equal(undefined)
      for (const projectId of goal.projectIds) {
        expect(reversed.outcomeIndexOf(projectId), goal.id).to.equal(book.outcomeIndexOf(projectId))
        expect(inserted.outcomeIndexOf(projectId), goal.id).to.equal(book.outcomeIndexOf(projectId))
      }
      if (goal.projectIds.length < 3) continue
      const removedId = goal.projectIds[0]
      const shortened = atlasForecastBook(
        goal.id,
        goal.projectIds.filter((id) => id !== removedId)
      )!
      expect(shortened.outcomeIds, goal.id).to.deep.equal(book.outcomeIds)
      expect(shortened.numOutcomes, goal.id).to.equal(book.numOutcomes)
      expect(shortened.outcomeIndexOf(removedId)).to.equal(undefined)
      for (const projectId of goal.projectIds) {
        if (projectId === removedId) continue
        expect(shortened.outcomeIndexOf(projectId), goal.id).to.equal(
          book.outcomeIndexOf(projectId)
        )
      }
    }
  })

  it('pins a slot for every competitor and no one else', () => {
    const goalIds = new Set(SEED_ATLAS.sharedGoals.map((g) => g.id))
    for (const id of Object.keys(ATLAS_FORECAST_OUTCOMES)) {
      expect(goalIds.has(id), `${id} is not an atlas race`).to.equal(true)
    }
    for (const goal of SEED_ATLAS.sharedGoals) {
      const assigned = ATLAS_FORECAST_OUTCOMES[goal.id]
      expect(assigned, `no outcome slots for ${goal.id}`).to.be.an('object')
      expect(Object.keys(assigned).slice().sort(), goal.id).to.deep.equal(
        goal.projectIds.slice().sort()
      )
      const indices = Object.values(assigned)
      expect(new Set(indices).size, goal.id).to.equal(indices.length)
      for (const index of indices) {
        expect(Number.isInteger(index), goal.id).to.equal(true)
        expect(index, goal.id).to.be.at.least(0)
      }
    }
  })

  it('does not open a book for an unknown race', () => {
    expect(atlasForecastBook('shared-nope', ['a', 'b'])).to.equal(undefined)
    expect(atlasForecastBook(undefined, ['a', 'b'])).to.equal(undefined)
  })
})
