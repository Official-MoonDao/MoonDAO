# MoonDAO Updates

Announcements, mission updates, press releases, and long-form essays. Publishing is a pull request.

## Add an update

1. Copy `_template.md` to `YYYY-MM-DD-my-title.md` in this folder.
2. Fill in the frontmatter. Write the body in markdown.
3. Drop images in `ui/public/assets/updates/`. Hero images should be 1200×630 and under ~300KB.
4. Open a PR. The Vercel preview deploy is the draft preview.
5. Merge. It is live on the next production deploy.

Files that start with `_` and `README.md` are ignored by the loader, so `_template.md` never publishes.

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
| `tags` | no | Labels only. No archive pages yet. |
| `featured` | no | At most one featured item; the newest wins. |
| `draft` | no | Hidden on the production deploy (`VERCEL_ENV=production`). Visible locally and on preview deploys. |

`category` is free text and nothing branches on it, so one feed can carry a terse
press release and a 40-minute essay without needing separate sections.

The date prefix in the filename is stripped from the URL. `2023-09-12-the-master-plan.md`
is served at `/updates/the-master-plan`.
