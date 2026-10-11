import type { GlobeFocus } from '@/components/lunar-atlas/MoonGlobe'
import type { ColonyLayout } from '@/components/lunar-atlas/MarkerLayer'
import { BASE_PLAN } from '@/lib/lunar-atlas/baseplan'
import {
  latLonToVector3,
  MOON_RADIUS_M,
  vector3ToLatLon,
} from '@/lib/lunar-atlas/geo'
import { SKY_STATIONS, stationLatLon } from '@/lib/lunar-atlas/skyplan'
import {
  capCenterLatLon,
  capOffsetLatLon,
} from '@/lib/lunar-atlas/southpole'
import type { ProjectType } from '@/lib/lunar-atlas/types'

export type TourTarget =
  | { kind: 'home' }
  | { kind: 'district'; category: ProjectType }
  | { kind: 'sky'; projectId: string }
  | { kind: 'orbit'; altitudeM: number }

export type TourStopId =
  | 'hero'
  | 'featured'
  | 'network'
  | 'pillars'
  | 'governance'
  | 'launchpad'
  | 'journey'
  | 'voices'
  | 'partners'
  | 'cta'

export type TourStop = {
  id: TourStopId
  target: TourTarget
  // Shown on the chip in the open window above the section copy, so the
  // visitor knows which part of the base the camera has just flown to.
  label?: string
  // Shown instead of the live scene on the reduced-motion and low-power path.
  still?: string
}

export const TOUR_POSTER = '/assets/Lunar-Colony-Dark.webp'

export const TOUR_STOPS: Record<TourStopId, TourStop> = {
  hero: { id: 'hero', target: { kind: 'home' } },
  featured: {
    id: 'featured',
    target: { kind: 'district', category: 'mass_driver' },
    label: 'Mass driver',
  },
  network: {
    id: 'network',
    target: { kind: 'district', category: 'comms_pnt' },
    label: 'Comms & navigation',
  },
  pillars: {
    id: 'pillars',
    target: { kind: 'district', category: 'construction' },
    label: 'Construction district',
  },
  governance: {
    id: 'governance',
    target: { kind: 'district', category: 'habitat' },
    label: 'Habitat district',
  },
  launchpad: {
    id: 'launchpad',
    target: { kind: 'district', category: 'lander' },
    label: 'Landing zone',
  },
  journey: {
    id: 'journey',
    target: { kind: 'home' },
    label: 'The whole settlement',
  },
  voices: {
    id: 'voices',
    target: { kind: 'district', category: 'rover' },
    label: 'Rover depot',
  },
  partners: {
    id: 'partners',
    target: { kind: 'sky', projectId: 'im-near-space-network' },
    label: 'Relay constellation',
  },
  cta: {
    id: 'cta',
    target: { kind: 'orbit', altitudeM: 4000 },
    label: 'Shackleton connecting ridge',
  },
}

// The camera framing for a stop, built the same way /moonbase builds it for
// a legend click (flyToSite) or a satellite pick (flyToProject), so the tour
// and the explorer frame a district identically.
export function stopFocus(
  target: TourTarget,
  layout: ColonyLayout
): GlobeFocus {
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
