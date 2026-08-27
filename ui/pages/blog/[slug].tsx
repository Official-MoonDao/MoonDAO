import { DEPLOYED_ORIGIN } from 'const/config'
import { GetStaticPaths, GetStaticProps } from 'next'
import { allBlogStaticPaths, getAdjacentPosts, getPost } from '@/lib/blog/loadPosts'
import type { BlogPost, BlogPostMeta } from '@/lib/blog/types'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import BlogMarkdown from '@/components/blog/BlogMarkdown'
import BlogPostFooter from '@/components/blog/BlogPostFooter'
import BlogPostHeader from '@/components/blog/BlogPostHeader'
import BlogScrollProgress from '@/components/blog/BlogScrollProgress'
import Container from '@/components/layout/Container'
import WebsiteHead from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

type BlogPostPageProps = {
  post: BlogPost
  prev: BlogPostMeta | null
  next: BlogPostMeta | null
}

export default function BlogPostPage({ post, prev, next }: BlogPostPageProps) {
  useChainDefault()

  return (
    <>
      <WebsiteHead
        title={post.title}
        description={post.description}
        image={post.image || '/assets/MoonDAO-OG.png'}
        keywords={post.tags.join(', ')}
        author={post.author}
        canonical={`${DEPLOYED_ORIGIN}/blog/${post.slug}`}
        ogType="article"
      >
        <meta property="article:published_time" content={`${post.date}T00:00:00.000Z`} />
        <meta property="article:author" content={post.author} />
      </WebsiteHead>
      <BlogScrollProgress />
      <section className="mt-5 flex w-[90vw] animate-fadeIn flex-col items-start justify-start px-5 md:w-full">
        <Container>
          <div className="mx-auto w-full max-w-[760px] rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900 via-blue-900/20 to-purple-900/10 px-5 py-10 shadow-2xl backdrop-blur-xl md:mb-[5vw] md:px-12 md:py-14 2xl:mb-[2vw]">
            <BlogPostHeader post={post} />
            <BlogMarkdown body={post.body} />
            <BlogPostFooter tags={post.tags} prev={prev || undefined} next={next || undefined} />
          </div>
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
    paths: allBlogStaticPaths(),
    fallback: false,
  }
}

export const getStaticProps: GetStaticProps<BlogPostPageProps> = async ({ params }) => {
  const slug = typeof params?.slug === 'string' ? params.slug : ''
  const post = getPost(slug)
  if (!post) return { notFound: true }

  const adjacent = getAdjacentPosts(slug)
  return {
    props: {
      post,
      prev: adjacent.prev || null,
      next: adjacent.next || null,
    },
  }
}
