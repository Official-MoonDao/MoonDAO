import { expect } from 'chai'
import fs from 'fs'
import path from 'path'

/**
 * Source guards for the citizen profile page's og:image wiring.
 *
 * These live in a Node-only mocha script rather than the Cypress unit spec:
 * Cypress component tests run in the browser, where `fs.readFileSync` is not
 * available (that is what failed CI on the Cypress CT shard).
 */
describe('citizen profile page metadata', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../pages/citizen/[tokenIdOrName].tsx'),
    'utf8'
  )

  // This is the defect that kept coming back: normalizeOgImageUrl already routed
  // ipfs:// to the working gateway, but the page pre-built an ipfs.io URL, which
  // reached the helper looking like an already-resolved https URL and was passed
  // straight through to Discord.
  it('does not hardcode a public IPFS gateway for the portrait', () => {
    for (const gateway of [
      'https://ipfs.io/ipfs/',
      'https://dweb.link/ipfs/',
      'https://cloudflare-ipfs.com/ipfs/',
      'https://gateway.pinata.cloud/ipfs/',
    ]) {
      expect(source).to.not.include(gateway)
    }
  })

  it('hands the raw metadata image to Head so it gets normalized', () => {
    expect(source).to.include('image={nft?.metadata?.image}')
  })

  // A citizen with no portrait used to yield `https://ipfs.io/ipfs/undefined`.
  it('does not split the portrait URI into a gateway path', () => {
    expect(source).to.not.include("image.split('ipfs://')")
  })
})
