import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from '@heroicons/react/24/solid'
import { useEffect, useMemo, useState } from 'react'
import { computeRankedChoiceTally } from '@/lib/elections/rankedChoice'

const CHOICES = [
  { key: 1, label: 'Alice' },
  { key: 2, label: 'Bob' },
  { key: 3, label: 'Carol' },
  { key: 0, label: 'None of the above' },
]

const VOTERS = [
  { name: 'Voter A', power: 40, ballot: [1] },
  { name: 'Voter B', power: 35, ballot: [2, 3] },
  { name: 'Voter C', power: 30, ballot: [3, 1] },
  { name: 'Voter D', power: 10, ballot: [0, 2] },
]

const STEPS = [
  {
    title: 'Round 1: count first choices',
    body: 'Each ballot counts fully for its 1st choice, weighted by voting power. To win, a choice needs more than half of the votes still in play. Nobody has that yet.',
  },
  {
    title: 'Round 2: last place is knocked out',
    body: '“None of the above” had the least, so it’s out. Voter D’s ballot moves to their next choice, Bob. Still no majority.',
  },
  {
    title: 'Round 3: repeat until someone has a majority',
    body: 'Carol is now last, so she’s out. Voter C’s ballot moves to their next choice, Alice. Alice now has more than half and wins, thanks to Carol’s supporters.',
  },
]

const labelFor = (key: number) => CHOICES.find((c) => c.key === key)?.label ?? ''

export default function RankedChoiceExplainer() {
  const tally = useMemo(
    () =>
      computeRankedChoiceTally(
        VOTERS.map((v) => ({ address: v.name, vote: v.ballot })),
        Object.fromEntries(VOTERS.map((v) => [v.name, v.power])),
        CHOICES,
        0
      ),
    []
  )
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const last = tally.rounds.length - 1

  useEffect(() => {
    if (!playing) return
    if (step >= last) {
      setPlaying(false)
      return
    }
    const id = setTimeout(() => setStep((s) => s + 1), 3500)
    return () => clearTimeout(id)
  }, [playing, step, last])

  const round = tally.rounds[step]
  const out = new Set(tally.rounds.slice(0, step).flatMap((r) => r.eliminated))
  const previousOut = new Set(tally.rounds.slice(0, step - 1).flatMap((r) => r.eliminated))
  const activeChoice = (ballot: number[], eliminated: Set<number>) =>
    ballot.find((k) => !eliminated.has(k)) ?? null
  const isFinal = step === last
  const majority = round.continuingVP / 2

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Example · step {step + 1} of {tally.rounds.length}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setPlaying(false)
              setStep((s) => Math.max(0, s - 1))
            }}
            disabled={step === 0}
            aria-label="Previous step"
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-25 transition-colors"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (isFinal) setStep(0)
              setPlaying((p) => !p || isFinal)
            }}
            aria-label={playing ? 'Pause' : 'Play'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1 text-xs font-semibold text-white/80 hover:text-white hover:border-white/30 transition-colors"
          >
            {playing ? <PauseIcon className="h-3.5 w-3.5" /> : <PlayIcon className="h-3.5 w-3.5" />}
            {playing ? 'Pause' : isFinal ? 'Replay' : 'Play'}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false)
              setStep((s) => Math.min(last, s + 1))
            }}
            disabled={isFinal}
            aria-label="Next step"
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-25 transition-colors"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <h3 className="mt-2 text-sm sm:text-base font-semibold text-white">{STEPS[step]?.title}</h3>
      <p className="mt-1 text-xs sm:text-sm text-gray-400 leading-relaxed min-h-[3.5rem]">
        {STEPS[step]?.body}
      </p>

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Ballots
          </p>
          <ul className="space-y-1.5">
            {VOTERS.map((voter) => {
              const active = activeChoice(voter.ballot, out)
              const moved = step > 0 && active !== activeChoice(voter.ballot, previousOut)
              return (
                <li
                  key={voter.name}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors duration-500 ${
                    moved ? 'border-amber-400/50 bg-amber-400/10' : 'border-white/10 bg-white/5'
                  }`}
                >
                  <span className="text-gray-300 shrink-0">
                    {voter.name} <span className="text-gray-500">· {voter.power}</span>
                  </span>
                  <span className="flex flex-wrap justify-end gap-1">
                    {voter.ballot.map((key, i) => (
                      <span
                        key={key}
                        className={`rounded px-1.5 py-0.5 transition-all duration-500 ${
                          out.has(key)
                            ? 'text-gray-600 line-through'
                            : key === active
                            ? 'bg-blue-500/30 text-white font-semibold'
                            : 'text-gray-400'
                        }`}
                      >
                        {i + 1}. {labelFor(key)}
                      </span>
                    ))}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Count · majority is more than {majority.toFixed(1)}
          </p>
          <ul className="space-y-2">
            {CHOICES.map((choice) => {
              const vp = round.totals[choice.key] ?? 0
              const isOut = out.has(choice.key)
              const pct = round.continuingVP > 0 ? (vp / round.continuingVP) * 100 : 0
              const won = isFinal && choice.key === tally.winnerKey
              return (
                <li key={choice.key}>
                  <div className="flex items-baseline justify-between text-xs mb-1">
                    <span
                      className={
                        isOut
                          ? 'text-gray-600 line-through'
                          : won
                          ? 'text-emerald-300 font-semibold'
                          : 'text-white'
                      }
                    >
                      {choice.label}
                      {won && ' · wins'}
                    </span>
                    <span className="text-gray-400 tabular-nums">{isOut ? 'out' : vp}</span>
                  </div>
                  <div className="relative h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        won ? 'bg-emerald-400/80' : 'bg-blue-400/70'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                    <div className="absolute inset-y-0 left-1/2 w-px bg-white/40" aria-hidden />
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-[11px] text-gray-500">The line marks half the votes in play.</p>
        </div>
      </div>
    </div>
  )
}
