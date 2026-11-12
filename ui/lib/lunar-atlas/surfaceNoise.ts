// One tiling RGBA tile of band-limited noise, shared by the ground and the hardware.
//
// R is fine grain, G is blotches, B is slow cloud; each is centred on 0.5 and
// stretched to use most of the byte range, so a shader can write
// (sample - 0.5) * amplitude and mean exactly what it says. See the "Surface noise"
// section of regolithShader.ts for who samples it and at what scale.
//
// No three import: a pure array producer, like detailTile.ts, so the claims above
// can be tested without a GPU.
import { valueNoise } from './detailTile'

export const SURFACE_NOISE_SIZE = 256

// Lattice cells per tile for each band, with weights. Two lattices per band so no
// band is a single visible frequency.
const BANDS: [number, number][][] = [
  [
    [128, 1],
    [64, 0.7],
  ],
  [
    [32, 1],
    [16, 0.8],
    [64, 0.35],
  ],
  [
    [8, 1],
    [4, 0.8],
    [16, 0.4],
  ],
]

export function buildSurfaceNoise(size = SURFACE_NOISE_SIZE): Uint8Array {
  let seed = 90210
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0xffffffff
  }
  const out = new Uint8Array(size * size * 4)
  BANDS.forEach((band, channel) => {
    const sum = new Float32Array(size * size)
    for (const [cells, weight] of band) {
      const n = valueNoise(size, cells, rand)
      for (let i = 0; i < sum.length; i++) sum[i] += n[i] * weight
    }
    // Normalised by the band's own spread rather than by its theoretical range:
    // sums of noise pile up in the middle, and scaling by the range would leave
    // every band using a quarter of the byte.
    let sq = 0
    for (let i = 0; i < sum.length; i++) sq += sum[i] * sum[i]
    const sigma = Math.sqrt(sq / sum.length) || 1
    for (let i = 0; i < sum.length; i++) {
      const v = 0.5 + (sum[i] / sigma) * 0.2
      out[i * 4 + channel] = Math.round(Math.min(1, Math.max(0, v)) * 255)
    }
  })
  for (let i = 3; i < out.length; i += 4) out[i] = 255
  return out
}
