import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const REPO_ROOT = path.resolve(__dirname, '../../../../../')
const DOCS_DIR = path.join(REPO_ROOT, 'docs')
const UI_DIR = path.join(REPO_ROOT, 'ui')

// Built from parts so this file itself is not a gate-1 hit.
const NDA_NEEDLE_A = ['DEPRIZE', 'NIGHT', 'SHIFT'].join('_')
const NDA_NEEDLE_B = ['night', 'shift', 'brief'].join('-')
const NDA_RE = new RegExp(`${NDA_NEEDLE_A}|${NDA_NEEDLE_B}`)
const FREEZE_ANCHOR = '<!-- deprize:freeze-table -->'
const LIFECYCLE_RE = /prepareCondition|`open`|open|never|always/
const TBD_OWNER_RE = /Owner:\s*\*?(TBD|TBA|team)\b/i
const MD_LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g
const FORBIDDEN_HREF_RE =
  /\.local\.md|DEPRIZE_GTM_SURVIVE_THE_NIGHT\.md|DEPRIZE_GTM_SIX_SECONDS_LATE\.md/

const A_PRIME_DOCS = [
  'DEPRIZE_TOUCHDOWN.md',
  'DEPRIZE_CAPABILITY_LADDER.md',
  'DEPRIZE_GTM_TOUCHDOWN.md',
]

const A_PRIME_ALLOWLIST = [
  'docs/DEPRIZE_TOUCHDOWN.md',
  'docs/DEPRIZE_CAPABILITY_LADDER.md',
  'docs/DEPRIZE_GTM_TOUCHDOWN.md',
  'ui/cypress/integration/lib/deprize/docsHygiene.cy.ts',
]

const SKIP_DIR = new Set(['node_modules', '.next', 'archive', 'public', '.git'])

function walkFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(entry.name)) continue
    if (entry.name === 'docsHygiene.cy.ts') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkFiles(full, acc)
    else acc.push(full)
  }
  return acc
}

function ndaHitsViaWalk(): { file: string; line: number; text: string }[] {
  const hits: { file: string; line: number; text: string }[] = []
  for (const file of [...walkFiles(DOCS_DIR), ...walkFiles(UI_DIR)]) {
    let text: string
    try {
      text = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const lines = text.split(/\r?\n/)
    lines.forEach((line, i) => {
      if (NDA_RE.test(line)) {
        hits.push({
          file: path.relative(REPO_ROOT, file),
          line: i + 1,
          text: line.slice(0, 200),
        })
      }
    })
  }
  return hits
}

function ndaHits(): { file: string; line: number; text: string }[] {
  try {
    const out = execSync(
      `rg -n -g '!node_modules/**' -g '!.next/**' -g '!archive/**' '${NDA_NEEDLE_A}|${NDA_NEEDLE_B}' docs ui`,
      { cwd: REPO_ROOT, encoding: 'utf8' }
    )
    return out
      .split('\n')
      .filter(Boolean)
      .map((row) => {
        const match = row.match(/^(.*?):(\d+):(.*)$/)
        if (!match) return { file: row, line: 0, text: row }
        return { file: match[1], line: Number(match[2]), text: match[3].slice(0, 200) }
      })
  } catch (err: any) {
    if (err?.status === 1) return []
    return ndaHitsViaWalk()
  }
}

function relativeMarkdownTargets(markdown: string, fromFile: string): string[] {
  const targets: string[] = []
  let match: RegExpExecArray | null
  const re = new RegExp(MD_LINK_RE.source, 'g')
  while ((match = re.exec(markdown))) {
    const href = match[1].split(/[?#]/)[0].trim()
    if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) {
      continue
    }
    if (!href.endsWith('.md')) continue
    targets.push(path.normalize(path.join(path.dirname(fromFile), href)))
  }
  return targets
}

describe('A′ docs hygiene', () => {
  it('gate 1 — no withdrawn chamber-spec filenames under docs/ or ui/', () => {
    const hits = ndaHits()
    expect(hits, JSON.stringify(hits, null, 2)).to.deep.equal([])
  })

  it('gate 2 — A′ files have a freeze table, resolvable md links, and no TBD owners', () => {
    for (const name of A_PRIME_DOCS) {
      const file = path.join(DOCS_DIR, name)
      expect(fs.existsSync(file), name).to.equal(true)
      const text = fs.readFileSync(file, 'utf8')
      expect(text.includes(FREEZE_ANCHOR), `${name} missing freeze-table`).to.equal(true)
      expect(LIFECYCLE_RE.test(text), `${name} freeze table lacks a lifecycle event`).to.equal(
        true
      )
      expect(TBD_OWNER_RE.test(text), `${name} still has Owner: TBD/TBA/team`).to.equal(false)
      expect(FORBIDDEN_HREF_RE.test(text), `${name} links a forbidden target`).to.equal(false)
      for (const target of relativeMarkdownTargets(text, file)) {
        expect(fs.existsSync(target), `${name} broken link → ${target}`).to.equal(true)
      }
    }
  })

  it('acceptance — ladder states rungs 1–3 are not enterable prizes', () => {
    const text = fs.readFileSync(path.join(DOCS_DIR, 'DEPRIZE_CAPABILITY_LADDER.md'), 'utf8')
    expect(text).to.include('no pool, no registration, and no committed date')
    expect(text).to.match(/PLANNED — name and bar only/)
    expect(text).to.not.match(/^\| Roster \|/m)
    expect(text).to.not.match(/^1\.\s+\*\*Egress/m)
    expect(text).to.include('NOT IN FORCE')
  })

  it('gate 3 — A′ allowlist files exist and no tracked *.local.md', () => {
    for (const rel of A_PRIME_ALLOWLIST) {
      expect(fs.existsSync(path.join(REPO_ROOT, rel)), rel).to.equal(true)
      expect(rel.endsWith('.local.md')).to.equal(false)
    }
    let trackedLocal = ''
    try {
      trackedLocal = execSync("git ls-files '*.local.md' '**/*.local.md'", {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      }).trim()
    } catch {
      trackedLocal = ''
    }
    expect(trackedLocal, trackedLocal).to.equal('')
  })
})
