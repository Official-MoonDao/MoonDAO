# Updates Plan — markdown-in-repo, `/updates`

A long-form updates section that lives alongside `/press`. Publishing is "commit a
markdown file and merge"; reading is a single-column editorial page with a real OG
preview on every post.

> **Status: implemented.** Shipped at `/updates` rather than `/blog`, so one feed
> can carry announcements, press releases, and long-form essays. A free-text
> `category` field labels each item, and nothing branches on it. `/blog` and
> `/blog/<slug>` permanently redirect to the new paths.
>
> Two review notes were folded in after the first pass. Hero images are now
> letterboxed to the 1200×630 social ratio instead of being centre-cropped, and
> the index and post pages share one `UpdatesPanel` component so their widths
> match, with the reading measure widened from 68ch to 85ch to cut scrolling.

## Why not the old self-hosted blog

The previous self-hosted blog was abandoned because it was a system to operate:
a database, an admin UI, accounts, upgrades. Everything below is static — markdown
files in `ui/content/updates/`, prerendered at build time by the Next.js build that
already runs on every merge. There is no runtime, no database, and no admin.

The repo already proved this shape works: `content/docs/` holds ~200 markdown files
rendered through `lib/docs/loadDocs.ts` and `components/docs/DocMarkdown.tsx`. The
blog is the same idea with a much smaller feature set and a reading-first layout.

## Goals

- Publish by committing a `.md` file. No CMS, no database, no admin UI.
- Every post has a stable, shareable URL (`/updates/<slug>`) with a correct Open Graph
  and Twitter card preview.
- A reading experience good enough that people finish a 2,000-word essay.
- Discoverable from the same places `/press` is: main nav, footer, and a cross-link
  on the press page itself.
- Zero new dependencies.

## Non-goals

- Comments, reactions, or accounts.
- Draft previews for non-technical authors. Authoring means opening a PR; the PR
  preview deploy *is* the draft preview.
- Replacing the ConvertKit newsletter at `/news`, or the curated announcement list on
  `/press`. See "How this relates to /news and /press" below.
- Multi-language posts. The app has `i18n` configured but the blog ships English-only.
- Tag/category archive pages in the first version. Tags render as labels only.

## Design reference: how VC and space companies do this

Looking at a16z, USV, Sequoia, Stripe's blog, and the space-company update pages
(SpaceX Updates, Varda, Stoke Space, Anduril, Hadrian), the pattern is remarkably
consistent, and it is consistent precisely because it is *restrained*:

**Index page.** Reverse-chronological. One optional featured post at the top with a
larger treatment, then a simple list. The list rows are text-forward — title, a
one-or-two-line dek, date, author — not image-heavy cards. USV and a16z's essay
listings are close to pure typography. Nobody paginates until they have to; they
show everything or the most recent 20-30.

**Post page.** A single column, roughly 640-720px of measure (about 70 characters),
centered, with no sidebar competing for attention. Large display headline, a dek in a
lighter weight beneath it, then a thin byline row: author, date, reading time.
Optional full-bleed hero image above or below the headline. Body text noticeably
larger than UI text (18-19px) with line-height around 1.6-1.7. Pull quotes and
sub-headings break up the scroll; bullet lists are used sparingly because these are
essays, not documentation.

**Post footer.** Previous/next post, and a subscribe call-to-action. Space companies
almost always end an update with "follow the mission" rather than "read more."

**Social previews.** Every post has its own OG image. The best ones are branded
templates with the post title typeset on them, so a link dropped in Discord or on X
looks intentional rather than like a generic site-wide card.

The takeaway for MoonDAO: the blog should feel like a different mode from the rest of
the app. The app is dense, gradient-heavy, dark-glass UI. The blog should be quiet —
one column, lots of air, typography doing the work, and the MoonDAO space aesthetic
present only in the frame (background, header, footer) rather than inside the article
body.

## Content model

Posts live in a new flat directory. Flat, not nested — nesting is what makes the docs
slug logic in `lib/docs/slug.ts` complicated, and a blog does not need it.

