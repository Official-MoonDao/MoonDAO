# Verification checklist: native docs embedding

This file is a breadcrumb for a later review. It records what was implemented
against `docs/DOCUMENTATION_EMBEDDING_PLAN.md` §9 (monorepo + drop Obsidian),
how to check it, and what was deliberately left undone.

Implementation branch: `cursor/plan-native-docs-embedding-97ab`.
Vault imported from `Official-MoonDao/documentation` commit
`ff058cf866e0053c60d25f2ab4b2e018118f5243` (see `ui/content/docs/SOURCE.json`).

---

## How to verify mechanically

From `ui/`:

```
yarn docs:check          # pages, aliases, link integrity, Quartz slug parity (exits 1 on breakage)
yarn test:docs           # 41 tests: slugifier, frontmatter, rewrite, transclusion, links, parity
yarn test:cypress-unit   # 441 pre-existing tests, unaffected by this change
yarn docs:generate       # regenerates the two committed artifacts (see below)
yarn build               # no prebuild hook; getStaticPaths bakes every slug
```

Two generated files are **committed**: `public/docs-search-index.json` and
`lib/docs/generated/navTree.json`. They are not built by a `prebuild` hook, so
`next build` needs no `ts-node` and `next dev` behaves identically. `yarn test:docs`
fails if either drifts from `content/docs`; run `yarn docs:generate` to refresh.

The nav tree is imported as a module rather than passed through page props — it was
15 KB of the 18.5 KB `__NEXT_DATA__` on every one of ~200 prerendered pages.

`yarn build` was run to completion: 0 prerender errors, 155 docs HTML files emitted,
156 `/docs` URLs in `public/sitemap-0.xml`.

Building locally needs `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` and a **syntactically valid**
`NEXT_PUBLIC_PRIVY_APP_ID`. Without them every prerendered page in the app fails (`/404`,
`/500`, `/en/bridge`, …), not just docs — `_app.tsx` constructs both providers at module
scope. Dummy-but-well-formed values are enough for a build.

