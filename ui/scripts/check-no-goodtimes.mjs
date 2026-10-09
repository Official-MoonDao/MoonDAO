import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skipDirs = new Set(['node_modules', '.next', 'archive'])
const textNeedles = ['GoodTimes', 'Good Times', 'goodtimesrg']
const textExt = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.md', '.mjs'])
const hits = []

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skipDirs.has(name)) continue
    const full = path.join(dir, name)
    if (name === 'check-no-goodtimes.mjs') continue
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walk(full)
      continue
    }
    if (/goodtimes/i.test(name)) hits.push(full)
    if (!textExt.has(path.extname(name))) continue
    const text = readFileSync(full, 'utf8')
    for (const needle of textNeedles) {
      if (text.includes(needle)) {
        hits.push(`${full} contains ${JSON.stringify(needle)}`)
        break
      }
    }
  }
}

walk(root)

if (hits.length) {
  console.error('Good Times is not allowed in ui/ (archive/ is ignored):')
  for (const hit of hits) console.error(`  ${hit}`)
  process.exit(1)
}