```
ui/content/updates/
  2026-08-14-why-a-decentralized-space-program.md
  2026-09-02-what-we-learned-from-frank.md
```

The date prefix in the filename is for humans scanning the directory and for a
natural sort; it is stripped from the slug. `2026-08-14-why-a-decentralized-space-program.md`
serves at `/updates/why-a-decentralized-space-program`.

Frontmatter:

```yaml
---
title: Why a Decentralized Space Program
description: The case for funding spaceflight from the bottom up, and what the
  first four missions taught us about doing it.
date: 2026-08-14
author: Ryan Nguyen
authorRole: Core Contributor
image: /assets/updates/decentralized-space-program.jpg
tags:
  - governance
  - missions
featured: true
draft: false
---

Body starts here. Standard markdown, GFM tables, images.
```

Field rules:

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Build fails without it. Also the `og:title`. |
| `description` | yes | The dek on the index and post page, and the `og:description`. Keep under 160 characters or `Head.tsx` truncates it. |
| `date` | yes | `YYYY-MM-DD`. Sort key and the `article:published_time`. |
| `author` | yes | Free text. Not tied to a Citizen NFT in v1. |
| `authorRole` | no | Shown next to the author in the byline. |
| `image` | no | Post hero and OG image. Falls back to the site default. |
| `tags` | no | Rendered as labels. No archive pages in v1. |
| `featured` | no | At most one; the newest one wins if several are set. |
| `draft` | no | `true` excludes the post from the index, the sitemap, and RSS, and returns 404 in production while remaining visible on preview deploys. |

Reading time is computed from the body, not authored.

## Routes

```
pages/updates/index.tsx     →  /updates       index, getStaticProps
pages/updates/[slug].tsx    →  /updates/<slug>  post, getStaticPaths + getStaticProps
```

**On the Vercel deploy risk.** `next.config.js` carries a long warning that a dynamic
route under `/docs/*` broke the Vercel deploy, which is why the docs catch-all lives
at `/documentation/[...slug].tsx` and is surfaced through a rewrite. That problem was
specific to a **catch-all** (`[...slug]`) route. Single-segment dynamic routes with
`getStaticPaths` already deploy fine in this app — `pages/jobs/[id].tsx` and
`pages/marketplace/[id].tsx` both do exactly that. So `pages/updates/[slug].tsx` needs
no rewrite indirection.

Two consequences worth respecting anyway:

- Use `[slug].tsx`, not `[[...slug]].tsx`. The optional catch-all form is what
  interacts badly with this app's `i18n` config.
- Do not add a `redirects()` entry whose `source` sits under `/updates/*`. Per the same
  comment in `next.config.js`, a redirect overlapping a dynamic route's prefix has
  failed this deploy before. Handle any legacy URL aliasing inside `getStaticPaths`
  instead, the way `LEGACY_DOC_ALIASES` does for docs.

  The shipped `/blog` → `/updates` redirects are safe under that rule precisely
  because no route lives under `/blog` any more: nothing overlaps. If the section
  is ever renamed again, move the pages first and only then redirect the old
  prefix.

`fallback: false` — all posts are known at build time, and an unknown slug should be
a real 404.

## Implementation

### `lib/updates/`

Four small files. This deliberately does not reuse `lib/docs/loadDocs.ts`: that module
carries wikilinks, transclusions, backlinks, tag trees, folder indexes, and a
Quartz-compat alias table, none of which a blog wants. It *does* reuse the
frontmatter parser.

**`lib/updates/types.ts`**

```ts
export type UpdateMeta = {
  slug: string
  title: string
  description: string
  date: string
  author: string
  authorRole?: string
  image?: string
  tags: string[]
  featured: boolean
  draft: boolean
  readingMinutes: number
}

export type Update = UpdateMeta & { body: string }
```

