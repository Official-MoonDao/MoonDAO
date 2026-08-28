// Disturbed regolith around every installation on Moon Base Zero.
//
// Nothing on the Moon ends up sitting on undisturbed soil. Landing exhaust,
// crews walking the same few paths, a machine that eats the ground it stands
// on — all of it churns the surface layer, and churned regolith is DARKER than
// the surface it came from. That is the one thing Apollo's own site photography
// makes unarguable: the tracks and the trampled ground around each LM read as
// dark stains against bright fines, because the undisturbed top layer is a
// loosely-packed, strongly backscattering crust and breaking it exposes the
// coarser, darker material under it. Hardware standing on clean ground is the
// most reliable tell that a lunar render is a render.
//
// WHY THIS ISN'T A DECAL ON THE MODEL. The obvious implementation — a disc
// parented to the installation, inside its SurfaceAnchor — cannot work here,
// and it's worth writing down why so nobody spends an afternoon rediscovering
// it. SurfaceAnchor aims a model's up at the local SPHERE normal, not at the
// slope of the ground actually under it. A disc lying in that tangent plane
// therefore cuts into the hill on the uphill side and lifts off it on the
// downhill side, by the slope times its own radius: on the couple of degrees
// this ridge routinely runs, a stain wide enough to be worth having is already
// a meter out at its rim. No lift value fixes that — raise it until the uphill
// edge stops z-fighting and the downhill edge is visibly flying.
//
// So the stains are built the way the roads and the hardstand are (see BaseRoads):
// tessellated on their own stations and seated per vertex on the rendered
// terrain, so they follow the ground instead of approximating it. Every patch
// then also gets a seeded, wandering outline rather than a true circle, and
// dies out in alpha at that outline rather than ending on an edge — a stain
// with a rim reads as a sticker, which is the other half of this looking real.

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { PATROL } from '@/lib/lunar-atlas/baseplan'
import { MOON_RADIUS_M, vector3ToLatLon } from '@/lib/lunar-atlas/geo'
import type { Vec3 } from '@/lib/lunar-atlas/geo'
import type { TechTree } from '@/lib/lunar-atlas/selectors'
import { M_TO_UNITS, capCenterDirection } from '@/lib/lunar-atlas/southpole'
import { GLOBE_RADIUS } from '@/lib/lunar-atlas/textures'
import type { ProjectType } from '@/lib/lunar-atlas/types'
import { MODEL_PRESENCE, type ColonyLayout } from './MarkerLayer'
import { footprintRadiusM } from './ProjectModel'
import type { RadiusAt } from './useTerrainSampler'

// How far the churn reaches past the hardware's own footprint, as a multiple
// of it. Kept close in on purpose: this is the ground a crew and its machines
// actually work over, not a halo, and a stain that reaches much further starts
// reading as a shadow the sun has no business casting.
const SPREAD = 1.9

// Cross-section of the stain: opacity at a fraction of the outer radius.
// Heaviest just outside the hardware's own edge (SPREAD's reciprocal, ~0.53 —
// the working ring where boots and wheels actually go) rather than dead
// centre, because the centre is under the installation where nobody treads and
// nothing is visible anyway.
const PROFILE: { t: number; a: number }[] = [
  { t: 0, a: 0.3 },
  { t: 0.53, a: 0.34 },
  { t: 0.8, a: 0.19 },
  { t: 1, a: 0 },
]

// Churned regolith, for blending over the terrain's own albedo. A dark warm
// grey rather than anything neutral: the material being exposed is the same
// soil, just broken and shadowed at grain scale, so it desaturates toward
// brown-grey rather than toward black.
const TONE = new THREE.Color('#5f584f')

