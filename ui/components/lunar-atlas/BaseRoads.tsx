// The graded roads of Moon Base Zero and the hardstand at its core.
//
// A road network is the one cue that says every asset on the plain belongs to
// the same operation, so this is what turns a scatter of hardware into a
// settlement.
//
// They are built the way a lunar road is actually proposed to be built, which
// is nothing like a terrestrial one. There is no paving and there are no kerbs:
// a grader clears a lane, the spoil goes into a loose rubble windrow along each
// side, and the lane itself is sintered into a hard smooth crust. So the
// realism lives in three places.
//
// The EDGE is a rubble berm — an irregular windrow of pushed-aside rock whose
// crest wanders in height and offset from meter to meter, with loose boulders
// strewn along it. That ragged, unsurveyed line is the single strongest cue
// that the road was cut by a machine rather than drawn on the ground, and a
// tidy geometric kerb actively destroys it. The wander runs at two scales,
// because a real windrow has both: a slow one over tens of meters, which is how
// much spoil the blade happened to be carrying along a stretch, and a fast one
// meter to meter, which is tipped rock. White noise alone gives a crest that
// reads as television static rather than as a heap.
//
// The SURFACE is defined by smoothness, not colour. The terrain around it is a
// noisy hillshade full of craterlets; the roadbed is a near-uniform crust with
// nothing but a faint grading grain, the blade's transverse chatter, and two
// shallow wheel ruts down it. That contrast is what makes it read as swept, and
// it survives at any distance, whereas a tint only ever reads as a stain.
//
// The JUNCTIONS are where the network either becomes one or stays a pile of
// roads that happen to touch, and they are the reason no road here can be built
// until every road has been measured. A grader joining an existing route does
// not heap its spoil across it and does not leave boulders standing in the
// crossing: it sweeps the windrow back on all four approaches, and what is left
// is a flared apron of swept ground where the two beds run together. Every
// road's windrow, its boulders and its end fade are therefore evaluated against
// one shared set of crossings, found from the rendered centrelines rather than
// declared — see lib/lunar-atlas/junctions, which is also where the reasoning
// about how they are found lives.
//
// This is what an earlier version could not do, because it faded a windrow only
// from that road's OWN ends. That handled an avenue dying into the perimeter
// road it starts on and nothing else: main street crosses six avenues in the
// middle of its own run, so it drove a half-meter wall of rubble and a line of
// boulders straight through six junctions.
//
// Everything is LIT and takes light like the hardware standing on it, which is
// what the berms are for: they are the only part with enough relief to catch
// the low sun on one face and shade the other. The crust gets a normal map for
// the same reason — under a sun this low, micro-relief is most of what a swept
// surface looks like, and an albedo texture alone renders it flat.

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import {
  BASE_PLAN,
  BASE_STREETS,
  HARDSTAND,
  RING_RADIUS_M,
  ROAD_HALF_M,
  type Street,
} from '@/lib/lunar-atlas/baseplan'
import { latLonToVector3, vector3ToLatLon } from '@/lib/lunar-atlas/geo'
import {
  BED_HALF_M,
  SPOIL_TOE_OFF_M,
  STATION_SPACING_M,
  centreline,
  findJunctions,
  junctionBedCover,
  junctionBermLevel,
  junctionsOn,
  type Centreline,
  type Junction,
} from '@/lib/lunar-atlas/junctions'
import { capOffsetLatLon, M_TO_UNITS } from '@/lib/lunar-atlas/southpole'
import type { ProjectType } from '@/lib/lunar-atlas/types'
import { MODEL_PRESENCE } from './MarkerLayer'
import type { RadiusAt } from './useTerrainSampler'

// Multiplied against the surface texture. The sintered crust runs a little
// lighter than the regolith it was fused from; the spoil is darker because it
// is broken rock rather than fused dust.
const BED = new THREE.Color('#aaa69d')
const TRACK = new THREE.Color('#9b978f')
const RUBBLE = new THREE.Color('#837f79')
const SPOIL = new THREE.Color('#8d8983')

type Lane = {
  off: number
  rise: number
  tone: THREE.Color
  alpha: number
  // Offset moves with the windrow's per-station spread. Set on everything from
  // the sintered bed's own edge outward, so the graded lane breathes in and out
  // with the blade instead of running dead straight — and, because one number
  // moves all of them together, so the lanes can never cross each other however
  // far the blade wandered.
  wander?: boolean
  // Height moves with the windrow's crest, and is graded away at a junction.
  crest?: boolean
  // Broken rock rather than sintered crust, so it is swept toward the bed's own
  // tone wherever the windrow has been graded out of a crossing.
  spoil?: boolean
}

// Nominal windrow crest: how far the spoil stands above grade, and how far off
// the centreline it is heaped. Both are jittered per station.
const CREST_RISE_M = 0.55
const CREST_OFF_M = 5.4
// The outer toe of the windrow, taken straight from the plan's own figure
// rather than written twice: ROAD_HALF_M is what every plot on the base keeps
// its setback from, so a profile that quietly reached past it would eat the
// setback on all eight districts at once.
const TOE_OFF_M = ROAD_HALF_M

