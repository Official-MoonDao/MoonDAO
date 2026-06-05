import { isOperator } from 'middleware/isOperator'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import {
  createInvite,
  generateInviteToken,
} from '@/lib/citizen/inviteTokens'

type Body = {
  count?: number | string
  label?: string
  ttlDays?: number | string
}

const MAX_COUNT = 50
const MAX_TTL_DAYS = 365
const DEFAULT_TTL_DAYS = 30

// Build the public origin for the invite links from the incoming request, so
// the generated links automatically point at whatever host the operator is on
// (production, a preview deployment, or localhost) without any config.
function getOrigin(req: NextApiRequest): string {
  const envBase = process.env.NEXT_PUBLIC_BASE_URL
  if (envBase) return envBase.replace(/\/$/, '')
  const forwardedProto = req.headers['x-forwarded-proto']
  const proto =
    (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) ||
    'https'
  const host = req.headers.host
  return `${proto}://${host}`
}

// Operator-only endpoint to mint one-time citizen invite links. Gated by the
// `isOperator` allowlist (see OPERATORS in const/config.ts), so a non-technical
// admin can generate links from the website without any local environment.
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = (req.body ?? {}) as Body

  let count = Number(body.count ?? 1)
  if (!Number.isInteger(count) || count < 1) count = 1
  if (count > MAX_COUNT) count = MAX_COUNT

  let ttlDays = Number(body.ttlDays ?? DEFAULT_TTL_DAYS)
  if (!Number.isFinite(ttlDays) || ttlDays < 1) ttlDays = DEFAULT_TTL_DAYS
  if (ttlDays > MAX_TTL_DAYS) ttlDays = MAX_TTL_DAYS

  const label =
    typeof body.label === 'string' && body.label.trim()
      ? body.label.trim().slice(0, 120)
      : undefined

  const origin = getOrigin(req)
  const ttlSeconds = ttlDays * 24 * 60 * 60

  const links: Array<{ token: string; url: string }> = []
  try {
    for (let i = 0; i < count; i++) {
      const token = generateInviteToken()
      const created = await createInvite(
        token,
        { createdAt: Date.now(), label, createdBy: 'operator-panel' },
        ttlSeconds
      )
      if (!created) {
        // createInvite returns null only when Redis is unconfigured.
        return res.status(500).json({
          error:
            'Invite storage is not configured (UPSTASH_REDIS_URL / UPSTASH_REDIS_TOKEN).',
        })
      }
      links.push({ token, url: `${origin}/citizen?invite=${token}` })
    }
  } catch (err: any) {
    console.error('create-citizen-invite failed:', err)
    // Return partial success so operators know which links were created
    if (links.length > 0) {
      return res.status(207).json({
        success: false,
        error: err?.message || 'Partial failure while creating invite links.',
        count: links.length,
        requested: count,
        ttlDays,
        label: label ?? null,
        links,
      })
    }
    return res
      .status(500)
      .json({ error: err?.message || 'Failed to create invite links.' })
  }

  return res.status(200).json({
    success: true,
    count: links.length,
    ttlDays,
    label: label ?? null,
    links,
  })
}

export default withMiddleware(handler, isOperator)
