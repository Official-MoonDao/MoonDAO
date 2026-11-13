/** Small geometry helpers for the Catch models: collect primitives per material, merge once. */
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export type Bag = { dispose: () => void }[]

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

/** Collects geometry by material key and emits one mesh per material. */
export class Builder {
  private lists = new Map<string, THREE.BufferGeometry[]>()

  add(key: string, geo: THREE.BufferGeometry, matrix?: THREE.Matrix4): this {
    const g = geo.index ? geo.toNonIndexed() : geo
    if (g !== geo) geo.dispose()
    if (matrix) g.applyMatrix4(matrix)
    // Merging needs identical attribute sets.
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name)
    }
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
    }
    let list = this.lists.get(key)
    if (!list) this.lists.set(key, (list = []))
    list.push(g)
    return this
  }

  box(key: string, w: number, h: number, d: number, x: number, y: number, z: number, rotY = 0): this {
    _m.makeRotationY(rotY).setPosition(x, y, z)
    return this.add(key, new THREE.BoxGeometry(w, h, d), _m)
  }

  /** Upright cylinder (or cone) with its base at y. */
  cyl(key: string, rTop: number, rBot: number, h: number, x: number, y: number, z: number, seg = 16, open = false): this {
    _m.makeTranslation(x, y + h / 2, z)
    return this.add(key, new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open), _m)
  }

  /** A straight member between two points: square section by default, round with `round`. */
  beam(key: string, ax: number, ay: number, az: number, bx: number, by: number, bz: number, t: number, round = false): this {
    _a.set(ax, ay, az)
    _b.set(bx, by, bz)
    const len = _a.distanceTo(_b)
    if (len < 1e-4) return this
    _s.subVectors(_b, _a).normalize()
    _q.setFromUnitVectors(_up, _s)
    _a.add(_b).multiplyScalar(0.5)
    _m.compose(_a, _q, _s.set(1, 1, 1))
    return this.add(key, round ? new THREE.CylinderGeometry(t / 2, t / 2, len, 8, 1) : new THREE.BoxGeometry(t, len, t), _m)
  }

  /** Horizontal capsule tank lying along the given heading. */
  tank(key: string, r: number, len: number, x: number, y: number, z: number, rotY = 0): this {
    const g = new THREE.CapsuleGeometry(r, Math.max(0.1, len - 2 * r), 6, 14)
    _m.makeRotationZ(Math.PI / 2)
    g.applyMatrix4(_m)
    _m.makeRotationY(rotY).setPosition(x, y, z)
    return this.add(key, g, _m)
  }

  build(materials: Record<string, THREE.Material>, bag: Bag, shadows = true): THREE.Group {
    const group = new THREE.Group()
    for (const [key, list] of this.lists) {
      const merged = mergeGeometries(list, false)
      for (const g of list) g.dispose()
      if (!merged) continue
      merged.computeBoundingSphere()
      bag.push(merged)
      const mesh = new THREE.Mesh(merged, materials[key])
      mesh.name = key
      mesh.castShadow = shadows
      mesh.receiveShadow = shadows
      group.add(mesh)
    }
    this.lists.clear()
    return group
  }
}

export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, bag: Bag, srgb = true): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  bag.push(t)
  return t
}
