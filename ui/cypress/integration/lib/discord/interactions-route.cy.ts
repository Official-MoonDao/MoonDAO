import { createPrivateKey, sign } from 'crypto'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import type { NextApiRequest, NextApiResponse } from 'next'
import { config, handleDiscordInteraction } from '@/lib/discord/handleInteraction'

const PUB =
  '0789180d246b75b64535056c4edb41127d3e8842b4df964f9105e3d9f55bbb82'
const PKCS8 =
  '302e020100300506032b6570042204200492a78c01e23781387561b12145b41b4cdb7c753c9bde85a8ec2e36fe938ed0'

function signBody(timestamp: string, body: string): string {
  const key = createPrivateKey({
    key: Buffer.from(PKCS8, 'hex'),
    format: 'der',
    type: 'pkcs8',
  })
  return sign(null, Buffer.from(timestamp + body), key).toString('hex')
}

function mockReq(opts: {
  method?: string
  headers?: Record<string, string>
  raw?: string
}): NextApiRequest {
  const req = Readable.from([opts.raw ?? '']) as any
  req.method = opts.method ?? 'POST'
  req.headers = opts.headers ?? {}
  return req
}

function mockRes(): NextApiResponse & { statusCode: number; body: any } {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(body: any) {
      this.body = body
      return this
    },
    end() {
      return this
    },
  }
  return res
}

describe('discord interactions route', () => {
  const prevKey = process.env.DISCORD_PUBLIC_KEY

  afterEach(() => {
    process.env.DISCORD_PUBLIC_KEY = prevKey
  })

  it('exports bodyParser false', () => {
    expect(config.api.bodyParser).to.equal(false)
    const page = fs.readFileSync(
      path.resolve(__dirname, '../../../../pages/api/discord/interactions.ts'),
      'utf8'
    )
    expect(page).to.match(/bodyParser:\s*false|interactionsConfig/)
  })

  it('unsigned POST returns 401 and does not read the market', async () => {
    process.env.DISCORD_PUBLIC_KEY = PUB
    let called = false
    const res = mockRes()
    await handleDiscordInteraction(
      mockReq({
        raw: JSON.stringify({
          type: 2,
          data: { name: 'odds', options: [{ name: 'prize', value: '22' }] },
        }),
      }),
      res,
      {
        readMarket: async () => {
          called = true
          return null as any
        },
      }
    )
    expect(res.statusCode).to.equal(401)
    expect(called).to.equal(false)
  })

  it('throttled guild gets 200 ephemeral, never 429', async () => {
    process.env.DISCORD_PUBLIC_KEY = PUB
    const timestamp = '1700000000'
    const raw = JSON.stringify({
      type: 2,
      guild_id: '99',
      data: { name: 'odds', options: [{ name: 'prize', value: '22' }] },
    })
    const res = mockRes()
    await handleDiscordInteraction(
      mockReq({
        headers: {
          'x-signature-ed25519': signBody(timestamp, raw),
          'x-signature-timestamp': timestamp,
        },
        raw,
      }),
      res,
      {
        nowMs: () => 1_700_000_000_000,
        redis: { incr: async () => 31, expire: async () => 1 } as any,
        readMarket: async () => {
          throw new Error('should not read when throttled')
        },
      }
    )
    expect(res.statusCode).to.equal(200)
    expect(res.body?.data?.flags).to.equal(64)
    expect(res.body?.data?.content).to.include('busy')
  })
})
