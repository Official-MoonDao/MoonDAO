import type { DocsFrontmatter } from './types'

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

function asStringList(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value.map((item) => String(item))
    : typeof value === 'string' && value.trim()
      ? [value]
      : []
  return raw
    .flatMap((item) => item.replace(/^\[/, '').replace(/\]$/, '').split(','))
    .map((item) => item.trim())
    .filter(Boolean)
}

/**
 * Minimal YAML-frontmatter parser covering the keys actually used in the
 * MoonDAO vault (string scalars, numeric scalars, and dash-lists). Not a
 * general YAML implementation — see DOCUMENTATION_EMBEDDING_VERIFICATION.md.
 */
export function parseFrontmatter(raw: string): { frontmatter: DocsFrontmatter; body: string } {
  const empty: DocsFrontmatter = {
    tags: [],
    keywords: [],
    aliases: [],
  }
  if (!raw.startsWith('---')) {
    return { frontmatter: empty, body: raw }
  }
  const end = raw.indexOf('\n---', 3)
  if (end === -1) {
    return { frontmatter: empty, body: raw }
  }
  const yaml = raw.slice(4, end)
  const body = raw.slice(end + 4).replace(/^\n/, '')
  const data: Record<string, unknown> = {}
  let currentKey: string | null = null

  for (const line of yaml.split('\n')) {
    const listItem = line.match(/^\s+-\s+(.*)$/)
    if (listItem && currentKey) {
      const existing = data[currentKey]
      const next = unquote(listItem[1])
      if (Array.isArray(existing)) {
        existing.push(next)
      } else if (existing === undefined || existing === '') {
        data[currentKey] = [next]
      } else {
        data[currentKey] = [String(existing), next]
      }
      continue
    }
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!kv) continue
    currentKey = kv[1]
    data[currentKey] = kv[2] === '' ? [] : unquote(kv[2])
  }

  const positionRaw = data.sidebar_position
  const sidebar_position =
    positionRaw !== undefined && positionRaw !== '' && !Array.isArray(positionRaw)
      ? Number(positionRaw)
      : undefined

  return {
    frontmatter: {
      title: typeof data.title === 'string' ? data.title : undefined,
      description: typeof data.description === 'string' ? data.description : undefined,
      tags: asStringList(data.tags),
      keywords: asStringList(data.keywords),
      aliases: asStringList(data.aliases),
      slug: typeof data.slug === 'string' ? data.slug : undefined,
      sidebar_label: typeof data.sidebar_label === 'string' ? data.sidebar_label : undefined,
      sidebar_position: Number.isFinite(sidebar_position) ? sidebar_position : undefined,
      id: typeof data.id === 'string' ? data.id : undefined,
      author: typeof data.author === 'string' ? data.author : undefined,
    },
    body,
  }
}

export function extractTitle(filePath: string, frontmatter: DocsFrontmatter, body: string): string {
  if (frontmatter.title) return frontmatter.title
  const heading = body.match(/^#\s+(.+)$/m)
  if (heading) return heading[1].replace(/\*+/g, '').trim()
  const base = filePath.split('/').pop() || filePath
  return base.replace(/\.md$/i, '')
}
