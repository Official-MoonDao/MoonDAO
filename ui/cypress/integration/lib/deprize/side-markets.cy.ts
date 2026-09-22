import { findDePrizeIdForGoal } from '@/lib/deprize/competitions'
import {
  SIDE_MARKETS,
  getSideMarketByDePrizeId,
  getSideMarketsForGoal,
  isSideMarketDePrize,
  sideMarketOutcomesArePartition,
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
  const ok = { key: 'a', label: 'A', criterion: 'Judged by A.', teamId: 1 }

  it('rejects a single-outcome market (the registry requires two)', () => {
    expect(sideMarketOutcomesArePartition([ok])).to.equal(false)
  })

  it('rejects duplicate outcome keys', () => {
    expect(
      sideMarketOutcomesArePartition([ok, { ...ok, teamId: 2 }])
    ).to.equal(false)
  })

  it('rejects duplicate teamIds', () => {
    expect(sideMarketOutcomesArePartition([ok, { ...ok, key: 'b' }])).to.equal(false)
  })

  it('rejects an outcome with no criterion', () => {
    expect(
      sideMarketOutcomesArePartition([ok, { ...ok, key: 'b', teamId: 2, criterion: '' }])
    ).to.equal(false)
  })

  it('rejects a zero teamId, which the registry reserves as a sentinel', () => {
    expect(
      sideMarketOutcomesArePartition([ok, { ...ok, key: 'b', teamId: 0 }])
    ).to.equal(false)
  })
})
