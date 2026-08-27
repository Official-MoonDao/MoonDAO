import { IPFS_GATEWAY } from 'const/config'
import { NextApiRequest, NextApiResponse } from 'next'
import sharp from 'sharp'
import { parseListingOgParams } from '@/lib/og/preview'
import { renderOgSvg } from '@/lib/og/svg'

async function resolveListingImage(cid?: string): Promise<string | undefined> {
  if (!cid) return undefined
  const url = `${IPFS_GATEWAY}${cid}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2500)
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    const contentType = response.headers.get('content-type') || ''
    if (!response.ok || !contentType.startsWith('image/')) return undefined
    const buffer = Buffer.from(await response.arrayBuffer())
    if (!buffer.length) return undefined
    return `data:${contentType};base64,${buffer.toString('base64')}`
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).end('Method not allowed')
  }

  const fields = parseListingOgParams(new URL(req.url || '/', 'http://localhost').searchParams)
  const mediaDataUri = await resolveListingImage(fields.image)
  const svg = renderOgSvg({
    eyebrow: 'MoonDAO  ·  Marketplace',
    title: fields.title,
    subtitle: fields.team,
    chips: [fields.price].filter((chip): chip is string => Boolean(chip)),
    footer: 'moondao.com/marketplace',
    mediaDataUri,
  })

  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  res.setHeader('Content-Type', 'image/png')
  res.setHeader('Cache-Control', 'public, immutable, no-transform, max-age=86400')
  res.setHeader('Content-Length', String(png.length))
  res.end(png)
}
