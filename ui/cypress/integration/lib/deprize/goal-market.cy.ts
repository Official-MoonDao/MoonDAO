import { OPEN_FIELD_PROJECT_ID } from '@/lib/deprize/competitions'
import {
  type LiveGoalOdds,
  type MergeableGoal,
  mergeLiveMarket,
  mergeLiveMarketInto,
} from '@/lib/deprize/goal-market'

// Hand-written fixture: this module must not depend on the atlas dataset, which
// ships on the Moon Base Zero branch.
function goal(): MergeableGoal {
  return {
    id: 'shared-fission-power',
    market: {
      status: 'planned',
      impliedOdds: {
        'westinghouse-fission-surface-power': 0.34,
        'lockheed-fission-surface-power': 0.35,
        'ix-fission-surface-power': 0.31,
      },
    },
  }
}

const liveOdds: LiveGoalOdds = {
  deprizeId: 9,
  oddsByProjectId: {
    'westinghouse-fission-surface-power': 0.5,
    'lockheed-fission-surface-power': 0.3,
    'ix-fission-surface-power': 0.2,
  },
  fieldOdds: undefined,
  status: 'live',
}

describe('mergeLiveMarket', () => {
  it('replaces curator priors with live odds and flips status', () => {
    const merged = mergeLiveMarket(goal(), liveOdds)
    expect(merged.market?.status).to.equal('live')
    expect(merged.market?.impliedOdds).to.deep.equal(liveOdds.oddsByProjectId)
  })

  it('does not mutate the input goal', () => {
    const g = goal()
    mergeLiveMarket(g, liveOdds)
    expect(g.market?.status).to.equal('planned')
    expect(g.market?.impliedOdds?.['westinghouse-fission-surface-power']).to.equal(0.34)
  })

  it('carries Open Field mass under the sentinel key so bars still sum to ~1', () => {
    const merged = mergeLiveMarket(goal(), {
      ...liveOdds,
      oddsByProjectId: {
        'westinghouse-fission-surface-power': 0.4,
        'lockheed-fission-surface-power': 0.3,
        'ix-fission-surface-power': 0.15,
      },
      fieldOdds: 0.15,
    })
    expect(merged.market?.impliedOdds?.[OPEN_FIELD_PROJECT_ID]).to.equal(0.15)
    const sum = Object.values(merged.market!.impliedOdds!).reduce((a, b) => a + b, 0)
    expect(sum).to.be.closeTo(1, 1e-9)
  })

  it('keeps priors when the race is unbound, planned, or has no odds', () => {
    const g = goal()
    expect(mergeLiveMarket(g, undefined)).to.equal(g)
    expect(mergeLiveMarket(g, { ...liveOdds, deprizeId: undefined })).to.equal(g)
    // Superseded / loading generations report planned — must not blank the panel.
    expect(mergeLiveMarket(g, { ...liveOdds, status: 'planned' })).to.equal(g)
    expect(mergeLiveMarket(g, { ...liveOdds, oddsByProjectId: undefined })).to.equal(g)
    expect(mergeLiveMarket(g, { ...liveOdds, oddsByProjectId: {} })).to.equal(g)
  })

  it('marks a resolved market resolved', () => {
    const merged = mergeLiveMarket(goal(), { ...liveOdds, status: 'resolved' })
    expect(merged.market?.status).to.equal('resolved')
  })

  it('writes resolved status even when odds are empty (closed LMSR)', () => {
    const g = goal()
    const merged = mergeLiveMarket(g, {
      ...liveOdds,
      status: 'resolved',
      oddsByProjectId: undefined,
    })
    expect(merged.market?.status).to.equal('resolved')
    // Keep curator priors — blanking them would leave the bars empty.
    expect(merged.market?.impliedOdds).to.deep.equal(g.market?.impliedOdds)
    expect(
      mergeLiveMarket(g, { ...liveOdds, status: 'resolved', oddsByProjectId: {} }).market?.status,
    ).to.equal('resolved')
  })

  it('synthesizes a market block for a goal that never had one', () => {
    const bare: MergeableGoal = { id: 'shared-fission-power' }
    const merged = mergeLiveMarket(bare, liveOdds)
    expect(merged.market?.status).to.equal('live')
    expect(merged.market?.impliedOdds).to.deep.equal(liveOdds.oddsByProjectId)
  })

  it('preserves atlas-only market fields the panel still reads', () => {
    // The real SharedGoalMarket also carries resolutionAuthority / payoutSplit /
    // budgetGate. Overwriting the block instead of spreading it would blank them.
    const withExtras = {
      id: 'shared-fission-power',
      market: {
        status: 'planned' as const,
        resolutionAuthority: 'senate',
        payoutSplit: { capability: 0.3, flight: 0.7 },
        budgetGate: 'flight-demo quote <= prize-pool TWAP',
      },
    }
    const merged = mergeLiveMarket(withExtras, liveOdds)
    expect(merged.market.resolutionAuthority).to.equal('senate')
    expect(merged.market.payoutSplit).to.deep.equal({ capability: 0.3, flight: 0.7 })
    expect(merged.market.budgetGate).to.equal('flight-demo quote <= prize-pool TWAP')
    expect(merged.market.status).to.equal('live')
  })

  it('ignores a non-finite fieldOdds rather than writing NaN into the bars', () => {
    const merged = mergeLiveMarket(goal(), { ...liveOdds, fieldOdds: NaN })
    expect(merged.market?.impliedOdds).to.not.have.property(OPEN_FIELD_PROJECT_ID)
  })
})

describe('mergeLiveMarketInto', () => {
  const goals: MergeableGoal[] = [goal(), { id: 'shared-habitat', market: { status: 'planned' } }]

  it('merges only the mounted race and preserves identity elsewhere', () => {
    const next = mergeLiveMarketInto(goals, 'shared-fission-power', liveOdds)
    expect(next[0].market?.status).to.equal('live')
    expect(next[1]).to.equal(goals[1])
  })

  it('returns the same array when nothing merged, so memos do not recompute', () => {
    expect(mergeLiveMarketInto(goals, undefined, liveOdds)).to.equal(goals)
    expect(mergeLiveMarketInto(goals, 'shared-fission-power', undefined)).to.equal(goals)
    expect(
      mergeLiveMarketInto(goals, 'shared-fission-power', { ...liveOdds, status: 'planned' }),
    ).to.equal(goals)
    expect(mergeLiveMarketInto(goals, 'shared-nonexistent', liveOdds)).to.equal(goals)
  })
})
