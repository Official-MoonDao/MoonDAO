import { isFetchableUrl, isValidYouTubeUrl } from '@/lib/utils/links'

describe('isFetchableUrl', () => {
  // Background: a handful of `proposalIPFS` rows in Tableland contained
  // junk like "'" or empty strings.  Calling `fetch()` on those throws
  // `ERR_INVALID_URL` server-side, which crashed the catch logic into
  // silently dropping every affected governance proposal from the list.
  // The helper is the gate that keeps that out.

  it('accepts a normal https URL', () => {
    expect(isFetchableUrl('https://ipfs.io/ipfs/abc123')).to.be.true
  })

  it('accepts an http URL', () => {
    expect(isFetchableUrl('http://example.com/foo')).to.be.true
  })

  it('accepts an ipfs:// URI', () => {
    expect(
      isFetchableUrl('ipfs://bafybeibogusbogusbogusbogusbogusbogusbogusbogusbogu')
    ).to.be.true
  })

  it('accepts an ipns:// URI', () => {
    expect(isFetchableUrl('ipns://k51qzi5uqu5dh7yxzfqonrhuumbk7c')).to.be.true
  })

  it('rejects empty string', () => {
    expect(isFetchableUrl('')).to.be.false
  })

  it('rejects whitespace-only strings', () => {
    expect(isFetchableUrl('   ')).to.be.false
  })

  it('rejects a lone single quote (the actual Tableland value that crashed governance)', () => {
    expect(isFetchableUrl("'")).to.be.false
  })

  it('rejects a stray hash without a scheme', () => {
    expect(isFetchableUrl('bafybeibogus')).to.be.false
  })

  it('rejects null / undefined / non-strings', () => {
    expect(isFetchableUrl(null)).to.be.false
    expect(isFetchableUrl(undefined)).to.be.false
    expect(isFetchableUrl(0 as any)).to.be.false
    expect(isFetchableUrl({} as any)).to.be.false
  })

  it('rejects javascript: pseudo-URLs', () => {
    expect(isFetchableUrl('javascript:alert(1)')).to.be.false
  })
})

describe('isValidYouTubeUrl (regression — pre-existing helper still works)', () => {
  it('accepts a standard youtube watch URL', () => {
    expect(isValidYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).to.be
      .true
  })

  it('rejects a non-youtube URL', () => {
    expect(isValidYouTubeUrl('https://example.com/video')).to.be.false
  })
})
