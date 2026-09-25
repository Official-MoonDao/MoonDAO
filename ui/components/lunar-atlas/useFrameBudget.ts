// How hard Moon Base Zero is allowed to work a laptop.
//
// This scene can never go quiet on its own. Astronauts walk, rovers patrol the
// spine, the print gantry slews, the excavators dig and the Earth turns — so
// r3f's `demand` frameloop, which renders only when something invalidates, buys
// nothing here: something always has. Left on the default `always` loop the page
// therefore renders as fast as the display will take it, and on a ProMotion
// MacBook that is 120 full frames a second of a scene carrying a 4096² shadow
// pass, a multisampled HDR target and a bloom chain. Nothing in the frame is
// moving fast enough to need any of those frames, and the fan is the receipt.
//
// So the loop is driven from here instead, at a rate chosen for what the user is
// doing rather than for what the panel can scan out.

import type { RootState } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'

// While the camera is under someone's hand — a tumble, a zoom, or a flight into
// a site. This is the one case where frames are the product, so it gets the most
// the scene is worth: 60 is already twice the cadence of anything on screen, and
// capping there rather than at the panel rate is free on a 60 Hz display and
// halves the work on a 120 Hz one.
const ACTIVE_FPS = 60

// The resting rate, with the scene in view and the user reading a panel or
// deciding where to go next. Every moving thing on this map moves at walking
// pace or slower, so 30 is indistinguishable from 60 for all of them.
const IDLE_FPS = 30

// After a long stretch of no input at all — tab left open behind other work.
// Deliberately still nonzero: stopping altogether would be cheaper, but then any
// change that is NOT user input (a market poll landing, a texture finishing its
// decode) would sit invisible behind a stale frame until someone touched the
// page. A tenth of the design rate costs almost nothing and cannot go stale.
const DORMANT_FPS = 10
const DORMANT_AFTER_MS = 60_000

// The largest single step the scene clock is allowed to take. See its use site.
const MAX_STEP_S = 0.25

// The ceiling on drawing-buffer pixels, which is the real GPU dial in this scene.
//
// Every per-pixel cost here is paid several times over: the composer renders to
// a multisampled half-float target, bloom mips it down and back up, and the tone
// curve walks it again. A flat `dpr={[1, 2]}` means that whole chain scales with
// the square of the device ratio AND with the window, so the same page that is
// merely warm on a laptop panel is four times the work dragged onto a 5K display
// — which is exactly backwards from how much of it anyone can see.
//
// A pixel budget fixes the cost instead of the ratio. 4 megapixels is about
// 1.55x on a 16" MacBook panel, 1.75x on a 14", and just over 1x fullscreen on
// 5K. With the composer's MSAA underneath, that is a soft enough landing that
// the thin geometry (pin tethers, reticle rings) still resolves cleanly.
const PIXEL_BUDGET = 4_000_000
const MIN_DPR = 1
const MAX_DPR = 2

function budgetedDpr(): number {
  if (typeof window === 'undefined') return MIN_DPR
  const device = window.devicePixelRatio || 1
  const area = window.innerWidth * window.innerHeight
  if (!area) return Math.min(device, MAX_DPR)
  const budgeted = Math.max(MIN_DPR, Math.sqrt(PIXEL_BUDGET / area))
  return Math.min(device, MAX_DPR, budgeted)
}

export type FrameBudget = {
  // Hand to <Canvas dpr={...}>.
  dpr: number
  // Hand to <Canvas onCreated={...}>. Captures the root's `advance` so the rAF
  // loop below can step the scene by hand.
  onCreated: (state: RootState) => void
}

/**
 * Drives an r3f root's render loop at a rate chosen from what the user is doing.
 *
 * The Canvas must be mounted with `frameloop="never"`, which tells r3f to stop
 * requesting its own animation frames and to take the clock from whatever
 * timestamp `advance` is called with.
 *
 * @param active True while the camera is being driven — a drag, a wheel zoom, or
 *   a CameraRig flight. Pins the rate to ACTIVE_FPS for as long as it holds.
 */