// Half the road's cross-section, crown outward, in meters off the centreline
// and meters above the local grade. An 8.2 m sintered lane, faintly cambered,
// with a scuffed verge where the blade cut and a rounded rubble windrow beyond
// it. Only the outer toe is transparent, so the spoil dies into the regolith
// without the lane itself having a soft edge.
const HALF_SECTION: Lane[] = [
  { off: 0.4, rise: 0.162, tone: BED, alpha: 1 },
  // A wheel rut is a trough with lips, not a stripe of darker paint. Two
  // vertices to a side and 5 cm deep is enough to catch the sun on one wall and
  // shade the other, which is the whole reason it reads as a rut at all.
  { off: 1.15, rise: 0.15, tone: BED, alpha: 1 },
  { off: 1.6, rise: 0.098, tone: TRACK, alpha: 1 },
  { off: 2.05, rise: 0.15, tone: BED, alpha: 1 },
  { off: 2.6, rise: 0.156, tone: BED, alpha: 1 },
  { off: BED_HALF_M, rise: 0.132, tone: BED, alpha: 1, wander: true },
  // The blade's cut line: a shallow trough of un-sintered scuff between the
  // crust and the heap, which is where the material in the heap came from.
  { off: 4.4, rise: 0.1, tone: SPOIL, alpha: 1, wander: true, spoil: true },
  {
    off: SPOIL_TOE_OFF_M,
    rise: 0.115,
    tone: RUBBLE,
    alpha: 1,
    wander: true,
    crest: true,
    spoil: true,
  },
  {
    off: 5.1,
    rise: 0.4,
    tone: RUBBLE,
    alpha: 1,
    wander: true,
    crest: true,
    spoil: true,
  },
  {
    off: CREST_OFF_M,
    rise: CREST_RISE_M,
    tone: RUBBLE,
    alpha: 1,
    wander: true,
    crest: true,
    spoil: true,
  },
  {
    off: 5.62,
    rise: 0.43,
    tone: RUBBLE,
    alpha: 1,
    wander: true,
    crest: true,
    spoil: true,
  },
  // The outer flank feathers rather than ending: fines run further out of a
  // tipped heap than the coarse rock does, so the last 0.7 m is a fade.
  {
    off: 5.95,
    rise: 0.19,
    tone: SPOIL,
    alpha: 0.45,
    wander: true,
    crest: true,
    spoil: true,
  },
  {
    off: TOE_OFF_M,
    rise: 0,
    tone: SPOIL,
    alpha: 0,
    wander: true,
    crest: true,
    spoil: true,
  },
]

// The full cross-section, left toe to right toe, mirrored from the half so the
// road can only ever be symmetric. No vertex sits on the centreline; the crown
// is the flat between the two innermost lanes.
const PROFILE: Lane[] = [
  ...HALF_SECTION.map((lane) => ({ ...lane, off: -lane.off })).reverse(),
  ...HALF_SECTION,
]

// What is left of a windrow's height where it has been graded flat through a
// junction, as a fraction of its nominal section. Not zero: a swept crossing
// still has the spoil lying about in it, pushed down rather than carted away,
// and dropping the shoulder to dead flat leaves a 13 cm cliff at the bed's edge
// where there should be a low mound.
const SWEPT_CREST = 0.18
// How far the spoil's tone is carried toward the bed's where it has been swept.
// Not all the way — this is flattened rock, not new crust.
const SWEPT_TONE = 0.85

// Enough to clear z-fighting against the terrain the bed is cut into, far less
// than the eye can read as a step at any distance the camera reaches.
const LIFT_M = 0.12
// Meters over which an open end fades out. Short: a road should stop, not
// dissolve. Spurs that run into the facility they serve never reach it. An end
// that lands in a junction is exempt (see the bed alpha in buildStreet) — a
// road that Ts into another joins it, it does not dissolve into it.
const END_FADE_M = 4
// The windrow, though, dies out much further back than the bed does, and its
// crest is flattened as it goes rather than just made transparent.
const BERM_FADE_M = 11
// Meters of road per tile of the surface grain.
const TILE_M = 5

// Loose rock strewn along the windrows. The size distribution is skewed hard
// toward the small end rather than uniform, which is both what fragmentation
// actually produces and what stops a windrow reading as a row of identical
// pebbles: a handful of real boulders against a lot of gravel.
const ROCKS_PER_SPAN = 3
const ROCK_MIN_M = 0.16
const ROCK_MAX_M = 1.05
const ROCK_SKEW = 2.4

