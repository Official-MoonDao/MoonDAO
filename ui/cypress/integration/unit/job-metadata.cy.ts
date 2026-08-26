import {
  MAX_METADATA_BYTES,
  buildJobMetadata,
  formatCommitment,
  formatCompensation,
  formatDeadlineCountdown,
  formatLocation,
  getApplicationDeadline,
  normalizeJobPostingDoc,
  parseJobMetadata,
  serializeJobMetadata,
} from '@/lib/jobs/jobMetadata'

const DAY = 86400

describe('parseJobMetadata', () => {
  it('treats an empty column as no metadata', () => {
    expect(parseJobMetadata('')).to.deep.equal({ v: 0 })
    expect(parseJobMetadata(undefined)).to.deep.equal({ v: 0 })
    expect(parseJobMetadata(null)).to.deep.equal({ v: 0 })
  })

  it('degrades instead of throwing on malformed JSON', () => {
    expect(parseJobMetadata('{not json')).to.deep.equal({ v: 0 })
    expect(parseJobMetadata('"a string"')).to.deep.equal({ v: 0 })
  })

  it('accepts an already-parsed object from Tableland', () => {
    const parsed = parseJobMetadata({
      v: 1,
      cid: 'Qmb4SknAG3eNGxQmKbUiJ4RVSRA7qdWuW53nb4XTuNmpWd',
      deadline: 1791342000,
    })
    expect(parsed.cid).to.equal('Qmb4SknAG3eNGxQmKbUiJ4RVSRA7qdWuW53nb4XTuNmpWd')
    expect(parsed.deadline).to.equal(1791342000)
    expect(parsed.v).to.equal(1)
  })

  it('still reads the legacy { compensation, location } shape', () => {
    const parsed = parseJobMetadata(
      JSON.stringify({ compensation: '$2,000 / month', location: 'Remote' }),
    )
    expect(parsed.compensation).to.equal('$2,000 / month')
    expect(parsed.location).to.equal('Remote')
  })

  it('round-trips a v1 envelope', () => {
    const envelope = {
      v: 1,
      cid: 'bafytestcid',
      compensation: '$3,000–$4,500 / month',
      location: 'Remote · Worldwide',
      locationType: 'remote' as const,
      commitment: 'Part-time · ≤10 hrs/week',
      commitmentType: 'part-time' as const,
      hoursPerWeek: 10,
      level: 'Senior',
      deadline: 1800000000,
      paid: true,
      skills: ['X growth', 'Instagram'],
    }
    expect(parseJobMetadata(serializeJobMetadata(envelope))).to.deep.equal(envelope)
  })

  it('drops enum values it does not recognize', () => {
    const parsed = parseJobMetadata(
      JSON.stringify({ v: 1, commitmentType: 'indentured', locationType: 'lunar' }),
    )
    expect(parsed.commitmentType).to.equal(undefined)
    expect(parsed.locationType).to.equal(undefined)
  })
})

describe('serializeJobMetadata', () => {
  it('stays inside the 1024-byte column budget', () => {
    const serialized = serializeJobMetadata({
      v: 1,
      cid: 'bafybeigdyrztyknmzqvbwzmp4rxzyxq5nlnlnlnlnlnlnlnlnlnlnlnlnl',
      compensation: 'x'.repeat(300),
      location: 'y'.repeat(300),
      commitment: 'z'.repeat(300),
      level: 'w'.repeat(300),
      skills: Array.from({ length: 8 }, () => 's'.repeat(100)),
    })
    expect(new TextEncoder().encode(serialized).length).to.be.at.most(MAX_METADATA_BYTES)
  })

  it('never sheds the IPFS pointer', () => {
    const serialized = serializeJobMetadata({
      v: 1,
      cid: 'bafytestcid',
      compensation: 'x'.repeat(2000),
    })
    expect(JSON.parse(serialized).cid).to.equal('bafytestcid')
  })

  it('omits empty fields', () => {
    const serialized = serializeJobMetadata({ v: 1, compensation: '', skills: [] })
    expect(serialized).to.equal('{"v":1}')
  })
})

