/// <reference types="node" />
/// <reference types="mocha" />
import assert from 'assert'
import {
  MOONBASE_VISIBLE_MS,
  createMoonbaseEngagement,
  isSceneInteractionTarget,
} from './moonbaseEngagement'

function harness(alreadyFired = false) {
  let now = 0
  const timers: { id: number; at: number; cb: () => void }[] = []
  let nextId = 1
  const fires: number[] = []
  const engagement = createMoonbaseEngagement({
    now: () => now,
    schedule: (ms, cb) => {
      const id = nextId++
      timers.push({ id, at: now + ms, cb })
      return id
    },
    clear: (id) => {
      const index = timers.findIndex((timer) => timer.id === id)
      if (index >= 0) timers.splice(index, 1)
    },
    hasFired: () => alreadyFired,
    fire: () => {
      fires.push(now)
    },
  })

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

  return { engagement, fires, advance, timerCount: () => timers.length }
}

describe('moonbase engagement clock', () => {
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
