// Decodes the 2K LOLA displacement JPEG into a CPU-side height field (once,
// module-cached) and exposes `radiusAt(lat, lon)` — the actual displaced
// surface radius of the rendered globe. Markers, on-surface models, and the
// surface camera use it to sit on the terrain instead of the analytic sphere.

import { useEffect, useState } from 'react'
import {
  meshDisplacedRadius,
  type HeightField,
} from '@/lib/lunar-atlas/terrain'
import {
  DISPLACEMENT_BIAS,
  DISPLACEMENT_MAP,
  DISPLACEMENT_SCALE,
  GLOBE_RADIUS,
  MOON_SEGMENTS,
} from '@/lib/lunar-atlas/textures'

export type RadiusAt = (lat: number, lon: number) => number

let fieldPromise: Promise<HeightField> | null = null

function loadHeightField(url: string): Promise<HeightField> {
  if (fieldPromise) return fieldPromise
  fieldPromise = new Promise((resolve, reject) => {
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
      // Grayscale source — the red channel is the height value.
      const data = new Uint8ClampedArray(canvas.width * canvas.height)
      for (let i = 0; i < data.length; i++) data[i] = rgba[i * 4]
      resolve({ width: canvas.width, height: canvas.height, data })
    }
    img.onerror = () => reject(new Error(`failed to load DEM: ${url}`))
    img.src = url
  })
  return fieldPromise
}

// Returns null until the DEM has decoded; callers fall back to the analytic
// sphere radius in the meantime.
export default function useTerrainSampler(): RadiusAt | null {
  const [radiusAt, setRadiusAt] = useState<RadiusAt | null>(null)

  useEffect(() => {
    let cancelled = false
    loadHeightField(DISPLACEMENT_MAP)
      .then((field) => {
        if (cancelled) return
        // meshDisplacedRadius (not displacedRadius): heights must match the
        // *rendered* surface — the GPU only displaces the sphere's vertex
        // lattice, so raw texel sampling disagrees with the visible ground
        // and seated objects float or sink.
        setRadiusAt(
          () => (lat: number, lon: number) =>
            meshDisplacedRadius(
              field,
              lat,
              lon,
              GLOBE_RADIUS,
              DISPLACEMENT_SCALE,
              DISPLACEMENT_BIAS,
              MOON_SEGMENTS,
              MOON_SEGMENTS
            )
        )
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
