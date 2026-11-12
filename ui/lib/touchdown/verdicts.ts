/**
 * One-line verdicts for the result screen and share card.
 *
 * Rules: jokes are aimed at the player. Real outcomes are stated as fact
 * (IM-1, IM-2 and SLIM all ended up on their sides). No digs at companies or
 * people. Never the words bet, gamble or wager.
 */
import type { FlightResult } from './scoring'

const CRASHED = [
  'You made a brand new crater. The IAU would like to name it after you.',
  'Lithobraking: technically a way to stop.',
  'The lander has been successfully distributed across the landing site.',
  'Good news: you found the Moon. Bad news: all at once.',
  'Rapid unscheduled disassembly, lunar edition.',
  'That was less a landing and more a delivery.',
  'Geologists thank you for the fresh ejecta sample.',
  'You arrived early. And at speed.',
  'The Moon was closer than it appeared.',
  'Seismometers on three continents picked that up.',
  'Mission status: now a debris field with a flag-shaped hole in the budget.',
  'Newton called. He says the third law still applies.',
  'Some assembly required. Again.',
  'Technically every part of the lander reached the surface.',
  'The good ending is one burn earlier.',
]

const LOST = [
  'You missed the Moon. The whole Moon.',
  'Flight director asks where you think you are going.',
  'The landing site was back there. Way back there.',
  'Bold new trajectory. Not a landing one.',
]

const TIPPED = [
  'Landed! Sideways. Ask IM-1, IM-2 and SLIM how that goes.',
  'Upright is a state of mind. Not this one, though.',
  'The lander is resting. On its face.',
  'So close. The Moon is just slightly more tilted than you planned.',
  'You stuck the landing, then un-stuck it.',
  'Solar panels now have an excellent view of the regolith.',
  'Touchdown confirmed. Orientation: creative.',
  'It reached the surface and lay down for a nap.',
  'A soft landing, followed by a slow, dignified fall.',
  'The antenna is pointing at a rock. The rock is not listening.',
  'Real landers tip over too. Yours just joined the club.',
  'One more leg down and you would have had it.',
]

const INVERTED = [
  'Shiny side down. Bold.',
  'The engine now points at the stars, which is where it is not needed.',
  'Upside down on the Moon. At least the view of Earth is good.',
  'You landed on the antenna. That is the one part that should not touch.',
  'Full cartwheel. The judges give it a 9.5 and no mission.',
]

const HARD = [
  'It is upright. Nobody ask about the landing gear.',
  'Any landing you can transmit from is a good one.',
  'Firm. Very firm. The struts would like a word.',
  'Upright and working. The suspension has filed a complaint.',
  'You bent it, but you did not break it.',
  'That counted. The accelerometers are still ringing.',
]

const LANDED_FAR = [
  'A perfect landing, in the wrong postcode.',
  'Soft, level and nowhere near the pad.',
  'Great landing. The rover has a long drive ahead.',
  'You landed on the Moon. The target was also on the Moon. Different part.',
  'Lovely touchdown. Shame about the navigation.',
]

const LANDED = [
  'Touchdown. Upright, soft and on the pad.',
  'Tranquility Base would be proud.',
  'Clean landing. Mission control is breathing again.',
  'Feet down, engine off, science on.',
  'That is how it is done. Now do it for 24 hours.',
  'Soft as moondust.',
  'Textbook. Somebody print this telemetry and frame it.',
  'The Eagle has nothing on you.',
]

const BULLSEYE = [
  'Bullseye. You could have landed on a picnic blanket.',
  'Dead centre. The pad designers feel seen.',
  'Pinpoint. Precision-landing engineers everywhere nod in respect.',
  'Right on the X. Somebody get this pilot a real lander.',
  'Inside five metres. That is a parking job.',
]

function pick<T>(list: T[], salt: number): T {
  return list[Math.abs(Math.floor(salt)) % list.length]
}

/** `salt` varies the pick so repeat players see new lines. */
const BASE_HIT = [
  'You landed on Moon Base Zero. Not near it. On it.',
  'The residents of Moon Base Zero have filed a noise complaint.',
  'Moon Base Zero now has one more lander and several fewer buildings.',
  'Good news: you found the base. Bad news: with your landing gear.',
  'That was load-bearing. So was that. And that.',
  'Somebody is going to have to explain this to the base commander.',
  'The base took years to build. You redecorated it in four seconds.',
  'Insurance does not cover this. Nothing covers this.',
]

export function verdictFor(result: FlightResult, salt: number): string {
  if (result.baseDamage > 0) return pick(BASE_HIT, salt)
  switch (result.outcome) {
    case 'crashed':
      return pick(CRASHED, salt)
    case 'lost':
      return pick(LOST, salt)
    case 'inverted':
      return pick(INVERTED, salt)
    case 'tipped':
      return pick(TIPPED, salt)
    case 'hard':
      return pick(HARD, salt)
    default:
      if (result.bullseye) return pick(BULLSEYE, salt)
      if (result.distance > 40) return pick(LANDED_FAR, salt)
      return pick(LANDED, salt)
  }
}

export function outcomeHeadline(result: FlightResult): string {
  if (result.baseDamage > 0) return 'BASE DAMAGED'
  switch (result.outcome) {
    case 'crashed':
      return 'CRASHED'
    case 'lost':
      return 'LOST IN SPACE'
    case 'inverted':
      return 'UPSIDE DOWN'
    case 'tipped':
      return 'TIPPED OVER'
    case 'hard':
      return result.damaged ? 'UPRIGHT, BUT BENT' : 'HARD LANDING'
    default:
      return result.bullseye ? 'BULLSEYE' : 'TOUCHDOWN'
  }
}

export function formatScore(score: number): string {
  return Math.round(score).toLocaleString('en-US')
}

/** The numbers people quote: "1.2 m from target", "0.8 m/s touchdown". */
export function bragLine(result: FlightResult): string {
  const d = `${result.distance < 100 ? result.distance.toFixed(1) : Math.round(result.distance)} m from target`
  const v = `${result.touchdownSpeed.toFixed(1)} m/s touchdown`
  if (result.outcome === 'lost') return 'Never reached the surface'
  return `${d} · ${v}`
}