**`lib/updates/frontmatter.ts`** — thin wrapper over `parseFrontmatter` from
`lib/docs/frontmatter.ts`, which already handles string scalars and dash-lists, plus
the blog-only keys (`date`, `author`, `authorRole`, `image`, `featured`, `draft`).
Extending the shared parser's `DocsFrontmatter` type instead would leak blog fields
into the docs pipeline, so keep the widening local to the blog.

**`lib/updates/loadUpdates.ts`** — server-only; `fs` is aliased away in the client bundle
by the `webpack` config, so this must only ever be imported from `getStaticProps`.

```ts
export const BLOG_ROOT = path.join(process.cwd(), 'content', 'blog')

listPosts(): UpdateMeta[]          // newest first, drafts filtered per environment
getPost(slug: string): Update | null
getAdjacentPosts(slug): { prev?: UpdateMeta; next?: UpdateMeta }
allUpdateStaticPaths(): { params: { slug: string } }[]
```

Module-level cache keyed on the root, mirroring `loadCorpus`, so a build reads each
file once rather than once per page.

Fail loudly on malformed content: a missing `title`, a missing or unparseable `date`,
or two files resolving to the same slug should throw during `getStaticProps` and fail
the build. A silently-broken post is worse than a red build.

Drafts work by exclusion at build time rather than at request time. `listPosts()` and
`allUpdateStaticPaths()` drop `draft: true` posts when building for production and keep
them otherwise, so a draft is never prerendered on production and `fallback: false`
turns it into a genuine 404. Preview deploys prerender it normally.

Choosing the discriminator takes a moment of care, because the two obvious candidates
are both wrong here:

- `NODE_ENV` is `production` for preview builds too, so it cannot separate them.
- `NEXT_PUBLIC_CHAIN` cannot either. `const/flags.ts` explains why: developers pull
  their local env straight from production with `vercel env pull`, so locally it
  reports `mainnet`. Keying on it would hide drafts on the author's own machine,
  which defeats the point.
- The host check in `const/flags.ts` is a *runtime* test against `window.location.host`
  or the request's `Host` header. Neither exists inside `getStaticProps`.

Use `process.env.VERCEL_ENV === 'production'`. Vercel sets it automatically to
`production`, `preview`, or `development`, it is available at build time, and it is
the one signal that distinguishes the production deploy from a preview. It is not used
anywhere in this repo yet, so treat it as a new convention and comment it. Local
`next dev` leaves it undefined, which correctly means "show drafts."

**`lib/updates/readingTime.ts`** — word count / 220, minimum 1.

### `components/updates/`

- **`UpdateFeaturedCard.tsx`** — the top-of-index treatment: hero image, oversized
  title, dek, byline.
- **`UpdateCard.tsx`** — one index row. Title, dek, date, author, reading time,
  small thumbnail only if `image` is set. Text-forward.
- **`UpdateHeader.tsx`** — title, dek, byline row, optional hero.
- **`UpdateMarkdown.tsx`** — the article body renderer.
- **`UpdateFooter.tsx`** — tags, previous/next, and a subscribe CTA reusing the
  existing `NoticeFooter`.

**Why `UpdateMarkdown` rather than reusing `DocMarkdown`.** Same plugin stack
(`remarkGfm`, `rehypeSlug`, `rehypeAutolinkHeadings`, `rehypeRaw` — all already
installed), different type scale. `DocMarkdown` is tuned for documentation: 16px
body, `font-GoodTimes` on every heading down to `h4`, bordered tables, heading
anchors. For essays we want:

- Body at `text-[19px] leading-[1.7]` with `max-w-[68ch]`.
- `font-GoodTimes` on `h1`/`h2` only; `h3`/`h4` in the body sans at a heavier weight,
  because GoodTimes is a display face and gets shouty at small sizes.
- Blockquotes styled as real pull quotes — larger, no italic, a left rule in
  `light-cool`.
- First-paragraph lead treatment (slightly larger, lighter).
- Full-bleed images that break the measure, since a single 68ch column makes every
  inline image feel cramped.