// Hardstand cross-section: rise above local grade, and opacity, at a fraction
// of its radius. Flat, and its boundary is the ring road's inner windrow rather
// than an edge of its own — which is a claim the yard has to be built to reach
// far enough out to make true, and the fade at the rim is what lets it. See
// PLAZA_RADIUS_M. This is only the PROFILE. It is not the tessellation, and
// the yard used to be built as a fan straight off these four radii, which is
// what put the regolith back through the middle of it: every vertex is seated
// on the rendered ground (see `seat`), so the yard clears that ground by its
// lift only AT a vertex, and in between it runs dead straight while the terrain
// keeps following its own ~15.6 m polygon pitch (CAP_GRID over CAP_EXTENT_M).
// Sampled at these radii alone the innermost band chords across 36 m of a 60 m
// yard, and on ridge terrain rough enough to vary a meter from one terrain node
// to the next — a few degrees of slope, which this site has — the ground rises
// through the chord by up to ~1 m across a tenth of the yard's area.
const PLAZA_PROFILE: { r: number; rise: number; alpha: number }[] = [
  { r: 0, rise: 0.2, alpha: 1 },
  { r: 0.6, rise: 0.18, alpha: 1 },
  { r: 0.9, rise: 0.15, alpha: 1 },
  { r: 0.945, rise: 0.13, alpha: 1 },
  { r: 1, rise: 0.09, alpha: 0 },
]
// So the yard is triangulated on stations of its own, at the spacing the roads
// already use for exactly the same reason — following the ground closely enough
// that LIFT_M is a real clearance rather than a clearance at the corners. This
// is also why the roads never showed the artefact the yard did.
const PLAZA_STATION_M = STATION_SPACING_M
// Enough spokes to put the rim's circumferential pitch on the same order, so
// the mesh hugs the ground going around the yard as well as out across it.
const PLAZA_SPOKES = 144
// Where the paving actually stops, which is NOT HARDSTAND.radius. That figure
// is the ground the core district's plots are packed to fit inside, and the two
// are different questions: laid out to it, the yard ends about 1.8 m short of
// the perimeter road's inner windrow, and the ring of untouched regolith left
// between them reads as a seam running right round downtown. Run out to the
// windrow's own toe instead, the yard and the road it serves are one continuous
// worked surface, which is what the comment on HARDSTAND has always claimed.
//
// The rim fades to nothing over the last few meters rather than ending on an
// edge, which is doing two jobs: a paved yard that stops on a hard line reads
// as a sticker, and the toe it is running out to WANDERS (see `spread`), so on
// the stretches where the blade heaped the spoil furthest in, the last of the
// yard is lying under the foot of the heap. At the opacity it has out there the
// two surfaces are indistinguishable whichever way the transparency sort falls.
const PLAZA_RADIUS_M = RING_RADIUS_M - SPOIL_TOE_OFF_M

const NO_RAYCAST = () => {}