// ---------------------------------------------------------------------------
// Blast scour under a lander
// ---------------------------------------------------------------------------
//
// A landing is not the same event as a work site, and it does not leave the
// same mark. Where boots and wheels break the surface and darken it, a descent
// engine at touchdown does the opposite: it sweeps the loose top layer off
// radially and packs what's left, and the result is BRIGHTER than the ground
// around it. This isn't a stylistic call — LRO found exactly this at every
// Apollo and Luna landing site, high-reflectance haloes tens of meters across
// centred on each descent stage, which is the single most direct piece of
// evidence anywhere about what human hardware does to lunar ground.
//
// It also reaches much further than a stain does, and it is streaked. Exhaust
// leaves the nozzle radially and scours in rays, so the halo fades outward
// through fingers rather than a smooth ramp — which is the detail that stops it
// reading as a soft airbrushed circle under the pad.
const SCOUR_SPREAD = 2.6
// ...but not without limit. A halo's extent is set by the exhaust's own energy
// against the cohesion of the ground, and LRO measures the real ones in TENS of
// meters — around an LM whose own footprint is about 9 m, so the ~2.6 multiple
// above is that observation, taken at LM scale. It does not keep scaling: a
// vehicle with a wider stance does not push the far edge of the scoured zone
// proportionally further out, and applying the multiple straight to the 31.2 m
// footprint of a Starship-class lander asks for an 81 m halo — wider than the
// 57 m to the next pad in the zone, so the neighbour's own halo would sit
// entirely inside it and the two would blend into one bright blob rather than
// reading as two landings. Capped, they overlap by 23 m instead, and the
// heaviest the two ever compound anywhere a pad's own deck isn't already
// covering the ground is 0.35, against a single halo's own peak of 0.34 —
// so the overlap reads as one continuous, unevenly scoured apron running
// between two pads rather than as a hotspot, which is what a working landing
// zone actually looks like. Both figures measured, not assumed.
const SCOUR_MAX_R = 55
const SCOUR_TONE = new THREE.Color('#c0b7a8')
const SCOUR_PROFILE: { t: number; a: number }[] = [
  { t: 0, a: 0.34 },
  { t: 0.38, a: 0.3 },
  { t: 0.7, a: 0.16 },
  { t: 1, a: 0 },
]
// Depth of the radial streaking, as a fraction of the local opacity. Applied
// scaled by distance out, because the ground directly under the engine is
// swept uniformly clean — the rays only separate further out, where there was
// less gas to do the work.
const SCOUR_STREAK = 0.45

type PatchStyle = {
  tone: THREE.Color
  profile: { t: number; a: number }[]
  // Outer radius as a multiple of the installation's own footprint.
  spread: number
  // Absolute ceiling on that radius, in meters, where the multiple stops being
  // physical past a certain size.
  maxR?: number
  streak: number
}

const CHURN_STYLE: PatchStyle = {
  tone: TONE,
  profile: PROFILE,
  spread: SPREAD,
  streak: 0,
}

const SCOUR_STYLE: PatchStyle = {
  tone: SCOUR_TONE,
  profile: SCOUR_PROFILE,
  spread: SCOUR_SPREAD,
  maxR: SCOUR_MAX_R,
  streak: SCOUR_STREAK,
}

// Real clearance above the sampled ground, in meters. Small — this is a change
// of albedo, not a raised bed like a road's sintered crust (LIFT_M there) — but
// not zero: coincident with the terrain it would z-fight, and this renderer's
// logarithmic depth buffer loses precision on ground-parallel surfaces sooner
// than a linear one would.
//
// Measured rather than guessed, with scripts/tmp-scuff-check.ts: across the
// real roster on terrain up to 5° of slope and ±2 m of node-scale roughness,
// the worst any ground rose through a patch's own straight run between
// stations was 0.13 m. This clears that with margin left, and the cost of the
// margin is nothing — the same sweep puts the furthest a patch ever flies above
// the ground at ~0.3 m, on a stain up to 60 m across, seen from a camera 100 m
// off. (The flat-disc version of this component, for the record, was punched
// through by 2 m of ground on DEAD LEVEL terrain and 7 m at 5°.)
const LIFT_M = 0.16

// Radial station spacing, in meters, for the same reason the roads and the
// hardstand have one: a patch only clears the ground by LIFT_M where it has a
// vertex, so it has to sample the terrain often enough that the straight run in
// between never rises through that clearance. Same spacing the roads use, and
// the sweep above is what says it's enough at this lift.
const STATION_M = 2.5
// Floors for the very small installations, so a 2 m rover's stain is still a
// round-ish patch and not a triangle.
const MIN_RINGS = 4
const MIN_SPOKES = 18