- No heading autolink `#` affordance; that is a docs convention.

`@tailwindcss/typography` is already installed and can carry most of this via a
`prose prose-invert` base with overrides, which is less bespoke CSS than
`DocMarkdown`'s per-element component map. Note that `DocMarkdown` references a
`docs-prose` class that is not actually defined anywhere in `styles/globals.css` —
do not copy that pattern.

Sanitization: `rehypeRaw` allows raw HTML through, exactly as the docs pipeline does.
That is acceptable for the same reason — content arrives only via reviewed commits to
this repo, never from users. Worth stating explicitly in a comment so nobody later
wires user input into this renderer.

### `pages/updates/index.tsx`

`getStaticProps` calls `listPosts()`. Renders inside the existing `Container` /
`ContentLayout` shell so the page inherits the site frame, matching how `press.tsx`
is built. Featured post first if present, then the list. Empty state if there are no
posts yet.

### `pages/updates/[slug].tsx`

`getStaticPaths` from `allUpdateStaticPaths()`, `getStaticProps` from `getUpdate()` plus
`getAdjacentPosts()`, `notFound: true` for a missing slug.

Reading experience details that matter and are cheap:

- A scroll progress bar at the top of the viewport. This is the one piece of chrome
  worth adding; it measurably helps people commit to a long read.
- `scroll-mt` on headings so in-post anchor links do not land under the header.
- A "back to all posts" link above the title.
- Copy-link button next to the byline, using `react-hot-toast` for confirmation per
  the repo convention.

## OG previews

`components/layout/Head.tsx` already does the heavy lifting: `og:title`,
`og:description`, `og:image`, `twitter:card` as `summary_large_image`, canonical URL,
and `normalizeOgImageUrl` which turns a `/assets/...` path into an absolute URL
against `DEPLOYED_ORIGIN`. So the post page passes:

```tsx
<WebsiteHead
  title={post.title}
  description={post.description}
  image={post.image || '/assets/MoonDAO-OG.png'}
  keywords={post.tags.join(', ')}
  canonical={`${DEPLOYED_ORIGIN}/updates/${update.slug}`}
  ogType="article"
>
  <meta property="article:published_time" content={post.date} />
  <meta property="article:author" content={post.author} />
</WebsiteHead>
```

The `ogType` prop does not exist yet and needs adding. `WebsiteHead` currently
hardcodes `og:type` as `website` with `key="meta-ogweb"`; passing an override as a
child would emit *both* tags, because React's `Head` dedupes on the `key` prop and a
child `<meta>` would carry a different one. So add an optional `ogType` prop
defaulting to `'website'` — one small edit to a shared component, no behavior change
for existing callers. The `article:*` tags have no conflicting defaults and are fine
as children.

**Three caveats to handle:**

1. **The site-wide fallback OG image is currently a dead path.** `pages/press.tsx`,
   `info.tsx`, `governance.tsx`, and `projects-overview.tsx` all pass
   `/assets/moondao-og.jpg`, and that file does not exist in `ui/public/assets/`. The
   real asset is `MoonDAO-OG.png`. Those four pages are shipping a 404 as their social
   preview today. The blog should use `/assets/MoonDAO-OG.png`, and fixing the four
   existing references is a good standalone commit to land alongside this work — it is
   a one-line change per file that repairs previews on four live pages.
2. `DEPLOYED_ORIGIN` resolves to `NEXT_PUBLIC_STAGING_ORIGIN` when that variable is
   set, and to a `*.vercel.app` preview host when `NEXT_PUBLIC_CHAIN` is not
   `mainnet`. Absolute OG image URLs on production therefore depend on production
   having `NEXT_PUBLIC_CHAIN=mainnet` and no staging origin set. Verify this on the
   production deploy before announcing the blog — a wrong origin here means every
   shared link previews a staging image or nothing at all.
3. Hero images committed to `public/assets/updates/` must be sized for social: 1200×630,
   under ~300KB. Add a short note to the authoring guide; a 4MB screenshot will be
   silently dropped by some scrapers.

