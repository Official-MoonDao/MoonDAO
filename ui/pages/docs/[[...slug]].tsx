import { GetStaticPaths, GetStaticProps } from 'next'
import DocsPage from '@/components/docs/DocsPage'
import { allStaticPaths, getDocStaticPropsFromParams } from '@/lib/docs/loadDocs'
import type { DocsPageProps } from '@/lib/docs/types'

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
