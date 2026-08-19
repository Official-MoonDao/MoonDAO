import { GetStaticPaths, GetStaticProps } from 'next'
import DocsPage from '@/components/docs/DocsPage'
import { allStaticPaths, getDocStaticPropsFromParams } from '@/lib/docs/loadDocs'
import type { DocsPageProps } from '@/lib/docs/types'

export default DocsPage

export const getStaticPaths: GetStaticPaths = async () => {
  // TEMPORARY BISECT: emit one path instead of ~190 to test whether the Vercel
  // deploy failure scales with prerendered page count. Revert.
  const all = allStaticPaths()
  const paths = process.env.DOCS_BISECT_MINIMAL === '1' ? all.slice(0, 1) : all
  return {
    paths,
    fallback: false,
  }
}

export const getStaticProps: GetStaticProps<{ page: DocsPageProps }> = async ({ params }) => {
  return getDocStaticPropsFromParams({
    slug: params?.slug as string[] | undefined,
  })
}
