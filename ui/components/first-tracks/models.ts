/**
 * First Tracks models, all built from primitives at load.
 *
 *  - The lander is the MoonDAO lander from Touchdown, rebuilt here a size
 *    larger so that it can carry a rover inside: the same foil-wrapped
 *    eight-sided descent stage, tanks, legs, white upper deck, dish and
 *    MoonDAO mark. Its front face is a cargo bay. On the surface the bay's two
 *    doors have swung open, the rover's tray has slid out on its rails, and the
 *    ramp has unfolded from the tray's edge. (Touchdown's own model is left
 *    alone: its hull is one closed shape and cannot be opened.)
 *  - The rover is a small commercial-style rover in the same PBR materials:
 *    foil, white thermal panels, a solar deck, a mast camera, four wheels with
 *    grousers and the MoonDAO mark on its flanks.
 *
 * Geometry here must agree with the sim's rectangles in lib/first-tracks/site.ts
 * (DECK, RAMP, DECK_Y, the hull's size) and the rover's wheel positions.
 */
import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { DECK, DECK_Y, HALF_L, HALF_W, HULL_APOTHEM, HULL_R, LANDER_CENTER_Z, RAMP, WHEEL_R } from '@/lib/first-tracks/site'
import { mulberry32 } from '@/lib/touchdown/mission'
import { tileNoise, type Bag } from '@/components/touchdown/models'

type Std = THREE.MeshStandardMaterialParameters

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, bag: Bag, srgb = true): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  bag.push(t)
  return t
}

function noiseTexture(size: number, periods: number[], amps: number[], seed: number, bag: Bag): THREE.CanvasTexture {
  const data = tileNoise(size, periods, amps, seed)
  const t = canvasTexture(
    size,
    size,
    (g) => {
      const img = g.createImageData(size, size)
      for (let i = 0; i < size * size; i++) {
        const c = data[i] * 255
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = c
        img.data[i * 4 + 3] = 255
      }
      g.putImageData(img, 0, 0)
    },
    bag,
    false
  )
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Solar cells: a dark blue grid with bright bus lines. */
function solarTexture(cols: number, rows: number, bag: Bag): THREE.CanvasTexture {
  return canvasTexture(
    256,
    256,
    (g) => {
      g.fillStyle = '#12307a'
      g.fillRect(0, 0, 256, 256)
      const cw = 256 / cols
      const ch = 256 / rows
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          g.fillStyle = (i + j) % 2 ? '#173a8c' : '#143382'
          g.fillRect(i * cw + 1.5, j * ch + 1.5, cw - 3, ch - 3)
        }
      }
      g.strokeStyle = 'rgba(190,205,255,0.5)'
      g.lineWidth = 1
      for (let i = 0; i <= cols; i++) {
        g.beginPath()
        g.moveTo(i * cw, 0)
        g.lineTo(i * cw, 256)
        g.stroke()
      }
      for (let j = 0; j <= rows; j++) {
        g.beginPath()
        g.moveTo(0, j * ch)
        g.lineTo(256, j * ch)
        g.stroke()
      }
    },
    bag
  )
}

export type EgressLander = {
  group: THREE.Group
}

const RAMP_RUN = RAMP.z1 - RAMP.z0
const RAMP_LENGTH = Math.sqrt(RAMP_RUN * RAMP_RUN + DECK_Y * DECK_Y)
const RAMP_PITCH = Math.atan2(DECK_Y, RAMP_RUN)

/**
 * The MoonDAO lander with its cargo bay open: doors swung back, tray run out,
 * ramp down toward +z.
 */
