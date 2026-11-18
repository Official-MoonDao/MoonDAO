/// <reference types="node" />
/// <reference types="mocha" />
import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { resetAnalyticsState, trackForecastShared } from '@/lib/analytics/ga4'
import {
  FORECAST_SHARE_ORIGIN,
  forecastShareText,
  FORECAST_SHARE_TEXT,
  X_POST_LIMIT,
  X_URL_WEIGHT,
  canonicalForecastPath,
  forecastShareUrl,
  forecastXIntentUrl,
  forecastXPostLength,
  forecastOgImagePath,
  forecastSharePickFromQuery,
  resolveForecastSharePick,
} from '@/lib/forecasts/forecastShare'
import { renderForecastCardSvg } from '@/lib/og/forecastCard'

const WALLET = `0x${'ab'.repeat(20)}`
const TX = `0x${'cd'.repeat(32)}`
const LANDING = 'shared-next-landing'
const UI = path.resolve(__dirname, '../..')

function readUi(...parts: string[]): string {
  return fs.readFileSync(path.join(UI, ...parts), 'utf8')
}

function memoryStorage(initial?: Record<string, string>): Storage {
  const data = new Map<string, string>(Object.entries(initial || {}))
  return {
    getItem: (key) => (data.has(key) ? (data.get(key) as string) : null),
    setItem: (key, value) => {
      data.set(key, String(value))
    },
    removeItem: (key) => {
      data.delete(key)
    },
    clear: () => {
      data.clear()
    },
    key: (index) => Array.from(data.keys())[index] ?? null,
    get length() {
      return data.size
    },
  }
}

function installGtag() {
  const calls: unknown[][] = []
  const gtag = (...args: unknown[]) => {
    calls.push(args)
  }
  ;(global as { window?: unknown }).window = { gtag }
  return calls
}

