import { AnimatePresence, motion } from 'framer-motion'
import { useRef } from 'react'
import { OUTCOME_COLORS } from '@/lib/deprize/constants'
import {
  SPRING,
  SceneFrame,
  StepCaption,
  useReplay,
  useSceneStep,
  type SceneProps,
} from '@/components/explainer/scene'

// One race, followed through every scene: the same four landers, and numbers
// that carry over from one scene to the next (the odds the bet starts from are
// the odds the market ended on, and so on). Illustrative, not live data.
const TEAMS = [
  { name: 'Blue Ghost', color: OUTCOME_COLORS[1] },
  { name: 'Nova-C', color: OUTCOME_COLORS[3] },
  { name: 'Blue Moon MK1', color: OUTCOME_COLORS[6] },
  { name: 'Griffin', color: OUTCOME_COLORS[5] },
]
const PICK = 0

const ETH = { label: 'ETH market', text: 'text-emerald-300', bg: 'bg-emerald-400/15' }
const MOONEY = { label: 'MOONEY forecast · free', text: 'text-indigo-200', bg: 'bg-indigo-400/15' }

function OddsBar({
  team,
  pct,
  dim = false,
  compact = false,
}: {
  team: (typeof TEAMS)[number]
  pct: number
  dim?: boolean
  compact?: boolean
}) {
  return (
    <div className={`transition-opacity duration-300 ${dim ? 'opacity-35' : ''}`}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className={`truncate font-medium text-white ${compact ? 'text-xs' : 'text-sm'}`}>
          {team.name}
        </span>
        <motion.span
          key={pct}
          initial={{ opacity: 0.4, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          className={`font-bold tabular-nums ${compact ? 'text-xs' : 'text-sm'}`}
          style={{ color: team.color }}
        >
          {pct}%
        </motion.span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: team.color }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={SPRING}
        />
      </div>
    </div>
  )
}

// ── 1. The market ─────────────────────────────────────────────────────────

const MARKET_ODDS = [
  [25, 25, 25, 25],
  [23, 31, 23, 23],
  [30, 28, 21, 21],
  [29, 27, 20, 24],
  [26, 33, 19, 22],
  [26, 33, 19, 22],
]
const MARKET_BETS = [
  null,
  { team: 1, eth: '0.05' },
  { team: 0, eth: '0.10' },
  { team: 3, eth: '0.02' },
  { team: 1, eth: '0.08' },
  null,
]
const MARKET_CAPTIONS = [
  'A new market starts every team at even odds.',
  'Someone bets on Nova-C. Its chance goes up, the rest go down.',
  'Each bet moves the odds toward the team it backs.',
  'The chance shown is the market price of that team winning.',
  'More bets, more movement.',
  'Chance to win = what bettors are paying for it right now.',
]

export function OddsRaceScene({ variant, active }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { key, replay } = useReplay()
  const { step, done } = useSceneStep(ref, MARKET_ODDS.length, active, key)
  const odds = MARKET_ODDS[step]
  const ticker = MARKET_BETS.slice(0, step + 1)
    .flatMap((bet, id) => (bet ? [{ ...bet, id }] : []))
    .reverse()

  return (
    <SceneFrame
      sceneRef={ref}
      variant={variant}
      tag={ETH}
      title="Touchdown"
      label="Four landers start at even odds; each ETH bet moves the odds toward the team it backs"
      caption={<StepCaption step={step} lines={MARKET_CAPTIONS} />}
      onReplay={done ? replay : undefined}
    >
      <div className="grid h-full grid-cols-[minmax(0,1fr)_7.5rem] gap-4">
        <div className="flex flex-col justify-center gap-2.5">
          {TEAMS.map((team, i) => (
            <OddsBar key={team.name} team={team} pct={odds[i]} />
          ))}
        </div>
        <div className="flex flex-col gap-1.5 overflow-hidden border-l border-white/[0.06] pl-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Bets</p>
          <AnimatePresence initial={false}>
            {ticker.slice(0, 4).map((bet, i) => (
              <motion.div
                key={bet.id}
                layout
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: i === 0 ? 1 : 0.55, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-[11px]"
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TEAMS[bet.team].color }} />
                <span className="truncate text-gray-300">{TEAMS[bet.team].name}</span>
                <span className="ml-auto tabular-nums text-emerald-300">{bet.eth}</span>
              </motion.div>
            ))}
          </AnimatePresence>
          {ticker.length === 0 && <p className="text-[11px] text-gray-600">No bets yet</p>}
        </div>
      </div>
    </SceneFrame>
  )
}

