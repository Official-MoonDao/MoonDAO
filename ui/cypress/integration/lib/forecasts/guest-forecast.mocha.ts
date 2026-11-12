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
  forgetGuestForecast,
  handoffRows,
  isSameWalletHandoff,
  mergePendingHandoffs,
  peekPendingHandoff,
  readPendingHandoffs,
  rememberGuestForecast,
  takePendingHandoff,
  writePendingHandoffs,
} from '@/lib/forecasts/guestHandoff'
import { retainForecastWriter } from '@/lib/forecasts/retainForecastWriter'
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

describe('guest upgrade keeps the same forecast wallet', () => {
  const guest = { address: '0xGuest' }
  const sameWallet = { address: '0xGuest' }
  const other = { address: '0xOther' }

  it('holds the guest writer until that wallet becomes the active account', () => {
    const duringGuest = retainForecastWriter({
      live: guest,
      held: undefined,
      authenticated: true,
    })
    const gap = retainForecastWriter({
      live: undefined,
      held: duringGuest.held,
      authenticated: true,
    })
    const attached = retainForecastWriter({
      live: sameWallet,
      held: gap.held,
      authenticated: true,
    })
    expect(gap.writer).to.equal(guest)
    expect(attached.writer).to.equal(sameWallet)
  })

  it('drops the held writer on logout', () => {
    const loggedOut = retainForecastWriter({
      live: undefined,
      held: guest,
      authenticated: false,
    })
    const nextSession = retainForecastWriter({
      live: undefined,
      held: loggedOut.held,
      authenticated: true,
    })
    expect(loggedOut.writer).to.equal(undefined)
    expect(loggedOut.held).to.equal(undefined)
    expect(nextSession.writer).to.equal(undefined)
  })

  it('follows a different wallet as soon as it is live', () => {
    const switched = retainForecastWriter({ live: other, held: guest, authenticated: true })
    expect(switched.writer).to.equal(other)
    expect(switched.held).to.equal(other)
  })
})

