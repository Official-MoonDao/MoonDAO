// Native lunar rock: the shapes, and the material they are made of.
//
// Every rock on the base used to be an icosahedron — twenty identical triangles,
// flat-shaded, in a pale putty colour — and nothing in the scene read as more
// obviously synthetic. Two things were wrong with it and neither was the triangle
// count as such.
//
// SHAPE. Lunar rocks are impact ejecta: fragments of bedrock or breccia, broken
// along fractures and then rounded for a billion years by micrometeorite
// sandblasting. So they are neither spheres nor crystals. They are lumps with a
// few large flat fracture faces, edges knocked back, and a pitted skin. That is
// what buildRockGeometry makes: a noise-displaced sphere, clipped by a handful of
// random planes (the fractures), then roughened; shaded smooth except across the
// fracture edges, which stay crisp.
//
// SEATING. A rock that has sat on the Moon since before there were trilobites is
// not resting ON the soil. It is partly buried, with fines banked against its
// sides. Each shape here is modelled with its ground line at y = 0 and a third of
// its bulk below that, so an instance placed at grade is automatically embedded,
// and its vertex colours darken toward the ground line the way the real thing
// does where it meets its own shadowed fillet. That, plus a cast shadow, is the
// whole difference between a rock and a floating prop.
import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  GRADED_SURFACE_FRAGMENT_PATCHES,
  GRADED_SURFACE_VERTEX_PATCHES,
  applyShaderPatches,
} from '@/lib/lunar-atlas/regolithShader'
import { bindOcclusionUniforms } from './regolithOcclusion'

// Fraction of a rock's height that sits below grade.
export const ROCK_BURIAL = 0.3

function lcg(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

function hash3(x: number, y: number, z: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return s - Math.floor(s)
}

// Trilinear value noise in [-1, 1].
function noise3(x: number, y: number, z: number) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const fx = x - ix
  const fy = y - iy
  const fz = z - iz
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const sz = fz * fz * (3 - 2 * fz)
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  const c = (dx: number, dy: number, dz: number) => hash3(ix + dx, iy + dy, iz + dz)
  return (
    lerp(
      lerp(lerp(c(0, 0, 0), c(1, 0, 0), sx), lerp(c(0, 1, 0), c(1, 1, 0), sx), sy),
      lerp(lerp(c(0, 0, 1), c(1, 0, 1), sx), lerp(c(0, 1, 1), c(1, 1, 1), sx), sy),
      sz
    ) *
      2 -
    1
  )
}

