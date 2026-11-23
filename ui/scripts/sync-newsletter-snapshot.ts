/// <reference types="node" />
import fs from 'fs'
import path from 'path'
import { fetchNewsletterPosts } from '../lib/updates/newsletter'

const SNAPSHOT_PATH = path.join(__dirname, '..', 'lib', 'updates', 'newsletterSnapshot.json')

async function main() {
  const posts = await fetchNewsletterPosts()
  fs.writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(posts, null, 2)}\n`)
  console.log(
    `Wrote ${posts.length} newsletter issues to ${path.relative(process.cwd(), SNAPSHOT_PATH)}`
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
