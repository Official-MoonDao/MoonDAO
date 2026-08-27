import { NextApiRequest, NextApiResponse } from 'next'
import sharp from 'sharp'
import { parseJobOgParams } from '@/lib/og/preview'
import { renderOgSvg } from '@/lib/og/svg'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).end('Method not allowed')
  }

  const fields = parseJobOgParams(new URL(req.url || '/', 'http://localhost').searchParams)
  const svg = renderOgSvg({
    eyebrow: 'MoonDAO  ·  Jobs',
    title: fields.title,
    subtitle: fields.team,
    chips: [fields.tag, fields.commitment, fields.location, fields.compensation].filter(
      (chip): chip is string => Boolean(chip)
    ),
    footer: 'moondao.com/jobs',
  })

  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  res.setHeader('Content-Type', 'image/png')
  res.setHeader('Cache-Control', 'public, immutable, no-transform, max-age=86400')
  res.setHeader('Content-Length', String(png.length))
  res.end(png)
}
