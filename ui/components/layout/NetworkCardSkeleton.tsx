export default function NetworkCardSkeleton() {
  return (
    <div className="w-full h-full p-4 bg-black/20 backdrop-blur-sm rounded-2xl border border-white/10 animate-pulse">
      <div className="flex flex-row items-start gap-4 w-full h-full">
        <div className="w-[80px] h-[80px] sm:w-[100px] sm:h-[100px] md:w-[120px] md:h-[120px] flex-shrink-0 bg-slate-700/50 rounded-xl"></div>
        <div className="flex-1 min-w-0 flex flex-col justify-between h-full gap-3">
          <div className="space-y-2">
            <div className="h-6 bg-slate-700/50 rounded w-3/4"></div>
            <div className="h-4 bg-slate-700/30 rounded w-full"></div>
            <div className="h-4 bg-slate-700/30 rounded w-5/6"></div>
            <div className="h-4 bg-slate-700/30 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

