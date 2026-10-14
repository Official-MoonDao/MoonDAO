import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { OUTCOME_COLORS } from '@/lib/deprize/constants'

const TEAMS = [
  { name: 'Team Aurora', color: OUTCOME_COLORS[0] },
  { name: 'Team Basalt', color: OUTCOME_COLORS[1] },
  { name: 'Open Field', color: '#6b7280' },
]

/**
 * Steps through a scene while it is on screen. Each entry in `durations` is how
 * long that step holds. Reduced motion shows the last step without looping.
 */
function useSceneStep(ref: RefObject<Element>, durations: number[]): number {
  const inView = useInView(ref, { amount: 0.35 })
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!inView || reduce) return
    const id = setTimeout(() => setStep((s) => (s + 1) % durations.length), durations[step])
    return () => clearTimeout(id)
  }, [inView, reduce, step, durations])

  return reduce ? durations.length - 1 : step
}

function SceneFrame({
  sceneRef,
  label,
  children,
}: {
  sceneRef: RefObject<HTMLDivElement>
  label: string
  children: ReactNode
}) {
  return (
    <div
      ref={sceneRef}
      role="img"
      aria-label={label}
      className="relative h-[320px] w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-5 sm:p-6"
    >
      {children}
    </div>
  )
}

const HERO_ODDS = [
  [46, 34, 20],
  [41, 40, 19],
  [36, 47, 17],
  [31, 54, 15],
]
const HERO_DURATIONS = [1800, 1800, 1800, 2400]

