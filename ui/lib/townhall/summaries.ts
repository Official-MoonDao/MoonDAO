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

/**
 * Advanced search parser supporting:
 * - Exact word matching with quotes: "June"
 * - Phrase search: "town hall meeting"
 * - Boolean AND (default): term1 term2 or term1 AND term2
 * - Boolean OR: term1 OR term2
 * - Boolean NOT: -term or term1 NOT term2
 */
function parseSearchQuery(query: string): {
  requiredTerms: string[]
  optionalTerms: string[]
  excludedTerms: string[]
  phrases: string[]
} {
  const requiredTerms: string[] = []
  const optionalTerms: string[] = []
  const excludedTerms: string[] = []
  const phrases: string[] = []

  // Extract phrases (quoted strings)
  const phraseMatches = query.matchAll(/"([^"]+)"/g)
  for (const match of phraseMatches) {
    phrases.push(match[1].toLowerCase())
  }

  // Remove phrases from query for further processing
  let remainingQuery = query.replace(/"[^"]+"/g, ' ')

  // Process the remaining query
  const tokens = remainingQuery.split(/\s+/).filter((t) => t.trim())
  let i = 0

  while (i < tokens.length) {
    const token = tokens[i].toLowerCase()

    // Skip empty tokens
    if (!token) {
      i++
      continue
    }

    // Handle NOT operator
    if (token === 'not' && i + 1 < tokens.length) {
      excludedTerms.push(tokens[i + 1].toLowerCase())
      i += 2
      continue
    }

    // Handle OR operator
    if (token === 'or') {
      // Previous term becomes optional if it was required
      if (requiredTerms.length > 0) {
        const prevTerm = requiredTerms.pop()
        if (prevTerm) optionalTerms.push(prevTerm)
      }
      // Next term is optional
      if (i + 1 < tokens.length) {
        optionalTerms.push(tokens[i + 1].toLowerCase())
        i += 2
      } else {
        i++
      }
      continue
    }

    // Handle AND operator (explicit, though it's default behavior)
    if (token === 'and') {
      i++
      continue
    }

    // Handle excluded terms (prefixed with -)
    if (token.startsWith('-') && token.length > 1) {
      excludedTerms.push(token.substring(1))
      i++
      continue
    }

    // Regular term (required by default)
    if (token !== 'or' && token !== 'and' && token !== 'not') {
      requiredTerms.push(token)
    }
    i++
  }

  return { requiredTerms, optionalTerms, excludedTerms, phrases }
}

/**
 * Checks if text matches the advanced search criteria
 */
function matchesAdvancedSearch(text: string, searchQuery: string): boolean {
  const lowerText = text.toLowerCase()
  const { requiredTerms, optionalTerms, excludedTerms, phrases } = parseSearchQuery(searchQuery)

  // Check excluded terms first (if any match, return false)
  for (const term of excludedTerms) {
    const regex = new RegExp(`\\b${term}\\b`, 'i')
    if (regex.test(lowerText)) {
      return false
    }
  }

  // Check required phrases (all must match)
  for (const phrase of phrases) {
    if (!lowerText.includes(phrase)) {
      return false
    }
  }

  // Check required terms (all must match as whole words)
  for (const term of requiredTerms) {
    const regex = new RegExp(`\\b${term}\\b`, 'i')
    if (!regex.test(lowerText)) {
      return false
    }
  }

  // Check optional terms (at least one must match if any are specified)
  if (optionalTerms.length > 0) {
    const hasMatch = optionalTerms.some((term) => {
      const regex = new RegExp(`\\b${term}\\b`, 'i')
      return regex.test(lowerText)
    })
    if (!hasMatch) {
      return false
    }
  }

  return true
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
