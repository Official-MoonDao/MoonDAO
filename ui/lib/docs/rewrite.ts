import { docsHref, isImageRef, slugifyHeading } from './slug'

export type NameResolver = {
  resolve(name: string): string | undefined
  /**
   * Resolve a partial path like `Ticket to Space NFT/Dispute Notice` to a full
   * slug, but only when the match is unambiguous. Needed because the vault has
   * two `Dispute Notice.md` files (Space and Zero-G) and legacy links reach them
   * by a path that omits the `Legal/` prefix.
   */
  resolvePath?(path: string): string | undefined
}

export type RewriteReport = {
  unresolvedWikilinks: string[]
  unresolvedMdLinks: string[]
  unresolvedDocsHostLinks: string[]
  convertedWikilinks: number
  convertedMdLinks: number
  convertedImages: number
}

const WIKI_RE = /(!?)\[\[([^[\]]+)\]\]/g
// Link targets can contain balanced parentheses — the vault has
// `[Team (dynamic)](Team%20(dynamic).md)` — so a plain `[^)]+` truncates the URL
// and leaves `.md)` behind as literal text. Allow one nested pair.
const MD_URL = '(?:[^()\\n]|\\([^()\\n]*\\))*'
const MD_LINK_RE = new RegExp(`\\[([^\\]]+)\\]\\((${MD_URL})\\)`, 'g')
const MD_IMAGE_RE = new RegExp(`!\\[([^\\]]*)\\]\\((${MD_URL})\\)`, 'g')
const OBSIDIAN_COMMENT_RE = /%%[\s\S]*?%%/g
// Both previous homes of these docs. Every `publish.obsidian.md` link in the
// vault is already a 404, and one `docs.moondao.com` link is too.
const LEGACY_HOST_RE =
  /https?:\/\/(?:docs\.moondao\.com|publish\.obsidian\.md\/moondao\/MoonDAO\/docs)(\/[A-Za-z0-9/+_.%-]*)?/gi

function stripObsidianComments(body: string): string {
  return body.replace(OBSIDIAN_COMMENT_RE, '').trimStart()
}

/**
 * Absolute links to either former docs host become local `/docs` routes.
 *
 * The path is resolved against the corpus rather than pasted through, because
 * many of these were already broken upstream: every `publish.obsidian.md` link
 * 404s, and the Constitution links to `docs.moondao.com/Constitution` (also a
 * 404) when it means `/docs/Governance/Constitution`.
 */
function rewriteLegacyHostLinks(
  body: string,
  resolver: NameResolver,
  report?: RewriteReport
): string {
  return body.replace(LEGACY_HOST_RE, (_full, rawPath?: string) => {
    // Obsidian Publish encodes spaces as `+`.
    const path = (rawPath || '').replace(/^\//, '').replace(/\+/g, ' ').replace(/\/+$/, '')
    if (!path) return '/docs'
    // Keep a trailing sentence period out of the slug.
    const trailing = path.endsWith('.') ? '.' : ''
    const cleaned = trailing ? path.slice(0, -1) : path
    const [pathOnly, hash] = cleaned.split('#')
    const suffix = (hash ? `#${hash}` : '') + trailing

    const byPath = resolver.resolvePath?.(pathOnly)
    if (byPath) return `${docsHref(byPath)}${suffix}`

    const direct = resolver.resolve(pathOnly)
    if (direct) return `${docsHref(direct)}${suffix}`

    const leaf = pathOnly.split('/').pop() || pathOnly
    const byLeaf = resolver.resolve(leaf.replace(/-/g, ' ')) || resolver.resolve(leaf)
    if (byLeaf) return `${docsHref(byLeaf)}${suffix}`

    if (report) report.unresolvedDocsHostLinks.push(pathOnly)
    return `/docs/${pathOnly.replace(/ /g, '-')}${suffix}`
  })
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
  // Vault links escape spaces inconsistently: `Governance%20Tokens.md`,
  // `Governance\ Tokens.md`, and `Governance\%20Tokens.md` all appear. Drop
  // the markdown backslash escapes, then percent-decode.
  const unescaped = url.replace(/\\(?=[ %])/g, '')
  try {
    return decodeURIComponent(unescaped)
  } catch {
    return unescaped
  }
}

function mediaHref(name: string): string {
  const file = name.split('/').pop() || name
  return `/docs-media/${file}`
}

function rewriteWikilinks(
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

function rewriteMarkdownLinks(body: string, resolver: NameResolver, report?: RewriteReport): string {
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
    if (!slug) {
      // Relative link to a note that isn't in the corpus (e.g. the vault's
      // dangling "MoonDAO Legal Entity as a Marshall Island DAO LLC.md").
      // Emitting the href would 404, so degrade to the label.
      if (report) report.unresolvedMdLinks.push(file)
      return text
    }
    if (report) report.convertedMdLinks += 1
    const heading = decoded.includes('#') ? decoded.split('#')[1] : ''
    const href = heading ? `${docsHref(slug)}#${heading}` : docsHref(slug)
    return `[${text}](${href})`
  })
}

function rewriteLocalImages(body: string, report?: RewriteReport): string {
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

function rewriteCallouts(body: string): string {
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
    unresolvedMdLinks: [],
    unresolvedDocsHostLinks: [],
    convertedWikilinks: 0,
    convertedMdLinks: 0,
    convertedImages: 0,
  }
}

/** A markdown table row — transclusions here must stay on one line. */
export function isTableRow(line: string): boolean {
  return line.trimStart().startsWith('|')
}

export function rewriteDocBody(body: string, resolver: NameResolver, report?: RewriteReport): string {
  let next = stripObsidianComments(body)
  next = rewriteLegacyHostLinks(next, resolver, report)
  next = rewriteCallouts(next)
  next = rewriteWikilinks(next, resolver, report)
  next = rewriteLocalImages(next, report)
  next = rewriteMarkdownLinks(next, resolver, report)
  return next
}