export function buildEgressLander(env: THREE.Texture, logo: THREE.Texture | null, seed: number, bag: Bag): EgressLander {
  const group = new THREE.Group()
  const track = <T extends { dispose: () => void }>(x: T): T => {
    bag.push(x)
    return x
  }
  const std = (o: Std) => track(new THREE.MeshStandardMaterial({ envMap: env, envMapIntensity: 1, ...o }))
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x: number, y: number, z: number, parent: THREE.Object3D = group) => {
    const m = new THREE.Mesh(track(geo), mat)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    parent.add(m)
    return m
  }
  const up = new THREE.Vector3(0, 1, 0)
  const tube = (from: THREE.Vector3, to: THREE.Vector3, r: number, mat: THREE.Material, parent: THREE.Object3D = group) => {
    const d = to.clone().sub(from)
    const m = mesh(new THREE.CylinderGeometry(r, r, d.length(), 8), mat, 0, 0, 0, parent)
    m.position.copy(from).addScaledVector(d, 0.5)
    m.quaternion.setFromUnitVectors(up, d.normalize())
    return m
  }
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

  const crinkle = noiseTexture(128, [9, 23, 47], [1, 0.8, 0.5], seed ^ 0xf01, bag)
  crinkle.repeat.set(3, 2)
  const foil = std({ color: 0xffbf52, metalness: 1, roughness: 0.44, bumpMap: crinkle, bumpScale: 2.2 })
  const silver = std({ color: 0xd6dae2, metalness: 1, roughness: 0.3, bumpMap: crinkle, bumpScale: 1.2 })
  const white = std({ color: 0xc9cacf, metalness: 0.1, roughness: 0.6 })
  const dark = std({ color: 0x17181b, metalness: 0.75, roughness: 0.45 })
  const strut = std({ color: 0xc4c8d0, metalness: 1, roughness: 0.28 })
  const edgeMat = std({ color: 0xa9aeb6, metalness: 0.45, roughness: 0.55 })
  // The bay is lit by its own work light. A real point light would cost every pixel of terrain a second light.
  const liner = std({ color: 0x2b2d33, metalness: 0.3, roughness: 0.8, emissive: 0x4a4034, emissiveIntensity: 0.6 })

  // Everything on the lander is placed relative to its own centre line.
  const body = new THREE.Group()
  body.position.set(0, 0, LANDER_CENTER_Z)
  group.add(body)

  // --- Descent stage: an eight-sided foil drum, built face by face so the front can open ---
  const R = HULL_R
  const A = HULL_APOTHEM
  const faceW = 2 * R * Math.sin(Math.PI / 8)
  const y0 = 0.72
  const hullH = 1.78
  const yTop = y0 + hullH
  const openW = DECK.x1 - DECK.x0 + 0.04
  const openTop = DECK_Y + 1.42
  const wall = 0.045
  for (let i = 0; i < 8; i++) {
    // Face 0 looks down +z, toward the ramp.
    const holder = new THREE.Group()
    holder.rotation.y = (i * Math.PI) / 4
    body.add(holder)
    if (i !== 0) {
      mesh(new THREE.BoxGeometry(faceW + 0.03, hullH, wall), foil, 0, y0 + hullH / 2, A - wall / 2, holder)
      // MoonDAO mark on the three other faces that look down the main axes.
      if (logo && i % 2 === 0) {
        const img = logo.image as { width: number; height: number } | undefined
        const aspect = img && img.height ? img.width / img.height : 1
        const lh = 1.05
        const l = new THREE.Mesh(track(new THREE.PlaneGeometry(lh * aspect, lh)), track(new THREE.MeshBasicMaterial({ map: logo, transparent: true, depthWrite: false, toneMapped: false })))
        l.position.set(0, y0 + hullH / 2, A + 0.004)
        holder.add(l)
      }
      continue
    }
    // The front face is the bay's mouth: a sill, a lintel and two narrow jambs round the opening.
    mesh(new THREE.BoxGeometry(faceW + 0.03, DECK_Y - 0.03 - y0, wall), foil, 0, (y0 + DECK_Y - 0.03) / 2, A - wall / 2, holder)
    mesh(new THREE.BoxGeometry(faceW + 0.03, yTop - openTop, wall), foil, 0, (yTop + openTop) / 2, A - wall / 2, holder)
    const jamb = (faceW + 0.03 - openW) / 2
    for (const sx of [-1, 1]) {
      mesh(new THREE.BoxGeometry(jamb, openTop - DECK_Y + 0.03, wall), foil, sx * (openW / 2 + jamb / 2), (openTop + DECK_Y - 0.03) / 2, A - wall / 2, holder)
      // Door frame.
      mesh(new THREE.BoxGeometry(0.05, openTop - DECK_Y + 0.06, 0.07), strut, sx * (openW / 2 + 0.01), (openTop + DECK_Y) / 2, A - 0.01, holder)
    }
    mesh(new THREE.BoxGeometry(openW + 0.1, 0.05, 0.07), strut, 0, openTop + 0.01, A - 0.01, holder)
  }
  const cap = (y: number, h: number, r0: number, r1: number, mat: THREE.Material) => {
    const m = mesh(new THREE.CylinderGeometry(r0, r1, h, 8), mat, 0, y, 0, body)
    m.rotation.y = Math.PI / 8
    return m
  }
  cap(y0 - 0.08, 0.16, R + 0.04, R - 0.12, silver)
  cap(yTop + 0.05, 0.1, R - 0.1, R + 0.02, dark)

  // --- The bay: a lined box inside the hull, from the mouth back past the centre line ---
  const bayDepth = 2.5
  const bayMidZ = A - bayDepth / 2
  const bayH = openTop - DECK_Y
  mesh(new THREE.BoxGeometry(openW, 0.04, bayDepth), liner, 0, DECK_Y - 0.05, bayMidZ, body)
  mesh(new THREE.BoxGeometry(openW, 0.03, bayDepth), liner, 0, openTop + 0.015, bayMidZ, body)
  mesh(new THREE.BoxGeometry(openW, bayH, 0.03), liner, 0, DECK_Y + bayH / 2, A - bayDepth, body)
  for (const sx of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.03, bayH, bayDepth), liner, sx * (openW / 2 + 0.015), DECK_Y + bayH / 2, bayMidZ, body)
    // Ribs along the walls, so the empty bay reads as a space with depth.
    for (let k = 0; k < 4; k++) mesh(new THREE.BoxGeometry(0.04, bayH, 0.05), dark, sx * (openW / 2 - 0.02), DECK_Y + bayH / 2, A - 0.35 - k * 0.6, body)
  }
  const lamp = mesh(new THREE.BoxGeometry(0.7, 0.02, 0.14), track(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.4, 2.0), toneMapped: false })), 0, openTop - 0.02, A - 0.5, body)
  lamp.castShadow = false
  // The launch lock the rover's tray was latched to, left across the bay floor.
  mesh(new THREE.BoxGeometry(openW - 0.3, 0.08, 0.06), dark, 0, DECK_Y + 0.05, A - 0.45, body)

  // --- Bay doors: the front face's own skin, in two leaves, swung back against the hull ---
  const leafW = openW / 2
  for (const sx of [-1, 1]) {
    const hingePivot = new THREE.Group()
    hingePivot.position.set(sx * (openW / 2), DECK_Y, A)
    hingePivot.rotation.y = sx * 2.0
    body.add(hingePivot)
    // Box faces: +x, -x, +y, -y, +z (outside, foil), -z (inside, lined).
    mesh(new THREE.BoxGeometry(leafW, bayH, 0.04), [edgeMat, edgeMat, edgeMat, edgeMat, foil, liner], (-sx * leafW) / 2, bayH / 2, 0, hingePivot)
    for (const hy of [0.25, bayH - 0.25]) mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 8), strut, 0, hy, 0, hingePivot)
  }

  // --- Upper deck: equipment, dish, panel ----------------------------------------------
  cap(yTop + 0.42, 0.66, 1.35, 1.78, white)
  mesh(new THREE.BoxGeometry(0.95, 0.46, 0.7), silver, 0.3, yTop + 0.98, -0.5, body)
  mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.05, 6), strut, 0.55, yTop + 1.25, 0.3, body)
  const dish = mesh(new THREE.SphereGeometry(0.6, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2.5), std({ color: 0xc9cacf, metalness: 0.2, roughness: 0.5, side: THREE.DoubleSide }), 0.55, yTop + 1.6, 0.3, body)
  dish.rotation.set(Math.PI * 0.82, 0, 0.3)
  const cells = solarTexture(8, 4, bag)
  const panel = mesh(new THREE.BoxGeometry(2.0, 0.05, 1.2), std({ map: cells, metalness: 0.35, roughness: 0.3 }), -0.6, yTop + 0.84, -0.15, body)
  panel.rotation.z = 0.12

  // --- Tanks on the four corner faces, and thruster quads on the three closed axis faces ---
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const tx = Math.cos(a) * 2.02
    const tz = Math.sin(a) * 2.02
    mesh(new THREE.SphereGeometry(0.62, 20, 14), silver, tx, y0 + 0.95, tz, body)
    mesh(new THREE.TorusGeometry(0.62, 0.03, 6, 24), dark, tx, y0 + 0.95, tz, body).rotation.x = Math.PI / 2
  }
  for (const [qx, qz] of [
    [1, 0],
    [-1, 0],
    [0, -1],
  ]) {
    mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), dark, qx * (A + 0.1), yTop - 0.2, qz * (A + 0.1), body)
    for (const s of [1, -1]) {
      const nozzle = mesh(new THREE.ConeGeometry(0.07, 0.2, 8, 1, true), strut, qx * (A + 0.12), yTop - 0.2 + s * 0.2, qz * (A + 0.12), body)
      nozzle.rotation.z = s > 0 ? Math.PI : 0
    }
  }

  // --- Engine ---------------------------------------------------------------------------
  mesh(new THREE.CylinderGeometry(0.32, 0.8, 0.62, 20, 1, true), std({ color: 0x2a2b30, metalness: 1, roughness: 0.35, side: THREE.DoubleSide }), 0, y0 - 0.42, 0, body)
  mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 12), strut, 0, y0 - 0.1, 0, body)

  // --- Legs, on the corners, so the two front ones stand clear either side of the tray ---
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1],
  ]) {
    const pivot = V(sx * 1.42, y0 + 0.75, sz * 1.42)
    const foot = V(sx * 2.62, 0.09, sz * 2.62)
    const span = foot.clone().sub(pivot)
    tube(pivot, foot, 0.1, foil, body)
    tube(pivot, pivot.clone().addScaledVector(span, 0.45), 0.135, silver, body)
    const knee = pivot.clone().addScaledVector(span, 0.64)
    tube(V(sx * 1.3, y0 + 0.08, sz * 1.3), knee, 0.05, strut, body)
    tube(V(sx * 0.95, y0 + 0.4, sz * 1.75), knee, 0.04, strut, body)
    tube(V(sx * 1.75, y0 + 0.4, sz * 0.95), knee, 0.04, strut, body)
    mesh(new THREE.CylinderGeometry(0.48, 0.56, 0.12, 16), foil, foot.x, 0.06, foot.z, body)
    mesh(new THREE.SphereGeometry(0.15, 10, 8), strut, foot.x, 0.17, foot.z, body)
  }

  // --- The tray, run out of the bay on two rails, with the rover's deck paint on it -------
  const dw = DECK.x1 - DECK.x0
  const dd = DECK.z1 - DECK.z0
  const TH = Math.round((512 * dd) / dw)
  const deckTop = canvasTexture(
    512,
    TH,
    (g) => {
      g.fillStyle = '#c9ccd2'
      g.fillRect(0, 0, 512, TH)
      g.strokeStyle = 'rgba(40,44,52,0.35)'
      g.lineWidth = 1.5
      for (let x = 64; x < 512; x += 64) {
        g.beginPath()
        g.moveTo(x, 0)
        g.lineTo(x, TH)
        g.stroke()
      }
      for (let y = 68; y < TH; y += 68) {
        g.beginPath()
        g.moveTo(0, y)
        g.lineTo(512, y)
        g.stroke()
      }
      g.fillStyle = 'rgba(30,32,38,0.5)'
      for (let x = 32; x < 512; x += 64) for (let y = 34; y < TH; y += 68) g.fillRect(x - 2, y - 2, 4, 4)
      // Hazard stripes down both sides: the edges the rover can fall off. The
      // outer end (the bottom of the canvas) is all ramp.
      for (const x of [0, 486]) {
        g.save()
        g.beginPath()
        g.rect(x, 0, 26, TH)
        g.clip()
        g.fillStyle = '#e8b21c'
        g.fillRect(x, 0, 26, TH)
        g.strokeStyle = '#17181b'
        g.lineWidth = 10
        for (let k = -30; k < TH + 30; k += 24) {
          g.beginPath()
          g.moveTo(x - 2, k + 28)
          g.lineTo(x + 28, k)
          g.stroke()
        }
        g.restore()
      }
      // Chevrons toward the ramp.
      g.fillStyle = 'rgba(30,90,200,0.8)'
      for (const y of [TH * 0.52, TH * 0.74]) {
        g.beginPath()
        g.moveTo(256, y + 40)
        g.lineTo(256 - 36, y)
        g.lineTo(256 - 17, y)
        g.lineTo(256, y + 19)
        g.lineTo(256 + 17, y)
        g.lineTo(256 + 36, y)
        g.closePath()
        g.fill()
      }
    },
    bag
  )
  const deckMat = std({ map: deckTop, metalness: 0.25, roughness: 0.62 })
  const trayZ = (DECK.z0 + DECK.z1) / 2
  // Box faces: +x, -x, +y, -y, +z, -z. Only the top carries the paint.
  mesh(new THREE.BoxGeometry(dw, 0.06, dd), [edgeMat, edgeMat, deckMat, dark, edgeMat, edgeMat], 0, DECK_Y - 0.03, trayZ)
  for (const sx of [-1, 1]) {
    // Telescoping rails: the outer section stays in the bay, the inner one carries the tray.
    mesh(new THREE.BoxGeometry(0.09, 0.1, 2.3), strut, sx * 0.5, DECK_Y - 0.12, DECK.z0 - 1.0)
    mesh(new THREE.BoxGeometry(0.06, 0.07, dd + 0.5), edgeMat, sx * 0.5, DECK_Y - 0.1, trayZ - 0.25)
    // Tie-down points the rover was strapped to for the flight.
    mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.05, 8), dark, sx * 0.62, DECK_Y + 0.025, DECK.z0 + 0.25)
  }
  for (const z of [DECK.z0 + 0.2, trayZ, DECK.z1 - 0.15]) mesh(new THREE.BoxGeometry(1.06, 0.06, 0.06), edgeMat, 0, DECK_Y - 0.09, z)

  // --- Ramp: two rails, a treaded panel, rungs. It unfolded from the tray's outer edge ---
  const ramp = new THREE.Group()
  ramp.position.set(0, DECK_Y, RAMP.z0)
  ramp.rotation.x = RAMP_PITCH
  group.add(ramp)
  const rw = RAMP.x1 - RAMP.x0
  const tread = canvasTexture(
    128,
    64,
    (g) => {
      g.fillStyle = '#d3d6db'
      g.fillRect(0, 0, 128, 64)
      g.fillStyle = '#9aa0a9'
      for (let y = 0; y < 64; y += 16) g.fillRect(0, y, 128, 5)
      g.fillStyle = 'rgba(20,22,26,0.55)'
      for (let x = 8; x < 128; x += 16) for (let y = 8; y < 64; y += 16) g.fillRect(x - 2, y, 4, 4)
    },
    bag
  )
  tread.wrapS = tread.wrapT = THREE.RepeatWrapping
  tread.repeat.set(4, 15)
  const rampMat = std({ map: tread, metalness: 0.2, roughness: 0.7 })
  const lip = std({ color: 0xe8b21c, metalness: 0.3, roughness: 0.6 })
  mesh(new THREE.BoxGeometry(rw - 0.08, 0.035, RAMP_LENGTH), rampMat, 0, -0.0175, RAMP_LENGTH / 2, ramp)
  for (const sx of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.05, 0.1, RAMP_LENGTH), edgeMat, sx * (rw / 2 - 0.025), -0.03, RAMP_LENGTH / 2, ramp)
    // A low yellow lip so the edges read from above.
    mesh(new THREE.BoxGeometry(0.03, 0.035, RAMP_LENGTH), lip, sx * (rw / 2 - 0.025), 0.035, RAMP_LENGTH / 2, ramp)
  }
  for (let i = 1; i < 5; i++) mesh(new THREE.BoxGeometry(rw - 0.1, 0.06, 0.05), dark, 0, -0.065, (i / 5) * RAMP_LENGTH, ramp)
  // The fold line where the ramp's two leaves meet, and the hinge on the tray's edge.
  mesh(new THREE.BoxGeometry(rw, 0.05, 0.06), strut, 0, -0.03, RAMP_LENGTH / 2, ramp)
  const rampHinge = mesh(new THREE.CylinderGeometry(0.035, 0.035, rw + 0.04, 10), strut, 0, DECK_Y - 0.03, RAMP.z0)
  rampHinge.rotation.z = Math.PI / 2

  return { group }
}

