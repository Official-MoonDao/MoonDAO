import { archiveRecordToEntry, mapArea, type ContributionEntry } from '@/lib/contributions/archive'
import {
  formRowToArchive,
  mergeArchive,
  parseFormTimestamp,
  reviewRowToArchive,
} from '@/lib/contributions/archiveSeed'
import { contributionsCsv, parseCycleParam } from '@/lib/contributions/export'
import {
  entryToFeedContribution,
  rowToEntry,
  sortEntries,
  withCitizenNames,
} from '@/lib/contributions/entries'

const WALLET = '0x' + 'ab'.repeat(20)

const record = {
  archive_id: '20263-abc',
  cycleId: '20263',
  citizen_id: '42',
  wallet: WALLET.toUpperCase().replace('0X', '0x'),
  display_name: 'ada#1234',
  title: 'Ran the onboarding call',
  description: 'Hosted the call.',
  area: 'Community Growth & Engagement (e.g., events, moderation, onboarding)',
  links: '["https://a.org/1"]',
  createdAt: '1790000000',
  share_pct: '3.5',
  reward_json: '{"reward_usd": 190.2}',
  hidden: '',
}

describe('contribution archive', () => {
  it('reads an archive row into the shared shape', () => {
    expect(archiveRecordToEntry(record)).to.deep.equal({
      key: 'archive:20263-abc',
      source: 'archive',
      cycleId: 20263,
      wallet: WALLET,
      name: 'ada#1234',
      title: 'Ran the onboarding call',
      description: 'Hosted the call.',
      area: 'community',
      links: ['https://a.org/1'],
      createdAt: 1790000000,
      result: { sharePct: 3.5, reward: { reward_usd: 190.2 } },
    })
  })

  it('drops hidden and unusable rows', () => {
    expect(archiveRecordToEntry({ ...record, hidden: 'TRUE' })).to.equal(null)
    expect(archiveRecordToEntry({ ...record, description: ' ' })).to.equal(null)
    expect(archiveRecordToEntry({ ...record, archive_id: '' })).to.equal(null)
    expect(archiveRecordToEntry({ ...record, cycleId: 'Q3' })).to.equal(null)
  })

  it('fills gaps and strips the formula marker', () => {
    const e = archiveRecordToEntry({
      ...record,
      title: '',
      description: "'=SUM(1)\nsecond line",
      wallet: 'not a wallet',
      share_pct: '',
      reward_json: '{}',
      links: 'https://a.org/1 https://b.org/2',
    })!
    expect(e.description).to.equal('=SUM(1)\nsecond line')
    expect(e.title).to.equal('=SUM(1)')
    expect(e.wallet).to.equal('')
    expect(e.result).to.equal(undefined)
    expect(e.links).to.deep.equal(['https://a.org/1', 'https://b.org/2'])
  })

  it('dates an undated row at the end of its quarter', () => {
    const e = archiveRecordToEntry({ ...record, cycleId: '20231', createdAt: '' })!
    expect(new Date(e.createdAt * 1000).toISOString()).to.equal('2023-03-31T12:00:00.000Z')
  })

  it('maps old and current areas to codes', () => {
    expect(mapArea('Marketing (CN)')).to.equal('content')
    expect(mapArea('technical')).to.equal('technical')
    expect(mapArea('Space Exploration & Research (e.g., payloads)')).to.equal('space')
    expect(mapArea('')).to.equal('other')
  })
})

