/**
 * Moon Base Zero's solid parts, as spheres for the physics.
 *
 * This is the collision twin of components/touchdown/moonbase.ts (which draws
 * the town). It lives in lib, with no three.js, so the terrain carries the
 * colliders everywhere: in the browser, in the headless bot, and on the server
 * when the leaderboard re-flies a recorded landing.
 *
 * The town frame and every position here mirror moonbase.ts. If a structure
 * moves there, move it here too.
 */
import { dcos, dsin } from './detmath'
import { mulberry32 } from './mission'

export const BASE_PITCH = 55
const U0 = -2 * BASE_PITCH
const U1 = 2 * BASE_PITCH
const V0 = -1.5 * BASE_PITCH
const V1 = 1.5 * BASE_PITCH
const MAIN_V = -0.5 * BASE_PITCH

/** Seeded choices shared with the renderer: town rotation and container stack heights. */
export function baseSeeded(seed: number): { rot: number; stacks: number[] } {
  const rng = mulberry32(seed ^ 0xba5e)
  const rot = 0.32 * (rng() < 0.5 ? -1 : 1)
  const stacks: number[] = []
  for (let k = 0; k < 9; k++) {
    const stack = 1 + Math.floor(rng() * 2.4)
    stacks.push(stack)
    // The renderer draws one more number per container for its colour.
    for (let s = 0; s < stack; s++) rng()
  }
  return { rot, stacks }
}

/** x, y, z, radius per collider. `groundAt` is the terrain height query. */
export function baseColliders(
  seed: number,
  base: { x: number; z: number },
  groundAt: (x: number, z: number) => number
): Float32Array {
  const { rot, stacks } = baseSeeded(seed)
  const cu = dcos(rot)
  const su = dsin(rot)
  const out: number[] = []
  const solid = (u: number, v: number, h: number, r: number) => {
    const x = base.x + u * cu - v * su
    const z = base.z + u * su + v * cu
    out.push(x, groundAt(x, z) + h, z, r)
  }

  const habitat = (bu: number, bv: number) => {
    for (const dv of [-11, 11]) for (const du of [-8, 0, 8]) solid(bu + du, bv + dv, 2.2, 4.6)
  }
  const commons = (bu: number, bv: number) => solid(bu, bv, -3.5, 13)
  const solar = (bu: number, bv: number) => {
    for (let r = -1; r <= 1; r++) for (let c = -1; c <= 1; c++) solid(bu + c * 14, bv + r * 14, 4.3, 3.3)
  }
  const power = (bu: number, bv: number) => {
    for (const du of [-13, 0, 13]) {
      solid(bu + du, bv, 1.4, 2.2)
      solid(bu + du, bv + 10, 3.6, 4.2)
    }
  }
  const comms = (bu: number, bv: number) => {
    for (let h = 2; h <= 32; h += 5) solid(bu, bv, h, 1.9)
    solid(bu - 15, bv + 12, 5, 4.2)
    solid(bu + 14, bv - 13, 5, 3.4)
  }
  const isru = (bu: number, bv: number) => {
    for (const [du, dv] of [
      [-12, -8],
      [-12, 6],
      [-2, -1],
    ]) {
      solid(bu + du, bv + dv, 4.2, 3.5)
    }
    solid(bu + 12, bv + 4, 3, 5.2)
    solid(bu + 12, bv + 4, 10, 1.6)
  }
  const greenhouse = (bu: number, bv: number) => {
    for (const dv of [-10, 0, 10]) for (const du of [-12, -6, 0, 6, 12]) solid(bu + du, bv + dv, 0.6, 3.4)
  }
  const labs = (bu: number, bv: number) => {
    for (const [du, dv] of [
      [-10, -8],
      [9, 7],
    ]) {
      for (const k of [-5, 0, 5]) solid(bu + du + k, bv + dv, 4, 3.6)
    }
  }
  const storage = (bu: number, bv: number) => {
    for (let r = -1; r <= 1; r++) for (const du of [-9, 9]) for (const k of [-4, 0, 4]) solid(bu + du + k, bv + r * 9, 2.9, 2.5)
  }
  const logistics = (bu: number, bv: number) => {
    for (let k = 0; k < 9; k++) {
      solid(bu - 14 + (k % 3) * 7, bv - 12 + Math.floor(k / 3) * 5, stacks[k] * 1.3, 2.7)
    }
    for (let h = 2; h <= 14; h += 4) solid(bu + 14, bv + 8, h, 1.2)
  }
  const garage = (bu: number, bv: number) => {
    for (const du of [-7, 0, 7]) solid(bu + du, bv, 2, 8)
  }

  const blocks = [
    [solar, solar, power, logistics],
    [habitat, commons, isru, comms],
    [greenhouse, labs, storage, garage],
  ]
  blocks.forEach((row, j) => row.forEach((build, i) => build(U0 + (i + 0.5) * BASE_PITCH, V0 + (j + 0.5) * BASE_PITCH)))

  // Rovers
  solid(U0 + 30, MAIN_V + 2, 1.8, 2.4)
  solid(U1 - 46, MAIN_V - 2, 1.8, 2.4)
  solid(U0 - 24, MAIN_V + 2, 1.8, 2.4)
  solid(U0 + BASE_PITCH + 3, V1 - 20, 1.8, 2.4)
  // Crew lander on its pad
  for (let h = 4; h <= 46; h += 6) solid(U0 - 74, MAIN_V, h, 4.8)
  // Mass driver rail
  for (let k = 0; k <= 20; k++) solid(U1 + 34 + k * 6, MAIN_V + 16, 3 + k * 0.33, 1.8)

  return new Float32Array(out)
}
