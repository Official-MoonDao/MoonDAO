/**
 * Link-preview image for a shared free forecast ("My forecast: Blue Ghost M2").
 *
 * `race` and `pick` are atlas ids. The pick must be a listed competitor in
 * that race, so the card only ever shows atlas copy. Anything else gets the
 * generic forecast card.
 */
import { existsSync, readFileSync } from 'fs'
import type { NextApiRequest, NextApiResponse } from 'next'
import { join } from 'path'
import sharp from 'sharp'
import { forecastSharePickFromQuery } from '@/lib/forecasts/forecastShare'
import { FORECAST_CARD_URL_LABEL, renderForecastCardSvg } from '@/lib/og/forecastCard'
import { embedOgFontFace, rasterizeOgSvg } from '@/lib/og/rasterize'
import { renderOgSvg } from '@/lib/og/svg'

// Literal paths so Vercel's file tracing ships the images with this function
// (see outputFileTracingIncludes in next.config.js).
const BASE_PATHS = [
  join(process.cwd(), 'public/touchdown/og-base.jpg'),
  join(process.cwd(), 'ui/public/touchdown/og-base.jpg'),
  join(__dirname, '../../../public/touchdown/og-base.jpg'),
]
const MARK_PATHS = [
  join(process.cwd(), 'public/touchdown/moondao-mark.png'),
  join(process.cwd(), 'ui/public/touchdown/moondao-mark.png'),
  join(__dirname, '../../../public/touchdown/moondao-mark.png'),
]
const CACHE = 'public, immutable, no-transform, max-age=86400'

function firstExisting(paths: string[]): Buffer | undefined {
  for (const p of paths) if (existsSync(p)) return readFileSync(p)
  return undefined
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).end('Method not allowed')
  }
  const params = new URL(req.url || '/', 'http://localhost').searchParams
  const share = forecastSharePickFromQuery(params.get('race'), params.get('pick') ?? undefined)

  const send = (body: Buffer, type: string, cache = CACHE) => {
    res.setHeader('Content-Type', type)
    res.setHeader('Cache-Control', cache)
    res.setHeader('Content-Length', String(body.length))
    res.end(body)
  }

  try {
    const base = firstExisting(BASE_PATHS)
    if (base) {
      const layers: sharp.OverlayOptions[] = [
        { input: Buffer.from(embedOgFontFace(renderForecastCardSvg(share))), top: 0, left: 0 },
      ]
      const mark = firstExisting(MARK_PATHS)
      if (mark) {
        layers.push({
          input: await sharp(mark).resize({ height: 48 }).png().toBuffer(),
          top: 46,
          left: 56,
        })
      }
      const jpg = await sharp(base).composite(layers).jpeg({ quality: 88 }).toBuffer()
      return send(jpg, 'image/jpeg')
    }
  } catch (err) {
    console.error('forecast og failed', err)
  }

  const svg = renderOgSvg({
    eyebrow: 'MoonDAO  ·  DePrize',
    title: share ? `My forecast: ${share.name}` : 'Who reaches the Moon first?',
    subtitle: share?.org,
    chips: ['Free forecasts', 'Moon race'],
    footer: FORECAST_CARD_URL_LABEL,
  })
  const { png, cacheControl } = await rasterizeOgSvg(svg)
  send(png, 'image/png', cacheControl)
}
