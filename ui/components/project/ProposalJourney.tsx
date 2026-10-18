import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'

const STEPS = [
  {
    n: '01',
    title: 'Ideate',
    body: 'Post the problem in Discord first. Feedback before a locked budget saves rewrite cycles.',
  },
  {
    n: '02',
    title: 'Propose',
    body: 'Use the template: novelty, lunar bridge, SMART key results, work-only budget under the max.',
  },
  {
    n: '03',
    title: 'Present & vote',
    body: 'Town Hall pitch, Senate diligence, then member vote. Funded leads join the Senate for the project.',
  },
  {
    n: '04',
    title: 'Ship & rewards',
    body: 'Weekly updates, final report, return unused funds. Completed work can earn quarterly retro rewards.',
  },
]

// Each stage plays in BEATS beats of BEAT_MS, then the next stage starts. The
// proposal and its numbers are illustrative.
const BEATS = 3
const BEAT_MS = 1400
const SPRING = { type: 'spring', stiffness: 140, damping: 20 } as const

const REPLIES = [
  { who: 'Senate member', text: 'Prior art: JSC-1A exists. What is new here?' },
  { who: 'Citizen', text: 'Scope it to what ships this quarter.' },
  { who: 'Engineer', text: 'Happy to co-lead the vacuum tests.' },
]
const TEMPLATE = ['Novelty & prior art', 'Lunar bridge', 'SMART key results', 'Work-only budget under the max']
const WEEKS = 6

function Check({ on }: { on: boolean }) {
  return (
    <motion.span
      initial={false}
      animate={{
        backgroundColor: on ? 'rgb(34 211 238)' : 'rgba(255,255,255,0.04)',
        borderColor: on ? 'rgb(34 211 238)' : 'rgba(255,255,255,0.2)',
        scale: on ? [1, 1.2, 1] : 1,
      }}
      transition={{ duration: 0.35 }}
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold text-black"
      aria-hidden
    >
      {on ? '✓' : ''}
    </motion.span>
  )
}

function Pill({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <motion.span
      initial={false}
      animate={{ opacity: show ? 1 : 0, scale: show ? 1 : 0.9 }}
      transition={SPRING}
      className="rounded-full bg-cyan-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-200"
    >
      {children}
    </motion.span>
  )
}

