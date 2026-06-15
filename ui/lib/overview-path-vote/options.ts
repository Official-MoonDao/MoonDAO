/**
 * Static definitions for the one-off "Send Frank to Space — Path Forward"
 * $OVERVIEW-weighted vote (voteId = OVERVIEW_PATH_VOTE_ID).
 *
 * The option `id` is the key written into the Votes Tableland table as
 * `{ [optionId]: flooredLiveBalance }`, so it must remain stable for the
 * lifetime of the vote. Display copy can change freely.
 */

export type PathVoteOptionId = 'option-a' | 'option-b' | 'option-c' | 'abstain'

export type PathVoteOption = {
  id: PathVoteOptionId
  letter: string
  title: string
  subtitle: string
  summary: string
  // The impact breakdown only applies to the substantive paths (A/B/C).
  // Abstain omits these, so the card renders without a "Show details" row.
  fundsImpact?: string
  candidateImpact?: string
  realRisk?: string
  bestCase?: string
}

export const PATH_VOTE_OPTIONS: PathVoteOption[] = [
  {
    id: 'option-a',
    letter: 'A',
    title: 'Commit Now to a Stratospheric Balloon',
    subtitle: 'One seat, Frank only',
    summary:
      'Place a deposit today with the stratospheric balloon provider that, based on the diligence framework, is most likely to deliver. Declare the campaign complete and close it out. Frank flies as soon as that provider is ready.',
    fundsImpact:
      "Deposit goes out the door under that provider's contract terms (which may or may not be refundable). Remaining funds reserved for the balance.",
    candidateImpact:
      'Deferred or dropped unless a follow-on fundraise is approved.',
    realRisk:
      "If the chosen provider fails to demonstrate safe crewed flight, our deposit may be partially or fully unrecoverable, and Frank's flight is delayed indefinitely.",
    bestCase:
      'Decisive, honors what contributors put in, Frank has a confirmed seat.',
  },
  {
    id: 'option-b',
    letter: 'B',
    title: 'Keep Options Open, Continue Fundraising',
    subtitle: 'Two seats, Frank + Candidate',
    summary:
      "Don't commit to a single provider yet. Continue fundraising to expand the budget, with the goal of reserving two seats so a community Candidate can fly with Frank. This keeps the door open for more expensive suborbital options and for any stratospheric provider that demonstrates safe crewed flight in the meantime. Where possible, place fully refundable deposits to hold space without locking in a single provider, so Frank flies as early as possible.",
    fundsImpact:
      'Existing funds stay in the launchpad contract. Only fully refundable deposits go out. New fundraising adds to the pot.',
    candidateImpact: 'Candidate selection process continues toward two seats.',
    realRisk:
      'Campaign fatigue. No clean end date. The community may end up in extended purgatory waiting for either funds or provider readiness.',
    bestCase:
      'Maximum optionality. We benefit from another 6-18 months of industry maturation and partnership negotiation before committing.',
  },
  {
    id: 'option-c',
    letter: 'C',
    title: 'Refunds',
    subtitle: 'Burn $OVERVIEW for pro-rata ETH',
    summary:
      'If neither A nor B feels like a responsible path forward, activate the existing refund mechanism. Per the Overview Effect Flight Terms, the on-chain refund payhook makes a 28-day window available during which $OVERVIEW can be burned for pro-rata ETH. Off-chain contributions would be refunded through the equivalent process. Because no funds have been spent, the full amount raised or pledged is available.',
    fundsImpact: 'Pro-rata refunds to contributors who choose to redeem.',
    candidateImpact: 'Process paused indefinitely.',
    realRisk:
      'Campaign concludes without Frank flying. Closes the door on partnerships in flight.',
    bestCase:
      "Honest acknowledgement if the conditions for a safe, deliverable flight aren't there. Contributors get their funds back.",
  },
  {
    id: 'abstain',
    letter: '–',
    title: 'Abstain',
    subtitle: 'No preference on the path',
    summary:
      'Record your presence without endorsing any of the three paths. Your $OVERVIEW weight is counted toward participation but does not back Option A, B, or C.',
  },
]

export const PATH_VOTE_OPTION_IDS = PATH_VOTE_OPTIONS.map((o) => o.id)