// Deterministic value noise, so the rubble is identical on every load.
function hash(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

function smoothstep(t: number) {
  const c = THREE.MathUtils.clamp(t, 0, 1)
  return c * c * (3 - 2 * c)
}

// Tiling 1D value noise on [0, 1), so a texture built from it meets itself.
function noise1(t: number, cells: number, seed: number) {
  const f = t * cells
  const i = Math.floor(f)
  const s = smoothstep(f - i)
  const at = (k: number) => hash(seed + (((k % cells) + cells) % cells) * 57.31)
  return at(i) + (at(i + 1) - at(i)) * s
}

// Tiling 2D value noise on the unit square, for the same reason.
function noise2(x: number, y: number, cells: number, seed: number) {
  const fx = x * cells
  const fy = y * cells
  const ix = Math.floor(fx)
  const iy = Math.floor(fy)
  const sx = smoothstep(fx - ix)
  const sy = smoothstep(fy - iy)
  const at = (i: number, j: number) =>
    hash(
      seed +
        (((i % cells) + cells) % cells) * 57.31 +
        (((j % cells) + cells) % cells) * 131.77
    )
  const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx
  const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx
  return a + (b - a) * sy
}

type Rock = { pos: THREE.Vector3; sizeM: number; tone: number }
type Piece = {
  key: string
  geometry: THREE.BufferGeometry
  origin: THREE.Vector3
  // Boulders are their own instanced mesh per road, sharing the road's origin
  // and its timeline presence.
  rubble?: THREE.InstancedMesh
  serves?: ProjectType[]
}
type Surface = { albedo: THREE.Texture; normal: THREE.Texture }

// The graded crust: near-uniform, with a faint longitudinal grain from the
// blade, the transverse chatter it leaves as it rides, and a fine sintering
// speckle. Deliberately low contrast in ALBEDO — the roadbed is meant to read
// as smooth against noisy ground, so anything stronger there would undo the
// very thing that makes it look swept — and considerably stronger in RELIEF,
// which is the half of it the sun does the work on.
function makeSurfaceMaps(): Surface | null {
  const SIZE = 512
  const albedoCanvas = document.createElement('canvas')
  const normalCanvas = document.createElement('canvas')
  albedoCanvas.width = albedoCanvas.height = SIZE
  normalCanvas.width = normalCanvas.height = SIZE
  const actx = albedoCanvas.getContext('2d')
  const nctx = normalCanvas.getContext('2d')
  if (!actx || !nctx) return null

  // v runs ALONG the road and u across it, so a per-column value is a
  // longitudinal grain and a per-row value is a line across the lane.
  const streak = new Float32Array(SIZE)
  for (let x = 0; x < SIZE; x++) {
    streak[x] =
      (hash(x * 3.7) - 0.5) * 0.05 +
      (hash(Math.floor(x / 9) * 11.3) - 0.5) * 0.06 +
      (hash(Math.floor(x / 37) * 7.9) - 0.5) * 0.045
  }
  // Blade chatter. A grader riding a surface leaves faint regular ripples
  // across it, and their being REGULAR is the tell — no natural process on this
  // ground makes anything periodic. Amplitude-modulated by slow noise so it
  // comes and goes down the road rather than running as a perfect sine, and
  // phase-wobbled for the same reason. Both terms complete a whole number of
  // cycles per tile, so the pattern meets itself.
  const chatter = new Float32Array(SIZE)
  for (let y = 0; y < SIZE; y++) {
    const t = y / SIZE
    const swing = 0.45 + 0.55 * noise1(t, 6, 21.3)
    chatter[y] =
      Math.sin(t * Math.PI * 2 * 8 + noise1(t, 4, 5.1) * 3) * 0.017 * swing +
      Math.sin(t * Math.PI * 2 * 3 + 1.7) * 0.008
  }

  const height = new Float32Array(SIZE * SIZE)
  const img = actx.createImageData(SIZE, SIZE)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const grit = hash(x * 1.7 + y * 311.7) - 0.5
      const i = y * SIZE + x
      // Relief carries the grain, the chatter and the grit — the things that
      // actually stand off the surface. It does NOT carry the mottling below,
      // which is a patchiness in how well the crust took the sinter and has no
      // height to it at all.
      height[i] = streak[x] * 0.55 + chatter[y] + grit * 0.02
      const mottle =
        (noise2(x / SIZE, y / SIZE, 4, 3.1) - 0.5) * 0.055 +
        (noise2(x / SIZE, y / SIZE, 11, 8.7) - 0.5) * 0.035
      // The chatter is weighted DOWN in albedo and left at full strength in the
      // relief above, which is where it belongs: a blade ripple is a shape the
      // sun rakes across, not a change of colour. It is also the one periodic
      // thing on this surface, and the hardstand — whose grain runs on the map's
      // axes rather than along a road — crosses it with the longitudinal streak
      // at right angles. Any louder in albedo and the yard reads as woven cloth.
      const v = Math.round(
        THREE.MathUtils.clamp(
          1 + streak[x] + chatter[y] * 0.85 + grit * 0.07 + mottle,
          0,
          1
        ) * 255
      )
      const p = i * 4
      img.data[p] = v
      img.data[p + 1] = v
      img.data[p + 2] = v
      img.data[p + 3] = 255
    }
  }
  actx.putImageData(img, 0, 0)

  // Tangent-space normals from that height field. A normal map rather than a
  // bump map because bump is applied against the derivative of view position,
  // and a scene unit here is most of a lunar radius — any bumpScale small
  // enough to be sane is indistinguishable from none at all.
  //
  // Gentle, and that is a correction rather than a preference. One texel is
  // about a centimetre of ground, so a relief map strong enough to be obvious
  // is tilting the surface normal tens of degrees per centimetre — which is not
  // a swept crust, it is gravel, and it costs real average brightness under a
  // sun this low. Turned up far enough to read, it visibly greyed the whole
  // roadbed and the yard against the rest of the plan.
  const STRENGTH = 7
  const nrm = nctx.createImageData(SIZE, SIZE)
  const wrap = (k: number) => (k + SIZE) % SIZE
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = height[y * SIZE + wrap(x - 1)] - height[y * SIZE + wrap(x + 1)]
      const dy = height[wrap(y - 1) * SIZE + x] - height[wrap(y + 1) * SIZE + x]
      const nx = dx * STRENGTH
      const ny = dy * STRENGTH
      const inv = 1 / Math.hypot(nx, ny, 1)
      const p = (y * SIZE + x) * 4
      nrm.data[p] = Math.round((nx * inv * 0.5 + 0.5) * 255)
      nrm.data[p + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255)
      nrm.data[p + 2] = Math.round((inv * 0.5 + 0.5) * 255)
      nrm.data[p + 3] = 255
    }
  }
  nctx.putImageData(nrm, 0, 0)

  const albedo = new THREE.CanvasTexture(albedoCanvas)
  albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping
  albedo.colorSpace = THREE.SRGBColorSpace
  albedo.anisotropy = 16
  const normal = new THREE.CanvasTexture(normalCanvas)
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping
  normal.anisotropy = 16
  return { albedo, normal }
}

const NORMAL_SCALE = new THREE.Vector2(0.42, 0.42)