export type RoverModel = {
  group: THREE.Group
  /** Everything but the wheels: sinks and leans a little on its suspension. */
  body: THREE.Group
  wheels: THREE.Object3D[]
}

/** A wheel: a metal tire with grousers and a hub, merged into one geometry, axle along x. */
function wheelGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const w = 0.14
  const tire = new THREE.CylinderGeometry(WHEEL_R - 0.012, WHEEL_R - 0.012, w, 28, 1, true)
  parts.push(tire)
  const n = 16
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const g = new THREE.BoxGeometry(0.022, w + 0.01, 0.03)
    g.rotateY(-a)
    g.translate(Math.cos(a) * (WHEEL_R - 0.004), 0, Math.sin(a) * (WHEEL_R - 0.004))
    parts.push(g)
  }
  // Dished side walls and a hub.
  for (const s of [-1, 1]) {
    const cone = new THREE.CylinderGeometry(0.05, WHEEL_R - 0.014, 0.05, 20, 1, true)
    if (s < 0) cone.rotateX(Math.PI)
    cone.translate(0, s * (w / 2 - 0.025), 0)
    parts.push(cone)
  }
  parts.push(new THREE.CylinderGeometry(0.05, 0.05, w + 0.02, 12))
  const merged = mergeGeometries(
    parts.map((p) => (p.index ? p.toNonIndexed() : p)),
    false
  )
  for (const p of parts) p.dispose()
  merged.rotateZ(Math.PI / 2)
  merged.computeVertexNormals()
  return merged
}