export function isPathVoteOptionId(value: string): value is PathVoteOptionId {
  return (PATH_VOTE_OPTION_IDS as string[]).includes(value)
}

export function getPathVoteOption(
  id: string
): PathVoteOption | undefined {
  return PATH_VOTE_OPTIONS.find((o) => o.id === id)
}

/** "At a glance" facts shown at the top of the proposal. */
export const PATH_VOTE_AT_A_GLANCE: { label: string; value: string }[] = [
  { label: 'Amount raised or pledged', value: '~$172k' },
  {
    label: 'Fundable today',
    value: '1 stratospheric seat for Frank, from multiple providers',
  },
  {
    label: 'Not fundable today',
    value:
      '2 stratospheric seats (Frank + Candidate), or any suborbital seat outright',
  },
  { label: 'Funds status', value: 'None has been spent to date' },
  {
    label: 'Companies engaged',
    value: '12 (6 stratospheric balloon, 4 suborbital, 2 orbital / other)',
  },
]

/** Key findings from the 30-day carrier negotiation phase. */
export const PATH_VOTE_FINDINGS: { title: string; body: string }[] = [
  {
    title: 'We can pay for a seat for Frank today',
    body: 'Multiple stratospheric balloon providers have either sent a contract or verbally agreed on a price that fits within current funds. If the community decided today, "Pick a provider and book the seat for Frank," we could execute that decision.',
  },
  {
    title: 'We cannot pay for two seats outright',
    body: 'Our original commitment was to fly Frank plus a community-selected Candidate. With current funds, no single provider gives us two seats outright — neither stratospheric nor suborbital. Flying two seats would require either continued fundraising to close the gap, or a partnership or volume discount that brings the two-seat price into our budget.',
  },
  {
    title: 'No stratospheric balloon provider is operational yet',
    body: 'This is the most important caveat. Every stratospheric balloon company we spoke to is still in some stage of hardware development and testing. None have a regularly operating commercial crewed service today. Most project first crewed flights no earlier than next year; a few claim they can fly this year but do not yet have operational, human-tested hardware. Any decision here is a decision under genuine uncertainty.',
  },
  {
    title:
      'We received a suborbital contract from Virgin Galactic, but cannot buy it outright',
    body: 'The terms are within reach but not within current funding: we have enough to pay the deposit today, but not enough to purchase the seat in full. Going down this path requires continuing to fundraise toward the balance.',
  },
  {
    title: 'Partnership conversations are still active',
    body: "Several conversations go beyond a straight ticket purchase — joint marketing, discounts in exchange for a longer-term relationship, and other ways to work together. In particular, we are in the process of a deal with a stratospheric balloon company that could dramatically lower the cost and potentially let us fly two people. That conversation is in an early stage; it's on the table but not a concrete option to count on.",
  },
  {
    title: 'Beyond a traditional flight — alternative formats',
    body: 'While exploring orbital opportunities with Vast, one option that emerged is sending a "Frank White Avatar" to space rather than flying Frank in person. It does not involve Frank physically flying, and it is not the recommended path — we include it so the community knows it exists as a possibility.',
  },
]

/** Diligence framework axes used to compare providers. */
export const PATH_VOTE_DILIGENCE_AXES: { axis: string; criteria: string }[] = [
  {
    axis: 'Crewed flight readiness',
    criteria:
      'Tethered flights, uncrewed full-altitude, crewed test, repeated crewed',
  },
  {
    axis: 'Regulatory standing',
    criteria:
      'FAA / EASA / equivalent approvals; airspace clearances in flight country',
  },
  {
    axis: 'Safety design',
    criteria:
      'Redundant systems, abort modes, parachute / emergency descent, prior incident record',
  },
  {
    axis: 'Funding runway',
    criteria: 'Will they still be operating in 12-24 months?',
  },
  {
    axis: 'Schedule realism',
    criteria: 'Track record of quoted vs. delivered timelines',
  },
  {
    axis: 'Contract terms',
    criteria:
      "Deposit refundability, milestone structure, what happens if they don't fly",
  },
  {
    axis: 'Total cost',
    criteria: 'Price for 1 seat and 2 seats vs. current and projected funds',
  },
]
