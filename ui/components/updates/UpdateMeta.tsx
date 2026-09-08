import formatUpdateDate from '@/lib/updates/formatUpdateDate'

/** The category / date / reading-time strip shown above every update title. */
export default function UpdateMetaLine({
  category,
  date,
  readingMinutes,
  featured = false,
}: {
  category: string
  date: string
  readingMinutes: number
  featured?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-RobotoMono text-xs uppercase tracking-[0.2em] text-slate-400">
      {featured && (
        <>
          <span className="text-blue-300">Featured</span>
          <span aria-hidden className="text-slate-600">
            /
          </span>
        </>
      )}
      <span className="text-slate-300">{category}</span>
      <span aria-hidden className="text-slate-600">
        /
      </span>
      <time dateTime={date}>{formatUpdateDate(date)}</time>
      <span aria-hidden className="text-slate-600">
        /
      </span>
      <span>{readingMinutes} min read</span>
    </div>
  )
}