// ── 2. Predict (MOONEY) ───────────────────────────────────────────────────

// Each Citizen's dot is sized by voting power. `at` is the step it arrives on.
const VOTERS = [
  { team: 1, size: 14, at: 1 },
  { team: 0, size: 10, at: 1 },
  { team: 1, size: 8, at: 2 },
  { team: 3, size: 16, at: 2 },
  { team: 0, size: 12, at: 2 },
  { team: 2, size: 8, at: 3 },
  { team: 1, size: 10, at: 3 },
  { team: 0, size: 18, at: 3 },
]
const YOU = { team: PICK, size: 12, at: 4 }
const PREDICT_STEPS = 6
const PREDICT_CAPTIONS = [
  'Citizens pick who they think lands first. It costs nothing.',
  'Each pick counts by the Citizen’s voting power. Bigger dot, more weight.',
  'Picks add up into the MOONEY forecast.',
  'Anyone can see where the community stands.',
  'You pick Blue Ghost. Your dot joins the forecast.',
  'The forecast moved. The ETH odds did not: no money changed hands.',
]

export function PredictScene({ variant, active }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { key, replay } = useReplay()
  const { step, done } = useSceneStep(ref, PREDICT_STEPS, active, key)
  const shown = [...VOTERS, YOU]
    .map((v, id) => ({ ...v, id, you: v === YOU }))
    .filter((v) => v.at <= step)
  const power = TEAMS.map((_, i) => shown.filter((v) => v.team === i).reduce((s, v) => s + v.size, 0))
  const total = power.reduce((s, v) => s + v, 0)
  const share = power.map((v) => (total ? Math.round((v / total) * 100) : 0))

  return (
    <SceneFrame
      sceneRef={ref}
      variant={variant}
      tag={MOONEY}
      title="Touchdown"
      label="Citizens pick a lander for free; picks weighted by voting power form the MOONEY forecast, and the ETH odds do not move"
      caption={<StepCaption step={step} lines={PREDICT_CAPTIONS} />}
      onReplay={done ? replay : undefined}
    >
      <div className="flex h-full flex-col justify-center gap-2">
        {TEAMS.map((team, i) => {
          const mine = step >= YOU.at && i === PICK
          return (
            <div
              key={team.name}
              className={`flex items-center gap-3 rounded-lg border px-2.5 py-1.5 transition-colors duration-300 ${
                mine ? 'border-indigo-400/50 bg-indigo-400/[0.08]' : 'border-white/[0.05] bg-white/[0.015]'
              }`}
            >
              <span className="w-24 shrink-0 truncate text-xs font-medium text-white sm:w-28">
                {team.name}
              </span>
              <div className="flex h-5 min-w-0 flex-1 items-center gap-1">
                <AnimatePresence initial={false}>
                  {shown
                    .filter((v) => v.team === i)
                    .map((v) => (
                      <motion.span
                        key={v.id}
                        initial={{ opacity: 0, y: -14, scale: 0.4 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.4 }}
                        transition={SPRING}
                        className={`shrink-0 rounded-full ${v.you ? 'ring-2 ring-white' : ''}`}
                        style={{ width: v.size, height: v.size, background: team.color }}
                      />
                    ))}
                </AnimatePresence>
              </div>
              <span className="w-10 shrink-0 text-right text-xs font-bold tabular-nums text-indigo-200">
                {total ? `${share[i]}%` : '—'}
              </span>
            </div>
          )
        })}
        <motion.div
          initial={false}
          animate={{ opacity: step >= PREDICT_STEPS - 1 ? 1 : 0 }}
          className="flex items-center justify-between rounded-lg bg-emerald-400/[0.06] px-2.5 py-1 text-[11px] text-emerald-200/80"
        >
          <span>ETH odds</span>
          <span className="tabular-nums">
            {MARKET_ODDS[MARKET_ODDS.length - 1].map((p) => `${p}%`).join(' · ')} — unchanged
          </span>
        </motion.div>
      </div>
    </SceneFrame>
  )
}