const NO_RAYCAST = () => {}

// Deterministic, so the churn is identical on every load — the stains are part
// of the site, not an animation.
function hash01(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

function profileAlpha(profile: { t: number; a: number }[], t: number): number {
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1]
    const b = profile[i]
    if (t <= b.t) {
      const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0
      return a.a + (b.a - a.a) * f
    }
  }
  return 0
}

// The wandering outline. Three harmonics with seeded phases, which is the
// cheapest shape that is smooth, never self-intersecting, and — because every
// term is periodic in the azimuth — exactly seamless where the last spoke meets
// the first. A patch built without this is a circle, and a circle on the ground
// reads as decoration however well it's toned.
function outlineScale(seed: number, az: number): number {
  const p1 = hash01(seed) * Math.PI * 2
  const p2 = hash01(seed + 1.7) * Math.PI * 2
  const p3 = hash01(seed + 3.3) * Math.PI * 2
  return (
    1 +
    0.17 * Math.sin(3 * az + p1) +
    0.1 * Math.sin(5 * az + p2) +
    0.06 * Math.sin(7 * az + p3)
  )
}

// Radial rays, as a multiplier on local opacity. High harmonics rather than the
// outline's low ones, and capped at the 23rd because the coarsest patch that
// uses this resolves ~63 spokes — enough to sample that cycle properly, where
// anything faster would alias into a moiré that turns as the camera does.
function streakScale(seed: number, az: number, t: number, depth: number) {
  const p1 = hash01(seed + 7.1) * Math.PI * 2
  const p2 = hash01(seed + 9.3) * Math.PI * 2
  const p3 = hash01(seed + 11.7) * Math.PI * 2
  const s =
    0.5 * Math.sin(7 * az + p1) +
    0.32 * Math.sin(13 * az + p2) +
    0.18 * Math.sin(23 * az + p3)
  return 1 + depth * t * s
}

type Patch = { dir: Vec3; radiusM: number; seed: number }

type Buffers = { positions: number[]; colors: number[]; index: number[] }

// One installation's stain, appended into shared buffers so a whole district
// comes out as a single draw call.
function addPatch(
  patch: Patch,
  style: PatchStyle,
  radiusAt: RadiusAt,
  origin: THREE.Vector3,
  out: Buffers
) {
  const d = new THREE.Vector3(...patch.dir).normalize()
  // A tangent basis at the patch centre, so the offsets below are real ground
  // distances on the sphere rather than anything the caller has to supply.
  const ref =
    Math.abs(d.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0)
  const u = new THREE.Vector3().crossVectors(ref, d).normalize()
  const w = new THREE.Vector3().crossVectors(d, u)

  const outerR = Math.min(
    patch.radiusM * style.spread,
    style.maxR ?? Infinity
  )
  const rings = Math.max(MIN_RINGS, Math.round(outerR / STATION_M)) + 1
  const spokes = Math.max(
    MIN_SPOKES,
    Math.round((2 * Math.PI * outerR) / STATION_M)
  )
  const base = out.positions.length / 3

  for (let ri = 0; ri < rings; ri++) {
    const t = ri / (rings - 1)
    const base = profileAlpha(style.profile, t)
    for (let s = 0; s < spokes; s++) {
      const az = (s / spokes) * Math.PI * 2
      const alpha = style.streak
        ? Math.max(
            0,
            base * streakScale(patch.seed, az, t, style.streak)
          )
        : base
      const r = t * outerR * outlineScale(patch.seed, az)
      const ang = r / MOON_RADIUS_M
      const cosA = Math.cos(ang)
      const sinA = Math.sin(ang)
      const p = d
        .clone()
        .multiplyScalar(cosA)
        .addScaledVector(u, Math.cos(az) * sinA)
        .addScaledVector(w, Math.sin(az) * sinA)
      const ll = vector3ToLatLon([p.x, p.y, p.z])
      const seat = radiusAt(ll.lat, ll.lon) + LIFT_M * M_TO_UNITS
      const v = p.multiplyScalar(seat).sub(origin)
      out.positions.push(v.x, v.y, v.z)
      out.colors.push(style.tone.r, style.tone.g, style.tone.b, alpha)
    }
  }

  for (let r = 0; r < rings - 1; r++) {
    for (let s = 0; s < spokes; s++) {
      const s1 = (s + 1) % spokes
      const i0 = base + r * spokes + s
      const i1 = base + r * spokes + s1
      const j0 = base + (r + 1) * spokes + s
      const j1 = base + (r + 1) * spokes + s1
      out.index.push(i0, j0, j1, i0, j1, i1)
    }
  }
}

