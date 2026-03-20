export interface YouTubeVideoMetadata {
  id: string
  title: string
  description: string
  thumbnail: string
  publishedAt: string
  duration: string
  channelId: string
  channelTitle: string
  liveBroadcastContent?: string
}

export function extractVideoId(urlOrId: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ]

  for (const pattern of patterns) {
    const match = urlOrId.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

/**
 * Collect video IDs from a YouTube search response, then batch-fetch their
 * metadata with a single `videos.list` call (saves API quota vs N calls).
 * Returns the first valid result (preserving the search-result order).
 */
async function firstVideoFromSearch(
  searchItems: any[] | undefined,
  apiKey: string
): Promise<YouTubeVideoMetadata | null> {
  if (!searchItems || searchItems.length === 0) return null

  const ids = searchItems
    .map((item: any) => item.id?.videoId)
    .filter(Boolean) as string[]

  if (ids.length === 0) return null

  // Batch: one API call for all IDs (comma-separated, max 50 supported)
  const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${ids.join(',')}&key=${apiKey}`
  const response = await fetch(videoUrl)
  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status}`)
  }

  const data = await response.json()
  if (!data.items || data.items.length === 0) return null

  // Build a map so we can return results in the original search order
  const metadataMap = new Map<string, YouTubeVideoMetadata>()
  for (const video of data.items) {
    const snippet = video.snippet
    if (!snippet) continue
    metadataMap.set(video.id, {
      id: video.id,
      title: snippet.title || '',
      description: snippet.description || '',
      thumbnail:
        snippet.thumbnails?.maxres?.url ||
        snippet.thumbnails?.high?.url ||
        snippet.thumbnails?.medium?.url ||
        snippet.thumbnails?.default?.url ||
        '',
      publishedAt: snippet.publishedAt || '',
      duration: video.contentDetails?.duration || '',
      channelId: snippet.channelId || '',
      channelTitle: snippet.channelTitle || '',
      liveBroadcastContent:
        snippet.liveBroadcastContent || video.status?.liveBroadcastContent,
    })
  }

  // Return the first match in the original search order
  for (const id of ids) {
    const meta = metadataMap.get(id)
    if (meta) return meta
  }
  return null
}

export async function getLatestLiveVideo(
  channelId: string,
  apiKey: string
): Promise<YouTubeVideoMetadata | null> {
  try {
    // First try: search for completed live streams (town halls are usually live)
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=completed&type=video&order=date&maxResults=10&key=${apiKey}`

    const response = await fetch(searchUrl)
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`)
    }

    const data = await response.json()
    const primary = await firstVideoFromSearch(data.items, apiKey)
    if (primary) return primary

    // Fallback: search for recent uploads with "town hall" in title
    const fallbackUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=10&q=town+hall&key=${apiKey}`

    const fallbackResponse = await fetch(fallbackUrl)
    if (!fallbackResponse.ok) {
      throw new Error(`YouTube API error: ${fallbackResponse.status}`)
    }

    const fallbackData = await fallbackResponse.json()
    return await firstVideoFromSearch(fallbackData.items, apiKey)
  } catch (error) {
    console.error('Error fetching latest live video:', error)
    throw error
  }
}

export async function getVideoMetadata(
  videoId: string,
  apiKey: string
): Promise<YouTubeVideoMetadata | null> {
  try {
    const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${videoId}&key=${apiKey}`

    const response = await fetch(videoUrl)
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`)
    }

    const data = await response.json()

    if (!data.items || data.items.length === 0) {
      return null
    }

    const video = data.items[0]
    const snippet = video.snippet
    const contentDetails = video.contentDetails
    const status = video.status

    if (!snippet) {
      return null
    }

    return {
      id: videoId,
      title: snippet.title || '',
      description: snippet.description || '',
      thumbnail:
        snippet.thumbnails?.maxres?.url ||
        snippet.thumbnails?.high?.url ||
        snippet.thumbnails?.medium?.url ||
        snippet.thumbnails?.default?.url ||
        '',
      publishedAt: snippet.publishedAt || '',
      duration: contentDetails?.duration || '',
      channelId: snippet.channelId || '',
      channelTitle: snippet.channelTitle || '',
      liveBroadcastContent: snippet.liveBroadcastContent || status?.liveBroadcastContent,
    }
  } catch (error) {
    console.error('Error fetching video metadata:', error)
    throw error
  }
}

export async function getVideoAudioUrl(videoId: string): Promise<string | null> {
  try {
    const ytDlpUrl = `https://www.youtube.com/watch?v=${videoId}`
    return ytDlpUrl
  } catch (error) {
    console.error('Error getting video audio URL:', error)
    return null
  }
}
