/// <reference types="node" />

/**
 * Acceptance: every Moon Base Zero race takes free predictions.
 *
 * A race with no DePrize predicts under a reserved Forecasts voteId, one outcome
 * per competitor. These ids are stored on chain, so they must never collide with
 * a prize id, never repeat, and never silently drop a race added to the atlas.
 */
import {
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
        continue
      }
      expect(book, goal.id).to.not.equal(undefined)
      expect(book!.numOutcomes).to.equal(goal.projectIds.length)
      goal.projectIds.forEach((projectId, index) => {
        expect(book!.outcomeIndexOf(projectId)).to.equal(index)
      })
      expect(book!.outcomeIndexOf('not-in-this-race')).to.equal(undefined)
    }
  })

  it('does not open a book for an unknown race', () => {
    expect(atlasForecastBook('shared-nope', ['a', 'b'])).to.equal(undefined)
    expect(atlasForecastBook(undefined, ['a', 'b'])).to.equal(undefined)
  })
})