/** The translucent ghost: where the rover will be when the newest command lands. */
export function buildGhost(bag: Bag): RoverModel {
  const group = new THREE.Group()
  const body = new THREE.Group()
  group.add(body)
  const mat = new THREE.MeshBasicMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false })
  const edge = new THREE.LineBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.6, toneMapped: false })
  bag.push(mat, edge)
  const box = (w: number, h: number, d: number, y: number, parent: THREE.Object3D) => {
    const geo = new THREE.BoxGeometry(w, h, d)
    const edges = new THREE.EdgesGeometry(geo)
    bag.push(geo, edges)
    const m = new THREE.Mesh(geo, mat)
    m.position.y = y
    const l = new THREE.LineSegments(edges, edge)
    l.position.y = y
    parent.add(m, l)
  }
  box(0.66, 0.38, 0.98, 0.5, body)
  const wg = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.14, 14)
  wg.rotateZ(Math.PI / 2)
  bag.push(wg)
  const wheels: THREE.Object3D[] = []
  for (const [x, z] of [
    [HALF_W, HALF_L],
    [-HALF_W, HALF_L],
    [HALF_W, -HALF_L],
    [-HALF_W, -HALF_L],
  ]) {
    const w = new THREE.Mesh(wg, mat)
    w.position.set(x, WHEEL_R, z)
    group.add(w)
    wheels.push(w)
  }
  group.rotation.order = 'YXZ'
  group.renderOrder = 3
  return { group, body, wheels }
}

