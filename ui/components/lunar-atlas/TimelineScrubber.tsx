import { PauseIcon, PlayIcon } from '@heroicons/react/24/solid'
import { useState } from 'react'

// One thing arriving at the Moon in a given year — what the hover card lists.
export type YearArrival = {
  projectId: string
  project: string
  org?: string
  // Title of this project's own dated milestone that lands in this year.
  milestone?: string
  // Set INSTEAD of `milestone` for an entrant with no Moon date of its own,
  // naming the race whose target window put it here. That is a much softer
  // claim than a dated landing and the card has to read as one, or the hover
  // invents schedule nobody published.
  expectedBy?: string
}

type YearHistogram = { year: number; count: number; arrivals?: YearArrival[] }[]

// How many arrivals a single year's card lists before it gives up and counts
// the rest. The card floats over the globe, so it cannot grow without bound.
// Eight covers every year in the shipped dataset but the two heaviest — 2027
// and 2030, which run to fourteen and nine — and those are exactly the years
// whose bar already says "a lot lands here" without the card repeating it.
const CARD_ROWS = 8

// Half the card's own width, as a CSS length. The card is centred on the year
// it describes, which would hang it off the end of the panel at either
// extreme, so its offset is clamped to this much from both edges.
const CARD_HALF = '8.5rem'

type TimelineScrubberProps = {
  minYear: number
  maxYear: number
  year: number
  onChange: (year: number) => void
  playing: boolean
  onTogglePlay: () => void
  histogram?: YearHistogram
  nowYear?: number
}

// Global year scrubber. Drag to move through time and watch hardware appear in
// the year it arrives at the Moon; press play to auto-advance. A faint
// histogram shows arrivals per year.
//
// The scrubber straddles today, and the two halves are different kinds of
// claim: to the left is what actually landed, to the right is what is planned
// to. Nothing marks that in the bar itself, so it is called out — a rule at
// today on the histogram, and a readout that names which half you are in.
//
// HOVERING A YEAR NAMES WHAT LANDS IN IT. The histogram answers "how much"
// and, on its own, nothing else: a bar three tall is three unnamed somethings,
// so the only way to find out what was in 2031 was to drag there and go
// hunting round the globe for whatever had changed. The card names them
// without moving the scene, which also makes the bar heights worth reading —
// a tall bar is now a question the user can answer by pointing at it.
//
// Each year gets a full-height hover target rather than hanging the hover off
// the bar itself. An empty year draws a 4%-high sliver, about a pixel, and a
// year with nothing in it is exactly the kind a user sweeps across looking for
// the gaps.
export default function TimelineScrubber({
  minYear,
  maxYear,
  year,
  onChange,
  playing,
  onTogglePlay,
  histogram = [],
  nowYear,
}: TimelineScrubberProps) {
  // Inclusive year count: a single-year range (min === max) is one bar, not two.
  const span = Math.max(0, maxYear - minYear)
  const maxCount = Math.max(1, ...histogram.map((h) => h.count))

  const [hoverYear, setHoverYear] = useState<number | null>(null)
  // A year with no bar at all still gets a card, saying so. "Nothing lands in
  // 2033" is an answer, and leaving the gaps silent would make them read as a
  // hover that is simply broken there.
  const hoverArrivals =
    hoverYear == null
      ? []
      : histogram.find((h) => h.year === hoverYear)?.arrivals ?? []
  const hoverShown = hoverArrivals.slice(0, CARD_ROWS)
  const hoverRest = hoverArrivals.length - hoverShown.length

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
          {/* Arrivals-per-year histogram */}
          <div
            className="relative mb-1 flex h-6 items-end gap-px"
            onMouseLeave={() => setHoverYear(null)}
          >
            {Array.from({ length: span + 1 }, (_, i) => {
              const y = minYear + i
              const count = histogram.find((h) => h.year === y)?.count ?? 0
              const past = y <= year
              return (
                <div
                  key={y}
                  className="flex h-full flex-1 items-end"
                  onMouseEnter={() => setHoverYear(y)}
                >
                  <div
                    className="w-full rounded-sm transition-colors"
                    style={{
                      height: `${Math.max(count ? 18 : 4, (count / maxCount) * 100)}%`,
                      backgroundColor:
                        hoverYear === y
                          ? 'rgba(255,255,255,0.8)'
                          : past
                          ? 'rgba(103,232,249,0.55)'
                          : 'rgba(255,255,255,0.12)',
                    }}
                  />
                </div>
              )
            })}

            {/* Today, drawn on the trailing edge of its own bar. */}
            {nowYear != null && nowYear >= minYear && nowYear < maxYear && (
              <div
                className="pointer-events-none absolute inset-y-0 w-px bg-white/30"
                style={{
                  left: `${((nowYear - minYear + 1) / (span + 1)) * 100}%`,
                }}
              />
            )}

            {/* What lands in the hovered year. Centred on that year's own bar
                and clamped so neither end of the range hangs it off the panel;
                pointer-events off so it can never come between the cursor and
                the bar that opened it. */}
            {hoverYear != null && (
              <div
                className="pointer-events-none absolute bottom-full z-30 mb-2 w-[17rem] -translate-x-1/2 rounded-lg border border-white/15 bg-black/85 p-2.5 shadow-xl backdrop-blur-md"
                style={{
                  left: `max(${CARD_HALF}, min(${
                    ((hoverYear - minYear + 0.5) / (span + 1)) * 100
                  }%, calc(100% - ${CARD_HALF})))`,
                }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-white/40">
                    {nowYear == null
                      ? 'Arrives in'
                      : hoverYear <= nowYear
                      ? 'On the Moon in'
                      : 'Planned for'}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-white">
                    {hoverYear}
                  </span>
                </div>

                {hoverArrivals.length === 0 ? (
                  <p className="mt-1 text-[11px] leading-snug text-white/45">
                    Nothing new reaches the Moon this year.
                  </p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {hoverShown.map((a, n) => (
                      <li key={`${a.projectId}:${n}`}>
                        <div className="truncate text-[11px] font-medium leading-tight text-white">
                          {a.project}
                        </div>
                        {/* Two lines, not one: milestone titles in the dataset
                            run past 140 characters, and a single truncated
                            line of one loses the part that says what happened. */}
                        <div className="line-clamp-2 text-[10px] leading-tight text-white/50">
                          {a.org ? `${a.org} · ` : ''}
                          {a.milestone ??
                            (a.expectedBy
                              ? `no date of its own — expected with the ${a.expectedBy} field`
                              : 'no published date')}
                        </div>
                      </li>
                    ))}
                    {hoverRest > 0 && (
                      <li className="pt-0.5 text-[10px] text-white/40">
                        +{hoverRest} more
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}
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
            {nowYear == null
              ? 'Year'
              : year <= nowYear
              ? 'On the Moon in'
              : 'Planned for'}
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
