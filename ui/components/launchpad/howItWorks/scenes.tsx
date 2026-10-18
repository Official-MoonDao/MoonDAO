import { AnimatePresence, motion } from 'framer-motion'
import { useRef } from 'react'
import {
  SPRING,
  SceneFrame,
  StepCaption,
  useSceneStep,
  type SceneProps,
  type SceneTag,
} from '@/components/explainer/scene'

// One mission, followed through every scene. Numbers carry over: the 1 ETH you
// contribute is the 1 ETH you get back in the refund scene, and the 60 ETH the
// campaign ends on is the 60 ETH that gets split. Splits match MissionCreator.sol.
// Illustrative, not live data.
const MISSION = { name: 'Lunar Seed Vault', token: '$SEED', goal: 50 }

const CAMPAIGN: SceneTag = { label: 'Mission campaign', text: 'text-violet-200', bg: 'bg-violet-400/15' }
const TOKENS: SceneTag = { label: 'Mission tokens', text: 'text-sky-200', bg: 'bg-sky-400/15' }
const PAYOUT: SceneTag = { label: 'Goal reached', text: 'text-emerald-300', bg: 'bg-emerald-400/15' }
const REFUND: SceneTag = { label: 'Goal missed', text: 'text-amber-200', bg: 'bg-amber-400/15' }
const VESTING: SceneTag = { label: 'Vesting', text: 'text-indigo-200', bg: 'bg-indigo-400/15' }

const BRAND = 'linear-gradient(90deg, #6C407D, #5F4BA2 40%, #4660E7)'

function Lock({ open = false }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d={open ? 'M5.5 7V5a2.5 2.5 0 0 1 4.9-.7' : 'M5.5 7V5a2.5 2.5 0 0 1 5 0v2'} />
    </svg>
  )
}

/** Funding bar with a goal marker. The track runs to 120% of the goal so overshoot shows. */
function FundingBar({ raised, goal, color = BRAND }: { raised: number; goal: number; color?: string }) {
  const max = goal * 1.2
  return (
    <div className="relative h-3 w-full rounded-full bg-white/[0.06]">
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: color }}
        initial={false}
        animate={{ width: `${Math.min(100, (raised / max) * 100)}%` }}
        transition={SPRING}
      />
      <span
        className="absolute -top-1 bottom-[-4px] w-0.5 rounded bg-white/70"
        style={{ left: `${(goal / max) * 100}%` }}
        aria-hidden
      />
    </div>
  )
}

// ── 1. The campaign ───────────────────────────────────────────────────────

const RAISED = [0, 9, 22, 37, 51, 60]
const DAYS_LEFT = [28, 24, 19, 13, 9, 0]
const CONTRIBUTIONS = [
  null,
  { who: 'ada.eth', eth: '2.0' },
  { who: 'Card payment', eth: '0.4' },
  { who: 'orbit.eth', eth: '5.0' },
  { who: 'Card payment', eth: '1.0' },
  { who: 'You', eth: '1.0' },
]
const CAMPAIGN_CAPTIONS = [
  'A team posts a mission: a 50 ETH goal and 28 days to reach it.',
  'Anyone can contribute, with ETH or a debit card.',
  'Every contribution is on-chain, so anyone can check the total.',
  'Contributors get mission tokens back for what they put in.',
  'Goal reached before the deadline. The mission is a go.',
  'The campaign closes at 60 ETH, and the funds go to work.',
]