describe('formatters', () => {
  it('formats a compensation range', () => {
    expect(formatCompensation({ min: 3000, max: 4500, currency: 'USD', period: 'month' })).to.equal(
      '$3,000–$4,500 / month',
    )
  })

  it('formats a single compensation figure', () => {
    expect(formatCompensation({ min: 100, currency: 'USD', period: 'hour' })).to.equal(
      '$100 / hour',
    )
  })

  it('prefers an author-written display string', () => {
    expect(formatCompensation({ min: 1, max: 2, display: 'Bounty, negotiable' })).to.equal(
      'Bounty, negotiable',
    )
  })

  it('returns undefined when there is nothing to show', () => {
    expect(formatCompensation({})).to.equal(undefined)
    expect(formatCompensation(undefined)).to.equal(undefined)
  })

  it('formats location and commitment summaries', () => {
    expect(formatLocation({ type: 'remote', region: 'Worldwide' })).to.equal('Remote · Worldwide')
    expect(formatCommitment({ type: 'part-time', hoursPerWeek: 10 })).to.equal(
      'Part-time · ≤10 hrs/week',
    )
  })
})

describe('buildJobMetadata', () => {
  it('derives the envelope from a posting document', () => {
    const envelope = buildJobMetadata(
      {
        v: 1,
        compensation: { min: 3000, max: 4500, currency: 'USD', period: 'month' },
        location: { type: 'remote', region: 'Worldwide' },
        commitment: { type: 'part-time', hoursPerWeek: 10 },
        level: 'Senior',
        applicationDeadline: 1800000000,
        skills: ['X growth'],
      },
      'bafytestcid',
    )

    expect(envelope).to.deep.equal({
      v: 1,
      cid: 'bafytestcid',
      compensation: '$3,000–$4,500 / month',
      location: 'Remote · Worldwide',
      locationType: 'remote',
      commitment: 'Part-time · ≤10 hrs/week',
      commitmentType: 'part-time',
      hoursPerWeek: 10,
      level: 'Senior',
      deadline: 1800000000,
      paid: true,
      skills: ['X growth'],
    })
  })
})

describe('normalizeJobPostingDoc', () => {
  it('returns null when there is no content', () => {
    expect(normalizeJobPostingDoc({})).to.equal(null)
    expect(normalizeJobPostingDoc({ v: 1, body: '   ', requirements: [] })).to.equal(null)
    expect(normalizeJobPostingDoc('nope')).to.equal(null)
  })

  it('keeps real content and discards junk entries', () => {
    const doc = normalizeJobPostingDoc({
      body: '## Role\n\nDetails',
      requirements: ['Proven growth', '', 42, '  Crypto fluency  '],
      hiringProcess: [{ label: 'Interview', detail: '30 minutes' }, { detail: 'no label' }],
      links: [{ url: 'https://moondao.com' }, { label: 'Broken' }],
    })

    expect(doc?.requirements).to.deep.equal(['Proven growth', 'Crypto fluency'])
    expect(doc?.hiringProcess).to.deep.equal([{ label: 'Interview', detail: '30 minutes' }])
    expect(doc?.links).to.deep.equal([{ label: 'https://moondao.com', url: 'https://moondao.com' }])
  })
})

describe('getApplicationDeadline', () => {
  it('prefers an explicit deadline over the listing expiry', () => {
    expect(getApplicationDeadline({ v: 1, deadline: 100 }, 200)).to.equal(100)
  })

  it('falls back to the listing expiry', () => {
    expect(getApplicationDeadline({ v: 1 }, 200)).to.equal(200)
  })

  it('treats a zero expiry as never closing', () => {
    expect(getApplicationDeadline({ v: 1 }, 0)).to.equal(undefined)
    expect(getApplicationDeadline({ v: 1 })).to.equal(undefined)
  })
})

describe('formatDeadlineCountdown', () => {
  const now = 1_800_000_000

  it('counts down to the deadline', () => {
    expect(formatDeadlineCountdown(now + 12 * DAY, now)).to.equal('Closes in 12 days')
    expect(formatDeadlineCountdown(now + DAY, now)).to.equal('Closes tomorrow')
    expect(formatDeadlineCountdown(now + 60, now)).to.equal('Closes today')
    expect(formatDeadlineCountdown(now - DAY, now)).to.equal('Closed')
  })

  it('says nothing when there is no deadline', () => {
    expect(formatDeadlineCountdown(undefined, now)).to.equal(null)
    expect(formatDeadlineCountdown(0, now)).to.equal(null)
  })
})
