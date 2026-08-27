import { IPFS_GATEWAY } from 'const/config'
import { NextApiRequest, NextApiResponse } from 'next'
import sharp from 'sharp'
import { parseListingOgParams } from '@/lib/og/preview'
import { renderOgSvg } from '@/lib/og/svg'
import { MAX_UPLOAD_BYTES } from '@/lib/utils/images'

/** Must not undercut the upload cap, or listings we accepted render with an empty media box. */
const MAX_MEDIA_BYTES = MAX_UPLOAD_BYTES
/** Room for a full-resolution phone photo while still rejecting decompression bombs. */
const MAX_MEDIA_PIXELS = 64_000_000
/** Raster only — an SVG source would let a pinned file pull in more markup at rasterize time. */
const ALLOWED_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']
/** Matches the media box `renderOgSvg` draws the image into. */
const MEDIA_WIDTH = 344
const MEDIA_HEIGHT = 360

async function readCapped(body: Response['body'], maxBytes: number): Promise<Buffer | undefined> {
  const reader = body?.getReader()
  if (!reader) return undefined
  const chunks: Buffer[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done || !value) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      return undefined
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks)
}

async function resolveListingImage(cid?: string): Promise<string | undefined> {
  if (!cid) return undefined
  const url = `${IPFS_GATEWAY}${cid}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2500)
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    const contentType = (response.headers.get('content-type') || '')
      .split(';')[0]
      .trim()
      .toLowerCase()
    if (!response.ok || !ALLOWED_MEDIA_TYPES.includes(contentType)) return undefined
    const declaredLength = Number(response.headers.get('content-length'))
    if (Number.isFinite(declaredLength) && declaredLength > MAX_MEDIA_BYTES) return undefined
    const buffer = await readCapped(response.body, MAX_MEDIA_BYTES)
    if (!buffer?.length) return undefined
    const media = await sharp(buffer, { limitInputPixels: MAX_MEDIA_PIXELS })
      .resize(MEDIA_WIDTH, MEDIA_HEIGHT, { fit: 'cover' })
      .png()
      .toBuffer()
    return `data:image/png;base64,${media.toString('base64')}`
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
