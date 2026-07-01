import { PauseIcon, PlayIcon } from '@heroicons/react/24/solid'

type YearHistogram = { year: number; count: number }[]

type TimelineScrubberProps = {
  minYear: number
  maxYear: number
  year: number
  onChange: (year: number) => void
  playing: boolean
  onTogglePlay: () => void
  histogram?: YearHistogram
}

// Global year scrubber. Drag to move through time and watch planned assets
// appear as their target dates arrive; press play to auto-advance. A faint
// histogram shows milestone density per year.
export default function TimelineScrubber({
  minYear,
  maxYear,
  year,
  onChange,
  playing,
  onTogglePlay,
  histogram = [],
}: TimelineScrubberProps) {
  const span = Math.max(1, maxYear - minYear)
  const maxCount = Math.max(1, ...histogram.map((h) => h.count))

  return (
    <div className="pointer-events-auto w-[min(92vw,720px)] rounded-2xl border border-white/10 bg-black/50 px-4 py-3 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <button
          onClick={onTogglePlay}
          aria-label={playing ? 'Pause' : 'Play timeline'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-500/25 text-cyan-100 transition hover:bg-cyan-500/40"
        >
          {playing ? (
            <PauseIcon className="h-4 w-4" />
          ) : (
            <PlayIcon className="h-4 w-4 translate-x-[1px]" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          {/* Milestone-density histogram */}
          <div className="mb-1 flex h-6 items-end gap-px">
            {Array.from({ length: span + 1 }, (_, i) => {
              const y = minYear + i
              const count = histogram.find((h) => h.year === y)?.count ?? 0
              const past = y <= year
              return (
                <div
                  key={y}
                  className="flex-1 rounded-sm transition-colors"
                  style={{
                    height: `${Math.max(count ? 18 : 4, (count / maxCount) * 100)}%`,
                    backgroundColor: past
                      ? 'rgba(103,232,249,0.55)'
                      : 'rgba(255,255,255,0.12)',
                  }}
                  title={count ? `${y}: ${count} milestone${count > 1 ? 's' : ''}` : `${y}`}
                />
              )
            })}
          </div>

          <input
            type="range"
            min={minYear}
            max={maxYear}
            step={1}
            value={year}
            onChange={(e) => onChange(Number(e.target.value))}
            className="atlas-year-range w-full"
            aria-label="Year"
          />

          <div className="mt-0.5 flex justify-between text-[10px] text-white/40">
            <span>{minYear}</span>
            <span>{maxYear}</span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[10px] uppercase tracking-wide text-white/40">
            Year
          </div>
          <div className="text-2xl font-semibold tabular-nums text-white">
            {year}
          </div>
        </div>
      </div>

      <style jsx>{`
        .atlas-year-range {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.15);
          outline: none;
        }
        .atlas-year-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: #67e8f9;
          box-shadow: 0 0 10px rgba(103, 232, 249, 0.8);
          cursor: pointer;
          border: 2px solid #0a0c14;
        }
        .atlas-year-range::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: #67e8f9;
          box-shadow: 0 0 10px rgba(103, 232, 249, 0.8);
          cursor: pointer;
          border: 2px solid #0a0c14;
        }
      `}</style>
    </div>
  )
}
