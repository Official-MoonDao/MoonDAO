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
// realism lives in two places.
//
// The EDGE is a rubble berm — an irregular windrow of pushed-aside rock whose
// crest wanders in height and offset from meter to meter, with loose boulders
// strewn along it. That ragged, unsurveyed line is the single strongest cue
// that the road was cut by a machine rather than drawn on the ground, and a
// tidy geometric kerb actively destroys it.
//
// The SURFACE is defined by smoothness, not colour. The terrain around it is a
// noisy hillshade full of craterlets; the roadbed is a near-uniform crust with
// nothing but a faint grading grain and two shallow wheel tracks down it. That
// contrast is what makes it read as swept, and it survives at any distance,
// whereas a tint only ever reads as a stain.
//
// Everything is LIT and takes light like the hardware standing on it, which is
// what the berms are for: they are the only part with enough relief to catch
// the low sun on one face and shade the other.

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import {
  BASE_PLAN,
  BASE_STREETS,
  HARDSTAND,
  type Street,
} from '@/lib/lunar-atlas/baseplan'
import { latLonToVector3, vector3ToLatLon } from '@/lib/lunar-atlas/geo'
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
  // Berm lanes get their crest height and offset jittered per station, so the
  // windrow wanders instead of running dead straight.
  berm?: boolean
}

// Nominal windrow crest: how far the spoil stands above grade, and how far off
// the centreline it is heaped. Both are jittered per station.
const CREST_RISE_M = 0.55
const CREST_OFF_M = 5.4

// Road cross-section: offset from the centreline and rise above the local
// grade, both in meters. A 9.4 m sintered lane, faintly cambered, between two
// rubble windrows. Only the outer toes are transparent, so the spoil dies into
// the regolith without the lane itself having a soft edge.
const PROFILE: Lane[] = [
  { off: -6.3, rise: 0.0, tone: SPOIL, alpha: 0, berm: true },
  { off: -CREST_OFF_M, rise: CREST_RISE_M, tone: RUBBLE, alpha: 1, berm: true },
  { off: -4.7, rise: 0.1, tone: RUBBLE, alpha: 1 },
  { off: -4.35, rise: 0.13, tone: BED, alpha: 1 },
  { off: -2.4, rise: 0.16, tone: BED, alpha: 1 },
  { off: -1.6, rise: 0.11, tone: TRACK, alpha: 1 },
  { off: -0.8, rise: 0.16, tone: BED, alpha: 1 },
  { off: 0.8, rise: 0.16, tone: BED, alpha: 1 },
  { off: 1.6, rise: 0.11, tone: TRACK, alpha: 1 },
  { off: 2.4, rise: 0.16, tone: BED, alpha: 1 },
  { off: 4.35, rise: 0.13, tone: BED, alpha: 1 },
  { off: 4.7, rise: 0.1, tone: RUBBLE, alpha: 1 },
  { off: CREST_OFF_M, rise: CREST_RISE_M, tone: RUBBLE, alpha: 1, berm: true },
  { off: 6.3, rise: 0.0, tone: SPOIL, alpha: 0, berm: true },
]

// Enough to clear z-fighting against the terrain the bed is cut into, far less
// than the eye can read as a step at any distance the camera reaches.
const LIFT_M = 0.12
// One station roughly every 2.5 m of road: close enough that the bed follows
// the terrain's undulations, and that the berm's jitter reads as rubble rather
// than as a slow wave.
const STATION_SPACING_M = 2.5
// Meters over which an open end fades out. Short: a road should stop, not
// dissolve. Spurs that run into the facility they serve never reach it.
const END_FADE_M = 4
// The windrow, though, dies out much further back, and its crest is flattened
// as it goes rather than just made transparent. Two reasons, and they are the
// difference between a network and a pile of roads that happen to touch:
// a grader joining an existing route doesn't heap its spoil across it, and a
// junction with a half-meter wall of rubble through it doesn't read as one.
const BERM_FADE_M = 11
// Meters of road per tile of the surface grain.
const TILE_M = 5

// Loose rock strewn along the windrows: one every ~1.25 m of each side.
const ROCKS_PER_SPAN = 2
const ROCK_MIN_M = 0.34
const ROCK_MAX_M = 0.95

