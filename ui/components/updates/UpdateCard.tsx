import Link from 'next/link'
import type { UpdateMeta } from '@/lib/updates/types'
import UpdateMetaLine from './UpdateMeta'

export default function UpdateCard({ update }: { update: UpdateMeta }) {
  return (
    <Link
      href={`/updates/${update.slug}`}
      className="group block border-b border-white/10 py-6 last:border-b-0"
    >
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <UpdateMetaLine
            category={update.category}
            date={update.date}
            readingMinutes={update.readingMinutes}
          />
          <h3 className="mt-2 font-GoodTimes text-lg leading-snug text-white transition-colors group-hover:text-slate-200 md:text-xl">
            {update.title}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
            {update.description}
          </p>
          <p className="mt-3 text-xs text-slate-400">
            {update.author}
            {update.authorRole ? ` · ${update.authorRole}` : ''}
          </p>
        </div>
        {update.image && (
          <div className="hidden aspect-[1200/630] w-40 flex-shrink-0 overflow-hidden rounded-lg bg-black/30 sm:block">
            <img src={update.image} alt="" className="h-full w-full object-contain" />
          </div>
        )}
      </div>
    </Link>
  )
}
