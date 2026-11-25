/// <reference types="node" />
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  groupContributions,
  shortArea,
  townHallExcerpt,
  weekStart,
} from '../lib/activity-feed/format'
import { buildActivityRssXml, feedItemsFromUpdates } from '../lib/activity-feed/rss'
import { parseUpdateBlock, stripNonProse } from '../lib/updates/blocks'
import formatUpdateDate from '../lib/updates/formatUpdateDate'
import { parseUpdateFrontmatter, isValidUpdateDate } from '../lib/updates/frontmatter'
import { cleanHref, kitHtmlToMarkdown } from '../lib/updates/kitHtml'
import {
  allUpdateStaticPaths,
  featuredUpdate,
  getAdjacentUpdates,
  getUpdate,
  listUpdates,
  resetUpdatesCache,
  slugFromFilename,
} from '../lib/updates/loadUpdates'
import {
  fetchNewsletterPosts,
  mergeFeed,
  readsLiveArchive,
  normalizeKitPost,
  normalizeKitPosts,
  summarize,
} from '../lib/updates/newsletter'
import type { NewsletterPost } from '../lib/updates/newsletter'
import {
  EDITED_MARKER,
  isNewsletterSlug,
  listNewsletterBodySlugs,
  loadNewsletterIssue,
  readNewsletterBody,
} from '../lib/updates/newsletterIssues'
import snapshot from '../lib/updates/newsletterSnapshot.json'
import { readingMinutes } from '../lib/updates/readingTime'

function expectEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function writeUpdate(
  dir: string,
  fileName: string,
  extra: string,
  body = 'Hello world from a test post.'
) {
  fs.writeFileSync(
    path.join(dir, fileName),
    `---
title: ${fileName}
description: A test description for ${fileName}
date: 2024-01-01
author: Tester
${extra}
---
${body}
`
  )
}

describe('update slug from filename', () => {
  it('strips a leading YYYY-MM-DD prefix', () => {
    expectEqual(slugFromFilename('2023-09-12-the-master-plan.md'), 'the-master-plan', 'dated')
  })

  it('keeps an undated filename as the slug', () => {
    expectEqual(slugFromFilename('untitled-notes.md'), 'untitled-notes', 'plain')
  })
})

describe('update frontmatter', () => {
  it('parses update-only keys without leaking into the body', () => {
    const raw = `---
title: Hello
description: A dek
date: 2023-09-12
author: Pablo
authorRole: Founder
category: Press Release
image: /assets/MoonDAO-OG.png
imageAlt: The Moon
imageCaption: "Illustration: MoonDAO"
tags:
  - ideas
featured: true
draft: false
---
# Body
`
    const { frontmatter, body } = parseUpdateFrontmatter(raw)
    expectEqual(frontmatter.title, 'Hello', 'title')
    expectEqual(frontmatter.date, '2023-09-12', 'date')
    expectEqual(frontmatter.authorRole, 'Founder', 'role')
    expectEqual(frontmatter.category, 'Press Release', 'category')
    expectEqual(frontmatter.imageAlt, 'The Moon', 'image alt')
    expectEqual(frontmatter.imageCaption, 'Illustration: MoonDAO', 'image caption')
    expectEqual(frontmatter.featured, true, 'featured')
    expectEqual(frontmatter.draft, false, 'draft')
    expectEqual(frontmatter.tags.join(','), 'ideas', 'tags')
    if (!body.startsWith('# Body')) throw new Error(`body: ${body}`)
  })

  it('defaults category to Update when omitted', () => {
    const { frontmatter } = parseUpdateFrontmatter(`---
title: Hello
description: A dek
date: 2023-09-12
author: Pablo
---
Body
`)
    expectEqual(frontmatter.category, 'Update', 'default category')
  })

  it('accepts only YYYY-MM-DD dates', () => {
    expectEqual(isValidUpdateDate('2023-09-12'), true, 'valid')
    expectEqual(isValidUpdateDate('09/12/2023'), false, 'slash')
    expectEqual(isValidUpdateDate(undefined), false, 'missing')
  })
})

describe('reading time', () => {
  it('is at least one minute', () => {
    expectEqual(readingMinutes('short'), 1, 'min')
  })

  it('rounds word count at 220 wpm', () => {
    const words = Array.from({ length: 440 }, () => 'word').join(' ')
    expectEqual(readingMinutes(words), 2, '440 words')
  })
})

