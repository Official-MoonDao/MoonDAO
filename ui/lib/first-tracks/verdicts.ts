/**
 * One-line verdicts for the First Tracks result screen and share card.
 *
 * Rules: jokes are aimed at the player, never at a company, an agency or a
 * person, and never at a rover that was lost on a real mission. Real events
 * are stated as fact. Never the words bet, gamble or wager. US English.
 */
import type { Grade, RunResult } from './scoring'
import { PRIZE_METRES } from './sim'
import { N_TARGETS } from './site'

const FELL = [
  'Rolled off the deck. The ramp was right there.',
  'The prize says fully leave the lander. Not like that.',
  'A meter of ramp on either side and you found the edge.',
  'The rover is off the lander. So is everything that was bolted to it.',
  'Mission control saw that a moment after you did it.',
]

const TIPPED = [
  'The wheels are now pointing at the stars.',
  'That slope looked friendlier from 384,000 km away.',
  'Rovers have a right way up. You found the other one.',
  'Crater walls are for looking at, not for driving along.',
  'Tracks confirmed. They end rather suddenly.',
]

const STUCK = [
  'Spirit got stuck in soft sand on Mars in 2009. Now you know how.',
  'Dug in. The regolith keeps what it catches.',
  'Turning in soft ground is how wheels disappear.',
  'The darker, smoother patch was the soft one. It still is.',
  'Reverse digs you out. Reverse earlier.',
]

const FLAT = [
  'Battery flat. The rover is asleep until someone invents a tow truck.',
  'Every stop, start and spin on the spot was on the meter.',
  'Out of power. The solar panel says give it two weeks.',
  'You drove it like it was plugged in.',
]

const PARKED = [
  'The rover never left the deck. The lander enjoyed the company.',
  'Three minutes on the lander. The Moon was right there.',
  'A very safe mission. Also not a rover mission.',
]

const SHORT = [
  'Signal lost before 10 m. The line was right there.',
  'Some tracks, but not enough for the prize.',
  'Off the lander and rolling, just not for long enough.',
  'The orbiter looked. It needs to see ten meters.',
]

const TEN = [
  'Ten meters and counting. Tracks confirmed from orbit.',
  'First tracks laid. The orbiter saw it all.',
  'That is a qualifying drive. The science team wanted more pictures.',
  'The tracks are real. The route was creative.',
  'Past 10 m with the comms window closing. It counts.',
]

const GOOD = [
  'Most of the science on a sensible battery. There is still a better line out there.',
  'Tidy driving through the signal delay. Mission control approves.',
  'A full camera roll, nearly. The last target is still waiting.',
  'Clean tracks. The orbiter team is framing this one.',
]

const GREAT = [
  'Every job done: pictures, spectra and ice. Mission control is on its feet.',
  'Eight for eight with time on the clock. The orbiter photo is going on the wall.',
  'A complete traverse, driven blind by a second or two. Remarkable.',
  'All the science and the tracks to prove it. Find the faster line next.',
]

function pick<T>(list: T[], seed: number): T {
  return list[Math.abs(Math.floor(seed)) % list.length]
}

export function verdictFor(r: RunResult, seed: number): string {
  switch (r.outcome) {
    case 'fell':
      return pick(FELL, seed)
    case 'tipped':
      return pick(TIPPED, seed)
    case 'stuck':
      return pick(STUCK, seed)
    case 'flat':
      return pick(FLAT, seed)
    case 'parked':
      return pick(PARKED, seed)
    case 'complete':
      return pick(GREAT, seed)
    default:
      if (!r.firstTracks) return pick(SHORT, seed)
      return pick(r.imaged >= 5 && r.grades.route !== 'Wasteful' && r.grades.battery !== 'Wasteful' ? GOOD : TEN, seed)
  }
}

/** The headline: the milestone reached, or how it ended. */
export function outcomeHeadline(r: RunResult): string {
  if (r.outcome === 'fell') return 'Fell off the lander'
  if (r.outcome === 'parked' || !r.off) return 'Never left the lander'
  const tracks = r.firstTracks ? `First tracks: ${r.metres.toFixed(0)} m` : `${r.metres.toFixed(1)} m of tracks`
  switch (r.outcome) {
    case 'tipped':
      return `${tracks} · tipped over`
    case 'stuck':
      return `${tracks} · stuck`
    case 'flat':
      return `${tracks} · battery flat`
    case 'complete':
      return `${tracks} · all 8 jobs done`
    default:
      return r.firstTracks ? tracks : `${tracks} · short of ${PRIZE_METRES} m`
  }
}

/** A short state line for the result label. */
export function conditionLabel(r: RunResult): string {
  switch (r.outcome) {
    case 'fell':
      return 'Fell off the lander'
    case 'tipped':
      return 'Tipped over'
    case 'stuck':
      return 'Stuck in soft ground'
    case 'flat':
      return 'Battery flat'
    case 'parked':
      return 'Never left the lander'
    case 'complete':
      return 'All 8 jobs done'
    default:
      return 'Comms window closed'
  }
}

export function isGoodOutcome(r: RunResult): boolean {
  return r.firstTracks && (r.outcome === 'complete' || r.outcome === 'window')
}

export function formatScore(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

/** The numbers people quote, in one short line. */
export function bragLine(r: RunResult): string {
  if (!r.off) return 'Zero meters of tracks'
  return `${r.imaged}/${N_TARGETS} science jobs · ${r.metres.toFixed(0)} m of tracks · ${Math.round(r.batteryLeft * 100)}% battery left`
}

export function gradeColor(g: Grade): string {
  return g === 'Near perfect' ? 'text-emerald-300' : g === 'Tidy' ? 'text-sky-300' : g === 'Room to improve' ? 'text-amber-300' : g === 'Wasteful' ? 'text-rose-300' : 'text-white/40'
}