// A point on the plan, as a unit direction in scene space.
function planDir(eastM: number, northM: number) {
  const ll = capOffsetLatLon(eastM, northM)
  const v = latLonToVector3(ll.lat, ll.lon, 1)
  return new THREE.Vector3(v[0], v[1], v[2]).normalize()
}

// Seats a direction on the rendered terrain, plus a rise in meters.
function seat(dir: THREE.Vector3, radiusAt: RadiusAt, riseM: number) {
  const ll = vector3ToLatLon([dir.x, dir.y, dir.z])
  return dir.clone().multiplyScalar(radiusAt(ll.lat, ll.lon) + riseM * M_TO_UNITS)
}

function finish(
  positions: number[],
  colors: number[],
  uvs: number[],
  index: number[]
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  )
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(index)
  // Lit surfaces, so the windrows and camber need normals to shade with.
  geometry.computeVertexNormals()
  return geometry
}

function buildStreet(
  street: Street,
  streetIdx: number,
  line: Centreline,
  junctions: Junction[],
  radiusAt: RadiusAt
): { geometry: THREE.BufferGeometry; origin: THREE.Vector3; rocks: Rock[] } {
  const { plan, spans, lengthM } = line
  const stations = plan.length

  const centre: THREE.Vector3[] = []
  const up: THREE.Vector3[] = []
  for (let i = 0; i < stations; i++) {
    const d = planDir(plan[i].x, plan[i].y)
    up.push(d)
    centre.push(seat(d, radiusAt, 0))
  }

  // Vertices are stored relative to the road's midpoint. Absolute scene
  // coordinates are ~2 units for a body 1737 km across, which quantises to
  // 21 cm in float32 — enough to swallow a half-meter windrow whole and make
  // the bed shimmer through the ground it is cut into.
  const origin = centre[Math.floor(stations / 2)].clone()
  // A loop's grain has to come back round in step with itself, so the tiling is
  // stretched to a whole number of tiles rather than left to fall wherever the
  // circumference happens to end.
  const tiles = street.closed
    ? Math.max(1, Math.round(lengthM / TILE_M)) / (lengthM / TILE_M)
    : 1
  const wrap = (i: number) =>
    street.closed
      ? (i + stations) % stations
      : THREE.MathUtils.clamp(i, 0, stations - 1)

  // Per-station, per-side windrow jitter, at the two scales a real heap has.
  // The geometry and the loose rock have to agree on where the crest is, so it
  // is drawn once here.
  //
  // The slow term is indexed in BANDS of about seven stations rather than in
  // stations, and is interpolated between them, so it comes out as a heap that
  // swells and thins over ~18 m instead of a step every few meters. Bands are
  // counted off the road's own station count so a closed loop's slow wander
  // closes on itself rather than showing a seam where it wraps.
  const bands = Math.max(3, Math.round(stations / 7))
  const crest = (i: number, sign: number) => {
    const w = wrap(i)
    const s = sign > 0 ? 1 : 0
    const band = (w / stations) * bands
    const b0 = Math.floor(band)
    const f = smoothstep(band - b0)
    const slowAt = (k: number) =>
      hash(streetIdx * 977 + (k % bands) * 13.1 + s * 3.7)
    const slow = slowAt(b0) + (slowAt(b0 + 1) - slowAt(b0)) * f
    const fast = hash(streetIdx * 613 + w * 2 + s)
    return {
      height: (0.5 + slow * 0.95) * (0.78 + fast * 0.44),
      spread: 0.93 + hash(streetIdx * 331 + w * 2.7 + s * 5.3) * 0.22,
    }
  }

  const width = line.widthScale
  // Fades are capped to a fraction of the road so a short link isn't all fade:
  // a 10 m spur given the full 4 m at each end has 2 m of road in the middle.
  const bedFade = Math.min(END_FADE_M, lengthM * 0.25)
  const bermFade = Math.min(BERM_FADE_M, lengthM * 0.45)
  const fade = (along: number, over: number) =>
    street.closed ? 1 : Math.min(1, along / over, (lengthM - along) / over)

  // The junctions on THIS road, and what it owes each of them. A station's
  // windrow is whichever is less, what its own ends allow it and what the
  // crossings allow it; its bed is whichever is MORE, because an end that lands
  // in a junction joins the road it meets rather than dissolving into it.
  const meets = junctionsOn(junctions, streetIdx)
  const bermAt = (i: number) => {
    const p = plan[wrap(i)]
    return Math.min(
      fade((wrap(i) / spans) * lengthM, bermFade),
      junctionBermLevel(p.x, p.y, meets)
    )
  }
  const bedAt = (i: number) => {
    const p = plan[wrap(i)]
    return Math.max(
      fade((wrap(i) / spans) * lengthM, bedFade),
      junctionBedCover(p.x, p.y, meets)
    )
  }

  const sides: THREE.Vector3[] = []
  const positions: number[] = []
  const colors: number[] = []
  const uvs: number[] = []
  const tone = new THREE.Color()
  for (let i = 0; i < stations; i++) {
    const prev = centre[wrap(i - 1)]
    const next = centre[wrap(i + 1)]
    // up × tangent, not the reverse. The quads below are wound assuming the
    // profile runs that way, and with the other handedness every triangle
    // faces into the ground and gets backface-culled — an invisible road.
    const side = up[i]
      .clone()
      .cross(new THREE.Vector3().subVectors(next, prev))
      .normalize()
    sides.push(side)
    const along = (i / spans) * lengthM
    const bedAlpha = bedAt(i)
    const bermLevel = bermAt(i)
    // A stretch of crust does not take the sinter as evenly as the stretch
    // before it. Very slight, and the reason it is here rather than in the
    // texture is that the texture tiles every 5 m: this is the variation at the
    // scale of a whole length of road, which is what stops it reading as an
    // extruded ribbon.
    const patch = 1 + (hash(streetIdx * 149 + wrap(i) * 1.7) - 0.5) * 0.055
    // One draw of the jitter per side, shared by every lane on it — the whole
    // windrow has to move together or its own lanes cross each other.
    const jitter = [crest(i, -1), crest(i, 1)]
    for (const lane of PROFILE) {
      const j = lane.wander ? jitter[lane.off > 0 ? 1 : 0] : null
      const off = (j ? lane.off * j.spread : lane.off) * width
      const rise =
        lane.crest && j
          ? lane.rise * (SWEPT_CREST + (j.height - SWEPT_CREST) * bermLevel)
          : lane.rise
      const p = centre[i]
        .clone()
        .addScaledVector(side, off * M_TO_UNITS)
        .addScaledVector(up[i], (LIFT_M + rise) * M_TO_UNITS)
        .sub(origin)
      positions.push(p.x, p.y, p.z)
      // Spoil that has been graded out of a crossing is swept ground, not a
      // dark stripe of rubble laid across the junction — so its tone comes back
      // toward the bed's by however much of the windrow has gone.
      tone.copy(lane.tone)
      if (lane.spoil) tone.lerp(BED, (1 - bermLevel) * SWEPT_TONE)
      colors.push(
        tone.r * patch,
        tone.g * patch,
        tone.b * patch,
        lane.alpha * bedAlpha
      )
      uvs.push(off / TILE_M, (along / TILE_M) * tiles)
    }
  }

  const index: number[] = []
  const quadRows = street.closed ? stations : stations - 1
  for (let i = 0; i < quadRows; i++) {
    const r0 = i * PROFILE.length
    const r1 = (street.closed ? (i + 1) % stations : i + 1) * PROFILE.length
    for (let k = 0; k < PROFILE.length - 1; k++) {
      index.push(r0 + k, r1 + k, r1 + k + 1)
      index.push(r0 + k, r1 + k + 1, r0 + k + 1)
    }
  }

  // Loose rock along the windrows. Placed between stations rather than on
  // them, so the boulders don't line up with the crest's own jitter.
  //
  // A loop only gets them on its OUTER flank. `side` is the tangent turned
  // +90°, which for counter-clockwise waypoints points into the loop, so that
  // is the flank to skip: the ring's inner windrow is the boundary of the
  // hardstand, and strewing it with boulders fences the yard off from the road
  // that serves it.
  const signedArea = plan.reduce((sum, p, i) => {
    const q = plan[(i + 1) % plan.length]
    return sum + (p.x * q.y - q.x * p.y)
  }, 0)
  const insideSign = street.closed ? (signedArea > 0 ? 1 : -1) : 0

  const rocks: Rock[] = []
  for (let i = 0; i < quadRows; i++) {
    // No boulders where the windrow has been graded flat — at an open end, and
    // above all in a junction, where a boulder standing in the crossing is the
    // single loudest thing that says these two roads were drawn separately.
    if (bermAt(i) < 0.995) continue
    const a = centre[i]
    const b = centre[wrap(i + 1)]
    for (const sign of [-1, 1]) {
      if (sign === insideSign) continue
      const j = crest(i, sign)
      for (let k = 0; k < ROCKS_PER_SPAN; k++) {
        const n = streetIdx * 7919 + i * 31 + k * 7 + (sign > 0 ? 3 : 0)
        const t = (k + 0.5) / ROCKS_PER_SPAN
        const sizeM =
          ROCK_MIN_M + (ROCK_MAX_M - ROCK_MIN_M) * hash(n) ** ROCK_SKEW
        // Scattered down the flanks of the heap, not balanced on its ridge.
        const off =
          sign * (CREST_OFF_M * j.spread * width + (hash(n + 1) - 0.5) * 1.9)
        // Sunk to roughly a third of their height, the way rock sits in spoil.
        const rise = LIFT_M + CREST_RISE_M * j.height * 0.55 + sizeM * 0.17
        rocks.push({
          pos: a
            .clone()
            .lerp(b, t)
            .addScaledVector(sides[i], off * M_TO_UNITS)
            .addScaledVector(up[i], rise * M_TO_UNITS),
          sizeM,
          tone: hash(n + 2),
        })
      }
    }
  }

  return { geometry: finish(positions, colors, uvs, index), origin, rocks }
}

