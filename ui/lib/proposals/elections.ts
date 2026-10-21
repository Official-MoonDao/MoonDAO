/**
 * Ranked-choice (instant runoff) elections run through the normal
 * non-project proposal pipeline: Temperature Check / Senate approval of
 * the candidate slate, then a 5-day Member House vote. Any MDP listed
 * here switches the Member Vote from For/Against/Abstain to a ranked
 * ballot over the candidates below.
 *
 * Keys are MDP numbers. Ballots store 1-based indexes into the choice
 * list (`candidates`, then "None of the above" when `includeNone` is not
 * false), so the candidate order MUST NOT change once voting opens.
 *
 * Process for adding an election:
 *   1. Submit the election as a non-project proposal and note its MDP.
 *   2. Add an entry below with the Senate-approved candidate slate before
 *      the Temperature Check passes.
 *   3. After the vote, Close & Tally runs the instant runoff. A real
 *      candidate winning marks the proposal passed; "None of the above"
 *      winning (seat stays vacant) marks it failed.
 */

export type RankedChoiceElectionConfig = {
  title: string
  candidates: string[]
  // Constitution Art. "Executive Leads" / "Signers": elections include a
  // "none" option that, if it wins, leaves the seat vacant.
  includeNone?: boolean
}

export const RANKED_CHOICE_ELECTIONS: Record<string, RankedChoiceElectionConfig> = {}

export const NONE_OF_THE_ABOVE = 'None of the above'

export type RankedChoiceElection = {
  mdp: number
  title: string
  // Ballot labels in key order: choices[k - 1] is the label for key k.
  choices: string[]
  // 1-based key of the "None of the above" choice, or null if disabled.
  noneKey: number | null
}

export function getRankedChoiceElection(
  MDP: number | string | null | undefined
): RankedChoiceElection | null {
  if (MDP === null || MDP === undefined) return null
  const config = RANKED_CHOICE_ELECTIONS[String(MDP)]
  if (!config || !Array.isArray(config.candidates) || config.candidates.length === 0) {
    return null
  }
  const includeNone = config.includeNone !== false
  const choices = includeNone ? [...config.candidates, NONE_OF_THE_ABOVE] : [...config.candidates]
  return {
    mdp: Number(MDP),
    title: config.title,
    choices,
    noneKey: includeNone ? choices.length : null,
  }
}
