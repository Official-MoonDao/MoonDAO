import { animate, motion, useMotionValue, useMotionValueEvent } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import {
  SPRING,
  SceneFrame,
  StepCaption,
  useReplay,
  useSceneStep,
  type SceneProps,
} from '@/components/explainer/scene'

// One holder followed through every scene: bought, 10,000 MOONEY locked,
// decaying, and then voted with. Illustrative numbers, not live data; the buy
// scene shows no amounts so it can't imply a price.
const LOCKED = 10_000
const MAX_YEARS = 4

const BUY_TAG = { label: 'Buy', text: 'text-blue-200', bg: 'bg-blue-400/15' }
const LOCK_TAG = { label: 'Lock', text: 'text-indigo-200', bg: 'bg-indigo-400/15' }
const DECAY_TAG = { label: 'Over time', text: 'text-amber-200', bg: 'bg-amber-400/15' }
const POWER_TAG = { label: 'Voting power', text: 'text-purple-200', bg: 'bg-purple-400/15' }
const VOTE_TAG = { label: 'Member Vote', text: 'text-emerald-300', bg: 'bg-emerald-400/15' }

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

function CountUp({ value }: { value: number }) {
  const mv = useMotionValue(value)
  const [shown, setShown] = useState(value)
  useMotionValueEvent(mv, 'change', setShown)
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.6, ease: 'easeOut' })
    return () => controls.stop()
  }, [mv, value])
  return <>{fmt(shown)}</>
}

// ── 0. Swap ETH for MOONEY ───────────────────────────────────────────────

const NETWORKS = ['Ethereum', 'Arbitrum', 'Base']
const BUY_CAPTIONS = [
  'Sign in with a wallet, email or social account. No wallet? One is made for you.',
  'Pick a network: Ethereum, Arbitrum or Base.',
  'Swap ETH into the MOONEY pool on Uniswap v4…',
  '…and MOONEY comes straight back to your wallet.',
  'If the price moves more than 5% before it confirms, the swap is cancelled instead.',
]

function Coin({ symbol, className }: { symbol: string; className: string }) {
  return (
    <span
      className={`flex h-7 items-center rounded-full px-2.5 text-[11px] font-bold shadow-lg ${className}`}
    >
      {symbol}
    </span>
  )
}

