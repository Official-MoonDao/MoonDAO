import { DEPLOYED_ORIGIN } from 'const/config'
import { GetStaticPaths, GetStaticProps } from 'next'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import { loadNewsletterPosts } from '@/lib/updates/loadFeed'
import { allUpdateStaticPaths, getUpdate, listUpdates } from '@/lib/updates/loadUpdates'
import { mergeFeed, standaloneIssues } from '@/lib/updates/newsletter'
import {
  isNewsletterSlug,
  listNewsletterBodySlugs,
  loadNewsletterIssue,
} from '@/lib/updates/newsletterIssues'
import snapshot from '@/lib/updates/newsletterSnapshot.json'
import type { Update, UpdateMeta } from '@/lib/updates/types'
import Container from '@/components/layout/Container'
import WebsiteHead from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import ScrollProgress from '@/components/updates/ScrollProgress'
import UpdateFooter from '@/components/updates/UpdateFooter'
import UpdateHeader from '@/components/updates/UpdateHeader'
import UpdateMarkdown from '@/components/updates/UpdateMarkdown'
import UpdateToc from '@/components/updates/UpdateToc'
import UpdatesPanel from '@/components/updates/UpdatesPanel'

type UpdatePageProps = {
  update: Update
  prev: UpdateMeta | null
  next: UpdateMeta | null
}

const ARTICLE_ID = 'update-body'

export default function UpdatePage({ update, prev, next }: UpdatePageProps) {
  useChainDefault()
  const hasToc = (update.body.match(/^## /gm) || []).length >= 3

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
            <div
              className={
                hasToc ? 'mt-12 xl:grid xl:grid-cols-[200px_minmax(0,1fr)] xl:gap-14' : 'mt-12'
              }
            >
              {hasToc && (
                <div className="hidden xl:block">
                  <UpdateToc articleId={ARTICLE_ID} />
                </div>
              )}
              <div
                id={ARTICLE_ID}
                className={`mx-auto w-full max-w-[760px] ${hasToc ? 'xl:mx-0' : ''}`}
              >
                <UpdateMarkdown body={update.body} />
                <UpdateFooter
                  tags={update.tags}
                  prev={prev || undefined}
                  next={next || undefined}
                />
              </div>
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

/** How often an issue rendered on demand, or a miss, is looked up again. */
const ISSUE_RETRY_SECONDS = 3600

/**
 * Updates posts and every synced newsletter issue are built ahead of time. An
 * issue sent after the last `yarn sync:newsletter` renders on first request
 * (`fallback: 'blocking'`), from the Kit API.
 */
export const getStaticPaths: GetStaticPaths = async () => {
  const synced = listNewsletterBodySlugs()
  const issues = standaloneIssues(listUpdates(), snapshot)
    .filter((post) => synced.has(post.slug))
    .map((post) => ({ params: { slug: post.slug } }))
  return {
    paths: [...allUpdateStaticPaths(), ...issues],
    fallback: 'blocking',
  }
}

function adjacent(entries: UpdateMeta[], slug: string) {
  const index = entries.findIndex((entry) => entry.slug === slug)
  if (index === -1) return { prev: null, next: null }
  // Newest-first: "next" is older (further down the list), "prev" is newer.
  return { prev: entries[index - 1] || null, next: entries[index + 1] || null }
}

export const getStaticProps: GetStaticProps<UpdatePageProps> = async ({ params }) => {
  const slug = typeof params?.slug === 'string' ? params.slug : ''
  const updates = listUpdates()
  const update = getUpdate(slug)
  if (update) {
    const posts = await loadNewsletterPosts()
    return { props: { update, ...adjacent(mergeFeed(updates, posts), slug) } }
  }

  // An issue that was also published as an Updates post opens the post.
  const mirror = updates.find((entry) => entry.newsletter === slug)
  if (mirror) {
    return { redirect: { destination: `/updates/${mirror.slug}`, permanent: true } }
  }

  if (!isNewsletterSlug(slug)) return { notFound: true }
  const posts = await loadNewsletterPosts()
  const post = posts.find((entry) => entry.slug === slug)
  if (!post) return { notFound: true, revalidate: ISSUE_RETRY_SECONDS }

  let issue: Update | null = null
  try {
    issue = await loadNewsletterIssue(post)
  } catch (error) {
    console.warn(`[updates] could not load newsletter issue ${slug}:`, error)
  }
  // Without a body (no API key, or Kit is down), send readers to the email.
  if (!issue) {
    return {
      redirect: { destination: post.url, permanent: false },
      revalidate: ISSUE_RETRY_SECONDS,
    }
  }

  return { props: { update: issue, ...adjacent(mergeFeed(updates, posts), slug) } }
}
