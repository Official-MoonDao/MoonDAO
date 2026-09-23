// The control that makes the real sun reachable.
//
// Everything the horizon field was built for is invisible without this. At the sun
// the base was DESIGNED around — 44.46°, chosen to make the layout legible — the
// skyline shadows exactly 0.00% of the patch, because the comparison is in tangents
// and tan(44.46) is 0.98 against a measured maximum skyline tangent of 0.51. At the
// sun this ridge actually gets, ~2°, it shadows 57%. Same code, same data; the only
// difference is where the sun is, and until something set that, none of it ran.
//
// Two sliders because time here is two independent phases (see sunpath.ts), and they
// do visibly different things:
//
//   lunarDay sweeps the sun all the way round the horizon in 29.53 days. This is the
//   one that shows the payoff — WHICH 57% is in shadow changes, so shadows crawl
//   across the site and every slope is lit at some point in the month.
//
//   season raises and lowers the whole envelope through the Moon's 1.54° obliquity.
//   This is the one with an engineering answer attached: for about two fifths of the
//   year the sun is below local horizontal and the site is simply dark, which is the
//   entire reason illumination fraction decides where a polar base goes.
//
// It sits in the same corner family as the clean-view button and, like it, SURVIVES
// cinematic mode — a scrubber you cannot reach while looking at the thing it controls
// would be useless.
import { useMemo } from 'react'
import {
  SEASON_PERIOD_DAYS,
  SYNODIC_MONTH_DAYS,
  type SunPhase,
  maxElevationDeg,
  subsolarLatDeg,
  sunAt,
} from '@/lib/lunar-atlas/sunpath'
import { SUN_LOCAL_ELEV_DEG } from '@/lib/lunar-atlas/sun'

export type SunScrubberProps = {
  // null means the design sun, which is the default and the shipped scene.
  phase: SunPhase | null
  onChange: (phase: SunPhase | null) => void
}

// Named points in the lunar year, so `season` reads as something physical rather than
// as a number between 0 and 1. Season 0 is the southern summer solstice, when the
// subsolar point is at its most southerly and this ridge is best lit.
function seasonLabel(season: number): string {
  const s = ((season % 1) + 1) % 1
  if (s < 0.03 || s > 0.97) return 'southern summer'
  if (s > 0.47 && s < 0.53) return 'southern winter'
  if (s > 0.22 && s < 0.28) return 'equinox'
  if (s > 0.72 && s < 0.78) return 'equinox'
  return s < 0.5 ? 'toward winter' : 'toward summer'
}

function Row({
  label,
  value,
  hint,
  min = 0,
  max = 1,
  step,
  onChange,
}: {
  label: string
  value: number
  hint: string
  min?: number
  max?: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3 text-[10px] uppercase tracking-wide text-white/40">
        {label}
        <span className="normal-case tracking-normal text-white/60">{hint}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-amber-300"
        aria-label={label}
      />
    </label>
  )
}

export default function SunScrubber({ phase, onChange }: SunScrubberProps) {
  const active = phase !== null

  // Readouts come from sunAt rather than from anything this component works out
  // itself, so what is displayed is by construction the same vector the light and the
  // skyline test are using. A HUD that computes its own copy of the sun is how you
  // end up confidently reading off a number the renderer disagrees with.
  const read = useMemo(() => (phase ? sunAt(phase) : null), [phase])

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => onChange({ lunarDay: 0, season: 0 })}
        title={`Light the scene with the sun this ridge actually gets — never above ${maxElevationDeg().toFixed(
          1
        )}°, against the ${SUN_LOCAL_ELEV_DEG}° the base was drawn for`}
        className="absolute bottom-4 left-4 z-30 flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-[11px] font-medium text-white/60 backdrop-blur-md transition-colors hover:border-white/25 hover:text-white"
      >
        <span aria-hidden className="text-amber-300/80">
          ☀
        </span>
        Real sun
      </button>
    )
  }

  const p = phase as SunPhase
  const dark = (read?.elevationDeg ?? 0) <= 0

  return (
    <div className="absolute bottom-4 left-4 z-30 w-[15.5rem] rounded-lg border border-white/10 bg-black/60 p-3 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-white">
          <span aria-hidden className="text-amber-300/80">
            ☀
          </span>
          Real sun
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Back to the 44.46° sun the base was designed around"
          className="rounded px-1.5 py-0.5 text-[10px] text-white/40 transition-colors hover:bg-white/10 hover:text-white"
        >
          Design sun
        </button>
      </div>

      {/* The two numbers worth watching. Elevation is the whole story — it is what
          decides whether the skyline shadows anything at all — and bearing is which
          way the shadows point, which is the thing that moves as the month runs. */}
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] tabular-nums">
        <dt className="text-white/40">elevation</dt>
        <dd className={`text-right ${dark ? 'text-sky-300' : 'text-white'}`}>
          {(read?.elevationDeg ?? 0) >= 0 ? '+' : '−'}
          {Math.abs(read?.elevationDeg ?? 0).toFixed(2)}°
        </dd>
        <dt className="text-white/40">bearing</dt>
        <dd className="text-right text-white">{(read?.bearingDeg ?? 0).toFixed(0)}°</dd>
      </dl>

      {/* Not an error state, which is exactly why it is called out: the sun really is
          below local horizontal for about two fifths of the year here, and a viewer
          who scrubs into that without being told will read a correct dark frame as a
          broken one. */}
      {dark && (
        <p className="mt-1.5 text-[10px] leading-snug text-sky-300/80">
          Sun below local horizontal — the site is in darkness. This is ~2/5 of the
          lunar year at this ridge.
        </p>
      )}

      <div className="mt-2.5 space-y-2.5">
        <Row
          label="lunar day"
          value={p.lunarDay}
          hint={`${(p.lunarDay * SYNODIC_MONTH_DAYS).toFixed(1)} / ${SYNODIC_MONTH_DAYS.toFixed(
            1
          )} d`}
          step={0.002}
          onChange={(lunarDay) => onChange({ ...p, lunarDay })}
        />
        <Row
          label="season"
          value={p.season}
          hint={seasonLabel(p.season)}
          step={0.004}
          onChange={(season) => onChange({ ...p, season })}
        />
      </div>

      {/* Subsolar latitude is the season slider's actual physical content, and it is
          worth showing because its range is the surprise: the Moon's whole obliquity
          is 1.54°, so this entire slider moves the sun by about three degrees. That
          tiny number is the difference between a lit ridge and a dark one. */}
      <p className="mt-2 text-[10px] leading-snug text-white/35">
        Subsolar latitude {subsolarLatDeg(p.season).toFixed(2)}°, over a{' '}
        {SEASON_PERIOD_DAYS.toFixed(0)}-day approximation of the lunar year.
      </p>
    </div>
  )
}
