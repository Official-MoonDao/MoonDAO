/**
 * One-time import of Official-MoonDao/documentation into ui/content/docs.
 * Standalone so it can run before `yarn install`.
 *
 *   node scripts/migrate-vault.mjs [vaultDocsDir]
 */
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UI_ROOT = path.join(__dirname, '..')
const DEST = path.join(UI_ROOT, 'content', 'docs')
const MEDIA_DEST = path.join(UI_ROOT, 'public', 'docs-media')
const FIXTURE_DEST = path.join(UI_ROOT, 'lib', 'docs', 'fixtures', 'contentIndex.json')
const DEFAULT_VAULT = '/tmp/docsrepo/MoonDAO/docs'
const DEFAULT_REPO = '/tmp/docsrepo'

function slugifyFilePath(filePath) {
  return filePath
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\.md$/i, '')
    .split('/')
    .filter(Boolean)
    .map((s) => s.replace(/ /g, '-'))
    .join('/')
}

function unquote(value) {
  const t = value.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1)
  }
  return t
}

function parseFrontmatter(raw) {
  const empty = { title: '', aliases: [], slug: '', sidebar_label: '' }
  if (!raw.startsWith('---')) return { frontmatter: empty, body: raw, fmBlock: '' }
  const end = raw.indexOf('\n---', 3)
  if (end === -1) return { frontmatter: empty, body: raw, fmBlock: '' }
  const yaml = raw.slice(4, end)
  const body = raw.slice(end + 4).replace(/^\n/, '')
  const data = { ...empty, aliases: [] }
  let currentKey = null
  for (const line of yaml.split('\n')) {
    const listItem = line.match(/^\s+-\s+(.*)$/)
    if (listItem && currentKey === 'aliases') {
      data.aliases.push(unquote(listItem[1]))
      continue
    }
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!kv) continue
    currentKey = kv[1]
    if (kv[1] === 'title' || kv[1] === 'slug' || kv[1] === 'sidebar_label') {
      data[kv[1]] = unquote(kv[2])
    }
  }
  return { frontmatter: data, body, fmBlock: raw.slice(0, end + 4) }
}

function walk(dir, root, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, root, acc)
    else if (entry.isFile() && entry.name.endsWith('.md')) {
      acc.push(path.relative(root, full).replace(/\\/g, '/'))
    }
  }
  return acc
}

function ensureVault(explicit) {
  if (explicit && fs.existsSync(explicit)) {
    const repo = explicit.replace(/\/MoonDAO\/docs\/?$/, '')
    let commit = 'unknown'
    try {
      commit = execSync('git rev-parse HEAD', { cwd: repo }).toString().trim()
    } catch {
      /* ignore */
    }
    return { docsDir: explicit, commit }
  }
  if (!fs.existsSync(DEFAULT_VAULT)) {
    console.log('Cloning Official-MoonDao/documentation into /tmp/docsrepo …')
    execSync('gh repo clone Official-MoonDao/documentation /tmp/docsrepo -- --depth=1', {
      stdio: 'inherit',
    })
  }
  const commit = execSync('git rev-parse HEAD', { cwd: DEFAULT_REPO }).toString().trim()
  return { docsDir: DEFAULT_VAULT, commit }
}

function buildResolver(docsDir) {
  const nameToSlug = new Map()
  const remember = (name, slug) => {
    const key = (name || '').trim().toLowerCase()
    if (key && !nameToSlug.has(key)) nameToSlug.set(key, slug)
  }
  for (const rel of walk(docsDir, docsDir)) {
    const raw = fs.readFileSync(path.join(docsDir, rel), 'utf8')
    const { frontmatter } = parseFrontmatter(raw)
    const slug = slugifyFilePath(rel)
    const note = path.basename(rel, '.md')
    remember(note, slug)
    remember(frontmatter.title, slug)
    remember(frontmatter.sidebar_label, slug)
    remember(slug, slug)
    remember(slug.split('/').pop(), slug)
    for (const alias of frontmatter.aliases) remember(alias, slug)
    if (frontmatter.slug) remember(frontmatter.slug.replace(/^\/+|\/+$/g, ''), slug)
  }
  return (name) => nameToSlug.get((name || '').trim().toLowerCase())
}

function slugifyHeading(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
}

