import Link from 'next/link'
import formatBlogDate from '@/lib/blog/formatBlogDate'
import type { BlogPostMeta } from '@/lib/blog/types'

export default function BlogPostCard({ post }: { post: BlogPostMeta }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block border-b border-white/10 py-6 last:border-b-0"
    >
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-RobotoMono text-xs uppercase tracking-[0.2em] text-slate-400">
            <time dateTime={post.date}>{formatBlogDate(post.date)}</time>
            <span aria-hidden className="text-slate-600">
              /
            </span>
            <span>{post.readingMinutes} min read</span>
          </div>
          <h3 className="mt-2 font-GoodTimes text-lg leading-snug text-white transition-colors group-hover:text-slate-200 md:text-xl">
            {post.title}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
            {post.description}
          </p>
          <p className="mt-3 text-xs text-slate-400">
            {post.author}
            {post.authorRole ? ` · ${post.authorRole}` : ''}
          </p>
        </div>
        {post.image && (
          <img
            src={post.image}
            alt=""
            className="hidden h-24 w-36 flex-shrink-0 rounded-lg object-cover sm:block"
          />
        )}
      </div>
    </Link>
  )
}