describe('guest roster identity', () => {
  it('keys the visible roster by the writer, not the active account', () => {
    const panel = readUi('components', 'deprize', 'ForecastPanel.tsx')
    const predict = readUi('lib', 'forecasts', 'useForecastPredict.ts')
    for (const src of [panel, predict]) {
      expect(src).to.contain('forecastRosterKey(chainSlug, deprizeId, writerAddress)')
      expect(src).to.contain('setRosterPrize(prizeKey)')
      expect(src).to.contain('}, [writerAddress, chainSlug, deprizeId])')
    }
    expect(panel).not.to.contain('forecastRosterKey(chainSlug, deprizeId, account?.address)')
    expect(predict).not.to.contain(
      'forecastRosterKey(chainSlug, deprizeId, activeAccount?.address)'
    )
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

  it('peeks without removing the pending pick', () => {
    const store = memoryStore()
    writePendingHandoffs([{ chainSlug: 'arbitrum', deprizeId: 2, vote: '{"v":1}' }], store)
    expect(peekPendingHandoff('arbitrum', 2, store)?.vote).to.equal('{"v":1}')
    expect(peekPendingHandoff('sepolia', 2, store)).to.equal(null)
    expect(readPendingHandoffs(store)).to.have.length(1)
  })

  it('keeps one row per prize when a retry reads the same forecast', () => {
    const first = { chainSlug: 'arbitrum', deprizeId: 2, vote: '{"v":1}' }
    const again = { chainSlug: 'arbitrum', deprizeId: 2, vote: '{"v":2}' }
    const other = { chainSlug: 'sepolia', deprizeId: 2, vote: '{"v":3}' }
    const merged = mergePendingHandoffs([first, other], [again])
    expect(merged).to.have.length(2)
    expect(merged.find((row) => row.chainSlug === 'arbitrum')?.vote).to.equal('{"v":2}')
    expect(merged.find((row) => row.chainSlug === 'sepolia')?.vote).to.equal('{"v":3}')
  })

  it('keeps a confirmed prediction the gateway has not indexed', () => {
    const noted = {
      chainSlug: 'arbitrum',
      deprizeId: 1,
      vote: '{"v":1,"a":{"2":100},"vp":0}',
      from: '0xabcabcabcabcabcabcabcabcabcabcabcabcabca',
    }
    expect(handoffRows([], [noted])).to.deep.equal([noted])
  })

  it('prefers the local note when the gateway still shows the previous pick', () => {
    const stale = { chainSlug: 'arbitrum', deprizeId: 1, vote: '{"v":1,"a":{"0":100}}' }
    const latest = {
      chainSlug: 'arbitrum',
      deprizeId: 1,
      vote: '{"v":1,"a":{"2":100}}',
      from: '0xabcabcabcabcabcabcabcabcabcabcabcabcabca',
    }
    const other = { chainSlug: 'sepolia', deprizeId: 1, vote: '{"v":1,"a":{"1":100}}' }
    const rows = handoffRows([stale, other], [latest])
    expect(rows).to.have.length(2)
    expect(rows.find((row) => row.chainSlug === 'arbitrum')?.vote).to.equal(latest.vote)
    expect(rows.find((row) => row.chainSlug === 'sepolia')?.vote).to.equal(other.vote)
  })

  it('remembers a guest write and forgets it when that guest removes it', () => {
    const store = memoryStore()
    const guest = '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD'
    const row = {
      chainSlug: 'arbitrum',
      deprizeId: 1,
      vote: '{"v":1,"a":{"2":100},"vp":0}',
      from: guest,
    }
    expect(rememberGuestForecast(row, store)).to.equal(true)
    expect(readPendingHandoffs(store)[0].from).to.equal(guest.toLowerCase())
    expect(forgetGuestForecast('arbitrum', 1, store)).to.equal(true)
    expect(readPendingHandoffs(store)).to.deep.equal([])
    expect(rememberGuestForecast({ ...row, from: 'not-an-address' }, store)).to.equal(false)
  })

  it('does not rewrite a note onto the wallet that already holds it', () => {
    const pending = {
      chainSlug: 'arbitrum',
      deprizeId: 1,
      vote: '{}',
      from: '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD',
    }
    const guest = pending.from.toLowerCase()
    expect(isSameWalletHandoff(pending, guest)).to.equal(true)
    expect(isSameWalletHandoff(pending, '0xdefdefdefdefdefdefdefdefdefdefdefdefdefd')).to.equal(
      false
    )
    expect(
      isSameWalletHandoff({ chainSlug: 'arbitrum', deprizeId: 1, vote: '{}' }, guest)
    ).to.equal(false)
  })

  it('reports when the handoff could not be stored', () => {
    const row = { chainSlug: 'arbitrum', deprizeId: 2, vote: '{"v":1}' }
    expect(writePendingHandoffs([row], null)).to.equal(false)
    const store = memoryStore()
    expect(writePendingHandoffs([row], store)).to.equal(true)
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

  it('keeps the guest signed in when a forecast cannot be snapshotted or deleted', () => {
    const src = readUi('lib', 'forecasts', 'useForecastWriter.ts')
    const start = src.indexOf('const switchToExistingAccount')
    const end = src.indexOf('return { writer')
    const fn = src.slice(start, end)
    const logoutAt = fn.indexOf('await logout()')
    const snapshotAt = fn.indexOf('writePendingHandoffs(')
    expect(snapshotAt).to.be.greaterThan(-1)
    expect(logoutAt).to.be.greaterThan(snapshotAt)
    const beforeLogout = fn.slice(0, logoutAt)
    expect(beforeLogout).to.contain('if (!res.ok)')
    expect(beforeLogout).to.contain('return')
    expect(beforeLogout).to.contain('const found = handoffRows(')
    expect(beforeLogout).to.contain('for (const row of found)')
    expect(beforeLogout).to.contain('if (found.length > 0 && !stored)')
    // A delete that throws must return before the guest is dropped.
    const deleteTry = beforeLogout.indexOf('await clearForecastVote')
    const deleteCatch = beforeLogout.indexOf('catch (err)', deleteTry)
    expect(deleteCatch).to.be.greaterThan(deleteTry)
    expect(beforeLogout.indexOf('return', deleteCatch)).to.be.greaterThan(deleteTry)
  })

  it('removes a guest handoff only after the account rewrite succeeds', () => {
    const hook = readUi('lib', 'forecasts', 'useGuestForecastHandoff.ts')
    expect(hook).to.contain('peekPendingHandoff(chainSlug, deprizeId)')
    expect(hook).to.match(/if \(ok\) takePendingHandoff\(chainSlug, deprizeId\)/)
    const peekAt = hook.indexOf('peekPendingHandoff(chainSlug, deprizeId)')
    const sameWalletAt = hook.indexOf('isSameWalletHandoff(')
    const commitAt = hook.indexOf('commitPickRef.current(pick)')
    const takeAt = hook.indexOf('if (ok) takePendingHandoff')
    expect(sameWalletAt).to.be.greaterThan(peekAt)
    expect(commitAt).to.be.greaterThan(sameWalletAt)
    expect(hook.slice(sameWalletAt, commitAt)).to.contain('return')
    expect(takeAt).to.be.greaterThan(commitAt)
    // A decode miss returns without removing the stored copy.
    const decodeAt = hook.indexOf('decodeForecastVote(pending.vote, n)')
    const decodeReturn = hook.indexOf('if (pick == null) return', decodeAt)
    expect(decodeReturn).to.be.greaterThan(decodeAt)
    expect(hook.slice(decodeAt, decodeReturn)).not.to.contain('takePendingHandoff')
    for (const file of [
      'components/deprize/ForecastPanel.tsx',
      'lib/forecasts/useForecastPredict.ts',
    ]) {
      const panel = readUi(file)
      expect(panel).to.contain('useGuestForecastHandoff(')
      expect(panel).to.contain('chainSlug')
      expect(panel).to.contain('deprizeId')
      expect(panel).to.contain('rememberGuestForecast(')
      expect(panel).to.contain('forgetGuestForecast(')
      const writeAt = panel.indexOf('await writeForecastVote(')
      const rememberAt = panel.indexOf('rememberGuestForecast(')
      const clearAt = panel.indexOf('await clearForecastVote(')
      const forgetAt = panel.indexOf('forgetGuestForecast(')
      expect(rememberAt).to.be.greaterThan(writeAt)
      expect(forgetAt).to.be.greaterThan(clearAt)
      expect(panel).not.to.contain('handoffChecked')
      expect(panel).not.to.contain('takePendingHandoff(')
    }
  })

  it('shows the terms line wherever a signed-out visitor can predict', () => {
    expect(readUi('components', 'deprize', 'ForecastPanel.tsx')).to.contain('<GuestConsentLine />')
    expect(readUi('components', 'deprize', 'ForecastPredictModal.tsx')).to.contain(
      '<GuestConsentLine />'
    )
  })
})
