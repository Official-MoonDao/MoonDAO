/// <reference types="node" />
import fs from 'fs'
import path from 'path'
import { parseFrontmatter } from '../lib/docs/frontmatter'
import {
  allProducedSlugs,
  buildNavTree,
  getAliasTable,
  getDocPage,
  listBrokenDocsHrefs,
  listUnresolvedWikilinks,
  loadCorpus,
  resetDocsCache,
} from '../lib/docs/loadDocs'
import { isTableRow, rewriteDocBody } from '../lib/docs/rewrite'
import { buildSearchIndex } from '../lib/docs/searchIndex'
import {
  INTENTIONAL_SLUG_CHANGES,
  docsHref,
  isRouteSafeSlug,
  slugifyFilePath,
  slugifySegment,
} from '../lib/docs/slug'

const FIXTURE = path.join(__dirname, '..', 'lib', 'docs', 'fixtures', 'contentIndex.json')

function expectEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

describe('docs slugifier (Quartz parity)', () => {
  const cases: [string, string][] = [
    ['About/FAQ.md', 'About/FAQ'],
    ['About/Glossary/@Executive Lead.md', 'About/Glossary/@Executive-Lead'],
    ['About/Glossary/@Alien.md', 'About/Glossary/@Alien'],
    ['Reference/Glossary dynamic.md', 'Reference/Glossary-dynamic'],
    ['Reference/Bios/@name.get.md', 'Reference/Bios/@name.get'],
    [
      'Legal/Ticket to Zero-G NFT/Ticket to Zero-G NFT  Sweepstakes Rules.md',
      'Legal/Ticket-to-Zero-G-NFT/Ticket-to-Zero-G-NFT--Sweepstakes-Rules',
    ],
    ['Reference/Nested Docs/MoonDAOs Quarterly Rewards.md', 'Reference/Nested-Docs/MoonDAOs-Quarterly-Rewards'],
    ['index.md', 'index'],
  ]

  for (const [filePath, slug] of cases) {
    it(`slugifies ${filePath}`, () => {
      expectEqual(slugifyFilePath(filePath), slug, filePath)
    })
  }

  it('maps each space to a hyphen (double space → --)', () => {
    expectEqual(slugifySegment('Project System'), 'Project-System', 'single')
    expectEqual(slugifySegment('NFT  Sweepstakes'), 'NFT--Sweepstakes', 'double')
  })

  it('docsHref treats index as /docs', () => {
    expectEqual(docsHref('index'), '/docs', 'index')
    expectEqual(docsHref('About/FAQ'), '/docs/About/FAQ', 'faq')
  })
})

describe('docs frontmatter', () => {
  it('parses scalar tags and slug overrides', () => {
    const raw = `---
tags: docs/onboarding
title: Introduction
slug: /
---
# Hello
`
    const { frontmatter, body } = parseFrontmatter(raw)
    expectEqual(frontmatter.tags.join(','), 'docs/onboarding', 'tags')
    expectEqual(frontmatter.title, 'Introduction', 'title')
    expectEqual(frontmatter.slug, '/', 'slug')
    if (!body.startsWith('# Hello')) throw new Error(`body: ${body}`)
  })

  it('splits comma-separated scalar tags', () => {
    const { frontmatter } = parseFrontmatter(`---
tags: docs/faq, docs/onboarding
---
x
`)
    expectEqual(frontmatter.tags.join('|'), 'docs/faq|docs/onboarding', 'split tags')
  })

  it('parses list aliases', () => {
    const raw = `---
aliases:
  - vMooney
  - "ve"
---
body
`
    const { frontmatter } = parseFrontmatter(raw)
    expectEqual(frontmatter.aliases.join('|'), 'vMooney|ve', 'aliases')
  })
})

