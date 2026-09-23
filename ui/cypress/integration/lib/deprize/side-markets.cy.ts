import { findDePrizeIdForGoal } from '@/lib/deprize/competitions'
import {
  SIDE_MARKETS,
  getSideMarketByDePrizeId,
  getSideMarketsForGoal,
  isSideMarketDePrize,
  sideMarketOutcomesArePartition,
  sideMarketPriorOdds,
} from '@/lib/deprize/sideMarkets'

describe('side market definitions', () => {
  it('gives every definition a partition of at least two outcomes', () => {
    for (const def of SIDE_MARKETS) {
      expect(sideMarketOutcomesArePartition(def.outcomes), def.key).to.equal(true)
    }
  })

  it('keeps teamIds unique across every side market', () => {
    // Each side market is its own registry entry, so a collision would not
    // revert. It would just mean two markets silently share a checksum, which
    // is how a copy-pasted outcome block escapes review.
    const seen = new Set<number>()
    for (const def of SIDE_MARKETS) {
      for (const outcome of def.outcomes) {
        expect(seen.has(outcome.teamId), `${def.key}/${outcome.key}`).to.equal(false)
        seen.add(outcome.teamId)
      }
    }
  })

  it('never carries a sharedGoalId', () => {
    // This is the invariant that keeps goalIndexForChain's duplicate-binding
    // guard meaningful: a side market attaches to a race via parentGoalId and
    // must never look like a second primary binding for that goal.
    for (const def of SIDE_MARKETS) {
      expect(Object.keys(def), def.key).to.not.include('sharedGoalId')
      expect(def.parentGoalId, def.key).to.be.a('string').and.not.equal('')
    }
  })

  it('keeps definition keys unique', () => {
    const keys = SIDE_MARKETS.map((d) => d.key)
    expect(new Set(keys).size).to.equal(keys.length)
  })
})

describe('getSideMarketsForGoal', () => {
  it('returns the Touchdown side markets in editorial order', () => {
    const markets = getSideMarketsForGoal('sepolia', 'shared-next-landing')
    expect(markets.map((m) => m.key)).to.deep.equal([
      'touchdown-attitude',
      'touchdown-window',
    ])
  })

  it('returns an empty list for a race with no side markets', () => {
    expect(getSideMarketsForGoal('sepolia', 'shared-fission-power')).to.have.length(0)
  })

  it('returns an empty list for an undefined goal', () => {
    expect(getSideMarketsForGoal('sepolia', undefined)).to.have.length(0)
  })

  it('is identity-stable so React consumers can memoize on it', () => {
    const a = getSideMarketsForGoal('sepolia', 'shared-next-landing')
    const b = getSideMarketsForGoal('sepolia', 'shared-next-landing')
    expect(a).to.equal(b)
  })

  it('reports planned until the market is provisioned on that chain', () => {
    for (const market of getSideMarketsForGoal('sepolia', 'shared-next-landing')) {
      expect(market.status, market.key).to.equal('planned')
      expect(market.deprizeId, market.key).to.equal(undefined)
    }
  })
})

describe('getSideMarketByDePrizeId', () => {
  it('returns undefined for a primary race market', () => {
    const primary = findDePrizeIdForGoal('sepolia', 'shared-next-landing')
    expect(primary, 'Touchdown should still resolve to a primary market').to.be.a(
      'number'
    )
    expect(getSideMarketByDePrizeId('sepolia', primary)).to.equal(undefined)
    expect(isSideMarketDePrize('sepolia', primary)).to.equal(false)
  })

  it('returns undefined for an unknown id or chain', () => {
    expect(getSideMarketByDePrizeId('sepolia', 99999)).to.equal(undefined)
    expect(getSideMarketByDePrizeId('mainnet', 1)).to.equal(undefined)
    expect(getSideMarketByDePrizeId('sepolia', undefined)).to.equal(undefined)
  })
})

describe('sideMarketOutcomesArePartition', () => {
  const a = { key: 'a', label: 'A', criterion: 'Judged by A.', teamId: 1, prior: 0.5 }
  const b = { key: 'b', label: 'B', criterion: 'Judged by B.', teamId: 2, prior: 0.5 }

  it('accepts a well-formed pair', () => {
    expect(sideMarketOutcomesArePartition([a, b])).to.equal(true)
  })

  it('rejects a single-outcome market (the registry requires two)', () => {
    expect(sideMarketOutcomesArePartition([{ ...a, prior: 1 }])).to.equal(false)
  })

  it('rejects duplicate outcome keys', () => {
    expect(sideMarketOutcomesArePartition([a, { ...b, key: 'a' }])).to.equal(false)
  })

  it('rejects duplicate teamIds', () => {
    expect(sideMarketOutcomesArePartition([a, { ...b, teamId: 1 }])).to.equal(false)
  })

  it('rejects an outcome with no criterion', () => {
    expect(sideMarketOutcomesArePartition([a, { ...b, criterion: '' }])).to.equal(false)
  })

  it('rejects a zero teamId, which the registry reserves as a sentinel', () => {
    expect(sideMarketOutcomesArePartition([a, { ...b, teamId: 0 }])).to.equal(false)
  })

  it('rejects priors that do not sum to 1', () => {
    expect(sideMarketOutcomesArePartition([a, { ...b, prior: 0.4 }])).to.equal(false)
  })

  it('rejects a zero prior, which claims an outcome is impossible', () => {
    // Under Brier a probability-zero claim costs a full point if it happens.
    expect(
      sideMarketOutcomesArePartition([{ ...a, prior: 1 }, { ...b, prior: 0 }])
    ).to.equal(false)
  })
})

describe('sideMarketPriorOdds', () => {
  it('emits percentages keyed by outcome key, summing to 100', () => {
    for (const def of SIDE_MARKETS) {
      const odds = sideMarketPriorOdds(def)
      expect(Object.keys(odds), def.key).to.have.length(def.outcomes.length)
      const total = Object.values(odds).reduce((sum, p) => sum + p, 0)
      expect(Math.abs(total - 100), def.key).to.be.lessThan(1e-6)
    }
  })

  it('prices the attitude market off the 2024-25 record, not a flat 1/N', () => {
    const attitude = SIDE_MARKETS.find((d) => d.key === 'touchdown-attitude')!
    const odds = sideMarketPriorOdds(attitude)
    // Three of the six attempts that reached the Moon came to rest wrong, so a
    // flat 25% across four outcomes would understate it.
    expect(odds['wrong-orientation']).to.be.greaterThan(25)
    expect(odds['upright-short']).to.be.lessThan(25)
  })
})
