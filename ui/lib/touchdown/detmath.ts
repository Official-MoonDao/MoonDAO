/**
 * Engine-independent trigonometry for the flight physics.
 *
 * Math.sin/cos/tan/atan2 may differ in the last bit between JavaScript
 * engines, and the leaderboard re-flies a player's recorded inputs on the
 * server. These versions use only + - * / and Math.sqrt, which IEEE-754
 * defines exactly, so a flight replays the same in Node as in any browser.
 * Accurate to about 1e-15 over the ranges the physics uses.
 */
const PI = 3.141592653589793
const TWO_PI = 6.283185307179586
const HALF_PI = 1.5707963267948966

export function dsin(x: number): number {
  // Reduce to [-pi, pi], then fold into [-pi/2, pi/2].
  let a = x - TWO_PI * Math.round(x / TWO_PI)
  if (a > HALF_PI) a = PI - a
  else if (a < -HALF_PI) a = -PI - a
  // Taylor series to x^21. Fixed order of operations, so the result is the
  // same on every engine.
  const a2 = a * a
  let sum = a
  let term = a
  for (let n = 1; n <= 10; n++) {
    term = (-term * a2) / (2 * n * (2 * n + 1))
    sum += term
  }
  return sum
}

export function dcos(x: number): number {
  return dsin(x + HALF_PI)
}

export function dtan(x: number): number {
  return dsin(x) / dcos(x)
}

function datanSmall(x: number): number {
  // |x| <= tan(pi/16): alternating series to x^23.
  const x2 = x * x
  let sum = 0
  let term = x
  for (let n = 1; n <= 23; n += 2) {
    sum += term / n
    term = -term * x2
  }
  return sum
}

export function datan(x: number): number {
  if (x < 0) return -datan(-x)
  if (x > 1) return HALF_PI - datan(1 / x)
  // Halve the angle twice: atan(x) = 2 atan(x / (1 + sqrt(1 + x^2))).
  let r = x / (1 + Math.sqrt(1 + x * x))
  r = r / (1 + Math.sqrt(1 + r * r))
  return 4 * datanSmall(r)
}

export function datan2(y: number, x: number): number {
  if (x > 0) return datan(y / x)
  if (x < 0) return y >= 0 ? datan(y / x) + PI : datan(y / x) - PI
  if (y > 0) return HALF_PI
  if (y < 0) return -HALF_PI
  return 0
}
