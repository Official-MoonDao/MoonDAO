/**
 * The two HUD instruments drawn on 2D canvases every frame:
 *
 *  - the minimap: heading-up, with the orbital map's craters, the science
 *    targets, the lander and the rover's tracks. No rocks: an orbital map
 *    cannot resolve them, so the driver has to read those from the picture.
 *  - the signal link: commands travelling from Earth to the Moon and the
 *    picture travelling back, so the delay is something the player can see.
 */
import { BODY, DECK, RAMP, type Site, type TargetKind } from '@/lib/first-tracks/site'

/** One colour per kind of job, shared by the beacons, the minimap and the HUD. */
export const KIND_CSS: Record<TargetKind, string> = { image: '#8fd3ff', rock: '#ffbf5e', ice: '#d9b8ff' }

export type MapPose = { x: number; z: number; h: number }

const SIGNAL = '#8fd3ff'
const GOOD = '#86e3a8'
const WARN = '#ffbf5e'

/** Size a canvas for the device, once; returns the 2D context scaled to CSS pixels. */
function fit(canvas: HTMLCanvasElement): { g: CanvasRenderingContext2D; w: number; h: number } | null {
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  if (!w || !h) return null
  const ratio = Math.min(2, window.devicePixelRatio || 1)
  if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
    canvas.width = Math.round(w * ratio)
    canvas.height = Math.round(h * ratio)
  }
  const g = canvas.getContext('2d')
  if (!g) return null
  g.setTransform(ratio, 0, 0, ratio, 0, 0)
  return { g, w, h }
}

export function drawMinimap(canvas: HTMLCanvasElement, site: Site, pose: MapPose, imaged: boolean[], trail: number[], range = 30): void {
  const f = fit(canvas)
  if (!f) return
  const { g, w } = f
  const c = w / 2
  const R = c - 3
  const sc = R / range
  const fx = Math.sin(pose.h)
  const fz = Math.cos(pose.h)
  const rx = -fz
  const rz = fx
  const P = (x: number, z: number): [number, number] => {
    const dx = x - pose.x
    const dz = z - pose.z
    return [c + (dx * rx + dz * rz) * sc, c - (dx * fx + dz * fz) * sc]
  }
  g.clearRect(0, 0, w, w)
  g.save()
  g.beginPath()
  g.arc(c, c, R, 0, Math.PI * 2)
  g.clip()
  g.fillStyle = 'rgba(6,9,16,0.72)'
  g.fillRect(0, 0, w, w)
  // Range rings at 10 m.
  g.strokeStyle = 'rgba(190,205,230,0.1)'
  g.lineWidth = 1
  for (let r = 10; r < range; r += 10) {
    g.beginPath()
    g.arc(c, c, r * sc, 0, Math.PI * 2)
    g.stroke()
  }
  // Craters, as the orbital map has them.
  g.strokeStyle = 'rgba(190,205,230,0.32)'
  g.fillStyle = 'rgba(190,205,230,0.06)'
  g.lineWidth = 1.2
  for (const k of site.craters) {
    const [x, y] = P(k.x, k.z)
    if (Math.abs(x - c) > R + k.r * sc || Math.abs(y - c) > R + k.r * sc) continue
    g.beginPath()
    g.arc(x, y, k.r * sc, 0, Math.PI * 2)
    g.fill()
    g.stroke()
  }
  // Tracks.
  if (trail.length >= 4) {
    g.strokeStyle = 'rgba(255,255,255,0.5)'
    g.lineWidth = 1.5
    g.beginPath()
    for (let i = 0; i < trail.length; i += 2) {
      const [x, y] = P(trail[i], trail[i + 1])
      if (i) g.lineTo(x, y)
      else g.moveTo(x, y)
    }
    g.stroke()
  }
  // Lander: hull and deck in foil gold, the ramp in grey.
  const poly = (pts: [number, number][], fill: string) => {
    g.fillStyle = fill
    g.beginPath()
    pts.forEach(([x, z], i) => {
      const [u, v] = P(x, z)
      if (i) g.lineTo(u, v)
      else g.moveTo(u, v)
    })
    g.closePath()
    g.fill()
  }
  poly(
    [
      [BODY.x0 + 0.9, BODY.z0 + 0.8],
      [BODY.x1 - 0.9, BODY.z0 + 0.8],
      [DECK.x1, DECK.z1],
      [DECK.x0, DECK.z1],
    ],
    '#c9a45a'
  )
  poly(
    [
      [RAMP.x0, RAMP.z0],
      [RAMP.x1, RAMP.z0],
      [RAMP.x1, RAMP.z1],
      [RAMP.x0, RAMP.z1],
    ],
    '#8f96a0'
  )
  g.restore()
  // Targets: pinned to the rim when out of range, so there is always a bearing.
  site.targets.forEach((t, i) => {
    let [x, y] = P(t.x, t.z)
    const dx = x - c
    const dy = y - c
    const d = Math.hypot(dx, dy)
    const out = d > R - 5
    if (out) {
      x = c + (dx / d) * (R - 5)
      y = c + (dy / d) * (R - 5)
    }
    const done = imaged[i]
    const col = KIND_CSS[t.kind]
    g.fillStyle = done ? GOOD : col
    g.globalAlpha = done ? 0.55 : 1
    g.beginPath()
    g.arc(x, y, done ? 2.5 : out ? 3 : 4, 0, Math.PI * 2)
    g.fill()
    if (!done && !out) {
      g.strokeStyle = col
      g.globalAlpha = 0.5
      g.lineWidth = 1
      g.beginPath()
      g.arc(x, y, 7, 0, Math.PI * 2)
      g.stroke()
    }
    g.globalAlpha = 1
  })
  // Rim and the rover's arrow.
  g.strokeStyle = 'rgba(190,205,230,0.28)'
  g.lineWidth = 1
  g.beginPath()
  g.arc(c, c, R, 0, Math.PI * 2)
  g.stroke()
  g.fillStyle = '#fff'
  g.beginPath()
  g.moveTo(c, c - 7)
  g.lineTo(c + 5, c + 6)
  g.lineTo(c, c + 3)
  g.lineTo(c - 5, c + 6)
  g.closePath()
  g.fill()
}

