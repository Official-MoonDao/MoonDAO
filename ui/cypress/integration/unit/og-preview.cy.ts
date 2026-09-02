import { DEPLOYED_ORIGIN } from 'const/config'
import {
  buildJobOgImageUrl,
  buildListingOgImageUrl,
  clip,
  extractIpfsCid,
  jobDiscordEmbed,
  jobOgFieldsFrom,
  listingDiscordEmbed,
  listingOgFieldsFrom,
  parseJobOgParams,
  parseListingOgParams,
  sanitizeDiscordEmbeds,
} from '@/lib/og/preview'
import { escapeXml, renderOgSvg, wrapText } from '@/lib/og/svg'

describe('clip', () => {
  it('collapses whitespace and ellipsizes long strings', () => {
    expect(clip('  hello   world  ', 20)).to.equal('hello world')
    expect(clip('abcdefghij', 6)).to.equal('abcde…')
    expect(clip('', 10)).to.equal('')
    expect(clip(undefined, 10)).to.equal('')
  })
})

describe('extractIpfsCid', () => {
  const cidV0 = 'QmSuJQjNWDQn5Wht6d6PqUoten6DVm3cLocoHxi85G9N8T'
  const cidV1 = 'bafybeigdyrztyknmzqvbwzmp4rxzyxq5nlnlnlnlnlnlnlnlnlnlnlnlnl'

  it('accepts ipfs URIs, gateway paths, and bare CIDs', () => {
    expect(extractIpfsCid(`ipfs://${cidV0}`)).to.equal(cidV0)
    expect(extractIpfsCid(`https://ipfs.io/ipfs/${cidV0}`)).to.equal(cidV0)
    expect(extractIpfsCid(cidV0)).to.equal(cidV0)
    expect(extractIpfsCid(cidV1)).to.equal(cidV1)
  })

  it('rejects non-CID image sources so the OG route cannot be pointed at an arbitrary host', () => {
    expect(extractIpfsCid('https://evil.example/image.png')).to.equal('')
    expect(extractIpfsCid('/assets/logo.svg')).to.equal('')
    expect(extractIpfsCid('not-a-cid')).to.equal('')
    expect(extractIpfsCid('')).to.equal('')
  })
})

describe('job OG fields and URLs', () => {
  it('prefers the IPFS document facts over the envelope', () => {
    const fields = jobOgFieldsFrom({
      job: { title: 'Growth Lead', tag: 'Marketing' },
      envelope: {
        v: 1,
        location: 'On-site',
        compensation: '$1 / hour',
        commitment: 'Volunteer',
      },
      doc: {
        v: 1,
        location: { type: 'remote', region: 'Worldwide' },
        compensation: { min: 3000, max: 4500, currency: 'USD', period: 'month' },
        commitment: { type: 'part-time', hoursPerWeek: 10 },
      },
      teamName: 'MoonDAO',
    })

    expect(fields.title).to.equal('Growth Lead')
    expect(fields.team).to.equal('MoonDAO')
    expect(fields.tag).to.equal('Marketing')
    expect(fields.location).to.equal('Remote · Worldwide')
    expect(fields.compensation).to.equal('$3,000–$4,500 / month')
    expect(fields.commitment).to.equal('Part-time · ≤10 hrs/week')
  })

  it('falls back to envelope strings when the document is missing', () => {
    const fields = jobOgFieldsFrom({
      job: { title: 'Engineer' },
      envelope: { v: 1, location: 'Remote', compensation: '$80k / year' },
    })
    expect(fields.location).to.equal('Remote')
    expect(fields.compensation).to.equal('$80k / year')
  })

  it('builds a same-origin OG image URL from clipped params', () => {
    const url = buildJobOgImageUrl({
      title: 'Software Engineer',
      team: 'MoonDAO',
      location: 'Remote',
      compensation: '$80,000 / year',
      commitment: 'Full-time',
      tag: 'Engineering',
    })

    expect(url.startsWith(`${DEPLOYED_ORIGIN}/api/og/job?`)).to.equal(true)
    const parsed = parseJobOgParams(new URL(url).searchParams)
    expect(parsed.title).to.equal('Software Engineer')
    expect(parsed.team).to.equal('MoonDAO')
    expect(parsed.location).to.equal('Remote')
    expect(parsed.compensation).to.equal('$80,000 / year')
    expect(parsed.commitment).to.equal('Full-time')
    expect(parsed.tag).to.equal('Engineering')
  })

  it('uses a default title when the query string is empty', () => {
    expect(parseJobOgParams(new URLSearchParams()).title).to.equal('Open Role')
  })
})