// Rise above local grade, in meters, and opacity, at a fraction of the yard's
// radius.
function plazaAt(t: number): { rise: number; alpha: number } {
  for (let i = 1; i < PLAZA_PROFILE.length; i++) {
    const a = PLAZA_PROFILE[i - 1]
    const b = PLAZA_PROFILE[i]
    if (t <= b.r) {
      const f = b.r > a.r ? (t - a.r) / (b.r - a.r) : 0
      return {
        rise: a.rise + (b.rise - a.rise) * f,
        alpha: a.alpha + (b.alpha - a.alpha) * f,
      }
    }
  }
  return PLAZA_PROFILE[PLAZA_PROFILE.length - 1]
}

// The graded yard at the core, inside the ring. Without it the habitat stands
// on untouched regolith a few meters off a road, which reads as a building that
// happened to land next to one rather than as the middle of a worked site.
function buildHardstand(
  eastM: number,
  northM: number,
  radiusM: number,
  radiusAt: RadiusAt
): Pick<Piece, 'geometry' | 'origin'> {
  const origin = seat(planDir(eastM, northM), radiusAt, 0)

  const rings = Math.max(2, Math.round(radiusM / PLAZA_STATION_M)) + 1
  const positions: number[] = []
  const colors: number[] = []
  const uvs: number[] = []
  for (let r = 0; r < rings; r++) {
    const t = r / (rings - 1)
    const off = t * radiusM
    const { rise, alpha } = plazaAt(t)
    for (let s = 0; s < PLAZA_SPOKES; s++) {
      const a = (s / PLAZA_SPOKES) * Math.PI * 2
      const dx = Math.cos(a) * off
      const dy = Math.sin(a) * off
      const p = seat(
        planDir(eastM + dx, northM + dy),
        radiusAt,
        LIFT_M + rise
      ).sub(origin)
      positions.push(p.x, p.y, p.z)
      colors.push(BED.r, BED.g, BED.b, alpha)
      uvs.push(dx / TILE_M, dy / TILE_M)
    }
  }

  const index: number[] = []
  for (let r = 0; r < rings - 1; r++) {
    for (let s = 0; s < PLAZA_SPOKES; s++) {
      const s1 = (s + 1) % PLAZA_SPOKES
      const i0 = r * PLAZA_SPOKES + s
      const i1 = r * PLAZA_SPOKES + s1
      const j0 = (r + 1) * PLAZA_SPOKES + s
      const j1 = (r + 1) * PLAZA_SPOKES + s1
      index.push(i0, j0, j1)
      index.push(i0, j1, i1)
    }
  }
  return { geometry: finish(positions, colors, uvs, index), origin }
}