describe('forecast share url and text', () => {
  const dirty = `https://moon-git-preview.vercel.app/deprize/arb/1?address=${WALLET}&outcome=2&email=a%40b.com&allocation=1,0,0#${WALLET}`

  it('shares the canonical www page with campaign utm and no visitor data', () => {
    for (const [input, pathName, method] of [
      ['/deprize/arb/1', '/deprize/arb/1', 'x'],
      ['/deprize/arb/1/', '/deprize/arb/1', 'copy'],
      ['/moonbase', '/moonbase', 'x'],
      ['/moonbase/blue-ghost', '/moonbase/blue-ghost', 'copy'],
      ['/touchdown', '/touchdown', 'x'],
      [dirty, '/deprize/arb/1', 'x'],
    ] as const) {
      const url = new URL(forecastShareUrl(input, method))
      assert.strictEqual(url.origin, FORECAST_SHARE_ORIGIN)
      assert.strictEqual(url.pathname, pathName)
      assert.strictEqual(url.hash, '')
      assert.deepStrictEqual(
        [...url.searchParams.keys()],
        ['utm_source', 'utm_medium', 'utm_campaign']
      )
      assert.strictEqual(url.searchParams.get('utm_source'), method)
      assert.strictEqual(url.searchParams.get('utm_medium'), 'social')
      assert.strictEqual(url.searchParams.get('utm_campaign'), 'forecast_share')
      assert.equal(url.toString().includes(WALLET), false)
      assert.equal(url.toString().toLowerCase().includes('outcome'), false)
      assert.equal(url.toString().includes('@'), false)
      assert.equal(url.toString().includes('vercel.app'), false)
    }
  })

  it('drops wallet and transaction segments and ignores a foreign host', () => {
    assert.strictEqual(canonicalForecastPath(`/moonbase/${WALLET}`), '/moonbase')
    assert.strictEqual(canonicalForecastPath(`/deprize/arb/1/${TX}`), '/deprize/arb/1')
    assert.strictEqual(
      canonicalForecastPath(`https://evil.example/deprize/arb/1?address=${WALLET}`),
      '/deprize/arb/1'
    )
    assert.strictEqual(canonicalForecastPath('javascript:alert(1)'), null)
    assert.strictEqual(canonicalForecastPath('mailto:a@b.com'), null)
    const fallback = forecastShareUrl(`https://evil.example/${WALLET}?email=a@b.com`, 'copy')
    assert.strictEqual(
      fallback,
      `${FORECAST_SHARE_ORIGIN}/deprize?utm_source=copy&utm_medium=social&utm_campaign=forecast_share`
    )
    assert.equal(fallback.includes(WALLET), false)
    assert.equal(fallback.includes('@'), false)
  })

  it('names the forecast and leaves out availability and jurisdiction lines', () => {
    const banned =
      /worldwide|restricted|jurisdiction|U\.S\. persons|Adding ETH|unavailable|not available/i
    for (const text of [
      FORECAST_SHARE_TEXT,
      forecastShareText('Firefly'),
      forecastShareText('this competitor'),
      forecastShareText('Blue Ghost M2', LANDING),
      forecastShareText('Starship Human Landing System', 'shared-crewed-lander'),
    ]) {
      assert.equal(banned.test(text), false)
      assert.ok(forecastXPostLength(text) <= X_POST_LIMIT)
    }
    assert.strictEqual(FORECAST_SHARE_TEXT, "I made my forecast on MoonDAO 🌕\n\nWho's your pick?")
    assert.strictEqual(forecastShareText('Firefly'), "My forecast: Firefly 🌕\n\nWho's your pick?")
    assert.strictEqual(
      forecastShareText('  Blue Origin  '),
      "My forecast: Blue Origin 🌕\n\nWho's your pick?"
    )
    assert.strictEqual(forecastShareText('this competitor'), FORECAST_SHARE_TEXT)
    assert.strictEqual(forecastShareText(`Team #${WALLET}`), FORECAST_SHARE_TEXT)
    const longName = 'Northrop '.repeat(40).trim()
    assert.ok(forecastShareText(longName).startsWith('My forecast: '))
    assert.ok(forecastXPostLength(forecastShareText(longName)) <= X_POST_LIMIT)
    assert.strictEqual(X_URL_WEIGHT, 23)
    assert.ok(forecastXPostLength() <= X_POST_LIMIT)
    assert.ok(FORECAST_SHARE_TEXT.length + 1 + X_URL_WEIGHT <= X_POST_LIMIT)
    assert.equal(
      /profit|returns|\bearn\b|guaranteed|payout|bypass|\bvpn\b/i.test(FORECAST_SHARE_TEXT),
      false
    )
    assert.equal(FORECAST_SHARE_TEXT.includes('DEPRIZE_ELIGIBILITY_BYPASS'), false)
    assert.equal(/0x[a-fA-F0-9]{40}/.test(FORECAST_SHARE_TEXT), false)
  })

  it('builds an X intent that carries the text and the x utm link', () => {
    const intent = forecastXIntentUrl(dirty)
    assert.ok(intent.startsWith('https://x.com/intent/post?'))
    assert.equal(intent.includes('/intent/tweet'), false)
    const parsed = new URL(intent)
    assert.strictEqual(parsed.searchParams.get('text'), FORECAST_SHARE_TEXT)
    const named = new URL(forecastXIntentUrl('/deprize/arb/1', 'Firefly'))
    assert.strictEqual(
      named.searchParams.get('text'),
      "My forecast: Firefly 🌕\n\nWho's your pick?"
    )
    const shared = parsed.searchParams.get('url') || ''
    assert.strictEqual(shared, forecastShareUrl('/deprize/arb/1', 'x'))
    assert.equal(intent.includes(WALLET), false)
    assert.equal(decodeURIComponent(intent).includes(WALLET), false)
    const raced = new URL(forecastXIntentUrl(dirty, 'Blue Ghost M2', LANDING))
    assert.strictEqual(
      raced.searchParams.get('url'),
      `${FORECAST_SHARE_ORIGIN}/deprize/arb/1?pick=firefly-blue-ghost&utm_source=x&utm_medium=social&utm_campaign=forecast_share`
    )
  })
})

