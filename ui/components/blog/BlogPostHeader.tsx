import { LinkIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import toast from 'react-hot-toast'
import formatBlogDate from '@/lib/blog/formatBlogDate'
import type { BlogPostMeta } from '@/lib/blog/types'

export default function BlogPostHeader({ post }: { post: BlogPostMeta }) {
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy link')
    }
  }

  return (
    <header className="mb-10">
      <Link href="/blog" className="text-sm font-medium text-blue-300 hover:text-blue-200">
        ← All posts
      </Link>
      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 font-RobotoMono text-xs uppercase tracking-[0.2em] text-slate-400">
        <time dateTime={post.date}>{formatBlogDate(post.date)}</time>
        <span aria-hidden className="text-slate-600">
          /
        </span>
        <span>{post.readingMinutes} min read</span>
      </div>
      <h1 className="mt-4 font-GoodTimes text-3xl leading-tight text-white md:text-5xl">
        {post.title}
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-slate-300 md:text-xl">{post.description}</p>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-white/10 py-4">
        <p className="text-sm text-slate-300">
          <span className="text-white">{post.author}</span>
          {post.authorRole ? <span className="text-slate-400"> · {post.authorRole}</span> : null}
        </p>
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
        >
          <LinkIcon className="h-4 w-4" />
          Copy link
        </button>
      </div>
      {post.image && (
        <img
          src={post.image}
          alt=""
          className="mt-8 w-full rounded-2xl object-cover md:max-h-[420px]"
        />
      )}
    </header>
  )
}
