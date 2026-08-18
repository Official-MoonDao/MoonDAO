/**
 * Emit public/docs-search-index.json from ui/content/docs.
 * Invoked as `prebuild` so `next build` always has a fresh index.
 */
import fs from 'fs'
import path from 'path'
import { resetDocsCache } from '../lib/docs/loadDocs'
import { buildSearchIndex } from '../lib/docs/searchIndex'

const DEST = path.join(__dirname, '..', 'public', 'docs-search-index.json')

function main() {
  resetDocsCache()
  const index = buildSearchIndex()
  fs.mkdirSync(path.dirname(DEST), { recursive: true })
  fs.writeFileSync(DEST, JSON.stringify(index))
  console.log(`Wrote ${index.length} search entries to ${DEST}`)
}

main()