**Phase 2, optional: generated OG images.** `@vercel/og` would let every post get a
branded card with its title typeset on it, with no per-post design work. It is a new
dependency and an edge runtime route, and this app's `next.config.js` is already
doing delicate work around bundling and CSP — so it is deliberately out of the first
version. The `image` frontmatter field means adopting it later requires no content
migration: posts without `image` would fall through to the generated card.

## Discovery and how this relates to `/news` and `/press`

Three MoonDAO surfaces will publish words, and the distinction should be legible to a
visitor:

- **`/news`** — the ConvertKit newsletter, embedded in an iframe. Frequent, short,
  operational: weekly updates, governance notices.
- **`/press`** — for journalists. Announcements, coverage, press kit, spokespeople.
- **`/updates`** — first-person long-form: essays, ideas, mission retrospectives,
  technical write-ups. What we think, not what happened this week.

Wiring:

- `lib/navigation/useNavigation.tsx` — add `{ name: 'Updates', href: '/updates' }` to the
  `Learn` group, first in the list, above `News`.
- `components/layout/ExpandedFooter.tsx` — add `{ text: 'Updates', href: '/updates' }`
  alongside the existing `News` and `Press` entries.
- `pages/press.tsx` — a new `PressSection` titled "From the blog" showing the three
  most recent posts, placed after `press-releases`, with a "Read all posts" action
  link. This requires `press.tsx` to gain a `getStaticProps` that calls
  `listPosts().slice(0, 3)`; it currently has none. Add `'blog'` to that page's
  `sections` array so it appears in the in-page nav.
- The blog index links back to `/press` for media enquiries, so the two pages
  reference each other rather than competing.

## RSS and sitemap

**RSS.** Space and VC blogs are read through readers more than their own sites, and a
feed is ~30 lines. Generate `public/updates/rss.xml` from a script wired into the build,
rather than adding a route: it keeps the feed static and needs no new dependency.
Extend `scripts/docs-generate.ts`'s pattern, or add `scripts/updates-generate.ts` run
from `prebuild`. Link it with `<link rel="alternate" type="application/rss+xml">` on
the index page.

**Sitemap.** `next-sitemap` runs in `postbuild` and picks up prerendered pages
automatically, so `/updates` and each `/updates/<slug>` land in the sitemap with no config
change. Separately: `next-sitemap.config.js` currently has `siteUrl: 'moondao.com'`
with a "Replace with your site URL" placeholder comment and no scheme, which produces
malformed absolute URLs. Worth fixing to `https://moondao.com` while in the
neighborhood, but it is a pre-existing bug and should be its own commit.

## Authoring workflow

Document this in `ui/content/updates/README.md` so the next author does not need to read
any code:

1. Copy `ui/content/updates/_template.md` to `ui/content/updates/YYYY-MM-DD-my-post-title.md`.
2. Fill in the frontmatter. Write the body in markdown.
3. Drop any images in `ui/public/assets/updates/`. Hero images 1200×630.
4. Open a PR. The Vercel preview deploy renders the post exactly as it will ship —
   this is the draft preview.
5. Merge. The post is live on the next production deploy.

`_template.md` is prefixed with `_` and skipped by the loader, so it never publishes.

## Testing

Matching what the repo already does rather than inventing a new harness:

- **Unit, mocha** — `scripts/updates-pipeline.test.ts`, following
  `scripts/docs-pipeline.test.ts` and its `test:docs` script. Covers slug derivation
  from dated filenames, frontmatter parsing, draft filtering, sort order, reading-time
  math, adjacent-post edges (first and last post), and that duplicate slugs and
  missing required fields throw.
- **Component, Cypress** — `cypress/integration/updates/update-card.cy.tsx` and
  `update-markdown.cy.tsx`, following the existing `cypress/integration/**` component
  tests.
- **Manual** — one real post end to end on a preview deploy, with the resulting URL
  checked in a social card validator and pasted into Discord to confirm the unfurl.
