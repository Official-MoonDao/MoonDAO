/**
 * Quartz-compatible slug helpers.
 *
 * Observed against Official-MoonDao/documentation @ ff058cf (and the live
 * `https://docs.moondao.com/static/contentIndex.json`): Quartz replaces each
 * individual space in a path segment with `-` (a double space becomes `--`)
 * and strips the `.md` suffix. It keeps `@`, apostrophes, parentheses, dots,
 * and underscores. See the Zero-G sweepstakes rules file.
 *
 * Verify any change against `lib/docs/fixtures/contentIndex.json` via
 * `yarn docs:check` / the mocha docs-pipeline tests.
 */

export const DOCS_HREF_PREFIX = '/docs'

export function slugifySegment(segment: string): string {
  return segment.replace(/ /g, '-')
}

/** `About/FAQ.md` → `About/FAQ`; `index.md` → `index`. */
export function slugifyFilePath(filePath: string): string {
  const trimmed = filePath.replace(/\\/g, '/').replace(/^\.\//, '')
  const withoutExt = trimmed.replace(/\.md$/i, '')
  return withoutExt.split('/').filter(Boolean).map(slugifySegment).join('/')
}

/** Frontmatter `slug: /website-terms-and-conditions` → `website-terms-and-conditions`. */
export function normalizeAliasSlug(raw: string): string {
  return raw
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
}

export function docsHref(slug: string): string {
  if (!slug || slug === 'index') return DOCS_HREF_PREFIX
  return `${DOCS_HREF_PREFIX}/${slug}`
}

/** Join Next.js `[[...slug]]` params into a corpus slug. */
export function slugFromParams(slug: string[] | undefined): string {
  if (!slug || slug.length === 0) return 'index'
  return slug.join('/')
}

export function paramsFromSlug(slug: string): { slug?: string[] } {
  if (!slug || slug === 'index') return { slug: [] }
  return { slug: slug.split('/') }
}

/**
 * Heading id compatible enough with `rehype-slug` / github-slugger for TOC
 * hrefs. Not a full github-slugger port (no uniqueness suffix).
 */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
}

export function isImageRef(name: string): boolean {
  return /\.(png|jpe?g|gif|svg|webp|avif)$/i.test(name)
}

export function noteNameFromFilePath(filePath: string): string {
  const base = filePath.replace(/\\/g, '/').split('/').pop() || filePath
  return base.replace(/\.md$/i, '')
}
