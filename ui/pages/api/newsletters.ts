import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // ConvertKit API configuration
    const CONVERTKIT_API_KEY = process.env.CONVERT_KIT_V4_API_KEY

    if (!CONVERTKIT_API_KEY) {
      console.log('ConvertKit API key not found')
      return res.status(500).json({
        message: 'ConvertKit API not configured',
        newsletters: [],
      })
    }

    // Try multiple ConvertKit endpoints to find the most recent newsletters
    let allBroadcasts: any[] = []

    const endpoints = [`https://api.kit.com/v4/broadcasts`]

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Kit-Api-Key': CONVERTKIT_API_KEY,
          },
        })

        if (response.ok) {
          const data = await response.json()

          if (
            data.broadcasts &&
            Array.isArray(data.broadcasts) &&
            data.broadcasts.length > 0
          ) {
            // Log the dates of the newsletters we found
            const dates = data.broadcasts.slice(0, 3).map((b: any) => ({
              subject: b.subject,
              published_at: b.published_at,
              created_at: b.created_at,
              public: b.public,
            }))

            // Merge broadcasts, avoiding duplicates
            for (const broadcast of data.broadcasts) {
              if (!allBroadcasts.find((b) => b.id === broadcast.id)) {
                allBroadcasts.push(broadcast)
              }
            }
          }
        } else {
          console.log(
            `Endpoint failed: ${response.status} ${response.statusText}`
          )
        }
      } catch (error) {
        console.log(`Endpoint error:`, error)
      }
    }

    if (allBroadcasts.length === 0) {
      throw new Error('No broadcasts found from any ConvertKit endpoint')
    }

    // Sort all broadcasts by date (newest first)
    allBroadcasts.sort((a: any, b: any) => {
      const dateA = new Date(a.published_at || a.created_at || 0).getTime()
      const dateB = new Date(b.published_at || b.created_at || 0).getTime()
      return dateB - dateA
    })

    // Transform ConvertKit data to our format
    const newsletters =
      allBroadcasts.slice(0, 10).map((broadcast: any) => {
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

        // Use published_at if available, otherwise fall back to created_at
        const publishedDate = broadcast.published_at || broadcast.created_at

        // Simple description for all newsletters
        const getDescription = (): string => {
          return 'Newsletter content available'
        }

        // Calculate read time based on cleaned content length
        const calculateReadTime = (content: string): number => {
          if (!content) return 5 // Default 5 minutes

          // Clean the content first to get actual readable text
          let cleaned = content
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/@media[^{]*\{[^}]*\}/g, '') // Remove CSS media queries
            .replace(/@[^{]*\{[^}]*\}/g, '') // Remove other CSS rules
            .replace(/[^{}]*\{[^}]*\}/g, '') // Remove CSS properties
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim()

          // Simple word count estimation (rough approximation)
          const wordCount = cleaned.split(/\s+/).length
          const readTime = Math.ceil(wordCount / 200) // 200 words per minute
          return Math.max(1, Math.min(readTime, 60)) // Between 1-60 minutes
        }

        return {
          id: broadcast.id?.toString() || Math.random().toString(),
          title: broadcast.subject || 'Newsletter Update',
          description: getDescription(),
          publishedAt: publishedDate,
          views: broadcast.total_recipients || null, // Use real recipient count or null if not available
          readTime: calculateReadTime(broadcast.content || ''),
          image: null, // Always use text-based icons instead of thumbnail images
          url: publicUrl,
          stats: broadcast.stats || {},
          isArchived: new Date(publishedDate) < new Date('2024-01-01'), // Mark as archived if older than 2024
          isPublic: broadcast.public || false, // Track if broadcast is public
        }
      }) || []

    // Filter to only include public newsletters from the last 2 years
    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

    const recentNewsletters = newsletters.filter((newsletter: any) => {
      // Only include public newsletters with valid published dates
      if (!newsletter.isPublic || !newsletter.publishedAt) {
        return false
      }

      const publishedDate = new Date(newsletter.publishedAt)
      const isRecent = publishedDate >= twoYearsAgo

      return isRecent
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
