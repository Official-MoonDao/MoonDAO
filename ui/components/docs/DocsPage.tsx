import { DEPLOYED_ORIGIN } from 'const/config'
import WebsiteHead from '@/components/layout/Head'
import { docsHref } from '@/lib/docs/slug'
import type { DocsPageProps } from '@/lib/docs/types'
import DocsLayout from './DocsLayout'

export default function DocsPage({ page }: { page: DocsPageProps }) {
  // Several routes serve the same page: the short routes (/faq), the frontmatter
  // alias slugs (/docs/tts-sweepstakes-rules), and the canonical
  // /docs/<slug>. Point them all at the canonical one.
  const canonical = `${DEPLOYED_ORIGIN}${docsHref(page.slug)}`

  return (
    <>
      <WebsiteHead
        title={page.title}
        description={page.description || `${page.title} — MoonDAO documentation`}
        keywords={page.keywords.join(', ')}
        canonical={canonical}
      />
      <DocsLayout page={page} />
    </>
  )
}
