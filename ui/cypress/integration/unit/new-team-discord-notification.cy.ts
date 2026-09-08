import {
  buildNewTeamBody,
  buildNewTeamContent,
  buildNewTeamPayload,
  teamImageFilename,
  teamProfileUrl,
} from '@/lib/discord/newTeamNotification'

describe('new team Discord announcement', () => {
  const profileUrl = teamProfileUrl('https://moondao.com', 'zephalto')

  const content = buildNewTeamContent({
    teamName: 'Zephalto',
    profileUrl,
    citizenRoleId: '123456789',
  })

  it('still pings the Citizen role and links the team profile', () => {
    expect(content).to.include('<@&123456789>')
    expect(content).to.include('Zephalto')
    expect(content).to.include('https://moondao.com/team/zephalto')
    expect(content).to.include('has created a team')
  })

  it('suppresses the crawled link preview so ours is the only embed', () => {
    // Without the angle brackets Discord adds its own preview of the team page,
    // which 404s until Tableland indexes and is why announcements arrived with
    // no image — or never arrived, when the client never reached the Discord call.
    expect(content).to.include('](<https://moondao.com/team/zephalto>)')
  })

  it('does not use the old cache-busting timestamp query', () => {
    expect(content).to.not.include('_timestamp=')
  })

  it('points the embed image at the uploaded file rather than a gateway URL', () => {
    const imageFilename = teamImageFilename(25, 'image/png')
    const payload = buildNewTeamPayload({ content, profileUrl, imageFilename })

    expect(payload.embeds[0].image.url).to.equal('attachment://team-25.png')
    expect(payload.attachments).to.deep.equal([{ id: 0, filename: 'team-25.png' }])
    expect(JSON.stringify(payload)).to.not.include('ipfs')
  })

  it('names the upload after the real content type', () => {
    expect(teamImageFilename(1, 'image/jpeg')).to.equal('team-1.jpg')
    expect(teamImageFilename(2, 'image/webp')).to.equal('team-2.webp')
    expect(teamImageFilename(3, 'image/png; charset=binary')).to.equal('team-3.png')
    expect(teamImageFilename(4, undefined)).to.equal('team-4.png')
  })

  it('only lets the role mention ping', () => {
    const payload = buildNewTeamPayload({ content, profileUrl })
    expect(payload.allowed_mentions).to.deep.equal({ parse: ['roles'] })
  })

  it('truncates a long bio instead of letting Discord reject the embed', () => {
    const payload = buildNewTeamPayload({
      content,
      profileUrl,
      description: 'a'.repeat(5000),
    })
    expect(payload.embeds[0].description.length).to.be.at.most(303)
  })

  it('omits the embed entirely when there is nothing to put in it', () => {
    const payload = buildNewTeamPayload({ content, profileUrl })
    expect(payload.embeds).to.equal(undefined)
    expect(payload.content).to.equal(content)
  })

  it('uploads the logo bytes as multipart form data', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
    const imageFilename = teamImageFilename(25, 'image/png')
    const payload = buildNewTeamPayload({ content, profileUrl, imageFilename })

    const { headers, body } = buildNewTeamBody(payload, imageFilename, {
      bytes,
      contentType: 'image/png',
    })

    expect(headers).to.deep.equal({})

    const form = body as FormData
    expect(JSON.parse(form.get('payload_json') as string).embeds[0].image.url).to.equal(
      'attachment://team-25.png'
    )

    const file = form.get('files[0]') as File
    expect(file.name).to.equal('team-25.png')
    expect(file.type).to.equal('image/png')
    expect(file.size).to.equal(bytes.byteLength)
    expect(new Uint8Array(await file.arrayBuffer())).to.deep.equal(bytes)
  })

  it('sends plain JSON when the logo could not be downloaded', () => {
    const payload = buildNewTeamPayload({ content, profileUrl, description: 'Hi' })
    const { headers, body } = buildNewTeamBody(payload)

    expect(headers).to.deep.equal({ 'Content-Type': 'application/json' })
    expect(JSON.parse(body as string).content).to.equal(content)
  })
})
