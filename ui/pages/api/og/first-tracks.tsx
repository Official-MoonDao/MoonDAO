/**
 * Link-preview image for a First Tracks challenge link ("Beat Ryan's 1,042").
 *
 * The plain /rover preview is a static file, public/first-tracks/og.jpg, and
 * never reaches this route. A challenge link gets the same staged scene
 * (public/first-tracks/og-base.jpg, rendered from the game by
 * scripts/first-tracks-og.ts) with the score to beat written over it.
 */
import { existsSync, readFileSync } from 'fs'
import type { NextApiRequest, NextApiResponse } from 'next'
import { join } from 'path'
import sharp from 'sharp'
import { embedOgFontFace, rasterizeOgSvg } from '@/lib/og/rasterize'
import { escapeXml, renderOgSvg } from '@/lib/og/svg'
import { parseChallenge, SHARE_URL_LABEL } from '@/lib/first-tracks/share'

// Literal paths so Vercel's file tracing ships the image with this function
// (see outputFileTracingIncludes in next.config.js).
const BASE_PATHS = [
  join(process.cwd(), 'public/first-tracks/og-base.jpg'),
  join(process.cwd(), 'ui/public/first-tracks/og-base.jpg'),
  join(__dirname, '../../../public/first-tracks/og-base.jpg'),
]
const STATIC_PATHS = [
  join(process.cwd(), 'public/first-tracks/og.jpg'),
  join(process.cwd(), 'ui/public/first-tracks/og.jpg'),
  join(__dirname, '../../../public/first-tracks/og.jpg'),
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
  const challenge = parseChallenge(Object.fromEntries(params.entries()))

  const send = (body: Buffer, type: string, cache = CACHE) => {
    res.setHeader('Content-Type', type)
    res.setHeader('Cache-Control', cache)
    res.setHeader('Content-Length', String(body.length))
    res.end(body)
  }

  try {
    if (!challenge) {
      const still = firstExisting(STATIC_PATHS)
      if (still) return send(still, 'image/jpeg')
    } else {
      const base = firstExisting(BASE_PATHS)
      if (base) {
        const score = challenge.score.toLocaleString('en-US')
        const who = challenge.nickname ? `${escapeXml(challenge.nickname)}’s ` : ''
        const pro = challenge.mode === 'pro' ? '  ·  PRO' : ''
        const text = (attrs: string, body: string) =>
          `<text font-family="Lato, sans-serif" fill="#fff" ${attrs}>${body}</text>`
        const svg =
          embedOgFontFace(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs></defs>
  ${text(
    'x="1144" y="74" font-size="40" font-weight="700" letter-spacing="3" text-anchor="end" stroke="#fff" stroke-width="1.2"',
    'LUNAR ROVER'
  )}
  ${text('x="1144" y="108" font-size="24" letter-spacing="4" text-anchor="end" fill-opacity="0.9"', 'FIRST TRACKS')}
  ${text('x="1144" y="142" font-size="22" text-anchor="end" fill-opacity="0.8"', escapeXml(SHARE_URL_LABEL))}
  ${text(
    'x="54" y="520" font-size="76" font-weight="700" stroke="#fff" stroke-width="2.2"',
    `Beat ${who}${score}`
  )}
  ${text('x="56" y="572" font-size="36" fill-opacity="0.92"', `Can you drive on the Moon?${pro}`)}
  ${text(
    'x="56" y="608" font-size="24" fill-opacity="0.8"',
    'Drive a rover through real signal delay. New site every day.'
  )}
</svg>`)
        const jpg = await sharp(base)
          .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
          .jpeg({ quality: 88 })
          .toBuffer()
        return send(jpg, 'image/jpeg')
      }
    }
  } catch (err) {
    console.error('first tracks og failed', err)
  }

  // Fallback: the generic text card.
  const svg = renderOgSvg({
    eyebrow: 'MoonDAO  ·  Lunar Rover: First Tracks',
    title: challenge
      ? `Beat ${challenge.score.toLocaleString('en-US')} points`
      : 'Can you drive on the Moon?',
    subtitle: 'A 3D Moon rover game with real signal delay',
    chips: ['New site daily', 'Easy + Pro', 'No sign-up'],
    footer: SHARE_URL_LABEL,
  })
  const { png, cacheControl } = await rasterizeOgSvg(svg)
  send(png, 'image/png', cacheControl)
}