// ── 3. Bet (ETH) ──────────────────────────────────────────────────────────

const BET_BEFORE = MARKET_ODDS[MARKET_ODDS.length - 1]
const BET_AFTER = [29, 31, 18, 22]
const BET_STEPS = 6
const BET_CAPTIONS = [
  'Back your pick with real ETH instead.',
  'Pick Blue Ghost at 26%.',
  'Bet 0.1 ETH. At about 27¢ a share, that buys about 0.35 shares.',
  '5% of the bet goes straight into the prize pool.',
  'Your bet moves the odds: Blue Ghost is now 29%.',
  'Each share pays 1 ETH if Blue Ghost wins. Cash out any time before then.',
]

export function BetScene({ variant, active }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { key, replay } = useReplay()
  const { step, done } = useSceneStep(ref, BET_STEPS, active, key)
  const odds = step >= 4 ? BET_AFTER : BET_BEFORE
  const team = TEAMS[PICK]

  return (
    <SceneFrame
      sceneRef={ref}
      variant={variant}
      tag={ETH}
      title="Touchdown"
      label="Betting 0.1 ETH on Blue Ghost at 26%: about 0.35 shares that pay 1 ETH each if it wins, 5% to the prize pool, and the odds move to 29%"
      caption={<StepCaption step={step} lines={BET_CAPTIONS} />}
      onReplay={done ? replay : undefined}
    >
      <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
        <div className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
          <div className="flex items-center justify-between">
            <span
              className="rounded-md px-2 py-1 text-xs font-semibold text-white transition-colors duration-300"
              style={{ background: step >= 1 ? team.color : 'rgba(255,255,255,0.06)' }}
            >
              {team.name} {odds[PICK]}%
            </span>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Amount</p>
            <p className="text-xl font-bold tabular-nums text-white">
              {step >= 2 ? '0.1' : '0'} <span className="text-xs text-gray-400">ETH</span>
            </p>
          </div>
          <motion.div
            initial={false}
            animate={{ opacity: step >= 2 ? 1 : 0 }}
            className="flex flex-col gap-0.5 text-[11px] text-gray-400"
          >
            <span className="flex justify-between">
              Shares <span className="tabular-nums text-gray-200">≈0.35</span>
            </span>
            <span className="flex justify-between">
              To win <span className="tabular-nums text-emerald-300">≈0.35 ETH</span>
            </span>
          </motion.div>
          <motion.span
            className="mt-auto rounded-lg py-1.5 text-center text-xs font-bold text-white"
            style={{ background: team.color }}
            initial={false}
            animate={{ scale: step === 3 ? 0.94 : 1, opacity: step >= 1 ? 1 : 0.4 }}
            transition={{ duration: 0.15 }}
          >
            {step >= 4 ? 'Bet placed' : `Bet on ${team.name}`}
          </motion.span>
        </div>

        <div className="relative flex flex-col justify-between gap-2">
          <div className="flex flex-col gap-1.5">
            {TEAMS.map((t, i) => (
              <OddsBar key={t.name} team={t} pct={odds[i]} dim={i !== PICK && step >= 1} compact />
            ))}
          </div>
          <div className="flex items-center justify-between rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-2.5 py-1.5">
            <span className="text-[11px] text-amber-200/80">Prize pool</span>
            <motion.span
              key={step >= 3 ? 'after' : 'before'}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              className="text-sm font-bold tabular-nums text-amber-300"
            >
              {step >= 3 ? '2.405' : '2.400'} ETH
            </motion.span>
          </div>
          <AnimatePresence>
            {step === 3 && (
              <motion.span
                className="absolute -left-6 top-1/2 h-3 w-3 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.8)]"
                initial={{ x: 0, y: 0, opacity: 0 }}
                animate={{ x: 60, y: 70, opacity: [0, 1, 1, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: 'easeInOut' }}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </SceneFrame>
  )
}

// ── 4. Resolution ─────────────────────────────────────────────────────────

const RESOLVE_STAGES = ['Evidence checked', 'Senate vote', '72h challenge', 'Result on-chain']
const RESOLVE_STEPS = 6
const RESOLVE_CAPTIONS = [
  'Experts check the evidence against rules published before betting opened.',
  'The Senate votes on the result.',
  'Anyone can challenge it for 72 hours.',
  'The result is reported on-chain.',
  'Say Blue Ghost lands first.',
  'Winning shares pay 1 ETH each. If nobody wins or the race is cancelled, bets are refunded.',
]

export function ResolveScene({ variant, active }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { key, replay } = useReplay()
  const { step, done } = useSceneStep(ref, RESOLVE_STEPS, active, key)
  const lit = Math.min(step, RESOLVE_STAGES.length - 1)
  const decided = step >= RESOLVE_STAGES.length

  return (
    <SceneFrame
      sceneRef={ref}
      variant={variant}
      tag={ETH}
      title="Touchdown"
      label="Evidence review, Senate vote, a 72 hour challenge, then the result goes on-chain; if Blue Ghost wins, its shares pay 1 ETH each"
      caption={<StepCaption step={step} lines={RESOLVE_CAPTIONS} />}
      onReplay={done ? replay : undefined}
    >
      <ol className="relative flex justify-between">
        <span className="absolute left-4 right-4 top-3.5 h-0.5 bg-white/10" aria-hidden />
        <motion.span
          className="absolute left-4 top-3.5 h-0.5 bg-emerald-400"
          aria-hidden
          initial={false}
          animate={{ width: `calc(${(lit / (RESOLVE_STAGES.length - 1)) * 100}% - 2rem)` }}
          transition={{ duration: 0.5 }}
        />
        {RESOLVE_STAGES.map((stage, i) => (
          <li key={stage} className="relative z-10 flex w-16 flex-col items-center gap-1.5 sm:w-20">
            <motion.span
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold"
              initial={false}
              animate={{
                backgroundColor: i <= lit ? '#34d399' : '#0b0d12',
                borderColor: i <= lit ? '#34d399' : 'rgba(255,255,255,0.2)',
                color: i <= lit ? '#052e16' : '#9ca3af',
                scale: i === step ? 1.12 : 1,
              }}
              transition={{ duration: 0.25 }}
            >
              {i + 1}
            </motion.span>
            <span className={`text-center text-[10px] leading-tight ${i <= lit ? 'text-white' : 'text-gray-500'}`}>
              {stage}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-4 grid grid-cols-2 gap-1.5">
        {TEAMS.map((team, i) => {
          const won = decided && i === PICK
          return (
            <motion.div
              key={team.name}
              initial={false}
              animate={{ opacity: decided && !won ? 0.35 : 1 }}
              className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs ${
                won ? 'border-emerald-400/50 bg-emerald-400/[0.08]' : 'border-white/[0.06] bg-white/[0.02]'
              }`}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: team.color }} />
                <span className="truncate text-white">{team.name}</span>
              </span>
              <span className={`shrink-0 tabular-nums ${won ? 'font-semibold text-emerald-300' : 'text-gray-500'}`}>
                {decided ? (won ? '1 ETH/share' : '0') : '…'}
              </span>
            </motion.div>
          )
        })}
      </div>
      <motion.p
        initial={false}
        animate={{ opacity: step >= RESOLVE_STEPS - 1 ? 1 : 0 }}
        className="mt-2 text-xs font-semibold text-white"
      >
        Your ≈0.35 shares → <span className="text-emerald-300">≈0.35 ETH</span>
      </motion.p>
    </SceneFrame>
  )
}

// ── 5. Prize pool ─────────────────────────────────────────────────────────

const PRIZE = [
  { total: '2.400', fill: 40, source: null },
  { total: '2.405', fill: 44, source: 'bet' },
  { total: '2.418', fill: 50, source: 'bet' },
  { total: '2.918', fill: 70, source: 'fund' },
  { total: '2.931', fill: 76, source: 'bet' },
  { total: '2.931', fill: 76, source: null },
] as const
const PRIZE_CAPTIONS = [
  'Every race has a prize pool.',
  'Your bet sent 0.005 ETH in: 5% of every bet goes to the pool.',
  'So does every other bet.',
  'Anyone can also fund the prize directly.',
  'The pool keeps growing while the race runs.',
  'Bettors don’t share it. It goes to the winning team, as a community payload on their next flight.',
]

export function PrizeScene({ variant, active }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { key, replay } = useReplay()
  const { step, done } = useSceneStep(ref, PRIZE.length, active, key)
  const now = PRIZE[step]
  const awarded = step === PRIZE.length - 1

  return (
    <SceneFrame
      sceneRef={ref}
      variant={variant}
      tag={{ label: 'Prize pool', text: 'text-amber-200', bg: 'bg-amber-400/15' }}
      title="Touchdown"
      label="The prize pool fills from 5% of every bet and from direct funding, and goes to the winning team"
      caption={<StepCaption step={step} lines={PRIZE_CAPTIONS} />}
      onReplay={done ? replay : undefined}
    >
      <div className="grid h-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <div className="flex flex-col gap-2">
          {(['bet', 'fund'] as const).map((kind) => (
            <div
              key={kind}
              className={`rounded-lg border px-2.5 py-2 transition-colors duration-300 ${
                now.source === kind ? 'border-amber-400/50 bg-amber-400/10' : 'border-white/[0.06] bg-white/[0.02]'
              }`}
            >
              <p className="text-xs font-semibold text-white">{kind === 'bet' ? 'Every bet' : 'Funders'}</p>
              <p className="text-[11px] text-gray-400">{kind === 'bet' ? '5% to the pool' : 'Add ETH directly'}</p>
            </div>
          ))}
        </div>

        <div className="relative flex flex-col items-center">
          <AnimatePresence>
            {now.source && (
              <motion.span
                key={step}
                className="absolute -top-3 h-3.5 w-3.5 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.8)]"
                initial={{ y: -8, opacity: 0 }}
                animate={{ y: 60, opacity: [0, 1, 1, 0] }}
                transition={{ duration: 0.7, ease: 'easeIn' }}
              />
            )}
          </AnimatePresence>
          <div className="relative h-32 w-20 overflow-hidden rounded-b-2xl rounded-t-md border-2 border-white/15 bg-white/[0.02]">
            <motion.div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-500/70 to-amber-300/50"
              initial={false}
              animate={{ height: `${now.fill}%` }}
              transition={SPRING}
            />
          </div>
          <p className="mt-2 text-sm font-bold tabular-nums text-amber-300">{now.total} ETH</p>
        </div>

        <motion.div
          initial={false}
          animate={{ opacity: awarded ? 1 : 0.25, x: awarded ? 0 : -8 }}
          transition={{ duration: 0.4 }}
          className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-2"
        >
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Goes to</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-white">
            <span className="h-2 w-2 rounded-full" style={{ background: TEAMS[PICK].color }} />
            The winning team
          </p>
          <p className="mt-0.5 text-[11px] text-gray-400">Not to bettors</p>
        </motion.div>
      </div>
    </SceneFrame>
  )
}
