/**
 * One-off ranked-choice elections (Executive Branch leads, Primus, signers).
 *
 * Elections do not go through the proposal pipeline. Each one is a standalone
 * vote in the shared `Votes` Tableland table under its own `voteId`, like the
 * WBA / Baikonur / Overview path votes, and follows the shape of the last
 * Snapshot election (MDP-149): ranked ballots, weighted by √vMOONEY, sealed
 * until voting closes.
 *
 * Every candidate listed here appears on the ballot.
 *
 * Ballots store candidate `id`s, not list positions, so never reuse or change
 * an id once voting opens. Adding display copy is always safe.
 *
 * Lifecycle:
 *   1. Add the election with `published: false`, fill in the candidates, then set `opensAt` / `closesAt` and publish.
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
  // Show "to be announced" instead of `closesAt` while voting is open. Voting
  // still closes at `closesAt`, and voting power is still measured then.
  hideCloseTime?: boolean
  // Set after the frozen snapshot is committed.
  closed: boolean
  // Unpublished elections are only built outside production.
  published: boolean
  includeNone: boolean
  candidates: ElectionCandidate[]
  links?: { label: string; url: string }[]
  // Another election held alongside this one. Its ballot is shown below this
  // one on the same page; it keeps its own voteId, tally and snapshot.
  companionSlug?: string
}

// Ballot key for "None of the above". Candidate ids must be positive.
export const NONE_OF_THE_ABOVE_KEY = 0
export const NONE_OF_THE_ABOVE_LABEL = 'None of the above'

export const ELECTIONS: Election[] = [
  {
    slug: 'executive-lead-third-seat-2026',
    voteId: 4,
    title: 'Executive Lead Election: Third Seat',
    seat: 'the third Executive Lead seat',
    summary:
      'The Member House elects a third Executive Lead to a two-year term, completing last year’s unfilled cycle. Rank the candidates in order of preference. If no candidate has a majority, the last-place candidate is eliminated and those ballots move to each voter’s next choice until someone does. If “None of the above” wins, the seat stays vacant. Pablo Moncada-Larrotiz’s second-term confirmation is a separate ballot on this page.',
    opensAt: '2026-10-27T16:00:00Z',
    closesAt: '2026-11-06T16:00:00Z',
    hideCloseTime: true,
    closed: false,
    published: true,
    includeNone: true,
    candidates: [
      {
        id: 1,
        name: 'Trent “Moonshot” Tresch',
        handle: '@Moonshot',
        bio: 'Over ten years in the aerospace industry, from spacesuits to stratospheric balloons. Founding director of the University of Arizona’s Center for Human Space Exploration. Platform: make MoonDAO cash positive through a DAO-owned for-profit arm, technology development, and media and brand deals, while cutting spending.',
        platformUrl: 'https://en.wikipedia.org/wiki/Trent_Tresch',
      },
      {
        id: 2,
        name: 'AnastasiaAdAstra',
        handle: '@AnastasiaAdAstra',
        bio: 'Member since MoonDAO’s early days, with an organizing and space background. Part-time. Platform: win grants and outside funding for hardware projects, set up joint research with universities, and grow Citizenship through career benefits and partner networks.',
      },
    ],
    links: [
      { label: 'MoonDAO Constitution', url: 'https://docs.moondao.com/Governance/Constitution' },
      {
        label: 'About the third seat',
        url: 'https://docs.google.com/document/d/1Y1fXj0swsoSaHCKx_s2kGZXd9m8F50JCe92MWxfjkYA/edit?tab=t.0',
      },
    ],
    companionSlug: 'executive-lead-confirmation-2026',
  },
  {
    slug: 'executive-lead-confirmation-2026',
    voteId: 5,
    title: 'Executive Lead Confirmation: Pablo Moncada-Larrotiz',
    seat: 'Pablo Moncada-Larrotiz’s second term as Executive Lead',
    summary:
      'The Member House votes on whether to confirm Pablo Moncada-Larrotiz for a second and final term as Executive Lead. The ballot is Pablo or “None of the above”. If “None of the above” wins, the seat stays vacant.',
    opensAt: '2026-10-27T16:00:00Z',
    closesAt: '2026-11-06T16:00:00Z',
    hideCloseTime: true,
    closed: false,
    published: true,
    includeNone: true,
    candidates: [
      {
        id: 1,
        name: 'Pablo Moncada-Larrotiz',
        bio: 'MoonDAO founder and current Executive Lead, finishing his first term. The Constitution allows two terms.',
      },
    ],
    links: [
      { label: 'MoonDAO Constitution', url: 'https://docs.moondao.com/Governance/Constitution' },
      { label: 'Third seat election', url: '/elections/executive-lead-third-seat-2026' },
    ],
  },
  // Demo elections for preview deploys. Never published.
  {
    slug: 'demo',
    voteId: 9002,
    title: 'Demo Election (preview only)',
    seat: 'Demo Seat',
    summary:
      'A practice election with made-up candidates so the team can try the ballot. Ballots cast here are real transactions on the preview’s chain but count for nothing.',
    opensAt: '2026-10-01T00:00:00Z',
    // Voting power is measured at close, so keep this within normal lock lengths.
    closesAt: '2026-12-31T23:00:00Z',
    closed: false,
    published: false,
    includeNone: true,
    candidates: [
      {
        id: 1,
        name: 'Alice (demo)',
        handle: '@alice',
        bio: 'Placeholder candidate. Wants a crewed mission to the lunar south pole.',
      },
      {
        id: 2,
        name: 'Bob (demo)',
        handle: '@bob',
        bio: 'Placeholder candidate. Focused on growing the Citizen network.',
      },
      {
        id: 3,
        name: 'Carol (demo)',
        handle: '@carol',
        bio: 'Placeholder candidate. Treasury and operations.',
      },
    ],
  },
  {
    slug: 'demo-results',
    voteId: 9001,
    title: 'Demo Election Results (preview only)',
    seat: 'Demo Seat',
    summary:
      'A finished practice election showing what results look like. The ballots are real test ballots from Sepolia; the voting power was assigned for the demo.',
    opensAt: '2026-10-21T19:00:00Z',
    closesAt: '2026-10-21T20:00:00Z',
    closed: true,
    published: false,
    includeNone: true,
    candidates: [
      { id: 1, name: 'Alice (demo)' },
      { id: 2, name: 'Bob (demo)' },
      { id: 3, name: 'Carol (demo)' },
    ],
  },
]

export function getElection(slug: string): Election | null {
  return ELECTIONS.find((e) => e.slug === slug) ?? null
}

// Pages that show this election's ballot: its own, plus any election that
// lists it as a companion.
export function pagesShowingElection(slug: string): string[] {
  return [
    slug,
    ...listBuildableElections()
      .filter((e) => e.companionSlug === slug)
      .map((e) => e.slug),
  ]
}

// Vercel builds previews with NODE_ENV=production, so check VERCEL_ENV too.
function isPreviewOrLocal() {
  return process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'preview'
}

export function listBuildableElections(): Election[] {
  return ELECTIONS.filter((e) => e.published || isPreviewOrLocal())
}

export function ballotChoices(election: Election): { key: number; label: string }[] {
  const choices = election.candidates.map((c) => ({ key: c.id, label: c.name }))
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