export default function useFrameBudget(active: boolean): FrameBudget {
  const advanceRef = useRef<RootState['advance'] | null>(null)
  const activeRef = useRef(active)
  activeRef.current = active
  const lastInputRef = useRef(0)
  const [dpr, setDpr] = useState(budgetedDpr)

  const wake = useCallback(() => {
    lastInputRef.current = performance.now()
  }, [])

  const onCreated = useCallback((state: RootState) => {
    advanceRef.current = state.advance
    // The scene has just been built, which is the least stale a frame can be —
    // but it is also a moment with no input behind it, and arriving straight
    // into the dormant rate would make the first thing anyone sees a 10 fps
    // scene. Start the clock here instead.
    lastInputRef.current = performance.now()
  }, [])

  // Any sign of life anywhere on the page counts, not just on the canvas: the
  // HUD drives the scene as much as the scene does. Clicking a legend row flies
  // the camera, hovering one grows a beacon, and both of those happen over DOM
  // that the canvas never sees a pointer event for.
  useEffect(() => {
    const opts = { passive: true } as const
    const onVisible = () => {
      if (!document.hidden) wake()
    }
    window.addEventListener('pointermove', wake, opts)
    window.addEventListener('pointerdown', wake, opts)
    window.addEventListener('wheel', wake, opts)
    window.addEventListener('keydown', wake, opts)
    window.addEventListener('focus', wake)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('pointermove', wake)
      window.removeEventListener('pointerdown', wake)
      window.removeEventListener('wheel', wake)
      window.removeEventListener('keydown', wake)
      window.removeEventListener('focus', wake)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [wake])

  // A camera flight started from the HUD is activity even though no pointer has
  // moved since the click that began it — without this, a legend click during a
  // long idle would fly the camera at the dormant rate.
  useEffect(() => {
    if (active) wake()
  }, [active, wake])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const onResize = () => {
      wake()
      // Debounced: changing dpr reallocates the composer's render targets, so a
      // live window drag must not do it on every frame of the drag.
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => setDpr(budgetedDpr()), 200)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (timer) clearTimeout(timer)
    }
  }, [wake])

  useEffect(() => {
    let raf = 0
    // Wall-clock time of the last frame we actually rendered, and the scene
    // clock we have handed r3f so far. The two are separate because the second
    // is allowed to fall behind the first — see the clamp below.
    let renderedAt: number | null = null
    let sceneClock = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      const advance = advanceRef.current
      if (!advance) return
      const fps = activeRef.current
        ? ACTIVE_FPS
        : t - lastInputRef.current > DORMANT_AFTER_MS
        ? DORMANT_FPS
        : IDLE_FPS
      // Two milliseconds of slack. A vsync tick lands a hair either side of its
      // nominal interval, and without the slack a 60 fps budget on a 60 Hz panel
      // misses by a fraction every other frame and halves itself to 30.
      if (renderedAt !== null && t - renderedAt < 1000 / fps - 2) return
      // The browser stops serving animation frames to a hidden tab, so coming
      // back from one hands us a gap of however long the user was away. Left
      // unclamped that gap is a single useFrame delta of minutes, which walks
      // every rover a lap down the spine and spins the Earth in one step. A
      // quarter second is well past the longest frame the scene can drop and
      // still be one frame.
      const step =
        renderedAt === null ? 0 : Math.min((t - renderedAt) / 1000, MAX_STEP_S)
      renderedAt = t
      sceneClock += step
      // Seconds, not milliseconds: under `frameloop="never"` r3f takes this
      // timestamp AS the clock's elapsed time and derives every useFrame delta
      // from it, so handing it the raw millisecond value would run the whole
      // scene a thousand times fast.
      advance(sceneClock)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return { dpr, onCreated }
}