describe('listing OG fields and URLs', () => {
  const listing = {
    id: 7,
    teamId: 3,
    teamName: 'LifeShip',
    title: 'Lunar Payload Slot',
    description: 'A slot on the next lander.',
    image: 'ipfs://QmSuJQjNWDQn5Wht6d6PqUoten6DVm3cLocoHxi85G9N8T',
    price: '1000',
    currency: 'USDC',
    startTime: 0,
    endTime: 0,
    timestamp: 1_800_000_000,
    metadata: '',
    shipping: 'false',
    tag: '',
  }

  it('quotes the citizen price and keeps only the CID', () => {
    const fields = listingOgFieldsFrom(listing)
    expect(fields.title).to.equal('Lunar Payload Slot')
    expect(fields.team).to.equal('LifeShip')
    expect(fields.price).to.equal('1,000 USDC')
    expect(fields.image).to.equal('ipfs://QmSuJQjNWDQn5Wht6d6PqUoten6DVm3cLocoHxi85G9N8T')

    const url = buildListingOgImageUrl(fields)
    expect(url.startsWith(`${DEPLOYED_ORIGIN}/api/og/listing?`)).to.equal(true)
    const parsed = parseListingOgParams(new URL(url).searchParams)
    expect(parsed.title).to.equal('Lunar Payload Slot')
    expect(parsed.price).to.equal('1,000 USDC')
    expect(parsed.image).to.equal('QmSuJQjNWDQn5Wht6d6PqUoten6DVm3cLocoHxi85G9N8T')
  })

  it('drops a non-CID image so the OG route will not fetch it', () => {
    const parsed = parseListingOgParams(
      new URLSearchParams({ title: 'Hat', image: 'https://evil.example/x.png' })
    )
    expect(parsed.image).to.equal('')
  })
})

describe('Discord embeds', () => {
  it('attaches the generated job preview image', () => {
    const fields = { title: 'Engineer', team: 'MoonDAO', location: 'Remote' }
    const embed = jobDiscordEmbed({
      fields,
      summary: "Help us build the internet's space program.",
      url: 'https://moondao.com/jobs/1',
      teamName: 'MoonDAO',
    })
    expect(embed.title).to.equal('Engineer')
    expect(embed.url).to.equal('https://moondao.com/jobs/1')
    expect(embed.image?.url.startsWith(`${DEPLOYED_ORIGIN}/api/og/job?`)).to.equal(true)
    expect(embed.footer?.text).to.equal('MoonDAO Jobs')
    expect(embed.author?.name).to.equal('MoonDAO')
  })

  it('attaches the generated listing preview image', () => {
    const fields = { title: 'Hat', team: 'LifeShip', price: '20 USDC' }
    const embed = listingDiscordEmbed({
      fields,
      summary: 'A very good hat.',
      url: 'https://moondao.com/marketplace/7',
      teamName: 'LifeShip',
    })
    expect(embed.image?.url.startsWith(`${DEPLOYED_ORIGIN}/api/og/listing?`)).to.equal(true)
    expect(embed.footer?.text).to.equal('MoonDAO Marketplace')
    expect(embed.author?.name).to.equal('LifeShip')
  })

  it('sanitizes embeds and drops arbitrary hosts', () => {
    const cleaned = sanitizeDiscordEmbeds([
      {
        title: 'Safe',
        url: 'https://moondao.com/jobs/1',
        image: { url: 'https://moondao.com/api/og/job?title=Safe' },
        extra: { nested: true },
      },
      {
        title: 'Unsafe',
        url: 'javascript:alert(1)',
        image: { url: 'http://evil.example/x.png' },
      },
    ])

    expect(cleaned).to.have.length(2)
    expect(cleaned?.[0].url).to.equal('https://moondao.com/jobs/1')
    expect(cleaned?.[0].image?.url).to.equal('https://moondao.com/api/og/job?title=Safe')
    expect((cleaned?.[0] as any).extra).to.equal(undefined)
    expect(cleaned?.[1].url).to.equal(undefined)
    expect(cleaned?.[1].image).to.equal(undefined)
  })
})

describe('OG SVG card', () => {
  it('escapes markup so a title cannot break out of the SVG', () => {
    expect(escapeXml(`Engineer</text><script>alert(1)</script>`)).to.equal(
      'Engineer&lt;/text&gt;&lt;script&gt;alert(1)&lt;/script&gt;'
    )
    const svg = renderOgSvg({
      eyebrow: 'MoonDAO  ·  Jobs',
      title: 'Engineer</text><script>alert(1)</script>',
      footer: 'moondao.com/jobs',
    })
    expect(svg).to.include('Engineer&lt;/text&gt;')
    expect(svg).to.not.include('</text><script>')
  })

  it('wraps a long title onto a second line', () => {
    expect(wrapText('Senior Full Stack Engineer for Lunar Missions', 22, 2)).to.have.length(2)
  })

  it('includes the title, chips and footer', () => {
    const svg = renderOgSvg({
      eyebrow: 'MoonDAO  ·  Jobs',
      title: 'Growth Lead',
      subtitle: 'MoonDAO',
      chips: ['Remote', '$3,000 / month'],
      footer: 'moondao.com/jobs',
    })
    expect(svg).to.include('Growth Lead')
    expect(svg).to.include('MoonDAO')
    expect(svg).to.include('Remote')
    expect(svg).to.include('moondao.com/jobs')
    expect(svg).to.include('width="1200"')
    expect(svg).to.include('height="630"')
  })
})
