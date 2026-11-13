/**
 * The day's conditions for Catch. Everyone gets the same wind, approach and
 * light on a given UTC day, derived from the mission number (shared with
 * Touchdown's daily seed), so a challenge link can replay an older day.
 *
 * Dependency-free apart from the seed helpers.
 */
import { hash32, missionSeed, mulberry32 } from '@/lib/touchdown/mission'

export type Conditions = {
  seed: number
  /** Wind the ship flies through: where it blows TOWARD, as components in m/s (x east, z south). */
  windX: number
  windZ: number
  /** Gust swing as a fraction of the steady wind, and its phase. */
  gust: number
  gustPhase: number
  /** m: how far north (-) or south (+) of the tower line the ship is handed over. */
  lateral: number
  /** Sun elevation and azimuth in degrees; azimuth runs from east (0) through south (90). */
  sunElevation: number
  sunAzimuth: number
  cloudCover: number
  /** For the briefing: compass direction the wind comes FROM, and its speed. */
  windFrom: string
  windSpeed: number
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']

/** Whole-number table lookups keep this exact on every engine. */
const DIR16: [number, number][] = [
  [0, -1],
  [0.3827, -0.9239],
  [0.7071, -0.7071],
  [0.9239, -0.3827],
  [1, 0],
  [0.9239, 0.3827],
  [0.7071, 0.7071],
  [0.3827, 0.9239],
  [0, 1],
  [-0.3827, 0.9239],
  [-0.7071, 0.7071],
  [-0.9239, 0.3827],
  [-1, 0],
  [-0.9239, -0.3827],
  [-0.7071, -0.7071],
  [-0.3827, -0.9239],
]

export function conditionsFor(mission: number): Conditions {
  const seed = missionSeed(mission) ^ hash32(0xca7c4)
  const rng = mulberry32(seed)
  // The coast's prevailing wind is from the south-east; most days come from that quarter.
  const fromIndex = rng() < 0.7 ? 5 + Math.floor(rng() * 4) : Math.floor(rng() * 16)
  // 2..11 m/s, in half-metre steps.
  const speed = 2 + Math.round(rng() * 18) / 2
  const [fx, fz] = DIR16[fromIndex]
  // Morning to mid-afternoon: the sun swings from the south-east round to the south-west.
  const hour = rng()
  return {
    seed,
    windX: -fx * speed,
    windZ: -fz * speed,
    gust: 0.15 + Math.round(rng() * 20) / 100,
    gustPhase: Math.round(rng() * 600) / 100,
    lateral: Math.round((rng() * 2 - 1) * 70),
    sunElevation: 26 + Math.round(Math.sin(hour * Math.PI) * 30),
    sunAzimuth: 30 + Math.round(hour * 190),
    cloudCover: 0.2 + Math.round(rng() * 35) / 100,
    windFrom: COMPASS[fromIndex],
    windSpeed: speed,
  }
}
