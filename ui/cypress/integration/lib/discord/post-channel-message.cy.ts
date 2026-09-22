import { postDiscordChannelMessage } from '@/lib/discord/postChannelMessage'

const CHANNEL = '123456789012345678'

function jsonResponse(status: number, body: any, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
  } as any
}

describe('postDiscordChannelMessage', () => {
  it('sets allowed_mentions parse [] on every call', async () => {
    let captured: any
    const result = await postDiscordChannelMessage({
      channelId: CHANNEL,
      content: 'hi',
      botToken: 'token',
      fetchImpl: async (_url, init) => {
        captured = JSON.parse(String(init?.body))
        return jsonResponse(200, { id: '1' })
      },
    })
    expect(result.ok).to.equal(true)
    expect(captured.allowed_mentions).to.deep.equal({ parse: [] })
  })

  it('rejects an invalid channel id without calling fetch', async () => {
    let called = false
    const result = await postDiscordChannelMessage({
      channelId: 'undefined',
      content: 'hi',
      botToken: 'token',
      fetchImpl: async () => {
        called = true
        return jsonResponse(200, { id: '1' })
      },
    })
    expect(result.ok).to.equal(false)
    if (!result.ok) expect(result.retryable).to.equal(false)
    expect(called).to.equal(false)
  })

  it('retries a 429 with Retry-After 1 exactly once', async () => {
    let calls = 0
    const result = await postDiscordChannelMessage({
      channelId: CHANNEL,
      content: 'hi',
      botToken: 'token',
      sleep: async () => undefined,
      fetchImpl: async () => {
        calls += 1
        if (calls === 1) {
          return jsonResponse(429, { retry_after: 1 }, { 'retry-after': '1' })
        }
        return jsonResponse(200, { id: '9' })
      },
    })
    expect(calls).to.equal(2)
    expect(result.ok).to.equal(true)
  })

  it('does not sleep-retry a 429 with Retry-After 30', async () => {
    let calls = 0
    let slept = false
    const result = await postDiscordChannelMessage({
      channelId: CHANNEL,
      content: 'hi',
      botToken: 'token',
      sleep: async () => {
        slept = true
      },
      fetchImpl: async () => {
        calls += 1
        return jsonResponse(429, {}, { 'retry-after': '30' })
      },
    })
    expect(calls).to.equal(1)
    expect(slept).to.equal(false)
    expect(result.ok).to.equal(false)
    if (!result.ok) expect(result.retryable).to.equal(true)
  })

  it('marks 403 as not retryable', async () => {
    const result = await postDiscordChannelMessage({
      channelId: CHANNEL,
      content: 'hi',
      botToken: 'token',
      fetchImpl: async () => jsonResponse(403, { code: 50013 }),
    })
    expect(result.ok).to.equal(false)
    if (!result.ok) expect(result.retryable).to.equal(false)
  })
})
