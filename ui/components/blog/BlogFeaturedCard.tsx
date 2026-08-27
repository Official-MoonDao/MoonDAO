import Link from 'next/link'
import formatBlogDate from '@/lib/blog/formatBlogDate'
import type { BlogPostMeta } from '@/lib/blog/types'

export default function BlogFeaturedCard({ post }: { post: BlogPostMeta }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-600/20 to-purple-600/20 transition-all duration-200 hover:border-blue-400/50"
    >
      {post.image && <img src={post.image} alt="" className="h-56 w-full object-cover md:h-72" />}
      <div className="p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-RobotoMono text-xs uppercase tracking-[0.2em] text-slate-400">
          <span className="text-blue-300">Featured</span>
          <span aria-hidden className="text-slate-600">
            /
          </span>
          <time dateTime={post.date}>{formatBlogDate(post.date)}</time>
          <span aria-hidden className="text-slate-600">
            /
          </span>
          <span>{post.readingMinutes} min read</span>
        </div>
        <h2 className="mt-3 font-GoodTimes text-2xl leading-snug text-white transition-colors group-hover:text-slate-200 md:text-3xl">
          {post.title}
        </h2>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-300">
          {post.description}
        </p>
        <p className="mt-4 text-sm text-slate-400">
          {post.author}
          {post.authorRole ? ` · ${post.authorRole}` : ''}
        </p>
      </div>
    </Link>
  )
}
