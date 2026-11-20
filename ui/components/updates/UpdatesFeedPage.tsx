import { DEPLOYED_ORIGIN } from 'const/config'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import type { FeedProps } from '@/lib/updates/loadFeed'
import { NEWSLETTER_ORIGIN } from '@/lib/updates/newsletter'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import WebsiteHead from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import UpdateCard from './UpdateCard'
import UpdateFeaturedCard from './UpdateFeaturedCard'
import UpdatesPanel from './UpdatesPanel'

const linkClass = 'text-blue-300 underline underline-offset-4 hover:text-blue-200'

const VARIANTS = {
  updates: {
    path: '/updates',
    title: 'Updates',
    description:
      "Announcements, mission updates, and long-form essays from MoonDAO, alongside every issue of the newsletter — the thinking behind the Internet's Space Program.",
    intro: (
      <>
        Announcements, essays and every newsletter issue.{' '}
        <a href={NEWSLETTER_ORIGIN} className={linkClass} target="_blank" rel="noopener noreferrer">
          Subscribe to the newsletter
        </a>
        .
      </>
    ),
  },
  news: {
    path: '/news',
    title: 'News',
    description:
      'Stay informed with the latest news and updates from MoonDAO: every newsletter issue and every announcement, mission update and essay in one place.',
    intro: (
      <>
        Every newsletter issue, alongside MoonDAO&apos;s announcements and essays.{' '}
        <a href={NEWSLETTER_ORIGIN} className={linkClass} target="_blank" rel="noopener noreferrer">
          Subscribe to the newsletter
        </a>
        .
      </>
    ),
  },
} as const

export type UpdatesFeedVariant = keyof typeof VARIANTS

/**
 * `/news` and `/updates` are the same list under two names, so a post shows up
 * in both. They share this page; only the heading copy differs.
 */
export default function UpdatesFeedPage({
  entries,
  featured,
  variant,
}: FeedProps & { variant: UpdatesFeedVariant }) {
  useChainDefault()
  const page = VARIANTS[variant]
  const rest = featured ? entries.filter((entry) => entry.slug !== featured.slug) : entries

  return (
    <>
      <WebsiteHead
        title={page.title}
        description={page.description}
        image="/assets/MoonDAO-OG.png"
        canonical={`${DEPLOYED_ORIGIN}${page.path}`}
      >
        <link
          rel="alternate"
          type="application/rss+xml"
          title="MoonDAO Updates"
          href="/updates/rss.xml"
        />
      </WebsiteHead>
      <section className="mt-5 flex w-[90vw] animate-fadeIn flex-col items-start justify-start px-5 md:w-full">
        <Container>
          <ContentLayout
            header={page.title}
            headerSize="40px"
            description={<p className="text-sm text-white/60 md:text-base">{page.intro}</p>}
            mainPadding
            mode="compact"
            isProfile={true}
          >
            <UpdatesPanel className="flex flex-col gap-10 p-6 md:p-8">
              {entries.length === 0 ? (
                <p className="text-slate-300">Nothing published yet. Check back soon.</p>
              ) : (
                <>
                  {featured && <UpdateFeaturedCard update={featured} />}
                  <div>
                    {rest.map((entry) => (
                      <UpdateCard key={entry.slug} update={entry} />
                    ))}
                  </div>
                </>
              )}
            </UpdatesPanel>
          </ContentLayout>
        </Container>
      </section>
      <NoticeFooter
        defaultTitle="Follow the mission"
        defaultImage="../assets/MoonDAO-Logo-White.svg"
        defaultDescription="Get weekly updates from MoonDAO — missions, governance, and what we're building next."
        defaultButtonText="Subscribe to the newsletter"
        defaultButtonLink={NEWSLETTER_ORIGIN}
        citizenTitle="Follow the mission"
        citizenImage="../assets/MoonDAO-Logo-White.svg"
        citizenDescription="Get weekly updates from MoonDAO — missions, governance, and what we're building next."
        citizenButtonText="Subscribe to the newsletter"
        citizenButtonLink={NEWSLETTER_ORIGIN}
      />
    </>
  )
}