describe('update data blocks', () => {
  const dots = {
    type: 'dots',
    series: [{ name: 'A' }, { name: 'B' }],
    rows: [{ label: 'X', values: [10, 20], marker: 15 }],
  }

  it('parses a valid chart, stats, heatmap and ledger', () => {
    expectEqual(parseUpdateBlock('chart', JSON.stringify(dots))?.kind, 'chart', 'chart')
    expectEqual(
      parseUpdateBlock('stats', JSON.stringify({ items: [{ value: '4', label: 'models' }] }))?.kind,
      'stats',
      'stats'
    )
    expectEqual(
      parseUpdateBlock(
        'heatmap',
        JSON.stringify({
          columns: ['a', 'b'],
          rows: [{ label: 'r', cells: [{ value: 1 }, { value: -2 }] }],
        })
      )?.kind,
      'heatmap',
      'heatmap'
    )
    expectEqual(
      parseUpdateBlock(
        'ledger',
        JSON.stringify({ rows: [{ label: 'r', trades: [{ outcome: 'o', size: 0.001 }] }] })
      )?.kind,
      'ledger',
      'ledger'
    )
  })

  it('parses screens and cta blocks and rejects them without links or images', () => {
    const shot = { src: '/a.jpg', alt: 'A page', url: 'moondao.com/a', href: '/a' }
    expectEqual(
      parseUpdateBlock('screens', JSON.stringify({ items: [shot] }))?.kind,
      'screens',
      'screens'
    )
    expectEqual(
      parseUpdateBlock('screens', JSON.stringify({ items: [{ src: '/a.jpg' }] })),
      null,
      'screens without alt'
    )
    const cta = { title: 'Predict', actions: [{ label: 'Go', href: '/deprize', primary: true }] }
    expectEqual(parseUpdateBlock('cta', JSON.stringify(cta))?.kind, 'cta', 'cta')
    expectEqual(
      parseUpdateBlock('cta', JSON.stringify({ ...cta, actions: [] })),
      null,
      'cta without actions'
    )
    expectEqual(
      parseUpdateBlock('cta', JSON.stringify({ ...cta, image: { src: '/a.jpg' } })),
      null,
      'cta image without alt'
    )
  })

  it('returns null for unknown languages, bad JSON and mismatched shapes', () => {
    expectEqual(parseUpdateBlock('js', JSON.stringify(dots)), null, 'language')
    expectEqual(parseUpdateBlock('chart', '{not json'), null, 'json')
    expectEqual(parseUpdateBlock('chart', JSON.stringify({ ...dots, type: 'pie' })), null, 'type')
    expectEqual(
      parseUpdateBlock('chart', JSON.stringify({ ...dots, rows: [{ label: 'X', values: [1] }] })),
      null,
      'values per series'
    )
    expectEqual(
      parseUpdateBlock(
        'chart',
        JSON.stringify({
          type: 'line',
          y: { min: 5, max: 1 },
          x: { count: 2 },
          series: [{ name: 'a', values: [1, 2] }],
        })
      ),
      null,
      'inverted range'
    )
    expectEqual(
      parseUpdateBlock(
        'heatmap',
        JSON.stringify({ columns: ['a'], rows: [{ label: 'r', cells: [] }] })
      ),
      null,
      'cells per column'
    )
  })

  it('leaves data blocks and collapsed details out of the reading time', () => {
    const prose = Array(440).fill('word').join(' ')
    const chart =
      '```chart\n' + JSON.stringify({ filler: Array(2000).fill('x') }, null, 1) + '\n```'
    const details =
      '<details>\n<summary>Notes</summary>\n\n' +
      Array(2000).fill('note').join(' ') +
      '\n\n</details>'
    const body = [prose, chart, details].join('\n\n')
    expectEqual(stripNonProse(body).includes('filler'), false, 'chart stripped')
    expectEqual(readingMinutes(body), 2, 'reading minutes')
    expectEqual(stripNonProse('```js\nconst a = 1\n```').includes('const a'), true, 'code kept')
  })
})

describe('formatUpdateDate', () => {
  it('does not shift the calendar day', () => {
    expectEqual(formatUpdateDate('2023-09-12'), 'September 12, 2023', 'date')
  })
})

