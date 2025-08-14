import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // ConvertKit API configuration
    const CONVERTKIT_API_KEY = process.env.CONVERT_KIT_API_KEY
    const CONVERTKIT_API_SECRET = process.env.CONVERT_KIT_API_SECRET
    
    if (!CONVERTKIT_API_KEY) {
      console.log('ConvertKit API key not found')
      return res.status(500).json({ 
        message: 'ConvertKit API not configured',
        newsletters: [] 
      })
    }

    // Try multiple ConvertKit endpoints to find the most recent newsletters
    let allBroadcasts: any[] = []
    
    const endpoints = [
      `https://api.convertkit.com/v3/broadcasts?api_key=${CONVERTKIT_API_KEY}`, // All broadcasts
      `https://api.convertkit.com/v3/broadcasts?api_key=${CONVERTKIT_API_KEY}&status=sent&sort_order=desc`, // Sent newsletters, newest first
      `https://api.convertkit.com/v3/broadcasts?api_key=${CONVERTKIT_API_KEY}&status=published&sort_order=desc`, // Published newsletters
    ]

    console.log('Trying multiple ConvertKit endpoints to find recent newsletters...')
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Fetching from: ${endpoint.replace(CONVERTKIT_API_KEY, '[API_KEY]')}`)
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const data = await response.json()
          console.log(`Endpoint returned ${data.broadcasts?.length || 0} broadcasts`)
          
          if (data.broadcasts && Array.isArray(data.broadcasts) && data.broadcasts.length > 0) {
            // Log the dates of the newsletters we found
            const dates = data.broadcasts.slice(0, 3).map((b: any) => ({
              subject: b.subject,
              published_at: b.published_at,
              created_at: b.created_at,
              status: b.status
            }))
            console.log('Sample broadcast dates:', dates)
            
            // Merge broadcasts, avoiding duplicates
            for (const broadcast of data.broadcasts) {
              if (!allBroadcasts.find(b => b.id === broadcast.id)) {
                allBroadcasts.push(broadcast)
              }
            }
          }
        } else {
          console.log(`Endpoint failed: ${response.status} ${response.statusText}`)
        }
      } catch (error) {
        console.log(`Endpoint error:`, error)
      }
    }
    
    console.log(`Total unique broadcasts found: ${allBroadcasts.length}`)
    
    if (allBroadcasts.length === 0) {
      throw new Error('No broadcasts found from any ConvertKit endpoint')
    }
    
    // Sort all broadcasts by date (newest first)
    allBroadcasts.sort((a: any, b: any) => {
      const dateA = new Date(a.published_at || a.created_at || 0).getTime()
      const dateB = new Date(b.published_at || b.created_at || 0).getTime()
      return dateB - dateA
    })
    
    console.log('Newest broadcasts:', allBroadcasts.slice(0, 3).map(b => ({
      subject: b.subject,
      date: b.published_at || b.created_at,
      status: b.status
    })))
    
    // Transform ConvertKit data to our format
    const newsletters = allBroadcasts.map((broadcast: any) => {
      // For ConvertKit newsletters, link to the posts archive page
      // since individual post URLs might not be accessible for older content
      let publicUrl = 'https://moondao.kit.com/posts' // Link to newsletter archive
      
      // If there's a verified public_url or web_url available, prefer it
      if (broadcast.public_url && broadcast.public_url.includes('kit.com')) {
        publicUrl = broadcast.public_url
      } else if (broadcast.web_url && broadcast.web_url.includes('kit.com')) {
        publicUrl = broadcast.web_url
      }
      
      console.log('Newsletter details:', {
        id: broadcast.id,
        subject: broadcast.subject,
        slug: broadcast.slug,
        public_url: broadcast.public_url,
        web_url: broadcast.web_url,
        published_at: broadcast.published_at,
        status: broadcast.status,
        total_recipients: broadcast.total_recipients,
        stats: broadcast.stats,
        final_url: publicUrl
      })
      
      
      return {
        id: broadcast.id?.toString() || Math.random().toString(),
        title: broadcast.subject || 'Newsletter Update',
        description: broadcast.preview_text || 
                    (broadcast.content ? 
                      broadcast.content.substring(0, 200).replace(/<[^>]*>/g, '') + '...' : 
                      'Newsletter content available'),
        publishedAt: broadcast.published_at || broadcast.created_at,
        views: broadcast.total_recipients || null, // Use real recipient count or null if not available
        readTime: Math.ceil(((broadcast.content?.length || 1000) / 200)),
        image: null, // ConvertKit doesn't provide thumbnails in basic API
        url: publicUrl,
        stats: broadcast.stats || {},
        isArchived: new Date(broadcast.published_at || broadcast.created_at) < new Date('2024-01-01') // Mark as archived if older than 2024
      }
    }) || []

    // Filter to only include published/sent newsletters from the last 2 years
    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
    
    const recentNewsletters = newsletters.filter((newsletter: any) => {
      const publishedDate = new Date(newsletter.publishedAt)
      return publishedDate >= twoYearsAgo
    })

    // Sort by published date (newest first)
    recentNewsletters.sort((a: any, b: any) => {
      const dateA = new Date(a.publishedAt || 0).getTime()
      const dateB = new Date(b.publishedAt || 0).getTime()
      return dateB - dateA
    })

    console.log(`Found ${newsletters.length} total newsletters, ${recentNewsletters.length} recent ones`)

    res.status(200).json({ 
      newsletters: recentNewsletters.slice(0, 20), // Limit to 20 most recent
      total: recentNewsletters.length,
      source: 'convertkit'
    })
  } catch (error) {
    console.error('Error fetching ConvertKit newsletters:', error)
    res.status(500).json({ 
      message: 'Failed to fetch newsletter data',
      newsletters: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
