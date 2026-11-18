import { BASE_PLAN } from '@/lib/lunar-atlas/baseplan'
import { latLonToVector3, MOON_RADIUS_M, vector3ToLatLon } from '@/lib/lunar-atlas/geo'
import { SKY_STATIONS, stationLatLon } from '@/lib/lunar-atlas/skyplan'
import { capCenterLatLon, capOffsetLatLon } from '@/lib/lunar-atlas/southpole'
import type { ProjectType } from '@/lib/lunar-atlas/types'
import type { ColonyLayout } from '@/components/lunar-atlas/MarkerLayer'
import type { GlobeFocus } from '@/components/lunar-atlas/MoonGlobe'

export type TourTarget =
  | { kind: 'home' }
  | { kind: 'district'; category: ProjectType }
  | { kind: 'site'; projectId: string; fallback: ProjectType }
  | { kind: 'sky'; projectId: string }
  | { kind: 'orbit'; altitudeM: number }

export type TourStopId =
  | 'arrival'
  | 'power'
  | 'comms'
  | 'habitat'
  | 'rover'
  | 'race'
  | 'market'
  | 'predict'
  | 'bet'
  | 'resolve'
  | 'prize'
  | 'ladder'
  | 'explore'

export type TourAct = 'base' | 'race' | 'whole'

export type TourStop = {
  id: TourStopId
  act: TourAct
  target: TourTarget
  // Where the camera is, in the visitor's terms: the card's eyebrow and the
  // tour rail's entry.
  label: string
  // Shown instead of the live scene on the reduced-motion and low-power path.
  still?: string
}

export const TOUR_POSTER = '/assets/Lunar-Colony-Dark.webp'

export const TOUR_ACT_LABELS: Record<TourAct, string> = {
  base: 'The base',
  race: 'One race',
  whole: 'The whole base',
}

// The race the second act follows, and the competitor its bet and payout
// close in on.
export const STORY_RACE = 'Touchdown'
export const STORY_SITE = 'firefly-blue-ghost'

// The first act walks the spine from the power fields at its east end to the
// rover district, which ends beside the landing zone; the second act holds on
// the landing zone, then closes in on one lander; the third pulls back out
// over the whole base. The camera never returns to a place it has left.
export const TOUR_ORDER: TourStopId[] = [
  'arrival',
  'power',
  'comms',
  'habitat',
  'rover',
  'race',
  'market',
  'predict',
  'bet',
  'resolve',
  'prize',
  'ladder',
  'explore',
]

// Shared objects, not equal copies: the globe only flies when the target
// changes identity, so stops that share one hold the shot still.
const LANDING_ZONE: TourTarget = { kind: 'district', category: 'lander' }
const STORY_LANDER: TourTarget = { kind: 'site', projectId: STORY_SITE, fallback: 'lander' }
const WHOLE_BASE: TourTarget = { kind: 'home' }

// Frames of the live tour, one per camera shot, for visitors who get stills
// instead of the scene. Captured by scripts/moonbase-tour-stills.mjs; re-run
// it when the base or the framing changes.
const STILL = {
  base: '/moonbase-tour/base.webp',
  power: '/moonbase-tour/power.webp',
  comms: '/moonbase-tour/comms.webp',
  habitat: '/moonbase-tour/habitat.webp',
  rover: '/moonbase-tour/rover.webp',
  landing: '/moonbase-tour/landing.webp',
  lander: '/moonbase-tour/lander.webp',
  orbit: '/moonbase-tour/orbit.webp',
}

export const TOUR_STOPS: Record<TourStopId, TourStop> = {
  arrival: {
    id: 'arrival',
    act: 'base',
    target: { kind: 'home' },
    label: 'Moon Base Zero',
    still: STILL.base,
  },
  power: {
    id: 'power',
    act: 'base',
    target: { kind: 'district', category: 'power' },
    label: 'Power fields',
    still: STILL.power,
  },
  comms: {
    id: 'comms',
    act: 'base',
    target: { kind: 'district', category: 'comms_pnt' },
    label: 'Comms & navigation',
    still: STILL.comms,
  },
  habitat: {
    id: 'habitat',
    act: 'base',
    target: { kind: 'district', category: 'habitat' },
    label: 'Habitat district',
    still: STILL.habitat,
  },
  rover: {
    id: 'rover',
    act: 'base',
    target: { kind: 'district', category: 'rover' },
    label: 'Rover district',
    still: STILL.rover,
  },
  race: {
    id: 'race',
    act: 'race',
    target: LANDING_ZONE,
    label: 'Landing zone',
    still: STILL.landing,
  },
  market: {
    id: 'market',
    act: 'race',
    target: LANDING_ZONE,
    label: 'The market',
    still: STILL.landing,
  },
  predict: {
    id: 'predict',
    act: 'race',
    target: LANDING_ZONE,
    label: 'Predict',
    still: STILL.landing,
  },
  bet: { id: 'bet', act: 'race', target: STORY_LANDER, label: 'Bet', still: STILL.lander },
  resolve: {
    id: 'resolve',
    act: 'race',
    target: STORY_LANDER,
    label: 'Resolution',
    still: STILL.lander,
  },
  prize: { id: 'prize', act: 'whole', target: WHOLE_BASE, label: 'Prize pool', still: STILL.base },
  ladder: {
    id: 'ladder',
    act: 'whole',
    target: WHOLE_BASE,
    label: 'Capability ladder',
    still: STILL.base,
  },
  explore: {
    id: 'explore',
    act: 'whole',
    target: { kind: 'orbit', altitudeM: 4000 },
    label: 'Explore',
    still: STILL.orbit,
  },
}

function districtDir(category: ProjectType, layout: ColonyLayout) {
  const raceId = layout.districtOwner.get(category)
  const dir = raceId ? layout.districts.get(raceId) : undefined
  if (dir) return dir
  const plan = BASE_PLAN[category]
  if (!plan) return undefined
  const ll = capOffsetLatLon(plan.east, plan.north)
  return latLonToVector3(ll.lat, ll.lon, 1)
}

// The camera framing for a stop, built the same way /moonbase builds it for
// a legend click (flyToSite) or a satellite pick (flyToProject), so the tour
// and the explorer frame a district identically.
export function stopFocus(target: TourTarget, layout: ColonyLayout): GlobeFocus {
  switch (target.kind) {
    case 'home':
      return null
    case 'district': {
      const dir = districtDir(target.category, layout)
      if (!dir) return null
      const ll = vector3ToLatLon(dir)
      return { lat: ll.lat, lon: ll.lon, view: 'surface' }
    }
    case 'site': {
      const dir = layout.plots.get(target.projectId)?.dir ?? districtDir(target.fallback, layout)
      if (!dir) return null
      const ll = vector3ToLatLon(dir)
      return { lat: ll.lat, lon: ll.lon, view: 'surface', subjectM: 3 }
    }
    case 'sky': {
      const station = SKY_STATIONS[target.projectId]?.[0]
      if (!station) return null
      const { lat, lon } = stationLatLon(station)
      return { lat, lon, view: 'sky', heightM: station.altM }
    }
    case 'orbit': {
      const c = capCenterLatLon()
      return {
        lat: c.lat,
        lon: c.lon,
        distanceRadii: target.altitudeM / MOON_RADIUS_M,
      }
    }
  }
}
