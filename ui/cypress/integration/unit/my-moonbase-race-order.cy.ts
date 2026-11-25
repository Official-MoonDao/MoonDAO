/**
 * My Moonbase hardware list: races expected soonest come first.
 */
import { expect } from 'chai'
import { SEED_ATLAS } from '../../../lib/lunar-atlas/seed'
import type { SharedGoal } from '../../../lib/lunar-atlas/types'
import { compareRacesBySchedule } from '../../../lib/my-moonbase/raceOrder'

function goal(id: string, targetWindow?: SharedGoal['targetWindow']): SharedGoal {
  return { id, title: id, description: '', projectIds: [], sources: [], targetWindow }
}

describe('My Moonbase race order', () => {
  it('sorts by window start, then window end, with undated races last', () => {
    const sorted = [
      goal('undated'),
      goal('late', { from: '2030', to: '2040' }),
      goal('long', { from: '2026', to: '2032' }),
      goal('short', { from: '2026', to: '2028' }),
      goal('single', { to: '2027' }),
    ].sort(compareRacesBySchedule)
    expect(sorted.map((g) => g.id)).to.deep.equal(['short', 'long', 'single', 'late', 'undated'])
  })

  it('keeps dataset order on a tie', () => {
    const sorted = [
      goal('a', { from: '2026', to: '2029' }),
      goal('b', { from: '2026', to: '2029' }),
    ].sort(compareRacesBySchedule)
    expect(sorted.map((g) => g.id)).to.deep.equal(['a', 'b'])
  })

  it('puts Touchdown first in the seed atlas', () => {
    const sorted = [...SEED_ATLAS.sharedGoals].sort(compareRacesBySchedule)
    expect(sorted[0].id).to.equal('shared-next-landing')
  })
})
