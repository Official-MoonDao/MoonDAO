import { docsHref, isImageRef, slugifyHeading } from './slug'

export type NameResolver = {
  resolve(name: string): string | undefined
}

export type RewriteReport = {
  unresolvedWikilinks: string[]
  convertedWikilinks: number
  convertedMdLinks: number
  convertedImages: number
}

const WIKI_RE = /(!?)\[\[([^[\]]+)\]\]/g
const MD_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g
const MD_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g
const OBSIDIAN_COMMENT_RE = /%%[\s\S]*?%%/g
const DOCS_HOST_RE = /https?:\/\/docs\.moondao\.com\/?/gi

export function stripObsidianComments(body: string): string {
  return body.replace(OBSIDIAN_COMMENT_RE, '').trimStart()
}

export function rewriteDocsHostLinks(body: string): string {
  return body.replace(DOCS_HOST_RE, '/docs/')
}

function splitWikiInner(inner: string): { target: string; heading: string; label: string } {
  let rest = inner.trim()
  let label = ''
  const pipe = rest.indexOf('|')
  if (pipe !== -1) {
    label = rest.slice(pipe + 1).trim()
    rest = rest.slice(0, pipe).trim()
  }
  let heading = ''
  const hash = rest.indexOf('#')
  if (hash !== -1) {
    heading = rest.slice(hash + 1).trim()
    rest = rest.slice(0, hash).trim()
  }
  return { target: rest, heading, label }
}

function decodeMdUrl(url: string): string {
  try {
    return decodeURIComponent(url)
  } catch {
    return url
  }
}

function mediaHref(name: string): string {
  const file = name.split('/').pop() || name
  return `/docs-media/${file}`
}

export function rewriteWikilinks(
  body: string,
  resolver: NameResolver,
  report?: RewriteReport
): string {
  return body.replace(WIKI_RE, (full, bang: string, inner: string) => {
    const { target, heading, label } = splitWikiInner(inner)
    const display = label || target || heading

    if (bang === '!') {
      if (!target) return full
      if (target.startsWith('http://') || target.startsWith('https://')) {
        if (report) report.convertedImages += 1
        return `![](${target})`
      }
      if (isImageRef(target)) {
        if (report) report.convertedImages += 1
        return `![](${mediaHref(target)})`
      }
      // Keep note transclusions for load-time expansion.
      return full
    }

    if (!target && heading) {
      if (report) report.convertedWikilinks += 1
      return `[${display}](#${slugifyHeading(heading)})`
    }

    const slug = resolver.resolve(target)
    if (!slug) {
      if (report) report.unresolvedWikilinks.push(target || full)
      return display
    }
    if (report) report.convertedWikilinks += 1
    const href = heading ? `${docsHref(slug)}#${slugifyHeading(heading)}` : docsHref(slug)
    return `[${display}](${href})`
  })
}

export function rewriteMarkdownLinks(body: string, resolver: NameResolver, report?: RewriteReport): string {
  return body.replace(MD_LINK_RE, (full, text: string, url: string) => {
    if (full.startsWith('![')) return full
    const decoded = decodeMdUrl(url.trim())
    if (decoded.startsWith('http://') || decoded.startsWith('https://') || decoded.startsWith('/')) {
      return full
    }
    if (decoded.startsWith('#')) return full
    const file = decoded.replace(/^\.\//, '').split('#')[0]
    if (!file.toLowerCase().endsWith('.md')) return full
    const name = file.split('/').pop()!.replace(/\.md$/i, '')
    const slug = resolver.resolve(name)
    if (!slug) return full
    if (report) report.convertedMdLinks += 1
    const heading = decoded.includes('#') ? decoded.split('#')[1] : ''
    const href = heading ? `${docsHref(slug)}#${heading}` : docsHref(slug)
    return `[${text}](${href})`
  })
}

export function rewriteLocalImages(body: string, report?: RewriteReport): string {
  return body.replace(MD_IMAGE_RE, (full, alt: string, url: string) => {
    const trimmed = url.trim()
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
      return full
    }
    if (!isImageRef(trimmed)) return full
    if (report) report.convertedImages += 1
    return `![${alt}](${mediaHref(trimmed)})`
  })
}

const CALLOUT_RE = /^> ?\[!([A-Za-z-]+)\][^\n]*\n((?:>.*\n?)*)/gm

export function rewriteCallouts(body: string): string {
  return body.replace(CALLOUT_RE, (_full, kind: string, rest: string) => {
    const text = rest
      .split('\n')
      .map((line) => line.replace(/^>\s?/, ''))
      .join('\n')
      .trim()
    const label = kind.toLowerCase()
    return `<div class="docs-callout docs-callout-${label}">\n\n**${kind}:** ${text}\n\n</div>\n`
  })
}

export function emptyReport(): RewriteReport {
  return {
    unresolvedWikilinks: [],
    convertedWikilinks: 0,
    convertedMdLinks: 0,
    convertedImages: 0,
  }
}

export function rewriteDocBody(body: string, resolver: NameResolver, report?: RewriteReport): string {
  let next = stripObsidianComments(body)
  next = rewriteDocsHostLinks(next)
  next = rewriteCallouts(next)
  next = rewriteWikilinks(next, resolver, report)
  next = rewriteLocalImages(next, report)
  next = rewriteMarkdownLinks(next, resolver, report)
  return next
}
