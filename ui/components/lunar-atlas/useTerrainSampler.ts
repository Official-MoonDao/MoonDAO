// Decodes the baked south-pole height PNGs (16-bit heights split across the
// R/G channels) into CPU-side height fields (once, module-cached) and exposes
// `radiusAt(lat, lon)` — the rendered terrain radius at that point. Markers,
// on-surface models, the surface camera, and the camera's terrain floor all
// use it to sit on the ground the GPU actually draws.

import { useEffect, useState } from 'react'
import {
  FAR_EXTENT_M,
  FAR_GRID,
  FAR_HEIGHT_MAX_M,
  FAR_HEIGHT_MIN_M,
  INNER_EXTENT_M,
  INNER_GRID,
  INNER_HEIGHT_MAX_M,
  INNER_HEIGHT_MIN_M,
  capRadiusAt,
  isInsideCap,
  type PolarHeightField,
} from '@/lib/lunar-atlas/southpole'
import {
  GLOBE_RADIUS,
  SP_FAR_HEIGHT_MAP,
  SP_HEIGHT_MAP,
} from '@/lib/lunar-atlas/textures'

export type RadiusAt = (lat: number, lon: number) => number

const fieldCache = new Map<string, Promise<PolarHeightField>>()

export function loadPolarField(
  url: string,
  extentM: number,
  minM: number,
  maxM: number
): Promise<PolarHeightField> {
  const cached = fieldCache.get(url)
  if (cached) return cached
  const promise = new Promise<PolarHeightField>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) {
        reject(new Error('2d canvas unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0)
      const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      const data = new Uint16Array(canvas.width * canvas.height)
      // 16-bit height: R is the high byte, G the low byte.
      for (let i = 0; i < data.length; i++) {
        data[i] = (rgba[i * 4] << 8) | rgba[i * 4 + 1]
      }
      resolve({ size: canvas.width, extentM, minM, maxM, data })
    }
    img.onerror = () => reject(new Error(`failed to load height map: ${url}`))
    img.src = url
  })
  fieldCache.set(url, promise)
  return promise
}

export function loadInnerField(): Promise<PolarHeightField> {
  return loadPolarField(
    SP_HEIGHT_MAP,
    INNER_EXTENT_M,
    INNER_HEIGHT_MIN_M,
    INNER_HEIGHT_MAX_M
  )
}

export function loadFarField(): Promise<PolarHeightField> {
  return loadPolarField(
    SP_FAR_HEIGHT_MAP,
    FAR_EXTENT_M,
    FAR_HEIGHT_MIN_M,
    FAR_HEIGHT_MAX_M
  )
}

// Returns null until the height maps decode; callers fall back to the
// analytic sphere radius in the meantime.
export default function useTerrainSampler(): RadiusAt | null {
  const [radiusAt, setRadiusAt] = useState<RadiusAt | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([loadInnerField(), loadFarField()])
      .then(([inner, far]) => {
        if (cancelled) return
        setRadiusAt(() => (lat: number, lon: number) => {
          // The inner cap mesh renders on top wherever it covers; outside it
          // the coarse far mesh is the visible ground. Points past the far
          // cap (nothing rendered there) fall back to the sphere radius.
          if (isInsideCap(lat, lon, INNER_EXTENT_M)) {
            return capRadiusAt(inner, INNER_GRID, lat, lon)
          }
          if (isInsideCap(lat, lon, FAR_EXTENT_M)) {
            return capRadiusAt(far, FAR_GRID, lat, lon)
          }
          return GLOBE_RADIUS
        })
      })
      .catch(() => {
        // Non-fatal: seating falls back to the analytic sphere.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return radiusAt
}
