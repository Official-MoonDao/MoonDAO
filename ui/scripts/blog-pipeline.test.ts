/// <reference types="node" />
import fs from 'fs'
import os from 'os'
import path from 'path'
import formatBlogDate from '../lib/blog/formatBlogDate'
import { parseBlogFrontmatter, isValidPostDate } from '../lib/blog/frontmatter'
import {
  allBlogStaticPaths,
  featuredPost,
  getAdjacentPosts,
  getPost,
  listPosts,
  resetBlogCache,
  slugFromFilename,
} from '../lib/blog/loadPosts'
import { readingMinutes } from '../lib/blog/readingTime'
import { buildRssXml } from '../lib/blog/rss'

function expectEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function writePost(
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

describe('blog slug from filename', () => {
  it('strips a leading YYYY-MM-DD prefix', () => {
    expectEqual(slugFromFilename('2023-09-12-the-master-plan.md'), 'the-master-plan', 'dated')
  })

  it('keeps an undated filename as the slug', () => {
    expectEqual(slugFromFilename('untitled-notes.md'), 'untitled-notes', 'plain')
  })
})

describe('blog frontmatter', () => {
  it('parses blog-only keys without leaking into the body', () => {
    const raw = `---
title: Hello
description: A dek
date: 2023-09-12
author: Pablo
authorRole: Founder
image: /assets/MoonDAO-OG.png
tags:
  - ideas
featured: true
draft: false
---
# Body
`
    const { frontmatter, body } = parseBlogFrontmatter(raw)
    expectEqual(frontmatter.title, 'Hello', 'title')
    expectEqual(frontmatter.date, '2023-09-12', 'date')
    expectEqual(frontmatter.authorRole, 'Founder', 'role')
    expectEqual(frontmatter.featured, true, 'featured')
    expectEqual(frontmatter.draft, false, 'draft')
    expectEqual(frontmatter.tags.join(','), 'ideas', 'tags')
    if (!body.startsWith('# Body')) throw new Error(`body: ${body}`)
  })

  it('accepts only YYYY-MM-DD dates', () => {
    expectEqual(isValidPostDate('2023-09-12'), true, 'valid')
    expectEqual(isValidPostDate('09/12/2023'), false, 'slash')
    expectEqual(isValidPostDate(undefined), false, 'missing')
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

describe('formatBlogDate', () => {
  it('does not shift the calendar day', () => {
    expectEqual(formatBlogDate('2023-09-12'), 'September 12, 2023', 'date')
  })
})

describe('blog loader', () => {
  let dir: string
  const previousEnv = process.env.VERCEL_ENV

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moondao-blog-'))
    delete process.env.VERCEL_ENV
    resetBlogCache()
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
    if (previousEnv === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = previousEnv
    resetBlogCache()
  })

  it('sorts newest first and skips _template.md and README.md', () => {
    writePost(dir, '2024-01-01-older.md', '')
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
    const posts = listPosts(dir)
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
      listPosts(dir)
    } catch {
      threw = true
    }
    if (!threw) throw new Error('expected missing title to throw')

    resetBlogCache()
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
      listPosts(dir)
    } catch {
      threw = true
    }
    if (!threw) throw new Error('expected bad date to throw')
  })

  it('throws on a duplicate slug', () => {
    writePost(dir, '2024-01-01-same.md', '')
    writePost(dir, '2024-02-02-same.md', 'date: 2024-02-02\n')
    let threw = false
    try {
      listPosts(dir)
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
    expectEqual(listPosts(dir).length, 1, 'local shows draft')

    process.env.VERCEL_ENV = 'production'
    resetBlogCache()
    expectEqual(listPosts(dir).length, 0, 'production hides draft')
    expectEqual(getPost('draft', dir), null, 'production 404s draft')
    expectEqual(allBlogStaticPaths(dir).length, 0, 'production omits draft path')

    process.env.VERCEL_ENV = 'preview'
    resetBlogCache()
    expectEqual(listPosts(dir).length, 1, 'preview shows draft')
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
    const newest = getAdjacentPosts('last', dir)
    expectEqual(newest.prev, undefined, 'newest has no prev')
    expectEqual(newest.next?.slug, 'middle', 'newest next')

    const oldest = getAdjacentPosts('first', dir)
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
    expectEqual(featuredPost(dir)?.slug, 'new-feature', 'newest featured')
    expectEqual(
      Object.prototype.hasOwnProperty.call(featuredPost(dir) as object, 'body'),
      false,
      'featured meta has no body'
    )
  })
})

describe('blog rss', () => {
  it('emits a title and a permalink', () => {
    const xml = buildRssXml(
      [
        {
          slug: 'the-master-plan',
          filePath: '2023-09-12-the-master-plan.md',
          title: 'The Master Plan',
          description: 'An essay',
          date: '2023-09-12',
          author: 'Pablo',
          tags: [],
          featured: true,
          draft: false,
          readingMinutes: 20,
        },
      ],
      'https://moondao.com'
    )
    if (!xml.includes('<title>The Master Plan</title>')) throw new Error('missing title')
    if (!xml.includes('https://moondao.com/blog/the-master-plan')) throw new Error('missing link')
  })
})
