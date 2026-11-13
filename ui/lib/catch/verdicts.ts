/**
 * One-line verdicts for the Catch result screen and share card.
 *
 * Rules: jokes are aimed at the player, never at a company or a person. Never
 * the words bet, gamble or wager. US English.
 */
import type { StructureId } from './physics'
import type { FlightResult } from './scoring'

const PERFECT = [
  'Textbook. The tower barely felt it.',
  'Dead center, feather soft. Do that again and they will give you a console.',
  'That is the one they will put on the poster.',
  'Flight director has no notes. That never happens.',
]

const CAUGHT = [
  'Caught. A building just grabbed a spaceship out of the sky, and you were driving.',
  'The arms have it. Somebody go check the welds.',
  'In the arms and in one piece. Take the rest of the day off.',
  'Caught it. The tower is going to need a minute.',
  'That counts. Nobody ask how close the flaps came.',
  'Fifty meters of steel, hanging by two pins. You did that.',
]

const FIRM = [
  'Caught, firmly. The tower rang like a bell.',
  'It is in the arms. The arms have filed a complaint.',
  'A catch is a catch. The pins would like a word.',
]

const HARD = [
  'The pins missed. The flaps did not. Half points and a long inspection.',
  'Hanging by its flaps. Not the plan, but it is off the ground.',
  'Saved by the flaps. Nobody designed them for that. Nobody tell them.',
  'Technically caught. The flaps would like hazard pay.',
]

const SPLASH = [
  'Soft, upright, and in the Gulf. The tower watched you go by.',
  'A perfect landing, 400 meters east of where the arms are.',
  'Splashdown. The fish are impressed. The tower is not.',
  'You overshot a 140-meter tower and found an entire ocean.',
  'It floats! Briefly.',
]

const DITCHED = [
  'Set down gently on the ground. It has no legs. You know how this ends.',
  'A soft landing, followed by a slow, expensive lean.',
  'Down in one piece, for about four seconds.',
  'You landed a ship with no legs. Timber.',
]

const CRASH_GROUND = [
  'Rapid unscheduled disassembly, Texas edition.',
  'The ship has been successfully distributed across the launch site.',
  'You found the ground. All at once.',
  'The good ending is one burn earlier.',
  'Brakes are the big yellow button. For next time.',
  'A million heat shield tiles, now available individually.',
]

const CRASH_SEA = [
  'Into the Gulf at speed. That is not a splashdown, that is a delivery.',
  'The ocean was softer than the ground, but not that soft.',
  'You missed Texas.',
]

const CRASH_ARMS = [
  'It landed on the arms, not in them. The arms noticed.',
  'So close that it took the arms with it.',
  'You were supposed to go between them.',
]

const LOST = [
  'You have left the launch site. And the county.',
  'Flight director asks where you think you are going.',
  'The tower was back there. Way back there.',
]

/** Worst thing hit first: the line and the headline both follow this order. */
const DAMAGE_ORDER: StructureId[] = ['tankfarm', 'booster', 'tower2', 'tower', 'hopper', 'mount', 'mount2', 'arms', 'plant', 'highway']

const DAMAGE_LINES: Record<StructureId, string[]> = {
  tankfarm: [
    'You found the tank farm. Everyone within five miles knows.',
    'That was the propellant. All of the propellant.',
    'The tank farm is now a tank crater.',
  ],
  booster: [
    'You hit the booster next door. Two for one.',
    'There was one other rocket on site and you found it.',
    'The booster was just hanging there, minding its own business.',
  ],
  tower2: ['Wrong tower. Also, it is not a tower any more.', 'You had two towers this morning.'],
  tower: ['You were meant to stop next to the tower, not inside it.', 'The tower caught the ship. With its face.'],
  hopper: ['You hit the old hopper. The hopper! It survived everything but you.', 'Of all the things to land on, you picked the monument.'],
  mount: ['Missed the arms. Found the launch mount.', 'The mount is for taking off from. You had the right idea, wrong direction.'],
  mount2: ['That was the other pad. It was not involved until now.'],
  arms: CRASH_ARMS,
  plant: ['The ground equipment broke your fall. And the ground equipment.', 'Somebody was going to use that.'],
  highway: ['Highway 4 is closed until further notice.', 'You landed on the only road out.'],
}

function pick<T>(list: T[], seed: number): T {
  return list[Math.abs(Math.floor(seed)) % list.length]
}

/** The most expensive thing the flight damaged, if any. */
export function worstDamage(r: FlightResult): StructureId | null {
  for (const id of DAMAGE_ORDER) if (r.damage.includes(id)) return id
  return null
}

export function verdictFor(r: FlightResult, seed: number): string {
  switch (r.outcome) {
    case 'caught': {
      if (r.hard) return pick(HARD, seed)
      const max = r.mode === 'pro' ? 1375 : 1100
      if (r.score >= max * 0.95) return pick(PERFECT, seed)
      return pick(r.closingSpeed > 6 ? FIRM : CAUGHT, seed)
    }
    case 'splashdown':
      return pick(SPLASH, seed)
    case 'ditched':
      return pick(DITCHED, seed)
    case 'lost':
      return pick(LOST, seed)
    default: {
      const worst = worstDamage(r)
      if (worst) return pick(DAMAGE_LINES[worst], seed)
      return pick(r.cause === 'sea' ? CRASH_SEA : CRASH_GROUND, seed)
    }
  }
}

export function outcomeHeadline(r: FlightResult): string {
  switch (r.outcome) {
    case 'caught':
      if (r.hard) return 'Hard catch · saved by the flaps'
      return r.closingSpeed < 3.6 ? 'Caught' : 'Caught, firmly'
    case 'splashdown':
      return 'Splashdown'
    case 'ditched':
      return 'Set down. No legs'
    case 'lost':
      return 'Lost the ship'
    default:
      return r.damage.length > 2 ? 'Starbase is on fire' : r.damage.length ? 'Base damaged' : 'No catch'
  }
}

export function formatScore(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

/** The numbers people quote, in one short line. */
export function bragLine(r: FlightResult): string {
  if (r.outcome === 'caught') {
    return `${r.closingSpeed.toFixed(1)} m/s onto the arms · ${Math.abs(r.across).toFixed(1)} m off center · ${Math.round(r.fuelLeft * 100)}% fuel left`
  }
  if (r.damage.length) return `${r.damage.length} ${r.damage.length === 1 ? 'structure' : 'structures'} hit · ${Math.round(r.closingSpeed)} m/s at impact`
  if (r.outcome === 'splashdown' || r.outcome === 'ditched') return `${r.closingSpeed.toFixed(1)} m/s at touchdown · ${Math.round(r.closest)} m from the arms`
  return `Closest to the arms: ${Math.round(r.closest)} m`
}