describe('docs rewrite', () => {
  const resolver = {
    resolve(name: string) {
      if (name === 'FAQ') return 'About/FAQ'
      return undefined
    },
  }

  it('converts a wikilink to a /docs href', () => {
    const out = rewriteDocBody('See [[FAQ]] please', resolver)
    if (!out.includes('[FAQ](/docs/About/FAQ)')) throw new Error(out)
  })

  it('leaves an unknown wikilink as display text', () => {
    const out = rewriteDocBody('See [[Outbound SOP]]', resolver)
    if (out.includes('[[')) throw new Error(out)
    if (!out.includes('Outbound SOP')) throw new Error(out)
  })

  it('keeps note transclusions for load-time expansion', () => {
    expectEqual(rewriteDocBody('![[FAQ]]', resolver), '![[FAQ]]', 'transclude')
  })

  it('drops the href on a dangling relative .md link, keeping the label', () => {
    const out = rewriteDocBody('[Some Note](Some%20Note.md)', resolver)
    expectEqual(out, 'Some Note', 'dangling md link')
  })

  it('handles parentheses inside a link target', () => {
    // A plain [^)]+ URL pattern truncates here and leaks `.md)` as text.
    const out = rewriteDocBody('[Team (dynamic)](Team%20(dynamic).md)', resolver)
    expectEqual(out, 'Team (dynamic)', 'parenthesised dangling target')

    const resolved = rewriteDocBody('[Glossary (dynamic)](Glossary%20(dynamic).md)', {
      resolve: (n) =>
        n.trim() === 'Glossary (dynamic)' ? 'Reference/Glossary-(dynamic)' : undefined,
    })
    if (!resolved.includes('(/docs/Reference/Glossary-(dynamic))')) throw new Error(resolved)
  })

  it('resolves a relative .md link through backslash + percent escapes', () => {
    const out = rewriteDocBody('[gov](FAQ.md) and [gov2](FAQ\\%20.md)', {
      resolve: (n) => (n.trim() === 'FAQ' ? 'About/FAQ' : undefined),
    })
    if (!out.includes('[gov](/docs/About/FAQ)')) throw new Error(out)
  })

  it('repairs a docs.moondao.com link whose path was already a 404', () => {
    const out = rewriteDocBody('see https://docs.moondao.com/Constitution#24-x now', {
      resolve: (n) => (n.trim() === 'Constitution' ? 'Governance/Constitution' : undefined),
    })
    if (!out.includes('/docs/Governance/Constitution#24-x')) throw new Error(out)
  })

  it('maps the docs host root to /docs', () => {
    const out = rewriteDocBody('at https://docs.moondao.com done', resolver)
    if (!out.includes('/docs ')) throw new Error(out)
  })

  it('rewrites legacy publish.obsidian.md links, decoding + as space', () => {
    const out = rewriteDocBody(
      'see https://publish.obsidian.md/moondao/MoonDAO/docs/Legal/Website+Privacy+Policy end',
      {
        resolve: () => undefined,
        resolvePath: (p) =>
          p === 'Legal/Website Privacy Policy' ? 'Legal/Website-Privacy-Policy' : undefined,
      }
    )
    if (!out.includes('/docs/Legal/Website-Privacy-Policy')) throw new Error(out)
  })

  it('disambiguates a duplicate filename using the legacy path', () => {
    // Two "Dispute Notice.md" exist (Space and Zero-G); the path decides.
    resetDocsCache()
    const page = getDocPage('Legal/Ticket-to-Space-NFT/Ticket-to-Space-Sweepstakes-Rules')
    if (!page) throw new Error('sweepstakes rules missing')
    if (!page.body.includes('/docs/Legal/Ticket-to-Space-NFT/Dispute-Notice')) {
      throw new Error('legal cross-reference should target the Ticket to Space dispute notice')
    }
    if (page.body.includes('Ticket-to-Zero-G-NFT/Dispute-Notice')) {
      throw new Error('resolved to the wrong Dispute Notice')
    }
  })

  it('leaves no legacy docs host anywhere in the corpus', () => {
    resetDocsCache()
    const corpus = loadCorpus()
    const offenders = corpus.files
      .filter((f) => /publish\.obsidian\.md|docs\.moondao\.com/.test(f.body))
      .map((f) => f.filePath)
    if (offenders.length > 0) throw new Error(offenders.join('\n'))
  })

  it('converts an Obsidian callout to a styled block', () => {
    const out = rewriteDocBody('> [!TIP] Heads up\n> body text\n', resolver)
    if (!out.includes('docs-callout-tip')) throw new Error(out)
    if (!out.includes('body text')) throw new Error(out)
  })

  it('identifies table rows so transclusions stay inline', () => {
    if (!isTableRow('| ![[Senate]] | x |')) throw new Error('should be a table row')
    if (!isTableRow('  | indented |')) throw new Error('indented row')
    if (isTableRow('![[Senate]]')) throw new Error('standalone is not a table row')
  })
})

describe('docs transclusion rendering', () => {
  it('links rather than inlines inside the glossary table, keeping it parseable', () => {
    resetDocsCache()
    const page = getDocPage('About/Glossary')
    if (!page) throw new Error('About/Glossary missing')
    const rows = page.body.split('\n').filter((l) => l.trimStart().startsWith('|'))
    if (rows.length < 16) {
      throw new Error(`expected the table to survive, got ${rows.length} rows`)
    }
    if (page.body.includes('![[')) throw new Error('unexpanded transclusion')
    if (!page.body.includes('](/docs/About/Glossary/Senate)')) {
      throw new Error('Senate should be linked from the table')
    }
  })

  it('inlines a standalone transclusion', () => {
    resetDocsCache()
    const page = getDocPage('About/Team')
    if (!page) throw new Error('About/Team missing')
    if (page.body.includes('![[')) throw new Error('unexpanded transclusion')
  })

  it('generates the dynamic glossary table in place of the dataview block', () => {
    resetDocsCache()
    const page = getDocPage('Reference/Glossary-dynamic')
    if (!page) throw new Error('dynamic glossary missing')
    if (page.body.includes('docs-glossary-table')) throw new Error('marker left in body')
    if (!page.body.includes('/docs/About/Glossary/')) throw new Error('no glossary links')
  })
})