export function OddsRaceScene() {
  const ref = useRef<HTMLDivElement>(null)
  const step = useSceneStep(ref, HERO_DURATIONS)
  const odds = HERO_ODDS[step]

  return (
    <SceneFrame
      sceneRef={ref}
      label="Three competitors with chances to win that shift as people bet"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          First commercial lunar landing
        </p>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
          Live
        </span>
      </div>
      <div className="mt-6 flex flex-col gap-5">
        {TEAMS.map((team, i) => (
          <div key={team.name}>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-sm font-semibold text-white">{team.name}</span>
              <motion.span
                key={odds[i]}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-lg font-bold tabular-nums"
                style={{ color: team.color }}
              >
                {odds[i]}%
              </motion.span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className="h-full rounded-full"
                style={{ background: team.color }}
                animate={{ width: `${odds[i]}%` }}
                transition={{ type: 'spring', stiffness: 80, damping: 18 }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="absolute bottom-5 left-5 right-5 text-xs text-gray-500 sm:left-6 sm:right-6">
        Chance to win. It moves every time someone bets.
      </p>
    </SceneFrame>
  )
}

const VOTERS = [
  { size: 18, pick: 1 },
  { size: 10, pick: 0 },
  { size: 14, pick: 1 },
  { size: 8, pick: 2 },
  { size: 22, pick: 1 },
  { size: 12, pick: 0 },
  { size: 9, pick: 1 },
]
const PREDICT_DURATIONS = [900, 1100, 1300, 1800, 2600]

export function PredictScene() {
  const ref = useRef<HTMLDivElement>(null)
  const step = useSceneStep(ref, PREDICT_DURATIONS)
  const picked = step >= 2
  const forecast = step >= 4 ? [30, 52, 18] : [38, 40, 22]

  return (
    <SceneFrame
      sceneRef={ref}
      label="Picking a competitor for free, then Citizen picks weighted by voting power forming the DAO forecast"
    >
      <div className="flex flex-col gap-2">
        {TEAMS.map((team, i) => {
          const mine = i === 1 && picked
          return (
            <div
              key={team.name}
              className={`relative flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-300 ${
                mine ? 'border-blue-400/60 bg-blue-500/10' : 'border-white/[0.06] bg-white/[0.02]'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: team.color }} />
              <span className="flex-1 text-sm font-medium text-white">{team.name}</span>
              <AnimatePresence>
                {mine && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="rounded-full bg-blue-500 px-2 py-0.5 text-[11px] font-semibold text-white"
                  >
                    Your prediction
                  </motion.span>
                )}
              </AnimatePresence>
              {i === 1 && (
                <motion.div
                  className="pointer-events-none absolute right-28 top-1/2"
                  animate={{
                    x: step >= 1 ? 0 : 90,
                    y: step >= 1 ? 0 : 80,
                    opacity: step >= 1 && step < 3 ? 1 : 0,
                  }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                    <path d="M4 2l16 10-7 1.5L9.5 21z" />
                  </svg>
                  {step === 2 && (
                    <motion.span
                      className="absolute -left-2 -top-2 h-6 w-6 rounded-full border-2 border-white"
                      initial={{ scale: 0.3, opacity: 1 }}
                      animate={{ scale: 1.6, opacity: 0 }}
                      transition={{ duration: 0.6 }}
                    />
                  )}
                </motion.div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-5">
        <div className="flex h-7 items-end gap-1.5">
          {VOTERS.map((voter, i) => (
            <motion.span
              key={i}
              className="rounded-full"
              style={{
                width: voter.size,
                height: voter.size,
                background: TEAMS[voter.pick].color,
              }}
              animate={{ opacity: step >= 3 ? 1 : 0, y: step >= 3 ? 0 : -24 }}
              transition={{ delay: step >= 3 ? i * 0.12 : 0, duration: 0.4 }}
            />
          ))}
          <span className="ml-auto text-[11px] text-gray-500">Bigger dot = more voting power</span>
        </div>
        <p className="mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          DAO forecast
        </p>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/[0.06]">
          {TEAMS.map((team, i) => (
            <motion.div
              key={team.name}
              className="h-full"
              style={{ background: team.color }}
              animate={{ width: `${forecast[i]}%` }}
              transition={{ type: 'spring', stiffness: 70, damping: 16 }}
            />
          ))}
        </div>
      </div>
    </SceneFrame>
  )
}

const BET_DURATIONS = [900, 1200, 1900, 1300, 2600]

export function BetScene() {
  const ref = useRef<HTMLDivElement>(null)
  const step = useSceneStep(ref, BET_DURATIONS)
  const placed = step >= 4

  return (
    <SceneFrame
      sceneRef={ref}
      label="Betting 0.1 ETH at a 25% chance: about 0.38 ETH if they win, with 5% going to the prize pool"
    >
      <div className="grid h-full grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <span
              className={`rounded-lg px-2 py-2 text-center text-xs font-semibold transition-colors duration-300 ${
                step >= 1 ? 'text-white' : 'bg-white/[0.05] text-gray-300'
              }`}
              style={step >= 1 ? { background: TEAMS[0].color } : undefined}
            >
              Aurora {placed ? '27%' : '25%'}
            </span>
            <span className="rounded-lg bg-white/[0.05] px-2 py-2 text-center text-xs font-semibold text-gray-300">
              Basalt {placed ? '55%' : '57%'}
            </span>
          </div>
          <div className="rounded-lg border border-white/[0.08] px-3 py-2">
            <p className="text-[11px] text-gray-500">Amount</p>
            <p className="text-xl font-bold tabular-nums text-white">
              {step >= 1 ? '0.1' : '0'} <span className="text-sm text-gray-400">ETH</span>
            </p>
          </div>
          <motion.div
            className="flex flex-col gap-1 text-[11px] text-gray-400"
            animate={{ opacity: step >= 2 ? 1 : 0 }}
          >
            <div className="flex justify-between">
              <span>To the prize pool (5%)</span>
              <span className="tabular-nums text-amber-300">0.005 ETH</span>
            </div>
            <div className="flex justify-between">
              <span>Buys shares at 25¢</span>
              <span className="tabular-nums">≈0.38 shares</span>
            </div>
            <div className="flex justify-between text-xs font-semibold text-white">
              <span>To win</span>
              <span className="tabular-nums text-emerald-400">≈0.38 ETH</span>
            </div>
          </motion.div>
          <motion.span
            className="mt-auto rounded-lg py-2 text-center text-sm font-bold text-white"
            style={{ background: TEAMS[0].color }}
            animate={{ scale: step === 3 ? 0.94 : 1 }}
            transition={{ duration: 0.15 }}
          >
            Bet on Aurora
          </motion.span>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
            <p className="text-[11px] text-gray-500">Aurora&apos;s chance</p>
            <motion.p
              key={placed ? 'after' : 'before'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-bold tabular-nums"
              style={{ color: TEAMS[0].color }}
            >
              {placed ? '27%' : '25%'}
            </motion.p>
            <p className="text-[11px] text-gray-500">{placed ? 'Your bet moved it' : '\u00a0'}</p>
          </div>
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-3">
            <p className="text-[11px] text-amber-200/80">Prize pool</p>
            <motion.p
              key={placed ? 'after' : 'before'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-bold tabular-nums text-amber-300"
            >
              {placed ? '2.405' : '2.400'}
            </motion.p>
            <p className="text-[11px] text-amber-200/60">ETH</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {step === 3 && (
          <motion.span
            className="absolute bottom-10 left-[30%] h-4 w-4 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.8)]"
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{ x: '900%', y: -40, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>
    </SceneFrame>
  )
}

const PRIZE_TOTALS = ['2.400', '2.405', '2.905', '2.912', '2.920', '3.420']
const PRIZE_SOURCES = ['bet', 'bet', 'fund', 'bet', 'bet', 'fund'] as const
const PRIZE_DURATIONS = [1000, 1000, 1000, 1000, 1000, 1800]

export function PrizeScene() {
  const ref = useRef<HTMLDivElement>(null)
  const step = useSceneStep(ref, PRIZE_DURATIONS)
  const source = PRIZE_SOURCES[step]
  const fill = 30 + step * 10

  return (
    <SceneFrame
      sceneRef={ref}
      label="The prize pool fills from a 5% share of every bet and from direct funding"
    >
      <div className="grid h-full grid-cols-2 gap-4">
        <div className="flex flex-col justify-center gap-3">
          {(['bet', 'fund'] as const).map((kind) => (
            <div
              key={kind}
              className={`rounded-xl border px-3 py-2.5 transition-colors duration-300 ${
                source === kind
                  ? 'border-amber-400/50 bg-amber-400/10'
                  : 'border-white/[0.06] bg-white/[0.02]'
              }`}
            >
              <p className="text-sm font-semibold text-white">
                {kind === 'bet' ? 'Every bet' : 'Funders'}
              </p>
              <p className="text-xs text-gray-400">
                {kind === 'bet' ? '≈5% goes to the prize' : 'Anyone can add ETH'}
              </p>
            </div>
          ))}
        </div>

        <div className="relative flex flex-col items-center justify-end">
          <AnimatePresence>
            <motion.span
              key={step}
              className="absolute top-2 h-5 w-5 rounded-full bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.8)]"
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 120, opacity: [0, 1, 1, 0] }}
              transition={{ duration: 0.8, ease: 'easeIn' }}
            />
          </AnimatePresence>
          <div className="relative h-44 w-32 overflow-hidden rounded-b-3xl rounded-t-lg border-2 border-white/15 bg-white/[0.02]">
            <motion.div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-500/70 to-amber-300/50"
              animate={{ height: `${fill}%` }}
              transition={{ type: 'spring', stiffness: 60, damping: 14 }}
            />
          </div>
          <motion.p
            key={PRIZE_TOTALS[step]}
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 1 }}
            className="mt-3 text-xl font-bold tabular-nums text-amber-300"
          >
            {PRIZE_TOTALS[step]} ETH
          </motion.p>
        </div>
      </div>
    </SceneFrame>
  )
}

const RESOLVE_STAGES = ['Expert review', 'Senate vote', '72h challenge', 'On-chain result']
const RESOLVE_DURATIONS = [1000, 1000, 1000, 1000, 3200]

export function ResolveScene() {
  const ref = useRef<HTMLDivElement>(null)
  const step = useSceneStep(ref, RESOLVE_DURATIONS)
  const done = step >= RESOLVE_STAGES.length

  return (
    <SceneFrame
      sceneRef={ref}
      label="Expert review, a Senate vote, a 72 hour challenge window, then the result goes on-chain and winning shares pay out"
    >
      <ol className="relative flex justify-between">
        <span className="absolute left-4 right-4 top-4 h-0.5 bg-white/10" aria-hidden="true" />
        <motion.span
          className="absolute left-4 top-4 h-0.5 bg-emerald-400"
          aria-hidden="true"
          animate={{
            width: `calc(${
              (Math.min(step, RESOLVE_STAGES.length - 1) / (RESOLVE_STAGES.length - 1)) * 100
            }% - 2rem)`,
          }}
          transition={{ duration: 0.6 }}
        />
        {RESOLVE_STAGES.map((stage, i) => {
          const lit = step >= i
          return (
            <li key={stage} className="relative z-10 flex w-16 flex-col items-center gap-2 sm:w-20">
              <motion.span
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold"
                animate={{
                  backgroundColor: lit ? '#34d399' : '#0b0d12',
                  borderColor: lit ? '#34d399' : 'rgba(255,255,255,0.2)',
                  color: lit ? '#052e16' : '#9ca3af',
                  scale: step === i ? 1.15 : 1,
                }}
                transition={{ duration: 0.3 }}
              >
                {i + 1}
              </motion.span>
              <span
                className={`text-center text-[11px] leading-tight ${
                  lit ? 'text-white' : 'text-gray-500'
                }`}
              >
                {stage}
              </span>
            </li>
          )
        })}
      </ol>

      <motion.div
        className="mt-6 grid grid-cols-2 gap-3"
        animate={{ opacity: done ? 1 : 0, y: done ? 0 : 12 }}
        transition={{ duration: 0.4 }}
      >
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.07] p-3">
          <p className="text-xs font-semibold text-emerald-300">Team Basalt wins</p>
          <p className="mt-1 text-sm font-bold text-white">Each winning share pays 1 ETH</p>
          <p className="mt-1 text-[11px] text-gray-400">
            Other shares pay 0. The prize goes to the winner.
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
          <p className="text-xs font-semibold text-gray-300">No winner or cancelled</p>
          <p className="mt-1 text-sm font-bold text-white">Bets are refundable</p>
          <p className="mt-1 text-[11px] text-gray-400">Also if a required milestone fails.</p>
        </div>
      </motion.div>
    </SceneFrame>
  )
}
