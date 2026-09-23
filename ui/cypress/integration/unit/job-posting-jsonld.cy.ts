import { buildJobPostingJsonLd, serializeJsonLd } from '@/lib/jobs/jobPostingJsonLd'

describe('serializeJsonLd', () => {
  it('escapes </script> so author text cannot break out of the JSON-LD tag', () => {
    const jsonLd = buildJobPostingJsonLd({
      job: {
        id: 1,
        title: 'Engineer</script><script>alert(document.cookie)</script>',
        description: 'A great role',
        teamId: 1,
        timestamp: 1_700_000_000,
        endTime: 0,
      } as any,
      envelope: { v: 1 },
      doc: null,
      teamName: 'MoonDAO',
    })

    const serialized = serializeJsonLd(jsonLd)

    // No raw markup that could close the surrounding <script> tag.
    expect(serialized).to.not.include('</script>')
    expect(serialized).to.not.include('<script')
    expect(serialized).to.not.include('<')
    expect(serialized).to.not.include('>')

    // Still valid JSON that decodes back to the original, escaped payload.
    const parsed = JSON.parse(serialized)
    expect(parsed.title).to.equal(
      'Engineer</script><script>alert(document.cookie)</script>'
    )
    expect(parsed['@type']).to.equal('JobPosting')
  })

  it('does not publish an apply URL in public JobPosting markup', () => {
    const jsonLd = buildJobPostingJsonLd({
      job: {
        id: 22,
        title: 'Social Media Manager',
        description: 'Own the X account',
        teamId: 1,
        timestamp: 1_700_000_000,
        endTime: 0,
        contactInfo: 'https://airtable.com/apply',
      } as any,
      envelope: { v: 1 },
      doc: { v: 1, applyUrl: 'https://airtable.com/apply', summary: 'Own the X account' },
      teamName: 'MoonDAO',
    })

    const serialized = serializeJsonLd(jsonLd)
    expect(serialized).to.not.include('airtable.com')
    expect(jsonLd.directApply).to.equal(false)
    expect(String(jsonLd.url)).to.match(/\/jobs\/22$/)
  })

  it('escapes ampersands and unicode line separators', () => {
    const serialized = serializeJsonLd({ a: 'x & y', b: 'line\u2028sep\u2029here' })
    expect(serialized).to.not.include('&')
    expect(serialized).to.include('\\u0026')
    expect(serialized).to.include('\\u2028')
    expect(serialized).to.include('\\u2029')
    const parsed = JSON.parse(serialized)
    expect(parsed.a).to.equal('x & y')
    expect(parsed.b).to.equal('line\u2028sep\u2029here')
  })
})
