import { DEPLOYED_ORIGIN } from 'const/config'
import { GetStaticProps } from 'next'
import Link from 'next/link'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import { featuredUpdate, listUpdates } from '@/lib/updates/loadUpdates'
import type { UpdateMeta } from '@/lib/updates/types'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import WebsiteHead from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import UpdateCard from '@/components/updates/UpdateCard'
import UpdateFeaturedCard from '@/components/updates/UpdateFeaturedCard'
import UpdatesPanel from '@/components/updates/UpdatesPanel'

type UpdatesIndexProps = {
  updates: UpdateMeta[]
  featured: UpdateMeta | null
}

export default function UpdatesIndex({ updates, featured }: UpdatesIndexProps) {
  useChainDefault()
  const rest = featured ? updates.filter((update) => update.slug !== featured.slug) : updates

  return (
    <>
      <WebsiteHead
        title="Updates"
        description="Announcements, mission updates, and long-form essays from MoonDAO — the thinking behind the Internet's Space Program."
        image="/assets/MoonDAO-OG.png"
        canonical={`${DEPLOYED_ORIGIN}/updates`}
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
            header="Updates"
            headerSize="40px"
            description={
              <div className="text-lg leading-relaxed text-gray-300">
                Announcements, mission updates, and long-form essays from MoonDAO. For the weekly
                email, see the{' '}
                <Link
                  href="/news"
                  className="text-blue-300 underline underline-offset-4 hover:text-blue-200"
                >
                  newsletter
                </Link>
                . For media enquiries and our press kit, visit{' '}
                <Link
                  href="/press"
                  className="text-blue-300 underline underline-offset-4 hover:text-blue-200"
                >
                  Press
                </Link>
                .
              </div>
            }
            mainPadding
            mode="compact"
            isProfile={true}
          >
            <UpdatesPanel className="flex flex-col gap-10 p-6 md:p-8">
              {updates.length === 0 ? (
                <p className="text-slate-300">Nothing published yet. Check back soon.</p>
              ) : (
                <>
                  {featured && <UpdateFeaturedCard update={featured} />}
                  <div>
                    {rest.map((update) => (
                      <UpdateCard key={update.slug} update={update} />
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

export const getStaticProps: GetStaticProps<UpdatesIndexProps> = async () => {
  return {
    props: {
      updates: listUpdates(),
      featured: featuredUpdate() || null,
    },
  }
}
