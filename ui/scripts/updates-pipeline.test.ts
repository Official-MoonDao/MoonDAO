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
import formatUpdateDate from '../lib/updates/formatUpdateDate'
import { parseUpdateFrontmatter, isValidUpdateDate } from '../lib/updates/frontmatter'
import {
  allUpdateStaticPaths,
  featuredUpdate,
  getAdjacentUpdates,
  getUpdate,
  listUpdates,
  resetUpdatesCache,
  slugFromFilename,
} from '../lib/updates/loadUpdates'
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
