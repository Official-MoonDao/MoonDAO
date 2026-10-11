import { AnimatePresence, motion, useMotionValueEvent, type MotionValue } from 'framer-motion'
import { useState } from 'react'
import { timelineEvents } from '@/components/home/landing/JourneyTimeline'

// Only the stretch still ahead: nothing stands on the Moon before it, so
// scrolling the years already behind us would just show empty ground.
const AHEAD = timelineEvents.slice(Math.max(0, timelineEvents.findIndex((e) => e.isCurrent)))

const MILESTONES = [
  ...AHEAD.map((e) => ({
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

// Coarse enough that scrolling re-styles the scene a few dozen times across
// the whole chapter rather than every frame.
const BUILD_STEPS = 60

type RoadmapCardProps = {
  pinned: MotionValue<number>
  // Share of the base standing behind the card, 0 to 1; reaches 1 as the
  // last milestone comes up.
  onBuildChange: (build: number) => void
}

export default function RoadmapCard({ pinned, onBuildChange }: RoadmapCardProps) {
  const [index, setIndex] = useState(0)

  useMotionValueEvent(pinned, 'change', (p) => {
    setIndex(Math.min(LAST, Math.max(0, Math.floor(p * MILESTONES.length))))
    const build = Math.min(1, Math.max(0, (p * MILESTONES.length) / LAST))
    onBuildChange(Math.round(build * BUILD_STEPS) / BUILD_STEPS)
  })

  const m = MILESTONES[index]

  return (
    <div className="max-w-xl">
      <p className="flex items-center gap-2.5 font-RobotoMono text-[11px] uppercase tracking-[0.24em] text-white/70">
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22d3ee]" />
        The whole settlement
      </p>
      <h2 className="mt-4 font-heading font-semibold text-[clamp(1.9rem,4vw,3.25rem)] leading-[1.05] text-white [text-shadow:0_2px_24px_rgba(1,2,8,0.6)]">
        The road to 2030
      </h2>
      <p className="mt-3 max-w-lg text-base text-white/60 md:text-lg">
        Since 2021 MoonDAO has sent two members to space and landed its constitution on the Moon.
        Next, the base itself.
      </p>

      <div className="relative mt-8 min-h-[150px]">
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
              {m.isCurrent ? ' · Now' : ''}
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
              i <= index ? 'bg-moon-gold/90' : 'bg-white/10'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
