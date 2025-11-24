export interface ConvertKitBroadcast {
  id: string
  subject: string
  content: string
  published_at?: string
  created_at: string
  public: boolean
  public_url?: string
}

export async function createTownHallBroadcast(
  subject: string,
  content: string,
  tagId?: string,
  sendEmail: boolean = false
): Promise<ConvertKitBroadcast | null> {
  try {
    const apiKey = process.env.CONVERT_KIT_API_KEY || process.env.CONVERT_KIT_V4_API_KEY
    if (!apiKey) {
      throw new Error('ConvertKit API key not found')
    }

    const broadcastEndpoint = 'https://api.convertkit.com/v4/broadcasts'

    const body: any = {
      subject: subject,
      content: content,
      public: true,
    }

    // If sendEmail is false, we omit send_at entirely, which creates a draft broadcast that won't be sent but will be public and visible on the website
    if (sendEmail) {
      body.send_at = null
    }

    const response = await fetch(broadcastEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Kit-Api-Key': apiKey,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ConvertKit API error:', errorText)
      throw new Error(`ConvertKit API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()

    if (tagId && data.broadcast?.id) {
      await tagBroadcast(data.broadcast.id, tagId)
    }

    return data.broadcast || null
  } catch (error) {
    console.error('Error creating ConvertKit broadcast:', error)
    throw error
  }
}

export async function tagBroadcast(broadcastId: string, tagId: string): Promise<void> {
  try {
    const apiKey = process.env.CONVERT_KIT_API_KEY || process.env.CONVERT_KIT_V4_API_KEY
    if (!apiKey) {
      throw new Error('ConvertKit API key not found')
    }

    const tagEndpoint = `https://api.convertkit.com/v4/broadcasts/${broadcastId}/tags`

    await fetch(tagEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Kit-Api-Key': apiKey,
      },
      body: JSON.stringify({
        tag_id: tagId,
      }),
    })
  } catch (error) {
    console.error('Error tagging broadcast:', error)
  }
}

export async function getTownHallBroadcasts(tagId?: string): Promise<ConvertKitBroadcast[]> {
  try {
    const apiKey = process.env.CONVERT_KIT_V4_API_KEY || process.env.CONVERT_KIT_API_KEY
    if (!apiKey) {
      throw new Error('ConvertKit API key not found')
    }

    const endpoint = tagId
      ? `https://api.convertkit.com/v4/broadcasts?tag_id=${tagId}`
      : 'https://api.convertkit.com/v4/broadcasts'

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Kit-Api-Key': apiKey,
      },
    })

    if (!response.ok) {
      throw new Error(`ConvertKit API error: ${response.status}`)
    }

    const data = await response.json()
    return data.broadcasts || []
  } catch (error) {
    console.error('Error fetching ConvertKit broadcasts:', error)
    return []
  }
}

export async function findBroadcastByVideoId(
  videoId: string,
  tagId?: string
): Promise<ConvertKitBroadcast | null> {
  try {
    const broadcasts = await getTownHallBroadcasts(tagId)

    for (const broadcast of broadcasts) {
      if (broadcast.content && broadcast.content.includes(`TOWNHALL_VIDEO_ID:${videoId}`)) {
        return broadcast
      }
    }

    return null
  } catch (error) {
    console.error('Error finding broadcast by video ID:', error)
    return null
  }
}

export async function getBroadcastById(broadcastId: string): Promise<ConvertKitBroadcast | null> {
  try {
    const apiKey = process.env.CONVERT_KIT_V4_API_KEY || process.env.CONVERT_KIT_API_KEY
    if (!apiKey) {
      throw new Error('ConvertKit API key not found')
    }

    const endpoint = `https://api.convertkit.com/v4/broadcasts/${broadcastId}`

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Kit-Api-Key': apiKey,
      },
    })

    if (!response.ok) {
      throw new Error(`ConvertKit API error: ${response.status}`)
    }

    const data = await response.json()
    return data.broadcast || null
  } catch (error) {
    console.error('Error fetching ConvertKit broadcast:', error)
    return null
  }
}
