/**
 * Cross-check the Moon Base Zero atlas against the DePrize race binding, and
 * prove the Wave 2 merge helper accepts real SharedGoal values.
 */

import { expect } from 'chai'
import {
  getDePrizeRaceBinding,
  OPEN_FIELD_PROJECT_ID,
} from '../../../lib/deprize/competitions'
import { mergeLiveMarketInto } from '../../../lib/deprize/goal-market'
import { SEED_ATLAS } from '../../../lib/lunar-atlas/seed'
import { buildTechTrees, sharedGoalById } from '../../../lib/lunar-atlas/selectors'

describe('lunar-atlas × DePrize binding', () => {
  const binding = getDePrizeRaceBinding('sepolia', 9)
  const goal = sharedGoalById(SEED_ATLAS, 'shared-fission-power')

  it('binds Sepolia DePrize 9 to the fission shared goal with matching projectIds', () => {
    expect(binding?.sharedGoalId).to.equal('shared-fission-power')
    expect(goal).to.exist
    const competitorIds = (binding?.outcomes ?? [])
      .filter((o) => !o.field)
      .map((o) => o.projectId)
    expect(competitorIds).to.have.length.greaterThan(0)
    for (const id of competitorIds) {
      expect(goal!.projectIds, `atlas goal missing ${id}`).to.include(id)
    }
  })

  it('merges live odds into the real SharedGoal without dropping atlas market fields', () => {
    expect(goal?.market?.resolutionAuthority).to.equal('senate')
    const live = {
      deprizeId: 9,
      oddsByProjectId: {
        'westinghouse-fission-surface-power': 0.4,
        'lockheed-fission-surface-power': 0.35,
        'ix-fission-surface-power': 0.15,
      },
      fieldOdds: 0.1,
      status: 'live' as const,
    }
    const next = mergeLiveMarketInto(
      [...SEED_ATLAS.sharedGoals],
      'shared-fission-power',
      live
    )
    const merged = next.find((g) => g.id === 'shared-fission-power')
    expect(merged?.market?.status).to.equal('live')
    expect(merged?.market?.impliedOdds?.[OPEN_FIELD_PROJECT_ID]).to.equal(0.1)
    // Atlas-only fields the panel still reads must survive the merge.
    expect(merged?.market?.resolutionAuthority).to.equal('senate')

    // buildTechTrees accepts the merged mutable array with no cast.
    const trees = buildTechTrees(SEED_ATLAS.projects, next)
    const power = trees.find((t) => t.goal?.id === 'shared-fission-power')
    expect(power?.goal?.market?.status).to.equal('live')
    expect(power?.goal?.market?.impliedOdds?.['westinghouse-fission-surface-power']).to.equal(
      0.4
    )
  })
})
