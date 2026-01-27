import type { NextApiRequest, NextApiResponse } from 'next'

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

// Convert HTML to Markdown
function htmlToMarkdown(html: string): string {
  let markdown = html

  // Remove style tags and their content
  markdown = markdown.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  
  // Remove script tags and their content
  markdown = markdown.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')

  // Handle headings
  markdown = markdown.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n\n')
  markdown = markdown.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n\n')
  markdown = markdown.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n\n')
  markdown = markdown.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n\n')
  markdown = markdown.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n\n')
  markdown = markdown.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n\n')

  // Handle bold
  markdown = markdown.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, '**$2**')

  // Handle italic
  markdown = markdown.replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, '*$2*')

  // Handle strikethrough
  markdown = markdown.replace(/<(del|s|strike)[^>]*>([\s\S]*?)<\/(del|s|strike)>/gi, '~~$2~~')

  // Handle links
  markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')

  // Handle images
  markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)')
  markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)')

  // Handle unordered lists
  markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, content) => {
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n') + '\n'
  })

  // Handle ordered lists
  let listCounter = 0
  markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, content) => {
    listCounter = 0
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (liMatch: string, liContent: string) => {
      listCounter++
      return `${listCounter}. ${liContent}\n`
    }) + '\n'
  })

  // Handle list items that might still be there
  markdown = markdown.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')

  // Handle paragraphs
  markdown = markdown.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')

  // Handle line breaks
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n')

  // Handle horizontal rules
  markdown = markdown.replace(/<hr[^>]*\/?>/gi, '\n---\n\n')

  // Handle blockquotes
  markdown = markdown.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (match, content) => {
    return content.split('\n').map((line: string) => `> ${line}`).join('\n') + '\n\n'
  })

  // Handle code blocks
  markdown = markdown.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n\n')
  markdown = markdown.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n\n')

  // Handle inline code
  markdown = markdown.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')

  // Handle tables
  markdown = markdown.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (match, content) => {
    let tableMarkdown = '\n'
    const rows = content.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || []
    
    rows.forEach((row: string, rowIndex: number) => {
      const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || []
      const cellContents = cells.map((cell: string) => {
        return cell.replace(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/i, '$1').trim()
      })
      
      tableMarkdown += '| ' + cellContents.join(' | ') + ' |\n'
      
      // Add header separator after first row
      if (rowIndex === 0) {
        tableMarkdown += '| ' + cellContents.map(() => '---').join(' | ') + ' |\n'
      }
    })
    
    return tableMarkdown + '\n'
  })

  // Handle divs and spans (just extract content)
  markdown = markdown.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n')
  markdown = markdown.replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, '$1')

  // Remove any remaining HTML tags
  markdown = markdown.replace(/<[^>]+>/g, '')

  // Decode HTML entities
  markdown = markdown
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '...')

  // Clean up extra whitespace
  markdown = markdown.replace(/\n{3,}/g, '\n\n')
  markdown = markdown.replace(/[ \t]+\n/g, '\n')
  markdown = markdown.trim()

  return markdown
}

// Extract title from HTML
function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (titleMatch) {
    let title = titleMatch[1]
    // Google Docs titles often end with " - Google Docs"
    title = title.replace(/\s*-\s*Google Docs\s*$/i, '')
    return title.trim()
  }
  return 'Untitled'
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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
        error: 'Invalid Google Docs URL. Please provide a valid Google Docs link.' 
      })
    }
    
    // Use the public export URL - this works for any document with "Anyone with the link" access
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=html`
    
    const response = await fetch(exportUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MoonDAO/1.0)',
      },
    })
    
    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({
          error: 'Document not found. Please check the URL and try again.',
        })
      }
      
      if (response.status === 403 || response.status === 401) {
        return res.status(403).json({
          error: 'Access denied. Please make sure the document sharing is set to "Anyone with the link can view".',
        })
      }
      
      throw new Error(`Failed to fetch document: ${response.status}`)
    }
    
    const html = await response.text()
    
    // Check if we got an error page instead of the document
    if (html.includes('Sign in') && html.includes('Google Account')) {
      return res.status(403).json({
        error: 'Access denied. Please make sure the document sharing is set to "Anyone with the link can view".',
      })
    }
    
    const title = extractTitle(html)
    const markdown = htmlToMarkdown(html)
    
    return res.status(200).json({
      title,
      content: markdown,
      documentId: docId,
    })
  } catch (error: any) {
    console.error('Error fetching Google Doc:', error)
    
    return res.status(500).json({
      error: 'Failed to fetch document. Please make sure the document sharing is set to "Anyone with the link can view".',
    })
  }
}
