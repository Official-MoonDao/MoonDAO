// Convert HTML to Markdown
export function htmlToMarkdown(html: string): string {
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

  // Handle ordered lists. The item body has to be kept: Google Docs exports
  // each priority as <li><span>…</span></li>, and dropping the capture
  // leaves a bare "1. 2. 3. 4." line.
  markdown = markdown.replace(/<ol([^>]*)>([\s\S]*?)<\/ol>/gi, (_match, attrs, content) => {
    const startAttr = String(attrs).match(/\bstart\s*=\s*["']?(\d+)/i)
    let listCounter = startAttr ? Number(startAttr[1]) - 1 : 0
    return (
      content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_item: string, body: string) => {
        listCounter++
        return `${listCounter}. ${String(body).trim()}\n`
      }) + '\n'
    )
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
    return (
      content
        .split('\n')
        .map((line: string) => `> ${line}`)
        .join('\n') + '\n\n'
    )
  })

  // Handle code blocks
  markdown = markdown.replace(
    /<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
    '\n```\n$1\n```\n\n'
  )
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
    .replace(/&ge;/g, '≥')
    .replace(/&le;/g, '≤')
    .replace(/&times;/g, '×')
    .replace(/&rarr;/g, '→')

  // Clean up extra whitespace
  markdown = markdown.replace(/\n{3,}/g, '\n\n')
  markdown = markdown.replace(/[ \t]+\n/g, '\n')
  markdown = markdown.trim()

  return markdown
}
