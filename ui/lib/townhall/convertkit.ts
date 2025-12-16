export interface ConvertKitBroadcast {
  id: string
  subject: string
  content: string
  published_at?: string
  created_at: string
  public: boolean
  public_url?: string
}

export async function getBroadcastTags(broadcastId: string): Promise<string[]> {
  try {
    const apiKey = process.env.CONVERT_KIT_V4_API_KEY || process.env.CONVERT_KIT_API_KEY
    if (!apiKey) {
      throw new Error('ConvertKit API key not found')
    }

    const tagEndpoint = `https://api.convertkit.com/v4/broadcasts/${broadcastId}/tags`

    const response = await fetch(tagEndpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Kit-Api-Key': apiKey,
      },
    })

    if (!response.ok) {
      // 404 means broadcast has no tags, which is fine
      if (response.status === 404) {
        return []
      }
      // 429 means rate limited, return empty and let caller handle retry
      if (response.status === 429) {
        return []
      }
      throw new Error(`ConvertKit API error: ${response.status}`)
    }

    const data = await response.json()
    return (data.tags || []).map((tag: any) => tag.id?.toString() || tag.id)
  } catch (error) {
    // Silently return empty array for tag fetching errors
    return []
  }
}

/**
 * Checks if a broadcast is a town hall summary by looking for content markers.
 * Town hall summaries contain:
 * - <!-- TOWNHALL_VIDEO_ID:... --> comment
 * - <h1>Town Hall Summary - ...</h1> heading
 */
function isTownHallSummary(broadcast: ConvertKitBroadcast): boolean {
  if (!broadcast.content) {
    return false
  }

  // Check for TOWNHALL_VIDEO_ID marker (most reliable)
  if (broadcast.content.includes('<!-- TOWNHALL_VIDEO_ID:')) {
    return true
  }

  // Check for Town Hall Summary heading (fallback)
  if (broadcast.content.includes('<h1>Town Hall Summary -')) {
    return true
  }

  return false
}

export async function getTownHallBroadcasts(): Promise<ConvertKitBroadcast[]> {
  try {
    const apiKey = process.env.CONVERT_KIT_V4_API_KEY || process.env.CONVERT_KIT_API_KEY
    if (!apiKey) {
      throw new Error('ConvertKit API key not found')
    }

    // Fetch all broadcasts
    const endpoint = 'https://api.convertkit.com/v4/broadcasts'

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
    const allBroadcasts = data.broadcasts || []

    // Filter broadcasts to only include town hall summaries
    // We identify them by content markers, not tags (since ConvertKit doesn't support tagging broadcasts)
    const filtered = allBroadcasts.filter(isTownHallSummary)

    console.log(
      `[getTownHallBroadcasts] Found ${allBroadcasts.length} total broadcasts, ${filtered.length} town hall summaries`
    )

    return filtered
  } catch (error) {
    console.error('Error fetching ConvertKit broadcasts:', error)
    return []
  }
}

export async function findBroadcastByVideoId(videoId: string): Promise<ConvertKitBroadcast | null> {
  try {
    const broadcasts = await getTownHallBroadcasts()

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
