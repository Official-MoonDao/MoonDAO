import { DEPLOYED_ORIGIN } from 'const/config'
import { GetStaticProps } from 'next'
import Link from 'next/link'
import { featuredPost, listPosts } from '@/lib/blog/loadPosts'
import type { BlogPostMeta } from '@/lib/blog/types'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import BlogFeaturedCard from '@/components/blog/BlogFeaturedCard'
import BlogPostCard from '@/components/blog/BlogPostCard'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import WebsiteHead from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

type BlogIndexProps = {
  posts: BlogPostMeta[]
  featured: BlogPostMeta | null
}

export default function BlogIndex({ posts, featured }: BlogIndexProps) {
  useChainDefault()
  const rest = featured ? posts.filter((post) => post.slug !== featured.slug) : posts

  return (
    <>
      <WebsiteHead
        title="Blog"
        description="Long-form updates and essays from MoonDAO — ideas, mission retrospectives, and the thinking behind the Internet's Space Program."
        image="/assets/MoonDAO-OG.png"
        canonical={`${DEPLOYED_ORIGIN}/blog`}
      >
        <link
          rel="alternate"
          type="application/rss+xml"
          title="MoonDAO Blog"
          href="/blog/rss.xml"
        />
      </WebsiteHead>
      <section className="mt-5 flex w-[90vw] animate-fadeIn flex-col items-start justify-start px-5 md:w-full">
        <Container>
          <ContentLayout
            header="Blog"
            headerSize="40px"
            description={
              <div className="text-lg leading-relaxed text-gray-300">
                Essays and long-form updates from MoonDAO. For weekly operational notes, see the{' '}
                <Link
                  href="/news"
                  className="text-blue-300 underline underline-offset-4 hover:text-blue-200"
                >
                  newsletter
                </Link>
                . For journalists, visit{' '}
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
            <div className="flex max-w-[1200px] flex-col gap-10 rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 p-6 shadow-2xl backdrop-blur-xl md:mb-[5vw] md:p-8 2xl:mb-[2vw]">
              {posts.length === 0 ? (
                <p className="text-slate-300">No posts yet. Check back soon.</p>
              ) : (
                <>
                  {featured && <BlogFeaturedCard post={featured} />}
                  <div>
                    {rest.map((post) => (
                      <BlogPostCard key={post.slug} post={post} />
                    ))}
                  </div>
                </>
              )}
            </div>
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

export const getStaticProps: GetStaticProps<BlogIndexProps> = async () => {
  const posts = listPosts()
  return {
    props: {
      posts,
      featured: featuredPost() || null,
    },
  }
}
