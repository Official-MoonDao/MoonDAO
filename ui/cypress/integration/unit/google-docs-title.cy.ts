import {
  cleanGoogleDocTitle,
  extractDocTitleFromHtml,
  extractTitleFromContentDisposition,
  isUsableDocTitle,
  resolveGoogleDocTitle,
} from '@/lib/google/docsTitle'

describe('isUsableDocTitle', () => {
  it('rejects empty and Untitled placeholders', () => {
    expect(isUsableDocTitle('')).to.equal(false)
    expect(isUsableDocTitle('   ')).to.equal(false)
    expect(isUsableDocTitle(undefined)).to.equal(false)
    expect(isUsableDocTitle('Untitled')).to.equal(false)
    expect(isUsableDocTitle('untitled document')).to.equal(false)
  })

  it('accepts a real document name', () => {
    expect(isUsableDocTitle('MoonDAO Project Proposal Template')).to.equal(true)
  })
})

describe('extractTitleFromContentDisposition', () => {
  it('prefers the RFC 5987 filename* with spaces preserved', () => {
    const header =
      'attachment; filename="MoonDAOProjectProposalTemplate.html"; filename*=UTF-8\'\'MoonDAO%20Project%20Proposal%20Template.html'

    expect(extractTitleFromContentDisposition(header)).to.equal('MoonDAO Project Proposal Template')
  })

  it('falls back to a quoted filename when filename* is missing', () => {
    expect(
      extractTitleFromContentDisposition('attachment; filename="LifeShip Q3 Proposal.html"')
    ).to.equal('LifeShip Q3 Proposal')
  })

  it('returns null for missing, untitled, or empty headers', () => {
    expect(extractTitleFromContentDisposition(null)).to.equal(null)
    expect(extractTitleFromContentDisposition('inline')).to.equal(null)
    expect(extractTitleFromContentDisposition('attachment; filename="Untitled.html"')).to.equal(
      null
    )
  })
})

describe('extractDocTitleFromHtml', () => {
  it('reads og:title before the tab title suffix', () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="MoonDAO Project Proposal Template">
          <title>MoonDAO Project Proposal Template - Google Docs</title>
        </head>
      </html>
    `
    expect(extractDocTitleFromHtml(html)).to.equal('MoonDAO Project Proposal Template')
  })

  it('strips the Google Docs suffix and decodes entities', () => {
    const html = '<title>Rockets &amp; Rovers - Google Docs</title>'
    expect(extractDocTitleFromHtml(html)).to.equal('Rockets & Rovers')
  })

  it('ignores export HTML that has no document title', () => {
    expect(
      extractDocTitleFromHtml(
        '<html><head><meta content="text/html; charset=UTF-8" http-equiv="content-type"></head><body></body></html>'
      )
    ).to.equal(null)
  })
})

describe('resolveGoogleDocTitle', () => {
  it('uses Content-Disposition before HTML, then preview HTML', () => {
    expect(
      resolveGoogleDocTitle({
        contentDisposition: "attachment; filename*=UTF-8''Orbital%20Greenhouse.html",
        html: '<title>Wrong Title - Google Docs</title>',
      })
    ).to.equal('Orbital Greenhouse')

    expect(
      resolveGoogleDocTitle({
        html: '<html><head></head></html>',
        previewHtml: '<meta property="og:title" content="Preview Title">',
      })
    ).to.equal('Preview Title')
  })

  it('returns an empty string when no usable title exists', () => {
    expect(
      resolveGoogleDocTitle({
        contentDisposition: 'attachment; filename="Untitled.html"',
        html: '<html><head></head></html>',
      })
    ).to.equal('')
  })
})

describe('cleanGoogleDocTitle', () => {
  it('removes Google product suffixes', () => {
    expect(cleanGoogleDocTitle('My Doc - Google Docs')).to.equal('My Doc')
    expect(cleanGoogleDocTitle('My Doc - Google Drive')).to.equal('My Doc')
  })
})
