import { motion, useInView, useReducedMotion } from 'framer-motion'
import { ReactNode, useEffect, useId, useRef, useState } from 'react'

export type FlowStep = {
  id: string
  label: string
  subtitle: string
  description: ReactNode
  iconPath: string
  live?: boolean
}

type StepFlowProps = {
  steps: FlowStep[]
  // Walk through the steps on a timer instead of anchoring to a live step.
  autoplay?: boolean
  autoplayMs?: number
}

type StepStatus = 'live' | 'done' | 'upcoming'

const STATUS_CHIP: Record<StepStatus, { text: string; className: string }> = {
  live: {
    text: 'Live now',
    className: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/30',
  },
  done: {
    text: 'Done',
    className: 'text-blue-300 bg-blue-400/10 border-blue-400/25',
  },
  upcoming: {
    text: 'Up next',
    className: 'text-gray-400 bg-white/5 border-white/10',
  },
}

export default function StepFlow({ steps, autoplay = false, autoplayMs = 4500 }: StepFlowProps) {
  const reduceMotion = useReducedMotion()
  const selectorId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inView = useInView(rootRef, { amount: 0.5 })
  const [hasEntered, setHasEntered] = useState(false)
  const [pinnedIdx, setPinnedIdx] = useState<number | null>(null)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [autoIdx, setAutoIdx] = useState(0)

  const liveIdx = Math.max(
    0,
    steps.findIndex((s) => s.live)
  )
  const anchorIdx = autoplay ? autoIdx : liveIdx
  const shownIdx = hoveredIdx ?? pinnedIdx ?? anchorIdx
  const fillIdx = autoplay ? shownIdx : liveIdx
  const progress = hasEntered ? fillIdx / (steps.length - 1) : 0
  const playing = autoplay && !reduceMotion && inView && hoveredIdx === null && pinnedIdx === null

  useEffect(() => {
    if (inView) setHasEntered(true)
  }, [inView])

  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => setAutoIdx((i) => (i + 1) % steps.length), autoplayMs)
    return () => clearTimeout(timer)
  }, [playing, autoIdx, autoplayMs, steps.length])

  const statusOf = (idx: number): StepStatus => {
    if (autoplay) return idx === shownIdx ? 'live' : idx < shownIdx ? 'done' : 'upcoming'
    return steps[idx].live ? 'live' : idx < liveIdx ? 'done' : 'upcoming'
  }

  const inset = `calc(100% / ${steps.length * 2})`

  return (
    <div ref={rootRef} className="w-full pt-2" onMouseLeave={() => setHoveredIdx(null)}>
      <div className="relative">
        {/* Track spans from the centre of the first node to the centre of the last. */}
        <div
          className="absolute top-[18px] sm:top-[22px] h-0.5 -translate-y-1/2 rounded-full bg-white/10"
          style={{ left: inset, right: inset }}
        >
          <motion.div
            className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
            initial={reduceMotion ? false : { width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{
              duration: reduceMotion ? 0 : autoplay ? 0.6 : 1.1,
              delay: autoplay ? 0 : 0.25,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {!reduceMotion && progress > 0 && (
              <motion.span
                className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/80 to-transparent"
                initial={{ left: '-4rem' }}
                animate={{ left: '100%' }}
                transition={{
                  duration: 2.2,
                  delay: 1.4,
                  repeat: Infinity,
                  repeatDelay: 1.2,
                  ease: 'easeInOut',
                }}
              />
            )}
          </motion.div>
        </div>

        <ol
          className="relative grid"
          style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
        >
          {steps.map((step, idx) => {
            const status = statusOf(idx)
            const selected = idx === shownIdx
            return (
              <motion.li
                key={step.id}
                className="flex flex-col items-center min-w-0"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={hasEntered ? { opacity: 1, y: 0 } : undefined}
                transition={{ duration: 0.45, delay: idx * 0.08, ease: 'easeOut' }}
              >
                <button
                  type="button"
                  onClick={() => setPinnedIdx(idx)}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onFocus={() => setHoveredIdx(idx)}
                  onBlur={() => setHoveredIdx(null)}
                  aria-pressed={selected}
                  aria-label={`${step.label} ${step.subtitle}${
                    !autoplay && status === 'live' ? ' (current phase)' : ''
                  }`}
                  className="group flex flex-col items-center w-full min-w-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
                >
                  <span className="relative flex items-center justify-center">
                    {status === 'live' && !reduceMotion && (
                      <motion.span
                        aria-hidden
                        className="absolute inset-0 rounded-full bg-indigo-500/40"
                        animate={{ scale: [1, 1.7], opacity: [0.6, 0] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                      />
                    )}
                    {selected && (
                      <motion.span
                        aria-hidden
                        layoutId={selectorId}
                        className="absolute -inset-1.5 rounded-full border border-white/30"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="relative rounded-full bg-dark-cool">
                      <span
                        className={`flex w-9 h-9 sm:w-11 sm:h-11 items-center justify-center rounded-full border transition-colors duration-300 ${
                          status === 'live'
                            ? 'border-white/30 bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.45)]'
                            : status === 'done'
                            ? 'border-blue-400/40 bg-blue-500/10 text-blue-300'
                            : 'border-white/10 bg-white/[0.03] text-gray-500 group-hover:text-gray-300 group-hover:border-white/25'
                        }`}
                      >
                        <svg
                          className="w-4 h-4 sm:w-5 sm:h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                          aria-hidden
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d={step.iconPath} />
                        </svg>
                      </span>
                    </span>
                  </span>
                  <span className="hidden sm:flex flex-col items-center mt-3 w-full px-1 min-w-0">
                    <span
                      className={`text-[11px] font-RobotoMono font-semibold uppercase tracking-wider truncate max-w-full transition-colors ${
                        selected || status === 'live' ? 'text-white' : 'text-gray-500'
                      }`}
                    >
                      {step.label}
                    </span>
                    <span
                      className={`text-xs truncate max-w-full transition-colors ${
                        status === 'live' ? 'text-blue-300' : 'text-gray-600'
                      }`}
                    >
                      {step.subtitle}
                    </span>
                  </span>
                </button>
              </motion.li>
            )
          })}
        </ol>
      </div>

      {/* Every panel shares one grid cell, so the box is sized to the longest
          description and never jumps in height as the selection changes. */}
      <div
        className="relative mt-4 sm:mt-5 grid overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] p-3 sm:p-4"
        aria-live="polite"
      >
        {steps.map((step, idx) => {
          const chip = STATUS_CHIP[statusOf(idx)]
          const shown = idx === shownIdx
          return (
            <motion.div
              key={step.id}
              className="col-start-1 row-start-1"
              initial={false}
              animate={{ opacity: shown ? 1 : 0, y: shown || reduceMotion ? 0 : 6 }}
              transition={{ duration: reduceMotion ? 0 : 0.25, ease: 'easeOut' }}
              aria-hidden={!shown}
              style={{ pointerEvents: shown ? 'auto' : 'none' }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-RobotoMono text-gray-500 tracking-wider">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className="text-sm sm:text-base font-heading font-semibold text-white">
                  {step.label}
                  <span className="text-blue-300 font-normal"> · {step.subtitle}</span>
                </span>
                {autoplay ? (
                  <span className="text-[10px] font-RobotoMono uppercase tracking-wider text-gray-500">
                    Step {idx + 1} of {steps.length}
                  </span>
                ) : (
                  <span
                    className={`text-[10px] font-RobotoMono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${chip.className}`}
                  >
                    {chip.text}
                  </span>
                )}
              </div>
              <div className="mt-2 text-xs sm:text-sm text-gray-300 leading-relaxed">
                {step.description}
              </div>
            </motion.div>
          )
        })}
        {playing && (
          <motion.span
            key={autoIdx}
            aria-hidden
            className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-blue-500/70 to-purple-500/70"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: autoplayMs / 1000, ease: 'linear' }}
          />
        )}
      </div>
    </div>
  )
}
