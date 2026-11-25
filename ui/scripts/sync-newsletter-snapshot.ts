/// <reference types="node" />

/**
 * Refreshes the committed newsletter archive:
 *   - lib/updates/newsletterSnapshot.json, the list of public issues
 *   - content/newsletter/<slug>.md, each issue's body as Updates markdown
 *
 * Bodies need CONVERT_KIT_V4_API_KEY (read from .env.local when present).
 * A body file that starts with the EDITED_MARKER line is kept as it is.
 */
import fs from 'fs'
import path from 'path'
import {
  fetchKitBroadcasts,
  fetchNewsletterPosts,
  kitApiKey,
  slugFromPublicUrl,
} from '../lib/updates/newsletter'
import {
  NEWSLETTER_ROOT,
  broadcastToMarkdown,
  isHandEdited,
  listNewsletterBodySlugs,
  newsletterBodyPath,
} from '../lib/updates/newsletterIssues'

const SNAPSHOT_PATH = path.join(__dirname, '..', 'lib', 'updates', 'newsletterSnapshot.json')

function loadEnvLocal() {
  const file = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
    }
  }
}

async function main() {
  loadEnvLocal()
  const posts = await fetchNewsletterPosts()
  fs.writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(posts, null, 2)}\n`)
  console.log(
    `Wrote ${posts.length} newsletter issues to ${path.relative(process.cwd(), SNAPSHOT_PATH)}`
  )

  const apiKey = kitApiKey()
  if (!apiKey) {
    console.warn('CONVERT_KIT_V4_API_KEY is not set, so issue bodies were not synced.')
    return
  }

  const broadcasts = await fetchKitBroadcasts(apiKey)
  const byId = new Map(broadcasts.map((b) => [b.id, b]))
  const bySlug = new Map(
    broadcasts.map((b) => [slugFromPublicUrl(b.publicUrl), b] as const).filter(([slug]) => slug)
  )

  fs.mkdirSync(NEWSLETTER_ROOT, { recursive: true })
  let written = 0
  let kept = 0
  const missing: string[] = []
  for (const post of posts) {
    if (isHandEdited(post.slug)) {
      kept++
      continue
    }
    const broadcast = (post.kitId && byId.get(post.kitId)) || bySlug.get(post.slug)
    const markdown = broadcast?.public ? broadcastToMarkdown(broadcast, post) : ''
    if (!markdown.trim()) {
      missing.push(post.slug)
      continue
    }
    fs.writeFileSync(newsletterBodyPath(post.slug), markdown)
    written++
  }

  // An issue that is no longer public loses its page.
  const live = new Set(posts.map((post) => post.slug))
  let removed = 0
  for (const slug of Array.from(listNewsletterBodySlugs())) {
    if (!live.has(slug) && !isHandEdited(slug)) {
      fs.unlinkSync(newsletterBodyPath(slug))
      removed++
    }
  }

  console.log(
    `Wrote ${written} issue bodies to ${path.relative(process.cwd(), NEWSLETTER_ROOT)}` +
      (kept ? `, kept ${kept} edited by hand` : '') +
      (removed ? `, removed ${removed} no longer public` : '')
  )
  if (missing.length) {
    console.warn(`No body for ${missing.length} issues, which link to Kit: ${missing.join(', ')}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
