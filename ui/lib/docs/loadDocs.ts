import fs from 'fs'
import path from 'path'
import { extractTitle, parseFrontmatter } from './frontmatter'
import { emptyReport, isTableRow, rewriteDocBody } from './rewrite'
import {
  docsHref,
  normalizeAliasSlug,
  noteNameFromFilePath,
  slugFromParams,
  slugifyFilePath,
  slugifyHeading,
} from './slug'
import type {
  DocsBacklink,
  DocsFile,
  DocsNavNode,
  DocsPageKind,
  DocsPageProps,
  DocsTocItem,
} from './types'

export const DEFAULT_DOCS_ROOT = path.join(process.cwd(), 'content', 'docs')

const DATAVIEW_MARKER = '<!-- docs-glossary-table -->'
const WIKI_TRANSCLUDE_RE = /!\[\[([^[\]]+)\]\]/g

type Corpus = {
  files: DocsFile[]
  bySlug: Map<string, DocsFile>
  /** note name / alias / title (lowercased) → slug */
  nameToSlug: Map<string, string>
  folderSlugs: string[]
  tagSlugs: string[]
  tree: DocsNavNode[]
}

let cached: Corpus | null = null
let cachedRoot: string | null = null

export function resetDocsCache(): void {
  cached = null
  cachedRoot = null
}

function walkMarkdown(dir: string, root: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkMarkdown(full, root, out)
    else if (
      entry.isFile() &&
      entry.name.endsWith('.md') &&
      path.relative(root, full).replace(/\\/g, '/') !== 'README.md'
    ) {
      out.push(path.relative(root, full).replace(/\\/g, '/'))
    }
  }
  return out
}

function rememberName(map: Map<string, string>, name: string, slug: string): void {
  const key = name.trim().toLowerCase()
  if (!key) return
  if (!map.has(key)) map.set(key, slug)
}

function buildNameMap(files: DocsFile[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const file of files) {
    rememberName(map, noteNameFromFilePath(file.filePath), file.slug)
    rememberName(map, file.frontmatter.title || '', file.slug)
    rememberName(map, file.frontmatter.sidebar_label || '', file.slug)
    rememberName(map, file.slug, file.slug)
    rememberName(map, file.slug.split('/').pop() || '', file.slug)
    for (const alias of file.frontmatter.aliases) {
      rememberName(map, alias, file.slug)
    }
    if (file.frontmatter.slug) {
      const extra = normalizeAliasSlug(file.frontmatter.slug)
      if (extra) rememberName(map, extra, file.slug)
    }
  }
  return map
}

function folderIndexSlugs(files: DocsFile[]): string[] {
  const folders = new Set<string>()
  for (const file of files) {
    const parts = file.filePath.replace(/\.md$/i, '').split('/')
    parts.pop()
    let acc = ''
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part
      folders.add(slugifyFilePath(acc) + '/index')
    }
  }
  return [...folders].sort()
}

function tagSlugs(files: DocsFile[]): string[] {
  const tags = new Set<string>()
  for (const file of files) {
    for (const tag of file.frontmatter.tags) {
      const parts = tag.toLowerCase().split('/').filter(Boolean)
      let acc = 'tags'
      tags.add(acc)
      for (const part of parts) {
        acc = `${acc}/${part}`
        tags.add(acc)
      }
    }
  }
  tags.add('tags/index')
  return [...tags].sort()
}

function labelForSlug(slug: string, files: DocsFile[]): string {
  const file = files.find((f) => f.slug === slug)
  if (file) {
    return file.frontmatter.sidebar_label || extractTitle(file.filePath, file.frontmatter, file.body)
  }
  const leaf = slug.replace(/\/index$/, '').split('/').pop() || slug
  return leaf.replace(/-/g, ' ')
}

