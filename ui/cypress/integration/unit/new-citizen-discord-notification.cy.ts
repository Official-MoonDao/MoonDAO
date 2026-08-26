import fs from 'fs'
import path from 'path'
import { IPFS_GATEWAY } from 'const/config'
import {
  buildNewCitizenBody,
  buildNewCitizenContent,
  buildNewCitizenPayload,
  citizenImageFilename,
  citizenProfileUrl,
} from '@/lib/discord/newCitizenNotification'
import { normalizeOgImageUrl } from '@/lib/utils/ogImage'

const CITIZEN_IMAGE = 'ipfs://QmXTjuQwz5ugubDfkmWtRdwj8vg3KSXMCYAsya1avA2eQR'

describe('citizen profile og:image', () => {
  it('resolves ipfs:// portraits to the gateway that serves MoonDAO pins', () => {
    expect(normalizeOgImageUrl(CITIZEN_IMAGE)).to.equal(
      `${IPFS_GATEWAY}QmXTjuQwz5ugubDfkmWtRdwj8vg3KSXMCYAsya1avA2eQR`
    )
  })

  it('never points a portrait at ipfs.io, which 504s on MoonDAO CIDs', () => {
    // The profile page used to build `https://ipfs.io/ipfs/<cid>` itself, which
    // arrived here looking like an already-resolved URL and was passed through.
    expect(normalizeOgImageUrl(CITIZEN_IMAGE)).to.not.include('ipfs.io')
  })

  it('falls back to an absolute URL on our own origin when there is no portrait', () => {
    for (const missing of [undefined, '']) {
      const url = normalizeOgImageUrl(missing)
      expect(url).to.match(/^https?:\/\//)
      expect(url).to.not.include('ipfs.io')
      expect(url).to.include('/metadata-image.png')
    }
  })

  it('does not throw when the portrait is missing', () => {
    expect(() => normalizeOgImageUrl(undefined)).to.not.throw()
  })

  it('leaves non-IPFS absolute URLs alone', () => {
    expect(normalizeOgImageUrl('https://example.com/a.png')).to.equal(
      'https://example.com/a.png'
    )
  })
})

describe('citizen profile page metadata', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../../../pages/citizen/[tokenIdOrName].tsx'),
    'utf8'
  )

  // This is the defect that kept coming back: normalizeOgImageUrl already routed
  // ipfs:// to the working gateway, but the page pre-built an ipfs.io URL, which
  // reached the helper looking like an already-resolved https URL and was passed
  // straight through to Discord.
  it('does not hardcode a public IPFS gateway for the portrait', () => {
    expect(source).to.not.include('ipfs.io')
  })

  it('hands the raw metadata image to Head so it gets normalized', () => {
    expect(source).to.include('image={nft?.metadata?.image}')
  })

  it('does not split the portrait URI, which threw when there was no portrait', () => {
    expect(source).to.not.include("image.split('ipfs://')")
  })
})

describe('new citizen Discord announcement', () => {
  const profileUrl = citizenProfileUrl('https://moondao.com', 'spaceman-sam-241')

  const content = buildNewCitizenContent({
    citizenName: 'Spaceman Sam',
    profileUrl,
    citizenRoleId: '123456789',
  })

  it('still pings the Citizen role and links the profile', () => {
    expect(content).to.include('<@&123456789>')
    expect(content).to.include('Spaceman Sam')
    expect(content).to.include('https://moondao.com/citizen/spaceman-sam-241')
  })

  it('suppresses the crawled link preview so ours is the only embed', () => {
    // Without the angle brackets Discord adds its own preview, which is the one
    // that kept showing up with no image.
    expect(content).to.include('](<https://moondao.com/citizen/spaceman-sam-241>)')
  })

  it('points the embed image at the uploaded file rather than a gateway URL', () => {
    const imageFilename = citizenImageFilename(241, 'image/png')
    const payload = buildNewCitizenPayload({ content, profileUrl, imageFilename })

    expect(payload.embeds[0].image.url).to.equal('attachment://citizen-241.png')
    expect(payload.attachments).to.deep.equal([{ id: 0, filename: 'citizen-241.png' }])
    expect(JSON.stringify(payload)).to.not.include('ipfs')
  })

  it('names the upload after the real content type', () => {
    expect(citizenImageFilename(1, 'image/jpeg')).to.equal('citizen-1.jpg')
    expect(citizenImageFilename(2, 'image/webp')).to.equal('citizen-2.webp')
    expect(citizenImageFilename(3, 'image/png; charset=binary')).to.equal('citizen-3.png')
    expect(citizenImageFilename(4, undefined)).to.equal('citizen-4.png')
  })

  it('only lets the role mention ping', () => {
    const payload = buildNewCitizenPayload({ content, profileUrl })
    expect(payload.allowed_mentions).to.deep.equal({ parse: ['roles'] })
  })

  it('truncates a long bio instead of letting Discord reject the embed', () => {
    const payload = buildNewCitizenPayload({
      content,
      profileUrl,
      description: 'a'.repeat(5000),
    })
    expect(payload.embeds[0].description.length).to.be.at.most(303)
  })

  it('omits the embed entirely when there is nothing to put in it', () => {
    const payload = buildNewCitizenPayload({ content, profileUrl })
    expect(payload.embeds).to.equal(undefined)
    expect(payload.content).to.equal(content)
  })

  it('uploads the portrait bytes as multipart form data', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
    const imageFilename = citizenImageFilename(241, 'image/png')
    const payload = buildNewCitizenPayload({ content, profileUrl, imageFilename })

    const { headers, body } = buildNewCitizenBody(payload, imageFilename, {
      bytes,
      contentType: 'image/png',
    })

    // fetch has to derive the multipart boundary itself, so we must not set it.
    expect(headers).to.deep.equal({})

    const form = body as FormData
    expect(JSON.parse(form.get('payload_json') as string).embeds[0].image.url).to.equal(
      'attachment://citizen-241.png'
    )

    const file = form.get('files[0]') as File
    expect(file.name).to.equal('citizen-241.png')
    expect(file.type).to.equal('image/png')
    expect(file.size).to.equal(bytes.byteLength)
    expect(new Uint8Array(await file.arrayBuffer())).to.deep.equal(bytes)
  })

  it('sends plain JSON when the portrait could not be downloaded', () => {
    const payload = buildNewCitizenPayload({ content, profileUrl, description: 'Hi' })
    const { headers, body } = buildNewCitizenBody(payload)

    expect(headers).to.deep.equal({ 'Content-Type': 'application/json' })
    expect(JSON.parse(body as string).content).to.equal(content)
  })
})