describe('updates loader', () => {
  let dir: string
  const previousEnv = process.env.VERCEL_ENV

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moondao-updates-'))
    delete process.env.VERCEL_ENV
    resetUpdatesCache()
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
    if (previousEnv === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = previousEnv
    resetUpdatesCache()
  })

  it('sorts newest first and skips _template.md and README.md', () => {
    writeUpdate(dir, '2024-01-01-older.md', '')
    fs.writeFileSync(
      path.join(dir, '2024-06-01-newer.md'),
      `---
title: Newer
description: Newer dek
date: 2024-06-01
author: Tester
---
newer
`
    )
    fs.writeFileSync(path.join(dir, '_template.md'), '---\ntitle: Template\n---\n')
    fs.writeFileSync(path.join(dir, 'README.md'), '# Authoring notes\n')
    const posts = listUpdates(dir)
    expectEqual(posts.map((p) => p.slug).join(','), 'newer,older', 'order')
  })

  it('throws on a missing title or bad date', () => {
    fs.writeFileSync(
      path.join(dir, '2024-01-01-bad.md'),
      `---
description: Missing title
date: 2024-01-01
author: Tester
---
body
`
    )
    let threw = false
    try {
      listUpdates(dir)
    } catch {
      threw = true
    }
    if (!threw) throw new Error('expected missing title to throw')

    resetUpdatesCache()
    fs.writeFileSync(
      path.join(dir, '2024-01-01-bad.md'),
      `---
title: Bad date
description: Missing valid date
date: yesterday
author: Tester
---
body
`
    )
    threw = false
    try {
      listUpdates(dir)
    } catch {
      threw = true
    }
    if (!threw) throw new Error('expected bad date to throw')
  })

  it('stores omitted optional fields as null, not undefined', () => {
    // getStaticProps refuses to serialize undefined, so an update that leaves
    // authorRole or image out would fail the build.
    fs.writeFileSync(
      path.join(dir, '2024-01-01-bare.md'),
      `---
title: Bare
description: No role, no image
date: 2024-01-01
author: Tester
---
body
`
    )
    const [update] = listUpdates(dir)
    expectEqual(update.authorRole, null, 'authorRole')
    expectEqual(update.image, null, 'image')
    expectEqual(update.imageCaption, null, 'imageCaption')
    expectEqual(JSON.stringify(update).includes('undefined'), false, 'serializable')
  })

  it('throws on a duplicate slug', () => {
    writeUpdate(dir, '2024-01-01-same.md', '')
    writeUpdate(dir, '2024-02-02-same.md', 'date: 2024-02-02\n')
    let threw = false
    try {
      listUpdates(dir)
    } catch {
      threw = true
    }
    if (!threw) throw new Error('expected duplicate slug to throw')
  })

  it('hides drafts on a production Vercel build and keeps them otherwise', () => {
    fs.writeFileSync(
      path.join(dir, '2024-01-01-draft.md'),
      `---
title: Draft
description: A draft
date: 2024-01-01
author: Tester
draft: true
---
secret
`
    )
    expectEqual(listUpdates(dir).length, 1, 'local shows draft')

    process.env.VERCEL_ENV = 'production'
    resetUpdatesCache()
    expectEqual(listUpdates(dir).length, 0, 'production hides draft')
    expectEqual(getUpdate('draft', dir), null, 'production 404s draft')
    expectEqual(allUpdateStaticPaths(dir).length, 0, 'production omits draft path')

    process.env.VERCEL_ENV = 'preview'
    resetUpdatesCache()
    expectEqual(listUpdates(dir).length, 1, 'preview shows draft')
  })

  it('returns adjacent posts on a newest-first list', () => {
    fs.writeFileSync(
      path.join(dir, '2024-01-01-first.md'),
      `---
title: First
description: First dek
date: 2024-01-01
author: Tester
---
one
`
    )
    fs.writeFileSync(
      path.join(dir, '2024-02-01-middle.md'),
      `---
title: Middle
description: Middle dek
date: 2024-02-01
author: Tester
---
two
`
    )
    fs.writeFileSync(
      path.join(dir, '2024-03-01-last.md'),
      `---
title: Last
description: Last dek
date: 2024-03-01
author: Tester
---
three
`
    )
    const newest = getAdjacentUpdates('last', dir)
    expectEqual(newest.prev, undefined, 'newest has no prev')
    expectEqual(newest.next?.slug, 'middle', 'newest next')

    const oldest = getAdjacentUpdates('first', dir)
    expectEqual(oldest.next, undefined, 'oldest has no next')
    expectEqual(oldest.prev?.slug, 'middle', 'oldest prev')
  })

  it('picks the newest featured post', () => {
    fs.writeFileSync(
      path.join(dir, '2024-01-01-old-feature.md'),
      `---
title: Old feature
description: Old
date: 2024-01-01
author: Tester
featured: true
---
old
`
    )
    fs.writeFileSync(
      path.join(dir, '2024-06-01-new-feature.md'),
      `---
title: New feature
description: New
date: 2024-06-01
author: Tester
featured: true
---
new
`
    )
    expectEqual(featuredUpdate(dir)?.slug, 'new-feature', 'newest featured')
    expectEqual(
      Object.prototype.hasOwnProperty.call(featuredUpdate(dir) as object, 'body'),
      false,
      'featured meta has no body'
    )
  })
})