`yarn lint` / `next lint` is broken in this environment for unrelated reasons
(`eslint-config-next` → `jsx-a11y` fails to load on Node 22: "`[[GeneratorState]]` is not
present on `O`"). It fails identically on an unmodified checkout, and `next build` logs the
same warning while still succeeding.

Parity fixture: `ui/lib/docs/fixtures/contentIndex.json` (captured from
`https://docs.moondao.com/static/contentIndex.json` at import time).
**Do not regenerate this fixture after retiring Quartz** — it is the last
record of the 117 public slugs.

Expected `yarn docs:check` outcome:

- 72 markdown files + generated folder/tag pages = 118 slugs
- 0 unresolved wikilinks, 0 unresolved relative `.md` links, 0 broken internal
  `/docs` hrefs, 0 route-unsafe slugs
- 2 "missing" vs the 117-key fixture, both flagged `(intentional → …)` — see
  [route-safe slugs](#route-safe-slugs-why-two-urls-changed). Any *unflagged*
  missing slug fails the check.
- 3 extra slugs are OK: `tags` (alias of `tags/index`) plus the two renamed pages

Link breakage that existed in the vault and was resolved during import, rather than
propagated (see the import script's report):

| Kind | Items | Treatment |
|---|---|---|
| Dangling wikilinks | `[[@Voter]]`, `[[@TreasurySigner]]`, `[[Outbound SOP]]` | render as plain text, not dead links |
| Dangling relative `.md` links | `@Moon Settler.md`, `MoonDAO Legal Entity as a Marshall Island DAO LLC.md`, `Open Lunar Foundation.md`, `SpaceX.md`, `Team (dynamic).md` | label kept, href dropped |
| Wrong absolute link | `docs.moondao.com/Constitution` (a **live 404** today) | repaired to `/docs/Governance/Constitution#24-proposal-process` |
| Escaped-space link | `Governance\%20Tokens.md` | repaired to `/docs/Governance/Governance-Tokens` |
| Legacy Obsidian Publish links | 5 × `publish.obsidian.md/moondao/...`, **all currently 404** | repaired to `/docs/...`; includes two legal cross-references from the Ticket to Space Sweepstakes Rules (privacy policy + dispute notice) |
| Definition only in Dataview metadata | `About/Glossary/@Project-Lead` (blank page on Quartz today) | promoted to real markdown at import |

Two of those needed care and have dedicated tests:

- `Ticket to Space NFT/Dispute Notice` is ambiguous by filename — the vault has a
  Space *and* a Zero-G `Dispute Notice.md`. Resolution is by unique **path suffix**,
  so it must land on `Legal/Ticket-to-Space-NFT/Dispute-Notice`. Getting this wrong
  points a legal document at the wrong sweepstakes.
- Link targets can contain parentheses (`[Team (dynamic)](Team%20(dynamic).md)`).
  A `[^)]+` URL pattern truncates them and leaks `.md)` as visible text.

---

## Do not mount the docs catch-all at `/docs/*`

**This is the thing most likely to be "helpfully" refactored and break the
deploy.** The layout must stay:

| File | Serves |
|---|---|
| `pages/docs/index.tsx` | `/docs` (a plain static page) |
| `pages/documentation/[...slug].tsx` | everything else, reached via a rewrite |
| `next.config.js` → `rewrites()` | `/docs/:path*` → `/documentation/:path*` |

A dynamic catch-all mounted **directly** at `pages/docs/[...slug].tsx` builds
fine everywhere — locally, in the GitHub Actions `build` job, and even under
Vercel's own builder via `npx vercel build` — but **fails the Vercel
deployment**. The identical route under any other prefix deploys fine. The
rewrite keeps every public URL at `/docs/...`, so this is invisible to users.

Established by bisecting on Vercel (each row is one deploy):

| Branch state | Vercel |
|---|---|
| plan docs only, no code | ✅ |
| `pages/docs/[[...slug]].tsx`, ~190 prerendered paths | ❌ |
| same, `getStaticPaths` sliced to **1** path | ❌ |
| same, but that one file **deleted** | ✅ |
| required `pages/docs/[...slug].tsx` + `index.tsx` | ❌ |
| only `pages/docs/index.tsx`, no catch-all | ✅ |
| catch-all at `/docs`, `output: 'standalone'` removed | ❌ |
| **identical catch-all at `/kbtest/*`**, `/docs` index kept | ✅ |
| catch-all at `/docs`, all `/docs/*` redirects removed | ❌ |
| catch-all at `/docs`, `docs-*` public assets renamed | ❌ |
| **catch-all at `/documentation/*` + rewrite from `/docs/*`** | ✅ |

Read the two bolded rows together: the same file, the same ~190 prerendered
paths, the same everything — it fails at `/docs/*` and succeeds anywhere else.
That is what makes this a path-specific routing conflict rather than any of the
usual suspects.

Ruled out, each with a measurement or a deploy:

| Suspect | Evidence against |
|---|---|
| Build failure | GitHub Actions "Build application" passed; `npx vercel build` passed |
| Page count / output volume | cutting to **1** prerendered path still failed |
| Deployment size | 320 MB head vs 321 MB base — `ui/public/` is 257 MB of pre-existing assets |
| Static upload limit | 284 MB against a 1 GB Pro limit |
| Function count | 204 → 480, but Pro allows unlimited |
| Routes per deployment | 192 → 202, limit is 2048 |
| Build memory | peak 6.5 GiB base vs 6.9 GiB head |
| Build time | ~4 minutes against a 45-minute limit |
| Optional vs required catch-all | both forms failed at `/docs` |
| `output: 'standalone'` | removed it; still failed (kept removed — Vercel advises against it and nothing consumes `.next/standalone`) |
| `/docs/*` redirects in `next.config.js` | removed all 11; still failed (kept removed — they are alias pages now) |
| `docs-*` files under `public/` | renamed to `doc-*`; still failed (kept renamed, the names read better) |
| Non-ASCII / paren filenames | fixed; still failed (kept — see below) |
| `prebuild` + ts-node | removed; still failed (kept removed, it is simpler) |
| A Vercel dashboard redirect for `/docs` | `/docs` returned **200** on a passing preview, so nothing shadows it |

The underlying cause sits on Vercel's side and is not visible from the repo
(deploy logs need `vercel inspect`, which needs a token this environment does not
have). If someone with dashboard access ever finds and clears it, the catch-all
can move back to `pages/docs/[...slug].tsx` and the rewrite can go away.

### Consequences to preserve

- `allStaticPaths()` must **not** emit the empty-slug entry
  (`{ params: { slug: [] } }`) — invalid for a required catch-all. `/docs` comes
  from `index.tsx`; `/docs/index` stays in the catch-all because Quartz published
  an `index` slug.
- **Docs links use `components/docs/DocsLink.tsx`, not `next/link`.** Because the
  public path `/docs/*` is a rewrite onto a different page route, the client
  router has no route matching `/docs/*`: `next/link` would prefetch a data route
  that 404s and then hard-navigate anyway. `DocsLink` uses a plain anchor for
  `/docs*` and `next/link` for every other in-app route. `GlobalSearch` does the
  same for its docs hits. Net effect: doc→doc navigation is a normal page load;
  doc→app links still navigate client-side.
- The `/documentation` prefix must never appear in rendered output. A build-time
  sweep asserts this across all 172 pages.

## Route-safe slugs: why two URLs changed

The first push of this branch **failed the Vercel deploy** while passing both the
local build and the GitHub Actions `build` job. Diagnosis:

- GitHub Actions' "Build application" step succeeded, so `next build` was fine.
- `npx vercel build` (which runs Vercel's own builder locally, and works offline
  given a stub `.vercel/project.json`) also succeeded — so the failure was in
  Vercel's **deploy/upload**, not the build.
- Deployment size was not the cause: `ui/public/` is 257 MB of pre-existing
  assets, and this change adds 1.3 MB.
- The only novel thing in the build output was **8 files whose names carried a
  non-ASCII `’` (U+2019) or parentheses**, from two vault pages.

So slugs are now restricted to `[A-Za-z0-9._@-]` and `/`. `@` is kept — 19 routes
use it and it is a legal, widely used path character. The two affected pages were
renamed, dropping the offending characters:

| Quartz URL | New URL |
|---|---|
| `Reference/Glossary-(dynamic)` | `Reference/Glossary-dynamic` |
| `Reference/Nested-Docs/MoonDAO’s-Quarterly-Rewards` | `Reference/Nested-Docs/MoonDAOs-Quarterly-Rewards` |

Nothing linked to either page — not in the corpus, and not in Quartz's own
`links` graph (checked across all 117 entries). Both are under `Reference/`, which
the vault README describes as the folder for pages kept out of the nav.

Parentheses matter beyond filenames: they are path-to-regexp metacharacters, so a
`next.config.js` redirect *source* containing one needs escaping. Avoiding them
keeps redirects and route patterns straightforward.

Enforcement, so this cannot regress:

- `isRouteSafeSlug` + `INTENTIONAL_SLUG_CHANGES` in `ui/lib/docs/slug.ts`
- `sanitizeVaultPath` in `slug.ts` and `scripts/migrate-vault.mjs` (so re-running
  the import reproduces the sanitized filenames)
- three tests: route-safe slugs, route-safe content filenames, and parity that
  only tolerates the two documented exceptions
- `yarn docs:check` exits non-zero on any unsafe slug or any *unflagged* missing slug

**Phase 5 follow-up:** the `docs.moondao.com` → `moondao.com/docs` 301 map must
special-case these two old URLs.

## Plan coverage

### Phase 0 — iframe stopgap

**Not shipped as a stopgap.** The six iframe pages were replaced with native
`getStaticProps` wrappers (Phase 3). The iframe body was never extracted to
`DocsIframe.tsx` because there is no iframe left.

`openLinksInNewTab: true` in the documentation repo was **not** applied — that
repo is not this repo. If `docs.moondao.com` stays up during the grace period,
that one-line Quartz config change is still worth doing there.

### Phase 1 — content pipeline

| Deliverable | Location |
|---|---|
| Vault import + conversion | `ui/scripts/migrate-vault.mjs` (run once; output committed) |
| Quartz slugifier | `ui/lib/docs/slug.ts` — each space → `-` (double space → `--`) |
| Frontmatter | `ui/lib/docs/frontmatter.ts` |
| Wikilink / image / callout / host rewrite | `ui/lib/docs/rewrite.ts` (also applied at load time as a safety net for hand-authored wikilinks) |
| Corpus + folder/tag pages + transclusions + link checkers | `ui/lib/docs/loadDocs.ts` |
| Search index builder | `ui/lib/docs/searchIndex.ts`, `ui/scripts/docs-index.ts` |
| `yarn docs:check` | `ui/scripts/docs-check.ts` |
| Tests | `ui/scripts/docs-pipeline.test.ts` |

The import script and `lib/docs/rewrite.ts` implement the same conversion twice —
the script is standalone JS so it can run without `ts-node`. They are kept in sync
by the fact that re-running the import must be a no-op; if you change one, change
both and re-run `yarn docs:migrate` (requires a local clone of the vault).

Content lives at `ui/content/docs/` with original vault filenames (spaces, `@`).
Media at `ui/public/docs-media/`. Unpublished `MoonDAO/media-files/` (~59 MB)
was **not** imported.

### Phase 2 — docs UI

| Component | File |
|---|---|
| Docs home (`/docs`) | `ui/pages/docs/index.tsx` |
| Catch-all | `ui/pages/documentation/[...slug].tsx`, surfaced at `/docs/*` by a rewrite (see above) |
| Link helper | `ui/components/docs/DocsLink.tsx` |
| Page shell | `ui/components/docs/DocsPage.tsx` |
| 3-column layout | `ui/components/docs/DocsLayout.tsx` |
| Sidebar explorer | `ui/components/docs/DocsSidebar.tsx` |
| In-docs search | `ui/components/docs/DocsSearch.tsx` |
| TOC | `ui/components/docs/DocsTOC.tsx` |
| Breadcrumbs | `ui/components/docs/DocsBreadcrumbs.tsx` |
| Backlinks | `ui/components/docs/DocsBacklinks.tsx` |
| Markdown | `ui/components/docs/DocMarkdown.tsx` |

No feature flag — this is the cutover, not a parallel preview.

### Phase 3 — cutover

- Six short routes now call `getDocStaticProps` with a fixed slug:

  | Route | Slug |
  |---|---|
  | `/about` | `index` |
  | `/faq` | `About/FAQ` |
  | `/constitution` | `Governance/Constitution` |
  | `/privacy-policy` | `Legal/Website-Privacy-Policy` |
  | `/terms-of-service` | `Legal/Website-Terms-and-Conditions` |
  | `/project-system-docs` | `Projects/Project-System` |

- `/docs` itself is the catch-all index. The old permanent redirect from `/docs`
  to `docs.moondao.com` was **removed** (required, or Next would never serve
  the page).
- Legacy short paths (`/docs/token`, `/docs/team`, …) now redirect internally.
  `/docs/privacy-policy` and `/docs/website-terms-and-conditions` are native
  alias slugs from vault frontmatter, not redirects.
- Hardcoded `docs.moondao.com` hrefs in live `ui/` code were rewritten to
  `/docs/...` or the short legal routes. Privy legal URLs use
  `${DEPLOYED_ORIGIN}/terms-of-service` and `/privacy-policy`.
- `docs.moondao.com` was removed from CSP `frame-src` and `connect-src`.
- Learn nav + footer gained a Documentation item pointing at `/docs`.
- `/docs/[[...slug]]` and the three previously-missing legal/project routes
  were added to `fullscreenPaths`.

### Phase 4 — search

- `public/docs-search-index.json` is generated by `prebuild` / `yarn docs:index`.
- `GlobalSearch.tsx` lazily fetches it and blends hits (category `Docs`).
- `DocsSearch.tsx` is the in-sidebar search.

### Phase 5 — retire Quartz — **not done**

Cannot be completed from this repo.

Remaining work on `Official-MoonDao/documentation`:

1. Keep GitHub Pages building for a grace period.
2. Replace the Pages output with 301s: `docs.moondao.com/<slug>` →
   `https://moondao.com/docs/<slug>` (home → `https://moondao.com/docs`).
3. Move or archive the unpublished 59 MB `MoonDAO/media-files/` tree.
4. Update that repo's README to say editing now happens in this monorepo.
5. Optionally set `openLinksInNewTab: true` if the Quartz site stays up
   behind an iframe anywhere.

`DEPRIZE_TERMS_URL` now points at `/docs/Legal/DePrize-Terms-and-Conditions`,
which is **not in the imported vault**. The old Quartz URL was also absent
from `contentIndex.json`. The draft still lives at
`ui/docs/DEPRIZE_TERMS_AND_CONDITIONS.md`.

---

## Invariants a reviewer should re-check

1. **Slug function:** `slugifySegment` replaces each *single* space with `-`, not
   `\s+`. The file
   `Legal/Ticket to Zero-G NFT/Ticket to Zero-G NFT  Sweepstakes Rules.md`
   (two spaces) must produce
   `Legal/Ticket-to-Zero-G-NFT/Ticket-to-Zero-G-NFT--Sweepstakes-Rules`.
   Note that `sanitizeVaultPath` must therefore **not** collapse double spaces.
2. **Tag URLs are lowercased.** `Coordinape` → `/docs/tags/coordinape`.
3. **Comma-separated scalar tags** (`tags: docs/faq, docs/onboarding`) must
   split into two tags, matching Quartz.
4. **Root `content/docs/README.md` is not a doc page.** `Reference/README.md` is.
5. **No `/docs` → external redirect** remains in `ui/next.config.js`.
6. **`getStaticProps` only** — `loadDocs.ts` uses `fs` and must never be
   imported from a client bundle except via props. `output: 'standalone'`
   is fine because pages are baked at build time. Vercel root dir must stay
   `ui/` so `process.cwd()` resolves `content/docs`.
7. **Transclusions are table-aware.** `![[Note]]` inlines the target's body,
   *except* inside a markdown table row, where it becomes a link — inlining a
   multi-paragraph body into a `|` cell destroys the table. `About/Glossary.md`
   is entirely such a table; it must render **1 table with 17 rows**, matching
   Quartz. (Quartz avoids the problem differently, by deferring transclusion to
   client-side JS — its server HTML just reads "Transclude of x".) Image
   transclusions were converted to `/docs-media/...` at import.
8. **The Dataview block lives in `Reference/Glossary (dynamic).md`**, not
   `About/Glossary.md`. It is replaced by a table generated from the
   `About/Glossary/` folder.
9. **Anchor links must not be `target="_blank"`.** `DocMarkdown` routes `#foo`
   to a plain `<a>`, `/foo` to `next/link`, and everything else to a new tab.
   Getting this wrong makes every `rehype-autolink-headings` heading anchor open
   a new tab.
10. **Canonical URLs are deduped.** `DocsPage` sets an explicit canonical of
    `/docs/<slug>`, so `/faq`, `/docs/About/FAQ`, and alias slugs like
    `/docs/tts-sweepstakes-rules` don't compete in search. This needed a new
    `canonical` prop on `components/layout/Head.tsx` (defaults to the current
    path, so no other page changes behaviour).
11. **`public/docs-search-index.json` is generated but committed** (so `next dev`,
    which skips `prebuild`, still has search). A test asserts it matches the
    content; run `yarn docs:index` if it fails.
12. Graph view, hover popovers, Quartz RSS, and the 59 MB research dump
    were intentionally dropped (plan §9.3).

---

## Whole-corpus assertion

After `yarn build`, all 161 rendered pages (155 docs + the 6 short routes) were
scanned and none contained: an empty article, a `docs.moondao.com` or
`publish.obsidian.md` reference, an unexpanded `![[transclusion]]`, an `<iframe>`,
an anchor link with `target="_blank"`, a leftover `docs-glossary-table` marker, or a
raw `](...md)` link. Re-run that sweep if you touch the pipeline.

## Smoke paths to click

- `/docs` — Introduction, hero image from `/docs-media/hero.png`
- `/docs/About/FAQ` and `/faq` — same page
- `/docs/Governance/Constitution` and `/constitution`
- `/docs/Legal/Website-Privacy-Policy`, `/privacy-policy`, `/docs/privacy-policy`
- `/docs/About/Glossary` — a single 17-row table, terms linked (not inlined)
- `/docs/Reference/Glossary-dynamic` — generated definition table
- `/docs/About/Glossary/@Project-Lead` — "Leader of a MoonDAO project." (recovered
  from Dataview metadata; renders blank on Quartz today)
- `/docs/tags/docs/glossary` — tag listing
- `/docs/About` — folder listing
- Global search icon → query `quadratic` or `constitution`
- Sidebar search on a docs page
- Legacy `/docs/token` → `/docs/Governance/Governance-Tokens`
