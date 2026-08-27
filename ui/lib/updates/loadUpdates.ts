/**
 * Server-only. Import from `getStaticProps` / scripts, never from a component.
 * `next.config.js` sets `resolve.fallback.fs = false` for the client bundle.
 */
import fs from 'fs'
import path from 'path'
import { isValidUpdateDate, parseUpdateFrontmatter } from './frontmatter'
import { readingMinutes } from './readingTime'
import type { Update, UpdateMeta } from './types'

export const UPDATES_ROOT = path.join(process.cwd(), 'content', 'updates')

type Corpus = {
  updates: Update[]
  bySlug: Map<string, Update>
}

let cached: Corpus | null = null
let cachedRoot: string | null = null

export function resetUpdatesCache(): void {
  cached = null
  cachedRoot = null
}

export function slugFromFilename(fileName: string): string {
  const base = fileName.replace(/\.md$/i, '')
  const dated = base.match(/^\d{4}-\d{2}-\d{2}-(.+)$/)
  return dated ? dated[1] : base
}

function isPublishedBuild(): boolean {
  // Vercel sets this automatically. NODE_ENV is "production" on preview
  // builds too, and NEXT_PUBLIC_CHAIN reports mainnet even locally (see
  // const/flags.ts), so neither can decide whether to hide drafts.
  return process.env.VERCEL_ENV === 'production'
}

function includeDrafts(): boolean {
  return !isPublishedBuild()
}

function loadCorpus(root: string = UPDATES_ROOT): Corpus {
  if (cached && cachedRoot === root) return cached
  if (!fs.existsSync(root)) {
    const empty: Corpus = { updates: [], bySlug: new Map() }
    cached = empty
    cachedRoot = root
    return empty
  }

  const files = fs
    .readdirSync(root, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith('.md') &&
        !entry.name.startsWith('_') &&
        entry.name.toLowerCase() !== 'readme.md'
    )
    .map((entry) => entry.name)

  const updates: Update[] = []
  const bySlug = new Map<string, Update>()

  for (const fileName of files) {
    const raw = fs.readFileSync(path.join(root, fileName), 'utf8')
    const { frontmatter, body } = parseUpdateFrontmatter(raw)
    const slug = slugFromFilename(fileName)

    if (!frontmatter.title) {
      throw new Error(`Update ${fileName} is missing a title`)
    }
    if (!frontmatter.description) {
      throw new Error(`Update ${fileName} is missing a description`)
    }
    if (!isValidUpdateDate(frontmatter.date)) {
      throw new Error(`Update ${fileName} is missing a valid YYYY-MM-DD date`)
    }
    if (!frontmatter.author) {
      throw new Error(`Update ${fileName} is missing an author`)
    }
    if (bySlug.has(slug)) {
      throw new Error(`Duplicate update slug "${slug}" (from ${fileName})`)
    }

    const update: Update = {
      slug,
      filePath: fileName,
      title: frontmatter.title,
      description: frontmatter.description,
      date: frontmatter.date,
      author: frontmatter.author,
      // null, not undefined: these reach `getStaticProps`, which cannot
      // serialize undefined.
      authorRole: frontmatter.authorRole || null,
      image: frontmatter.image || null,
      category: frontmatter.category as string,
      tags: frontmatter.tags,
      featured: frontmatter.featured,
      draft: frontmatter.draft,
      readingMinutes: readingMinutes(body),
      body,
    }

    updates.push(update)
    bySlug.set(slug, update)
  }

  updates.sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)
  )

  const corpus = { updates, bySlug }
  cached = corpus
  cachedRoot = root
  return corpus
}

function visibleUpdates(root?: string): Update[] {
  const { updates } = loadCorpus(root)
  if (includeDrafts()) return updates
  return updates.filter((update) => !update.draft)
}

function toMeta(update: Update): UpdateMeta {
  const { body: _body, ...meta } = update
  return meta
}

export function listUpdates(root?: string): UpdateMeta[] {
  return visibleUpdates(root).map(toMeta)
}

export function getUpdate(slug: string, root?: string): Update | null {
  const update = loadCorpus(root).bySlug.get(slug)
  if (!update) return null
  if (update.draft && !includeDrafts()) return null
  return update
}

export function getAdjacentUpdates(
  slug: string,
  root?: string
): { prev?: UpdateMeta; next?: UpdateMeta } {
  const updates = visibleUpdates(root)
  const index = updates.findIndex((update) => update.slug === slug)
  if (index === -1) return {}
  return {
    // Newest-first: "next" is older (further down the list), "prev" is newer.
    prev: updates[index - 1] ? toMeta(updates[index - 1]) : undefined,
    next: updates[index + 1] ? toMeta(updates[index + 1]) : undefined,
  }
}

export function featuredUpdate(root?: string): UpdateMeta | undefined {
  const update = visibleUpdates(root).find((entry) => entry.featured)
  return update ? toMeta(update) : undefined
}

export function allUpdateStaticPaths(root?: string): { params: { slug: string } }[] {
  return visibleUpdates(root).map((update) => ({ params: { slug: update.slug } }))
}