function buildTree(files: DocsFile[]): DocsNavNode[] {
  type Mutable = DocsNavNode & { _map?: Map<string, Mutable> }
  const root: Mutable = {
    name: 'docs',
    label: 'Documentation',
    href: docsHref('index'),
    slug: 'index',
    position: 0,
    children: [],
    _map: new Map(),
  }

  const ensure = (parent: Mutable, name: string, slug: string, position: number, href: string, label: string) => {
    if (!parent._map) parent._map = new Map()
    let child = parent._map.get(name)
    if (!child) {
      child = { name, label, href, slug, position, children: [], _map: new Map() }
      parent._map.set(name, child)
      parent.children.push(child)
    }
    return child
  }

  for (const file of files) {
    const parts = file.slug.split('/')
    let node = root
    let acc = ''
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      acc = acc ? `${acc}/${part}` : part
      const isLeaf = i === parts.length - 1
      const position = isLeaf ? file.frontmatter.sidebar_position ?? 100 : 50
      const href = isLeaf ? docsHref(file.slug) : docsHref(`${acc}/index`)
      const label = isLeaf
        ? file.frontmatter.sidebar_label || extractTitle(file.filePath, file.frontmatter, file.body)
        : labelForSlug(`${acc}/index`, files)
      node = ensure(node, part, isLeaf ? file.slug : `${acc}/index`, position, href, label)
    }
  }

  const sortDeep = (node: Mutable) => {
    node.children.sort((a, b) => a.position - b.position || a.label.localeCompare(b.label))
    delete node._map
    node.children.forEach((child) => sortDeep(child as Mutable))
  }
  sortDeep(root)
  return root.children
}

export function loadCorpus(root: string = DEFAULT_DOCS_ROOT): Corpus {
  if (cached && cachedRoot === root) return cached
  const rels = walkMarkdown(root, root)
  const files: DocsFile[] = rels.map((rel) => {
    const raw = fs.readFileSync(path.join(root, rel), 'utf8')
    const { frontmatter, body } = parseFrontmatter(raw)
    return {
      filePath: rel,
      slug: slugifyFilePath(rel),
      frontmatter,
      body,
    }
  })
  const corpus: Corpus = {
    files,
    bySlug: new Map(files.map((f) => [f.slug, f])),
    nameToSlug: buildNameMap(files),
    folderSlugs: folderIndexSlugs(files),
    tagSlugs: tagSlugs(files),
    tree: buildTree(files),
  }
  cached = corpus
  cachedRoot = root
  return corpus
}

export function allProducedSlugs(root?: string): string[] {
  const corpus = loadCorpus(root)
  const slugs = new Set<string>()
  for (const file of corpus.files) slugs.add(file.slug)
  slugs.add('index')
  for (const folder of corpus.folderSlugs) slugs.add(folder)
  for (const tag of corpus.tagSlugs) slugs.add(tag)
  return [...slugs].sort()
}

export function allStaticPaths(root?: string): { params: { slug?: string[] } }[] {
  const corpus = loadCorpus(root)
  const paths: { params: { slug?: string[] } }[] = [{ params: { slug: [] } }, { params: { slug: ['index'] } }]
  const add = (slug: string) => {
    if (slug === 'index') return
    paths.push({ params: { slug: slug.split('/') } })
    if (slug.endsWith('/index')) {
      const folder = slug.slice(0, -'/index'.length)
      paths.push({ params: { slug: folder.split('/') } })
    }
  }
  for (const file of corpus.files) {
    add(file.slug)
    if (file.frontmatter.slug) {
      const extra = normalizeAliasSlug(file.frontmatter.slug)
      if (extra) add(extra)
    }
    for (const alias of file.frontmatter.aliases) {
      const extra = normalizeAliasSlug(alias)
      if (extra && !extra.includes(' ')) add(extra)
    }
  }
  for (const folder of corpus.folderSlugs) add(folder)
  for (const tag of corpus.tagSlugs) add(tag)
  return paths
}

function resolver(corpus: Corpus) {
  return {
    resolve(name: string): string | undefined {
      const trimmed = name.trim()
      if (!trimmed) return undefined
      return (
        corpus.nameToSlug.get(trimmed.toLowerCase()) ||
        corpus.bySlug.get(slugifyFilePath(trimmed + (trimmed.endsWith('.md') ? '' : '.md')))?.slug ||
        corpus.bySlug.get(slugifyFilePath(trimmed))?.slug
      )
    },
    resolvePath(path: string): string | undefined {
      const target = slugifyFilePath(path.trim())
      if (!target) return undefined
      if (corpus.bySlug.has(target)) return target
      const suffix = `/${target}`
      const matches = corpus.files.filter((f) => f.slug.endsWith(suffix))
      if (matches.length === 1) return matches[0].slug
      // A bare folder path (`Projects`) means that folder's index page.
      const folder = `${target}/index`
      if (corpus.folderSlugs.includes(folder)) return folder
      return undefined
    },
  }
}

