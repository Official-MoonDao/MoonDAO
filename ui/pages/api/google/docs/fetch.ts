import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveGoogleDocTitle } from '@/lib/google/docsTitle'
import { htmlToMarkdown } from '@/lib/google/htmlToMarkdown'

// Extract document ID from various Google Docs URL formats
function extractDocId(url: string): string | null {
  // Handle formats:
  // https://docs.google.com/document/d/DOCUMENT_ID/edit
  // https://docs.google.com/document/d/DOCUMENT_ID/edit?usp=sharing
  // https://docs.google.com/document/d/DOCUMENT_ID
  const patterns = [
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /^([a-zA-Z0-9_-]+)$/, // Direct ID
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return null
}

const GOOGLE_FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; MoonDAO/1.0)',
}

const SHARING_ERROR =
  'Access denied. Please make sure the document sharing is set to "Anyone with the link can view".'

const TEMPORARY_ERROR = 'Google Docs did not respond. Please try again in a moment.'

// Google's public HTML export drops connections and returns 429/5xx on docs
// that are already shared with anyone who has the link. Retry those, and only
// blame sharing on a real 401/403 or a login page.
const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504])
const EXPORT_ATTEMPTS = 3
const EXPORT_TIMEOUT_MS = 12_000

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchGoogleExport(exportUrl: string): Promise<Response> {
  let lastResponse: Response | null = null
  let lastError: unknown

  for (let attempt = 0; attempt < EXPORT_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(exportUrl, {
        headers: GOOGLE_FETCH_HEADERS,
        signal: AbortSignal.timeout(EXPORT_TIMEOUT_MS),
      })
      if (response.ok || !TRANSIENT_STATUSES.has(response.status)) {
        return response
      }
      lastResponse = response
      console.error(
        `Google Docs export attempt ${attempt + 1} returned ${response.status}`
      )
      await response.arrayBuffer().catch(() => undefined)
    } catch (error) {
      lastError = error
      console.error(`Google Docs export attempt ${attempt + 1} failed`, error)
    }

    if (attempt < EXPORT_ATTEMPTS - 1) {
      await delay(400 * (attempt + 1))
    }
  }

  if (lastResponse) return lastResponse
  throw lastError instanceof Error ? lastError : new Error('Failed to fetch document')
}

async function fetchPreviewTitle(docId: string): Promise<string> {
  try {
    const previewResponse = await fetch(`https://docs.google.com/document/d/${docId}/preview`, {
      headers: GOOGLE_FETCH_HEADERS,
    })
    if (!previewResponse.ok) return ''
    const previewHtml = await previewResponse.text()
    return resolveGoogleDocTitle({ previewHtml })
  } catch {
    return ''
  }
}

// Pages Router reads the timeout from `config.maxDuration`. Three export
// attempts need more than the ~10s platform default.
export const config = {
  maxDuration: 60,
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { url } = req.body

    if (!url) {
      return res.status(400).json({ error: 'Google Docs URL is required' })
    }

    const docId = extractDocId(url)

    if (!docId) {
      return res.status(400).json({
        error: 'Invalid Google Docs URL. Please provide a valid Google Docs link.',
      })
    }

    // Use the public export URL - this works for any document with "Anyone with the link" access
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=html`

    const response = await fetchGoogleExport(exportUrl)

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({
          error: 'Document not found. Please check the URL and try again.',
        })
      }

      if (response.status === 403 || response.status === 401) {
        return res.status(403).json({ error: SHARING_ERROR })
      }

      console.error('Google Docs export failed', response.status)
      return res.status(502).json({ error: TEMPORARY_ERROR })
    }

    const html = await response.text()

    // Check if we got an error page instead of the document
    if (html.includes('Sign in') && html.includes('Google Account')) {
      return res.status(403).json({ error: SHARING_ERROR })
    }

    // Export HTML does not include a <title> tag. The document name lives on
    // Content-Disposition (filename*) and, as a fallback, the public preview page.
    let title = resolveGoogleDocTitle({
      contentDisposition: response.headers.get('content-disposition'),
      html,
    })
    if (!title) {
      title = await fetchPreviewTitle(docId)
    }
    const markdown = htmlToMarkdown(html)

    return res.status(200).json({
      title,
      content: markdown,
      documentId: docId,
    })
  } catch (error) {
    console.error('Error fetching Google Doc:', error)

    return res.status(502).json({ error: TEMPORARY_ERROR })
  }
}

export default withMiddleware(handler, rateLimit)
