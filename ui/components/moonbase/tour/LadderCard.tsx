import { AnimatePresence, motion, useMotionValueEvent, type MotionValue } from 'framer-motion'
import { useState } from 'react'
import { CAPABILITY_LADDER } from '@/lib/deprize/capabilityLadder'

const RUNGS = [
  ...CAPABILITY_LADDER.map((r) => ({ key: r.key, label: r.label, bar: r.bar })),
  {
    key: 'base',
    label: 'A working base',
    bar: 'Each proven capability is one the next team can build on, until the base stands.',
  },
]

const LAST = RUNGS.length - 1

// Coarse enough that scrolling re-styles the scene a few dozen times across
// the whole chapter rather than every frame.
const BUILD_STEPS = 60

type LadderCardProps = {
  pinned: MotionValue<number>
  // Share of the base standing behind the card, 0 to 1; reaches 1 on the last rung.
  onBuildChange: (build: number) => void
}

export default function LadderCard({ pinned, onBuildChange }: LadderCardProps) {
  const [index, setIndex] = useState(0)

  useMotionValueEvent(pinned, 'change', (p) => {
    setIndex(Math.min(LAST, Math.max(0, Math.floor(p * RUNGS.length))))
    const build = Math.min(1, Math.max(0, (p * RUNGS.length) / LAST))
    onBuildChange(Math.round(build * BUILD_STEPS) / BUILD_STEPS)
  })

  const rung = RUNGS[index]

  return (
    <div className="max-w-xl">
      <p className="flex items-center gap-2.5 font-RobotoMono text-[11px] uppercase tracking-[0.24em] text-white/70">
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22d3ee]" />
        Capability ladder
      </p>
      <h2 className="mt-4 font-heading font-semibold text-[clamp(1.9rem,4vw,3.25rem)] leading-[1.05] text-white [text-shadow:0_2px_24px_rgba(1,2,8,0.6)]">
        One race at a time.
      </h2>
      <p className="mt-3 max-w-lg text-base text-white/70 md:text-lg [text-shadow:0_1px_12px_rgba(1,2,8,0.7)]">
        DePrize races follow a ladder. Each rung is a capability a lunar base needs before the next
        one matters, and each has its own market and prize. Scroll to watch the base fill in.
      </p>

      <div className="relative mt-8 min-h-[120px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={rung.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            <span className="font-RobotoMono text-sm uppercase tracking-[0.2em] text-moon-gold">
              {index < LAST ? `Rung ${index}` : 'The goal'}
            </span>
            <h3 className="mt-2 font-heading text-xl font-semibold text-white md:text-2xl">
              {rung.label}
            </h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-white/70 md:text-base [text-shadow:0_1px_12px_rgba(1,2,8,0.7)]">
              {rung.bar}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 flex max-w-md gap-1.5" aria-hidden>
        {RUNGS.map((r, i) => (
          <span
            key={r.key}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i <= index ? 'bg-moon-gold/90' : 'bg-white/10'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
