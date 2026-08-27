/**
 * `category` is free text so one feed can hold announcements, press releases,
 * and long-form essays. It is rendered as a label; nothing branches on it.
 */
export type UpdateCategory = string

export type UpdateFrontmatter = {
  title?: string
  description?: string
  date?: string
  author?: string
  authorRole?: string
  image?: string
  category?: UpdateCategory
  tags: string[]
  featured: boolean
  draft: boolean
}

export type UpdateMeta = {
  slug: string
  filePath: string
  title: string
  description: string
  date: string
  author: string
  authorRole?: string
  image?: string
  category: UpdateCategory
  tags: string[]
  featured: boolean
  draft: boolean
  readingMinutes: number
}

export type Update = UpdateMeta & { body: string }

export const DEFAULT_CATEGORY = 'Update'
