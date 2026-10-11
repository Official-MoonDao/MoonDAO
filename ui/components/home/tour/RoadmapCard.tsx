import { AnimatePresence, motion, useMotionValueEvent, type MotionValue } from 'framer-motion'
import { useEffect, useState } from 'react'
import { timelineEvents } from '@/components/home/landing/JourneyTimeline'

const MILESTONES = [
  ...timelineEvents.map((e) => ({
    date: e.date,
    title: e.title,
    description: e.description,
    isCurrent: !!e.isCurrent,
  })),
  {
    date: 'Jan 2030',
    title: 'Lunar Settlement Complete',
    description:
      "The first minimum viable lunar settlement is complete — and we throw a New Year's Eve party on the Moon.",
    isCurrent: false,
  },
]

const LAST = MILESTONES.length - 1

type RoadmapCardProps = {
  pinned: MotionValue<number>
  // The year the base behind the card should be shown at; null once the
  // settlement is complete.
  onYearChange: (year: number | null) => void
}

export default function RoadmapCard({ pinned, onYearChange }: RoadmapCardProps) {
  const [index, setIndex] = useState(0)

  useMotionValueEvent(pinned, 'change', (p) => {
    setIndex(Math.min(LAST, Math.max(0, Math.floor(p * MILESTONES.length))))
  })

  useEffect(() => {
    if (index === LAST) onYearChange(null)
    else onYearChange(Number(MILESTONES[index].date.match(/\d{4}/)?.[0]))
  }, [index, onYearChange])

  const m = MILESTONES[index]
  const currentIndex = MILESTONES.findIndex((e) => e.isCurrent)

  return (
    <div className="max-w-xl">
      <p className="flex items-center gap-2.5 font-RobotoMono text-[11px] uppercase tracking-[0.24em] text-white/70">
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22d3ee]" />
        The whole settlement
      </p>
      <h2 className="mt-4 font-heading font-semibold text-[clamp(1.9rem,4vw,3.25rem)] leading-[1.05] text-white [text-shadow:0_2px_24px_rgba(1,2,8,0.6)]">
        Journey to the Moon
      </h2>
      <p className="mt-3 max-w-lg text-base text-white/60 md:text-lg">
        From an internet community to a permanent settlement — watch the base go up.
      </p>

      <div className="relative mt-8 min-h-[170px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            <span className="font-RobotoMono text-sm uppercase tracking-[0.2em] text-moon-gold">
              {m.date}
              {index === currentIndex ? ' · Now' : ''}
            </span>
            <h3 className="mt-2 font-heading text-xl font-semibold text-white md:text-2xl">
              {m.title}
            </h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-white/70 md:text-base [text-shadow:0_1px_12px_rgba(1,2,8,0.7)]">
              {m.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 flex max-w-md gap-1.5" aria-hidden>
        {MILESTONES.map((e, i) => (
          <span
            key={e.date + e.title}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i <= index ? 'bg-moon-gold/90' : i <= currentIndex ? 'bg-white/30' : 'bg-white/10'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