export function CampaignScene({ variant, active }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { step } = useSceneStep(ref, RAISED.length, active, 0, true)
  const raised = RAISED[step]
  const funded = raised >= MISSION.goal
  const ticker = CONTRIBUTIONS.slice(0, step + 1)
    .flatMap((c, id) => (c ? [{ ...c, id }] : []))
    .reverse()

  return (
    <SceneFrame
      sceneRef={ref}
      variant={variant}
      tag={CAMPAIGN}
      title={MISSION.name}
      label="A mission with a 50 ETH goal and 28 days collects contributions in ETH and by card, passes its goal, and closes at 60 ETH"
      caption={<StepCaption step={step} lines={CAMPAIGN_CAPTIONS} />}
    >
      <div className="grid h-full grid-cols-[minmax(0,1fr)_7.5rem] gap-4">
        <div className="flex flex-col justify-center gap-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-heading text-lg font-bold text-white"
              style={{ background: BRAND }}
              aria-hidden
            >
              S
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{MISSION.name}</p>
              <p className="text-[11px] text-gray-400">Seed library for the first lunar greenhouse</p>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <motion.span
                key={raised}
                initial={{ opacity: 0.4, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-bold tabular-nums text-white"
              >
                {raised} <span className="text-sm font-medium text-gray-400">ETH</span>
              </motion.span>
              <span className="text-[11px] text-gray-400">Goal {MISSION.goal} ETH</span>
            </div>
            <FundingBar raised={raised} goal={MISSION.goal} />
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="tabular-nums text-gray-400">
              {DAYS_LEFT[step] > 0 ? `${DAYS_LEFT[step]} days left` : 'Campaign closed'}
            </span>
            <motion.span
              initial={false}
              animate={{ opacity: funded ? 1 : 0, scale: funded ? 1 : 0.9 }}
              className="rounded-full bg-emerald-400/15 px-2 py-0.5 font-semibold text-emerald-300"
            >
              Goal reached
            </motion.span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 overflow-hidden border-l border-white/[0.06] pl-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Contributions</p>
          <AnimatePresence initial={false}>
            {ticker.slice(0, 4).map((c, i) => (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: i === 0 ? 1 : 0.55, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-[11px]"
              >
                <span className={`truncate ${c.who === 'You' ? 'font-semibold text-white' : 'text-gray-300'}`}>
                  {c.who}
                </span>
                <span className="ml-auto tabular-nums text-violet-200">{c.eth}</span>
              </motion.div>
            ))}
          </AnimatePresence>
          {ticker.length === 0 && <p className="text-[11px] text-gray-600">None yet</p>}
        </div>
      </div>
    </SceneFrame>
  )
}

// ── 2. Contribute → tokens ────────────────────────────────────────────────

const SPLIT = [
  { who: 'You', tokens: 1000, pct: '50%', color: '#38bdf8', locked: false },
  { who: 'Team', tokens: 600, pct: '30%', color: '#a78bfa', locked: true },
  { who: 'MoonDAO', tokens: 350, pct: '17.5%', color: '#818cf8', locked: true },
  { who: 'Trading pool', tokens: 50, pct: '2.5%', color: '#34d399', locked: true },
]
const CONTRIBUTE_STEPS = 6
const CONTRIBUTE_CAPTIONS = [
  'You contribute 1 ETH to the mission.',
  `At the standard rate, 1 ETH mints 2,000 ${MISSION.token}.`,
  'Half of them, 1,000, go straight to your wallet.',
  'The other half is reserved for the team, MoonDAO and a trading pool.',
  'Those reserved tokens are locked, so the team only wins if the mission does.',
  'Your tokens give you a stake in the mission and a voice in where it goes.',
]

export function ContributeScene({ variant, active }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { step } = useSceneStep(ref, CONTRIBUTE_STEPS, active, 0, true)
  const minted = step >= 1
  const shownRows = step >= 3 ? SPLIT.length : step >= 2 ? 1 : 0

  return (
    <SceneFrame
      sceneRef={ref}
      variant={variant}
      tag={TOKENS}
      title={MISSION.name}
      label={`1 ETH mints 2,000 ${MISSION.token}: 1,000 to you, 600 to the team, 350 to MoonDAO and 50 to a trading pool, with the reserved tokens locked`}
      caption={<StepCaption step={step} lines={CONTRIBUTE_CAPTIONS} />}
    >
      <div className="grid h-full grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-4">
        <div className="flex flex-col items-center gap-2">
          <motion.span
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-sm font-bold text-white"
            initial={false}
            animate={{ scale: step === 0 ? [1, 1.08, 1] : 1, opacity: minted ? 0.5 : 1 }}
            transition={{ duration: 0.6 }}
          >
            1 ETH
          </motion.span>
          <motion.span initial={false} animate={{ opacity: minted ? 1 : 0.2 }} className="text-gray-500" aria-hidden>
            ↓
          </motion.span>
          <motion.div
            className="rounded-xl px-2.5 py-1.5 text-center"
            style={{ background: BRAND }}
            initial={false}
            animate={{ opacity: minted ? 1 : 0.25, scale: step === 1 ? 1.06 : 1 }}
            transition={SPRING}
          >
            <p className="text-sm font-bold tabular-nums text-white">{minted ? '2,000' : '0'}</p>
            <p className="text-[10px] text-white/80">{MISSION.token} minted</p>
          </motion.div>
        </div>

        <div className="flex flex-col gap-2">
          {SPLIT.map((row, i) => {
            const shown = i < shownRows
            const highlightLock = step >= 4 && row.locked
            return (
              <motion.div
                key={row.who}
                initial={false}
                animate={{ opacity: shown ? 1 : 0.15, x: shown ? 0 : 10 }}
                transition={SPRING}
                className={`rounded-lg border px-2.5 py-1.5 transition-colors duration-300 ${
                  highlightLock
                    ? 'border-indigo-400/40 bg-indigo-400/[0.07]'
                    : step >= 5 && !row.locked
                    ? 'border-sky-400/50 bg-sky-400/[0.08]'
                    : 'border-white/[0.06] bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 text-white">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: row.color }} />
                    <span className="truncate">{row.who}</span>
                    {row.locked && (
                      <span className={highlightLock ? 'text-indigo-200' : 'text-gray-500'}>
                        <Lock />
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums text-gray-300">
                    {shown ? row.tokens.toLocaleString('en-US') : '—'}{' '}
                    <span className="text-gray-500">· {row.pct}</span>
                  </span>
                </div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: row.color }}
                    initial={false}
                    animate={{ width: shown ? `${(row.tokens / 1000) * 100}%` : '0%' }}
                    transition={SPRING}
                  />
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </SceneFrame>
  )
}

// ── 3. Goal reached → where the ETH goes ──────────────────────────────────

const RAISED_TOTAL = RAISED[RAISED.length - 1]
const PAYOUTS = [
  { to: 'Mission team', pct: 90, color: '#8b5cf6', note: 'Team multisig, to build the mission' },
  { to: 'Trading pool', pct: 5, color: '#34d399', note: `With 2.5% of tokens, so ${MISSION.token} can trade` },
  { to: 'MoonDAO treasury', pct: 2.5, color: '#818cf8', note: 'Funds more space projects' },
  { to: 'Juicebox', pct: 2.5, color: '#94a3b8', note: 'The audited protocol under the hood' },
]
const PAYOUT_CAPTIONS = [
  `The mission closed at ${RAISED_TOTAL} ETH, past its ${MISSION.goal} ETH goal.`,
  `90%, ${(RAISED_TOTAL * 0.9).toFixed(0)} ETH, goes to the team to build the mission.`,
  `5% seeds a Uniswap pool with 2.5% of the tokens, so ${MISSION.token} can be traded.`,
  '2.5% goes to the MoonDAO treasury, which funds more space projects.',
  '2.5% goes to Juicebox, the audited protocol that holds the funds.',
  'Every payout happens on-chain, so anyone can trace where the money went.',
]

export function PayoutScene({ variant, active }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { step } = useSceneStep(ref, PAYOUT_CAPTIONS.length, active, 0, true)
  const paid = Math.min(step, PAYOUTS.length)

  return (
    <SceneFrame
      sceneRef={ref}
      variant={variant}
      tag={PAYOUT}
      title={MISSION.name}
      label={`${RAISED_TOTAL} ETH raised is split 90% to the team, 5% to a trading pool, 2.5% to the MoonDAO treasury and 2.5% to Juicebox`}
      caption={<StepCaption step={step} lines={PAYOUT_CAPTIONS} />}
    >
      <div className="flex h-full flex-col justify-center gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-wider text-gray-500">Raised</span>
          <span className="text-sm font-bold tabular-nums text-white">{RAISED_TOTAL} ETH</span>
        </div>
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-white/[0.06]">
          {PAYOUTS.map((p, i) => (
            <motion.div
              key={p.to}
              className="h-full"
              style={{ background: p.color }}
              initial={false}
              animate={{ width: i < paid ? `${p.pct}%` : '0%' }}
              transition={SPRING}
            />
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          {PAYOUTS.map((p, i) => {
            const shown = i < paid
            const current = i === step - 1
            return (
              <motion.div
                key={p.to}
                initial={false}
                animate={{ opacity: shown ? 1 : 0.25 }}
                className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors duration-300 ${
                  current ? 'border-white/20 bg-white/[0.05]' : 'border-white/[0.05] bg-white/[0.015]'
                }`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
                <span className="w-28 shrink-0 truncate font-medium text-white sm:w-32">{p.to}</span>
                <span className="hidden min-w-0 flex-1 truncate text-[11px] text-gray-400 sm:block">{p.note}</span>
                <span className="ml-auto shrink-0 tabular-nums text-gray-200">
                  {p.pct}% · {((RAISED_TOTAL * p.pct) / 100).toLocaleString('en-US', { maximumFractionDigits: 1 })} ETH
                </span>
              </motion.div>
            )
          })}
        </div>
      </div>
    </SceneFrame>
  )
}

// ── 4. Goal missed → refunds ──────────────────────────────────────────────

const MISSED = [
  { raised: 30, days: '3 days left', status: 'Funding' },
  { raised: 32, days: 'Deadline', status: 'Funding' },
  { raised: 32, days: 'Deadline passed', status: 'Goal missed' },
  { raised: 32, days: 'Refunds open · 28 days', status: 'Refunds open' },
  { raised: 31, days: 'Refunds open · 27 days', status: 'Refunds open' },
  { raised: 31, days: 'Refunds open · 27 days', status: 'Refunds open' },
]
const REFUND_CAPTIONS = [
  'Say a mission has 3 days left and is short of its goal.',
  'The deadline arrives with 32 of 50 ETH raised.',
  'The goal was missed, so the mission does not go ahead. The team receives nothing.',
  'A 28-day refund window opens.',
  'You hand back your 1,000 tokens and get your 1 ETH back.',
  'Teams choose whether to offer refunds when they launch, so check before you contribute.',
]

export function RefundScene({ variant, active }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { step } = useSceneStep(ref, MISSED.length, active, 0, true)
  const now = MISSED[step]
  const refunded = step >= 4
  const missed = step >= 2

  return (
    <SceneFrame
      sceneRef={ref}
      variant={variant}
      tag={REFUND}
      title="Another mission"
      label="A mission reaches its deadline with 32 of 50 ETH; the goal is missed, a 28-day refund window opens, and you return 1,000 tokens for your 1 ETH"
      caption={<StepCaption step={step} lines={REFUND_CAPTIONS} />}
    >
      <div className="flex h-full flex-col justify-center gap-4">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-xl font-bold tabular-nums text-white">
              {now.raised} <span className="text-sm font-medium text-gray-400">/ {MISSION.goal} ETH</span>
            </span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={now.status}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  missed ? 'bg-amber-400/15 text-amber-200' : 'bg-white/[0.06] text-gray-300'
                }`}
              >
                {now.status}
              </motion.span>
            </AnimatePresence>
          </div>
          <FundingBar raised={now.raised} goal={MISSION.goal} color={missed ? '#f59e0b' : BRAND} />
          <p className="mt-1.5 text-[11px] tabular-nums text-gray-400">{now.days}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Your {MISSION.token}</p>
            <motion.p
              key={refunded ? 'r' : 'h'}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              className="text-lg font-bold tabular-nums text-white"
            >
              {refunded ? '0' : '1,000'}
            </motion.p>
          </div>
          <div
            className={`rounded-lg border px-3 py-2 transition-colors duration-300 ${
              refunded ? 'border-emerald-400/40 bg-emerald-400/[0.07]' : 'border-white/[0.06] bg-white/[0.02]'
            }`}
          >
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Refunded to you</p>
            <motion.p
              key={refunded ? 'r' : 'h'}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              className={`text-lg font-bold tabular-nums ${refunded ? 'text-emerald-300' : 'text-gray-500'}`}
            >
              {refunded ? '+1 ETH' : '0 ETH'}
            </motion.p>
          </div>
        </div>
      </div>
    </SceneFrame>
  )
}

// ── 5. Vesting ────────────────────────────────────────────────────────────

// Year shown on the timeline at each step, and the share unlocked then:
// nothing before the 1-year cliff, then linear from launch to year 4 (Vesting.sol).
const VEST_YEAR = [0, 0.6, 1, 2, 3, 4]
const unlockedAt = (year: number) => (year < 1 ? 0 : Math.min(100, (year / 4) * 100))
const VEST_HOLDERS = [
  { who: 'Mission team', share: '30% of tokens', color: '#a78bfa' },
  { who: 'MoonDAO', share: '17.5% of tokens', color: '#818cf8' },
]
const VESTING_CAPTIONS = [
  'At launch, the team’s and MoonDAO’s tokens are locked.',
  'Nothing unlocks during the first year.',
  'At one year, the cliff passes and a quarter unlocks at once.',
  'After that, the rest unlocks a little every day.',
  'Three quarters unlocked by year three.',
  'Fully unlocked after four years, so the team stays invested the whole way.',
]

export function VestingScene({ variant, active }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { step } = useSceneStep(ref, VEST_YEAR.length, active, 0, true)
  const year = VEST_YEAR[step]
  const unlocked = unlockedAt(year)

  return (
    <SceneFrame
      sceneRef={ref}
      variant={variant}
      tag={VESTING}
      title={MISSION.name}
      label="Team and MoonDAO tokens stay locked for one year, a quarter unlocks at the cliff, and the rest unlocks steadily until year four"
      caption={<StepCaption step={step} lines={VESTING_CAPTIONS} />}
    >
      <div className="flex h-full flex-col justify-center gap-4">
        <div className="relative pt-5">
          <motion.span
            className="absolute top-0 whitespace-nowrap rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-black"
            initial={false}
            animate={{ left: `${(year / 4) * 100}%`, x: `${-(year / 4) * 100}%` }}
            transition={SPRING}
          >
            {year === 0 ? 'Launch' : `Year ${Number.isInteger(year) ? year : year.toFixed(1)}`}
          </motion.span>
          <div className="relative h-1 w-full rounded-full bg-white/10">
            <span className="absolute inset-y-0 left-0 w-1/4 rounded-l-full bg-amber-400/30" aria-hidden />
            <motion.span
              className="absolute inset-y-0 left-0 rounded-full bg-white/60"
              initial={false}
              animate={{ width: `${(year / 4) * 100}%` }}
              transition={SPRING}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-gray-500">
            {[0, 1, 2, 3, 4].map((y) => (
              <span key={y} className={y === 1 ? 'text-amber-200/80' : undefined}>
                {y === 0 ? 'Launch' : y === 1 ? '1y cliff' : `${y}y`}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {VEST_HOLDERS.map((h) => (
            <div key={h.who} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-1.5 text-white">
                  <span className={unlocked >= 100 ? 'text-emerald-300' : 'text-gray-400'}>
                    <Lock open={unlocked >= 100} />
                  </span>
                  <span className="truncate font-medium">{h.who}</span>
                  <span className="hidden text-[11px] text-gray-500 sm:inline">· {h.share}</span>
                </span>
                <motion.span
                  key={unlocked}
                  initial={{ opacity: 0.4, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="shrink-0 font-semibold tabular-nums text-gray-200"
                >
                  {unlocked}% unlocked
                </motion.span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: h.color }}
                  initial={false}
                  animate={{ width: `${unlocked}%` }}
                  transition={SPRING}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SceneFrame>
  )
}
