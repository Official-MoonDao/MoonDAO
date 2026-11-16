/// <reference types="node" />
/// <reference types="mocha" />
import assert from 'assert'
import fs from 'fs'
import path from 'path'
import {
  MOONBASE_VISIBLE_MS,
  createMoonbaseEngagement,
  isDocumentActive,
  isSceneInteractionTarget,
  resetMoonbaseEngagementState,
  retainMoonbaseEngagement,
} from './moonbaseEngagement'

function harness(alreadyFired = false) {
  let now = 0
  const timers: { id: number; at: number; cb: () => void }[] = []
  let nextId = 1
  const fires: number[] = []
  const options = {
    now: () => now,
    schedule: (ms: number, cb: () => void) => {
      const id = nextId++
      timers.push({ id, at: now + ms, cb })
      return id
    },
    clear: (id: unknown) => {
      const index = timers.findIndex((timer) => timer.id === id)
      if (index >= 0) timers.splice(index, 1)
    },
    hasFired: () => alreadyFired,
    fire: () => {
      fires.push(now)
    },
  }
  const engagement = createMoonbaseEngagement(options)

  function advance(ms: number) {
    const target = now + ms
    for (;;) {
      const due = timers.filter((timer) => timer.at <= target).sort((a, b) => a.at - b.at)[0]
      if (!due) break
      now = due.at
      const index = timers.findIndex((timer) => timer.id === due.id)
      if (index >= 0) timers.splice(index, 1)
      due.cb()
    }
    now = target
  }

  return { engagement, fires, advance, timerCount: () => timers.length, options }
}

