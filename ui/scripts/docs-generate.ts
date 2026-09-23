/**
 * Regenerate the committed docs artifacts:
 *   public/doc-search-index.json  — client-side search corpus
 *   lib/docs/generated/navTree.json — sidebar tree, imported as a module
 *
 *   yarn docs:generate
 *
 * These are committed rather than produced by a `prebuild` hook so that
 * `next build` needs no ts-node, and `next dev` (which skips prebuild) behaves
 * identically. `yarn test:docs` fails if either drifts from content/docs.
 */
import fs from 'fs'
import path from 'path'
import { buildNavTree, loadCorpus, resetDocsCache } from '../lib/docs/loadDocs'
import { buildSearchIndex } from '../lib/docs/searchIndex'

const SEARCH_INDEX = path.join(__dirname, '..', 'public', 'doc-search-index.json')
const NAV_TREE = path.join(__dirname, '..', 'lib', 'docs', 'generated', 'navTree.json')

function write(dest: string, data: unknown) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, JSON.stringify(data))
  return fs.statSync(dest).size
}

function main() {
  resetDocsCache()
  const corpus = loadCorpus()

  const indexBytes = write(SEARCH_INDEX, buildSearchIndex())
  const treeBytes = write(NAV_TREE, buildNavTree())

  console.log(`${corpus.files.length} docs pages`)
  console.log(`search index: ${SEARCH_INDEX} (${indexBytes} bytes)`)
  console.log(`nav tree:     ${NAV_TREE} (${treeBytes} bytes)`)
}

main()
