// The rock that was here before the base was.
//
// Open lunar ground is not bare. It is strewn with impact ejecta at every size
// from sand up, and the size distribution is a steep power law: for every boulder
// there are hundreds of cobbles. A plain with a few dozen identical boulders on
// an otherwise perfectly clean surface is one of the strongest "this is a game
// level" cues there is, and it is what this base stood on.
//
// The population cannot simply be drawn. At the density the ground actually
// carries — a stone every couple of square metres — the two and a half square
// kilometres around the base hold over a million of them, nearly all under a
// pixel from wherever the camera is. So it is drawn in two layers:
//
//   BOULDERS, half a metre and up, placed once across the whole base. These are
//   the rocks that are visible from the overview, and there are few enough of
//   them to be permanent.
//
//   COBBLES, fist-sized to half a metre, which exist only in a disc around
//   whatever the camera is looking at and are re-laid as it moves. Every stone's
//   position, size and shape is a pure function of the grid cell it lies in, so
//   the same stone is in the same place every time the camera comes back — the
//   window moves, the ground under it does not.
//
// Both are seated on the rendered terrain, part buried (see rocks.ts), lit by the
// regolith BRDF, and cast shadows. Instance transforms are float32, so they are
// stored relative to the colony centre for the same reason the roads' vertices
// are (see buildCapGeometry).
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { onRoad, withinDistrictGround } from '@/lib/lunar-atlas/baseplan'
import { latLonToVector3 } from '@/lib/lunar-atlas/geo'
import { HOME_GROUND } from '@/lib/lunar-atlas/homeview'
import { M_TO_UNITS, capLocalDirection, capOffsetLatLon } from '@/lib/lunar-atlas/southpole'
import { ROCK_VARIANTS, makeRockMaterial, rockGeometry } from './rocks'
import type { RadiusAt } from './useTerrainSampler'

// Centre of the scatter in the plan frame — the colony centre (see homeview).
const CENTRE_EAST_M = 85
const CENTRE_NORTH_M = 65
// Full density inside the first radius, thinning to nothing at the second, so
// the field has no edge the eye can find.
const FIELD_INNER_M = 520
const FIELD_OUTER_M = 900

const ROCK_COUNT = 2600
// Smallest and largest boulder, across the widest axis.
const ROCK_MIN_M = 0.5
const ROCK_MAX_M = 2.8
// Cumulative size-frequency exponent: N(>D) ~ D^-ALPHA. Surveyor and Apollo site
// counts run about 2 to 3.
const ROCK_ALPHA = 2.3
// Boulders at least this big get the highest-polygon shapes — a camera can stand
// next to them and see the silhouette.
const BOULDER_MIN_M = 1

// Share of the rocks that lie in strewn fields rather than at random.
const CLUSTER_SHARE = 0.45
const CLUSTER_COUNT = 70

const NO_RAYCAST = () => {}

type Rock = { east: number; north: number; size: number; variant: number; seed: number }

function scatter(): Rock[] {
  let s = 1337
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(rand() * Math.PI * 2)
  const clusters = Array.from({ length: CLUSTER_COUNT }, () => {
    const a = rand() * Math.PI * 2
    const r = Math.sqrt(rand()) * FIELD_OUTER_M * 0.85
    return {
      east: CENTRE_EAST_M + Math.cos(a) * r,
      north: CENTRE_NORTH_M + Math.sin(a) * r,
      // A strewn field is a few metres to a few tens of metres across.
      spread: 5 + rand() * 22,
      // Fresh ejecta is blockier than the background population.
      coarse: 1 + rand() * 1.2,
    }
  })
  const lo = Math.pow(ROCK_MIN_M, -ROCK_ALPHA)
  const hi = Math.pow(ROCK_MAX_M, -ROCK_ALPHA)
  const out: Rock[] = []
  let guard = ROCK_COUNT * 6
  while (out.length < ROCK_COUNT && guard-- > 0) {
    let east: number
    let north: number
    let coarse = 1
    if (rand() < CLUSTER_SHARE) {
      const c = clusters[Math.floor(rand() * clusters.length)]
      east = c.east + gauss() * c.spread
      north = c.north + gauss() * c.spread
      coarse = c.coarse
    } else {
      const a = rand() * Math.PI * 2
      const r = Math.sqrt(rand()) * FIELD_OUTER_M
      east = CENTRE_EAST_M + Math.cos(a) * r
      north = CENTRE_NORTH_M + Math.sin(a) * r
    }
    const dist = Math.hypot(east - CENTRE_EAST_M, north - CENTRE_NORTH_M)
    const keep = 1 - THREE.MathUtils.smoothstep(dist, FIELD_INNER_M, FIELD_OUTER_M)
    if (rand() > keep) continue
    // Inverse-CDF sample of the truncated power law.
    const size = Math.min(ROCK_MAX_M, Math.pow(lo + rand() * (hi - lo), -1 / ROCK_ALPHA) * coarse)
    // A graded road has had its rock bladed off it, and a district's ground has
    // been cleared for what stands there.
    if (onRoad(east, north)) continue
    if (withinDistrictGround(east, north, 4)) continue
    out.push({ east, north, size, variant: Math.floor(rand() * ROCK_VARIANTS), seed: rand() })
  }
  return out
}