describe('forecast share pick and preview card', () => {
  it('resolves every name the site shows for a competitor to one atlas pick', () => {
    for (const name of ['Blue Ghost M2', 'Blue Ghost', 'Firefly Aerospace', 'firefly-blue-ghost']) {
      const share = resolveForecastSharePick(LANDING, name)
      assert.deepStrictEqual(share, {
        raceId: LANDING,
        projectId: 'firefly-blue-ghost',
        name: 'Blue Ghost M2',
        org: 'Firefly Aerospace',
        raceName: 'Touchdown',
        race: 'next successful lunar landing',
      })
    }
    assert.strictEqual(resolveForecastSharePick(LANDING, 'ispace')?.org, undefined)
    const crewed = resolveForecastSharePick('shared-crewed-lander', 'Starship Human Landing System')
    assert.strictEqual(crewed?.race, 'first commercial crewed lunar landing')
    assert.strictEqual(crewed?.raceName, undefined)
    for (const [race, pick] of [
      [LANDING, 'Other entrants'],
      [LANDING, 'Open Field'],
      [LANDING, 'Team #3'],
      [LANDING, 'zeno-harmonia'],
      ['not-a-race', 'Blue Ghost M2'],
      [undefined, 'Blue Ghost M2'],
    ] as const) {
      assert.strictEqual(resolveForecastSharePick(race, pick), null)
    }
  })

  it('writes the race into the post and invites a pick', () => {
    assert.strictEqual(
      forecastShareText('Blue Ghost M2', LANDING),
      "My forecast for the next successful lunar landing: Blue Ghost M2 (Firefly Aerospace) 🌕\n\nWho's your pick?"
    )
    for (const field of ['Other entrants', 'Open Field', 'Other']) {
      assert.strictEqual(
        forecastShareText(field, LANDING),
        "My forecast for the next successful lunar landing: the Open Field 🌕\n\nWho's your pick?"
      )
    }
    assert.strictEqual(
      forecastShareText('Other'),
      "My forecast: the Open Field 🌕\n\nWho's your pick?"
    )
  })

  it('links a named pick to its race page by project id only', () => {
    const share = resolveForecastSharePick(LANDING, 'Blue Ghost')
    for (const [input, pathName] of [
      ['/moonbase', `/deprize/${LANDING}`],
      [`/moonbase/firefly-blue-ghost/${WALLET}`, `/deprize/${LANDING}`],
      ['/deprize/arb/1', '/deprize/arb/1'],
    ] as const) {
      const url = new URL(forecastShareUrl(input, 'copy', share))
      assert.strictEqual(url.origin, FORECAST_SHARE_ORIGIN)
      assert.strictEqual(url.pathname, pathName)
      assert.deepStrictEqual(
        [...url.searchParams.keys()],
        ['pick', 'utm_source', 'utm_medium', 'utm_campaign']
      )
      assert.strictEqual(url.searchParams.get('pick'), 'firefly-blue-ghost')
      assert.equal(url.toString().includes(WALLET), false)
    }
  })

  it('accepts only a listed project id from the query', () => {
    assert.strictEqual(
      forecastSharePickFromQuery(LANDING, 'firefly-blue-ghost')?.name,
      'Blue Ghost M2'
    )
    assert.strictEqual(forecastSharePickFromQuery(LANDING, ['im-nova-c', 'x'])?.name, 'Nova-C IM-3')
    for (const pick of [
      'Blue Ghost M2',
      'Firefly Aerospace',
      '<script>',
      'zeno-harmonia',
      '',
      undefined,
    ]) {
      assert.strictEqual(forecastSharePickFromQuery(LANDING, pick), null)
    }
    assert.strictEqual(forecastSharePickFromQuery(null, 'firefly-blue-ghost'), null)
    assert.strictEqual(
      forecastOgImagePath({ raceId: LANDING, projectId: 'firefly-blue-ghost' }),
      `/api/og/forecast?race=${LANDING}&pick=firefly-blue-ghost`
    )
  })

  it('draws the pick, operator and race on the card, escaped', () => {
    const svg = renderForecastCardSvg(resolveForecastSharePick('shared-ice', "Chang'e-7"))
    assert.ok(svg.includes('MY FORECAST'))
    assert.ok(svg.includes('Chang&apos;e-7'))
    assert.ok(svg.includes('CNSA'))
    assert.ok(svg.includes('>Water Ice: First published in-situ lunar<'))
    assert.ok(svg.includes('>surface water ice<'))
    assert.ok(svg.includes('Make your forecast'))
    assert.equal(/worldwide|restricted|jurisdiction|U\.S\./i.test(svg), false)
    // librsvg rejects the whole card on a repeated attribute.
    for (const tag of svg.match(/<[a-zA-Z]+\s[^>]*>/g) || []) {
      const names = [...tag.matchAll(/\s([a-zA-Z:-]+)=/g)].map((m) => m[1])
      assert.strictEqual(new Set(names).size, names.length, tag)
    }
    const generic = renderForecastCardSvg(null)
    assert.ok(generic.includes('the Moon first?'))
    assert.equal(generic.includes('MY FORECAST'), false)
  })

  it('serves the card on race pages and traces its images', () => {
    const page = readUi('pages/deprize/[id].tsx')
    assert.ok(
      page.includes('forecastSharePickFromQuery(raceIdForPrizeUrl(resolvedUrl, id), query.pick)')
    )
    assert.ok(page.includes('<ForecastShareMeta share={share} />'))
    const config = readUi('next.config.js')
    const at = config.indexOf("'/api/og/forecast'")
    assert.ok(at > 0)
    assert.ok(config.indexOf('./public/touchdown/og-base.jpg', at) > at)
    for (const caller of [
      'components/lunar-atlas/SharedGoalPanel.tsx',
      'components/lunar-atlas/ProjectPanel.tsx',
    ]) {
      assert.ok(/raceId=\{(goal\.id|betGoal\?\.id)\}/.test(readUi(caller)), caller)
    }
    assert.ok(
      readUi('components/deprize/ForecastPanel.tsx').includes('raceId={raceBinding?.sharedGoalId}')
    )
  })
})

