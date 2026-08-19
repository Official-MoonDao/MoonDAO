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
yarn test:docs           # 33 tests: slugifier, frontmatter, rewrite, transclusion, links, parity
yarn test:cypress-unit   # 441 pre-existing tests, unaffected by this change
yarn docs:index          # regenerates public/docs-search-index.json
yarn build               # prebuild runs docs:index; getStaticPaths bakes every slug
```

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
- 0 missing vs the 117-key fixture
- 0 unresolved wikilinks, 0 unresolved relative `.md` links, 0 broken internal `/docs` hrefs
- one extra slug is OK: `tags` (alias of `tags/index`)

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
| Catch-all | `ui/pages/docs/[[...slug]].tsx` |
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

1. **Slug function:** `slugifySegment` is `s.replace(/ /g, '-')`, not `\s+`.
   The file `Legal/Ticket to Zero-G NFT/Ticket to Zero-G NFT  Sweepstakes Rules.md`
   (two spaces) must produce
   `Legal/Ticket-to-Zero-G-NFT/Ticket-to-Zero-G-NFT--Sweepstakes-Rules`.
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
- `/docs/Reference/Glossary-(dynamic)` — generated definition table
- `/docs/About/Glossary/@Project-Lead` — "Leader of a MoonDAO project." (recovered
  from Dataview metadata; renders blank on Quartz today)
- `/docs/tags/docs/glossary` — tag listing
- `/docs/About` — folder listing
- Global search icon → query `quadratic` or `constitution`
- Sidebar search on a docs page
- Legacy `/docs/token` → `/docs/Governance/Governance-Tokens`
