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
  | { kind: 'sky'; projectId: string }
  | { kind: 'orbit'; altitudeM: number }

export type TourStopId =
  | 'arrival'
  | 'race'
  | 'market'
  | 'predict'
  | 'bet'
  | 'prize'
  | 'resolve'
  | 'ladder'
  | 'explore'

export type TourStop = {
  id: TourStopId
  target: TourTarget
  // Where the camera is, in the visitor's terms: the card's eyebrow and the
  // tour rail's entry.
  label: string
  // Shown instead of the live scene on the reduced-motion and low-power path.
  still?: string
}

export const TOUR_POSTER = '/assets/Lunar-Colony-Dark.webp'

// The base first, then one race followed from market to payout, then the
// ladder of races that builds the rest of it. The DePrize stops all hold on
// the landing zone, so the camera stays on the race being explained.
export const TOUR_ORDER: TourStopId[] = [
  'arrival',
  'race',
  'market',
  'predict',
  'bet',
  'prize',
  'resolve',
  'ladder',
  'explore',
]

const LANDING_ZONE: TourTarget = { kind: 'district', category: 'lander' }

export const TOUR_STOPS: Record<TourStopId, TourStop> = {
  arrival: { id: 'arrival', target: { kind: 'home' }, label: 'Moon Base Zero' },
  race: { id: 'race', target: LANDING_ZONE, label: 'Landing zone' },
  market: { id: 'market', target: LANDING_ZONE, label: 'Live odds' },
  predict: { id: 'predict', target: LANDING_ZONE, label: 'Predict' },
  bet: { id: 'bet', target: LANDING_ZONE, label: 'Bet' },
  prize: { id: 'prize', target: { kind: 'home' }, label: 'Prize pool' },
  resolve: { id: 'resolve', target: LANDING_ZONE, label: 'Resolution' },
  ladder: { id: 'ladder', target: { kind: 'home' }, label: 'Capability ladder' },
  explore: {
    id: 'explore',
    target: { kind: 'orbit', altitudeM: 4000 },
    label: 'Explore',
  },
}

// The camera framing for a stop, built the same way /moonbase builds it for
// a legend click (flyToSite) or a satellite pick (flyToProject), so the tour
// and the explorer frame a district identically.
export function stopFocus(target: TourTarget, layout: ColonyLayout): GlobeFocus {
  switch (target.kind) {
    case 'home':
      return null
    case 'district': {
      const raceId = layout.districtOwner.get(target.category)
      let dir = raceId ? layout.districts.get(raceId) : undefined
      if (!dir) {
        const plan = BASE_PLAN[target.category]
        if (!plan) return null
        const ll = capOffsetLatLon(plan.east, plan.north)
        dir = latLonToVector3(ll.lat, ll.lon, 1)
      }
      const ll = vector3ToLatLon(dir)
      return { lat: ll.lat, lon: ll.lon, view: 'surface' }
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
