/**
 * The country round Starbase for Catch, authored by hand: a simplified layout
 * in the spirit of the real place (the Gulf to the east, Boca Chica Bay to
 * the north, the highway running in from the south-west past the production
 * site, tidal flats and scrub ridges between), not a survey of it. Shapes are
 * generated from a handful of placed blobs, so nothing here is traced.
 *
 * Local metres: x east, z south, origin on the ground under the Pad 1 catch
 * point. Polygons are lists of rings, each a flat [x, z, x, z, ...] array.
 * Buildings: [x, z, length, width, angleDeg, height, kind]
 *   kind 0 plain, 1 house, 3 industrial hall, 4 tall bay, 5 vehicle on display.
 * Tanks: [x, z, length, width, angleDeg, height] (long ones lie down).
 *
 * Dependency-free: the headless bot and the server replay import it.
 */
import { PAD1, PAD2 } from './layout'

export type MapData = {
  shore: { z0: number; z1: number; x: number[] }
  water: number[][][]
  tidal: number[][][]
  marsh: number[][][]
  scrub: number[][][]
  sand: number[][][]
  paved: number[][][]
  roads: { w: number; k: number; p: number[] }[]
  walls: { h: number; p: number[] }[]
  pipes: number[][]
  /** Pipe bridges: runs carried overhead where a line crosses a road. */
  racks: number[][]
  buildings: number[][]
  tanks: number[][]
}

function lcg(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

/** A lumpy closed outline round an ellipse. */
function blob(cx: number, cz: number, rx: number, rz: number, rotDeg: number, seed: number, lump = 0.22, n = 30): number[][] {
  const rnd = lcg(seed * 7919 + 13)
  const k = 6
  const amp: number[] = []
  const ph: number[] = []
  for (let i = 0; i < k; i++) {
    amp.push((rnd() - 0.5) * 2 * lump * (1 / (1 + i * 0.6)))
    ph.push(rnd() * 6.283)
  }
  const c = Math.cos((rotDeg * Math.PI) / 180)
  const s = Math.sin((rotDeg * Math.PI) / 180)
  const ring: number[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283185
    let r = 1
    for (let j = 0; j < k; j++) r += amp[j] * Math.sin(a * (j + 2) + ph[j])
    const x = Math.cos(a) * rx * r
    const z = Math.sin(a) * rz * r
    ring.push(Math.round(cx + x * c - z * s), Math.round(cz + x * s + z * c))
  }
  return [ring]
}

function rect(cx: number, cz: number, len: number, wid: number, rotDeg: number): number[][] {
  const c = Math.cos((rotDeg * Math.PI) / 180)
  const s = Math.sin((rotDeg * Math.PI) / 180)
  const ring: number[] = []
  for (const [u, v] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    const x = (u * len) / 2
    const z = (v * wid) / 2
    ring.push(Math.round(cx + x * c - z * s), Math.round(cz + x * s + z * c))
  }
  return [ring]
}

/** A meandering band (a river or channel) as one polygon. */
function band(points: [number, number][], width: number): number[][] {
  const left: number[] = []
  const right: number[] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)]
    const b = points[Math.min(points.length - 1, i + 1)]
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const nx = -(b[1] - a[1]) / L
    const nz = (b[0] - a[0]) / L
    left.push(Math.round(points[i][0] + nx * width), Math.round(points[i][1] + nz * width))
    right.unshift(Math.round(points[i][1] - nz * width))
    right.unshift(Math.round(points[i][0] - nx * width))
  }
  return [left.concat(right)]
}

/** The waterline: a straight coast running a little east of south, with a gentle wander. */
const SHORE_Z0 = -9000
const SHORE_Z1 = 9000
function shoreLine(): number[] {
  const out: number[] = []
  for (let i = 0; i < 96; i++) {
    const z = SHORE_Z0 + ((SHORE_Z1 - SHORE_Z0) * i) / 95
    out.push(Math.round((395 + 0.05 * z + Math.sin(z / 1300) * 7 + Math.sin(z / 410 + 1) * 3) * 10) / 10)
  }
  return out
}

