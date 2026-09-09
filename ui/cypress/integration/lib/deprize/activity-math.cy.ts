import {
  totalStaked,
  uniqueBackers,
  userActiveOutcomes,
  userActivity,
  userPosition,
  userSummary,
  type BetRow,
  type SellRow,
} from '@/lib/deprize/activity-math'

const A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

function bet(p: Partial<BetRow> & { bettor: string; outcomeIndex: number; qty: number }): BetRow {
  return {
    costEth: 0,
    sliceEth: 0,
    blockNumber: 1n,
    logIndex: 0,
    txHash: '0x1',
    timestampMs: 1,
    ...p,
  }
}
function sell(p: Partial<SellRow> & { seller: string; outcomeIndex: number; qty: number }): SellRow {
  return {
    proceedsEth: 0,
    blockNumber: 2n,
    logIndex: 0,
    txHash: '0x2',
    timestampMs: 2,
    ...p,
  }
}

describe('deprize activity math', () => {
  const bets: BetRow[] = [
    bet({ bettor: A, outcomeIndex: 0, qty: 2, costEth: 0.95, sliceEth: 0.05 }),
    bet({ bettor: A, outcomeIndex: 0, qty: 2, costEth: 1.9, sliceEth: 0.1, blockNumber: 3n }),
    bet({ bettor: A, outcomeIndex: 1, qty: 1, costEth: 0.475, sliceEth: 0.025 }),
    bet({ bettor: B, outcomeIndex: 2, qty: 5, costEth: 0.19, sliceEth: 0.01 }),
  ]

  it('counts unique backers case-insensitively', () => {
    const mixed = [...bets, bet({ bettor: A.toUpperCase().replace('0X', '0x'), outcomeIndex: 0, qty: 1 })]
    expect(uniqueBackers(mixed)).to.equal(2)
  })

  it('total staked sums the market-side cost only (not the prize slice)', () => {
    expect(totalStaked(bets)).to.be.closeTo(0.95 + 1.9 + 0.475 + 0.19, 1e-12)
  })

  it('userPosition uses average all-in cost (cost + slice) for held tokens', () => {
    const sells: SellRow[] = [sell({ seller: A, outcomeIndex: 0, qty: 1, proceedsEth: 0.9 })]
    const p = userPosition(bets, sells, A, 0)
    expect(p.qtyBought).to.equal(4)
    expect(p.qtySold).to.equal(1)
    expect(p.qtyHeld).to.equal(3)
    expect(p.spentEth).to.be.closeTo(3.0, 1e-12) // 1.0 + 2.0 all-in
    expect(p.avgCostEth).to.be.closeTo(0.75, 1e-12)
    expect(p.heldCostEth).to.be.closeTo(2.25, 1e-12)
    expect(p.proceedsEth).to.equal(0.9)
  })

  it('userActiveOutcomes lists every outcome touched, sorted', () => {
    const sells: SellRow[] = [sell({ seller: A, outcomeIndex: 3, qty: 1 })]
    expect(userActiveOutcomes(bets, sells, A)).to.deep.equal([0, 1, 3])
    expect(userActiveOutcomes(bets, sells, B)).to.deep.equal([2])
  })

  it('userSummary nets current value + realized against everything spent', () => {
    const sells: SellRow[] = [sell({ seller: A, outcomeIndex: 0, qty: 1, proceedsEth: 0.9 })]
    const value = new Map<number, number>([
      [0, 2.4], // 3 held tokens on outcome 0
      [1, 0.6],
    ])
    const s = userSummary(bets, sells, A, value)
    expect(s.totalSpentEth).to.be.closeTo(3.5, 1e-12)
    expect(s.realizedEth).to.equal(0.9)
    expect(s.currentValueEth).to.equal(3.0)
    expect(s.heldCostEth).to.be.closeTo(2.25 + 0.5, 1e-12)
    expect(s.unrealizedPnlEth).to.be.closeTo(3.0 - 2.75, 1e-12)
    expect(s.netPnlEth).to.be.closeTo(3.0 + 0.9 - 3.5, 1e-12)
  })

  it('userSummary is negative after a losing cash-out', () => {
    const only: BetRow[] = [bet({ bettor: A, outcomeIndex: 0, qty: 1, costEth: 0.95, sliceEth: 0.05 })]
    const sells: SellRow[] = [sell({ seller: A, outcomeIndex: 0, qty: 1, proceedsEth: 0.7 })]
    const s = userSummary(only, sells, A, new Map())
    expect(s.netPnlEth).to.be.closeTo(-0.3, 1e-12)
    expect(s.heldCostEth).to.equal(0)
  })

  it('userActivity is reverse-chronological by block then log index', () => {
    const sells: SellRow[] = [sell({ seller: A, outcomeIndex: 0, qty: 1, blockNumber: 2n })]
    const rows = userActivity(bets, sells, A)
    expect(rows.map((r) => `${r.kind}@${r.blockNumber}`)).to.deep.equal([
      'bet@3',
      'sell@2',
      'bet@1',
      'bet@1',
    ])
  })
})
