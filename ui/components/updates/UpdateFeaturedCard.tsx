import Link from 'next/link'
import type { UpdateMeta } from '@/lib/updates/types'
import UpdateMetaLine from './UpdateMeta'

export default function UpdateFeaturedCard({ update }: { update: UpdateMeta }) {
  return (
    <Link
      href={`/updates/${update.slug}`}
      className="group block overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-600/20 to-purple-600/20 transition-all duration-200 hover:border-blue-400/50"
    >
      {update.image && (
        // Matches the 1200x630 social-image ratio authors are asked to use, so
        // the hero is letterboxed rather than cropped through the artwork.
        <div className="aspect-[1200/630] w-full overflow-hidden bg-black/30">
          <img src={update.image} alt="" className="h-full w-full object-contain" />
        </div>
      )}
      <div className="p-6 md:p-8">
        <UpdateMetaLine
          category={update.category}
          date={update.date}
          readingMinutes={update.readingMinutes}
          featured
        />
        <h2 className="mt-3 font-GoodTimes text-2xl leading-snug text-white transition-colors group-hover:text-slate-200 md:text-3xl">
          {update.title}
        </h2>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-300">
          {update.description}
        </p>
        <p className="mt-4 text-sm text-slate-400">
          {update.author}
          {update.authorRole ? ` · ${update.authorRole}` : ''}
        </p>
      </div>
    </Link>
  )
}
