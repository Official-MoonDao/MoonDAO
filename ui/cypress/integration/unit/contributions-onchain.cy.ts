import {
  AREA_MAX_BYTES,
  CONTRIBUTION_AREAS,
  areaCode,
  DESCRIPTION_MAX_BYTES,
  TITLE_MAX_BYTES,
  contributionsTable,
  cycleLabel,
  decodeLinks,
  encodeLinks,
  isSubmittedOrigin,
  normalizeLink,
  splitTextLinks,
  utf8Bytes,
  validateContribution,
} from '@/lib/contributions/onchain'

const valid = {
  title: 'Ran the onboarding call',
  description: 'Hosted the October call for new Citizens.',
  area: 'community',
  links: [''],
}

describe('onchain contribution fields', () => {
  it('accepts a minimal entry with no links', () => {
    const { errors, links } = validateContribution(valid)
    expect(errors).to.deep.equal({})
    expect(links).to.deep.equal([])
  })

  it('requires a title, an area and a description', () => {
    const { errors } = validateContribution({ title: ' ', description: '', area: '', links: [] })
    expect(Object.keys(errors).sort()).to.deep.equal(['area', 'description', 'title'])
  })

  it('matches the contract description cap of 8,000 bytes', () => {
    expect(DESCRIPTION_MAX_BYTES).to.equal(8000)
  })

  it('counts bytes, not characters, like the contract', () => {
    expect(utf8Bytes('é')).to.equal(2)
    const atMax = 'a'.repeat(DESCRIPTION_MAX_BYTES)
    expect(validateContribution({ ...valid, description: atMax }).errors).to.deep.equal({})
    // One two-byte character past the cap.
    const over = 'é'.repeat(DESCRIPTION_MAX_BYTES / 2 + 1)
    expect(validateContribution({ ...valid, description: over }).errors.description).to.be.a(
      'string'
    )
    expect(
      validateContribution({ ...valid, title: 'a'.repeat(TITLE_MAX_BYTES + 1) }).errors.title
    ).to.be.a('string')
  })

  it('keeps every area code within the contract column', () => {
    for (const area of CONTRIBUTION_AREAS)
      expect(utf8Bytes(area.code)).to.be.at.most(AREA_MAX_BYTES)
    expect(validateContribution({ ...valid, area: 'made-up' }).errors.area).to.be.a('string')
  })

  it('normalizes links and rejects non-web ones', () => {
    expect(normalizeLink('example.com/post')).to.equal('https://example.com/post')
    expect(normalizeLink('javascript:alert(1)')).to.equal(null)
    expect(normalizeLink('localhost')).to.equal(null)
    const { errors, links } = validateContribution({
      ...valid,
      links: ['https://x.com/a', 'x.com/a', ' '],
    })
    expect(errors).to.deep.equal({})
    expect(links).to.deep.equal(['https://x.com/a'])
    expect(validateContribution({ ...valid, links: ['not a link'] }).errors.links).to.be.a('string')
  })

  it('round-trips links and reads plain-text imports', () => {
    const links = ['https://a.org/1', 'https://b.org/2']
    expect(decodeLinks(encodeLinks(links))).to.deep.equal(links)
    expect(encodeLinks([])).to.equal('')
    expect(decodeLinks('https://a.org/1\nhttps://b.org/2')).to.deep.equal(links)
  })

  it('maps a feed label or a stored code back to the area code', () => {
    expect(areaCode('Technical Development')).to.equal('technical')
    expect(areaCode('technical')).to.equal('technical')
    expect(areaCode('Community Growth & Engagement (e.g., events)')).to.equal('')
  })

  it('reads links the Tableland gateway already parsed into an array', () => {
    expect(decodeLinks(['https://a.org/1', 7, 'https://b.org/2'])).to.deep.equal([
      'https://a.org/1',
      'https://b.org/2',
    ])
    expect(decodeLinks(null)).to.deep.equal([])
    expect(decodeLinks({})).to.deep.equal([])
  })

  it('points Arbitrum and Sepolia at the deployed tables', () => {
    expect(contributionsTable('arbitrum')).to.deep.equal({
      address: '0xdf72dB1BB0a1aDdc6A97628513726090C6223669',
      name: 'CONTRIBUTIONS_42161_169',
    })
    expect(contributionsTable('sepolia')).to.deep.equal({
      address: '0xDa4f96E0A0a29f4e59D630440286DA41aCE27FBd',
      name: 'CONTRIBUTIONS_11155111_2094',
    })
    expect(contributionsTable('ethereum')).to.equal(null)
  })

  it('treats a missing origin as a live submission', () => {
    expect(isSubmittedOrigin(undefined)).to.equal(true)
    expect(isSubmittedOrigin(null)).to.equal(true)
    expect(isSubmittedOrigin('')).to.equal(true)
    expect(isSubmittedOrigin(0)).to.equal(true)
    expect(isSubmittedOrigin('0')).to.equal(true)
    expect(isSubmittedOrigin(1)).to.equal(false)
    expect(isSubmittedOrigin('1')).to.equal(false)
  })

  it('labels quarter-code cycles', () => {
    expect(cycleLabel(20264)).to.equal('Q4 2026')
    expect(cycleLabel('20251')).to.equal('Q1 2025')
    expect(cycleLabel(7)).to.equal('Cycle 7')
  })
})

describe('links inside descriptions', () => {
  it('turns pasted URLs into links and leaves punctuation outside', () => {
    const segments = splitTextLinks('Wrote it up (see https://a.org/x). Also www.b.org, thanks')
    expect(segments).to.deep.equal([
      { text: 'Wrote it up (see ' },
      { text: 'https://a.org/x', href: 'https://a.org/x' },
      { text: '). Also ' },
      { text: 'www.b.org', href: 'https://www.b.org/' },
      { text: ', thanks' },
    ])
  })

  it('keeps a closing paren that is part of the URL', () => {
    const [link] = splitTextLinks('https://en.wikipedia.org/wiki/Moon_(disambiguation)')
    expect(link.href).to.equal('https://en.wikipedia.org/wiki/Moon_(disambiguation)')
  })

  it('never links other schemes', () => {
    expect(splitTextLinks('javascript:alert(1) and plain text')).to.deep.equal([
      { text: 'javascript:alert(1) and plain text' },
    ])
  })
})
