/**
 * A guest's gas request carries only its Privy token. A dead Privy session
 * saved in the browser gets a 401, which used to end the prediction with a
 * generic gas error.
 */
import { canRenewForecastGuest } from '@/lib/forecasts/retainForecastWriter'
import {
  FORECAST_GAS_SESSION_EXPIRED,
  forecastGasErrorMessage,
  postForecastGas,
  requestForecastGas,
  type ForecastGasReply,
  type ForecastGasRequest,
} from '@/lib/forecasts/sponsorForecastGas'

const OLD = { address: '0x00000000000000000000000000000000000000a1' }
const NEW = { address: '0x00000000000000000000000000000000000000b2' }

function scripted(replies: ForecastGasReply[]) {
  const calls: { request: ForecastGasRequest; token: string | null }[] = []
  return {
    calls,
    post: async (request: ForecastGasRequest, token: string | null) => {
      calls.push({ request, token })
      return replies[Math.min(calls.length - 1, replies.length - 1)]
    },
  }
}

const OK: ForecastGasReply = { ok: true, status: 200, body: { sponsored: true } }
const UNAUTHORIZED: ForecastGasReply = { ok: false, status: 401, body: 'Unauthorized' }

describe('forecast gas request', () => {
  it('sends once when the server accepts the token', async () => {
    const server = scripted([OK])
    let renewed = 0
    const out = await requestForecastGas({
      writer: OLD,
      chainId: 42161,
      deprizeId: 1,
      canRenewGuest: () => true,
      getToken: async () => 'token-1',
      renewGuest: async () => {
        renewed++
        return NEW
      },
      post: server.post,
    })
    expect(out.reply.ok).to.equal(true)
    expect(out.writer).to.equal(OLD)
    expect(renewed).to.equal(0)
    expect(server.calls).to.deep.equal([
      { request: { wallet: OLD.address, chainId: 42161, deprizeId: 1 }, token: 'token-1' },
    ])
  })

  it('retries a 401 with a fresh token before touching the session', async () => {
    const server = scripted([UNAUTHORIZED, OK])
    const tokens = ['stale', 'fresh']
    let renewed = 0
    const out = await requestForecastGas({
      writer: OLD,
      chainId: 42161,
      deprizeId: 1,
      canRenewGuest: () => true,
      getToken: async () => tokens.shift() ?? null,
      renewGuest: async () => {
        renewed++
        return NEW
      },
      post: server.post,
    })
    expect(out.reply.ok).to.equal(true)
    expect(out.writer).to.equal(OLD)
    expect(renewed).to.equal(0)
    expect(server.calls.map((c) => c.token)).to.deep.equal(['stale', 'fresh'])
  })

  it('starts a fresh guest when the saved session stays dead', async () => {
    const server = scripted([UNAUTHORIZED, UNAUTHORIZED, OK])
    const out = await requestForecastGas({
      writer: OLD,
      chainId: 42161,
      deprizeId: 1,
      canRenewGuest: () => true,
      getToken: async () => null,
      renewGuest: async () => NEW,
      post: server.post,
    })
    expect(out.reply.ok).to.equal(true)
    expect(out.writer).to.equal(NEW)
    expect(server.calls.map((c) => c.request.wallet)).to.deep.equal([
      OLD.address,
      OLD.address,
      NEW.address,
    ])
  })

  it('never starts a guest for a signed-in account', async () => {
    const server = scripted([UNAUTHORIZED])
    let renewed = 0
    const out = await requestForecastGas({
      writer: OLD,
      chainId: 42161,
      deprizeId: 1,
      canRenewGuest: () => false,
      getToken: async () => 'token',
      renewGuest: async () => {
        renewed++
        return NEW
      },
      post: server.post,
    })
    expect(out.reply.status).to.equal(401)
    expect(out.writer).to.equal(OLD)
    expect(renewed).to.equal(0)
    expect(server.calls).to.have.length(2)
  })

  it('reads guest renewal after the token retry', async () => {
    const server = scripted([UNAUTHORIZED, UNAUTHORIZED])
    let renewed = 0
    let allowGuest = true
    const out = await requestForecastGas({
      writer: OLD,
      chainId: 42161,
      deprizeId: 1,
      canRenewGuest: () => allowGuest,
      getToken: async () => {
        if (server.calls.length > 0) allowGuest = false
        return 'stale'
      },
      renewGuest: async () => {
        renewed++
        return NEW
      },
      post: server.post,
    })
    expect(out.reply.status).to.equal(401)
    expect(out.writer).to.equal(OLD)
    expect(renewed).to.equal(0)
    expect(server.calls).to.have.length(2)
  })

  it('keeps the original wallet when no fresh guest can be made', async () => {
    const server = scripted([UNAUTHORIZED])
    const out = await requestForecastGas({
      writer: OLD,
      chainId: 42161,
      deprizeId: 1,
      canRenewGuest: () => true,
      getToken: async () => {
        throw new Error('no session')
      },
      renewGuest: async () => {
        throw new Error('guests off')
      },
      post: server.post,
    })
    expect(out.reply.status).to.equal(401)
    expect(out.writer).to.equal(OLD)
    expect(server.calls.map((c) => c.token)).to.deep.equal([null, null])
  })

  it('does not retry other failures', async () => {
    const capped: ForecastGasReply = {
      ok: false,
      status: 429,
      body: { message: 'Free predictions without an account are paused for today.' },
    }
    const server = scripted([capped])
    const out = await requestForecastGas({
      writer: OLD,
      chainId: 42161,
      deprizeId: 1,
      canRenewGuest: () => true,
      getToken: async () => 'token',
      renewGuest: async () => NEW,
      post: server.post,
    })
    expect(out.reply).to.equal(capped)
    expect(server.calls).to.have.length(1)
  })
})

