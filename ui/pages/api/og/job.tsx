import { ImageResponse } from '@vercel/og'
import React from 'react'
import { OgCard } from '@/lib/og/OgCard'
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, parseJobOgParams } from '@/lib/og/preview'

export const config = {
  runtime: 'edge',
}

export default function handler(req: Request) {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { searchParams } = new URL(req.url)
  const fields = parseJobOgParams(searchParams)

  const response = new ImageResponse(
    (
      <OgCard
        eyebrow="MoonDAO  ·  Jobs"
        title={fields.title}
        subtitle={fields.team}
        chips={[fields.tag, fields.commitment, fields.location, fields.compensation].filter(
          (chip): chip is string => Boolean(chip)
        )}
        footer="moondao.com/jobs"
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
