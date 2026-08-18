# Plan: Bringing MoonDAO Documentation Into the App

Status: proposal. Decision 3 in §8 has since been answered — see
[§9, Revision: dropping Obsidian](#9-revision-dropping-obsidian), which supersedes the
recommendation in §6.
Scope: how `docs.moondao.com` (Quartz + Obsidian) relates to the `ui/` Next.js app.

---

## 1. Current state

### 1.1 Two repositories, two builds

| | Content | App |
|---|---|---|
| Repo | `Official-MoonDao/documentation` | `Official-MoonDao/MoonDAO` (`ui/`) |
| Source | `MoonDAO/docs/**/*.md` — an Obsidian vault | Next.js 13 Pages Router, TypeScript |
| Build | GH Action checks out `jackyzha0/quartz@v5.0.0`, rsyncs `.site-config/`, runs `npx quartz build` | `next build` |
| Host | GitHub Pages at `docs.moondao.com` | Vercel at `moondao.com` |
| Authoring | Obsidian or Codespaces, fork-and-PR (documented in that repo's README) | normal dev workflow |

Quartz is configured with `enableSPA`, `enablePopovers`, its own Google Analytics tag
(`G-QPFCD9VH46`), its own typography (Schibsted Grotesk / Source Sans Pro / IBM Plex Mono), and
its own dark palette. Its page layout supplies a left rail (page title, search, dark-mode toggle,
explorer) and a right rail (graph view, table of contents, backlinks).

### 1.2 How the two are joined today

Six routes in `ui/pages/` are nothing but a full-screen iframe:

| Route | iframe `src` | Listed in `fullscreenPaths`? |
|---|---|---|
| `/about` | `https://docs.moondao.com` | yes |
| `/faq` | `/About/FAQ` | yes |
| `/constitution` | `/Governance/Constitution` | yes |
| `/privacy-policy` | `/Legal/Website-Privacy-Policy` | **no** |
| `/terms-of-service` | `/Legal/Website-Terms-and-Conditions` | **no** |
| `/project-system-docs` | `/Projects/Project-System` | **no** |

All six share the same body:

```7:17:ui/pages/constitution.tsx
      <iframe
        className="absolute top-0 left-0 h-full w-full border-0"
        src="https://docs.moondao.com/Governance/Constitution"
        allowFullScreen
        style={{ height: '100vh', overflow: 'hidden' }}
        onLoad={() => {
          // Prevent any scroll restoration
          window.scrollTo(0, 0);
          document.body.style.overflow = 'hidden';
        }}
      />
```

Beyond the iframes, the coupling is:

- **14 permanent redirects** in `ui/next.config.js` that bounce `/docs/*` off the app onto
  `docs.moondao.com` (`/docs`, `/docs/token`, `/docs/privacy-policy`, and so on).
- **28 hardcoded `https://docs.moondao.com/...` links across 23 files** in `ui/` (excluding
  `archive/`, `cypress/`, `scripts/`, and `next.config.js`). Two of those are Privy's
  `termsAndConditionsUrl` and `privacyPolicyUrl` in `ui/pages/_app.tsx`, which appear in the
  wallet-creation flow.
- `docs.moondao.com` allowlisted in both `frame-src` and `connect-src` of the app's CSP.

---

## 2. What is actually broken

These are the specific failures, not general dislike of iframes.

**1. Docs → app is a dead end.** `moondao.com` serves `frame-ancestors 'none'`, and Quartz emits
external links with no `target="_blank"` (its `openLinksInNewTab` option is left at the default
`false`). So the `https://moondao.com/propose` link on `/About/FAQ`, when a user reaches it via
`moondao.com/faq`, tries to load `moondao.com` *inside the iframe* and the browser refuses. The
user gets a blank pane and has to hit back. Verified against production:

```
$ curl -s https://docs.moondao.com/Governance/Constitution | grep -o '<a[^>]*moondao\.com[^>]*>'
<a href="https://moondao.com/propose" class="external external-link">   # no target="_blank"

$ curl -sIL https://moondao.com/propose | grep -o "frame-ancestors 'none'"
frame-ancestors 'none'
```

**2. The URL never changes.** Navigate five pages deep inside the iframe and the address bar still
says `/about`. Deep links can't be shared, the back button doesn't follow in-frame navigation, and
`/faq` and `/about` are indistinguishable once the user starts clicking.

**3. Two navigation systems stacked vertically.** The MoonDAO `TopNavBar` sits above Quartz's own
left rail. The user sees two search boxes, two dark-mode toggles, and two site titles on one screen.

**4. Mobile is actively hostile.** `fixed inset-0` plus `document.body.style.overflow = 'hidden'`
on load freezes the outer page while the iframe scrolls independently. Three of the six routes
aren't in `fullscreenPaths`, so they render a `100vh` iframe inside the `max-w-7xl` container.

**5. SEO is split.** `Head.tsx` sets the canonical URL to `moondao.com/about`, behind which there
is no indexable content, while the real content is indexed under `docs.moondao.com`. Two domains
compete for the same terms and neither accumulates the other's authority.

**6. Search does not cross the boundary.** `components/layout/GlobalSearch.tsx` is a static
keyword → route map with hand-rolled fuzzy scoring — it has no idea the docs exist. Quartz ships a
real full-text index over 117 pages that the app can't reach. A user searching "quadratic voting"
in the app gets nothing.

**7. Theme mismatch.** Different fonts, different dark palettes, and two independent dark-mode
states that can disagree with each other on the same screen.

**8. No access to app state.** Docs can't render "you are a Citizen", link to the reader's own team
or project, show live treasury or vMOONEY numbers, or gate anything.

---

## 3. Constraints

- **Pages Router only.** `.cursor/rules/30-architecture.mdc` forbids App Router and RSC. This rules
  out Fumadocs (App Router only) and Nextra v4 as in-app options.
- **The Obsidian + fork/PR/Codespaces authoring flow must survive.** It is documented in the
  documentation repo's README and is used by non-engineers. Any option that forces contributors
  into the monorepo's toolchain is a regression for them.
- **URLs must be preserved.** ~28 in-app links, the Privy legal URLs, and an unknown number of
  external inbound links point at `docs.moondao.com/...`.
- **Legal pages are load-bearing.** Website T&C, privacy policy, launchpad disclaimer, and the
  sweepstakes rules are referenced from signing and contribution flows. They need byte-for-byte
  continuity and stable URLs.

---

## 4. Content inventory

What a native renderer would have to handle. Measured against `main` of the documentation repo:

| Thing | Count | Notes |
|---|---|---|
| Markdown files | 72 | ~82,000 words total |
| Pages emitted by Quartz | 117 | includes folder and tag index pages |
| Wikilinks `[[...]]` | 69 across 28 files | includes `[[#Heading]]` and `[[Target\|Label]]` forms |
| Transclusions `![[...]]` | 26 | ~23 note embeds (glossary terms, member bios), 2 images, 1 bare IPFS URL |
| Callouts `> [!x]` | 4 | `[!info]`, `[!NOTE]`, 2× `[!TIP]` |
| `dataview` blocks | 1 | `Reference/Glossary (dynamic).md` |
| Files with no frontmatter | 19 | mostly `Reference/` and `Legal/` |
| Images under `docs/_media-files/` | 7 | |

Frontmatter keys in use: `tags` (53), `title` (31), `description` (30), `sidebar_position` (29),
`id` (28), `keywords` (26), `sidebar_label` (22), `aliases` (20), `slug` (13), plus a few
member-profile keys (`roles`, `discord`, `address`, `member_since`, `author`).

Filenames contain spaces, `@`, `’`, and parentheses. Quartz's slugifier maps
`Projects/Project System.md` → `/Projects/Project-System`, and the 13 `slug:` overrides plus 20
`aliases:` entries add non-derivable URLs on top of that.

At least one wikilink is already broken: `[[Outbound SOP]]` has no matching file in the vault.

### What the app already has

Installed and in use in `ui/`: `react-markdown@9`, `remark-gfm@4`, `rehype-slug`,
`rehype-autolink-headings`, `rehype-raw`, and `@tailwindcss/typography`.
`components/nance/MarkdownWithTOC.tsx` already renders GFM with heading slugs and hover anchors.

Missing: no catch-all page route, no `gray-matter`, no MDX, no filesystem-content pipeline of any
kind. `getStaticProps` is used widely but only for API, on-chain, and subgraph data.

Also worth knowing: Quartz already publishes its whole corpus as machine-readable JSON at
`https://docs.moondao.com/static/contentIndex.json` — 535 KB, 117 entries, each with
`{ slug, filePath, title, links, tags, content }` where `content` is plain text. That file is a
free correctness oracle for slug parity and a ready-made search corpus.

---

## 5. Options

### Option 0 — Patch the iframe

Keep everything as-is and fix the worst defects.

- Set `openLinksInNewTab: true` in `.site-config/quartz.config.ts` so external links stop
  dead-ending in the frame. One line, kills problem #1.
- Add `/privacy-policy`, `/terms-of-service`, `/project-system-docs` to `fullscreenPaths` in
  `components/layout/Layout.tsx`.
- Drop the `fixed inset-0` + `document.body.style.overflow = 'hidden'` pattern; size the iframe to
  `calc(100vh - 4rem)` under the nav so mobile scrolling works.
- Optionally add `postMessage` height and route sync so the parent URL tracks the iframe.
- Extract the duplicated iframe body into one `components/layout/DocsIframe.tsx`.

Fixes #1 and #4, partially #2. Leaves #3 and #5–#8 untouched.
**Effort:** trivial. **Risk:** near zero. **Verdict:** do this regardless, as a stopgap.

### Option 1 — Same-origin reverse proxy

Serve Quartz's output through the Next app so it lives at `moondao.com/docs/*` with no iframe.

```js
// ui/next.config.js
async rewrites() {
  return [
    { source: '/docs', destination: 'https://docs.moondao.com/' },
    { source: '/docs/:path*', destination: 'https://docs.moondao.com/:path*' },
  ]
}
```

Implementation notes:

- Quartz emits root-absolute asset paths (`/index.css`, `/postscript.js`, `/static/*`) that would
  collide with the app's own routes. Set `baseUrl: "moondao.com/docs"` in the Quartz config;
  Quartz v4/v5 prefers relative URLs precisely so subpath hosting works, but every asset path needs
  verifying.
- The app's CSP header applies to `/(.*)`. Quartz uses inline styles/scripts and Google Fonts;
  `/docs/*` would need its own relaxed CSP entry in `headers()`.
- The 14 `/docs/*` redirects in `next.config.js` currently point outward and would conflict with
  the rewrite — they'd need rewriting or removing.

Fixes #2 and #5 completely, and the "iframe" complaint literally. Leaves #3, #6, #7, #8: the
proxied page is still 100% Quartz chrome with no MoonDAO nav, and every crossing between docs and
app is a full page load.
**Effort:** small. **Risk:** low-to-moderate (asset paths, CSP).
**Verdict:** a good stepping stone, or a legitimate permanent answer if the team decides docs
*should* look like a separate property.

### Option 2 — Native rendering, content pulled from the docs repo at build time — **recommended**

The vault stays exactly where it is. The app pulls the markdown at build time, normalizes the
Obsidian dialect, and renders it as real Next.js pages with MoonDAO chrome.

```
ui/
  scripts/fetch-docs.mjs          # prebuild: download + extract the vault, copy media
  lib/docs/
    slug.ts                       # Quartz-compatible slugifier + slug/alias overrides
    loadDocs.ts                   # gray-matter parse -> DocPage[], name->slug map, backlinks, tree
    remarkObsidian.ts             # wikilinks, transclusions, callouts
    searchIndex.ts                # emit the search corpus
  components/docs/
    DocsLayout.tsx  DocsSidebar.tsx  DocsTOC.tsx
    DocsBreadcrumbs.tsx  DocsBacklinks.tsx  DocMarkdown.tsx
  pages/docs/[[...slug]].tsx      # getStaticPaths + getStaticProps
```

Key implementation decisions:

- **Vault acquisition.** A `prebuild` script that downloads
  `https://codeload.github.com/Official-MoonDao/documentation/tar.gz/<ref>` and extracts
  `MoonDAO/docs` into `ui/.docs-cache/`, with the ref pinned by a `DOCS_REPO_REF` env var
  (default `main`). Preferred over a git submodule: no submodule friction for contributors, and
  pinning a ref lets us hold docs steady while debugging an app deploy. Media gets copied to
  `ui/public/docs-media/`.
- **Publish trigger.** Add a step to the documentation repo's existing `build-and-deploy.yaml`
  that curls a Vercel Deploy Hook, so merging a doc PR redeploys the app. This is the one genuinely
  new piece of cross-repo plumbing.
- **Slug parity, verified mechanically.** Port Quartz's `slugifyFilePath` semantics (spaces → `-`,
  strip `.md`, preserve case, keep `@`), then apply `slug:` overrides and `aliases:`. Add a unit
  test asserting that every slug in the live `contentIndex.json` is produced by our pipeline. That
  turns the riskiest part of the migration into a CI check.
- **Wikilinks.** A small remark plugin resolving `[[Target]]`, `[[Target|Label]]`, `[[#Heading]]`,
  and `[[Target#Heading]]` against the name → slug map. Unresolved links get logged and fail the
  build, which surfaces the existing `[[Outbound SOP]]` breakage instead of silently shipping it.
- **Transclusions.** Inline the target's body at build time in a single pass with a cycle guard;
  `![[image.png]]` becomes an `<img>` pointing at `/docs-media/`.
- **Callouts.** Four instances. A ~30-line remark plugin, or hand-convert them in the vault.
- **The one `dataview` block.** `Reference/Glossary (dynamic).md` builds a glossary table from a
  folder. Generate it in `loadDocs.ts` from the `About/Glossary/` directory — roughly fifteen lines
  — rather than implementing any part of Dataview.
- **Rendering.** Extend the existing `MarkdownWithTOC` plugin configuration, styled with
  `prose prose-invert prose-headings:font-GoodTimes` to match the treatment already used in
  `pages/proposal-template.tsx`.
- **Search.** Emit `public/docs-search-index.json` at prebuild (titles, headings, body text) and
  load it lazily in both the docs sidebar and `GlobalSearch.tsx`, so app-wide search finally
  returns documentation hits. Quartz's own 535 KB index proves the shape is viable; trimming to
  headings plus a body excerpt would keep it well under that.

What we lose relative to Quartz: the graph view (low value, high cost — recommend dropping),
hover popovers (nice, reimplementable later against the same index), and Quartz's RSS/sitemap
(the app already runs `next-sitemap` in `postbuild`, so docs pages get picked up for free).

Fixes all eight problems. Preserves the authoring workflow untouched.
**Effort:** the largest of the options, concentrated in the Obsidian → React pipeline and the docs
chrome. **Risk:** slug parity (mitigated by the CI check above) and the cross-repo publish trigger.

### Option 3 — Native rendering, content moved into this monorepo

Identical rendering to Option 2, but the markdown lives at `ui/content/docs/` and the documentation
repo is retired or demoted to a mirror.

Gains: a feature and its documentation can land in one PR; no cross-repo deploy hook; no fetch step;
docs are versioned with the code that they describe.

Costs: documentation contributors now face a repo with contracts, CI, and a heavy install, and the
Obsidian experience degrades (you'd open the whole monorepo as a vault). That is a real regression
for the non-engineer contributors the current README is written for.

**Verdict:** only if the team concludes that doc contributors are, in practice, developers.
Otherwise pair it with Option 6 to keep a friendly authoring surface.

### Option 4 — Native rendering with runtime fetch + ISR

Option 2's pipeline, but `getStaticProps` fetches raw markdown from `raw.githubusercontent.com`
with `revalidate`, and `getStaticPaths` uses `fallback: 'blocking'` seeded from the GitHub tree API.

Gains: doc edits go live without an app deploy, and no deploy hook is needed.

Costs: a GitHub token for rate limits, a runtime dependency on GitHub availability, and
build-time link validation and slug-parity tests can't cover `fallback` pages.

**Verdict:** not a good primary mechanism, but an excellent *add-on*. Because the parsing in
`lib/docs/` is pure functions over markdown strings, the same code serves both build-time and ISR.
Start with build-time (Option 2) and add `revalidate` later if publish latency becomes a complaint.

### Option 5 — Adopt a docs framework

| Framework | Fit |
|---|---|
| Fumadocs | App Router only. Blocked by repo rules. |
| Nextra 2 | Pages Router compatible, but wants to own `_app`, the theme, and the layout. Mounting it as a section of an existing app fights its theme layer. |
| Docusaurus | A separate React app. Can't share the MoonDAO layout or React context. |
| Mintlify / GitBook | Excellent authoring, but SaaS cost, less control, and a separate origin — the same class of problem as today, just prettier. |

**The multi-zone variant is worth serious consideration:** run Nextra (or Docusaurus) as a *second*
Vercel project over the same markdown and rewrite `/docs/*` to it from the main app. That gets one
origin and a real docs engine without writing a renderer.

Fixes #2 and #5, partially #3 and #7 (you can theme it to match). Leaves #6 and #8: no shared
search index, no shared React context, and a full page load at the boundary. It is essentially
Option 1 with a nicer engine and a second deployment to maintain.

### Option 6 — Git-backed CMS on top of Option 2 or 3

Layer Keystatic (Pages Router compatible) or TinaCMS over the markdown. Editors get a WYSIWYG at
`/keystatic` that commits or opens PRs against GitHub.

This doesn't replace any rendering work — it replaces the *Codespaces* step in the authoring flow.
Worth doing only if authoring friction turns out to be a real complaint. Add it after Phase 3.

---

## 6. Recommendation

**Option 2**, reached in phases, with **Option 0 shipped immediately** as an independent stopgap and
**Option 6** held as an optional later layer.

The reasoning:

- It's the only option that addresses all eight problems. Everything else leaves the search,
  theming, and app-state problems in place.
- It preserves the editorial workflow exactly. The vault repo, Obsidian, and the fork/PR flow are
  untouched — which matters more than it looks, because that workflow is the reason the docs are
  maintained by people who aren't engineers.
- The rendering dependencies are already installed and already used in the app. This is not a new
  stack, it's a new consumer of an existing one.
- The corpus is small and its Obsidian feature usage is shallow: 72 files, 69 wikilinks, 26 embeds,
  4 callouts, one Dataview block. That's a tractable normalization pass, not a Quartz
  reimplementation.
- The one genuinely scary part — URL parity across 117 pages with 13 slug overrides and 20 aliases
   — is mechanically verifiable against a JSON file Quartz already publishes.

If the appetite for that scope isn't there, **Option 1 is the best small move**: it kills the iframe
and unifies the origin for a fraction of the work, and it doesn't foreclose Option 2 later.

---

## 7. Phased plan

### Phase 0 — Stop the bleeding

Independent of everything below; mergeable on its own.

1. In the documentation repo: set `openLinksInNewTab: true` in `.site-config/quartz.config.ts`.
2. Add the three missing routes to `fullscreenPaths` in `components/layout/Layout.tsx`.
3. Replace the `fixed inset-0` / `overflow: hidden` pattern in the six iframe pages with an iframe
   sized to `calc(100vh - 4rem)` beneath the nav.
4. Extract the shared iframe body into `components/layout/DocsIframe.tsx`, so Phase 3 has exactly
   one place to swap.

### Phase 1 — Content pipeline, no UI

1. `ui/scripts/fetch-docs.mjs` — prebuild vault download, extract to `ui/.docs-cache/`, copy
   `_media-files` to `ui/public/docs-media/`. Ref pinned via `DOCS_REPO_REF`.
2. `ui/lib/docs/slug.ts` — Quartz-compatible slugifier plus `slug:`/`aliases:` overrides.
3. `ui/lib/docs/loadDocs.ts` — `gray-matter` parse into `DocPage[]`, plus the name → slug map,
   backlink map, and folder tree.
4. `ui/lib/docs/remarkObsidian.ts` — wikilinks, transclusions, callouts.
5. Test: every slug in the live `contentIndex.json` must be produced by the pipeline. Wire into
   `test:cypress-unit` or a new mocha script.
6. Deliverable: `yarn docs:check` prints the page list, the alias table, and every unresolved
   wikilink. No routes yet, nothing user-visible.

### Phase 2 — Docs UI behind a flag

1. `pages/docs/[[...slug]].tsx` with `getStaticPaths` over all slugs and aliases.
2. `components/docs/`: `DocsLayout` (left explorer, content, right TOC), `DocsSidebar` (collapsible
   tree ordered by `sidebar_position`, labelled by `sidebar_label` falling back to `title`),
   `DocsBreadcrumbs`, `DocsTOC`, `DocsBacklinks`, `DocMarkdown`.
3. Wire `Head.tsx` per page from frontmatter `title`/`description`/`keywords`.
4. Add a **Docs** entry under **Learn** in `lib/navigation/useNavigation.tsx` and mirror it in
   `ExpandedFooter.tsx`'s `learnLinks`.
5. Gate on a flag in `const/flags.ts`. The iframes stay live; `/docs` is reviewable in parallel.

### Phase 3 — Cutover

1. Point the six iframe routes at native content (see decision 1 below).
2. Flip the 14 `/docs/*` redirects in `next.config.js` from `https://docs.moondao.com/...` to
   internal `/docs/...` paths.
3. Rewrite the 28 hardcoded `docs.moondao.com` links to `/docs/...`. Privy's
   `termsAndConditionsUrl` and `privacyPolicyUrl` need absolute URLs — build them from
   `DEPLOYED_ORIGIN`.
4. Remove `docs.moondao.com` from `frame-src` in the CSP.
5. Add the Vercel Deploy Hook call to the documentation repo's `build-and-deploy.yaml`.

### Phase 4 — Unify search

1. Emit `public/docs-search-index.json` at prebuild.
2. Teach `GlobalSearch.tsx` to lazily load it and blend documentation hits with the existing
   route mappings.
3. Add in-docs search to `DocsSidebar`.

### Phase 5 — Retire or redirect the Quartz site

1. Keep `docs.moondao.com` building for a grace period after cutover.
2. Then replace the GitHub Pages output with 301s to `moondao.com/docs/*`, preserving slugs.
3. Update the documentation repo's README so the authoring instructions still match reality.
4. Optional Phase 6: Keystatic at `/keystatic` for WYSIWYG editing.

---

## 8. Decisions needed before Phase 1

1. **Do the six short routes stay canonical, or 301 into `/docs/...`?** `/privacy-policy` and
   `/terms-of-service` are referenced from Privy and signing flows, so the safest answer is to keep
   those two routes and render them natively. `/about`, `/faq`, `/constitution`, and
   `/project-system-docs` could go either way.
2. **Does `docs.moondao.com` survive as a redirect-only domain, or run in parallel indefinitely?**
   This determines whether Phase 5 is a cleanup or a permanent dual-publish arrangement.
3. **Separate content repo (Option 2) or monorepo (Option 3)?** Really a question about who writes
   the docs. If the answer is "mostly engineers", Option 3 is simpler and cheaper.
4. **Graph view: drop it or rebuild it?** Recommend dropping. If it's valued, it can be rebuilt
   later from the same link map the backlinks feature already needs.
5. **Is authoring friction a real complaint?** If contributors are struggling with the
   Codespaces flow, Option 6 should be pulled forward ahead of Phase 4.
6. **Publish latency tolerance.** If "a doc edit must be live in under a minute without an app
   deploy" is a hard requirement, add Option 4's ISR in Phase 2 rather than deferring it.

---

## 9. Revision: dropping Obsidian

Decision 3 above was answered: the Obsidian vault was adopted in the hope that it would draw
non-engineering contributors, and it hasn't. The recommendation in §6 was weighted heavily toward
preserving that workflow, so it changes. This section supersedes it.

### 9.1 The contribution data supports the premise

527 commits over the documentation repo's life, from effectively five people (identities merged
across their multiple git addresses):

| Author | Commits |
|---|---|
| Mitchie | 144 |
| name.get / colinmfoster4723 | 123 |
| Philip Linden | 110 |
| ryand2d | 84 |
| pmoncada | 58 |
| everyone else (incl. 2 bot commits) | 8 |

Those five account for 98% of all commits. All 100 of the most recent merged PRs came from that
same set of accounts. Activity is also declining sharply — 89 commits in 2023, 332 in 2024, 86 in
2025, 20 so far in 2026 — and several of the 2026 commits are build repairs rather than content.

There is no drive-by contributor population to protect. The premise holds.

### 9.2 "Obsidian" is four separable things

Worth untangling before deciding what to drop, because they carry very different costs:

1. **Obsidian the editor.** A markdown editor. Nobody is obliged to use it, and dropping it costs
   literally nothing — it leaves no trace in the repo. Any per-seat licence or Sync subscription
   goes away with it.
2. **The Obsidian dialect in the content.** Wikilinks, transclusions, callouts. This is the part
   with actual consequences, discussed below.
3. **Quartz, the static site generator.** Independent of Obsidian; it just happens to speak the
   dialect. Dropping it is the §5 Option 2/3 work.
4. **The separate repository and GitHub Pages host.** Also independent, and the thing that makes
   the two sides awkward to move between in the first place.

You can drop any of these without dropping the others. Dropping (1) is free. The question is
really about (2), (3), and (4).

### 9.3 What is genuinely lost

**Rename safety.** The largest real loss. `[[Project System]]` resolves by note name, and Obsidian
rewrites every reference when a file is renamed. With plain relative links, a rename silently
breaks every inbound link. 69 wikilinks across 28 files depend on this today.

This one converts into a *gain*, though: a build-time link checker that fails CI on an unresolved
link is strictly stronger than what exists now. `[[Outbound SOP]]` is already broken in the vault
and nothing catches it.

**Transclusion / single-sourcing.** 26 embeds, of which roughly 23 inline glossary definitions and
member bios into other pages — the Constitution shows the definition of "Senate" inline rather than
linking out. Drop transclusion and you either duplicate that prose (and let it drift) or convert
the embeds to links (and change the reading experience). Keeping it in our own renderer is a small
remark plugin, so this is cheap to preserve if we want it.

**Alias redirects.** 20 files declare `aliases:`, and Quartz emits redirect pages for each. Drop
them without a replacement redirect map and those URLs 404.

**Auto-generated tag and folder pages.** Part of why Quartz emits 117 pages from 72 files. 53 files
carry tags across 15 distinct tag values. Those index URLs die unless rebuilt or redirected.

**Backlinks.** The "what links here" panel. Nearly free to keep, since the link checker needs the
same link graph anyway.

**Graph view.** Genuinely lost unless rebuilt. On a 72-page corpus with 69 links it's decorative —
recommend dropping it and not looking back.

**Hover popovers.** Nice; reimplementable later against the search index.

**Full-text search and RSS.** Quartz gives both free. Search becomes a gain, since replacing it
unifies documentation with `GlobalSearch`. RSS would need a subscriber check before dropping — the
app's `next-sitemap` already covers the sitemap half.

**Somewhere to keep unpublished material.** The repo's README describes it as holding
"documentation, planning, project notes, and other reference material", and `MoonDAO/media-files/`
holds **59 MB** of research PDFs and images outside the published `docs/` tree (`docs/_media-files/`
is only 1.1 MB). That 59 MB should not follow the docs into the app repo. It needs a destination
before the vault repo is retired. The six files in `MoonDAO/templates/` are Obsidian authoring
templates, already excluded from the build by `ignorePatterns`, and can simply be dropped.

**Blast-radius separation.** Today a bad doc PR cannot break the app build and vice versa. Merged,
a documentation typo runs the app's full CI and a broken app build blocks documentation publishing.
Mitigate with path-filtered CI.

### 9.4 What is gained

**The Quartz upgrade tax goes away, and it is not hypothetical.** In June 2026 the docs site build
broke because the workflow tracked Quartz's moving `v5` branch, and it took two emergency commits
to repair:

> `fix: pin Quartz checkout to v5.0.0 to restore broken build` — *"The upstream jackyzha0/quartz v5
> branch introduced a breaking change in Head.tsx that imports from '../../.quartz/plugins', a path
> that does not exist in MoonDAO's site config."*

That fix is also still incomplete. The workflow pins the *checkout* to `v5.0.0` but then runs
`npm i jackyzha0/quartz`, which installs from the default branch — so the build retains a floating
upstream dependency and can break again the same way.

**The cross-repo deploy hook disappears.** §5 Option 2's one genuinely new piece of plumbing — a
Vercel Deploy Hook fired from the documentation repo's workflow — is unnecessary if the content
lives in this repo. That was the main operational risk in the original recommendation, and this
decision removes it.

Beyond that: one CI system instead of two, one host, one analytics tag, one place to look, and doc
changes that ship atomically with the code they describe.

### 9.5 Revised recommendation

Adopt **§5 Option 3** (content in the monorepo) rather than Option 2, and **normalize the Obsidian
dialect away during migration** instead of supporting it indefinitely.

Concretely, the conversion is a single scripted pass over 72 files:

| Construct | Count | Treatment |
|---|---|---|
| Wikilinks | 69 | Convert to relative markdown links, mechanically, once. Add a CI link checker. |
| Transclusions | 26 | Keep the remark plugin (~23 are glossary/bio single-sourcing), or convert to links — a product call, not a technical one. |
| Callouts | 4 | Convert to GFM alerts by hand. |
| `dataview` block | 1 | Generate the glossary table in `loadDocs.ts` from the folder. |
| `aliases:` | 20 files | Emit a redirect map in `next.config.js`. |
| `slug:` overrides | 13 files | Honour in the slugifier, as already planned. |
| Tag pages | 15 tags | Rebuild or redirect — decide before cutover. |

Everything else in the phased plan (§7) stands, with these adjustments:

- **Phase 1** loses `scripts/fetch-docs.mjs` and gains a one-time `scripts/migrate-vault.mjs` that
  performs the conversion above and writes into `ui/content/docs/`. Preserve history with
  `git subtree` or a filtered import so authorship survives.
- **Phase 3** loses the deploy-hook step entirely.
- **Phase 5** becomes: move the 59 MB of unpublished `media-files/` somewhere durable, then point
  `docs.moondao.com` at 301s and archive the vault repo.
- The slug-parity test against the live `contentIndex.json` becomes *more* important, not less,
  since it will be the only remaining check that the migration preserved every public URL. Capture
  a copy of that file before the Quartz site is retired.