// The base shape every boulder is an instance of. A subdivided icosahedron
// pushed about by noise and flat-shaded, rather than the bare solid: broken
// rock has faces of wildly different sizes, and twenty identical equilateral
// ones read as dice however they are rotated. One geometry for the whole base,
// because per-instance rotation and a non-uniform squash are what carry the
// variety from there.
function makeRockGeometry() {
  const geo = new THREE.IcosahedronGeometry(0.5, 1)
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const n = v.clone().normalize()
    const bump =
      0.72 +
      0.34 * hash(n.x * 31.7 + n.y * 57.1 + n.z * 93.3) +
      0.14 * hash(n.x * 113.9 + n.y * 71.3 + n.z * 17.7)
    v.multiplyScalar(bump)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

// One draw call for a road's boulders. Instance transforms live in a float32
// buffer, so they are stored relative to the road's origin for the same reason
// its vertices are.
function buildRubble(
  rocks: Rock[],
  origin: THREE.Vector3,
  geo: THREE.BufferGeometry
) {
  const mat = new THREE.MeshStandardMaterial({
    roughness: 1,
    metalness: 0,
    flatShading: true,
  })
  const mesh = new THREE.InstancedMesh(geo, mat, rocks.length)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const s = new THREE.Vector3()
  const p = new THREE.Vector3()
  const tint = new THREE.Color()
  rocks.forEach((rock, i) => {
    const size = rock.sizeM * M_TO_UNITS
    e.set(
      hash(i * 1.3) * Math.PI * 2,
      hash(i * 2.7) * Math.PI * 2,
      hash(i * 5.1) * Math.PI * 2
    )
    q.setFromEuler(e)
    // Squashed a little, so they read as broken slabs rather than marbles.
    s.set(
      size,
      size * (0.5 + hash(i * 9.4) * 0.42),
      size * (0.74 + hash(i * 3.3) * 0.5)
    )
    p.copy(rock.pos).sub(origin)
    mesh.setMatrixAt(i, m.compose(p, q, s))
    // The big ones run darker: a boulder is freshly broken rock with real
    // shadow on it, where the gravel is half-buried in the bright fines it is
    // lying in and takes their tone.
    const buried = 1 - THREE.MathUtils.clamp(rock.sizeM / ROCK_MAX_M, 0, 1)
    const v = 0.38 + rock.tone * 0.14 + buried * 0.1
    mesh.setColorAt(i, tint.setRGB(v, v * 0.985, v * 0.95))
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.castShadow = false
  mesh.receiveShadow = true
  mesh.raycast = NO_RAYCAST
  return mesh
}

function RoadPiece({
  piece,
  surface,
  opacity,
}: {
  piece: Piece
  surface: Surface | null
  opacity: number
}) {
  // The boulders take the road's fade too, but their material is built
  // imperatively alongside the instance buffer rather than declared in JSX.
  useEffect(() => {
    const mat = piece.rubble?.material as THREE.MeshStandardMaterial | undefined
    if (!mat) return
    mat.transparent = opacity < 1
    mat.opacity = opacity
    mat.needsUpdate = true
  }, [piece, opacity])

  if (opacity <= 0) return null
  return (
    <group position={piece.origin}>
      <mesh geometry={piece.geometry} receiveShadow raycast={NO_RAYCAST}>
        <meshStandardMaterial
          map={surface?.albedo ?? undefined}
          normalMap={surface?.normal ?? undefined}
          normalScale={NORMAL_SCALE}
          vertexColors
          roughness={0.96}
          metalness={0}
          transparent
          opacity={opacity}
          // Ground-hugging and never occluding anything, so writing depth only
          // risks sorting artefacts against the terrain it hovers a few
          // centimetres over.
          depthWrite={false}
        />
      </mesh>
      {piece.rubble && <primitive object={piece.rubble} />}
    </group>
  )
}

// The ring and the yard arrive with the settlement. A spur waits for whatever
// stands at the end of it, and on the same threshold the model itself uses —
// otherwise a road runs out to a plot the hardware hasn't landed on yet.
function roadPresence(
  piece: Piece,
  presence: number,
  siteOpacity?: Map<string, number>
) {
  if (!piece.serves) return presence
  const served = Math.max(
    0,
    ...piece.serves.map((s) => siteOpacity?.get(s) ?? 0)
  )
  return served > MODEL_PRESENCE ? Math.min(presence, served) : 0
}

export default function BaseRoads({
  radiusAt,
  presence = 1,
  siteOpacity,
}: {
  radiusAt?: RadiusAt | null
  // How far along the timeline the settlement is, 0–1. The groundworks come in
  // with the first hardware rather than sitting on an empty plain years early.
  presence?: number
  // Per-site presence, so a spur is only graded once there is something at the
  // end of it to drive to.
  siteOpacity?: Map<string, number>
}) {
  const surface = useMemo(makeSurfaceMaps, [])
  useEffect(
    () => () => {
      surface?.albedo.dispose()
      surface?.normal.dispose()
    },
    [surface]
  )

  const pieces = useMemo(() => {
    if (!radiusAt) return { list: [] as Piece[], rockGeometry: null }
    const out: Piece[] = []
    const hub = BASE_PLAN[HARDSTAND.site]
    if (hub) {
      out.push({
        key: 'hardstand',
        // Out to the perimeter road's windrow rather than to the figure the
        // core district is PACKED to — see PLAZA_RADIUS_M. Never smaller than
        // that figure, so a plan that grew the core past the road would still
        // get a yard its own district fits in rather than one silently cropped
        // to the road's radius.
        ...buildHardstand(
          hub.east,
          hub.north,
          Math.max(HARDSTAND.radius, PLAZA_RADIUS_M),
          radiusAt
        ),
      })
    }

    // Every centreline first, then every crossing between them, and only then
    // the geometry: a road cannot be built until it knows where it is met.
    const lines = BASE_STREETS.map(centreline)
    const junctions = findJunctions(lines)
    const rockGeometry = makeRockGeometry()

    BASE_STREETS.forEach((street, i) => {
      const line = lines[i]
      if (!line) return
      const built = buildStreet(street, i, line, junctions, radiusAt)
      out.push({
        key: `street-${i}`,
        geometry: built.geometry,
        origin: built.origin,
        serves: street.serves,
        rubble:
          built.rocks.length > 0
            ? buildRubble(built.rocks, built.origin, rockGeometry)
            : undefined,
      })
    })
    return { list: out, rockGeometry }
  }, [radiusAt])

  useEffect(
    () => () => {
      pieces.list.forEach((p) => {
        p.geometry.dispose()
        ;(p.rubble?.material as THREE.Material | undefined)?.dispose()
        p.rubble?.dispose()
      })
      // Shared across every road, so it is disposed once here rather than with
      // whichever piece happens to be torn down first.
      pieces.rockGeometry?.dispose()
    },
    [pieces]
  )

  if (pieces.list.length === 0 || presence <= 0) return null
  return (
    <group>
      {pieces.list.map((p) => (
        <RoadPiece
          key={p.key}
          piece={p}
          surface={surface}
          opacity={roadPresence(p, presence, siteOpacity)}
        />
      ))}
    </group>
  )
}