describe('canRenewForecastGuest', () => {
  it('renews a guest and a signed-out visitor', () => {
    expect(
      canRenewForecastGuest({ account: undefined, authenticated: true, isGuest: true })
    ).to.equal(true)
    expect(
      canRenewForecastGuest({ account: undefined, authenticated: false, isGuest: false })
    ).to.equal(true)
  })

  it('refuses a signed-in account whose wallet is not attached yet', () => {
    expect(
      canRenewForecastGuest({ account: undefined, authenticated: true, isGuest: false })
    ).to.equal(false)
  })

  it('refuses when an account is already attached', () => {
    expect(
      canRenewForecastGuest({ account: { address: '0x1' }, authenticated: true, isGuest: false })
    ).to.equal(false)
    expect(
      canRenewForecastGuest({ account: { address: '0x1' }, authenticated: false, isGuest: true })
    ).to.equal(false)
  })
})

describe('forecast gas error message', () => {
  it('prefers the server message', () => {
    expect(
      forecastGasErrorMessage({ ok: false, status: 503, body: { message: 'Nope.' } })
    ).to.equal('Nope.')
  })

  it('tells the visitor to sign in after a 401 with no message', () => {
    expect(forecastGasErrorMessage(UNAUTHORIZED)).to.equal(FORECAST_GAS_SESSION_EXPIRED)
  })

  it('falls back to a retryable gas error', () => {
    expect(forecastGasErrorMessage({ ok: false, status: 504, body: {} })).to.equal(
      'Could not cover gas for this prediction. Try again.'
    )
  })
})

describe('postForecastGas', () => {
  it('attaches the bearer token and parses the reply', async () => {
    let seen: { url: string; init: RequestInit } | null = null
    const fetcher = (async (url: string, init: RequestInit) => {
      seen = { url, init }
      return new Response(JSON.stringify({ sponsored: true }), { status: 200 })
    }) as unknown as typeof fetch
    const reply = await postForecastGas(
      { wallet: OLD.address, chainId: 42161, deprizeId: 1 },
      'abc',
      fetcher
    )
    expect(reply).to.deep.equal({ ok: true, status: 200, body: { sponsored: true } })
    expect(seen!.url).to.equal('/api/deprize/sponsor-forecast-gas')
    expect((seen!.init.headers as Record<string, string>).Authorization).to.equal('Bearer abc')
  })

  it('omits the header without a token and survives a non-JSON 401', async () => {
    let headers: Record<string, string> = {}
    const fetcher = (async (_url: string, init: RequestInit) => {
      headers = init.headers as Record<string, string>
      return new Response('<html>401</html>', { status: 401 })
    }) as unknown as typeof fetch
    const reply = await postForecastGas(
      { wallet: OLD.address, chainId: 42161, deprizeId: 1 },
      null,
      fetcher
    )
    expect(reply).to.deep.equal({ ok: false, status: 401, body: {} })
    expect(headers).to.not.have.property('Authorization')
  })

  it('turns a network failure into a failed reply', async () => {
    const fetcher = (async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    const reply = await postForecastGas(
      { wallet: OLD.address, chainId: 42161, deprizeId: 1 },
      'abc',
      fetcher
    )
    expect(reply).to.deep.equal({ ok: false, status: 0, body: {} })
  })
})
