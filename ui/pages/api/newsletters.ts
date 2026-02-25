import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // ConvertKit API configuration (match townhall/convertkit.ts)
    const CONVERTKIT_API_KEY =
      process.env.CONVERT_KIT_V4_API_KEY || process.env.CONVERT_KIT_API_KEY

    if (!CONVERTKIT_API_KEY) {
      console.log('ConvertKit API key not found - using fallback newsletters')
      return res.status(200).json({
        newsletters: getFallbackNewsletters(),
        total: getFallbackNewsletters().length,
        source: 'fallback',
      })
    }

    // Kit API V4: official endpoint is api.kit.com (api.convertkit.com may still work for legacy)
    let allBroadcasts: any[] = []
    const endpoints = [
      'https://api.kit.com/v4/broadcasts',
      'https://api.convertkit.com/v4/broadcasts',
    ]

    for (const endpoint of endpoints) {
      try {
        const url = `${endpoint}?per_page=50`
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
          break // Success, no need to try other endpoints
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
      console.log('No broadcasts from ConvertKit - using fallback newsletters')
      return res.status(200).json({
        newsletters: getFallbackNewsletters(),
        total: getFallbackNewsletters().length,
        source: 'fallback',
      })
    }

    // Filter to sent/published broadcasts - prefer published_at or send_at, fallback to created_at for display
    const publishedBroadcasts = allBroadcasts.filter(
      (broadcast: any) =>
        broadcast.published_at != null ||
        broadcast.send_at != null ||
        broadcast.created_at != null
    )

    if (publishedBroadcasts.length === 0) {
      console.log('No broadcasts with dates found - using fallback')
      return res.status(200).json({
        newsletters: getFallbackNewsletters(),
        total: getFallbackNewsletters().length,
        source: 'fallback',
      })
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
          publishedAt: publishedDate,
          views: broadcast.total_recipients || null, // Use real recipient count or null if not available
          image: null, // Always use text-based icons instead of thumbnail images
          url: publicUrl,
          stats: broadcast.stats || {},
          isArchived: new Date(publishedDate) < new Date('2024-01-01'), // Mark as archived if older than 2024
          isPublic: broadcast.public || false, // Track if broadcast is public
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

    // If 2-year filter excluded everything, use fallback
    const toReturn = recentNewsletters.length > 0 ? recentNewsletters : getFallbackNewsletters()

    res.status(200).json({
      newsletters: toReturn.slice(0, 20), // Limit to 20 most recent
      total: toReturn.length,
      source: recentNewsletters.length > 0 ? 'convertkit' : 'fallback',
    })
  } catch (error) {
    console.error('Error fetching ConvertKit newsletters:', error)
    // Return fallback newsletters so dashboard always shows content
    res.status(200).json({
      newsletters: getFallbackNewsletters(),
      total: getFallbackNewsletters().length,
      source: 'fallback',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * Fallback newsletter list when ConvertKit API fails or returns empty.
 * Curated from news.moondao.com - ensures dashboard always shows recent newsletters.
 */
function getFallbackNewsletters(): Array<{
  id: string
  title: string
  publishedAt: string
  url: string
  views: null
  image: null
  isArchived: boolean
}> {
  const titleToSlug = (title: string): string =>
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
      .replace(/^-+|-+$/g, '')

  const fallbacks = [
    { title: 'Networked Capital, Analog Scholarships, and New Missions', date: '2026-02-23' },
    { title: "A New Era Begins: Decoding the Lunar Decade", date: '2026-02-10' },
    { title: "Don't Miss Out: Space Funding Event", date: '2026-02-09' },
    { title: 'MoonDAO Needs You: Vote for Projects', date: '2026-01-20' },
    { title: 'Retroactive Rewards Voting Open!', date: '2026-01-15' },
    { title: 'Funding Available for Q1 Projects (Deadline: Jan 15)', date: '2026-01-01' },
    { title: 'Happy New Year from MoonDAO!', date: '2025-12-31' },
    { title: '2025 Year in Review', date: '2025-12-20' },
    { title: 'The Power of a Community That Builds', date: '2025-12-02' },
    { title: 'Mission Success: THANK YOU', date: '2025-11-25' },
  ]

  return fallbacks.map((item, i) => {
    const slug = titleToSlug(item.title)
    return {
      id: `fallback-${i}`,
      title: item.title,
      publishedAt: item.date,
      url: slug ? `https://news.moondao.com/posts/${slug}` : 'https://news.moondao.com/posts',
      views: null,
      image: null,
      isArchived: new Date(item.date) < new Date('2024-01-01'),
    }
  })
}

export default withMiddleware(handler, rateLimit)
