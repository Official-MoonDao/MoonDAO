import WebsiteHead from '@/components/layout/Head'
import type { DocsPageProps } from '@/lib/docs/types'
import DocsLayout from './DocsLayout'

export default function DocsPage({ page }: { page: DocsPageProps }) {
  return (
    <>
      <WebsiteHead
        title={page.title}
        description={page.description || `${page.title} — MoonDAO documentation`}
        keywords={page.keywords.join(', ')}
      />
      <DocsLayout page={page} />
    </>
  )
}
