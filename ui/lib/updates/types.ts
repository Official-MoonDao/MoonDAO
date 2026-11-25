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
  imageAlt?: string
  imageCaption?: string
  category?: UpdateCategory
  tags: string[]
  featured: boolean
  draft: boolean
  /** Slug of a newsletter issue that sent this same post; the feed lists only the post. */
  newsletter?: string
}

export type UpdateMeta = {
  slug: string
  filePath: string
  title: string
  description: string
  date: string
  author: string
  authorRole?: string | null
  image?: string | null
  imageAlt?: string | null
  imageCaption?: string | null
  category: UpdateCategory
  tags: string[]
  featured: boolean
  draft: boolean
  readingMinutes: number
  /**
   * Set on entries that live elsewhere. Cards link to it instead of
   * `/updates/<slug>`.
   */
  externalUrl?: string | null
  /** `newsletter` for an issue from the Kit archive, rendered at `/updates/<slug>`. */
  source?: 'newsletter' | null
  /** On an Updates post: the newsletter issue that sent the same post. */
  newsletter?: string | null
}

export type Update = UpdateMeta & { body: string }

export const DEFAULT_CATEGORY = 'Update'
