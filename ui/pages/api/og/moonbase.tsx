/**
 * Link-preview image for a shared base (/moonbase/base/<id>): the base's name
 * over its plot seen from above. A link to a base that is gone, or a moment
 * when bases cannot be read, gets the plain My Moonbase card.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { SEED_ATLAS } from '@/lib/lunar-atlas'
import { orgColor } from '@/lib/lunar-atlas/display'
import { baseRedis, readBaseById } from '@/lib/my-moonbase/baseStore'
import { baseOgSvg, genericBaseOgSvg } from '@/lib/my-moonbase/ogCard'
import { isBaseId } from '@/lib/my-moonbase/share'
import { sanitizeIncomingLayout, placeableAssetIds } from '@/lib/my-moonbase/storedLayout'
import { rasterizeOgSvg } from '@/lib/og/rasterize'

// The page adds the save time to the image address, so a card is good for as
// long as its address is. The plain card must not stick to a base's address.
const MISSING_CACHE = 'public, no-transform, max-age=60'

const orgs = new Map(SEED_ATLAS.organizations.map((org) => [org.id, org]))
const projects = new Map(SEED_ATLAS.projects.map((project) => [project.id, project]))
const assetIds = placeableAssetIds(SEED_ATLAS)

function colorFor(projectId: string): string | undefined {
  const project = projects.get(projectId)
  return project ? orgColor(orgs.get(project.orgId)) : undefined
}

async function savedCard(id: unknown): Promise<string | null> {
  if (!isBaseId(id)) return null
  const redis = baseRedis()
  if (!redis) return null
  const found = await readBaseById(redis, id)
  const layout = found ? sanitizeIncomingLayout(found.base.layout, assetIds) : null
  return layout ? baseOgSvg(layout, colorFor, process.env.TOUCHDOWN_NAME_BLOCKLIST) : null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).end('Method not allowed')
  }

  let svg: string | null = null
  try {
    svg = await savedCard(req.query.id)
  } catch (err) {
    console.error('moonbase og failed', err)
  }

  const { png, cacheControl } = await rasterizeOgSvg(svg ?? genericBaseOgSvg())
  res.setHeader('Content-Type', 'image/png')
  res.setHeader('Cache-Control', svg ? cacheControl : MISSING_CACHE)
  res.setHeader('Content-Length', String(png.length))
  res.end(png)
}
