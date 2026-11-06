import {
  STATEMENT_BUDGET_BYTES,
  estimateImportGas,
  extractLinks,
  mapArea,
  packSafeTransactions,
  packStatements,
  planBackfill,
  rowStatementBytes,
  truncateBytes,
  type ReviewRow,
} from '@/lib/contributions/backfill'
import { DESCRIPTION_MAX_BYTES, utf8Bytes } from '@/lib/contributions/onchain'

const NOW = 1_800_000_000
const WALLET = '0x' + 'ab'.repeat(20)

function review(overrides: Partial<ReviewRow> = {}): ReviewRow {
  return {
    review: '',
    quarter: '2026Q3',
    cycleId: '20263',
    author: WALLET,
    citizen_id: '42',
    citizen_name: 'Ada',
    createdAt: '1790000000',
    submitted_at_approx: 'False',
    title_derived: 'Ran the onboarding call',
    area: 'Community Growth & Engagement',
    description_verbatim: 'Hosted the onboarding call for new Citizens.',
    links: 'https://a.org/1 https://a.org/1 not-a-link',
    result_share_pct: '',
    result_reward: '',
    source: 'Q3 Community Contributions',
    source_ref: 'row 7',
    ...overrides,
  }
}

const plan = (rows: ReviewRow[], openCycleId = 20264) =>
  planBackfill(rows, { openCycleId, now: NOW })

describe('contributions backfill', () => {
  it('turns a reviewed row into an import row', () => {
    const [p] = plan([review()])
    expect(p.skipped).to.equal(undefined)
    const row = p.importRow!
    expect(row.author).to.equal(WALLET)
    expect(row.cycleId).to.equal(BigInt(20263))
    expect(row.area).to.equal('community')
    expect(row.links).to.equal('["https://a.org/1"]')
    expect(row.shareBps).to.equal(BigInt(0))
    expect(row.reward).to.equal('')
    expect(JSON.parse(row.metadata)).to.deep.equal({
      source: 'Q3 Community Contributions',
      sourceRef: 'row 7',
      titleGenerated: true,
      areaAsGiven: 'Community Growth & Engagement',
    })
  })

  it('leaves out skipped, walletless and non-Citizen rows', () => {
    const reasons = plan([
      review({ review: 'skip' }),
      review({ author: '' }),
      review({ citizen_id: '' }),
      review({ cycleId: '20271' }),
      review({ createdAt: String(NOW + 1) }),
      review({ description_verbatim: '  ' }),
    ]).map((p) => p.skipped)
    expect(reasons).to.deep.equal([
      'marked skip in review',
      'no wallet',
      'never a Citizen: kept offline',
      'cycle 20271 is after the open cycle',
      'bad timestamp',
      'no text',
    ])
  })

  it('imports a non-Citizen row only when review says include', () => {
    const [p] = plan([review({ citizen_id: '', review: 'include' })])
    expect(p.importRow).to.not.equal(undefined)
  })

  it('keeps past results per person in metadata, never in the open cycle', () => {
    const result = { result_share_pct: '3.5', result_reward: '{"reward_usd": 190.2}' }
    const [past] = plan([review(result)])
    const meta = JSON.parse(past.importRow!.metadata)
    expect(meta.cycleReward).to.deep.equal({ sharePct: 3.5, reward_usd: 190.2 })
    expect(meta.rewardScope).to.equal('person')
    expect(past.importRow!.shareBps).to.equal(BigInt(0))

    const [open] = plan([review({ ...result, cycleId: '20264' })])
    expect(JSON.parse(open.importRow!.metadata).cycleReward).to.equal(undefined)
    expect(plan([review({ result_reward: '{}' })])[0].importRow!.metadata).to.not.include(
      'cycleReward'
    )
  })

  it('cuts long text to the contract limits without splitting characters', () => {
    const long = 'é'.repeat(DESCRIPTION_MAX_BYTES)
    const [p] = plan([review({ description_verbatim: long, title_derived: 'ü'.repeat(100) })])
    expect(utf8Bytes(p.importRow!.description)).to.be.at.most(DESCRIPTION_MAX_BYTES)
    expect(p.importRow!.description.endsWith(' […]')).to.equal(true)
    expect(utf8Bytes(p.importRow!.title)).to.be.at.most(120)
    expect(JSON.parse(p.importRow!.metadata).descriptionBytes).to.equal(DESCRIPTION_MAX_BYTES * 2)
    expect(truncateBytes('abc', 10)).to.equal('abc')
  })

  it('maps old areas onto the current six', () => {
    expect(mapArea('Marketing (CN)')).to.equal('content')
    expect(mapArea('Technical Development')).to.equal('technical')
    expect(mapArea('Something new')).to.equal('other')
  })

  it('pulls web links out of free text', () => {
    expect(extractLinks('see https://a.org/x, www.b.org; and c')).to.deep.equal([
      'https://a.org/x',
      'https://www.b.org/',
    ])
  })

  it('orders rows oldest first', () => {
    const lines = plan([
      review({ createdAt: '1790000300' }),
      review({ createdAt: '1790000100' }),
    ]).map((p) => p.line)
    expect(lines).to.deep.equal([2, 1])
  })

  it('packs statements under the Tableland limit, counting doubled quotes', () => {
    const quoted = plan([review({ description_verbatim: "'".repeat(3000) })])[0].importRow!
    expect(rowStatementBytes(quoted)).to.be.greaterThan(6000)
    const rows = Array.from({ length: 6 }, () => quoted)
    const batches = packStatements(rows, 'CONTRIBUTIONS_42161_169')
    expect(batches.flat().length).to.equal(6)
    for (const b of batches) {
      const size = b.reduce((n, r) => n + rowStatementBytes(r), 200)
      expect(size).to.be.at.most(STATEMENT_BUDGET_BYTES)
    }
    expect(batches.length).to.be.greaterThan(1)
  })

  it('groups calls into Safe transactions under a gas budget', () => {
    const call = { gas: 10_000_000 }
    expect(packSafeTransactions([call, call, call]).map((g) => g.length)).to.deep.equal([2, 1])
    const [row] = plan([review()]).map((p) => p.importRow!)
    expect(estimateImportGas([row])).to.be.greaterThan(rowStatementBytes(row) * 1000)
  })
})