// Hardstand cross-section: rise above local grade at a fraction of its radius.
// Flat, and with no edge treatment of its own — the ring road's inner windrow
// is its boundary. This is only the PROFILE. It is not the tessellation, and
// the yard used to be built as a fan straight off these four radii, which is
// what put the regolith back through the middle of it: every vertex is seated
// on the rendered ground (see `seat`), so the yard clears that ground by its
// lift only AT a vertex, and in between it runs dead straight while the terrain
// keeps following its own ~15.6 m polygon pitch (CAP_GRID over CAP_EXTENT_M).
// Sampled at these radii alone the innermost band chords across 36 m of a 60 m
// yard, and on ridge terrain rough enough to vary a meter from one terrain node
// to the next — a few degrees of slope, which this site has — the ground rises
// through the chord by up to ~1 m across a tenth of the yard's area.
const PLAZA_PROFILE: { r: number; rise: number }[] = [
  { r: 0, rise: 0.2 },
  { r: 0.6, rise: 0.18 },
  { r: 0.93, rise: 0.15 },
  { r: 1, rise: 0.08 },
]
// So the yard is triangulated on stations of its own, at the spacing the roads
// already use for exactly the same reason — following the ground closely enough
// that LIFT_M is a real clearance rather than a clearance at the corners. This
// is also why the roads never showed the artefact the yard did.
const PLAZA_STATION_M = STATION_SPACING_M
// Enough spokes to put the rim's circumferential pitch on the same order, so
// the mesh hugs the ground going around the yard as well as out across it.
const PLAZA_SPOKES = 144

const NO_RAYCAST = () => {}