describe('updates rss', () => {
  const masterPlan = {
    slug: 'the-master-plan',
    filePath: '2023-09-12-the-master-plan.md',
    title: 'The Master Plan',
    description: 'An essay',
    date: '2023-09-12',
    author: 'Pablo',
    category: 'Essay',
    tags: [],
    featured: true,
    draft: false,
    readingMinutes: 20,
  }

  it('lists updates with their permalink as the guid', () => {
    const xml = buildActivityRssXml(feedItemsFromUpdates([masterPlan]))
    if (!xml.includes('<title>The Master Plan</title>')) throw new Error('missing title')
    if (
      !xml.includes('<guid isPermaLink="false">https://moondao.com/updates/the-master-plan</guid>')
    )
      throw new Error('missing guid')
  })

  it('puts activity newest first, with escaped HTML, absolute links and images', () => {
    const xml = buildActivityRssXml([
      ...feedItemsFromUpdates([masterPlan]),
      {
        guid: 'citizen-412',
        title: 'Ada <Lovelace> became a citizen',
        link: 'https://moondao.com/citizen/ada-lovelace-412',
        pubDate: new Date('2026-10-20T00:00:00Z'),
        category: 'Citizen',
        summary: 'Engineer & poet',
        image: 'https://gateway.example/ipfs/QmAda',
      },
    ])
    if (xml.indexOf('citizen-412') > xml.indexOf('the-master-plan</guid>'))
      throw new Error('not newest first')
    if (!xml.includes('Ada &lt;Lovelace&gt; became a citizen')) throw new Error('title not escaped')
    if (!xml.includes('&lt;img src=&quot;https://gateway.example/ipfs/QmAda&quot;'))
      throw new Error('missing escaped image html')
    if (!xml.includes('Engineer &amp;amp; poet')) throw new Error('summary not double-escaped')
    if (!xml.includes('<media:content url="https://gateway.example/ipfs/QmAda" medium="image" />'))
      throw new Error('missing media:content')
  })
})

describe('activity feed formatting', () => {
  // Wednesday; the week of Oct 26 (Mon) ended Nov 2 00:00 UTC.
  const now = new Date('2026-11-04T12:00:00Z')
  const since = new Date('2026-10-05T12:00:00Z')
  const entry = (person: string, name: string, text: string, at: string, area?: string) => ({
    person,
    name,
    text,
    area,
    at: new Date(at),
  })

  it('starts weeks on Monday, UTC', () => {
    expectEqual(
      weekStart(new Date('2026-11-01T23:59:00Z')).toISOString(),
      '2026-10-26T00:00:00.000Z',
      'sunday'
    )
    expectEqual(
      weekStart(new Date('2026-11-02T00:00:00Z')).toISOString(),
      '2026-11-02T00:00:00.000Z',
      'monday'
    )
  })

  it('groups each person and week into one item listing every contribution', () => {
    const items = groupContributions(
      [
        entry(
          '0xAbC',
          'Longarm',
          'Finalized IVA suit paper',
          '2026-10-27T10:00:00Z',
          'Space Exploration & Research'
        ),
        entry(
          '0xabc',
          'Longarm',
          'Wrote an article',
          '2026-10-29T10:00:00Z',
          'Content Creation & Marketing, Space Exploration & Research'
        ),
        entry(
          '0xdef',
          'Rosana',
          'Voted on proposals',
          '2026-10-29T11:00:00Z',
          'Governance & Operations'
        ),
      ],
      { now, since }
    )
    expectEqual(items.length, 2, 'one item per person')
    const longarm = items.find((i) => i.title.startsWith('Longarm'))!
    expectEqual(longarm.title, 'Longarm made 2 contributions', 'grouped title')
    expectEqual(
      longarm.lines?.join(' | '),
      'Finalized IVA suit paper | Wrote an article',
      'oldest first'
    )
    expectEqual(
      longarm.summary,
      'Space Exploration & Research, Content Creation & Marketing',
      'unique areas'
    )
    expectEqual(longarm.pubDate.toISOString(), '2026-11-02T00:00:00.000Z', 'dated at week end')
    if (!/^contributions-[0-9a-f]{10}-2026-10-26$/.test(longarm.guid))
      throw new Error(`guid ${longarm.guid}`)
    const rosana = items.find((i) => i.title.startsWith('Rosana'))!
    expectEqual(rosana.title, 'Rosana contributed: Voted on proposals', 'single title')
    expectEqual(rosana.lines, undefined, 'no list for one')
  })

  it('leaves out the unfinished week and weeks before the window', () => {
    const items = groupContributions(
      [
        entry('0xabc', 'Longarm', 'This week', '2026-11-03T10:00:00Z'),
        entry('0xabc', 'Longarm', 'Long ago', '2026-09-20T10:00:00Z'),
      ],
      { now, since }
    )
    expectEqual(items.length, 0, 'nothing listed')
  })

  it('shortens form area labels and trims the Town Hall preamble', () => {
    expectEqual(
      shortArea(
        'Community Growth & Engagement (e.g., events, moderation, onboarding), Governance & Operations (e.g., proposal review, documentation)'
      ),
      'Community Growth & Engagement, Governance & Operations',
      'areas'
    )
    expectEqual(
      townHallExcerpt(
        'Astronaut Ron Garan | MoonDAO Town Hall',
        'Town Hall Summary Astronaut Ron Garan | MoonDAO Town Hall Guest Speaker Ron'
      ),
      'Guest Speaker Ron',
      'town hall'
    )
  })

  it('renders grouped contributions as a list', () => {
    const [item] = groupContributions(
      [
        entry('0xabc', 'Longarm', 'One', '2026-10-27T10:00:00Z'),
        entry('0xabc', 'Longarm', 'Two <b>', '2026-10-28T10:00:00Z'),
      ],
      { now, since }
    )
    const xml = buildActivityRssXml([item])
    if (
      !xml.includes(
        '&lt;ul&gt;&lt;li&gt;One&lt;/li&gt;&lt;li&gt;Two &amp;lt;b&amp;gt;&lt;/li&gt;&lt;/ul&gt;'
      )
    )
      throw new Error('missing escaped list')
  })
})

