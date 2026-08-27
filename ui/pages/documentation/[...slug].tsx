import { GetStaticPaths, GetStaticProps } from 'next'
import DocsPage from '@/components/docs/DocsPage'
import { allStaticPaths, getDocStaticPropsFromParams } from '@/lib/docs/loadDocs'
import type { DocsPageProps } from '@/lib/docs/types'

/**
 * Required catch-all, deliberately not the optional `[[...slug]]` form: an
 * optional catch-all here fails the Vercel deploy (it interacts badly with the
 * `i18n` config in next.config.js), even when only one page is prerendered.
 * `/docs` itself is served by `pages/docs/index.tsx`.
 * See docs/DOCUMENTATION_EMBEDDING_VERIFICATION.md.
 */
export default DocsPage

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: allStaticPaths(),
    fallback: false,
  }
}

export const getStaticProps: GetStaticProps<{ page: DocsPageProps }> = async ({ params }) => {
  return getDocStaticPropsFromParams({
    slug: params?.slug as string[] | undefined,
  })
}
