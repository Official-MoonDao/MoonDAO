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

/**
 * Characters that must not reach a route. Parentheses are path-to-regexp
 * metacharacters (so they can't appear in a `next.config.js` redirect source
 * without escaping), and non-ASCII bytes in an emitted filename are fragile
 * across the build/deploy/CDN chain. Two vault files were affected:
 * `Reference/Glossary (dynamic).md` and
 * `Reference/Nested Docs/MoonDAO’s Quarterly Rewards.md`.
 * See docs/DOCUMENTATION_EMBEDDING_VERIFICATION.md.
 */
const UNSAFE_SLUG_CHARS = /[^A-Za-z0-9._@\-/]/g

/** True when a slug is safe to emit as a route and a build-output filename. */
export function isRouteSafeSlug(slug: string): boolean {
  return !/[^A-Za-z0-9._@\-/]/.test(slug)
}

/**
 * Pre-Quartz `/docs/<short-name>` URLs.
 *
 * These used to be `next.config.js` redirects, but a redirect whose source sits
 * under `/docs/*` conflicts with the `/docs/[...slug]` dynamic route and fails
 * the Vercel deploy (the identical route under a prefix with no redirects
 * deploys fine). They are served as real pages instead, which is also better
 * than a 301 — `DocsPage` still points the canonical tag at the primary slug.
 * See docs/DOCUMENTATION_EMBEDDING_VERIFICATION.md.
 */
export const LEGACY_DOC_ALIASES: Record<string, string> = {
  introduction: 'index',
  'launch-path': 'index',
  token: 'Governance/Governance-Tokens',
  team: 'About/Team',
  contribute: 'Onboarding/Contribute',
  'project-guidelines': 'Projects/Project-System',
  'ticket-to-space-sweepstakes-rules':
    'Legal/Ticket-to-Space-NFT/Ticket-to-Space-Sweepstakes-Rules',
  'ticket-to-space-NFT-FAQs': 'Legal/Ticket-to-Space-NFT/Ticket-to-Space-Sweepstakes-Rules',
  'dispute-notice': 'Legal/Ticket-to-Space-NFT/Dispute-Notice',
  'nft-owner-agreement': 'Legal/Ticket-to-Space-NFT/Ticket-to-Space-NFT-Owner-Agreement',
  'sweepstakes-and-securities-disclaimer':
    'Legal/Ticket-to-Space-NFT/Sweepstakes-and-Securities-Disclaimer',
}

/**
 * The only two Quartz URLs deliberately not reproduced, because their slugs
 * contained route-unsafe characters. Nothing in the corpus or in Quartz's own
 * link graph pointed at either page.
 */
export const INTENTIONAL_SLUG_CHANGES: Record<string, string> = {
  'Reference/Glossary-(dynamic)': 'Reference/Glossary-dynamic',
  'Reference/Nested-Docs/MoonDAO’s-Quarterly-Rewards':
    'Reference/Nested-Docs/MoonDAOs-Quarterly-Rewards',
}

/**
 * Strip route-unsafe characters from a vault path, preserving spaces — including
 * the double space in `Ticket to Zero-G NFT  Sweepstakes Rules.md`, which is what
 * produces Quartz's `--` in that slug.
 */
export function sanitizeVaultPath(relPath: string): string {
  return relPath
    .split('/')
    .map((segment) => segment.replace(/[^A-Za-z0-9._@\- ]/g, '').trim())
    .join('/')
}

export function slugifySegment(segment: string): string {
  return segment.replace(/ /g, '-').replace(UNSAFE_SLUG_CHARS, '')
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

/**
 * Join catch-all route params into a corpus slug. The empty case only arises
 * defensively — `/docs` is served by `pages/docs/index.tsx`, not by the
 * catch-all.
 */
export function slugFromParams(slug: string[] | undefined): string {
  if (!slug || slug.length === 0) return 'index'
  return slug.join('/')
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
