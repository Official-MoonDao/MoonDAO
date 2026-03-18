import { fetchNewslettersFromNewsSite } from '@/lib/newsletter/newsletterData'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'

const emptyResponse = (res: NextApiResponse) =>
  res.status(200).json({ newsletters: [], total: 0, source: null })

function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .replace(/^-+|-+$/g, '')
}

function buildNewsletterUrl(broadcast: any): string {
  const urlFields = [
    'public_url',
    'web_url',
    'preview_url',
    'share_url',
    'permalink',
    'url',
    'link',
  ]
  for (const field of urlFields) {
    const val = broadcast?.[field]
    if (val && typeof val === 'string' && val.includes('http')) {
      const hostname = (val.match(/https?:\/\/([^/]+)/)?.[1] || '').replace(
        /^www\./,
        ''
      )
      if (hostname.includes('moondao.com') || hostname.includes('kit.com')) {
        return val.includes('news.moondao.com')
          ? val
          : val.replace(/^https?:\/\/[^/]+/, 'https://news.moondao.com')
      }
      return val
    }
  }
  if (broadcast?.subject) {
    const slug = titleToSlug(broadcast.subject)
    if (slug) return `https://news.moondao.com/posts/${slug}`
  }
  return 'https://news.moondao.com/posts'
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const v4Key = process.env.CONVERT_KIT_V4_API_KEY
    const v3Key =
      process.env.CONVERT_KIT_API_SECRET ||
      process.env.CONVERT_KIT_API_KEY

    if (!v4Key && !v3Key) {
      console.log(
        '[newsletters] API key not found, using news.moondao.com fallback'
      )
      const fallback = await fetchNewslettersFromNewsSite()
      if (fallback.length > 0) {
        return res.status(200).json({
          newsletters: fallback,
          total: fallback.length,
          source: 'news.moondao.com',
        })
      }
      return emptyResponse(res)
    }

    let allBroadcasts: any[] = []

    // Try V4 first (Kit is the current platform; V4 keys are incompatible with V3)
    if (v4Key) {
      const v4Endpoints = [
        'https://api.kit.com/v4/broadcasts',
        'https://api.convertkit.com/v4/broadcasts',
      ]
      for (const endpoint of v4Endpoints) {
        try {
          const url = `${endpoint}?per_page=100`
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'X-Kit-Api-Key': v4Key,
            },
          })
          const body = await response.json().catch(() => ({}))
          if (response.ok && body.broadcasts && Array.isArray(body.broadcasts)) {
            if (body.broadcasts.length > 0) {
              console.log(
                `[newsletters] Fetched ${body.broadcasts.length} broadcasts from ${endpoint}`
              )
            }
            allBroadcasts = body.broadcasts
            break
          }
          if (response.status === 401) {
            console.warn(
              `[newsletters] V4 API key rejected by ${endpoint}`
            )
          }
        } catch (err) {
          console.warn(`[newsletters] ${endpoint} error:`, err)
        }
        if (allBroadcasts.length > 0) break
      }
    }

    // Fallback to V3 (api_secret required for broadcasts; api_key is for forms)
    if (allBroadcasts.length === 0 && v3Key) {
      const v3Endpoints = [
        'https://api.kit.com/v3/broadcasts',
        'https://api.convertkit.com/v3/broadcasts',
      ]
      for (const v3Base of v3Endpoints) {
        for (const param of ['api_secret', 'api_key']) {
          try {
            const v3Url = `${v3Base}?${param}=${encodeURIComponent(v3Key)}&page=1&sort_order=desc`
            const response = await fetch(v3Url, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            })
            const body = await response.json().catch(() => ({}))
            if (response.ok && body.broadcasts && Array.isArray(body.broadcasts)) {
              if (body.broadcasts.length > 0) {
                console.log(
                  `[newsletters] Fetched ${body.broadcasts.length} broadcasts from V3 API`
                )
              }
              allBroadcasts = body.broadcasts.map((b: any) => ({
                ...b,
                published_at: b.published_at ?? b.send_at,
                public_url:
                  b.public_url ??
                  (b.subject
                    ? `https://news.moondao.com/posts/${titleToSlug(b.subject)}`
                    : null),
              }))
              break
            }
          } catch (err) {
            console.warn(`[newsletters] V3 ${param} error:`, err)
          }
          if (allBroadcasts.length > 0) break
        }
      }
    }

    if (allBroadcasts.length === 0) {
      const fallback = await fetchNewslettersFromNewsSite()
      if (fallback.length > 0) {
        return res.status(200).json({
          newsletters: fallback,
          total: fallback.length,
          source: 'news.moondao.com',
        })
      }
      return emptyResponse(res)
    }

    // Filter: only include sent newsletters (have published_at or send_at) - excludes drafts
    // No public field filter; published_at/send_at is the gate for "not yet public"
    const fiveYearsAgo = new Date()
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)

    const filtered = allBroadcasts
      .filter((b) => {
        const sentDate = b?.published_at || b?.send_at
        if (!sentDate) return false // draft - never sent
        return new Date(sentDate) >= fiveYearsAgo
      })
      .sort((a, b) => {
        const dA = new Date(a.published_at || a.send_at || a.created_at || 0).getTime()
        const dB = new Date(b.published_at || b.send_at || b.created_at || 0).getTime()
        return dB - dA
      })
      .slice(0, 20)

    const newsletters = filtered.map((broadcast) => {
      const published =
        broadcast.published_at || broadcast.send_at || broadcast.created_at
      return {
        id: broadcast?.id?.toString() || Math.random().toString(),
        title: broadcast?.subject || 'Newsletter Update',
        description: broadcast?.description || broadcast?.preview_text || null,
        publishedAt: published,
        views: broadcast?.total_recipients || null,
        image: broadcast?.thumbnail_url || null,
        url: buildNewsletterUrl(broadcast),
        stats: broadcast?.stats || {},
        isArchived: new Date(published) < new Date('2024-01-01'),
        isPublic: true,
      }
    })

    if (newsletters.length === 0) {
      const fallback = await fetchNewslettersFromNewsSite()
      if (fallback.length > 0) {
        return res.status(200).json({
          newsletters: fallback,
          total: fallback.length,
          source: 'news.moondao.com',
        })
      }
      return emptyResponse(res)
    }

    res.status(200).json({
      newsletters,
      total: newsletters.length,
      source: 'convertkit',
    })
  } catch (error) {
    console.error('[newsletters] Error:', error)
    return emptyResponse(res)
  }
}

export default withMiddleware(handler, rateLimit)