/** The MoonDAO rover. Origin at the ground under its centre; forward is +z. */
export function buildRover(env: THREE.Texture, logo: THREE.Texture | null, seed: number, bag: Bag): RoverModel {
  const group = new THREE.Group()
  const body = new THREE.Group()
  group.add(body)
  const track = <T extends { dispose: () => void }>(x: T): T => {
    bag.push(x)
    return x
  }
  const std = (o: Std) => track(new THREE.MeshStandardMaterial({ envMap: env, envMapIntensity: 1, ...o }))
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = body) => {
    const m = new THREE.Mesh(track(geo), mat)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    parent.add(m)
    return m
  }
  const crinkle = noiseTexture(128, [9, 23, 47], [1, 0.8, 0.5], seed ^ 0x40e, bag)
  crinkle.repeat.set(2, 1)
  const foil = std({ color: 0xffbf52, metalness: 1, roughness: 0.42, bumpMap: crinkle, bumpScale: 1.6 })
  const white = std({ color: 0xd9dbe0, metalness: 0.08, roughness: 0.55 })
  const dark = std({ color: 0x15161a, metalness: 0.7, roughness: 0.45 })
  const metal = std({ color: 0xc4c8d0, metalness: 1, roughness: 0.3 })
  const wheelMat = std({ color: 0x8b9099, metalness: 0.95, roughness: 0.42 })

  // Chassis: a foil-wrapped tub under a white thermal box.
  mesh(new THREE.BoxGeometry(0.56, 0.17, 0.86), foil, 0, 0.37, 0)
  mesh(new THREE.BoxGeometry(0.64, 0.25, 0.92), white, 0, 0.56, 0)
  // Chamfered nose and tail.
  const nose = mesh(new THREE.BoxGeometry(0.5, 0.12, 0.1), foil, 0, 0.42, 0.47)
  nose.rotation.x = -0.5
  const tail = mesh(new THREE.BoxGeometry(0.5, 0.12, 0.1), foil, 0, 0.42, -0.47)
  tail.rotation.x = 0.5
  // Solar deck.
  const cells = solarTexture(6, 8, bag)
  mesh(new THREE.BoxGeometry(0.7, 0.02, 0.96), white, 0, 0.695, 0)
  const panel = mesh(new THREE.BoxGeometry(0.66, 0.012, 0.6), std({ map: cells, metalness: 0.35, roughness: 0.3 }), 0, 0.711, -0.15)
  panel.castShadow = false
  // Radiator louvres on the left, an instrument box on the right.
  // Radiator louvres at the back of both flanks; the middle of each flank carries the MoonDAO mark.
  for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) mesh(new THREE.BoxGeometry(0.012, 0.16, 0.08), metal, sx * 0.326, 0.56, -0.4 + i * 0.1)

  // Mast camera: a stereo pair on a mast at the front.
  mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.5, 8), metal, 0.18, 0.95, 0.33)
  const head = new THREE.Group()
  head.position.set(0.18, 1.22, 0.33)
  body.add(head)
  mesh(new THREE.BoxGeometry(0.27, 0.085, 0.1), white, 0, 0, 0, head)
  for (const sx of [-1, 1]) {
    const lens = mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.05, 14), dark, sx * 0.085, 0, 0.065, head)
    lens.rotation.x = Math.PI / 2
    const glass = mesh(new THREE.CircleGeometry(0.024, 14), std({ color: 0x0a1020, metalness: 1, roughness: 0.05 }), sx * 0.085, 0, 0.0905, head)
    glass.castShadow = false
  }
  head.rotation.x = 0.2
  // Antennas: a small dish and a whip at the back.
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6), metal, -0.2, 0.78, -0.32)
  const dish = mesh(new THREE.SphereGeometry(0.11, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), std({ color: 0xd9dbe0, metalness: 0.2, roughness: 0.5, side: THREE.DoubleSide }), -0.2, 0.97, -0.32)
  dish.rotation.set(Math.PI * 0.86, 0, 0.2)
  mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.42, 5), dark, 0.24, 0.91, -0.4)

  // MoonDAO mark on both flanks, as on the lander.
  if (logo) {
    const img = logo.image as { width: number; height: number } | undefined
    const aspect = img && img.height ? img.width / img.height : 1
    const logoMat = track(new THREE.MeshBasicMaterial({ map: logo, transparent: true, depthWrite: false, toneMapped: false }))
    const lh = 0.21
    const geo = track(new THREE.PlaneGeometry(lh * aspect, lh))
    for (const sx of [-1, 1]) {
      const l = new THREE.Mesh(geo, logoMat)
      l.position.set(sx * 0.3215, 0.56, 0.08)
      l.rotation.y = (sx * Math.PI) / 2
      body.add(l)
    }
  }

  // Rockers: one beam a side from the front hub to the back hub, pivoting on the chassis.
  for (const sx of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.035, 0.05, 2 * HALF_L), metal, sx * 0.345, 0.25, 0)
    mesh(new THREE.BoxGeometry(0.04, 0.16, 0.06), metal, sx * 0.33, 0.31, 0)
    for (const sz of [-1, 1]) {
      const axle = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 8), dark, sx * 0.36, WHEEL_R, sz * HALF_L)
      axle.rotation.z = Math.PI / 2
      mesh(new THREE.BoxGeometry(0.035, 0.09, 0.04), metal, sx * 0.345, 0.225, sz * HALF_L)
    }
  }

  const wgeo = track(wheelGeometry())
  const wheels: THREE.Object3D[] = []
  for (const [x, z] of [
    [HALF_W, HALF_L],
    [-HALF_W, HALF_L],
    [HALF_W, -HALF_L],
    [-HALF_W, -HALF_L],
  ]) {
    const w = new THREE.Mesh(wgeo, wheelMat)
    w.position.set(x, WHEEL_R, z)
    w.castShadow = true
    w.receiveShadow = true
    group.add(w)
    wheels.push(w)
  }
  group.rotation.order = 'YXZ'
  return { group, body, wheels }
}