export type LinkCommand = {
  /** Sim step the command was given on. */
  step: number
  th: number
  st: number
}

/**
 * The signal link: Earth on the left, the Moon on the right. Commands ride the
 * top lane out; the picture rides the bottom lane back.
 */
export function drawLink(
  canvas: HTMLCanvasElement,
  args: { commands: LinkCommand[]; step: number; frac: number; delaySteps: number; downSteps: number; live: boolean }
): void {
  const f = fit(canvas)
  if (!f) return
  const { g, w, h } = f
  g.clearRect(0, 0, w, h)
  const pad = 15
  const x0 = pad
  const x1 = w - pad
  const up = h * 0.34
  const down = h * 0.7
  const now = args.step + args.frac

  // The two bodies.
  const earth = g.createRadialGradient(x0 - 2, (up + down) / 2 - 2, 1, x0, (up + down) / 2, 9)
  earth.addColorStop(0, '#9fd0ff')
  earth.addColorStop(1, '#2b62c4')
  g.fillStyle = earth
  g.beginPath()
  g.arc(x0, (up + down) / 2, 8, 0, Math.PI * 2)
  g.fill()
  const moon = g.createRadialGradient(x1 - 2, (up + down) / 2 - 2, 1, x1, (up + down) / 2, 7)
  moon.addColorStop(0, '#f1f1ee')
  moon.addColorStop(1, '#8b8b88')
  g.fillStyle = moon
  g.beginPath()
  g.arc(x1, (up + down) / 2, 6, 0, Math.PI * 2)
  g.fill()

  const lx0 = x0 + 13
  const lx1 = x1 - 11
  g.lineWidth = 1
  g.setLineDash([3, 4])
  g.strokeStyle = 'rgba(190,205,230,0.28)'
  g.beginPath()
  g.moveTo(lx0, up)
  g.lineTo(lx1, up)
  g.moveTo(lx0, down)
  g.lineTo(lx1, down)
  g.stroke()
  g.setLineDash([])

  // Downlink: a steady stream of picture frames coming home.
  if (args.live) {
    const gap = 9
    const speed = (lx1 - lx0) / args.downSteps
    const offset = (now * speed) % gap
    g.fillStyle = 'rgba(143,211,255,0.4)'
    for (let x = lx1 - offset; x > lx0; x -= gap) g.fillRect(x - 2, down - 2, 4, 4)
  }

  // Uplink: one marker per command, coloured by what it asks for.
  for (const c of args.commands) {
    const age = now - c.step
    if (age < 0 || age > args.delaySteps) continue
    const x = lx0 + (age / args.delaySteps) * (lx1 - lx0)
    const stop = c.th === 0 && c.st === 0
    const col = stop ? '#ffffff' : c.th > 0 ? GOOD : c.th < 0 ? WARN : SIGNAL
    g.save()
    g.translate(x, up)
    g.shadowColor = col
    g.shadowBlur = 6
    g.fillStyle = col
    if (stop) g.fillRect(-3, -3, 6, 6)
    else {
      // An arrow pointing the way the command drives: up is forward, sideways is a turn.
      g.rotate(Math.atan2(c.st, c.th === 0 ? 0.0001 : c.th))
      g.beginPath()
      g.moveTo(0, -5.5)
      g.lineTo(4.5, 3.5)
      g.lineTo(0, 1.5)
      g.lineTo(-4.5, 3.5)
      g.closePath()
      g.fill()
    }
    g.restore()
  }
}