describe('docs link integrity', () => {
  it('has no unresolved wikilinks', () => {
    resetDocsCache()
    const unresolved = listUnresolvedWikilinks()
    if (unresolved.length > 0) {
      throw new Error(unresolved.map((u) => `${u.filePath}: [[${u.target}]]`).join('\n'))
    }
  })

  it('has no broken internal /docs hrefs', () => {
    resetDocsCache()
    const broken = listBrokenDocsHrefs()
    if (broken.length > 0) {
      throw new Error(broken.map((b) => `${b.filePath}: ${b.href}`).join('\n'))
    }
  })

  it('renders a non-empty body for every page', () => {
    resetDocsCache()
    const corpus = loadCorpus()
    const empty: string[] = []
    for (const file of corpus.files) {
      const page = getDocPage(file.slug)
      if (!page || page.body.replace(/[#*_`\s-]/g, '').length < 10) {
        empty.push(file.slug)
      }
    }
    if (empty.length > 0) throw new Error(`Empty doc pages:\n${empty.join('\n')}`)
  })

  it('resolves every alias and slug override to a real page', () => {
    resetDocsCache()
    for (const row of getAliasTable()) {
      for (const alias of row.aliases) {
        if (alias.includes(' ')) continue
        const page = getDocPage(alias)
        if (!page) throw new Error(`alias ${alias} (of ${row.slug}) does not resolve`)
      }
    }
  })
})

describe('docs generated artifacts', () => {
  const INDEX = path.join(__dirname, '..', 'public', 'docs-search-index.json')
  const NAV = path.join(__dirname, '..', 'lib', 'docs', 'generated', 'navTree.json')

  it('search index matches the content (run `yarn docs:generate` if this fails)', function () {
    if (!fs.existsSync(INDEX)) {
      this.skip()
      return
    }
    resetDocsCache()
    if (JSON.stringify(buildSearchIndex()) !== fs.readFileSync(INDEX, 'utf8')) {
      throw new Error('public/docs-search-index.json is stale; run `yarn docs:generate`')
    }
  })

  it('nav tree matches the content (run `yarn docs:generate` if this fails)', function () {
    if (!fs.existsSync(NAV)) {
      this.skip()
      return
    }
    resetDocsCache()
    if (JSON.stringify(buildNavTree()) !== fs.readFileSync(NAV, 'utf8')) {
      throw new Error('lib/docs/generated/navTree.json is stale; run `yarn docs:generate`')
    }
  })

  it('does not ship the nav tree in page props', () => {
    resetDocsCache()
    const page = getDocPage('About/FAQ') as unknown as Record<string, unknown>
    if (page && 'tree' in page) {
      throw new Error('page props still carry `tree`; it belongs in the generated module')
    }
  })

  it('indexes every page with a title and href', () => {
    resetDocsCache()
    const index = buildSearchIndex()
    const corpus = loadCorpus()
    expectEqual(index.length, corpus.files.length, 'entry count')
    for (const entry of index) {
      if (!entry.title) throw new Error(`missing title: ${entry.slug}`)
      if (!entry.href.startsWith('/docs')) throw new Error(`bad href: ${entry.href}`)
    }
  })
})

describe('docs corpus vs Quartz contentIndex', () => {
  it('produces every slug Quartz published, bar two documented exceptions', function () {
    if (!fs.existsSync(FIXTURE)) {
      this.skip()
      return
    }
    resetDocsCache()
    const produced = new Set(allProducedSlugs())
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Record<string, unknown>
    const missing = Object.keys(fixture).filter(
      (k) => !produced.has(k) && !(k in INTENTIONAL_SLUG_CHANGES)
    )
    if (missing.length > 0) {
      throw new Error(`Missing Quartz slugs:\n${missing.join('\n')}`)
    }
    // The exceptions must still resolve to a real page under their new slug.
    for (const replacement of Object.values(INTENTIONAL_SLUG_CHANGES)) {
      if (!produced.has(replacement)) {
        throw new Error(`replacement slug not produced: ${replacement}`)
      }
    }
  })

  it('emits only route-safe slugs (ASCII, no parentheses)', () => {
    resetDocsCache()
    const unsafe = allProducedSlugs().filter((s) => !isRouteSafeSlug(s))
    if (unsafe.length > 0) {
      throw new Error(`Route-unsafe slugs would break the Vercel deploy:\n${unsafe.join('\n')}`)
    }
  })

  it('emits no route-unsafe content filenames either', () => {
    resetDocsCache()
    const corpus = loadCorpus()
    const unsafe = corpus.files
      .map((f) => f.filePath)
      .filter((p) => /[^A-Za-z0-9._@\- /]/.test(p))
    if (unsafe.length > 0) {
      throw new Error(`Rename these files (see sanitizeVaultPath):\n${unsafe.join('\n')}`)
    }
  })

  it('loads the imported markdown files', () => {
    resetDocsCache()
    const corpus = loadCorpus()
    if (corpus.files.length < 70) {
      throw new Error(`expected >= 70 files, got ${corpus.files.length}`)
    }
    if (!corpus.bySlug.has('About/FAQ')) throw new Error('missing About/FAQ')
    if (!corpus.bySlug.has('Governance/Constitution')) throw new Error('missing Constitution')
    if (!corpus.bySlug.has('index')) throw new Error('missing index')
  })
})
