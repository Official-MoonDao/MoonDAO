/// <reference types="node" />
import fs from 'fs'
import path from 'path'
import { parseFrontmatter } from '../lib/docs/frontmatter'
import { allProducedSlugs, loadCorpus, resetDocsCache } from '../lib/docs/loadDocs'
import { rewriteDocBody } from '../lib/docs/rewrite'
import { docsHref, slugifyFilePath, slugifySegment } from '../lib/docs/slug'

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
    ['Reference/Glossary (dynamic).md', 'Reference/Glossary-(dynamic)'],
    ['Reference/Bios/@name.get.md', 'Reference/Bios/@name.get'],
    [
      'Legal/Ticket to Zero-G NFT/Ticket to Zero-G NFT  Sweepstakes Rules.md',
      'Legal/Ticket-to-Zero-G-NFT/Ticket-to-Zero-G-NFT--Sweepstakes-Rules',
    ],
    ['Reference/Nested Docs/MoonDAO’s Quarterly Rewards.md', 'Reference/Nested-Docs/MoonDAO’s-Quarterly-Rewards'],
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
})

describe('docs corpus vs Quartz contentIndex', () => {
  it('produces every slug Quartz published', function () {
    if (!fs.existsSync(FIXTURE)) {
      this.skip()
      return
    }
    resetDocsCache()
    const produced = new Set(allProducedSlugs())
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Record<string, unknown>
    const missing = Object.keys(fixture).filter((k) => !produced.has(k))
    if (missing.length > 0) {
      throw new Error(`Missing Quartz slugs:\n${missing.join('\n')}`)
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
