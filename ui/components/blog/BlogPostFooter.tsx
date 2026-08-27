import Link from 'next/link'
import type { BlogPostMeta } from '@/lib/blog/types'

export default function BlogPostFooter({
  tags,
  prev,
  next,
}: {
  tags: string[]
  prev?: BlogPostMeta
  next?: BlogPostMeta
}) {
  return (
    <footer className="mx-auto mt-16 w-full max-w-[68ch]">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-slate-600/40 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-300"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {(prev || next) && (
        <nav
          aria-label="Adjacent posts"
          className="mt-10 grid grid-cols-1 gap-4 border-t border-white/10 pt-8 sm:grid-cols-2"
        >
          {prev ? (
            <Link
              href={`/blog/${prev.slug}`}
              className="group rounded-xl border border-white/10 p-4"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Previous</p>
              <p className="mt-2 font-medium text-white group-hover:text-slate-200">{prev.title}</p>
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              href={`/blog/${next.slug}`}
              className="group rounded-xl border border-white/10 p-4 sm:text-right"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Next</p>
              <p className="mt-2 font-medium text-white group-hover:text-slate-200">{next.title}</p>
            </Link>
          ) : null}
        </nav>
      )}
    </footer>
  )
}
