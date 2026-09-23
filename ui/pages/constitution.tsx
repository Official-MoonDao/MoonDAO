import { GetStaticProps } from 'next'
import DocsPage from '@/components/docs/DocsPage'
import { getDocStaticProps } from '@/lib/docs/loadDocs'
import type { DocsPageProps } from '@/lib/docs/types'

export default DocsPage

export const getStaticProps: GetStaticProps<{ page: DocsPageProps }> = async () => {
  return getDocStaticProps('Governance/Constitution')
}
