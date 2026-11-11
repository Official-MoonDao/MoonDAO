import { NextApiRequest, NextApiResponse } from 'next'
import { rasterizeOgSvg } from '@/lib/og/rasterize'
import { renderOgSvg } from '@/lib/og/svg'
import { parseChallenge, SHARE_URL_LABEL } from '@/lib/touchdown/share'

/** Link-preview card for Touchdown, optionally carrying a challenge score. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).end('Method not allowed')
  }
  const params = new URL(req.url || '/', 'http://localhost').searchParams
  const challenge = parseChallenge(Object.fromEntries(params.entries()))
  const svg = renderOgSvg(
    challenge
      ? {
          eyebrow: 'MoonDAO  ·  Touchdown',
          title: `Beat ${challenge.score.toLocaleString('en-US')} points`,
          subtitle: challenge.nickname
            ? `${challenge.nickname} landed on the Moon. Can you?`
            : 'Can you land on the Moon?',
          chips: [challenge.mode === 'pro' ? 'PRO' : 'Easy', 'One-minute Moon landing', 'New site daily'],
          footer: SHARE_URL_LABEL,
        }
      : {
          eyebrow: 'MoonDAO  ·  Touchdown',
          title: 'Can you land on the Moon?',
          subtitle: 'A one-minute 3D Moon landing game',
          chips: ['New site daily', 'Easy + Pro', 'No sign-up'],
          footer: SHARE_URL_LABEL,
        }
  )
  const { png, cacheControl } = await rasterizeOgSvg(svg)
  res.setHeader('Content-Type', 'image/png')
  res.setHeader('Cache-Control', cacheControl)
  res.setHeader('Content-Length', String(png.length))
  res.end(png)
}
