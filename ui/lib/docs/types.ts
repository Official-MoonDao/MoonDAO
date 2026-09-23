export type DocsPageKind = 'doc' | 'folder' | 'tag'

export type DocsFrontmatter = {
  title?: string
  description?: string
  tags: string[]
  keywords: string[]
  aliases: string[]
  slug?: string
  sidebar_label?: string
  sidebar_position?: number
  id?: string
  author?: string
}

export type DocsFile = {
  /** Vault-relative path using original filenames, e.g. `About/FAQ.md`. */
  filePath: string
  /** Quartz-compatible slug, e.g. `About/FAQ`. Home is `index`. */
  slug: string
  frontmatter: DocsFrontmatter
  body: string
}

export type DocsNavNode = {
  name: string
  label: string
  href: string
  slug: string
  position: number
  children: DocsNavNode[]
}

export type DocsTocItem = {
  depth: number
  text: string
  id: string
}

export type DocsBacklink = {
  title: string
  href: string
  slug: string
}

export type DocsPageProps = {
  kind: DocsPageKind
  slug: string
  title: string
  description: string
  keywords: string[]
  tags: string[]
  body: string
  breadcrumbs: { title: string; href: string }[]
  toc: DocsTocItem[]
  backlinks: DocsBacklink[]
}

export type DocsSearchEntry = {
  title: string
  slug: string
  href: string
  description: string
  headings: string[]
  body: string
  category: string
}