function rewriteDocBody(body, resolve, report) {
  let next = body.replace(/%%[\s\S]*?%%/g, '').replace(/https?:\/\/docs\.moondao\.com\/?/gi, '/docs/')

  next = next.replace(/^> ?\[!([A-Za-z-]+)\][^\n]*\n((?:>.*\n?)*)/gm, (_full, kind, rest) => {
    const text = rest
      .split('\n')
      .map((line) => line.replace(/^>\s?/, ''))
      .join('\n')
      .trim()
    return `<div class="docs-callout docs-callout-${kind.toLowerCase()}">\n\n**${kind}:** ${text}\n\n</div>\n`
  })

  next = next.replace(/(!?)\[\[([^[\]]+)\]\]/g, (full, bang, inner) => {
    let rest = inner.trim()
    let label = ''
    const pipe = rest.indexOf('|')
    if (pipe !== -1) {
      label = rest.slice(pipe + 1).trim()
      rest = rest.slice(0, pipe).trim()
    }
    let heading = ''
    const hash = rest.indexOf('#')
    if (hash !== -1) {
      heading = rest.slice(hash + 1).trim()
      rest = rest.slice(0, hash).trim()
    }
    const display = label || rest || heading
    if (bang === '!') {
      if (rest.startsWith('http')) {
        report.convertedImages += 1
        return `![](${rest})`
      }
      if (/\.(png|jpe?g|gif|svg|webp|avif)$/i.test(rest)) {
        report.convertedImages += 1
        return `![](/docs-media/${rest.split('/').pop()})`
      }
      return full
    }
    if (!rest && heading) {
      report.convertedWikilinks += 1
      return `[${display}](#${slugifyHeading(heading)})`
    }
    const slug = resolve(rest)
    if (!slug) {
      report.unresolvedWikilinks.push(rest || full)
      return display
    }
    report.convertedWikilinks += 1
    const href = heading ? `/docs/${slug}#${slugifyHeading(heading)}` : `/docs/${slug}`
    return `[${display}](${href})`
  })

  next = next.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (full, alt, url) => {
    const trimmed = url.trim()
    if (trimmed.startsWith('http') || trimmed.startsWith('/')) return full
    if (!/\.(png|jpe?g|gif|svg|webp|avif)$/i.test(trimmed)) return full
    report.convertedImages += 1
    return `![${alt}](/docs-media/${trimmed.split('/').pop()})`
  })

  next = next.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (full, text, url) => {
    if (full.startsWith('![')) return full
    let decoded = url.trim()
    try {
      decoded = decodeURIComponent(decoded)
    } catch {
      /* keep */
    }
    if (decoded.startsWith('http') || decoded.startsWith('/') || decoded.startsWith('#')) return full
    const file = decoded.replace(/^\.\//, '').split('#')[0]
    if (!file.toLowerCase().endsWith('.md')) return full
    const name = path.basename(file, '.md')
    const slug = resolve(name)
    if (!slug) return full
    report.convertedMdLinks += 1
    const heading = decoded.includes('#') ? decoded.split('#')[1] : ''
    const href = heading ? `/docs/${slug}#${heading}` : `/docs/${slug}`
    return `[${text}](${href})`
  })

  return next
}

const { docsDir, commit } = ensureVault(process.argv[2])
console.log(`Vault: ${docsDir} @ ${commit}`)
const resolve = buildResolver(docsDir)
const report = { unresolvedWikilinks: [], convertedWikilinks: 0, convertedMdLinks: 0, convertedImages: 0 }

fs.rmSync(DEST, { recursive: true, force: true })
fs.mkdirSync(DEST, { recursive: true })

const rels = walk(docsDir, docsDir)
for (const rel of rels) {
  const raw = fs.readFileSync(path.join(docsDir, rel), 'utf8')
  const { body, fmBlock } = parseFrontmatter(raw)
  let nextBody = body.replace(/```dataview[\s\S]*?```/g, '<!-- docs-glossary-table -->')
  nextBody = rewriteDocBody(nextBody, resolve, report)
  const out = fmBlock ? `${fmBlock}\n${nextBody.replace(/^\n/, '')}\n` : `${nextBody}\n`
  const destFile = path.join(DEST, rel)
  fs.mkdirSync(path.dirname(destFile), { recursive: true })
  fs.writeFileSync(destFile, out)
}

fs.mkdirSync(MEDIA_DEST, { recursive: true })
const mediaSrc = path.join(docsDir, '_media-files')
if (fs.existsSync(mediaSrc)) {
  for (const file of fs.readdirSync(mediaSrc)) {
    const from = path.join(mediaSrc, file)
    if (fs.statSync(from).isFile()) fs.copyFileSync(from, path.join(MEDIA_DEST, file))
  }
}

const source = {
  repo: 'Official-MoonDao/documentation',
  commit,
  importedAt: new Date().toISOString(),
  fileCount: rels.length,
  rewrite: report,
  note: 'One-time import. Unpublished MoonDAO/media-files (~59MB of research PDFs) was not imported. See docs/DOCUMENTATION_EMBEDDING_VERIFICATION.md.',
}
fs.writeFileSync(path.join(DEST, 'SOURCE.json'), JSON.stringify(source, null, 2) + '\n')
fs.writeFileSync(
  path.join(DEST, 'README.md'),
  [
    '# MoonDAO documentation (native)',
    '',
    'Markdown imported from `Official-MoonDao/documentation` (`MoonDAO/docs`).',
    'Edit these files and open a PR against this repo — there is no separate',
    'Obsidian/Quartz publishing step.',
    '',
    'Wikilinks (`[[Note]]`) still resolve at render time as a safety net, but',
    'prefer standard markdown links to `/docs/<slug>`.',
    '',
    `Imported from commit \`${commit}\`. See \`SOURCE.json\` and`,
    '`docs/DOCUMENTATION_EMBEDDING_VERIFICATION.md` in the repo root.',
    '',
  ].join('\n')
)

console.log(`Wrote ${rels.length} markdown files to ${DEST}`)
console.log(
  `Converted wikilinks=${report.convertedWikilinks} mdLinks=${report.convertedMdLinks} images=${report.convertedImages}`
)
console.log(`Unresolved wikilinks (${report.unresolvedWikilinks.length}):`)
for (const target of [...new Set(report.unresolvedWikilinks)].sort()) {
  console.log(`  - ${target}`)
}

fs.mkdirSync(path.dirname(FIXTURE_DEST), { recursive: true })
if (fs.existsSync('/tmp/contentIndex.json')) {
  fs.copyFileSync('/tmp/contentIndex.json', FIXTURE_DEST)
  console.log(`Copied fixture from /tmp/contentIndex.json`)
} else {
  const res = await fetch('https://docs.moondao.com/static/contentIndex.json')
  const json = await res.text()
  fs.writeFileSync(FIXTURE_DEST, json)
  console.log(`Wrote fixture ${FIXTURE_DEST} (${json.length} bytes)`)
}
