/**
 * One-off ranked-choice elections (Executive Branch leads, Primus, signers).
 *
 * Elections do not go through the proposal pipeline. Each one is a standalone
 * vote in the shared `Votes` Tableland table under its own `voteId`, like the
 * WBA / Baikonur / Overview path votes, and follows the shape of the last
 * Snapshot election (MDP-149): ranked ballots, weighted by √vMOONEY, sealed
 * until voting closes.
 *
 * Senate confirmation happens off-chain before voting opens. Only candidates
 * with a `senateConfirmation` record appear on the ballot. Paste the link to
 * the Senate's confirmation (Discord vote, meeting notes, etc.) so voters can
 * check it.
 *
 * Ballots store candidate `id`s, not list positions, so never reuse or change
 * an id once voting opens. Adding display copy is always safe.
 *
 * Lifecycle:
 *   1. Add the election with `published: false`, fill in candidates as the
 *      Senate confirms them, then set `opensAt` / `closesAt` and publish.
 *   2. After `closesAt`, run `yarn snapshot:election <slug>` and commit the
 *      JSON it writes, then set `closed: true`. The page then serves the frozen
 *      result instead of re-tallying.
 */

export type ElectionCandidate = {
  // Stable ballot key. Positive integer, unique within the election.
  id: number
  name: string
  handle?: string
  bio?: string
  platformUrl?: string
  senateConfirmation?: {
    confirmedOn: string
    recordUrl: string
  }
}

export type Election = {
  slug: string
  voteId: number
  title: string
  seat: string
  summary: string
  // ISO-8601. Ballots are only accepted between these times.
  opensAt: string | null
  closesAt: string | null
  // Set after the frozen snapshot is committed.
  closed: boolean
  // Unpublished elections are only built outside production.
  published: boolean
  includeNone: boolean
  candidates: ElectionCandidate[]
  links?: { label: string; url: string }[]
}

// Ballot key for "None of the above". Candidate ids must be positive.
export const NONE_OF_THE_ABOVE_KEY = 0
export const NONE_OF_THE_ABOVE_LABEL = 'None of the above'

export const ELECTIONS: Election[] = [
  {
    slug: 'executive-branch-2027',
    voteId: 4,
    title: 'Executive Branch Election',
    seat: 'Executive Lead',
    summary:
      'The Member House elects the next Executive Lead by ranked-choice vote. Rank the Senate-confirmed candidates in order of preference. If no candidate has a majority, the last-place candidate is eliminated and those ballots move to each voter’s next choice until someone does. If “None of the above” wins, the seat stays vacant.',
    opensAt: null,
    closesAt: null,
    closed: false,
    published: false,
    includeNone: true,
    candidates: [],
    links: [{ label: 'MoonDAO Constitution', url: 'https://docs.moondao.com/Governance/Constitution' }],
  },
]

export function getElection(slug: string): Election | null {
  return ELECTIONS.find((e) => e.slug === slug) ?? null
}

export function listBuildableElections(): Election[] {
  return ELECTIONS.filter((e) => e.published || process.env.NODE_ENV !== 'production')
}

export function confirmedCandidates(election: Election): ElectionCandidate[] {
  return election.candidates.filter((c) => Boolean(c.senateConfirmation?.recordUrl))
}

export function ballotChoices(election: Election): { key: number; label: string }[] {
  const choices = confirmedCandidates(election).map((c) => ({ key: c.id, label: c.name }))
  if (election.includeNone) {
    choices.push({ key: NONE_OF_THE_ABOVE_KEY, label: NONE_OF_THE_ABOVE_LABEL })
  }
  return choices
}

export type ElectionPhase = 'unscheduled' | 'upcoming' | 'open' | 'counting' | 'closed'

export function electionPhase(election: Election, now: number = Date.now()): ElectionPhase {
  if (election.closed) return 'closed'
  if (!election.opensAt || !election.closesAt) return 'unscheduled'
  if (now < Date.parse(election.opensAt)) return 'upcoming'
  if (now < Date.parse(election.closesAt)) return 'open'
  return 'counting'
}