/** A faceted rock: a sphere shaved by a few random planes, with a flat-ish base. */
export function rockGeometry(detail: number, seed: number, bag: Bag): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, detail)
  bag.push(geo)
  const p = geo.attributes.position
  const rng = mulberry32(seed)
  const cuts: [number, number, number, number][] = []
  for (let i = 0; i < 8; i++) {
    const u = rng() * 2 - 1
    const a = rng() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    cuts.push([Math.cos(a) * s, u, Math.sin(a) * s, 0.5 + rng() * 0.4])
  }
  const seen = new Map<string, number>()
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`
    let s = seen.get(key)
    if (s === undefined) {
      s = 1
      for (const [cx, cy, cz, d] of cuts) {
        const along = x * cx + y * cy + z * cz
        if (along > d) s = Math.min(s, d / along)
      }
      s *= 0.88 + rng() * 0.24
      seen.set(key, s)
    }
    p.setXYZ(i, x * s, y * s, z * s)
  }
  // Share vertices so the shaved planes keep their edges but the rest of the rock shades as one worn surface.
  geo.deleteAttribute('normal')
  geo.deleteAttribute('uv')
  const smoothGeo = mergeVertices(geo, 1e-4)
  smoothGeo.computeVertexNormals()
  bag.push(smoothGeo)
  return smoothGeo
}
