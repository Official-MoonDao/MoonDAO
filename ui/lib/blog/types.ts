export type BlogFrontmatter = {
  title?: string
  description?: string
  date?: string
  author?: string
  authorRole?: string
  image?: string
  tags: string[]
  featured: boolean
  draft: boolean
}

export type BlogPostMeta = {
  slug: string
  filePath: string
  title: string
  description: string
  date: string
  author: string
  authorRole?: string
  image?: string
  tags: string[]
  featured: boolean
  draft: boolean
  readingMinutes: number
}

export type BlogPost = BlogPostMeta & { body: string }
