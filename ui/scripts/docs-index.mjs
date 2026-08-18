/**
 * Standalone search-index builder (no ts-node required).
 * Prefer `yarn docs:index` once dependencies are installed.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', 'content', 'docs')
const DEST = path.join(__dirname, '..', 'public', 'docs-search-index.json')

function walk(dir, root, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, root, acc)
    else if (entry.isFile() && entry.name.endsWith('.md')) {
      const rel = path.relative(root, full).replace(/\\/g, '/')
      if (rel !== 'README.md') acc.push(full)
    }
  }
  return acc
}

function parse(raw) {
  let body = raw
  let title = ''
  let description = ''
  if (raw.startsWith('---')) {
    const end = raw.indexOf('\n---', 3)
    if (end !== -1) {
      const yaml = raw.slice(4, end)
      body = raw.slice(end + 4)
      const t = yaml.match(/^title:\s*(.+)$/m)
      const d = yaml.match(/^description:\s*(.+)$/m)
      if (t) title = t[1].trim()
      if (d) description = d[1].trim()
    }
  }
  if (!title) {
    const h = body.match(/^#\s+(.+)$/m)
    title = h ? h[1].replace(/\*+/g, '').trim() : path.basename(raw, '.md')
  }
  return { title, description, body }
}

function slugify(rel) {
  return rel.replace(/\\/g, '/').replace(/\.md$/i, '').split('/').map((s) => s.replace(/ /g, '-')).join('/')
}

const files = walk(ROOT, ROOT)
const index = files.map((full) => {
  const rel = path.relative(ROOT, full).replace(/\\/g, '/')
  const raw = fs.readFileSync(full, 'utf8')
  const { title, description, body } = parse(raw)
  const headings = [...body.matchAll(/^#{1,3}\s+(.+)$/gm)].map((m) => m[1].replace(/[*_`]/g, '').trim())
  const plain = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*_`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const slug = slugify(rel)
  return {
    title: title || slug,
    slug,
    href: slug === 'index' ? '/docs' : `/docs/${slug}`,
    description: description || plain.slice(0, 180),
    headings,
    body: plain.slice(0, 4000),
    category: slug.split('/')[0] || 'Docs',
  }
})

fs.mkdirSync(path.dirname(DEST), { recursive: true })
fs.writeFileSync(DEST, JSON.stringify(index))
console.log(`Wrote ${index.length} search entries to ${DEST}`)
