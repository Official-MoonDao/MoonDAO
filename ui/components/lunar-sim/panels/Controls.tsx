// Playback controls: play/pause, scrub, speed, time + comms-window indicator.

import type { Scenario } from '@/lib/lunar-sim/engine/types'
import type { UseSimulationResult } from '@/lib/lunar-sim/useSimulation'

type ControlsProps = {
  sim: UseSimulationResult
  scenario: Scenario
}

const SPEEDS = [0.25, 0.5, 1, 2, 4]

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function Controls({ sim, scenario }: ControlsProps) {
  const tickSec = scenario.tickSec || 1
  const timeSec = sim.tickIndex * tickSec
  const totalSec = sim.totalTicks * tickSec
  const commsOpen = sim.currentSnapshot?.commsOpen ?? false
  const atEnd = sim.tickIndex >= sim.totalTicks

  return (
    <div className="pointer-events-auto flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/60 p-3 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <button
          onClick={atEnd ? sim.restart : sim.toggle}
          disabled={!sim.result}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40"
          aria-label={atEnd ? 'Replay' : sim.isPlaying ? 'Pause' : 'Play'}
        >
          {atEnd ? '↻' : sim.isPlaying ? '❚❚' : '►'}
        </button>

        <input
          type="range"
          min={0}
          max={sim.totalTicks}
          value={sim.tickIndex}
          onChange={(e) => sim.seek(Number(e.target.value))}
          disabled={!sim.result}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-cyan-400"
        />

        <span className="w-24 text-right font-mono text-xs text-white/70">
          {formatTime(timeSec)} / {formatTime(totalSec)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-white/40">Speed</span>
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => sim.setSpeed(s)}
              className={`rounded px-2 py-0.5 transition ${
                sim.speed === s
                  ? 'bg-cyan-500/30 text-cyan-200'
                  : 'text-white/50 hover:bg-white/10'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>

        <div
          className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 ${
            commsOpen
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-white/5 text-white/40'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              commsOpen ? 'bg-emerald-400' : 'bg-white/30'
            }`}
          />
          {commsOpen ? 'Comms window open' : 'Comms offline'}
        </div>
      </div>
    </div>
  )
}