- `yarn lint` clean. Note `next.config.js` sets `typescript.ignoreBuildErrors: true`,
  so a type error will not fail the build — run `tsc --noEmit` on the new files
  deliberately.

## Phasing

**Phase 1 — readable and shareable.** `lib/updates/*`, `components/updates/*`,
`pages/updates/index.tsx`, `pages/updates/[slug].tsx`, the `ogType` prop on `WebsiteHead`,
`content/updates/` with the template, README, and one real post. Nav and footer links.
This is the whole product: commit markdown, get a good-looking post at a stable URL
with a working OG preview.

**Phase 2 — connective tissue.** The "From the blog" section on `/press`, the RSS
feed, the `next-sitemap` `siteUrl` fix, and the `moondao-og.jpg` → `MoonDAO-OG.png`
repair on the four pages pointing at the missing file.

**Phase 3 — only if the blog gets used.** Generated OG images via `@vercel/og`. Tag
archive pages. Author pages linked to Citizen profiles. Pagination, once there are
enough posts to need it.

Phase 1 is worth shipping alone. Nothing in phases 2 or 3 requires content migration
or changes the authoring workflow.

## Files touched

New:

```
ui/content/updates/README.md
ui/content/updates/_template.md
ui/content/updates/<first-post>.md
ui/lib/updates/types.ts
ui/lib/updates/frontmatter.ts
ui/lib/updates/loadUpdates.ts
ui/lib/updates/readingTime.ts
ui/components/updates/UpdateFeaturedCard.tsx
ui/components/updates/UpdateCard.tsx
ui/components/updates/UpdateHeader.tsx
ui/components/updates/UpdateMarkdown.tsx
ui/components/updates/UpdateFooter.tsx
ui/pages/updates/index.tsx
ui/pages/updates/[slug].tsx
ui/scripts/updates-pipeline.test.ts
ui/public/assets/updates/            (hero images)
```

Modified:

```
ui/components/layout/Head.tsx              add optional `ogType` prop
ui/lib/navigation/useNavigation.tsx        add Updates to the Learn group
ui/components/layout/ExpandedFooter.tsx    add Updates link
ui/package.json                            add `test:updates` script
ui/pages/press.tsx                         OG image path fix; phase 2: "From the blog"
ui/pages/info.tsx                          OG image path fix
ui/pages/governance.tsx                    OG image path fix
ui/pages/projects-overview.tsx             OG image path fix
ui/next-sitemap.config.js                  phase 2: fix siteUrl
```

No new dependencies. `react-markdown` (`^9.0.1`), `remark-gfm` (`^4.0.0`),
`rehype-slug` (`^6.0.0`), `rehype-autolink-headings` (`^7.1.0`), `rehype-raw`
(`^7.0.0`), `date-fns` (`^2.30.0`), and `@tailwindcss/typography` (`^0.5.16`, a
devDependency, which is correct for a Tailwind plugin) are all already installed.

## Risks

- **The Vercel dynamic-route history.** Mitigated by using a single-segment `[slug]`
  route with no overlapping redirect, matching `pages/jobs/[id].tsx` which deploys
  today. If the deploy does fail, the escape hatch is already proven: move the route
  under a different prefix and add an `/updates/:path*` rewrite, exactly as `/docs` does.
- **`DEPLOYED_ORIGIN` pointing at a non-production host** would break every OG image
  and canonical URL. Verify against the production deploy, not just a preview, before
  announcing.
- **`fs` in the client bundle.** `loadUpdates.ts` must only be imported from
  `getStaticProps`. An accidental import into a component surfaces as a confusing
  build error, since `next.config.js` sets `resolve.fallback.fs = false`. Keep the
  import boundary obvious and note it at the top of the file.
- **The blog going stale** is the real risk, and it is not technical. The whole design
  is aimed at it: the cost of publishing is one markdown file in a PR, and there is
  no separate system to remember how to log into.
