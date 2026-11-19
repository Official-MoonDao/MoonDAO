# MoonDAO Updates

Announcements, mission updates, press releases, and long-form essays. Publishing is a pull request.

## Add an update

1. Copy `_template.md` to `YYYY-MM-DD-my-title.md` in this folder.
2. Fill in the frontmatter. Write the body in markdown.
3. Drop images in `ui/public/assets/updates/`. Hero images should be 16:9 (1280×720 or larger) and under ~300KB.
4. Open a PR. The Vercel preview deploy is the draft preview.
5. Merge. It is live on the next production deploy.

Files that start with `_` and `README.md` are ignored by the loader, so `_template.md` never publishes.

## Newsletter issues

`/updates` and `/news` show the same list: the posts in this folder plus every public issue of the newsletter at [news.moondao.com](https://news.moondao.com). A production build uses the saved snapshot, and the live archive is read again at most once an hour, so a new send appears without another deploy. Issues open at news.moondao.com and are labelled `Newsletter`; nothing needs to be added here for them.

If the archive is unreachable, the pages fall back to `ui/lib/updates/newsletterSnapshot.json`. Refresh it with `yarn sync:newsletter` from `ui/` and commit the result. Newsletter issues are deliberately not in the RSS feed, because Kit reads that feed to send the newsletter and would send issues back out.

## Frontmatter

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Also used as the Open Graph title. |
| `description` | yes | Dek on the index and `og:description`. Keep under 160 characters. |
| `date` | yes | `YYYY-MM-DD`. Sort key and `article:published_time`. |
| `author` | yes | Free text. |
| `category` | no | Label shown above the title. Defaults to `Update`. Use whatever fits: `Update`, `Press Release`, `Essay`, `Mission Report`. |
| `authorRole` | no | Shown next to the author. |
| `image` | no | Hero and OG image, e.g. `/assets/updates/my-post.jpg`. Falls back to `/assets/MoonDAO-OG.png`. |
| `imageAlt` | no | Alt text for the hero image. |
| `imageCaption` | no | Caption shown under the hero image. |
| `tags` | no | Labels only. No archive pages yet. |
| `featured` | no | At most one featured item; the newest wins. |
| `draft` | no | Hidden on the production deploy (`VERCEL_ENV=production`). Visible locally and on preview deploys. |

`category` is free text and nothing branches on it, so one feed can carry a terse
press release and a 40-minute essay without needing separate sections.

The date prefix in the filename is stripped from the URL. `2023-09-12-the-master-plan.md`
is served at `/updates/the-master-plan`.

## Callouts, figures and charts

Standard GFM covers most posts. Long-form posts can also use:

- `> A single line` renders as a large pull quote.
- `<aside data-title="Key takeaways">` … `</aside>` renders a highlighted box. Leave a blank line after the opening tag and before the closing tag so the markdown inside is parsed.
- `<details><summary>Title</summary>` … `</details>` renders a collapsible section, with the same blank-line rule. Text inside collapsed sections does not count toward the reading time.
- Posts with three or more `##` headings get an "On this page" sidebar on wide screens.

Data figures are fenced code blocks holding one JSON object. Each renders server-side as SVG or HTML in the post's style, and each takes optional `figure` (e.g. `"Figure 1"`), `title`, `subtitle` and `source` text. A block whose JSON does not parse or does not match its shape falls back to a plain code block, so check the preview.

| Fence | What it draws | Required fields |
|---|---|---|
| ` ```stats ` | A strip of headline numbers | `items: [{ value, label }]` |
| ` ```chart ` with `"type": "dots"` | One row per category, one dot per series, optional marker tick | `series: [{ name, color? }]`, `rows: [{ label, values: number[], marker? }]` |
| ` ```chart ` with `"type": "scatter"` | Labelled points, optional least-squares `trend` | `x` and `y` as `{ label, min, max }`, `points: [{ label, x, y, color?, anchor? }]` |
| ` ```chart ` with `"type": "bars"` | Horizontal bars, one panel per measure | `rows: [{ label, color? }]`, `panels: [{ name, values: number[] }]` |
| ` ```chart ` with `"type": "line"` | Lines over a numbered x axis, optional shaded `bands` | `x: { count, label? }`, `y: { min, max }`, `series: [{ name, values: number[], color?, dashed? }]` |
| ` ```chart ` with `"type": "stack"` | 100% stacked bars | `segments: [{ name, color? }]`, `rows: [{ label, values: number[] }]` |
| ` ```heatmap ` | A diverging grid (green positive, red negative) | `columns: string[]`, `rows: [{ label, cells: [{ value, note?, mark? }] }]`, optional `shortColumns` for phones |
| ` ```ledger ` | Blocks in order per row, sized by value, with empty slots up to `max` | `rows: [{ label, trades: [{ outcome, size, color? }] }]` |
| ` ```screens ` | Product screenshots in a browser frame, each linking to the live page; stacked, or side by side with `"columns": 2` | `items: [{ src, alt, url?, href?, caption? }]` |
| ` ```cta ` | A call-to-action card with buttons and an optional image; takes no `figure` text | `title`, `actions: [{ label, href, primary? }]`, optional `eyebrow`, `body`, `points: string[]`, `image: { src, alt }`, `note` |

Capture screenshots from production at 2× scale, crop to what the reader needs, and save them as JPEG under `public/assets/updates/<post>/`. Date the screenshot in `source`, since live numbers change.

`2026-11-17-ai-forecasters-first-bets-on-touchdown.md` uses every type.
