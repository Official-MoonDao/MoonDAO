import { DEPLOYED_ORIGIN } from 'const/config'
import { GetStaticPaths, GetStaticProps } from 'next'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import { allUpdateStaticPaths, getAdjacentUpdates, getUpdate } from '@/lib/updates/loadUpdates'
import type { Update, UpdateMeta } from '@/lib/updates/types'
import Container from '@/components/layout/Container'
import WebsiteHead from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import ScrollProgress from '@/components/updates/ScrollProgress'
import UpdateFooter from '@/components/updates/UpdateFooter'
import UpdateHeader from '@/components/updates/UpdateHeader'
import UpdateMarkdown from '@/components/updates/UpdateMarkdown'
import UpdatesPanel from '@/components/updates/UpdatesPanel'

type UpdatePageProps = {
  update: Update
  prev: UpdateMeta | null
  next: UpdateMeta | null
}

export default function UpdatePage({ update, prev, next }: UpdatePageProps) {
  useChainDefault()

  return (
    <>
      <WebsiteHead
        title={update.title}
        description={update.description}
        image={update.image || '/assets/MoonDAO-OG.png'}
        keywords={[update.category, ...update.tags].join(', ')}
        author={update.author}
        canonical={`${DEPLOYED_ORIGIN}/updates/${update.slug}`}
        ogType="article"
      >
        <meta property="article:published_time" content={`${update.date}T00:00:00.000Z`} />
        <meta property="article:author" content={update.author} />
        <meta property="article:section" content={update.category} />
      </WebsiteHead>
      <ScrollProgress />
      <section className="mt-5 flex w-[90vw] animate-fadeIn flex-col items-start justify-start px-5 md:w-full">
        <Container>
          <UpdatesPanel className="px-5 py-10 md:px-12 md:py-14">
            <UpdateHeader update={update} />
            <UpdateMarkdown body={update.body} />
            <div className="mx-auto w-full max-w-[85ch]">
              <UpdateFooter tags={update.tags} prev={prev || undefined} next={next || undefined} />
            </div>
          </UpdatesPanel>
        </Container>
      </section>
      <NoticeFooter
        defaultTitle="Follow the mission"
        defaultImage="../assets/MoonDAO-Logo-White.svg"
        defaultDescription="Get weekly updates from MoonDAO — missions, governance, and what we're building next."
        defaultButtonText="Read the newsletter"
        defaultButtonLink="/news"
        citizenTitle="Follow the mission"
        citizenImage="../assets/MoonDAO-Logo-White.svg"
        citizenDescription="Get weekly updates from MoonDAO — missions, governance, and what we're building next."
        citizenButtonText="Read the newsletter"
        citizenButtonLink="/news"
      />
    </>
  )
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: allUpdateStaticPaths(),
    fallback: false,
  }
}

export const getStaticProps: GetStaticProps<UpdatePageProps> = async ({ params }) => {
  const slug = typeof params?.slug === 'string' ? params.slug : ''
  const update = getUpdate(slug)
  if (!update) return { notFound: true }

  const adjacent = getAdjacentUpdates(slug)
  return {
    props: {
      update,
      prev: adjacent.prev || null,
      next: adjacent.next || null,
    },
  }
}
