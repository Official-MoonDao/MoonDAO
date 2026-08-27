import { ArrowTopRightOnSquareIcon, EnvelopeIcon } from '@heroicons/react/24/outline'
import { GetStaticProps } from 'next'
import Link from 'next/link'
import React from 'react'
import { listPosts } from '@/lib/blog/loadPosts'
import type { BlogPostMeta } from '@/lib/blog/types'
import {
  BRAND_ASSETS,
  CAMPAIGN_PRESS_CONTACT_EMAIL,
  MEDIA_COVERAGE,
  PODCAST_APPEARANCES,
  PRESS_BOILERPLATE,
  PRESS_CONTACT_EMAIL,
  PRESS_FACTS,
  PRESS_IMAGERY,
  PRESS_RELEASES,
  SPOKESPEOPLE,
  VIDEO_APPEARANCES,
} from '@/lib/press/press-data'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import BlogPostCard from '@/components/blog/BlogPostCard'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import CoverageGrid from '@/components/press/CoverageGrid'
import MediaAppearances from '@/components/press/MediaAppearances'
import PressAbout from '@/components/press/PressAbout'
import PressKit from '@/components/press/PressKit'
import PressReleaseList from '@/components/press/PressReleaseList'
import PressSection from '@/components/press/PressSection'
import Spokespeople from '@/components/press/Spokespeople'

const sections = [
  { id: 'about', label: 'About' },
  { id: 'press-releases', label: 'Announcements' },
  { id: 'blog', label: 'From the blog' },
  { id: 'coverage', label: 'In the news' },
  { id: 'appearances', label: 'Podcasts & video' },
  { id: 'press-kit', label: 'Press kit' },
  { id: 'spokespeople', label: 'Spokespeople' },
  { id: 'contact', label: 'Contact' },
]

type PressProps = {
  recentPosts: BlogPostMeta[]
}