// Deterministic value noise, so the rubble is identical on every load.
function hash(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
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

// The graded crust: near-uniform, with a faint longitudinal grain from the
// blade and a fine sintering speckle. Deliberately low contrast — the roadbed
// is meant to read as smooth against noisy ground, so anything stronger here
// would undo the very thing that makes it look swept.
function makeSurfaceTexture() {
  const SIZE = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const img = ctx.createImageData(SIZE, SIZE)
  // Per-column bias gives the grading grain; it tiles because the columns are
  // hashed by index and the pattern is only ever sampled at integer columns.
  const streak: number[] = []
  for (let x = 0; x < SIZE; x++) {
    streak[x] =
      (hash(x * 3.7) - 0.5) * 0.05 + (hash(Math.floor(x / 9) * 11.3) - 0.5) * 0.06
  }
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const grain = (hash(x * 1.7 + y * 311.7) - 0.5) * 0.07
      const v = Math.round(THREE.MathUtils.clamp(1 + streak[x] + grain, 0, 1) * 255)
      const i = (y * SIZE + x) * 4
      img.data[i] = v
      img.data[i + 1] = v
      img.data[i + 2] = v
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 16
  return tex
}

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
  radiusAt: RadiusAt
): { geometry: THREE.BufferGeometry; origin: THREE.Vector3; rocks: Rock[] } | null {
  if (street.points.length < 2) return null

  // Spline the centreline through the waypoints in the flat map frame — over
  // 150 m of a 1737 km sphere the curvature is far below the width of the road
  // — so a handful of hand-placed corners comes out as a graded curve.
  const curve = new THREE.CatmullRomCurve3(
    street.points.map(([e, n]) => new THREE.Vector3(e, n, 0)),
    !!street.closed,
    'catmullrom',
    0.4
  )
  const lengthM = curve.getLength()
  const spans = Math.max(8, Math.round(lengthM / STATION_SPACING_M))
  // A closed loop's first and last stations are the same point, and letting
  // both exist leaves a hairline seam; the index wraps to station 0 instead.
  const plan = curve.getSpacedPoints(spans)
  const stations = street.closed ? spans : spans + 1

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

  // Per-station, per-side windrow jitter. The geometry and the loose rock have
  // to agree on where the crest is, so it is drawn once here.
  const crest = (i: number, sign: number) => {
    const n = streetIdx * 977 + wrap(i) * 2 + (sign > 0 ? 1 : 0)
    return { height: 0.55 + hash(n) * 0.85, spread: 0.9 + hash(n + 0.5) * 0.3 }
  }

  const width = street.width ?? 1
  // Fades are capped to a fraction of the road so a short link isn't all fade:
  // a 10 m spur given the full 4 m at each end has 2 m of road in the middle.
  const bedFade = Math.min(END_FADE_M, lengthM * 0.25)
  const bermFade = Math.min(BERM_FADE_M, lengthM * 0.45)
  const fade = (along: number, over: number) =>
    street.closed
      ? 1
      : Math.min(1, along / over, (lengthM - along) / over)

  const sides: THREE.Vector3[] = []
  const positions: number[] = []
  const colors: number[] = []
  const uvs: number[] = []
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
    const endFade = fade(along, bedFade)
    const bermLevel = fade(along, bermFade)
    for (const lane of PROFILE) {
      const j = lane.berm ? crest(i, Math.sign(lane.off)) : null
      const off = (j ? lane.off * j.spread : lane.off) * width
      const rise = j ? lane.rise * j.height * bermLevel : lane.rise
      const p = centre[i]
        .clone()
        .addScaledVector(side, off * M_TO_UNITS)
        .addScaledVector(up[i], (LIFT_M + rise) * M_TO_UNITS)
        .sub(origin)
      positions.push(p.x, p.y, p.z)
      colors.push(lane.tone.r, lane.tone.g, lane.tone.b, lane.alpha * endFade)
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
    // No boulders where the windrow has been graded flat into a junction.
    const along = (i / spans) * lengthM
    if (fade(along, bermFade) < 1) continue
    const a = centre[i]
    const b = centre[wrap(i + 1)]
    for (const sign of [-1, 1]) {
      if (sign === insideSign) continue
      const j = crest(i, sign)
      for (let k = 0; k < ROCKS_PER_SPAN; k++) {
        const n = streetIdx * 7919 + i * 31 + k * 7 + (sign > 0 ? 3 : 0)
        const t = (k + 0.5) / ROCKS_PER_SPAN
        const sizeM = ROCK_MIN_M + hash(n) * (ROCK_MAX_M - ROCK_MIN_M)
        // Scattered down the flanks of the heap, not balanced on its ridge.
        const off =
          sign * (CREST_OFF_M * j.spread * width + (hash(n + 1) - 0.5) * 1.6)
        // Sunk to roughly a third of their height, the way rock sits in spoil.
        const rise =
          LIFT_M + CREST_RISE_M * j.height * 0.55 + sizeM * 0.17
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

// Rise above local grade, in meters, at a fraction of the yard's radius.
function plazaRise(t: number): number {
  for (let i = 1; i < PLAZA_PROFILE.length; i++) {
    const a = PLAZA_PROFILE[i - 1]
    const b = PLAZA_PROFILE[i]
    if (t <= b.r) {
      const f = b.r > a.r ? (t - a.r) / (b.r - a.r) : 0
      return a.rise + (b.rise - a.rise) * f
    }
  }
  return PLAZA_PROFILE[PLAZA_PROFILE.length - 1].rise
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
    const rise = plazaRise(t)
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
      colors.push(BED.r, BED.g, BED.b, 1)
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

// One draw call for a road's boulders. Instance transforms live in a float32
// buffer, so they are stored relative to the road's origin for the same reason
// its vertices are.
function buildRubble(rocks: Rock[], origin: THREE.Vector3) {
  const geo = new THREE.IcosahedronGeometry(0.5, 0)
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
    s.set(size, size * (0.55 + hash(i * 9.4) * 0.4), size * (0.8 + hash(i * 3.3) * 0.4))
    p.copy(rock.pos).sub(origin)
    mesh.setMatrixAt(i, m.compose(p, q, s))
    const v = 0.42 + rock.tone * 0.16
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
  surface: THREE.Texture | null
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
          map={surface ?? undefined}
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
  const surface = useMemo(makeSurfaceTexture, [])
  useEffect(() => () => surface?.dispose(), [surface])

  const pieces = useMemo(() => {
    if (!radiusAt) return [] as Piece[]
    const out: Piece[] = []
    const hub = BASE_PLAN[HARDSTAND.site]
    if (hub) {
      out.push({
        key: 'hardstand',
        ...buildHardstand(hub.east, hub.north, HARDSTAND.radius, radiusAt),
      })
    }
    BASE_STREETS.forEach((street, i) => {
      const built = buildStreet(street, i, radiusAt)
      if (!built) return
      out.push({
        key: `street-${i}`,
        geometry: built.geometry,
        origin: built.origin,
        serves: street.serves,
        rubble:
          built.rocks.length > 0
            ? buildRubble(built.rocks, built.origin)
            : undefined,
      })
    })
    return out
  }, [radiusAt])

  useEffect(
    () => () => {
      pieces.forEach((p) => {
        p.geometry.dispose()
        p.rubble?.geometry.dispose()
        ;(p.rubble?.material as THREE.Material | undefined)?.dispose()
        p.rubble?.dispose()
      })
    },
    [pieces]
  )

  if (pieces.length === 0 || presence <= 0) return null
  return (
    <group>
      {pieces.map((p) => (
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
