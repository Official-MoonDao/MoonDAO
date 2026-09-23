import Link from 'next/link'
import type { UpdateMeta } from '@/lib/updates/types'

export default function UpdateFooter({
  tags,
  prev,
  next,
}: {
  tags: string[]
  prev?: UpdateMeta
  next?: UpdateMeta
}) {
  return (
    <footer className="mt-16">
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
          aria-label="Adjacent updates"
          className="mt-10 grid grid-cols-1 gap-4 border-t border-white/10 pt-8 sm:grid-cols-2"
        >
          {prev ? (
            <Link
              href={`/updates/${prev.slug}`}
              className="group rounded-xl border border-white/10 p-4"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Newer</p>
              <p className="mt-2 font-medium text-white group-hover:text-slate-200">{prev.title}</p>
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              href={`/updates/${next.slug}`}
              className="group rounded-xl border border-white/10 p-4 sm:text-right"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Older</p>
              <p className="mt-2 font-medium text-white group-hover:text-slate-200">{next.title}</p>
            </Link>
          ) : null}
        </nav>
      )}
    </footer>
  )
}
