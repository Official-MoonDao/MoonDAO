import { matchesAdvancedSearch } from '../search/advancedSearch'
import { getTownHallBroadcasts } from './convertkit'
import { ConvertKitBroadcast } from './convertkit'

export interface TownHallSummary {
  id: string
  title: string
  content: string
  publishedAt: string
  url?: string
  createdAt: string
  videoId?: string
}

export interface GetSummariesOptions {
  limit?: number
  offset?: number
  search?: string
}

export interface GetSummariesResult {
  summaries: TownHallSummary[]
  total: number
  limit: number
  offset: number
}

/**
 * Extracts the video published date from broadcast content.
 * First tries to extract from the comment: <!-- TOWNHALL_VIDEO_DATE:ISO_DATE -->
 * Falls back to parsing the formatted date from the h1 tag if comment not found.
 */
function extractVideoPublishedAt(broadcast: ConvertKitBroadcast): string | null {
  if (!broadcast.content) {
    return null
  }

  // First, try to extract ISO date from comment (most reliable)
  // Format: <!-- TOWNHALL_VIDEO_DATE:2024-01-15T00:00:00Z -->
  const dateCommentMatch = broadcast.content.match(/<!-- TOWNHALL_VIDEO_DATE:([^>]+) -->/)
  if (dateCommentMatch && dateCommentMatch[1]) {
    try {
      const date = new Date(dateCommentMatch[1])
      if (!isNaN(date.getTime())) {
        return date.toISOString()
      }
    } catch (e) {
      // Date parsing failed, continue to fallback
    }
  }

  // Fallback: Try to extract date from the h1 tag: <h1>Town Hall Summary - Month Day, Year</h1>
  // Example: "Town Hall Summary - January 15, 2024"
  const h1Match = broadcast.content.match(/<h1>Town Hall Summary - (.+?)<\/h1>/)
  if (h1Match && h1Match[1]) {
    try {
      // Parse date string like "January 15, 2024"
      const date = new Date(h1Match[1])
      if (!isNaN(date.getTime())) {
        return date.toISOString()
      }
    } catch (e) {
      // Date parsing failed, will fall back to broadcast dates
    }
  }

  return null
}

/**
 * Strips HTML tags and entities from content for text searching.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

export async function getSummaries({
  limit = 20,
  offset = 0,
  search,
}: GetSummariesOptions): Promise<GetSummariesResult> {
  const broadcasts = await getTownHallBroadcasts()

  let filteredBroadcasts = broadcasts
    .filter((broadcast) => broadcast.public)
    .sort((a, b) => {
      // Try to use video publishedAt from content first, then fall back to broadcast dates
      const videoDateA = extractVideoPublishedAt(a)
      const videoDateB = extractVideoPublishedAt(b)

      const dateA = videoDateA
        ? new Date(videoDateA).getTime()
        : new Date(a.published_at || a.created_at || 0).getTime()
      const dateB = videoDateB
        ? new Date(videoDateB).getTime()
        : new Date(b.published_at || b.created_at || 0).getTime()

      return dateB - dateA // Newest first for display
    })

  // Apply search filtering if search term provided
  if (search) {
    const searchTerm = search.trim()
    filteredBroadcasts = filteredBroadcasts.filter((broadcast) => {
      const title = broadcast.subject
      const content = stripHtml(broadcast.content || '')
      const combinedText = `${title} ${content}`
      return matchesAdvancedSearch(combinedText, searchTerm)
    })
  }

  const paginatedBroadcasts = filteredBroadcasts.slice(offset, offset + limit)

  const summaries: TownHallSummary[] = paginatedBroadcasts.map((broadcast) => {
    // Extract video ID from broadcast content
    // Format: <!-- TOWNHALL_VIDEO_ID:abc123 -->
    let videoId: string | undefined
    if (broadcast.content) {
      const videoIdMatch = broadcast.content.match(/<!-- TOWNHALL_VIDEO_ID:([^>]+) -->/)
      if (videoIdMatch && videoIdMatch[1]) {
        videoId = videoIdMatch[1]
      }
    }

    // Extract video title from <h2> tag in content for more accurate title
    let title = broadcast.subject
    if (broadcast.content) {
      const h2Match = broadcast.content.match(/<h2[^>]*>(.*?)<\/h2>/)
      if (h2Match && h2Match[1]) {
        title = h2Match[1]
      }
    }

    return {
      id: broadcast.id,
      title: title,
      content: broadcast.content,
      publishedAt: broadcast.published_at || broadcast.created_at,
      url: broadcast.public_url,
      createdAt: broadcast.created_at,
      videoId: videoId,
    }
  })

  return {
    summaries,
    total: filteredBroadcasts.length,
    limit,
    offset,
  }
}
