import { parseFrontmatter } from '@/lib/docs/frontmatter'
import type { BlogFrontmatter } from './types'

function unquote(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function asBoolean(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true'
}

/**
 * Widen the shared docs frontmatter parser with the blog-only keys. Kept local
 * so `DocsFrontmatter` does not grow fields the docs pipeline never uses.
 */
export function parseBlogFrontmatter(raw: string): { frontmatter: BlogFrontmatter; body: string } {
  const { frontmatter: docsFm, body } = parseFrontmatter(raw)
  const extras: Record<string, string> = {}

  if (raw.startsWith('---')) {
    const end = raw.indexOf('\n---', 3)
    if (end !== -1) {
      for (const line of raw.slice(4, end).split('\n')) {
        const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
        if (!kv) continue
        extras[kv[1]] = kv[2] === '' ? '' : unquote(kv[2])
      }
    }
  }

  return {
    frontmatter: {
      title: docsFm.title,
      description: docsFm.description,
      author: docsFm.author,
      tags: docsFm.tags,
      date: typeof extras.date === 'string' && extras.date ? extras.date : undefined,
      authorRole:
        typeof extras.authorRole === 'string' && extras.authorRole ? extras.authorRole : undefined,
      image: typeof extras.image === 'string' && extras.image ? extras.image : undefined,
      featured: asBoolean(extras.featured),
      draft: asBoolean(extras.draft),
    },
    body,
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidPostDate(value: string | undefined): value is string {
  return !!value && DATE_RE.test(value)
}
