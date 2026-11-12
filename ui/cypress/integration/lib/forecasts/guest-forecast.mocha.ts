/// <reference types="node" />

/**
 * One-tap predictions: a signed-out visitor gets a Privy guest wallet that
 * writes the forecast without a login or confirmation screen. The guest
 * stays signed out everywhere else, and every other server route refuses it.
 */
import fs from 'fs'
import path from 'path'
import { guestForecastAccount, toPrivyTransaction } from '@/lib/forecasts/guestAccount'
import {
  GUEST_HANDOFF_STORAGE_KEY,
  readPendingHandoffs,
  takePendingHandoff,
  writePendingHandoffs,
} from '@/lib/forecasts/guestHandoff'
import { isGuestRecord, isPrivyGuest, rememberPrivyUser } from '@/lib/privy/guest'

const UI_ROOT = path.resolve(__dirname, '../../../../')

function readUi(...parts: string[]): string {
  return fs.readFileSync(path.join(UI_ROOT, ...parts), 'utf8')
}

function memoryStore() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  }
}

describe('guest forecast account', () => {
  it('maps a thirdweb transaction onto the fields Privy sends', () => {
    const out = toPrivyTransaction({
      chainId: 42161,
      to: '0x0000000000000000000000000000000000000001',
      data: '0x1234',
      value: 0n,
      gas: 90_000n,
      maxFeePerGas: 20n,
      maxPriorityFeePerGas: 1n,
      nonce: 7,
    } as any)
    expect(out).to.deep.equal({
      chainId: 42161,
      to: '0x0000000000000000000000000000000000000001',
      data: '0x1234',
      value: 0n,
      gasLimit: 90_000n,
      maxFeePerGas: 20n,
      maxPriorityFeePerGas: 1n,
      nonce: 7,
    })
  })

  it('sends through the given Privy send and returns its hash', async () => {
    const sent: any[] = []
    const account = guestForecastAccount('0xabc', async (tx) => {
      sent.push(tx)
      return { hash: '0xfeed' }
    })
    const result = await account.sendTransaction({ chainId: 421614, to: '0x01', data: '0x' } as any)
    expect(result.transactionHash).to.equal('0xfeed')
    expect(sent).to.have.length(1)
    expect(sent[0].chainId).to.equal(421614)
    expect(account.address).to.equal('0xabc')
  })

  it('refuses to sign messages, so it is useless outside forecast writes', async () => {
    const account = guestForecastAccount('0xabc', async () => ({ hash: '0x' }))
    let threw = false
    try {
      await account.signMessage({ message: 'hi' } as any)
    } catch {
      threw = true
    }
    expect(threw).to.equal(true)
  })
})

describe('guest handoff to an existing account', () => {
  it('takes only the pending pick for the prize on screen', () => {
    const store = memoryStore()
    writePendingHandoffs(
      [
        { chainSlug: 'arbitrum', deprizeId: 2, vote: '{"v":1,"a":{"1":100},"vp":0}' },
        { chainSlug: 'sepolia', deprizeId: 2, vote: '{"v":1,"a":{"0":100},"vp":0}' },
      ],
      store
    )
    const taken = takePendingHandoff('arbitrum', 2, store)
    expect(taken?.vote).to.contain('"1":100')
    expect(readPendingHandoffs(store)).to.have.length(1)
    expect(takePendingHandoff('arbitrum', 2, store)).to.equal(null)
  })

  it('clears storage once the last pick is taken', () => {
    const store = memoryStore()
    writePendingHandoffs([{ chainSlug: 'arbitrum', deprizeId: 3, vote: '{}' }], store)
    takePendingHandoff('arbitrum', 3, store)
    expect(store.data.has(GUEST_HANDOFF_STORAGE_KEY)).to.equal(false)
  })

  it('ignores malformed storage', () => {
    const store = memoryStore()
    store.setItem(GUEST_HANDOFF_STORAGE_KEY, '{not json')
    expect(readPendingHandoffs(store)).to.deep.equal([])
    store.setItem(GUEST_HANDOFF_STORAGE_KEY, JSON.stringify([{ chainSlug: 'x' }]))
    expect(readPendingHandoffs(store)).to.deep.equal([])
  })
})

describe('server guest lookup', () => {
  const realFetch = global.fetch
  let calls = 0
  afterEach(() => {
    global.fetch = realFetch
  })

  function stubFetch(body: any, ok = true) {
    calls = 0
    global.fetch = (async () => {
      calls++
      return { ok, status: ok ? 200 : 500, json: async () => body } as any
    }) as any
  }

  it('reads is_guest from the Privy user record', () => {
    expect(isGuestRecord({ is_guest: true })).to.equal(true)
    expect(isGuestRecord({ is_guest: false })).to.equal(false)
    expect(isGuestRecord(null)).to.equal(false)
  })

  it('caches a guest briefly and a full user for good', async () => {
    stubFetch({ is_guest: true })
    expect(await isPrivyGuest('did:privy:guest-1')).to.equal(true)
    expect(await isPrivyGuest('did:privy:guest-1')).to.equal(true)
    expect(calls).to.equal(1)

    rememberPrivyUser('did:privy:guest-1', false)
    expect(await isPrivyGuest('did:privy:guest-1')).to.equal(false)
    expect(calls).to.equal(1)
  })

  it('throws when Privy cannot answer, so callers fail closed', async () => {
    stubFetch({}, false)
    let threw = false
    try {
      await isPrivyGuest('did:privy:unknown-1')
    } catch {
      threw = true
    }
    expect(threw).to.equal(true)
  })
})

describe('guest wiring', () => {
  it('rejects guests in verifyPrivyAuth unless a route opts in', () => {
    const src = readUi('lib', 'privy', 'privyAuth.tsx')
    expect(src).to.match(/!options\.allowGuest && \(await isPrivyGuest\(/)
  })

  it('opts in only on the forecast gas route', () => {
    const sponsor = readUi('pages', 'api', 'deprize', 'sponsor-forecast-gas.ts')
    expect(sponsor).to.contain('withMiddleware(handler, guestAuthMiddleware, rateLimit)')
    expect(sponsor).to.contain('{ allowGuest: true }')
    const contributions = readUi('pages', 'api', 'contributions', 'sponsor-gas.ts')
    expect(contributions).not.to.contain('allowGuest')
    expect(contributions).not.to.contain('guestAuthMiddleware')
  })

  it('never makes a guest wallet the active wallet or gives it a NextAuth session', () => {
    const src = readUi('lib', 'privy', 'PrivyThirdwebV5Provider.tsx')
    expect(src).to.contain('const authenticated = privyAuthenticated && !isGuest')
    expect(src).to.match(/if \(!wallet \|\| isGuest\) \{/)
  })

  it('skips the Privy confirmation screen for guest forecast writes only', () => {
    const writer = readUi('lib', 'forecasts', 'useForecastWriter.ts')
    expect(writer).to.contain('uiOptions: { showWalletUIs: false }')
    const app = readUi('pages', '_app.tsx')
    expect(app).not.to.contain('showWalletUIs')
  })

  it('shows the terms line wherever a signed-out visitor can predict', () => {
    expect(readUi('components', 'deprize', 'ForecastPanel.tsx')).to.contain('<GuestConsentLine />')
    expect(readUi('components', 'deprize', 'ForecastPredictModal.tsx')).to.contain(
      '<GuestConsentLine />'
    )
  })
})