function extractToc(body: string): DocsTocItem[] {
  const toc: DocsTocItem[] = []
  for (const match of body.matchAll(/^(#{1,3})\s+(.+)$/gm)) {
    const text = match[2].replace(/[*_`]/g, '').trim()
    toc.push({ depth: match[1].length, text, id: slugifyHeading(text) })
  }
  return toc
}

/**
 * Inline `![[Note]]` transclusions.
 *
 * Inside a markdown table row an inlined multi-paragraph body would break the
 * table, so there we emit a link instead. Quartz sidesteps this by deferring
 * transclusion to client-side JS (the server HTML just says "Transclude of x");
 * a link degrades better and needs no JS. Outside tables we inline the body,
 * which is what Obsidian shows.
 */
function expandTransclusions(body: string, corpus: Corpus, stack: Set<string>): string {
  const res = resolver(corpus)
  return body
    .split('\n')
    .map((line) => {
      const inTable = isTableRow(line)
      return line.replace(WIKI_TRANSCLUDE_RE, (full, inner: string) => {
        const target = String(inner).split('|')[0].split('#')[0].trim()
        if (!target) return full
        const slug = res.resolve(target)
        if (!slug) return target
        const file = corpus.bySlug.get(slug)
        if (!file) return target
        const title = extractTitle(file.filePath, file.frontmatter, file.body)
        if (inTable) return `[${title}](${docsHref(slug)})`
        if (stack.has(slug)) return `[${title}](${docsHref(slug)})`
        stack.add(slug)
        const rewritten = rewriteDocBody(file.body, res)
        const expanded = expandTransclusions(rewritten, corpus, stack)
        stack.delete(slug)
        return expanded.trim()
      })
    })
    .join('\n')
}

function buildGlossaryTable(corpus: Corpus): string {
  const rows = corpus.files
    .filter((f) => f.filePath.startsWith('About/Glossary/') && f.filePath !== 'About/Glossary.md')
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((f) => {
      const title = extractTitle(f.filePath, f.frontmatter, f.body)
      const def = stripToPlain(f.body).split('\n').filter(Boolean)[0] || ''
      return `| [${title}](${docsHref(f.slug)}) | ${def.replace(/\|/g, '\\|')} |`
    })
  return ['| Term | Definition |', '| --- | --- |', ...rows].join('\n')
}

function stripToPlain(body: string): string {
  return rewriteDocBody(body, { resolve: () => undefined })
    .replace(/<[^>]+>/g, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#+\s+/gm, '')
    .trim()
}

function folderBody(slug: string, corpus: Corpus): string {
  const folder = slug.replace(/\/index$/, '')
  const prefix = folder + '/'
  const children = corpus.files
    .filter((f) => f.slug.startsWith(prefix) && !f.slug.slice(prefix.length).includes('/'))
    .sort((a, b) => (a.frontmatter.sidebar_position ?? 100) - (b.frontmatter.sidebar_position ?? 100))
  const nestedFolders = [...new Set(
    corpus.folderSlugs
      .map((s) => s.replace(/\/index$/, ''))
      .filter((s) => s.startsWith(prefix) && !s.slice(prefix.length).includes('/'))
  )]
  const lines = [`# ${labelForSlug(slug, corpus.files)}`, '']
  for (const child of children) {
    const title = extractTitle(child.filePath, child.frontmatter, child.body)
    lines.push(`- [${title}](${docsHref(child.slug)})`)
  }
  for (const nested of nestedFolders) {
    lines.push(`- [${labelForSlug(nested + '/index', corpus.files)}](${docsHref(nested + '/index')})`)
  }
  return lines.join('\n')
}

function tagBody(slug: string, corpus: Corpus): string {
  const tag = slug === 'tags' || slug === 'tags/index' ? '' : slug.slice('tags/'.length)
  const title = tag || 'Tags'
  if (!tag) {
    const top = corpus.tagSlugs.filter((s) => s.startsWith('tags/') && s !== 'tags/index' && !s.slice(5).includes('/'))
    return [`# Tag Index`, '', ...top.map((s) => `- [\`${s.slice(5)}\`](${docsHref(s)})`)].join('\n')
  }
  const pages = corpus.files.filter((f) =>
    f.frontmatter.tags.some((t) => {
      const lower = t.toLowerCase()
      return lower === tag || lower.startsWith(tag + '/')
    })
  )
  const lines = [`# ${title}`, '']
  for (const page of pages) {
    lines.push(`- [${extractTitle(page.filePath, page.frontmatter, page.body)}](${docsHref(page.slug)})`)
  }
  return lines.join('\n')
}

function breadcrumbsFor(slug: string, corpus: Corpus): { title: string; href: string }[] {
  const crumbs = [{ title: 'Docs', href: docsHref('index') }]
  if (slug === 'index') return crumbs
  const parts = slug.replace(/\/index$/, '').split('/')
  let acc = ''
  for (let i = 0; i < parts.length; i++) {
    acc = acc ? `${acc}/${parts[i]}` : parts[i]
    const isLast = i === parts.length - 1
    const href = isLast && corpus.bySlug.has(acc) ? docsHref(acc) : docsHref(`${acc}/index`)
    crumbs.push({ title: labelForSlug(isLast && corpus.bySlug.has(acc) ? acc : `${acc}/index`, corpus.files), href })
  }
  return crumbs
}

function backlinksFor(slug: string, corpus: Corpus): DocsBacklink[] {
  const href = docsHref(slug)
  const out: DocsBacklink[] = []
  for (const file of corpus.files) {
    if (file.slug === slug) continue
    const rewritten = rewriteDocBody(file.body, resolver(corpus))
    if (rewritten.includes(href) || rewritten.includes(`](${slug})`)) {
      out.push({
        title: extractTitle(file.filePath, file.frontmatter, file.body),
        href: docsHref(file.slug),
        slug: file.slug,
      })
    }
  }
  return out
}

function resolveRequestedSlug(requested: string, corpus: Corpus): { kind: DocsPageKind; slug: string } | null {
  const normalized = requested.replace(/\/+$/, '') || 'index'
  if (corpus.bySlug.has(normalized)) return { kind: 'doc', slug: normalized }
  if (normalized === 'index') return { kind: 'doc', slug: 'index' }

  for (const file of corpus.files) {
    if (file.frontmatter.slug && normalizeAliasSlug(file.frontmatter.slug) === normalized) {
      return { kind: 'doc', slug: file.slug }
    }
    if (file.frontmatter.aliases.some((a) => normalizeAliasSlug(a) === normalized)) {
      return { kind: 'doc', slug: file.slug }
    }
  }

  const asFolder = normalized.endsWith('/index') ? normalized : `${normalized}/index`
  if (corpus.folderSlugs.includes(asFolder)) return { kind: 'folder', slug: asFolder }
  if (corpus.tagSlugs.includes(normalized)) return { kind: 'tag', slug: normalized }
  if (normalized === 'tags') return { kind: 'tag', slug: 'tags/index' }
  return null
}

export function getDocPage(requestedSlug: string, root?: string): DocsPageProps | null {
  const corpus = loadCorpus(root)
  const resolved = resolveRequestedSlug(requestedSlug, corpus)
  if (!resolved) return null

  let body = ''
  let title = ''
  let description = ''
  let keywords: string[] = []
  let tags: string[] = []
  let file: DocsFile | undefined

  if (resolved.kind === 'doc') {
    file = corpus.bySlug.get(resolved.slug)
    if (!file) return null
    title = extractTitle(file.filePath, file.frontmatter, file.body)
    description = file.frontmatter.description || ''
    keywords = file.frontmatter.keywords
    tags = file.frontmatter.tags
    body = file.body.replace(/```dataview[\s\S]*?```/g, DATAVIEW_MARKER)
    if (body.includes(DATAVIEW_MARKER)) {
      body = body.replace(DATAVIEW_MARKER, buildGlossaryTable(corpus))
    }
    body = rewriteDocBody(body, resolver(corpus))
    body = expandTransclusions(body, corpus, new Set([resolved.slug]))
  } else if (resolved.kind === 'folder') {
    title = labelForSlug(resolved.slug, corpus.files)
    description = `Pages in ${title}`
    body = folderBody(resolved.slug, corpus)
  } else {
    title = resolved.slug === 'tags/index' ? 'Tag Index' : resolved.slug.slice('tags/'.length)
    description = `Documentation tagged ${title}`
    body = tagBody(resolved.slug, corpus)
  }

  return {
    kind: resolved.kind,
    slug: resolved.slug,
    title,
    description,
    keywords,
    tags,
    body,
    breadcrumbs: breadcrumbsFor(resolved.slug, corpus),
    toc: extractToc(body),
    backlinks: resolved.kind === 'doc' ? backlinksFor(resolved.slug, corpus) : [],
    tree: corpus.tree,
  }
}

export async function getDocStaticProps(requestedSlug: string, root?: string) {
  const page = getDocPage(requestedSlug, root)
  if (!page) return { notFound: true as const }
  return { props: { page } }
}

export async function getDocStaticPropsFromParams(params: { slug?: string[] }, root?: string) {
  return getDocStaticProps(slugFromParams(params.slug), root)
}

export function listUnresolvedWikilinks(root?: string): { filePath: string; target: string }[] {
  const corpus = loadCorpus(root)
  const res = resolver(corpus)
  const unresolved: { filePath: string; target: string }[] = []
  const wiki = /\[\[([^[\]]+)\]\]/g
  for (const file of corpus.files) {
    for (const match of file.body.matchAll(wiki)) {
      const inner = match[1]
      if (inner.startsWith('http')) continue
      const target = inner.split('|')[0].split('#')[0].trim()
      if (!target) continue
      if (target.match(/\.(png|jpe?g|gif|svg|webp)$/i)) continue
      if (!res.resolve(target)) unresolved.push({ filePath: file.filePath, target })
    }
  }
  return unresolved
}

/**
 * Relative `foo.md` links whose target isn't in the corpus. These render as
 * plain text rather than a dead href, so they're a content smell, not a 404.
 */
export function listUnresolvedMdLinks(root?: string): { filePath: string; target: string }[] {
  const corpus = loadCorpus(root)
  const res = resolver(corpus)
  const unresolved: { filePath: string; target: string }[] = []
  for (const file of corpus.files) {
    const report = emptyReport()
    rewriteDocBody(file.body, res, report)
    for (const target of report.unresolvedMdLinks) {
      unresolved.push({ filePath: file.filePath, target })
    }
  }
  return unresolved
}

/** Internal `/docs/...` hrefs that don't correspond to a real page. */
export function listBrokenDocsHrefs(root?: string): { filePath: string; href: string }[] {
  const corpus = loadCorpus(root)
  const valid = new Set(allProducedSlugs(root))
  const broken: { filePath: string; href: string }[] = []
  for (const file of corpus.files) {
    const rewritten = rewriteDocBody(file.body, resolver(corpus))
    for (const match of rewritten.matchAll(/\]\((\/docs(?:\/[^)#\s]*)?)(?:#[^)\s]*)?\)/g)) {
      const href = match[1]
      const slug = href === '/docs' ? 'index' : href.slice('/docs/'.length)
      if (!valid.has(slug) && !valid.has(`${slug}/index`)) {
        broken.push({ filePath: file.filePath, href })
      }
    }
  }
  return broken
}

export function getAliasTable(root?: string): { slug: string; aliases: string[] }[] {
  const corpus = loadCorpus(root)
  return corpus.files
    .map((f) => {
      const aliases = [
        ...f.frontmatter.aliases,
        ...(f.frontmatter.slug ? [normalizeAliasSlug(f.frontmatter.slug)] : []),
      ].filter(Boolean)
      return { slug: f.slug, aliases }
    })
    .filter((row) => row.aliases.length > 0)
}
