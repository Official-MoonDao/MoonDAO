import { parseFrontmatter } from '@/lib/docs/frontmatter'
import { DEFAULT_CATEGORY, type UpdateFrontmatter } from './types'

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

function optional(value: string | undefined): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/**
 * Widen the shared docs frontmatter parser with the update-only keys. Kept
 * local so `DocsFrontmatter` does not grow fields the docs pipeline never uses.
 */
export function parseUpdateFrontmatter(raw: string): {
  frontmatter: UpdateFrontmatter
  body: string
} {
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
      date: optional(extras.date),
      authorRole: optional(extras.authorRole),
      image: optional(extras.image),
      category: optional(extras.category) || DEFAULT_CATEGORY,
      featured: asBoolean(extras.featured),
      draft: asBoolean(extras.draft),
    },
    body,
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidUpdateDate(value: string | undefined): value is string {
  return !!value && DATE_RE.test(value)
}
