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
    <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
      <h3 className="font-GoodTimes text-xl mb-4 text-white">{title}</h3>
      <div className="grid gap-4">
        {isMobile ? (
          filteredKeys.map((key, i) => (
            <div
              key={i}
              className="flex flex-col p-4 bg-slate-800/50 rounded-lg border border-slate-600/30"
            >
              <p className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-1">
                {key}:
              </p>
              <p className="text-white">{data[key]}</p>
            </div>
          ))
        ) : (
          <div className="space-y-3">
            {filteredKeys.map((key, i) => (
              <div
                key={i}
                className="flex justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-600/30"
              >
                <span className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                  {key}:
                </span>
                <span className="text-white max-w-xs text-right">{data[key]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