describe('forecast_shared event', () => {
  afterEach(() => {
    resetAnalyticsState()
    delete (global as { window?: unknown }).window
  })

  it('sends method and entry_path and leaves consent and internal traffic to gtag', () => {
    const calls = installGtag()
    const win = (global as unknown as { window: Record<string, unknown> }).window
    win.sessionStorage = memoryStorage({ md_entry_path: '/moonbase' })
    win.localStorage = memoryStorage({ cookie_consent: 'false' })
    win.document = { cookie: 'internal=1' }
    win.location = {
      hostname: 'moondao.com',
      search: `?internal=1&address=${WALLET}&outcome=1`,
      pathname: '/deprize/arb/1',
    }
    trackForecastShared('x')
    trackForecastShared('copy')
    assert.deepStrictEqual(calls, [
      ['event', 'forecast_shared', { method: 'x', entry_path: '/moonbase' }],
      ['event', 'forecast_shared', { method: 'copy', entry_path: '/moonbase' }],
    ])
    assert.equal(JSON.stringify(calls).includes(WALLET), false)
  })

  it('does not send an unknown method and does not throw without a window', () => {
    const calls = installGtag()
    const win = (global as unknown as { window: Record<string, unknown> }).window
    win.sessionStorage = memoryStorage()
    win.location = { hostname: 'moondao.com', search: '', pathname: '/moonbase' }
    trackForecastShared('email' as 'x')
    assert.deepStrictEqual(calls, [])
    delete (global as { window?: unknown }).window
    assert.doesNotThrow(() => trackForecastShared('copy'))
  })
})

describe('forecast share is only the free-forecast success state', () => {
  it('renders the prompt after a saved free forecast and not on the bet window', () => {
    const modal = readUi('components/deprize/PredictModal.tsx')
    assert.ok(modal.includes('!isBet && props.saved && props.offerShare'))
    assert.ok(modal.includes('<ForecastSharePrompt pick={props.teamName} raceId={props.raceId} />'))
    const prompt = readUi('components/deprize/ForecastSharePrompt.tsx')
    assert.equal(prompt.includes('Predictions are open worldwide'), false)
    assert.equal(prompt.includes('restricted jurisdictions'), false)
    assert.equal(readUi('components/deprize/BetModal.tsx').includes('ForecastSharePrompt'), false)
    const panel = readUi('components/deprize/ForecastPanel.tsx')
    const silentAt = panel.indexOf('if (!options?.silent)')
    const offerAt = panel.indexOf('setShareOffer(true)', silentAt)
    assert.ok(silentAt >= 0 && offerAt > silentAt)
    assert.equal(panel.includes('if (ok) onModalClose()'), false)
    const predict = readUi('components/deprize/ForecastPredictModal.tsx')
    assert.equal(predict.includes('wasSignedIn'), false)
    assert.ok(predict.includes("pick={props.teamName || 'this competitor'} raceId={props.raceId}"))
    assert.equal(predict.includes('labels[session.savedPick]'), false)
    assert.ok(predict.includes('offerShare={session.shareOffer && session.savedPick === index}'))
    const vote = readUi('lib/deprize/writeForecastVote.ts')
    assert.equal(vote.includes('trackForecastShared'), false)
    assert.equal(vote.includes('ForecastSharePrompt'), false)
    const tracker = readUi('lib/analytics/ga4.ts')
    const start = tracker.indexOf('export function trackForecastShared')
    const end = tracker.indexOf('export function trackProposalVote')
    const body = tracker.slice(start, end)
    assert.ok(body.includes("sendEvent('forecast_shared'"))
    assert.equal(body.includes('cookie_consent'), false)
    assert.equal(body.includes('traffic_type'), false)
    assert.equal(prompt.includes('window.open'), false)
    assert.equal(prompt.includes('api.twitter.com'), false)
    assert.ok(prompt.includes('intent="post"'))
  })
})
