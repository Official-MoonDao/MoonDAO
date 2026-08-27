import { ImageResponse } from '@vercel/og'
import { IPFS_GATEWAY } from 'const/config'
import { OgCard } from '@/lib/og/OgCard'
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, parseListingOgParams } from '@/lib/og/preview'

export const config = {
  runtime: 'edge',
}

async function resolveListingImage(cid?: string): Promise<string | undefined> {
  if (!cid) return undefined
  const url = `${IPFS_GATEWAY}${cid}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2500)
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    const contentType = response.headers.get('content-type') || ''
    if (!response.ok || !contentType.startsWith('image/')) return undefined
    return url
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
}

export default async function handler(req: Request) {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { searchParams } = new URL(req.url)
  const fields = parseListingOgParams(searchParams)
  const mediaSrc = await resolveListingImage(fields.image)

  const response = new ImageResponse(
    (
      <OgCard
        eyebrow="MoonDAO  ·  Marketplace"
        title={fields.title}
        subtitle={fields.team}
        chips={[fields.price].filter((chip): chip is string => Boolean(chip))}
        footer="moondao.com/marketplace"
        mediaSrc={mediaSrc}
      />
    ),
    {
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
    }
  )

  response.headers.set('Cache-Control', 'public, immutable, no-transform, max-age=86400')
  response.headers.set('Content-Type', 'image/png')
  return response
}
