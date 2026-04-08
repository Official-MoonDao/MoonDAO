import useWindowSize from '@/lib/team/use-window-size'

export function DataOverview({
  data,
  title,
  excludeKeys = [],
}: {
  data: Record<string, any>
  title: string
  excludeKeys?: string[]
}) {
  const { isMobile } = useWindowSize()

  const filteredKeys = Object.keys(data).filter((key) => !excludeKeys.includes(key))

  return (
    <div className="rounded-2xl border border-white/[0.08] overflow-hidden">
      <div className="px-5 py-4 bg-white/[0.03] border-b border-white/[0.06]">
        <h3 className="font-GoodTimes text-base text-white">{title}</h3>
      </div>
      <div className="divide-y divide-white/[0.06]">
        {filteredKeys.map((key, i) => (
          <div
            key={i}
            className={`px-5 py-3.5 flex ${
              isMobile ? 'flex-col gap-1' : 'items-center justify-between'
            } hover:bg-white/[0.02] transition-colors`}
          >
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {key}
            </span>
            <span
              className={`text-sm text-slate-200 ${
                isMobile ? '' : 'max-w-[60%] text-right'
              } break-words`}
            >
              {data[key] ?? '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
