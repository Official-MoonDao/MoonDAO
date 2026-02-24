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
      console.log('ConvertKit API key not found')
      return res.status(500).json({
        message: 'ConvertKit API not configured',
        newsletters: [],
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
      throw new Error('No broadcasts found from any ConvertKit endpoint')
    }

    // Filter out drafts, only include broadcasts that have been published
    const publishedBroadcasts = allBroadcasts.filter(
      (broadcast: any) => broadcast.published_at !== null && broadcast.published_at !== undefined
    )

    if (publishedBroadcasts.length === 0) {
      console.log('No published broadcasts found (only drafts available)')
      return res.status(200).json({
        newsletters: [],
        total: 0,
        source: 'convertkit',
      })
    }

    // Sort all broadcasts by date (newest first)
    publishedBroadcasts.sort((a: any, b: any) => {
      const dateA = new Date(a.published_at || 0).getTime()
      const dateB = new Date(b.published_at || 0).getTime()
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

        // Use published_at (drafts are already filtered out)
        const publishedDate = broadcast.published_at

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

    res.status(200).json({
      newsletters: recentNewsletters.slice(0, 20), // Limit to 20 most recent
      total: recentNewsletters.length,
      source: 'convertkit',
    })
  } catch (error) {
    console.error('Error fetching ConvertKit newsletters:', error)
    res.status(500).json({
      message: 'Failed to fetch newsletter data',
      newsletters: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

export default withMiddleware(handler, rateLimit)
