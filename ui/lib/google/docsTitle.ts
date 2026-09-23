const UNTITLED_PATTERN = /^\s*untitled\b/i

export function isUsableDocTitle(title: string | undefined | null): boolean {
  if (!title) return false
  const trimmed = title.trim()
  if (!trimmed) return false
  return !UNTITLED_PATTERN.test(trimmed)
}

export function decodeHtmlEntities(value: string): string {
  return value
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
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
}

export function cleanGoogleDocTitle(title: string): string {
  return decodeHtmlEntities(title)
    .replace(/\s*-\s*Google Docs\s*$/i, '')
    .replace(/\s*-\s*Google Drive\s*$/i, '')
    .trim()
}

function stripExportExtension(name: string): string {
  return name.replace(/\.html?$/i, '').trim()
}

export function extractTitleFromContentDisposition(
  header: string | undefined | null
): string | null {
  if (!header) return null

  const rfc5987 = header.match(/filename\*\s*=\s*(?:UTF-8|utf-8)''([^;\s]+)/i)
  if (rfc5987) {
    try {
      const title = stripExportExtension(decodeURIComponent(rfc5987[1]))
      if (isUsableDocTitle(title)) return title
    } catch {
      // Fall through to the ASCII filename= parameter
    }
  }

  const quoted = header.match(/filename\s*=\s*"([^"]+)"/i)
  if (quoted) {
    const title = stripExportExtension(quoted[1])
    if (isUsableDocTitle(title)) return title
  }

  const unquoted = header.match(/filename\s*=\s*([^;]+)/i)
  if (unquoted) {
    const title = stripExportExtension(unquoted[1].trim().replace(/^["']|["']$/g, ''))
    if (isUsableDocTitle(title)) return title
  }

  return null
}

function matchMetaContent(html: string, attrName: string, attrValue: string): string | null {
  const attr = `${attrName}=["']${attrValue}["']`
  const contentFirst = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}[^>]*>`, 'i')
  )
  if (contentFirst) return contentFirst[1]

  const attrFirst = html.match(
    new RegExp(`<meta[^>]+${attr}[^>]+content=["']([^"']+)["'][^>]*>`, 'i')
  )
  return attrFirst?.[1] ?? null
}

export function extractDocTitleFromHtml(html: string | undefined | null): string | null {
  if (!html) return null

  const candidates = [
    matchMetaContent(html, 'property', 'og:title'),
    matchMetaContent(html, 'name', 'og:title'),
    matchMetaContent(html, 'itemprop', 'name'),
  ]

  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (titleTag) candidates.push(titleTag[1])

  for (const candidate of candidates) {
    if (!candidate) continue
    const title = cleanGoogleDocTitle(candidate)
    if (isUsableDocTitle(title)) return title
  }

  return null
}

export function resolveGoogleDocTitle(options: {
  contentDisposition?: string | null
  html?: string | null
  previewHtml?: string | null
}): string {
  const fromHeader = extractTitleFromContentDisposition(options.contentDisposition)
  if (fromHeader) return fromHeader

  const fromPreview = extractDocTitleFromHtml(options.previewHtml)
  if (fromPreview) return fromPreview

  const fromHtml = extractDocTitleFromHtml(options.html)
  if (fromHtml) return fromHtml

  return ''
}