function build(): MapData {
  const rnd = lcg(4242)

  // --- Water ---------------------------------------------------------------
  const water: number[][][] = [
    blob(-980, -1520, 800, 760, 12, 1, 0.2, 40), // Boca Chica Bay
    blob(-270, -1130, 300, 400, -18, 2, 0.24), // its eastern arm, toward the beach
    blob(-3400, -4200, 2300, 2100, 8, 3, 0.16, 44), // South Bay
    blob(-700, 40, 170, 46, -14, 4, 0.3), // long pond west of the pads
    blob(-388, 36, 20, 16, 0, 5, 0.15, 14), // deluge run-off basin
    blob(-330, 1130, 115, 85, 20, 6),
    blob(380, 1480, 70, 130, 5, 7),
    blob(-390, 460, 140, 36, 8, 8, 0.3),
    blob(-1950, 1250, 260, 120, -30, 9, 0.3),
    // The Rio Grande, winding to the Gulf well to the south.
    band(
      [
        [-9500, 3900],
        [-8000, 3400],
        [-6800, 3900],
        [-5600, 3500],
        [-4500, 4100],
        [-3300, 3700],
        [-2200, 4300],
        [-1100, 3900],
        [-200, 4400],
        [700, 4250],
      ],
      45
    ),
  ]

  // --- Tidal flats and marsh ----------------------------------------------
  const tidal: number[][][] = [
    blob(-980, -1500, 1150, 1080, 12, 21, 0.18, 40), // round the bay
    blob(-1150, 90, 720, 270, -12, 22, 0.25),
    blob(-2500, 1700, 2300, 900, -28, 23, 0.2, 40),
    blob(-900, 2700, 1700, 1100, 10, 24, 0.22, 36),
    blob(-3400, -4100, 3000, 2700, 8, 25, 0.14, 44), // round South Bay
    blob(-5200, -500, 1500, 1300, 30, 26, 0.25, 36),
    blob(60, 900, 260, 520, 6, 27, 0.25),
  ]
  const marsh: number[][][] = [blob(-4700, 2500, 260, 420, 20, 31), blob(-3900, 3300, 1300, 420, -20, 32, 0.25, 36), blob(-1500, 3500, 900, 260, 12, 33)]

  // --- Scrub ridges (lomas) ------------------------------------------------
  const scrub: number[][][] = [
    blob(-930, -360, 860, 190, -14, 41, 0.2, 40), // the long ridge the highway follows
    blob(-2050, 230, 720, 190, -16, 42, 0.22, 36),
    blob(-170, 330, 170, 95, 10, 43, 0.3),
    blob(-560, 300, 120, 80, -20, 44, 0.3),
    blob(250, -1250, 150, 900, 3, 45, 0.2, 36), // back-dune thicket north along the coast
    blob(330, 2300, 170, 1700, 3, 46, 0.2, 40), // and south
    blob(-3300, 2350, 900, 330, -30, 47, 0.25, 36),
    blob(-1700, -2900, 700, 300, 25, 48, 0.25),
    blob(-4600, 900, 800, 420, 40, 49, 0.25, 36),
  ]
  for (let i = 0; i < 46; i++) {
    const x = -7500 + rnd() * 7600
    const z = -6500 + rnd() * 11500
    // Keep the scatter off the sites.
    if (Math.hypot(x + 180, z) < 420 || Math.hypot(x + 3250, z - 950) < 760) continue
    scrub.push(blob(x, z, 40 + rnd() * 190, 30 + rnd() * 110, rnd() * 180, 60 + i, 0.3, 18))
  }

  // --- Worked ground ---------------------------------------------------------
  const paved: number[][][] = [
    // Launch site: one graded yard holding both pads and the tank farm.
    [[-450, -150, -338, -172, 108, -178, 160, -150, 168, 60, 110, 205, -150, 215, -420, 150]],
    rect(-3260, 960, 760, 560, 44), // production site
    rect(-2830, 590, 430, 330, 8), // the village
  ]

  // --- Roads -------------------------------------------------------------------
  const roads: MapData['roads'] = [
    // The highway: in from the south-west, past the production site, along the ridge to the beach.
    { w: 9, k: 0, p: [-6400, 3900, -3700, 1560, -2880, 840, -2500, 520, -1750, 300, -900, 30, -520, -150, -330, -185, 110, -190, 262, -150] },
    { w: 8, k: 0, p: [-3330, 1240, -3050, 990, -2880, 840] },
    { w: 8, k: 0, p: [-3560, 1010, -3330, 1240] },
    // Into the launch site.
    // Each gate road stops at its pad's apron, clear of the mount and the flame trench.
    { w: 7, k: 0, p: [-60, -188, -60, -40, -26, -6] },
    { w: 7, k: 0, p: [-330, -185, -330, -114, -348, -108] },
    // Graded service track round the south of the tank farm, joining the pads.
    { w: 5, k: 1, p: [-60, -40, -72, 60, -200, 110, -360, 40, -362, -50] },
    { w: 4, k: 1, p: [120, -166, 150, 40, 100, 190] },
    // A sand track from the end of the highway down onto the beach.
    { w: 4, k: 1, p: [262, -150, 300, -142, 322, -134] },
  ]
  // Village streets.
  for (let i = 0; i < 4; i++) roads.push({ w: 6, k: 0, p: [-3010, 470 + i * 78, -2650, 520 + i * 78] })
  for (let i = 0; i < 3; i++) roads.push({ w: 6, k: 0, p: [-2970 + i * 150, 450, -3000 + i * 150, 720] })

  const walls: MapData['walls'] = [
    // The site wall runs along the highway's south side, with a gap at each gate.
    { h: 3.4, p: [-440, -151, -338, -170] },
    { h: 3.4, p: [-322, -171, -68, -174] },
    { h: 3.4, p: [-52, -174, 104, -176] },
  ]

  // --- Tanks and plant ---------------------------------------------------------
  const tanks: number[][] = []
  const buildings: number[][] = []
  const pipes: number[][] = []
  const racks: number[][] = []
  // Tank farm between the pads: banks of long horizontal tanks lying side by side.
  const bank = (x0: number, z0: number, count: number, len: number, wid: number, step: number, ang: number) => {
    const c = Math.cos(((ang + 90) * Math.PI) / 180)
    const s = Math.sin(((ang + 90) * Math.PI) / 180)
    for (let i = 0; i < count; i++) tanks.push([x0 + c * step * i, z0 + s * step * i, len, wid, ang, 0])
  }
  bank(-250, -78, 9, 30, 4.6, 6.8, 82) // oxygen
  bank(-170, -74, 8, 30, 4.6, 6.8, 82) // nitrogen
  bank(-100, -68, 7, 26, 4.4, 6.8, 82) // methane
  bank(-262, -30, 6, 22, 4.2, 6.4, 82)
  // Water tanks for the deluge: upright shells in two short rows.
  for (let i = 0; i < 6; i++) tanks.push([-306 + i * 7.5, -96 + (i % 2) * 7, 6, 6, 0, 13])
  tanks.push([-128, -106, 13, 13, 0, 9], [-112, -104, 13, 13, 0, 9], [-196, -108, 9, 9, 0, 11])
  // Pumps, sub-coolers, vaporisers, bunkers.
  for (let i = 0; i < 8; i++) buildings.push([-246 + i * 21, -44 - (i % 3) * 3, 9, 5, 82, 4.5, 3])
  buildings.push([-205, -112, 30, 13, -8, 7, 3], [-150, -118, 20, 11, -8, 6, 0], [-292, -152, 22, 10, -4, 4.5, 0], [-72, -112, 16, 9, 82, 5, 3])
  buildings.push([118, 84, 26, 12, 80, 6, 0], [96, 150, 18, 9, 80, 4.5, 0], [-150, 150, 34, 16, 4, 8, 3])
  // Feed lines from the farm to each mount.
  // Pad 1's line crosses its gate road on a pipe bridge.
  pipes.push([-96, -52, -70, -52], [-50, -52, -30, -52, PAD1.x - 13, PAD1.z - 13])
  racks.push([-70, -52, -50, -52])
  pipes.push([-262, -52, -320, -62, PAD2.x + 13, PAD2.z + 4])
  pipes.push([-250, -62, -100, -56])
  // The old hopper, parked by the highway as a monument.
  buildings.push([-300, -262, 9, 9, 0, 18, 5])

  // --- Production site, about 3.4 km west-south-west -------------------------
  buildings.push([-3390, 1040, 54, 38, 44, 100, 4]) // Mega Bay 1
  buildings.push([-3440, 940, 54, 38, 134, 100, 4]) // Mega Bay 2
  buildings.push([-3290, 1150, 132, 112, 44, 116, 4]) // Gigabay
  buildings.push([-3110, 900, 330, 250, 44, 24, 3]) // Starfactory
  buildings.push([-3460, 1250, 120, 36, 134, 14, 3], [-3520, 1180, 110, 34, 134, 14, 3], [-3190, 1300, 90, 40, 44, 12, 3])
  buildings.push([-3350, 760, 60, 30, 44, 22, 0], [-3000, 1130, 70, 34, 44, 10, 3])
  buildings.push([-3505, 1085, 9, 9, 0, 20, 5], [-3585, 1115, 9, 9, 0, 52, 5], [-3612, 1140, 9, 9, 0, 70, 5]) // vehicles in the yard
  for (let i = 0; i < 6; i++) tanks.push([-3560 + i * 8, 1330 + i * 6, 7, 7, 0, 10])
  // The village: small houses on a loose grid.
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 13; c++) {
      if (rnd() < 0.18) continue
      const x = -3000 + c * 28 + rnd() * 6 + r * 4
      const z = 492 + r * 78 + c * 3.6 + (rnd() < 0.5 ? -15 : 15)
      buildings.push([x, z, 11 + rnd() * 6, 7 + rnd() * 3, 8 + (rnd() - 0.5) * 6, 3.2 + rnd() * 1.6, 1])
    }
  }

  return {
    shore: { z0: SHORE_Z0, z1: SHORE_Z1, x: shoreLine() },
    water,
    tidal,
    marsh,
    scrub,
    sand: [],
    paved,
    roads,
    walls,
    pipes,
    racks,
    buildings,
    tanks,
  }
}

export const MAP: MapData = build()

/** Where the waterline is at a given z (metres east of the origin). */
export function shoreX(z: number): number {
  const { z0, z1, x } = MAP.shore
  const f = Math.max(0, Math.min(1, (z - z0) / (z1 - z0))) * (x.length - 1)
  const i = Math.min(x.length - 2, Math.floor(f))
  return x[i] + (x[i + 1] - x[i]) * (f - i)
}
