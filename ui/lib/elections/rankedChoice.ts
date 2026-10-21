/**
 * Instant-runoff tally for one-off ranked-choice elections (see
 * `lib/elections/elections.ts`).
 *
 * Each ballot is an ordered array of choice keys, e.g. `[3, 1]` = "choice 3
 * first, then choice 1". Each ballot carries the voter's full quadratic voting
 * power (√vMOONEY), the same weighting MDP-149 used on Snapshot.
 *
 * Rounds:
 *   1. Every ballot counts toward its highest-ranked continuing choice.
 *      Ballots with no continuing choice left are exhausted.
 *   2. A choice with MORE than 50% of the continuing (non-exhausted) VP wins.
 *      A lone continuing choice with any VP also wins.
 *   3. Otherwise the last-place choice is eliminated and we go again. Choices
 *      with zero VP are all eliminated together. Ties for last place are
 *      broken by the most recent earlier round in which the tied choices
 *      differed; if still tied, all of them are eliminated together, unless
 *      that would eliminate every continuing choice, in which case the result
 *      is an unresolved tie (`tied: true`, `winnerKey: null`).
 */

export type RankedChoice = { key: number; label: string }

export type RankedChoiceVoteRow = {
  address: string
  vote?: unknown
}

export type RankedChoiceRound = {
  round: number
  // Choice key (as string) → VP counted for it this round. Only continuing
  // choices appear.
  totals: Record<string, number>
  continuingVP: number
  exhaustedVP: number
  eliminated: number[]
}

export type RankedChoiceTally = {
  choices: RankedChoice[]
  rounds: RankedChoiceRound[]
  winnerKey: number | null
  winnerLabel: string | null
  // True when the winner is the "None of the above" choice.
  noneWon: boolean
  tied: boolean
  totalParticipationVP: number
  ballotCount: number
}

export function parseRankedBallot(raw: unknown, validKeys: Iterable<number>): number[] {
  let value: unknown = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return []
    }
  }
  if (!Array.isArray(value)) return []
  const valid = new Set(validKeys)
  const seen = new Set<number>()
  const ballot: number[] = []
  for (const entry of value) {
    const key = Number(entry)
    if (!Number.isInteger(key) || !valid.has(key) || seen.has(key)) continue
    seen.add(key)
    ballot.push(key)
  }
  return ballot
}

export function computeRankedChoiceTally(
  votes: RankedChoiceVoteRow[] | undefined,
  addressToVotingPower: Record<string, number>,
  choices: RankedChoice[],
  noneKey: number | null = null
): RankedChoiceTally {
  const lowerVP: Record<string, number> = {}
  for (const [addr, power] of Object.entries(addressToVotingPower ?? {})) {
    if (typeof addr !== 'string') continue
    lowerVP[addr.toLowerCase()] =
      typeof power === 'number' && Number.isFinite(power) && power >= 0 ? power : 0
  }

  const keys = choices.map((c) => c.key)
  const ballots: { ranking: number[]; power: number }[] = []
  let totalParticipationVP = 0
  const counted = new Set<string>()
  for (const row of votes ?? []) {
    if (!row || typeof row.address !== 'string') continue
    const lower = row.address.toLowerCase()
    if (counted.has(lower)) continue
    const power = lowerVP[lower] ?? 0
    if (power <= 0) continue
    const ranking = parseRankedBallot(row.vote, keys)
    if (ranking.length === 0) continue
    counted.add(lower)
    ballots.push({ ranking, power })
    totalParticipationVP += power
  }

  const continuing = new Set<number>(keys)
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

    const remaining = Array.from(continuing)
    const leader = remaining.reduce((best, key) =>
      totals[String(key)] > totals[String(best)] ? key : best
    )
    if (totals[String(leader)] > continuingVP / 2 || continuing.size === 1) {
      winnerKey = leader
      break
    }

    let toEliminate = remaining.filter((key) => totals[String(key)] === 0)
    if (toEliminate.length === 0) {
      const minVP = Math.min(...remaining.map((key) => totals[String(key)]))
      toEliminate = remaining.filter((key) => totals[String(key)] === minVP)
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

  const labelFor = (key: number) => choices.find((c) => c.key === key)?.label ?? null
  return {
    choices,
    rounds,
    winnerKey,
    winnerLabel: winnerKey !== null ? labelFor(winnerKey) : null,
    noneWon: winnerKey !== null && winnerKey === noneKey,
    tied,
    totalParticipationVP,
    ballotCount: ballots.length,
  }
}
