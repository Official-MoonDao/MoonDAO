// Seeded, dependency-free PRNG (mulberry32) for deterministic simulation.
// Same seed always produces the same sequence.

export function hashStringToInt(str: string): number {
  // FNV-1a 32-bit
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export class PRNG {
  private state: number

  constructor(seed: string | number) {
    this.state =
      typeof seed === 'number' ? seed >>> 0 : hashStringToInt(seed)
    // Avoid a zero state which weakens mulberry32.
    if (this.state === 0) this.state = 0x9e3779b9
  }

  // Returns a float in [0, 1).
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  // Float in [min, max).
  range(min: number, max: number): number {
    return min + (max - min) * this.next()
  }

  // Integer in [min, max] inclusive.
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }
}