export default function Press({ recentPosts }: PressProps) {
  useChainDefault()

  return (
    <>
      <WebsiteHead
        title="Press"
        description="MoonDAO press releases, news coverage, and press kit. Logos, boilerplate, imagery, and media contacts for the Internet's Space Program."
        image="/assets/MoonDAO-OG.png"
      />
      <section className="mt-5 flex w-[90vw] animate-fadeIn flex-col items-start justify-start px-5 md:w-full">
        <Container>
          <ContentLayout
            header="Press"
            headerSize="40px"
            description={
              <div className="text-lg leading-relaxed text-gray-300">
                Announcements, media coverage, and downloadable assets for journalists writing about
                MoonDAO. For interviews, imagery, or comment, email{' '}
                <a
                  href={`mailto:${PRESS_CONTACT_EMAIL}`}
                  className="text-blue-300 underline underline-offset-4 hover:text-blue-200"
                >
                  {PRESS_CONTACT_EMAIL}
                </a>
                .
              </div>
            }
            mainPadding
            mode="compact"
            isProfile={true}
          >
            <div className="flex max-w-[1200px] flex-col gap-10 rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 p-6 shadow-2xl backdrop-blur-xl md:mb-[5vw] md:p-8 2xl:mb-[2vw]">
              <nav aria-label="Press page sections" className="flex flex-wrap gap-2">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="rounded-full border border-slate-600/40 px-4 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-400/60 hover:text-white"
                  >
                    {section.label}
                  </a>
                ))}
              </nav>

              <PressSection
                id="about"
                title="About MoonDAO"
                description="Boilerplate copy and key facts for journalists on deadline. Copy the boilerplate straight into your story."
              >
                <PressAbout boilerplate={PRESS_BOILERPLATE} facts={PRESS_FACTS} />
              </PressSection>

              <PressSection
                id="press-releases"
                title="Announcements & press releases"
                description="Major announcements from MoonDAO. Weekly project updates and governance notices are published to the newsletter."
                action={
                  <a
                    href="https://news.moondao.com/posts"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-shrink-0 items-center gap-2 text-sm font-medium text-blue-300 hover:text-blue-200"
                  >
                    Full newsletter archive
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                  </a>
                }
              >
                <PressReleaseList releases={PRESS_RELEASES} />
              </PressSection>

              {recentPosts.length > 0 && (
                <PressSection
                  id="blog"
                  title="From the blog"
                  description="Long-form essays and ideas from MoonDAO, published as markdown in the repo."
                  action={
                    <Link
                      href="/blog"
                      className="inline-flex flex-shrink-0 items-center gap-2 text-sm font-medium text-blue-300 hover:text-blue-200"
                    >
                      Read all posts
                    </Link>
                  }
                >
                  <div className="rounded-xl border border-white/10 px-5">
                    {recentPosts.map((post) => (
                      <BlogPostCard key={post.slug} post={post} />
                    ))}
                  </div>
                </PressSection>
              )}

              <PressSection
                id="coverage"
                title="In the news"
                description="Selected coverage of MoonDAO and its missions from outlets around the world."
              >
                <CoverageGrid coverage={MEDIA_COVERAGE} />
              </PressSection>

              <PressSection
                id="appearances"
                title="Podcasts & video"
                description="Long-form interviews and talks featuring MoonDAO's team and astronauts."
              >
                <MediaAppearances podcasts={PODCAST_APPEARANCES} videos={VIDEO_APPEARANCES} />
              </PressSection>

              <PressSection
                id="press-kit"
                title="Press kit"
                description="Logos and imagery cleared for editorial use."
              >
                <PressKit brandAssets={BRAND_ASSETS} imagery={PRESS_IMAGERY} />
              </PressSection>

              <PressSection
                id="spokespeople"
                title="Spokespeople"
                description="Available for interviews on decentralized space funding, lunar settlement, and citizen astronaut programs."
              >
                <Spokespeople people={SPOKESPEOPLE} />
              </PressSection>

              <section id="contact" className="scroll-mt-24">
                <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-6">
                  <h2 className="mb-3 font-GoodTimes text-xl text-white">Media enquiries</h2>
                  <p className="mb-4 text-sm leading-relaxed text-slate-300">
                    Looking to feature MoonDAO in an upcoming publication? Email{' '}
                    <a
                      href={`mailto:${PRESS_CONTACT_EMAIL}`}
                      className="text-blue-300 underline underline-offset-4 hover:text-blue-200"
                    >
                      {PRESS_CONTACT_EMAIL}
                    </a>{' '}
                    with details of your story and deadline. For the Send Frank to Space campaign,
                    contact Brodeur Partners at{' '}
                    <a
                      href={`mailto:${CAMPAIGN_PRESS_CONTACT_EMAIL}`}
                      className="text-blue-300 underline underline-offset-4 hover:text-blue-200"
                    >
                      {CAMPAIGN_PRESS_CONTACT_EMAIL}
                    </a>
                    .
                  </p>
                  <a
                    href={`mailto:${PRESS_CONTACT_EMAIL}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 font-medium text-white transition-all duration-200 hover:scale-105 hover:from-blue-600 hover:to-purple-600"
                  >
                    <EnvelopeIcon className="h-4 w-4" />
                    Contact the press team
                  </a>
                </div>
              </section>
            </div>
          </ContentLayout>
        </Container>
      </section>
      <NoticeFooter
        defaultTitle="Media Enquiries"
        defaultImage="../assets/MoonDAO-Logo-White.svg"
        defaultDescription="Writing about MoonDAO? Reach out for interviews, imagery, or comment from the team."
        defaultButtonText="Email the Press Team"
        defaultButtonLink={`mailto:${PRESS_CONTACT_EMAIL}`}
        citizenTitle="Media Enquiries"
        citizenImage="../assets/MoonDAO-Logo-White.svg"
        citizenDescription="Writing about MoonDAO? Reach out for interviews, imagery, or comment from the team."
        citizenButtonText="Email the Press Team"
        citizenButtonLink={`mailto:${PRESS_CONTACT_EMAIL}`}
      />
    </>
  )
}

export const getStaticProps: GetStaticProps<PressProps> = async () => {
  return {
    props: {
      recentPosts: listPosts().slice(0, 3),
    },
  }
}
