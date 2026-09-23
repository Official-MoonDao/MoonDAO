import { GetStaticProps } from 'next'
import DocsPage from '@/components/docs/DocsPage'
import { getDocStaticProps } from '@/lib/docs/loadDocs'
import type { DocsPageProps } from '@/lib/docs/types'

/**
 * `/docs` — the documentation home. A separate page rather than the empty-slug
 * case of an optional catch-all, because `[[...slug]]` breaks the Vercel deploy
 * under this app's `i18n` config. See `pages/docs/[...slug].tsx`.
 */
export default DocsPage

export const getStaticProps: GetStaticProps<{ page: DocsPageProps }> = async () => {
  return getDocStaticProps('index')
}