export default function GroundDisturbance({
  trees,
  layout,
  radiusAt,
  siteOpacity,
}: {
  trees: TechTree[]
  layout: ColonyLayout
  radiusAt?: RadiusAt | null
  // Per-district presence, so the churn arrives with the hardware that made it
  // rather than lying on an empty plain years early. Per DISTRICT and not per
  // project on purpose: the geometry is built once and only its opacity is
  // animated, exactly as the roads do it, so dragging the timeline never
  // reseats a vertex.
  siteOpacity?: Map<string, number>
}) {
  // Vertices are stored RELATIVE to this and the offset put on the group's own
  // transform, which is not a nicety: a scene unit here is 868 km, so an
  // absolute vertex at magnitude ~2 can only be resolved to about 21 cm in a
  // float32 attribute. See buildCapGeometry for the full version of this.
  const origin = useMemo(
    () =>
      new THREE.Vector3(...capCenterDirection()).multiplyScalar(GLOBE_RADIUS),
    []
  )

  const pieces = useMemo(() => {
    if (!radiusAt) return []
    const out: { category: ProjectType; geometry: THREE.BufferGeometry }[] = []

    for (const tree of trees) {
      // A race whose hardware DRIVES never stands on its plots (see PATROL), so
      // there is no installation here for a stain to belong to. Its ground gets
      // worked over along the road it laps, which is the roads' business.
      if (PATROL[tree.category]) continue

      const buffers: Buffers = { positions: [], colors: [], index: [] }

      // What a lander leaves is a bright, streaked blast halo, not the dark
      // churn everything else leaves — see SCOUR_SPREAD.
      const style = tree.category === 'lander' ? SCOUR_STYLE : CHURN_STYLE
      let n = 0
      for (const project of tree.projects) {
        const plot = layout.plots.get(project.id)
        if (!plot) continue
        addPatch(
          {
            dir: plot.dir,
            radiusM: footprintRadiusM(project),
            // Seeded off the project id so a patch's outline is stable across
            // reloads and no two installations share a shape.
            seed: project.id.length * 31 + project.id.charCodeAt(0),
          },
          style,
          radiusAt,
          origin,
          buffers
        )
        n++
      }
      if (!n) continue

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(buffers.positions, 3)
      )
      geometry.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(buffers.colors, 4)
      )
      geometry.setIndex(buffers.index)
      out.push({ category: tree.category, geometry })
    }
    return out
  }, [trees, layout, radiusAt, origin])

  useEffect(
    () => () => {
      pieces.forEach((p) => p.geometry.dispose())
    },
    [pieces]
  )

  if (!pieces.length) return null

  return (
    <group position={origin}>
      {pieces.map(({ category, geometry }) => {
        const presence = siteOpacity?.get(category) ?? 1
        if (presence <= MODEL_PRESENCE) return null
        return (
          <mesh key={category} geometry={geometry} raycast={NO_RAYCAST}>
            {/* UNLIT, like the terrain it stains. The ground here is a baked
                hillshade on a MeshBasicMaterial (see SouthPoleTerrain), so a
                lit stain would shade against the sun while the ground under it
                didn't — going dark on slopes the terrain still renders bright.
                An albedo change has no business taking light of its own
                anyway. */}
            <meshBasicMaterial
              vertexColors
              transparent
              opacity={presence}
              // Ground-hugging and never occluding anything, so writing depth
              // only risks sorting artefacts against the terrain it lies a
              // hand's breadth over — the same call the roads make.
              depthWrite={false}
            />
          </mesh>
        )
      })}
    </group>
  )
}
