/**
 * A Super Heavy booster as set dressing: it hangs in the second tower's arms.
 * Local frame: y along the hull (base at 0), catch pins along +/-x.
 */
import * as THREE from 'three'
import { BOOSTER } from '@/lib/catch/layout'
import { steelSkin } from './ship'
import { Builder, type Bag } from './util'

export function buildBooster(env: THREE.Texture, bag: Bag): THREE.Group {
  const group = new THREE.Group()
  group.name = 'booster'
  const R = BOOSTER.radius
  const H = BOOSTER.height
  const steel = steelSkin(env, bag, H)
  const dark = new THREE.MeshStandardMaterial({ color: 0x25272b, roughness: 0.6, metalness: 0.7, envMap: env })
  const plain = new THREE.MeshStandardMaterial({ color: 0xb0b4b9, roughness: 0.34, metalness: 1, envMap: env, envMapIntensity: 1.1 })
  bag.push(dark, plain)

  // Hull: lathe so the skin's ring seams run the full height.
  const pts: THREE.Vector2[] = []
  for (let y = 0; y <= H - 1.9; y += 1) pts.push(new THREE.Vector2(R, y))
  pts.push(new THREE.Vector2(R, H - 1.9))
  const hullGeo = new THREE.LatheGeometry(pts, 48)
  bag.push(hullGeo)
  const hull = new THREE.Mesh(hullGeo, steel)
  group.add(hull)

  const b = new Builder()
  // Vented hot-stage ring on top: a dark lattice band under a steel rim.
  b.cyl('dark', R - 0.25, R - 0.25, 1.6, 0, H - 1.9, 0, 40, true)
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2
    b.box('plain', 0.22, 1.6, 0.3, Math.cos(a) * R, H - 1.1, Math.sin(a) * R, -a)
  }
  b.cyl('plain', R, R, 0.3, 0, H - 0.3, 0, 40, true)
  b.cyl('dark', R - 0.3, R - 0.3, 0.1, 0, H - 2.0, 0, 40)
  // Grid fins near the top, in two pairs either side of the catch pins.
  for (const deg of [38, 142, 218, 322]) {
    const a = (deg * Math.PI) / 180
    const cx = Math.cos(a)
    const cz = Math.sin(a)
    const fx = cx * (R + 2.3)
    const fz = cz * (R + 2.3)
    b.box('dark', 4.4, 0.45, 3.2, fx, H - 5.2, fz, -a)
    for (let k = -2; k <= 2; k++) b.box('plain', 4.4, 0.5, 0.08, fx - cz * k * 0.6, H - 5.2, fz + cx * k * 0.6, -a)
    for (let k = -3; k <= 3; k++) b.box('plain', 0.08, 0.5, 3.2, fx + cx * k * 0.6, H - 5.2, fz + cz * k * 0.6, -a)
    b.box('plain', 1.2, 1.3, 1.5, cx * (R + 0.4), H - 5.2, cz * (R + 0.4), -a)
  }
  // Catch pins and their bosses.
  for (const s of [-1, 1]) {
    b.beam('plain', s * (R - 0.2), BOOSTER.catchY, 0, s * (R + 1.0), BOOSTER.catchY, 0, 0.7, true)
    b.box('plain', 0.9, 1.8, 1.8, s * (R + 0.1), BOOSTER.catchY, 0)
  }
  // Chines down the lower hull and the raceway.
  for (const deg of [45, 135, 225, 315]) {
    const a = (deg * Math.PI) / 180
    b.box('plain', 1.1, 19, 1.6, Math.cos(a) * (R + 0.35), 11.5, Math.sin(a) * (R + 0.35), -a)
    b.box('plain', 1.1, 1.4, 1.6, Math.cos(a) * (R + 0.1), 21.5, Math.sin(a) * (R + 0.1), -a)
  }
  b.box('plain', 0.6, H - 26, 0.35, 0, (H - 26) / 2 + 22, R + 0.12)
  // Engine bay: 33 bells in three rings under a dark closure.
  b.cyl('dark', R - 0.1, R - 0.1, 0.2, 0, 0.9, 0, 40)
  const bell = (x: number, z: number) => {
    const g = new THREE.CylinderGeometry(0.2, 0.62, 1.7, 14, 1, true)
    b.add('dark', g, new THREE.Matrix4().makeTranslation(x, 0.05, z))
  }
  for (let i = 0; i < 3; i++) bell(Math.cos((i / 3) * 6.283) * 0.8, Math.sin((i / 3) * 6.283) * 0.8)
  for (let i = 0; i < 10; i++) bell(Math.cos((i / 10) * 6.283) * 2.35, Math.sin((i / 10) * 6.283) * 2.35)
  for (let i = 0; i < 20; i++) bell(Math.cos((i / 20) * 6.283) * 3.85, Math.sin((i / 20) * 6.283) * 3.85)
  const detail = b.build({ dark, plain }, bag)
  dark.side = THREE.DoubleSide
  group.add(detail)

  group.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh) {
      m.castShadow = true
      m.receiveShadow = true
    }
  })
  return group
}