describe('archive seed', () => {
  const reviewRow = {
    review: '',
    cycleId: '20264',
    citizen_id: '7',
    citizen_name: 'Ada',
    author: WALLET,
    author_name_as_given: 'ada#1234',
    createdAt: '1792000000',
    title_derived: 'Wrote docs',
    description_verbatim: 'Wrote the  onboarding docs.',
    area: 'Content Creation & Marketing',
    links: 'https://a.org/x, see notes',
    result_share_pct: '',
    result_reward: '{}',
    source: 'Q4 Community Contributions',
    source_ref: 'row 3',
  }

  it('turns a review row into an archive row without the reward placeholder', () => {
    const r = reviewRowToArchive(reviewRow)!
    expect(r.archive_id).to.match(/^20264-[0-9a-f]{10}$/)
    expect(r.display_name).to.equal('Ada')
    expect(r.links).to.equal('["https://a.org/x"]')
    expect(r.reward_json).to.equal('')
    expect(reviewRowToArchive({ ...reviewRow, review: 'skip' })).to.equal(null)
    expect(reviewRowToArchive(reviewRow)!.archive_id).to.equal(r.archive_id)
  })

  it('reads Google Form timestamps as UTC', () => {
    expect(parseFormTimestamp('10/26/2026 21:47:33')).to.equal(
      Date.UTC(2026, 9, 26, 21, 47, 33) / 1000
    )
    expect(parseFormTimestamp('2026-10-26')).to.equal(null)
  })

  it('never copies the form email column', () => {
    const cells = ['10/30/2026 9:00:00', 'Bo', 'bo@example.com', 'Yes', WALLET, 'Other', 'Did a thing', '1', '']
    const r = formRowToArchive(cells, 20264)!
    expect(Object.values(r).join(' ')).to.not.include('@example.com')
    expect(r.cycleId).to.equal('20264')
    expect(r.title).to.equal('Did a thing')
  })

  it('adds only form rows whose text is new, oldest first', () => {
    const fromReview = reviewRowToArchive(reviewRow)!
    const same = formRowToArchive(
      ['10/1/2026 9:00:00', 'Ada', '', '', WALLET, '', 'Wrote the onboarding docs.', '', ''],
      20264
    )!
    const fresh = formRowToArchive(
      ['10/1/2026 9:00:00', 'Ada', '', '', WALLET, '', 'Something else', '', ''],
      20264
    )!
    const merged = mergeArchive([fromReview], [same, fresh])
    expect(merged.map((r) => r.description)).to.deep.equal([
      'Something else',
      'Wrote the  onboarding docs.',
    ])
  })
})

describe('shared contributions reader', () => {
  const archived = archiveRecordToEntry(record)!
  const onchain = rowToEntry({
    id: 3,
    cycleId: 20264,
    author: '0xCD' + 'cd'.repeat(19),
    title: 'Shipped it',
    description: 'Did it.',
    area: 'technical',
    links: ['https://c.org'] as unknown as string,
    metadata: '',
    origin: 0,
    hidden: 0,
    createdAt: 1795000000,
    updatedAt: 1795000000,
    shareBps: 0,
    reward: '',
  })

  it('reads onchain rows into the same shape', () => {
    expect(onchain.key).to.equal('chain:3')
    expect(onchain.wallet).to.equal('0x' + 'cd'.repeat(20))
    expect(onchain.links).to.deep.equal(['https://c.org'])
  })

  it('sorts newest first and prefers current Citizen names', () => {
    const sorted = sortEntries([archived, onchain])
    expect(sorted.map((e) => e.key)).to.deep.equal(['chain:3', 'archive:20263-abc'])
    const named = withCitizenNames(sorted, new Map([[WALLET, { name: 'Ada Lovelace' } as any]]))
    expect(named.map((e) => e.name)).to.deep.equal([onchain.name, 'Ada Lovelace'])
  })

  it('gives the feed an ID only for onchain rows', () => {
    expect(entryToFeedContribution(onchain).id).to.equal(3)
    const feed = entryToFeedContribution(archived)
    expect(feed.id).to.equal(undefined)
    expect(feed.area).to.equal('Community Growth & Engagement')
    expect(feed.timestamp).to.equal(new Date(1790000000 * 1000).toISOString())
  })
})

describe('senate export', () => {
  it('accepts a cycle ID or a report slug', () => {
    expect(parseCycleParam('20264')).to.equal(20264)
    expect(parseCycleParam('2026-Q4')).to.equal(20264)
    expect(parseCycleParam('20265')).to.equal(null)
    expect(parseCycleParam(undefined)).to.equal(null)
  })

  it('writes one escaped row per contribution and defuses formulas', () => {
    const entry: ContributionEntry = {
      ...archiveRecordToEntry(record)!,
      title: '=HYPERLINK("x")',
      description: 'line one\nline "two"',
    }
    const [header, row] = contributionsCsv([entry]).split('\r\n')
    expect(header).to.equal('Timestamp,Name,Wallet Address,Area,Title,Description,Links,Source,Key')
    expect(row).to.include(`"'=HYPERLINK(""x"")"`)
    expect(contributionsCsv([entry])).to.include('"line one\nline ""two"""')
  })
})
