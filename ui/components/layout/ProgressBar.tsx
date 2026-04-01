interface ProgressBarProps {
  progress: number // Value between 0 and 100
  height?: string
  label?: string
  padding?: string
  isCelebrating?: boolean
}

function clampProgress(p: number): number {
  if (!Number.isFinite(p)) return 0
  return Math.min(100, Math.max(0, p))
}

export default function ProgressBar({
  progress,
  height = '8px',
  label,
  padding = '2px',
  isCelebrating = false,
}: ProgressBarProps) {
  const widthPct = clampProgress(progress)

  return (
    <div
      className="relative w-full rounded-full bg-slate-700/30 border border-white/10 overflow-hidden"
      style={{ height: `calc(${height} + ${padding} * 2)` }}
    >
      <div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{ margin: padding }}
      >
        <div className="h-full w-full bg-gradient-to-r from-slate-800/50 to-slate-700/50 relative">
          <div
            className={`h-full relative shadow-lg transition-[width] duration-700 ease-out ${
              isCelebrating
                ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-green-500'
                : 'bg-gradient-to-r from-blue-500 via-purple-600 to-blue-500'
            }`}
            style={{ width: `${widthPct}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
          </div>

          {label ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <span className="text-sm font-medium text-white drop-shadow-md px-2 py-0.5 bg-black/35 rounded-full backdrop-blur-sm border border-white/10">
                {label}
              </span>
            </div>
          ) : null}

          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />
        </div>
      </div>
    </div>
  )
}
