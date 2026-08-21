import { extractTitle } from './frontmatter'
import { loadCorpus } from './loadDocs'
import { docsHref } from './slug'
import type { DocsSearchEntry } from './types'

function plainText(body: string): string {
  return body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*_`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildSearchIndex(root?: string): DocsSearchEntry[] {
  const corpus = loadCorpus(root)
  return corpus.files.map((file) => {
    const title = extractTitle(file.filePath, file.frontmatter, file.body)
    const headings = [...file.body.matchAll(/^#{1,3}\s+(.+)$/gm)].map((m) =>
      m[1].replace(/[*_`]/g, '').trim()
    )
    const body = plainText(file.body)
    return {
      title,
      slug: file.slug,
      href: docsHref(file.slug),
      description: file.frontmatter.description || body.slice(0, 180),
      headings,
      body: body.slice(0, 4000),
      category: file.slug.split('/')[0] || 'Docs',
    }
  })
}