function buildMeshes(radiusAt: RadiusAt, material: THREE.Material) {
  const origin = new THREE.Vector3(...HOME_GROUND)
  const rocks = scatter()
  const groups = new Map<string, Rock[]>()
  for (const r of rocks) {
    const detail = r.size >= BOULDER_MIN_M ? 3 : 2
    const key = `${r.variant}:${detail}`
    const list = groups.get(key)
    if (list) list.push(r)
    else groups.set(key, [r])
  }

  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const tilt = new THREE.Quaternion()
  const e = new THREE.Euler()
  const scale = new THREE.Vector3()
  const p = new THREE.Vector3()
  const up = new THREE.Vector3()
  const Y = new THREE.Vector3(0, 1, 0)
  const tint = new THREE.Color()
  const meshes: THREE.InstancedMesh[] = []

  for (const [key, list] of groups) {
    const [variant, detail] = key.split(':').map(Number)
    const mesh = new THREE.InstancedMesh(rockGeometry(variant, detail), material, list.length)
    list.forEach((rock, i) => {
      const ll = capOffsetLatLon(rock.east, rock.north)
      const dir = latLonToVector3(ll.lat, ll.lon, 1)
      up.set(dir[0], dir[1], dir[2]).normalize()
      // Seated on the LOWEST ground under its footprint, so the downhill side of
      // a rock on a slope is buried rather than left overhanging.
      const reach = rock.size * 0.4
      let ground = radiusAt(ll.lat, ll.lon)
      for (const [de, dn] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const o = capOffsetLatLon(rock.east + de * reach, rock.north + dn * reach)
        ground = Math.min(ground, radiusAt(o.lat, o.lon))
      }
      p.copy(up).multiplyScalar(ground).sub(origin)
      // Upright to within a lean, at any heading. Never tumbled end over end:
      // the shapes are modelled with a buried base, and that base stays down.
      const h = rock.seed
      e.set(
        (((h * 7.3) % 1) - 0.5) * 0.45,
        h * Math.PI * 2 * 13,
        (((h * 3.7) % 1) - 0.5) * 0.45,
        'YXZ'
      )
      tilt.setFromEuler(e)
      q.setFromUnitVectors(Y, up).multiply(tilt)
      const stretch = 0.8 + ((h * 11.9) % 1) * 0.45
      scale.set(rock.size * M_TO_UNITS, rock.size * stretch * M_TO_UNITS, rock.size * M_TO_UNITS)
      mesh.setMatrixAt(i, m.compose(p, q, scale))
      // Rock to rock, tone varies more than soil does: different lithologies,
      // different amounts of dust.
      const v = 0.8 + ((h * 5.3) % 1) * 0.32
      mesh.setColorAt(i, tint.setRGB(v, v * 0.985, v * 0.955))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.position.copy(origin)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.raycast = NO_RAYCAST
    // The field spans the whole base, so its bounding sphere is always in view;
    // computing one per mesh would only cost the pass that concludes that.
    mesh.frustumCulled = false
    meshes.push(mesh)
  }
  return meshes
}

// ---------------------------------------------------------------------------
// Cobbles: the camera-following layer
// ---------------------------------------------------------------------------

// One candidate stone per cell of this grid. Small enough that the jittered
// positions show no lattice, large enough that two stones rarely overlap.
const CELL_M = 1.5
// Radius of the disc of ground that carries cobbles, around the camera's subject.
const COBBLE_REACH_M = 78
// Stones shrink to nothing over the outer part of the disc, so nothing pops.
const COBBLE_FADE_M = 22
// The disc is re-laid when the subject has moved this far from where it was laid.
const COBBLE_RELAY_M = 10
// How far ahead of the camera the disc is centred, at most.
const COBBLE_LEAD_M = 45
// Beyond this camera distance a cobble is under a pixel and the layer is skipped.
const COBBLE_MAX_VIEW_M = 420
const COBBLE_MIN_M = 0.06
const COBBLE_MAX_M = 0.5
const COBBLE_ALPHA = 2.1
// Share of cells that hold a stone: from nearly none on clean ground to most of
// them inside a strewn field. Which is which is decided by slow noise, so rock
// comes in patches the way ejecta lies rather than as an even sprinkle.
const COBBLE_DENSITY: [number, number] = [0.05, 0.8]
const STREWN_SCALE_M = 34
const COBBLE_SHAPES = 3

function cellHash(ix: number, iy: number, salt: number) {
  const s = Math.sin(ix * 127.1 + iy * 311.7 + salt * 74.7) * 43758.5453
  return s - Math.floor(s)
}

// Smooth value noise over the plan, in [0, 1].
function planNoise(x: number, y: number) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const a = cellHash(ix, iy, 9)
  const b = cellHash(ix + 1, iy, 9)
  const c = cellHash(ix, iy + 1, 9)
  const d = cellHash(ix + 1, iy + 1, 9)
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy
}

type CobbleLayer = {
  meshes: THREE.InstancedMesh[]
  // Plan position the disc was last laid around, or null before the first lay.
  laid: { east: number; north: number } | null
}

function Cobbles({ radiusAt, material }: { radiusAt: RadiusAt; material: THREE.Material }) {
  const controls = useThree((s) => s.controls) as { target?: THREE.Vector3 } | null
  const origin = useMemo(() => new THREE.Vector3(...HOME_GROUND), [])
  // Plan axes in scene space, to turn a world position into (east, north) metres.
  const frame = useMemo(() => {
    const east = new THREE.Vector3(...capLocalDirection(0, 0))
    const north = new THREE.Vector3(...capLocalDirection(90, 0))
    const ll = capOffsetLatLon(0, 0)
    const centre = new THREE.Vector3(...latLonToVector3(ll.lat, ll.lon, 1)).setLength(
      origin.length()
    )
    return { east, north, centre }
  }, [origin])

  const layer = useMemo<CobbleLayer>(() => {
    const cells = Math.ceil((COBBLE_REACH_M * 2) / CELL_M)
    // Upper bound per shape: every cell in the disc, split across the shapes.
    const capacity = Math.ceil(((Math.PI / 4) * cells * cells * COBBLE_DENSITY[1]) / COBBLE_SHAPES)
    const meshes = Array.from({ length: COBBLE_SHAPES * 2 }, (_, i) => {
      // Two polygon budgets per shape: pebbles are most of the count and are
      // never more than a few pixels.
      const detail = i < COBBLE_SHAPES ? 1 : 2
      const mesh = new THREE.InstancedMesh(
        rockGeometry(i % COBBLE_SHAPES, detail),
        material,
        capacity
      )
      mesh.count = 0
      mesh.position.copy(origin)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.raycast = NO_RAYCAST
      mesh.frustumCulled = false
      return mesh
    })
    return { meshes, laid: null }
  }, [material, origin])
  useEffect(() => () => layer.meshes.forEach((mesh) => mesh.dispose()), [layer])

  const scratch = useRef({
    focus: new THREE.Vector3(),
    m: new THREE.Matrix4(),
    q: new THREE.Quaternion(),
    tilt: new THREE.Quaternion(),
    e: new THREE.Euler(),
    scale: new THREE.Vector3(),
    p: new THREE.Vector3(),
    up: new THREE.Vector3(),
    tint: new THREE.Color(),
  })

  useFrame(({ camera }) => {
    const t = scratch.current
    if (controls?.target) t.focus.copy(controls.target)
    else {
      camera.getWorldDirection(t.focus)
      t.focus.multiplyScalar(camera.position.distanceTo(origin)).add(camera.position)
    }
    const viewM = camera.position.distanceTo(t.focus) / M_TO_UNITS
    if (viewM > COBBLE_MAX_VIEW_M) {
      if (layer.laid) {
        layer.meshes.forEach((mesh) => (mesh.count = 0))
        layer.laid = null
      }
      return
    }
    // Laid around a point at most COBBLE_LEAD_M down the line of sight, not around
    // the subject itself. From a camera standing on the ground the subject can be
    // most of the disc's radius away, which put the camera on the disc's rim and
    // left the foreground — the only place a cobble is more than a few pixels —
    // bare.
    t.p
      .copy(t.focus)
      .sub(camera.position)
      .multiplyScalar(Math.min(1, COBBLE_LEAD_M / Math.max(viewM, 1e-6)))
      .add(camera.position)
      .sub(frame.centre)
    const east = t.p.dot(frame.east) / M_TO_UNITS
    const north = t.p.dot(frame.north) / M_TO_UNITS
    if (
      layer.laid &&
      Math.hypot(east - layer.laid.east, north - layer.laid.north) < COBBLE_RELAY_M
    ) {
      return
    }
    layer.laid = { east, north }

    const counts = layer.meshes.map(() => 0)
    const lo = Math.pow(COBBLE_MIN_M, -COBBLE_ALPHA)
    const hi = Math.pow(COBBLE_MAX_M, -COBBLE_ALPHA)
    const Y = new THREE.Vector3(0, 1, 0)
    const i0 = Math.floor((east - COBBLE_REACH_M) / CELL_M)
    const i1 = Math.ceil((east + COBBLE_REACH_M) / CELL_M)
    const j0 = Math.floor((north - COBBLE_REACH_M) / CELL_M)
    const j1 = Math.ceil((north + COBBLE_REACH_M) / CELL_M)
    for (let ix = i0; ix <= i1; ix++) {
      for (let iy = j0; iy <= j1; iy++) {
        const e = (ix + cellHash(ix, iy, 1)) * CELL_M
        const n = (iy + cellHash(ix, iy, 2)) * CELL_M
        const dist = Math.hypot(e - east, n - north)
        if (dist > COBBLE_REACH_M) continue
        const strewn = THREE.MathUtils.smoothstep(
          planNoise(e / STREWN_SCALE_M, n / STREWN_SCALE_M) * 0.65 + planNoise(e / 9, n / 9) * 0.35,
          0.38,
          0.78
        )
        const density = COBBLE_DENSITY[0] + (COBBLE_DENSITY[1] - COBBLE_DENSITY[0]) * strewn
        if (cellHash(ix, iy, 3) > density) continue
        let size = Math.pow(lo + cellHash(ix, iy, 4) * (hi - lo), -1 / COBBLE_ALPHA)
        // Strewn fields are blockier as well as denser.
        size = Math.min(COBBLE_MAX_M, size * (1 + strewn * 0.8))
        if (onRoad(e, n)) continue
        if (withinDistrictGround(e, n, 2)) continue
        const shape = Math.floor(cellHash(ix, iy, 5) * COBBLE_SHAPES)
        const slot = shape + (size >= 0.2 ? COBBLE_SHAPES : 0)
        const mesh = layer.meshes[slot]
        const i = counts[slot]
        if (i >= mesh.instanceMatrix.count) continue

        const ll = capOffsetLatLon(e, n)
        const dir = latLonToVector3(ll.lat, ll.lon, 1)
        t.up.set(dir[0], dir[1], dir[2]).normalize()
        t.p.copy(t.up).multiplyScalar(radiusAt(ll.lat, ll.lon)).sub(origin)
        const h = cellHash(ix, iy, 6)
        t.e.set(
          (cellHash(ix, iy, 7) - 0.5) * 0.6,
          h * Math.PI * 2,
          (cellHash(ix, iy, 8) - 0.5) * 0.6,
          'YXZ'
        )
        t.q.setFromUnitVectors(Y, t.up).multiply(t.tilt.setFromEuler(t.e))
        const fade =
          1 - THREE.MathUtils.smoothstep(dist, COBBLE_REACH_M - COBBLE_FADE_M, COBBLE_REACH_M)
        const s = size * fade * M_TO_UNITS
        t.scale.set(s, s * (0.75 + cellHash(ix, iy, 10) * 0.5), s)
        mesh.setMatrixAt(i, t.m.compose(t.p, t.q, t.scale))
        const v = 0.8 + cellHash(ix, iy, 11) * 0.32
        mesh.setColorAt(i, t.tint.setRGB(v, v * 0.985, v * 0.955))
        counts[slot] = i + 1
      }
    }
    layer.meshes.forEach((mesh, slot) => {
      mesh.count = counts[slot]
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    })
  })

  return (
    <group>
      {layer.meshes.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
    </group>
  )
}

export default function RockField({ radiusAt }: { radiusAt?: RadiusAt | null }) {
  const material = useMemo(makeRockMaterial, [])
  useEffect(() => () => material.dispose(), [material])
  const meshes = useMemo(
    () => (radiusAt ? buildMeshes(radiusAt, material) : []),
    [radiusAt, material]
  )
  useEffect(() => () => meshes.forEach((mesh) => mesh.dispose()), [meshes])
  return (
    <group>
      {meshes.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
      {radiusAt && <Cobbles radiusAt={radiusAt} material={material} />}
    </group>
  )
}