describe('moonbase engagement clock', () => {
  afterEach(() => {
    resetMoonbaseEngagementState()
  })

  it('fires after 10 visible seconds on /moonbase and not twice', () => {
    const { engagement, fires, advance } = harness()
    engagement.setVisible(true)
    engagement.setRoute('/moonbase')
    advance(MOONBASE_VISIBLE_MS - 1)
    assert.deepStrictEqual(fires, [])
    advance(1)
    assert.deepStrictEqual(fires, [MOONBASE_VISIBLE_MS])
    advance(MOONBASE_VISIBLE_MS)
    assert.strictEqual(fires.length, 1)
  })

  it('does not count hidden time or time spent off /moonbase', () => {
    const { engagement, fires, advance } = harness()
    engagement.setRoute('/moonbase?race=1')
    engagement.setVisible(true)
    advance(4000)
    engagement.setVisible(false)
    advance(30_000)
    engagement.setVisible(true)
    advance(5000)
    assert.deepStrictEqual(fires, [])
    engagement.setRoute('/deprize/2')
    advance(20_000)
    engagement.setRoute('/moonbase/tour')
    advance(1000)
    assert.deepStrictEqual(fires, [4000 + 30_000 + 5000 + 20_000 + 1000])
  })

  it('fires on the first canvas interaction and ignores other targets', () => {
    const canvas = {
      closest: (selector: string) => (selector === 'canvas' ? canvas : null),
      tagName: 'CANVAS',
    }
    const button = { closest: () => null, tagName: 'BUTTON' }
    assert.strictEqual(isSceneInteractionTarget(canvas), true)
    assert.strictEqual(isSceneInteractionTarget(button), false)
    assert.strictEqual(isSceneInteractionTarget(null), false)

    const { engagement, fires, advance, timerCount } = harness()
    engagement.setVisible(true)
    engagement.setRoute('/deprize')
    engagement.interact()
    assert.deepStrictEqual(fires, [])
    engagement.setRoute('/moonbase')
    advance(500)
    engagement.interact()
    assert.deepStrictEqual(fires, [500])
    advance(MOONBASE_VISIBLE_MS)
    assert.strictEqual(fires.length, 1)
    assert.strictEqual(timerCount(), 0)
  })

  it('fires on a direct /moonbase load and after a client-side navigation onto it', () => {
    const direct = harness()
    direct.engagement.setVisible(true)
    direct.engagement.setRoute('/moonbase')
    direct.advance(MOONBASE_VISIBLE_MS)
    assert.deepStrictEqual(direct.fires, [MOONBASE_VISIBLE_MS])

    const client = harness()
    client.engagement.setVisible(true)
    client.engagement.setRoute('/')
    client.advance(MOONBASE_VISIBLE_MS)
    assert.deepStrictEqual(client.fires, [])
    client.engagement.setRoute('/moonbase')
    client.advance(MOONBASE_VISIBLE_MS)
    assert.deepStrictEqual(client.fires, [MOONBASE_VISIBLE_MS * 2])
  })

  it('keeps the 10s clock when a shallow route replace restarts the effect', () => {
    const { fires, advance, options } = harness()
    const first = retainMoonbaseEngagement(options)
    first.engagement.setVisible(true)
    first.engagement.setRoute('/moonbase')
    advance(9_000)
    // Next 13 replaces the router object on each AppContainer render. The
    // effect cleanup runs, then the effect subscribes again, in one turn.
    first.release()
    const second = retainMoonbaseEngagement(options)
    second.engagement.setVisible(true)
    second.engagement.setRoute('/moonbase?year=2030')
    advance(1_000)
    assert.deepStrictEqual(fires, [10_000])
    assert.strictEqual(first.engagement, second.engagement)
  })

  it('does not count a hidden, unfocused document, and does count one that still has focus', () => {
    assert.strictEqual(
      isDocumentActive({ visibilityState: 'hidden', hasFocus: () => false }),
      false
    )
    assert.strictEqual(isDocumentActive({ visibilityState: 'hidden', hasFocus: () => true }), true)
    assert.strictEqual(
      isDocumentActive({ visibilityState: 'visible', hasFocus: () => false }),
      true
    )

    const { engagement, fires, advance } = harness()
    engagement.setRoute('/moonbase')
    engagement.setVisible(isDocumentActive({ visibilityState: 'hidden', hasFocus: () => false }))
    advance(MOONBASE_VISIBLE_MS)
    assert.deepStrictEqual(fires, [])
    engagement.setVisible(isDocumentActive({ visibilityState: 'hidden', hasFocus: () => true }))
    advance(4_000)
    assert.deepStrictEqual(fires, [])
    // Backgrounding an in-app browser may not fire visibilitychange. blur and
    // pagehide re-read focus, and a hidden document that lost focus pauses.
    engagement.setVisible(isDocumentActive({ visibilityState: 'hidden', hasFocus: () => false }))
    advance(30_000)
    assert.deepStrictEqual(fires, [])
    engagement.setVisible(isDocumentActive({ visibilityState: 'hidden', hasFocus: () => true }))
    advance(MOONBASE_VISIBLE_MS - 4_000)
    assert.deepStrictEqual(fires, [
      MOONBASE_VISIBLE_MS + 4_000 + 30_000 + (MOONBASE_VISIBLE_MS - 4_000),
    ])
  })

  it('wires the page effect to the stable router events emitter', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../components/analytics/MoonbaseEngagement.tsx'),
      'utf8'
    )
    assert.equal(src.includes('}, [router])'), false)
    assert.equal(src.includes('retainMoonbaseEngagement'), true)
    assert.equal(src.includes("events.on('routeChangeComplete'"), true)
    assert.equal(src.includes('isDocumentActive'), true)
    assert.equal(src.includes("addEventListener('blur', syncVisible)"), true)
    assert.equal(src.includes("addEventListener('pagehide', syncVisible)"), true)
    const app = fs.readFileSync(path.join(__dirname, '../../pages/_app.tsx'), 'utf8')
    assert.equal(app.includes('<MoonbaseEngagement />'), true)
  })

  it('does nothing when this tab already counted a visit', () => {
    const { engagement, fires, advance, timerCount } = harness(true)
    engagement.setVisible(true)
    engagement.setRoute('/moonbase')
    engagement.interact()
    advance(MOONBASE_VISIBLE_MS)
    assert.deepStrictEqual(fires, [])
    assert.strictEqual(timerCount(), 0)
  })
})
