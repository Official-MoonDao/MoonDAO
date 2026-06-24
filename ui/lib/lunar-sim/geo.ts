// ENU <-> lat/lon helpers for the lunar south-pole scene, plus GeoJSON export.
// Uses a simple equirectangular tangent-plane approximation around the AOI
// anchor. This is fine for the small AOIs MoonSim uses and for context views;
// the simulation itself works purely in local ENU meters.

import type { AOI, ENU, Scenario } from './engine/types'

// Mean lunar radius in meters.
export const MOON_RADIUS_M = 1737400

const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

export function enuToLatLon(
  enu: ENU,
  aoi: Pick<AOI, 'anchorLat' | 'anchorLon'>
): { lat: number; lon: number } {
  const lat0 = aoi.anchorLat * DEG2RAD
  const dLat = enu.y / MOON_RADIUS_M
  const denom = Math.max(Math.cos(lat0), 1e-6)
  const dLon = enu.x / (MOON_RADIUS_M * denom)
  return {
    lat: aoi.anchorLat + dLat * RAD2DEG,
    lon: aoi.anchorLon + dLon * RAD2DEG,
  }
}

export function latLonToENU(
  lat: number,
  lon: number,
  aoi: Pick<AOI, 'anchorLat' | 'anchorLon'>
): ENU {
  const lat0 = aoi.anchorLat * DEG2RAD
  const dLatDeg = lat - aoi.anchorLat
  const dLonDeg = lon - aoi.anchorLon
  const y = dLatDeg * DEG2RAD * MOON_RADIUS_M
  const x = dLonDeg * DEG2RAD * MOON_RADIUS_M * Math.cos(lat0)
  return { x, y }
}

export function distanceM(a: ENU, b: ENU): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

type GeoJSONFeature = {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: Record<string, unknown>
}

type GeoJSONFeatureCollection = {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

// Export a scenario's assets + resources to GeoJSON (lon, lat order per spec).
export function scenarioToGeoJSON(scenario: Scenario): GeoJSONFeatureCollection {
  const features: GeoJSONFeature[] = []
  for (const a of scenario.assets) {
    const { lat, lon } = enuToLatLon(a.pos, scenario.aoi)
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        kind: 'asset',
        id: a.id,
        name: a.name,
        class: a.class,
        behaviorModule: a.behaviorModule,
      },
    })
  }
  for (const r of scenario.resources) {
    const { lat, lon } = enuToLatLon(r.pos, scenario.aoi)
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        kind: 'resource',
        id: r.id,
        name: r.name,
        resourceType: r.resourceType,
        quantityKg: r.quantityKg,
      },
    })
  }
  return { type: 'FeatureCollection', features }
}