function kitPost(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'moon-base-zero-launches-tomorrow',
    title: 'Moon Base Zero launches tomorrow',
    status: 'published',
    isPaid: false,
    readingTime: 2,
    publishedAt: '2026-11-12T01:58:27.000Z',
    thumbnailUrl: 'https://embed.filekitcdn.com/e/abc/def/email',
    url: 'https://news.moondao.com/posts/moon-base-zero-launches-tomorrow',
    introContent: 'Hey Reader, We have built the critical path tech tree for a Moonbase...',
    campaignId: 26971020,
    ...overrides,
  }
}

describe('newsletter issues', () => {
  it('skips the live archive during a production build', () => {
    expectEqual(readsLiveArchive('phase-production-build'), false, 'build')
    expectEqual(readsLiveArchive(undefined), true, 'refresh')
    expectEqual(readsLiveArchive('phase-production-server'), true, 'server')
  })

  it('maps a Kit post to the fields the feed uses', () => {
    const post = normalizeKitPost(kitPost())
    if (!post) throw new Error('expected a post')
    expectEqual(post.date, '2026-11-12', 'date')
    expectEqual(post.readingMinutes, 2, 'reading minutes')
    expectEqual(post.image, 'https://embed.filekitcdn.com/e/abc/def', 'image drops /email')
    expectEqual(post.kitId, 26971020, 'Kit broadcast id')
    expectEqual(
      post.description,
      'We have built the critical path tech tree for a Moonbase',
      'greeting and trailing ellipsis are trimmed'
    )
  })

  it('skips drafts, paid posts and posts without a title or date', () => {
    expectEqual(normalizeKitPost(kitPost({ status: 'draft' })), null, 'draft')
    expectEqual(normalizeKitPost(kitPost({ isPaid: true })), null, 'paid')
    expectEqual(normalizeKitPost(kitPost({ title: '' })), null, 'title')
    expectEqual(normalizeKitPost(kitPost({ publishedAt: 'soon' })), null, 'date')
    expectEqual(normalizeKitPost(null), null, 'null')
  })

  it('uses a YouTube thumbnail for play-button images and drops hosts the CSP blocks', () => {
    const playbutton =
      'https://functions-js.kit.com/playbutton?play=%233197e0&thumbnailof=' +
      encodeURIComponent('https://www.youtube.com/watch?v=K9TEI-Dhky0')
    expectEqual(
      normalizeKitPost(kitPost({ thumbnailUrl: playbutton }))?.image,
      'https://img.youtube.com/vi/K9TEI-Dhky0/hqdefault.jpg',
      'youtube'
    )
    expectEqual(
      normalizeKitPost(kitPost({ thumbnailUrl: 'https://example.com/a.png' }))?.image,
      null,
      'other host'
    )
  })

  it('caps long descriptions at a word boundary', () => {
    const long = summarize(`${'word '.repeat(100)}`)
    if (long.length > 222) throw new Error(`description too long: ${long.length}`)
    if (!long.endsWith('…')) throw new Error('expected an ellipsis')
  })

  it('drops duplicate slugs', () => {
    expectEqual(normalizeKitPosts([kitPost(), kitPost()]).length, 1, 'deduped')
  })

  it('reads every page of the archive', async () => {
    const calls: string[] = []
    const fakeFetch = (async (url: string) => {
      calls.push(url)
      const page = Number(new URL(url).searchParams.get('page'))
      const posts =
        page === 1
          ? [kitPost({ slug: 'one', publishedAt: '2026-01-01T00:00:00Z' })]
          : [kitPost({ slug: 'two', publishedAt: '2026-02-01T00:00:00Z' })]
      return { ok: true, status: 200, json: async () => ({ posts, hasMore: page < 2 }) }
    }) as unknown as typeof fetch

    const posts = await fetchNewsletterPosts(fakeFetch)
    expectEqual(calls.length, 2, 'requests')
    expectEqual(posts.map((p) => p.slug).join(','), 'two,one', 'newest first')
  })

  it('throws when the archive cannot be read, so callers can fall back', async () => {
    const failing = (async () => ({ ok: false, status: 503 })) as unknown as typeof fetch
    let threw = false
    try {
      await fetchNewsletterPosts(failing)
    } catch {
      threw = true
    }
    if (!threw) throw new Error('expected a failed archive to throw')
  })

  it('gives up when the archive does not answer in time', async () => {
    const hanging = ((_url: string, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      })) as unknown as typeof fetch
    let threw = false
    try {
      await fetchNewsletterPosts(hanging, 30)
    } catch {
      threw = true
    }
    if (!threw) throw new Error('expected a stalled archive to throw')
  })

  it('ships a non-empty snapshot in the shape the feed expects', () => {
    const posts = snapshot as NewsletterPost[]
    if (posts.length < 100) throw new Error(`snapshot has only ${posts.length} issues`)
    for (const post of posts) {
      if (
        !post.slug ||
        !post.title ||
        !isValidUpdateDate(post.date) ||
        !post.url.startsWith('https://')
      ) {
        throw new Error(`bad snapshot entry ${JSON.stringify(post)}`)
      }
    }
  })
})