function IdeateStage({ beat }: { beat: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
        <p className="text-[11px] text-gray-500"># ideation · you</p>
        <p className="text-sm text-white">Open-source regolith test rig for lunar dust sealing</p>
      </div>
      <AnimatePresence initial={false}>
        {REPLIES.slice(0, beat + 1).map((r) => (
          <motion.div
            key={r.text}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={SPRING}
            className="ml-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5"
          >
            <p className="text-[10px] text-cyan-300/70">{r.who}</p>
            <p className="text-xs text-gray-300">{r.text}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function ProposeStage({ beat }: { beat: number }) {
  const ticked = beat === 0 ? 2 : beat === 1 ? 3 : TEMPLATE.length
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      {TEMPLATE.map((item, i) => (
        <div
          key={item}
          className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors duration-300 ${
            i < ticked ? 'border-cyan-400/30 bg-cyan-400/[0.05] text-white' : 'border-white/[0.06] text-gray-500'
          }`}
        >
          <Check on={i < ticked} />
          {item}
        </div>
      ))}
      <div className="mt-1 flex justify-end">
        <Pill show={beat === BEATS - 1}>Proposal submitted</Pill>
      </div>
    </div>
  )
}

function VoteStage({ beat }: { beat: number }) {
  const voted = beat === BEATS - 1
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      {['Town Hall pitch', 'Senate diligence'].map((label, i) => (
        <div
          key={label}
          className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors duration-300 ${
            beat >= i ? 'border-cyan-400/30 bg-cyan-400/[0.05] text-white' : 'border-white/[0.06] text-gray-500'
          }`}
        >
          <Check on={beat >= i} />
          {label}
        </div>
      ))}
      <div className={`rounded-lg border px-3 py-2.5 transition-opacity duration-300 ${voted ? 'border-white/10 opacity-100' : 'border-white/[0.06] opacity-40'}`}>
        <div className="mb-1.5 flex justify-between text-xs">
          <span className="text-white">Member vote</span>
          <span className="tabular-nums text-cyan-200">{voted ? '78% for' : '—'}</span>
        </div>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full bg-cyan-400"
            initial={false}
            animate={{ width: voted ? '78%' : '0%' }}
            transition={SPRING}
          />
          <motion.div
            className="h-full bg-white/25"
            initial={false}
            animate={{ width: voted ? '22%' : '0%' }}
            transition={SPRING}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Pill show={voted}>Funded · lead joins the Senate</Pill>
      </div>
    </div>
  )
}

function ShipStage({ beat }: { beat: number }) {
  const weeks = beat === 0 ? 3 : WEEKS
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div>
        <p className="mb-2 text-[11px] uppercase tracking-wider text-gray-500">Weekly updates</p>
        <div className="flex gap-1.5">
          {Array.from({ length: WEEKS }, (_, i) => (
            <motion.span
              key={i}
              initial={false}
              animate={{ backgroundColor: i < weeks ? 'rgb(34 211 238)' : 'rgba(255,255,255,0.06)' }}
              transition={{ duration: 0.3, delay: i < weeks ? i * 0.06 : 0 }}
              className="flex h-7 flex-1 items-center justify-center rounded text-[10px] font-semibold text-black/70"
            >
              W{i + 1}
            </motion.span>
          ))}
        </div>
      </div>
      {['Final report', 'Unused funds returned'].map((label) => (
        <div
          key={label}
          className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors duration-300 ${
            beat >= 1 ? 'border-cyan-400/30 bg-cyan-400/[0.05] text-white' : 'border-white/[0.06] text-gray-500'
          }`}
        >
          <Check on={beat >= 1} />
          {label}
        </div>
      ))}
      <motion.div
        initial={false}
        animate={{ opacity: beat === BEATS - 1 ? 1 : 0.25, y: beat === BEATS - 1 ? 0 : 6 }}
        transition={SPRING}
        className="flex items-center justify-between rounded-lg border border-amber-300/30 bg-amber-300/[0.06] px-3 py-2"
      >
        <span className="text-sm text-amber-100">Quarterly retro reward</span>
        <span className="text-[11px] text-amber-200/70">for completed work</span>
      </motion.div>
    </div>
  )
}

const STAGES = [IdeateStage, ProposeStage, VoteStage, ShipStage]

export default function ProposalJourney() {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const inView = useInView(ref, { amount: 0.35 })
  const [tick, setTick] = useState(0)
  const stage = Math.floor(tick / BEATS) % STEPS.length
  const beat = reduce ? BEATS - 1 : tick % BEATS

  useEffect(() => {
    if (reduce || !inView) return
    const id = setInterval(() => setTick((t) => (t + 1) % (STEPS.length * BEATS)), BEAT_MS)
    return () => clearInterval(id)
  }, [reduce, inView])

  const Stage = STAGES[stage]

  return (
    <div ref={ref} className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
      <ol className="order-2 flex flex-col gap-3 lg:order-1">
        {STEPS.map((step, i) => {
          const current = i === stage
          return (
            <li key={step.n}>
              <button
                type="button"
                onClick={() => setTick(i * BEATS)}
                aria-current={current ? 'step' : undefined}
                className={`relative w-full overflow-hidden rounded-xl border px-5 py-4 text-left transition-colors duration-300 ${
                  current ? 'border-cyan-400/40 bg-cyan-400/[0.05]' : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-baseline gap-3">
                  <span
                    className={`font-heading font-semibold text-sm tracking-[0.25em] ${
                      current ? 'text-cyan-300' : 'text-cyan-300/50'
                    }`}
                  >
                    {step.n}
                  </span>
                  <span className="font-heading font-semibold text-lg text-white">{step.title}</span>
                </div>
                <p className={`mt-1.5 text-sm leading-relaxed ${current ? 'text-gray-300' : 'text-gray-500'}`}>
                  {step.body}
                </p>
                {current && !reduce && (
                  <motion.span
                    key={stage}
                    className="absolute bottom-0 left-0 h-0.5 bg-cyan-400/70"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: (BEATS * BEAT_MS) / 1000, ease: 'linear' }}
                  />
                )}
              </button>
            </li>
          )
        })}
      </ol>

      <div
        role="img"
        aria-label="An example proposal moves from a Discord idea, through the template checklist, a Town Hall pitch, Senate review and member vote, to weekly updates, a final report and a retro reward"
        className="order-1 flex h-[360px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-5 sm:p-6 lg:order-2"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-cyan-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-200">
            {STEPS[stage].n} · {STEPS[stage].title}
          </span>
          <span className="truncate text-[11px] text-gray-500">Example proposal · illustration</span>
        </div>
        <div className="relative mt-4 min-h-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={stage}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <Stage beat={beat} />
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="mt-3 flex gap-1.5" aria-hidden>
          {STEPS.map((step, i) => (
            <span
              key={step.n}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i < stage ? 'bg-cyan-400/60' : i === stage ? 'bg-cyan-400' : 'bg-white/10'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