export function BuyScene({ variant, active }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { key, replay } = useReplay()
  const { step, done } = useSceneStep(ref, BUY_CAPTIONS.length, active, key)
  const network = step >= 1 ? 0 : -1
  const ethSent = step >= 2
  const mooneyBack = step >= 3

  return (
    <SceneFrame
      sceneRef={ref}
      variant={variant}
      tag={BUY_TAG}
      title="Swap"
      label="Sign in, pick a network, and swap ETH for MOONEY through the Uniswap v4 pool, with a 5% slippage limit"
      caption={<StepCaption step={step} lines={BUY_CAPTIONS} />}
      onReplay={done ? replay : undefined}
    >
      <div className="flex h-full flex-col justify-between gap-3">
        <div className="flex gap-1.5">
          {NETWORKS.map((name, i) => (
            <span
              key={name}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-300 ${
                i === network
                  ? 'border-blue-400/50 bg-blue-400/15 text-blue-100'
                  : 'border-white/[0.08] text-gray-500'
              }`}
            >
              {name}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_5.5rem] sm:grid-cols-[6.5rem_minmax(0,1fr)_6.5rem] items-center gap-2">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Your wallet</p>
            <p className="mt-1 text-xs font-semibold text-emerald-300">Signed in ✓</p>
          </div>

          <div className="relative flex h-20 flex-col justify-center gap-5">
            <div className="h-px bg-white/[0.08]" />
            <div className="h-px bg-white/[0.08]" />
            <motion.div
              className="absolute top-[18%] -translate-y-1/2"
              initial={false}
              animate={{
                left: ethSent ? 'calc(100% - 3rem)' : '0%',
                opacity: ethSent && !mooneyBack ? 1 : 0,
              }}
              transition={{ duration: 0.9, ease: 'easeInOut' }}
            >
              <Coin symbol="ETH" className="bg-gray-200 text-gray-900" />
            </motion.div>
            <motion.div
              className="absolute top-[82%] -translate-y-1/2"
              initial={false}
              animate={{
                left: mooneyBack ? '0%' : 'calc(100% - 4.5rem)',
                opacity: mooneyBack ? 1 : 0,
              }}
              transition={{ duration: 0.9, ease: 'easeInOut' }}
            >
              <Coin
                symbol="MOONEY"
                className="bg-gradient-to-r from-blue-500 to-purple-500 text-white"
              />
            </motion.div>
          </div>

          <div className="rounded-xl border border-pink-400/25 bg-pink-400/[0.06] p-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-pink-200/70">Uniswap v4</p>
            <p className="mt-1 text-xs font-semibold text-white">MOONEY pool</p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <span className="text-[11px] uppercase tracking-wider text-gray-500">Wallet</span>
          <motion.span
            key={mooneyBack ? 'mooney' : 'empty'}
            initial={{ opacity: 0.4, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-sm font-semibold ${mooneyBack ? 'text-emerald-300' : 'text-gray-500'}`}
          >
            {mooneyBack ? '+ MOONEY received' : 'No MOONEY yet'}
          </motion.span>
        </div>
      </div>
    </SceneFrame>
  )
}

// ── 1. Lock length sets vMOONEY ──────────────────────────────────────────

const LOCK_LENGTHS = [
  { years: 7 / 365, label: '1 week' },
  { years: 1, label: '1 year' },
  { years: 2, label: '2 years' },
  { years: 4, label: '4 years' },
  { years: 4, label: '4 years' },
]
const LOCK_CAPTIONS = [
  'Lock 10,000 MOONEY for a week and you get almost no vMOONEY.',
  'Lock it for a year: a quarter of the maximum.',
  'Two years: half.',
  'Four years, the longest lock, gives the most.',
  'At the maximum, 1 MOONEY locked = 1 vMOONEY.',
]

export function LockLengthScene({ variant, active }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { key, replay } = useReplay()
  const { step, done } = useSceneStep(ref, LOCK_LENGTHS.length, active, key)
  const { years, label } = LOCK_LENGTHS[step]
  const vmooney = (LOCKED * years) / MAX_YEARS
  const pct = (years / MAX_YEARS) * 100

  return (
    <SceneFrame
      sceneRef={ref}
      variant={variant}
      tag={LOCK_TAG}
      title="10,000 MOONEY"
      label="The longer MOONEY is locked, the more vMOONEY it gives, up to 1 vMOONEY per MOONEY at four years"
      caption={<StepCaption step={step} lines={LOCK_CAPTIONS} />}
      onReplay={done ? replay : undefined}
    >
      <div className="flex h-full flex-col justify-center gap-4">
        <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <span className="text-[11px] uppercase tracking-wider text-gray-500">You lock</span>
          <span className="text-sm font-bold tabular-nums text-white">10,000 MOONEY</span>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[11px] uppercase tracking-wider text-gray-500">Lock length</span>
            <motion.span
              key={label}
              initial={{ opacity: 0.4, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-semibold text-indigo-200"
            >
              {label}
            </motion.span>
          </div>
          <div className="relative h-2 rounded-full bg-white/[0.06]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-400"
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={SPRING}
            />
            <motion.span
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-indigo-500 shadow-[0_0_12px_rgba(129,140,248,0.7)]"
              initial={false}
              animate={{ left: `${pct}%` }}
              transition={SPRING}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-gray-600">
            <span>1 wk</span>
            <span>1 yr</span>
            <span>2 yr</span>
            <span>3 yr</span>
            <span>4 yr</span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-indigo-400/30 bg-indigo-400/[0.08] px-3 py-2.5">
          <span className="text-[11px] uppercase tracking-wider text-indigo-200/80">You get</span>
          <span className="text-lg font-bold tabular-nums text-white">
            <CountUp value={vmooney} /> <span className="text-sm text-indigo-200">vMOONEY</span>
          </span>
        </div>
      </div>
    </SceneFrame>
  )
}

// ── 2. vMOONEY winds down to the unlock date ─────────────────────────────

const DECAY_STEPS = 5
const DECAY_CAPTIONS = [
  'Locked for 4 years: 10,000 vMOONEY.',
  'A year later, 3 years are left: 7,500 vMOONEY.',
  'vMOONEY falls steadily as the unlock date gets closer.',
  'Add MOONEY or extend the lock any time to top it back up.',
  'At unlock, vMOONEY reaches zero and all 10,000 MOONEY can be withdrawn.',
]
const CHART = { w: 300, h: 120, top: 8, bottom: 112 }

export function DecayScene({ variant, active }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { key, replay } = useReplay()
  const { step, done } = useSceneStep(ref, DECAY_STEPS, active, key)
  const t = step / (DECAY_STEPS - 1)
  const x = t * CHART.w
  const y = CHART.top + t * (CHART.bottom - CHART.top)
  const vmooney = LOCKED * (1 - t)
  const unlocked = step === DECAY_STEPS - 1

  return (
    <SceneFrame
      sceneRef={ref}
      variant={variant}
      tag={DECAY_TAG}
      title="4-year lock"
      label="vMOONEY falls in a straight line from the lock date to the unlock date, when the locked MOONEY can be withdrawn"
      caption={<StepCaption step={step} lines={DECAY_CAPTIONS} />}
      onReplay={done ? replay : undefined}
    >
      <div className="flex h-full flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] uppercase tracking-wider text-gray-500">
            Year {step} of 4
          </span>
          <span className="text-sm font-bold tabular-nums text-amber-200">
            <CountUp value={vmooney} /> vMOONEY
          </span>
        </div>
        <svg
          viewBox={`0 0 ${CHART.w} ${CHART.h}`}
          preserveAspectRatio="none"
          className="h-full min-h-0 w-full flex-1 overflow-visible"
          aria-hidden
        >
          <line
            x1={0}
            y1={CHART.top}
            x2={CHART.w}
            y2={CHART.bottom}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={2}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
          <motion.polygon
            initial={false}
            animate={{
              points: `0,${CHART.top} ${x},${y} ${x},${CHART.bottom} 0,${CHART.bottom}`,
            }}
            transition={SPRING}
            fill="rgba(251,191,36,0.10)"
          />
          <motion.line
            x1={0}
            y1={CHART.top}
            initial={false}
            animate={{ x2: x, y2: y }}
            transition={SPRING}
            stroke="#fbbf24"
            strokeWidth={2.5}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-gray-500">
            Locked: <span className="tabular-nums text-gray-300">10,000 MOONEY</span>
          </span>
          <motion.span
            initial={false}
            animate={{ opacity: unlocked ? 1 : 0.35, scale: unlocked ? 1 : 0.96 }}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
              unlocked
                ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300'
                : 'border-white/10 text-gray-500'
            }`}
          >
            {unlocked ? 'Withdraw 10,000 MOONEY' : 'Locked'}
          </motion.span>
        </div>
      </div>
    </SceneFrame>
  )
}

// ── 3. Voting power is the square root ───────────────────────────────────

const HOLDERS = [
  { name: 'Holder A', vmooney: 2_500 },
  { name: 'Holder B', vmooney: 10_000 },
  { name: 'Holder C', vmooney: 40_000 },
]
const MAX_VMOONEY = 40_000
const MAX_POWER = 200
const POWER_CAPTIONS = [
  'Three holders with very different vMOONEY balances.',
  'Voting power is the square root: 2,500 vMOONEY gives 50.',
  '10,000 vMOONEY gives 100.',
  '40,000 vMOONEY gives 200.',
  "16× the vMOONEY is only 4× the voting power, so the largest holders can't dominate.",
]

export function SquareRootScene({ variant, active }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { key, replay } = useReplay()
  const { step, done } = useSceneStep(ref, POWER_CAPTIONS.length, active, key)

  return (
    <SceneFrame
      sceneRef={ref}
      variant={variant}
      tag={POWER_TAG}
      title="√ vMOONEY"
      label="Voting power is the square root of vMOONEY: 2,500 gives 50, 10,000 gives 100, and 40,000 gives 200"
      caption={<StepCaption step={step} lines={POWER_CAPTIONS} />}
      onReplay={done ? replay : undefined}
    >
      <div className="flex h-full flex-col justify-center gap-3">
        {HOLDERS.map((holder, i) => {
          const revealed = step >= i + 1
          const power = Math.sqrt(holder.vmooney)
          return (
            <div key={holder.name}>
              <p className="mb-1 text-xs font-medium text-white">{holder.name}</p>
              <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_3.5rem] items-center gap-x-2 gap-y-1 text-[11px]">
                <span className="text-gray-500">vMOONEY</span>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    className="h-full rounded-full bg-blue-400/70"
                    initial={false}
                    animate={{ width: `${(holder.vmooney / MAX_VMOONEY) * 100}%` }}
                    transition={SPRING}
                  />
                </div>
                <span className="text-right tabular-nums text-gray-300">{fmt(holder.vmooney)}</span>
                <span className="text-gray-500">Power</span>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-400"
                    initial={false}
                    animate={{ width: revealed ? `${(power / MAX_POWER) * 100}%` : '0%' }}
                    transition={SPRING}
                  />
                </div>
                <motion.span
                  initial={false}
                  animate={{ opacity: revealed ? 1 : 0 }}
                  className="text-right font-bold tabular-nums text-purple-200"
                >
                  {fmt(power)}
                </motion.span>
              </div>
            </div>
          )
        })}
      </div>
    </SceneFrame>
  )
}

// ── 4. Spend it in the Member Vote ───────────────────────────────────────

const PROPOSALS = [
  { name: 'Lunar payload study', pct: 50 },
  { name: 'Habitat prototype', pct: 30 },
  { name: 'Education outreach', pct: 20 },
]
const VOTE_POWER = 100
const VOTE_CAPTIONS = [
  'Holder B brings 100 voting power to the Member Vote.',
  'Split it across proposals as percentages: 50% here…',
  '30% here…',
  '…and 20% here. The split has to add up to 100%.',
  'Retroactive rewards for finished projects are voted the same way.',
]

export function VoteScene({ variant, active }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { key, replay } = useReplay()
  const { step, done } = useSceneStep(ref, VOTE_CAPTIONS.length, active, key)
  const allocated = PROPOSALS.slice(0, Math.min(step, PROPOSALS.length)).reduce(
    (sum, p) => sum + p.pct,
    0
  )

  return (
    <SceneFrame
      sceneRef={ref}
      variant={variant}
      tag={VOTE_TAG}
      title="100 voting power"
      label="Voting power is split across proposals as percentages that add up to 100%"
      caption={<StepCaption step={step} lines={VOTE_CAPTIONS} />}
      onReplay={done ? replay : undefined}
    >
      <div className="flex h-full flex-col justify-center gap-2">
        {PROPOSALS.map((proposal, i) => {
          const pct = step >= i + 1 ? proposal.pct : 0
          return (
            <div
              key={proposal.name}
              className={`rounded-lg border px-2.5 py-2 transition-colors duration-300 ${
                pct
                  ? 'border-emerald-400/30 bg-emerald-400/[0.05]'
                  : 'border-white/[0.05] bg-white/[0.015]'
              }`}
            >
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-medium text-white">{proposal.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-gray-400">
                  <span className="font-bold text-emerald-300">
                    <CountUp value={pct} />%
                  </span>{' '}
                  · <CountUp value={(pct / 100) * VOTE_POWER} /> power
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  className="h-full rounded-full bg-emerald-400/80"
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={SPRING}
                />
              </div>
            </div>
          )
        })}
        <div className="flex items-center justify-between px-1 text-[11px]">
          <span className="text-gray-500">Allocated</span>
          <span
            className={`font-bold tabular-nums ${
              allocated === 100 ? 'text-emerald-300' : 'text-gray-300'
            }`}
          >
            <CountUp value={allocated} />% {allocated === 100 && '✓'}
          </span>
        </div>
      </div>
    </SceneFrame>
  )
}
