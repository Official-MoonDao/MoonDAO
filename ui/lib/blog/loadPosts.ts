/**
 * Server-only. Import from `getStaticProps` / scripts, never from a component.
 * `next.config.js` sets `resolve.fallback.fs = false` for the client bundle.
 */
import fs from 'fs'
import path from 'path'
import { isValidPostDate, parseBlogFrontmatter } from './frontmatter'
import { readingMinutes } from './readingTime'
import type { BlogPost, BlogPostMeta } from './types'

export const BLOG_ROOT = path.join(process.cwd(), 'content', 'blog')

type Corpus = {
  posts: BlogPost[]
  bySlug: Map<string, BlogPost>
}

let cached: Corpus | null = null
let cachedRoot: string | null = null

export function resetBlogCache(): void {
  cached = null
  cachedRoot = null
}

function slugFromFilename(fileName: string): string {
  const base = fileName.replace(/\.md$/i, '')
  const dated = base.match(/^\d{4}-\d{2}-\d{2}-(.+)$/)
  return dated ? dated[1] : base
}

function isPublishedBuild(): boolean {
  // Vercel sets this automatically. NODE_ENV is "production" on preview
  // builds too, and NEXT_PUBLIC_CHAIN reports mainnet even locally (see
  // const/flags.ts), so neither can decide whether to hide drafts.
  return process.env.VERCEL_ENV === 'production'
}

function includeDrafts(): boolean {
  return !isPublishedBuild()
}

function loadCorpus(root: string = BLOG_ROOT): Corpus {
  if (cached && cachedRoot === root) return cached
  if (!fs.existsSync(root)) {
    const empty: Corpus = { posts: [], bySlug: new Map() }
    cached = empty
    cachedRoot = root
    return empty
  }

  const files = fs
    .readdirSync(root, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith('.md') &&
        !entry.name.startsWith('_') &&
        entry.name.toLowerCase() !== 'readme.md'
    )
    .map((entry) => entry.name)

  const posts: BlogPost[] = []
  const bySlug = new Map<string, BlogPost>()

  for (const fileName of files) {
    const filePath = path.join(root, fileName)
    const raw = fs.readFileSync(filePath, 'utf8')
    const { frontmatter, body } = parseBlogFrontmatter(raw)
    const slug = slugFromFilename(fileName)

    if (!frontmatter.title) {
      throw new Error(`Blog post ${fileName} is missing a title`)
    }
    if (!frontmatter.description) {
      throw new Error(`Blog post ${fileName} is missing a description`)
    }
    if (!isValidPostDate(frontmatter.date)) {
      throw new Error(`Blog post ${fileName} is missing a valid YYYY-MM-DD date`)
    }
    if (!frontmatter.author) {
      throw new Error(`Blog post ${fileName} is missing an author`)
    }
    if (bySlug.has(slug)) {
      throw new Error(`Duplicate blog slug "${slug}" (from ${fileName})`)
    }

    const post: BlogPost = {
      slug,
      filePath: fileName,
      title: frontmatter.title,
      description: frontmatter.description,
      date: frontmatter.date,
      author: frontmatter.author,
      authorRole: frontmatter.authorRole,
      image: frontmatter.image,
      tags: frontmatter.tags,
      featured: frontmatter.featured,
      draft: frontmatter.draft,
      readingMinutes: readingMinutes(body),
      body,
    }

    posts.push(post)
    bySlug.set(slug, post)
  }

  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)))

  const corpus = { posts, bySlug }
  cached = corpus
  cachedRoot = root
  return corpus
}

function visiblePosts(root?: string): BlogPost[] {
  const { posts } = loadCorpus(root)
  if (includeDrafts()) return posts
  return posts.filter((post) => !post.draft)
}

function toMeta(post: BlogPost): BlogPostMeta {
  const { body: _body, ...meta } = post
  return meta
}

export function listPosts(root?: string): BlogPostMeta[] {
  return visiblePosts(root).map(toMeta)
}

export function getPost(slug: string, root?: string): BlogPost | null {
  const post = loadCorpus(root).bySlug.get(slug)
  if (!post) return null
  if (post.draft && !includeDrafts()) return null
  return post
}

export function getAdjacentPosts(
  slug: string,
  root?: string
): { prev?: BlogPostMeta; next?: BlogPostMeta } {
  const posts = visiblePosts(root)
  const index = posts.findIndex((post) => post.slug === slug)
  if (index === -1) return {}
  return {
    // Newest-first: "next" is older (further down the list), "prev" is newer.
    prev: posts[index - 1] ? toMeta(posts[index - 1]) : undefined,
    next: posts[index + 1] ? toMeta(posts[index + 1]) : undefined,
  }
}

export function featuredPost(root?: string): BlogPostMeta | undefined {
  const post = visiblePosts(root).find((entry) => entry.featured)
  return post ? toMeta(post) : undefined
}

export function allBlogStaticPaths(root?: string): { params: { slug: string } }[] {
  return visiblePosts(root).map((post) => ({ params: { slug: post.slug } }))
}

export { slugFromFilename }