// One rock, about one unit across, ground line at y = 0.
//
// `detail` is the icosphere subdivision: 2 (320 faces) is plenty for the gravel
// that is drawn by the thousand, 3 (1280) for a boulder a camera can walk up to.
export function buildRockGeometry(seed: number, detail = 2): THREE.BufferGeometry {
  const rand = lcg(seed + 1)
  const base = new THREE.IcosahedronGeometry(1, detail)
  const pos = base.getAttribute('position') as THREE.BufferAttribute
  const o = rand() * 100

  // Fracture planes. Offsets well inside the unit sphere so each takes a real
  // slice; five to eight of them leaves most rocks with two or three dominant
  // flats and the rest of the skin rounded.
  const planes: { n: THREE.Vector3; d: number }[] = []
  const planeCount = 5 + Math.floor(rand() * 4)
  for (let i = 0; i < planeCount; i++) {
    const n = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize()
    planes.push({ n, d: 0.5 + rand() * 0.32 })
  }
  // Slabby rather than spherical: fragments are usually flatter than they are wide.
  const squash = new THREE.Vector3(1, 0.5 + rand() * 0.35, 0.68 + rand() * 0.32)

  const v = new THREE.Vector3()
  const cut = new Float32Array(pos.count)
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    const d = v.clone()
    const lump =
      1 +
      0.2 * noise3(d.x * 1.4 + o, d.y * 1.4, d.z * 1.4) +
      0.1 * noise3(d.x * 3.1, d.y * 3.1 + o, d.z * 3.1)
    v.multiplyScalar(lump)
    for (const p of planes) {
      const over = v.dot(p.n) - p.d
      if (over > 0) {
        v.addScaledVector(p.n, -over)
        cut[i] = 1
      }
    }
    // Pitting, applied after the cuts so even a fracture face is not a mirror.
    v.multiplyScalar(1 + 0.035 * noise3(d.x * 9 + o, d.y * 9, d.z * 9 + o))
    v.multiply(squash)
    pos.setXYZ(i, v.x, v.y, v.z)
  }

  // Normalise to one unit across the widest horizontal axis, then drop the rock
  // so ROCK_BURIAL of its height is below y = 0.
  base.computeBoundingBox()
  const bb = base.boundingBox!
  const span = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z)
  const k = 1 / span
  const height = (bb.max.y - bb.min.y) * k
  const lift = -bb.min.y * k - height * ROCK_BURIAL
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k + lift, pos.getZ(i) * k)
  }
  base.setAttribute('cut', new THREE.BufferAttribute(cut, 1))

  // Smooth across the weathered skin, crisp across a fracture edge.
  const geo = toCreasedNormals(base, (38 * Math.PI) / 180)
  base.dispose()

  const p2 = geo.getAttribute('position') as THREE.BufferAttribute
  const n2 = geo.getAttribute('normal') as THREE.BufferAttribute
  const c2 = geo.getAttribute('cut') as THREE.BufferAttribute
  const colors = new Float32Array(p2.count * 3)
  const top = height * (1 - ROCK_BURIAL)
  for (let i = 0; i < p2.count; i++) {
    const y = p2.getY(i)
    // Darkening toward the ground line: the fillet where rock meets soil sees
    // almost none of the sky or the lit ground, and is the contact cue the eye
    // looks for first.
    const contact = THREE.MathUtils.smoothstep(y, -0.02, top * 0.45)
    let tone = 0.5 + 0.5 * contact
    // Dust settles on what faces up; a fresh fracture face is cleaner rock.
    tone *= 1 + 0.07 * Math.max(0, n2.getY(i))
    tone *= c2.getX(i) > 0.5 ? 1.06 : 0.97
    tone *= 1 + 0.07 * noise3(p2.getX(i) * 6 + o, y * 6, p2.getZ(i) * 6)
    colors[i * 3] = tone
    colors[i * 3 + 1] = tone
    colors[i * 3 + 2] = tone
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.deleteAttribute('cut')
  geo.computeBoundingSphere()
  return geo
}

// A small library of shapes, built once and shared by everything that draws rock.
const LIBRARY = new Map<string, THREE.BufferGeometry>()
export const ROCK_VARIANTS = 6

export function rockGeometry(variant: number, detail = 2): THREE.BufferGeometry {
  const v = ((Math.floor(variant) % ROCK_VARIANTS) + ROCK_VARIANTS) % ROCK_VARIANTS
  const key = `${v}:${detail}`
  let geo = LIBRARY.get(key)
  if (!geo) {
    geo = buildRockGeometry(v * 7919 + 17, detail)
    LIBRARY.set(key, geo)
  }
  return geo
}

// Rock is lit by the same law as the soil it is sitting in. On this world the
// distinction between the two does not survive contact with reality: every exposed
// surface is mantled in the same dust, and a boulder shaded Lambertian beside
// Hapke ground is four times too bright at these phase angles and reads as a
// polystyrene prop.
function rockShader(shader: THREE.WebGLProgramParametersWithUniforms) {
  bindOcclusionUniforms(shader.uniforms)
  shader.vertexShader = applyShaderPatches(shader.vertexShader, GRADED_SURFACE_VERTEX_PATCHES)
  shader.fragmentShader = applyShaderPatches(shader.fragmentShader, GRADED_SURFACE_FRAGMENT_PATCHES)
}

// Slightly warm, and close to the ground's own tint: this multiplies the same
// single-scattering albedo the terrain uses, so 1.0 is "exactly as bright as the
// soil". Rock runs a little brighter than mature soil, which has been darkened by
// space weathering in a way a rock's interior has not.
export const ROCK_TINT = new THREE.Color(1.08, 1.04, 0.98)

export function makeRockMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: ROCK_TINT,
    roughness: 1,
    metalness: 0,
    vertexColors: true,
  })
  mat.onBeforeCompile = rockShader
  mat.customProgramCacheKey = () => 'regolith-rock-v1'
  // Already carries the precise shadow lookup and has no use for hardware
  // detail, so SurfaceAnchor's material pass must leave it alone.
  mat.userData.hardwareFinished = true
  return mat
}
