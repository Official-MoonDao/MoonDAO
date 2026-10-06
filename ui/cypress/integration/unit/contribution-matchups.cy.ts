import type { Contribution } from '@/lib/contributions/getSheetContributions'
import {
  computeStandings,
  eligibleCards,
  pairKey,
  parseLinks,
  parseSheetTimestamp,
  pickPair,
  toMatchupCard,
} from '@/lib/contributions/matchups'

const NOW = new Date('2026-10-06T12:00:00Z')

function row(overrides: Partial<Contribution> = {}): Contribution {
  return {
    timestamp: '10/1/2026 9:30:00',
    walletAddress: '0x1111111111111111111111111111111111111111',
    name: 'Ada',
    description: 'Built a thing',
    links: '',
    area: 'Technical',
    timeCommitment: '5 hours',
    ...overrides,
  }
}

describe('contribution matchups', () => {
  it('parses Google Forms timestamps', () => {
    expect(parseSheetTimestamp('10/1/2026 9:30:00')?.toISOString()).to.equal(
      '2026-10-01T09:30:00.000Z'
    )
    expect(parseSheetTimestamp('2026-09-01T00:00:00Z')?.toISOString()).to.equal(
      '2026-09-01T00:00:00.000Z'
    )
    expect(parseSheetTimestamp('not a date')).to.equal(null)
  })

  it('keeps only web links', () => {
    expect(
      parseLinks('https://a.com/x, www.b.org javascript:alert(1)\nnotes github.com/moondao/repo')
    ).to.deep.equal([
      'https://a.com/x',
      'https://www.b.org/',
      'https://github.com/moondao/repo',
    ])
  })

  it('hides author identity on cards', () => {
    const card = toMatchupCard(row()) as Record<string, unknown>
    expect(card).to.not.have.property('name')
    expect(card).to.not.have.property('walletAddress')
    expect(card.id).to.match(/^[a-f0-9]{16}$/)
  })

  it('limits the pool to the last 90 days, dedupes, and drops the voter’s own work', () => {
    const own = row({ description: 'mine' })
    const other = row({
      description: 'theirs',
      walletAddress: '0x2222222222222222222222222222222222222222',
    })
    const old = row({ description: 'old', timestamp: '5/1/2026 9:00:00' })
    const cards = eligibleCards([own, other, other, old], {
      now: NOW,
      excludeWallet: '0x1111111111111111111111111111111111111111',
    })
    expect(cards.map((c) => c.description)).to.deep.equal(['theirs'])
  })

  it('pairs least-compared contributions and avoids pairs already judged', () => {
    const cards = ['a', 'b', 'c', 'd'].map((d) =>
      toMatchupCard(row({ description: d }))
    )
    const [a, b, c] = cards
    const counts = { [a.id]: 0, [b.id]: 1, [c.id]: 1 }
    const pair = pickPair(cards.slice(0, 3), counts, new Set(), () => 0.9)!
    expect(pair.map((p) => p.id)).to.include(a.id)

    const judged = new Set([pairKey(a.id, b.id), pairKey(a.id, c.id)])
    const next = pickPair(cards.slice(0, 3), counts, judged, () => 0.9)!
    expect(next.map((p) => p.id).sort()).to.deep.equal([b.id, c.id].sort())

    expect(pickPair(cards.slice(0, 1), {})).to.equal(null)
  })

  it('matches the spec example: squared win rates with the bottom quarter cut', () => {
    const cards = ['w90', 'w60', 'w45', 'w30', 'new'].map((d) =>
      toMatchupCard(row({ description: d }))
    )
    const [c90, c60, c45, c30, fresh] = cards
    const standings = computeStandings(cards, {
      wins: { [c90.id]: 18, [c60.id]: 12, [c45.id]: 9, [c30.id]: 6, [fresh.id]: 2 },
      matchups: { [c90.id]: 20, [c60.id]: 20, [c45.id]: 20, [c30.id]: 20, [fresh.id]: 2 },
    })
    const byDesc = Object.fromEntries(standings.map((s) => [s.card.description, s]))
    expect(Math.round(byDesc.w90.share! * 100)).to.equal(59)
    expect(Math.round(byDesc.w60.share! * 100)).to.equal(26)
    expect(Math.round(byDesc.w45.share! * 100)).to.equal(15)
    expect(byDesc.w30.status).to.equal('cut')
    expect(byDesc.new.status).to.equal('needs-votes')
    expect(standings.map((s) => s.card.description)).to.deep.equal([
      'w90',
      'w60',
      'w45',
      'w30',
      'new',
    ])
  })

  it('pays everyone tied at the cutoff line', () => {
    const cards = ['a', 'b', 'c', 'd'].map((d) => toMatchupCard(row({ description: d })))
    const wins: Record<string, number> = {}
    const matchups: Record<string, number> = {}
    cards.forEach((c, i) => {
      wins[c.id] = i === 0 ? 8 : 5
      matchups[c.id] = 10
    })
    const standings = computeStandings(cards, { wins, matchups })
    expect(standings.every((s) => s.status === 'paid')).to.equal(true)
  })
})
