import { ReactNode } from 'react'

type TourCardProps = {
  location: string
  title: ReactNode
  children?: ReactNode
  stat?: { value: string; label: string }
  // An animation under the copy. The heading shrinks so both fit one screen.
  visual?: ReactNode
  actions?: ReactNode
  // The arrival card carries the page's <h1>; every other stop is an <h2>.
  as?: 'h1' | 'h2'
}

export default function TourCard({
  location,
  title,
  children,
  stat,
  visual,
  actions,
  as: Heading = 'h2',
}: TourCardProps) {
  return (
    <div className="max-w-xl">
      <p className="flex items-center gap-2.5 font-RobotoMono text-[11px] uppercase tracking-[0.24em] text-white/70">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22d3ee]/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22d3ee]" />
        </span>
        {location}
      </p>
      <Heading
        className={`font-heading font-semibold leading-[1.05] text-white [text-shadow:0_2px_24px_rgba(1,2,8,0.6)] ${
          visual ? 'mt-3 text-[clamp(1.6rem,3vw,2.5rem)]' : 'mt-4 text-[clamp(1.9rem,4vw,3.25rem)]'
        }`}
      >
        {title}
      </Heading>
      {children && (
        <div
          className={`max-w-lg leading-relaxed text-white/75 [text-shadow:0_1px_12px_rgba(1,2,8,0.7)] ${
            visual ? 'mt-3 text-sm md:text-base' : 'mt-5 text-base md:text-lg'
          }`}
        >
          {children}
        </div>
      )}
      {stat && (
        <div className="mt-6 flex items-baseline gap-3 border-l-2 border-moon-gold/70 pl-4">
          <span className="font-heading text-2xl font-semibold text-white md:text-3xl">
            {stat.value}
          </span>
          <span className="font-RobotoMono text-[11px] uppercase tracking-[0.18em] text-white/55">
            {stat.label}
          </span>
        </div>
      )}
      {visual && <div className="mt-5">{visual}</div>}
      {actions && (
        <div
          className={`flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6 ${
            visual ? 'mt-5' : 'mt-8'
          }`}
        >
          {actions}
        </div>
      )}
    </div>
  )
}
