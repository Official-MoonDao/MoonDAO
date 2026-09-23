/**
 * Prints the native docs corpus: pages, aliases, unresolved wikilinks, and
 * slug-parity vs the captured Quartz contentIndex.
 *
 *   yarn docs:check
 */
import fs from 'fs'
import path from 'path'
import {
  allProducedSlugs,
  getAliasTable,
  listBrokenDocsHrefs,
  listUnresolvedMdLinks,
  listUnresolvedWikilinks,
  loadCorpus,
  resetDocsCache,
} from '../lib/docs/loadDocs'
import { INTENTIONAL_SLUG_CHANGES, isRouteSafeSlug } from '../lib/docs/slug'

const FIXTURE = path.join(__dirname, '..', 'lib', 'docs', 'fixtures', 'contentIndex.json')

function loadFixtureKeys(): string[] {
  if (!fs.existsSync(FIXTURE)) {
    console.warn(`Missing fixture ${FIXTURE}`)
    return []
  }
  const data = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Record<string, unknown>
  return Object.keys(data).sort()
}

function main() {
  resetDocsCache()
  const corpus = loadCorpus()
  const produced = new Set(allProducedSlugs())
  const fixture = loadFixtureKeys()

  console.log(`# Native docs corpus`)
  console.log(`files: ${corpus.files.length}`)
  console.log(`produced slugs: ${produced.size}`)
  console.log(`quartz fixture slugs: ${fixture.length}`)
  console.log('')

  console.log('## Pages')
  for (const file of [...corpus.files].sort((a, b) => a.slug.localeCompare(b.slug))) {
    console.log(`- ${file.slug}  ←  ${file.filePath}`)
  }

  console.log('\n## Aliases / slug overrides')
  for (const row of getAliasTable()) {
    console.log(`- ${row.slug}: ${row.aliases.join(', ')}`)
  }

  const unresolved = listUnresolvedWikilinks()
  console.log(`\n## Unresolved wikilinks (${unresolved.length})`)
  for (const item of unresolved) {
    console.log(`- ${item.filePath}: [[${item.target}]]`)
  }

  const unresolvedMd: { filePath: string; target: string }[] = listUnresolvedMdLinks()
  console.log(`\n## Unresolved relative .md links (${unresolvedMd.length})`)
  for (const item of unresolvedMd) {
    console.log(`- ${item.filePath}: ${item.target}`)
  }

  const broken = listBrokenDocsHrefs()
  console.log(`\n## Broken internal /docs hrefs (${broken.length})`)
  for (const item of broken) {
    console.log(`- ${item.filePath}: ${item.href}`)
  }

  const unsafe = [...produced].filter((slug) => !isRouteSafeSlug(slug))
  console.log(`\n## Route-unsafe slugs (${unsafe.length})`)
  for (const slug of unsafe) {
    console.log(`- ${slug}`)
  }

  const missing = fixture.filter((k) => !produced.has(k))
  const extra = [...produced].filter((k) => !fixture.includes(k))
  const unexpectedMissing = missing.filter((k) => !(k in INTENTIONAL_SLUG_CHANGES))

  console.log(`\n## Slug parity vs Quartz contentIndex`)
  console.log(`missing from native (in Quartz, not produced): ${missing.length}`)
  for (const k of missing) {
    const replacement = INTENTIONAL_SLUG_CHANGES[k]
    console.log(`  - ${k}${replacement ? `  (intentional → ${replacement})` : '  ** UNEXPECTED **'}`)
  }
  console.log(`extra in native (not in Quartz fixture): ${extra.length}`)
  for (const k of extra) console.log(`  - ${k}`)

  if (unexpectedMissing.length > 0 || broken.length > 0 || unsafe.length > 0) {
    process.exitCode = 1
  }
}

main()
