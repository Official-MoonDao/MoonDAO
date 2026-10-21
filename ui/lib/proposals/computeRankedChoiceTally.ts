/**
 * Instant-runoff tally for ranked-choice Member Votes (see
 * `lib/proposals/elections.ts`).
 *
 * Each ballot is an ordered array of 1-based choice keys, e.g. `[3, 1]`
 * = "choice 3 first, then choice 1". Each ballot carries the voter's
 * full quadratic voting power (√vMOONEY at close), the same weight the
 * For/Against Member Vote uses.
 *
 * Rounds:
 *   1. Every ballot counts toward its highest-ranked continuing choice.
 *      Ballots with no continuing choice left are exhausted.
 *   2. A choice with MORE than 50% of the continuing (non-exhausted) VP
 *      wins. A lone continuing choice with any VP also wins.
 *   3. Otherwise the last-place choice is eliminated and we go again.
 *      Choices with zero VP are all eliminated together. Ties for last
 *      place are broken by the most recent earlier round in which the
 *      tied choices differed; if still tied, all of them are eliminated
 *      together, unless that would eliminate every continuing choice,
 *      in which case the result is an unresolved tie (`tied: true`,
 *      `winnerKey: null`) and must be settled by the Senate.
 *
 * This helper is the single source of truth for both the proposal page
 * render and the on-chain Close & Tally handler.
 */

export type RankedChoiceVoteRow = {
  address: string
  vote?: unknown
  distribution?: unknown
}

export type RankedChoiceRound = {
  round: number
  // Choice key (as string) → VP counted for it this round. Only
  // continuing choices appear.
  totals: Record<string, number>
  continuingVP: number
  exhaustedVP: number
  eliminated: number[]
}

export type RankedChoiceTally = {
  kind: 'ranked-choice'
  choices: string[]
  rounds: RankedChoiceRound[]
  winnerKey: number | null
  winnerLabel: string | null
  // True when the winner is the "None of the above" choice.
  noneWon: boolean
  tied: boolean
  totalParticipationVP: number
  ballotCount: number
  // Real candidate won → passed; None won, unresolved tie, or no
  // ballots → not passed.
  passed: boolean
}

export function parseRankedBallot(raw: unknown, choiceCount: number): number[] {
  let value: unknown = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return []
    }
  }
  if (!Array.isArray(value)) return []
  const seen = new Set<number>()
  const ballot: number[] = []
  for (const entry of value) {
    const key = Number(entry)
    if (!Number.isInteger(key) || key < 1 || key > choiceCount) continue
    if (seen.has(key)) continue
    seen.add(key)
    ballot.push(key)
  }
  return ballot
}

export function computeRankedChoiceTally(
  votes: RankedChoiceVoteRow[] | undefined,
  addressToQuadraticVotingPower: Record<string, number>,
  choices: string[],
  noneKey: number | null = null
): RankedChoiceTally {
  const lowerVP: Record<string, number> = {}
  for (const [addr, power] of Object.entries(addressToQuadraticVotingPower ?? {})) {
    if (typeof addr !== 'string') continue
    lowerVP[addr.toLowerCase()] =
      typeof power === 'number' && Number.isFinite(power) && power >= 0 ? power : 0
  }

  const ballots: { ranking: number[]; power: number }[] = []
  let totalParticipationVP = 0
  const counted = new Set<string>()
  for (const row of votes ?? []) {
    if (!row || typeof row.address !== 'string') continue
    const lower = row.address.toLowerCase()
    if (counted.has(lower)) continue
    const power = lowerVP[lower] ?? 0
    if (power <= 0) continue
    const ranking = parseRankedBallot(row.vote ?? row.distribution, choices.length)
    if (ranking.length === 0) continue
    counted.add(lower)
    ballots.push({ ranking, power })
    totalParticipationVP += power
  }

  const continuing = new Set<number>(choices.map((_, i) => i + 1))
  const rounds: RankedChoiceRound[] = []
  let winnerKey: number | null = null
  let tied = false

  while (continuing.size > 0) {
    const totals: Record<string, number> = {}
    for (const key of Array.from(continuing)) totals[String(key)] = 0
    let exhaustedVP = 0
    for (const ballot of ballots) {
      const top = ballot.ranking.find((key) => continuing.has(key))
      if (top === undefined) exhaustedVP += ballot.power
      else totals[String(top)] += ballot.power
    }
    const continuingVP = Object.values(totals).reduce((sum, v) => sum + v, 0)
    const round: RankedChoiceRound = {
      round: rounds.length + 1,
      totals,
      continuingVP,
      exhaustedVP,
      eliminated: [],
    }
    rounds.push(round)

    if (continuingVP <= 0) break

    const keys = Array.from(continuing)
    const leader = keys.reduce((best, key) =>
      totals[String(key)] > totals[String(best)] ? key : best
    )
    const leaderVP = totals[String(leader)]
    if (leaderVP > continuingVP / 2 || continuing.size === 1) {
      winnerKey = leader
      break
    }

    let toEliminate = keys.filter((key) => totals[String(key)] === 0)
    if (toEliminate.length === 0) {
      const minVP = Math.min(...keys.map((key) => totals[String(key)]))
      toEliminate = keys.filter((key) => totals[String(key)] === minVP)
      for (let r = rounds.length - 2; r >= 0 && toEliminate.length > 1; r--) {
        const prior = rounds[r].totals
        const priorMin = Math.min(...toEliminate.map((key) => prior[String(key)] ?? 0))
        toEliminate = toEliminate.filter((key) => (prior[String(key)] ?? 0) === priorMin)
      }
    }
    if (toEliminate.length === continuing.size) {
      tied = true
      break
    }
    round.eliminated = toEliminate
    for (const key of toEliminate) continuing.delete(key)
  }

  const noneWon = winnerKey !== null && winnerKey === noneKey
  return {
    kind: 'ranked-choice',
    choices,
    rounds,
    winnerKey,
    winnerLabel: winnerKey !== null ? choices[winnerKey - 1] ?? null : null,
    noneWon,
    tied,
    totalParticipationVP,
    ballotCount: ballots.length,
    passed: winnerKey !== null && !noneWon,
  }
}