describe('merged news and updates feed', () => {
  let dir: string

  beforeEach(() => {
    resetUpdatesCache()
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feed-'))
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('lists updates and newsletter issues together, newest first', () => {
    writeUpdate(dir, '2024-01-01-essay.md', '')
    const issues: NewsletterPost[] = [
      {
        slug: 'newer',
        title: 'Newer issue',
        date: '2024-03-01',
        description: 'd',
        image: null,
        url: 'https://news.moondao.com/posts/newer',
        readingMinutes: 1,
        kitId: null,
      },
      {
        slug: 'same-day',
        title: 'Same-day issue',
        date: '2024-01-01',
        description: 'd',
        image: null,
        url: 'https://news.moondao.com/posts/same-day',
        readingMinutes: 1,
        kitId: null,
      },
    ]
    const feed = mergeFeed(listUpdates(dir), issues)
    expectEqual(
      feed.map((entry) => entry.slug).join(','),
      'newer,essay,same-day',
      'order, with the update first on a same-day tie'
    )
    expectEqual(feed[0].externalUrl, null, 'issues open on-site')
    expectEqual(feed[0].source, 'newsletter', 'issue source')
    expectEqual(feed[0].category, 'Newsletter', 'issue category')
    expectEqual(feed[1].source ?? null, null, 'updates are not issues')
  })

  it('keeps same-day newsletter issues in the order they were sent', () => {
    const issues: NewsletterPost[] = [
      {
        slug: 'later',
        title: 'Later',
        date: '2024-03-01',
        description: 'd',
        image: null,
        url: 'https://news.moondao.com/posts/later',
        readingMinutes: 1,
        kitId: null,
      },
      {
        slug: 'earlier',
        title: 'Earlier',
        date: '2024-03-01',
        description: 'd',
        image: null,
        url: 'https://news.moondao.com/posts/earlier',
        readingMinutes: 1,
        kitId: null,
      },
    ]
    expectEqual(
      mergeFeed([], issues)
        .map((entry) => entry.slug)
        .join(','),
      'later,earlier',
      'send order'
    )
  })

  it('leaves out an issue that an update was sent as, or that shares its slug', () => {
    writeUpdate(dir, '2024-01-01-essay.md', 'newsletter: we-sent-the-essay')
    writeUpdate(dir, '2024-01-02-clash.md', '')
    const issue = (slug: string): NewsletterPost => ({
      slug,
      title: slug,
      date: '2024-01-03',
      description: 'd',
      image: null,
      url: `https://news.moondao.com/posts/${slug}`,
      readingMinutes: 1,
      kitId: null,
    })
    const updates = listUpdates(dir)
    expectEqual(updates.find((u) => u.slug === 'essay')?.newsletter, 'we-sent-the-essay', 'field')
    const feed = mergeFeed(updates, [issue('we-sent-the-essay'), issue('clash'), issue('kept')])
    expectEqual(feed.map((entry) => entry.slug).join(','), 'kept,clash,essay', 'deduped')
    expectEqual(feed[1].source ?? null, null, 'the update wins a slug clash')
  })

  it('serializes for getStaticProps (no undefined values)', () => {
    const [entry] = mergeFeed(
      [],
      [
        {
          slug: 'a',
          title: 'A',
          date: '2024-01-01',
          description: '',
          image: null,
          url: 'https://news.moondao.com/posts/a',
          readingMinutes: 1,
          kitId: null,
        },
      ]
    )
    expectEqual(JSON.stringify(entry).includes('undefined'), false, 'json')
    for (const [key, value] of Object.entries(entry)) {
      if (value === undefined) throw new Error(`${key} is undefined`)
    }
  })
})

describe('newsletter issue bodies', () => {
  const email = (body: string) =>
    `<style>.ck-link{}</style><!--[if mso]><table><tr><td>Outlook only</td></tr></table><![endif]--><table cellPadding="0"><tbody><tr><td>${body}</td></tr></tbody></table>`

  it('keeps headings, paragraphs, emphasis, lists and links', () => {
    const md = kitHtmlToMarkdown(
      email(
        '<h1>The Title</h1><p>Hey {{ subscriber.first_name }},</p><h2>Section</h2>' +
          '<p>Read <strong>this</strong> and <em>that</em> on <a href="https://www.moondao.com/base?utm_source=kit&amp;x=1">the base</a>.</p>' +
          '<ul class="unordered_list"><li class="list_item"><p>One</p></li><li>Two <a href="https://example.com/a?utm_medium=email">link</a></li></ul>' +
          '<ol><li>First</li><li>Second</li></ol>'
      ),
      { title: 'The title' }
    )
    expectEqual(
      md,
      [
        '## Section',
        'Read **this** and *that* on [the base](/base?x=1).',
        '- One\n- Two [link](https://example.com/a)',
        '1. First\n2. Second',
      ].join('\n\n') + '\n',
      'markdown'
    )
  })

  it('drops what Kit hides from public posts and email-only markup', () => {
    const md = kitHtmlToMarkdown(
      email(
        '<p>Kept</p><div class="ck-section ck-hide-in-public-posts"><p>Hidden</p></div>' +
          '<table class="ck-poll"><tr><td>{% poll 1 %}Vote</td></tr></table>' +
          '<span style="display:none">Preview text</span>' +
          '<img src="https://functions-js.kit.com/countdown-timer?slug=x" alt="timer">'
      )
    )
    expectEqual(md, 'Kept\n', 'only the visible paragraph')
  })

  it('escapes text so an email cannot inject markup', () => {
    const md = kitHtmlToMarkdown(
      email(
        '<p>&lt;script&gt;alert(1)&lt;/script&gt; *stars* [x](y)</p><p><a href="javascript:alert(1)">bad</a></p>'
      )
    )
    expectEqual(md.includes('<script'), false, 'no raw tag')
    expectEqual(md.includes('javascript:'), false, 'no script link')
    expectEqual(md.includes('\\*stars\\*'), true, 'markdown escaped')
  })

  it('turns images, buttons, videos and posts from X into page elements', () => {
    const youtube = 'https://www.youtube.com/watch?v=K9TEI-Dhky0'
    const md = kitHtmlToMarkdown(
      email(
        '<table class="email-image"><tr><td><figure><a class="kit-image-link" href="https://x.com/a/status/1"><img src="https://embed.filekitcdn.com/e/a/b" alt="Hero"></a><figcaption>A caption</figcaption></figure></td></tr></table>' +
          '<table class="email-image"><tr><td><figure><img src="https://example.com/blocked.png" alt="Blocked"></figure></td></tr></table>' +
          '<a class="email-button" href="https://moondao.com/join?utm_source=kit">Join now</a>' +
          `<a href="${youtube}"><img src="https://functions-js.kit.com/playbutton?thumbnailof=${encodeURIComponent(
            youtube
          )}" alt="Watch"></a>` +
          '<div data-video-container="true"><video poster="https://api.filekitcdn.com/e/a/v/thumbnail"><source src="https://api.filekitcdn.com/e/a/v"></video></div>' +
          '<table width="450" style="max-width:450px"><tr><td><img src="https://pbs.twimg.com/profile_images/1/a.jpg" alt="twitter profile avatar"><div>MoonDAO</div><div>@OfficialMoonDAO</div>' +
          '<a href="https://x.com/OfficialMoonDAO/status/123"><div style="white-space:pre-wrap">Line one\n\nLine two</div></a></td></tr></table>'
      )
    )
    const expected = [
      '<figure>\n\n[![Hero](https://embed.filekitcdn.com/e/a/b)](https://x.com/a/status/1)\n\n<figcaption>\n\nA caption\n\n</figcaption>\n\n</figure>',
      '<a href="/join" data-button="true">Join now</a>',
      '<iframe src="https://www.youtube.com/embed/K9TEI-Dhky0" title="Watch" allowfullscreen></iframe>',
      '<video controls preload="none" poster="https://api.filekitcdn.com/e/a/v/thumbnail"><source src="https://api.filekitcdn.com/e/a/v" /></video>',
      '<aside data-title="@OfficialMoonDAO on X">\n\nLine one\n\nLine two\n\n[View the post on X](https://x.com/OfficialMoonDAO/status/123)\n\n</aside>',
    ]
    expectEqual(md, `${expected.join('\n\n')}\n`, 'elements, with the blocked image left out')
  })

  it('drops a lead image that repeats the card image, and a greeting that lost its name', () => {
    const md = kitHtmlToMarkdown(email('<p>Hey , welcome to the newsletter!</p>'))
    expectEqual(md, 'Welcome to the newsletter!\n', 'greeting')
    const lead = kitHtmlToMarkdown(
      email(
        '<table class="email-image"><tr><td><img src="https://embed.filekitcdn.com/e/a/hero"></td></tr></table><p>Body</p>'
      ),
      { heroImage: 'https://embed.filekitcdn.com/e/a/hero/email' }
    )
    expectEqual(lead, 'Body\n', 'hero image')
  })

  it('keeps only the MP4 of a Kit video, which every browser plays', () => {
    const md = kitHtmlToMarkdown(
      email(
        '<video><source src="https://api.filekitcdn.com/e/a/v"><source src="https://api.filekitcdn.com/e/a/v?format=mp4" type="video/mp4"></video>'
      )
    )
    expectEqual(
      md,
      '<video controls preload="none"><source src="https://api.filekitcdn.com/e/a/v?format=mp4" type="video/mp4" /></video>\n',
      'mp4 only'
    )
  })

  it('cleans link targets', () => {
    expectEqual(cleanHref('https://moondao.com/?utm_campaign=x'), '/', 'site root')
    expectEqual(cleanHref('http://example.com/a b'), 'http://example.com/a%20b', 'encoded')
    expectEqual(cleanHref('ftp://example.com'), null, 'protocol')
    expectEqual(cleanHref(''), null, 'empty')
  })

  it('accepts only Kit-style slugs', () => {
    expectEqual(isNewsletterSlug('who-builds-the-first-moonbase'), true, 'slug')
    expectEqual(isNewsletterSlug('../etc/passwd'), false, 'path')
    expectEqual(isNewsletterSlug('Caps'), false, 'caps')
  })

  it('reads a committed body, keeping the edited marker out of the page', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'issues-'))
    try {
      fs.writeFileSync(path.join(dir, 'an-issue.md'), `${EDITED_MARKER}\nFixed by hand.\n`)
      expectEqual(readNewsletterBody('an-issue', dir), 'Fixed by hand.', 'body')
      expectEqual(readNewsletterBody('missing', dir), null, 'missing')
      const post: NewsletterPost = {
        slug: 'an-issue',
        title: 'An issue',
        date: '2024-01-01',
        description: 'd',
        image: null,
        url: 'https://news.moondao.com/posts/an-issue',
        readingMinutes: 1,
        kitId: null,
      }
      const issue = await loadNewsletterIssue(post, { root: dir })
      expectEqual(issue?.body, 'Fixed by hand.', 'issue body')
      expectEqual(issue?.slug, 'an-issue', 'issue slug')
      expectEqual(
        await loadNewsletterIssue({ ...post, slug: 'missing' }, { root: dir }),
        null,
        'no body and no Kit id'
      )
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('ships a body for every issue in the snapshot', () => {
    const synced = listNewsletterBodySlugs()
    const missing = (snapshot as NewsletterPost[]).filter((post) => !synced.has(post.slug))
    if (missing.length) {
      throw new Error(
        `run yarn sync:newsletter; no body for ${missing.map((p) => p.slug).join(', ')}`
      )
    }
  })
})
