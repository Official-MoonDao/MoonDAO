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

export async function getLatestLiveVideo(
  channelId: string,
  apiKey: string
): Promise<YouTubeVideoMetadata | null> {
  try {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=completed&type=video&order=date&maxResults=50&key=${apiKey}`

    const response = await fetch(searchUrl)
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`)
    }

    const data = await response.json()

    if (!data.items || data.items.length === 0) {
      return null
    }

    for (const item of data.items) {
      if (item.snippet?.liveBroadcastContent === 'none' && item.id?.videoId) {
        const videoId = item.id.videoId
        const videoDetails = await getVideoMetadata(videoId, apiKey)
        if (videoDetails && videoDetails.liveBroadcastContent === 'none') {
          return videoDetails
        }
      }
    }

    return null
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
