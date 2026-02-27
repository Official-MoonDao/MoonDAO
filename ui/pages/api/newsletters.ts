import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'

const emptyResponse = (res: NextApiResponse) =>
  res.status(200).json({ newsletters: [], total: 0, source: null })

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const CONVERTKIT_API_KEY =
      process.env.CONVERT_KIT_V4_API_KEY || process.env.CONVERT_KIT_API_KEY

    if (!CONVERTKIT_API_KEY) {
      console.log('[newsletters] API key not found')
      return emptyResponse(res)
    }

    let allBroadcasts: any[] = []
    const endpoints = [
      'https://api.kit.com/v4/broadcasts',
      'https://api.convertkit.com/v4/broadcasts',
    ]

    for (const endpoint of endpoints) {
      try {
        const url = `${endpoint}?per_page=100`
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Kit-Api-Key': CONVERTKIT_API_KEY,
          },
        })

        const body = await response.json().catch(() => ({}))
        if (response.ok && body.broadcasts && Array.isArray(body.broadcasts)) {
          if (body.broadcasts.length > 0) {
            console.log(`[newsletters] Fetched ${body.broadcasts.length} broadcasts from ${endpoint}`)
          }
          for (const broadcast of body.broadcasts) {
            if (!allBroadcasts.find((b) => b.id === broadcast.id)) {
              allBroadcasts.push(broadcast)
            }
          }
          break
        } else {
          const errMsg = body?.errors?.[0] || body?.message || body?.error || ''
          console.warn(`[newsletters] ${endpoint} failed: ${response.status}`, errMsg)
          if (response.status === 401) {
            console.warn('[newsletters] API key may be invalid - check CONVERT_KIT_V4_API_KEY')
          }
        }
      } catch (err) {
        console.warn(`[newsletters] ${endpoint} error:`, err)
      }
    }

    if (allBroadcasts.length === 0) {
      return emptyResponse(res)
    }

    const publishedBroadcasts = allBroadcasts.filter(
      (broadcast: any) =>
        broadcast.published_at != null ||
        broadcast.send_at != null ||
        broadcast.created_at != null
    )

    if (publishedBroadcasts.length === 0) {
      return emptyResponse(res)
    }

    // Sort all broadcasts by date (newest first) - use published_at, send_at, or created_at
    publishedBroadcasts.sort((a: any, b: any) => {
      const dateA = new Date(a.published_at || a.send_at || a.created_at || 0).getTime()
      const dateB = new Date(b.published_at || b.send_at || b.created_at || 0).getTime()
      return dateB - dateA
    })

    // Transform ConvertKit data to our format
    const newsletters =
      publishedBroadcasts.slice(0, 50).map((broadcast: any) => {
        // Function to convert newsletter title to URL slug
        const titleToSlug = (title: string): string => {
          return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
            .replace(/^-+|-+$/g, '')
        }

        // Try multiple URL fields from ConvertKit v4
        let publicUrl = null
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
          if (
            broadcast[field] &&
            typeof broadcast[field] === 'string' &&
            broadcast[field].includes('http')
          ) {
            publicUrl = broadcast[field]
            break
          }
        }

        // If no specific URL found, construct using news.moondao.com pattern
        if (!publicUrl && broadcast.subject) {
          const slug = titleToSlug(broadcast.subject)
          if (slug) {
            publicUrl = `https://news.moondao.com/posts/${slug}`
          }
        }

        // Final fallback to newsletter archive
        if (!publicUrl) {
          publicUrl = 'https://news.moondao.com/posts'
        }

        // Use published_at, send_at, or created_at for date display
        const publishedDate = broadcast.published_at || broadcast.send_at || broadcast.created_at

        return {
          id: broadcast.id?.toString() || Math.random().toString(),
          title: broadcast.subject || 'Newsletter Update',
          description: broadcast.description || broadcast.preview_text || null,
          publishedAt: publishedDate,
          views: broadcast.total_recipients || null,
          image: broadcast.thumbnail_url || null,
          url: publicUrl,
          stats: broadcast.stats || {},
          isArchived: new Date(publishedDate) < new Date('2024-01-01'),
          isPublic: broadcast.public || false,
        }
      }) || []

    // Filter to newsletters from the last 2 years (include all published, not just "public")
    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

    const recentNewsletters = newsletters.filter((newsletter: any) => {
      // Require valid published date
      if (!newsletter.publishedAt) {
        return false
      }

      const publishedDate = new Date(newsletter.publishedAt)
      return publishedDate >= twoYearsAgo
    })

    // Sort by published date (newest first)
    recentNewsletters.sort((a: any, b: any) => {
      const dateA = new Date(a.publishedAt || 0).getTime()
      const dateB = new Date(b.publishedAt || 0).getTime()
      return dateB - dateA
    })

    const toReturn = recentNewsletters.slice(0, 20)

    res.status(200).json({
      newsletters: toReturn,
      total: toReturn.length,
      source: 'convertkit',
    })
  } catch (error) {
    console.error('[newsletters] Error:', error)
    return emptyResponse(res)
  }
}

export default withMiddleware(handler, rateLimit)
