/**
 * Member Vote tally — `computeMemberProposalTally` semantics.
 *
 * Locks down the Abstain-aware supermajority math used for both
 * the on-chain close-and-tally decision (`pages/api/proposals/
 * nonProjectVote.ts`) and the proposal page render
 * (`pages/project/[tokenId].tsx`). Both paths consume this helper,
 * so a regression in the math would cause the displayed tally and
 * the on-chain decision to diverge — these tests are the guard
 * against that.
 *
 * ============================================================================
 * SPEC SOURCES (the "what should happen")
 * ============================================================================
 *
 *   1. `lib/proposals/computeMemberProposalTally.ts` header docs.
 *   2. The Member Vote 5-day window + 66.6% supermajority is set in
 *      the on-chain `Proposals` contract; this helper mirrors the
 *      same threshold so the UI agrees with the chain.
 *   3. Practical case: MDP-249 closed with 91% For of decided VP
 *      (4-of-7 deciding voters all For; 3 large holders abstained),
 *      but 35.6% For of total turnout VP. Excluding Abstain from
 *      the denominator is what makes the proposal pass, matching
 *      member intent.
 *
 * Distilled spec for the tally:
 *
 *   M1. Choice keys are '1'=For, '2'=Against, '3'=Abstain.
 *   M2. Voting power weighting is quadratic: power = √vMOONEY,
 *       passed in pre-rooted via `addressToQuadraticVotingPower`.
 *   M3. Voter VP is split across choices by their allocation pct
 *       (single-click votes are 100 on one choice).
 *   M4. forPctOfDecided = forVP / (forVP + againstVP) × 100.
 *   M5. PASS iff forPctOfDecided >= 66.6 (`MEMBER_VOTE_SUPER_MAJORITY`).
 *   M6. Abstain VP is NEVER part of the denominator for M5.
 *   M7. abstainShareOfTurnout = abstainVP / totalParticipationVP × 100,
 *       informational only — not part of the pass/fail decision.
 *
 * ============================================================================
 * IMPLEMENTATION DETAILS (spec is silent — locked by the tests below)
 * ============================================================================
 *
 *   I1. Address matching is case-insensitive.        [INTENTIONAL]
 *       Tableland echoes mixed-case addresses but the snapshot
 *       resolver lowercases, so the helper lowercases both sides
 *       of the lookup.
 *
 *   I2. Voters with VP <= 0 (or NaN, or missing from the          [INTENTIONAL]
 *       VP map) are skipped entirely — their row doesn't
 *       contribute even to `totalParticipationVP`. Mirrors
 *       `runQuadraticVoting` and the live fetcher's failure
 *       mode (returns 0 for unreachable chains).
 *
 *   I3. `vote` is parsed from either an object or a JSON string;  [INTENTIONAL]
 *       invalid JSON strings produce an empty distribution and
 *       the voter contributes 0 to all buckets.
 *
 *   I4. A row with VP > 0 but an empty/zero distribution does     [INTENTIONAL]
 *       NOT count toward `totalParticipationVP`. Rationale: the
 *       voter exists in the table but didn't actually express a
 *       preference — counting them would inflate the abstain-
 *       share-of-turnout denominator.
 *
 *   I5. Vacuous turnout (no decided votes) → forPctOfDecided=0,   [INTENTIONAL]
 *       passed=false. Even 100% Abstain doesn't pass — there's
 *       no expressed support to measure against the threshold.
 *
 *   I6. Negative or NaN entries in the VP map are coerced to 0.   [INTENTIONAL]
 *       Defensive — the upstream fetcher should never produce
 *       these but a single bad chain read shouldn't poison the
 *       whole tally.
 */

import {
  computeMemberProposalTally,
  MEMBER_VOTE_SUPER_MAJORITY,
  type MemberVoteRow,
} from '../../../lib/proposals/computeMemberProposalTally'

// =============================================================================
// SPEC M5 — supermajority threshold
// =============================================================================

describe('Member Vote tally / supermajority threshold (M5)', () => {
  it('passes at exactly 66.6% For of decided VP', () => {
    // 666 For + 334 Against = 1000 decided. 666/1000 = 66.6%.
    const votes: MemberVoteRow[] = [
      { address: '0xa', vote: { '1': 100 } },
      { address: '0xb', vote: { '2': 100 } },
    ]
    const power = { '0xa': 666, '0xb': 334 }
    const tally = computeMemberProposalTally(votes, power)
    expect(tally.forPctOfDecided).to.be.closeTo(66.6, 0.01)
    expect(tally.passed).to.equal(true)
  })

  it('fails just below the threshold (66.5%)', () => {
    // 665 For + 335 Against = 1000 decided. 665/1000 = 66.5%.
    const votes: MemberVoteRow[] = [
      { address: '0xa', vote: { '1': 100 } },
      { address: '0xb', vote: { '2': 100 } },
    ]
    const power = { '0xa': 665, '0xb': 335 }
    const tally = computeMemberProposalTally(votes, power)
    expect(tally.forPctOfDecided).to.be.closeTo(66.5, 0.01)
    expect(tally.passed).to.equal(false)
  })

  it('passes comfortably above the threshold (80%)', () => {
    const votes: MemberVoteRow[] = [
      { address: '0xa', vote: { '1': 100 } },
      { address: '0xb', vote: { '2': 100 } },
    ]
    const power = { '0xa': 80, '0xb': 20 }
    const tally = computeMemberProposalTally(votes, power)
    expect(tally.forPctOfDecided).to.be.closeTo(80, 0.01)
    expect(tally.passed).to.equal(true)
  })

  it('exposes the threshold constant for UI rendering', () => {
    expect(MEMBER_VOTE_SUPER_MAJORITY).to.equal(66.6)
  })
})

// =============================================================================
// SPEC M6 — Abstain excluded from the denominator
// =============================================================================

describe('Member Vote tally / Abstain exclusion (M6)', () => {
  it('SPEC M6: abstain VP does NOT enter the For % denominator', () => {
    // The MDP-249 shape: 4 deciding voters (all For, low individual
    // VP) + 3 large abstainers. If Abstain were in the denominator,
    // For % would be ~35% and the proposal would FAIL despite
    // unanimous support among voters who took a side.
    const votes: MemberVoteRow[] = [
      { address: '0xfor1', vote: { '1': 100 } },
      { address: '0xfor2', vote: { '1': 100 } },
      { address: '0xfor3', vote: { '1': 100 } },
      { address: '0xfor4', vote: { '1': 100 } },
      { address: '0xabs1', vote: { '3': 100 } },
      { address: '0xabs2', vote: { '3': 100 } },
      { address: '0xabs3', vote: { '3': 100 } },
    ]
    const power = {
      '0xfor1': 100,
      '0xfor2': 100,
      '0xfor3': 100,
      '0xfor4': 100,
      '0xabs1': 250,
      '0xabs2': 250,
      '0xabs3': 250,
    }
    const tally = computeMemberProposalTally(votes, power)
    expect(tally.forVP).to.equal(400)
    expect(tally.againstVP).to.equal(0)
    expect(tally.abstainVP).to.equal(750)
    expect(tally.decidedVP).to.equal(400)
    expect(tally.forPctOfDecided).to.equal(100)
    // Sanity check the "before the fix" failure mode would have given:
    //   forVP / (forVP + againstVP + abstainVP) × 100
    //     = 400 / 1150 × 100 ≈ 34.78%
    // ...which is < 66.6 and would have flipped the outcome.
    expect(tally.passed).to.equal(true)
  })

  it('SPEC M6: pure-abstain turnout never passes', () => {
    // No one took a side — there's no expressed support, so no
    // threshold can be cleared regardless of abstain volume.
    const votes: MemberVoteRow[] = [
      { address: '0xa', vote: { '3': 100 } },
      { address: '0xb', vote: { '3': 100 } },
    ]
    const power = { '0xa': 1_000_000, '0xb': 1_000_000 }
    const tally = computeMemberProposalTally(votes, power)
    expect(tally.decidedVP).to.equal(0)
    expect(tally.forPctOfDecided).to.equal(0)
    expect(tally.passed).to.equal(false)
  })
})

// =============================================================================
// SPEC M7 — abstainShareOfTurnout is informational only
// =============================================================================

describe('Member Vote tally / abstain share of turnout (M7)', () => {
  it('SPEC M7: divides abstain VP by total participation, not decided', () => {
    // 100 For, 100 Against, 200 Abstain. Total turnout = 400.
    // abstainShareOfTurnout = 200 / 400 × 100 = 50%.
    // forPctOfDecided = 100 / 200 × 100 = 50% (separate denominator).
    const votes: MemberVoteRow[] = [
      { address: '0xa', vote: { '1': 100 } },
      { address: '0xb', vote: { '2': 100 } },
      { address: '0xc', vote: { '3': 100 } },
      { address: '0xd', vote: { '3': 100 } },
    ]
    const power = { '0xa': 100, '0xb': 100, '0xc': 100, '0xd': 100 }
    const tally = computeMemberProposalTally(votes, power)
    expect(tally.totalParticipationVP).to.equal(400)
    expect(tally.abstainShareOfTurnout).to.equal(50)
    expect(tally.forPctOfDecided).to.equal(50)
  })

  it('SPEC M7: returns 0 when nobody participated', () => {
    const tally = computeMemberProposalTally([], {})
    expect(tally.abstainShareOfTurnout).to.equal(0)
    expect(tally.totalParticipationVP).to.equal(0)
  })
})

// =============================================================================
// SPEC M2/M3 — quadratic VP weighting & split allocations
// =============================================================================

describe('Member Vote tally / VP weighting and splits (M2/M3)', () => {
  it('SPEC M2: VP-weighted aggregation across multiple voters', () => {
    // Three For voters with powers [10, 20, 30] and one Against
    // voter with power [40]. forVP=60, againstVP=40,
    // forPctOfDecided=60%, fails the 66.6% bar.
    const votes: MemberVoteRow[] = [
      { address: '0xa', vote: { '1': 100 } },
      { address: '0xb', vote: { '1': 100 } },
      { address: '0xc', vote: { '1': 100 } },
      { address: '0xd', vote: { '2': 100 } },
    ]
    const power = { '0xa': 10, '0xb': 20, '0xc': 30, '0xd': 40 }
    const tally = computeMemberProposalTally(votes, power)
    expect(tally.forVP).to.equal(60)
    expect(tally.againstVP).to.equal(40)
    expect(tally.forPctOfDecided).to.equal(60)
    expect(tally.passed).to.equal(false)
  })

  it('SPEC M3: split votes allocate VP proportionally', () => {
    // Voter splits 70 For / 30 Against on power 100.
    // → forVP = 70, againstVP = 30, forPctOfDecided = 70%.
    const votes: MemberVoteRow[] = [{ address: '0xa', vote: { '1': 70, '2': 30 } }]
    const power = { '0xa': 100 }
    const tally = computeMemberProposalTally(votes, power)
    expect(tally.forVP).to.equal(70)
    expect(tally.againstVP).to.equal(30)
    expect(tally.forPctOfDecided).to.equal(70)
    expect(tally.passed).to.equal(true)
  })

  it('SPEC M3: split with abstain still excludes abstain from denominator', () => {
    // 50 For / 0 Against / 50 Abstain on power 100.
    // → forVP=50, againstVP=0, abstainVP=50, decided=50,
    //   forPctOfDecided=100%, abstainShareOfTurnout=50%.
    const votes: MemberVoteRow[] = [{ address: '0xa', vote: { '1': 50, '3': 50 } }]
    const power = { '0xa': 100 }
    const tally = computeMemberProposalTally(votes, power)
    expect(tally.forVP).to.equal(50)
    expect(tally.abstainVP).to.equal(50)
    expect(tally.decidedVP).to.equal(50)
    expect(tally.forPctOfDecided).to.equal(100)
    expect(tally.abstainShareOfTurnout).to.equal(50)
    expect(tally.passed).to.equal(true)
  })
})

// =============================================================================
// IMPL DELTA I1 — case-insensitive address matching
// =============================================================================

describe('Member Vote tally / address case-insensitivity (I1)', () => {
  it('IMPL I1: mixed-case voter address matches lowercased VP key', () => {
    const votes: MemberVoteRow[] = [{ address: '0xABCdef0123456789', vote: { '1': 100 } }]
    const power = { '0xabcdef0123456789': 100 }
    const tally = computeMemberProposalTally(votes, power)
    expect(tally.forVP).to.equal(100)
    expect(tally.passed).to.equal(true)
  })

  it('IMPL I1: lowercased voter address matches mixed-case VP key', () => {
    const votes: MemberVoteRow[] = [{ address: '0xabcdef0123456789', vote: { '1': 100 } }]
    const power = { '0xABCdef0123456789': 100 }
    const tally = computeMemberProposalTally(votes, power)
    expect(tally.forVP).to.equal(100)
    expect(tally.passed).to.equal(true)
  })
})

// =============================================================================
// IMPL DELTA I2 — voters with no usable VP are skipped
// =============================================================================

describe('Member Vote tally / VP edge cases (I2)', () => {
  it('IMPL I2: voter with VP=0 contributes nothing', () => {
    const votes: MemberVoteRow[] = [
      { address: '0xa', vote: { '1': 100 } },
      { address: '0xb', vote: { '2': 100 } },
    ]
    const power = { '0xa': 100, '0xb': 0 }
    const tally = computeMemberProposalTally(votes, power)
    expect(tally.forVP).to.equal(100)
    expect(tally.againstVP).to.equal(0)
    expect(tally.totalParticipationVP).to.equal(100)
    expect(tally.passed).to.equal(true)
  })

  it('IMPL I2: voter missing from VP map contributes nothing', () => {
    const votes: MemberVoteRow[] = [
      { address: '0xa', vote: { '1': 100 } },
      { address: '0xunknown', vote: { '2': 100 } },
    ]
    const power = { '0xa': 100 }
    const tally = computeMemberProposalTally(votes, power)
    expect(tally.forVP).to.equal(100)
    expect(tally.againstVP).to.equal(0)
    expect(tally.totalParticipationVP).to.equal(100)
  })

  it('IMPL I6: NaN VP entries are coerced to 0 (defensive)', () => {
    const votes: MemberVoteRow[] = [
      { address: '0xa', vote: { '1': 100 } },
      { address: '0xb', vote: { '2': 100 } },
    ]
    const power = { '0xa': 100, '0xb': NaN }
    const tally = computeMemberProposalTally(votes, power)
    expect(tally.forVP).to.equal(100)
    expect(tally.againstVP).to.equal(0)
    expect(tally.passed).to.equal(true)
  })

  it('IMPL I6: negative VP entries are coerced to 0 (defensive)', () => {
    const votes: MemberVoteRow[] = [
      { address: '0xa', vote: { '1': 100 } },
      { address: '0xb', vote: { '2': 100 } },
    ]
    const power = { '0xa': 100, '0xb': -50 }
    const tally = computeMemberProposalTally(votes, power)
    expect(tally.forVP).to.equal(100)
    expect(tally.againstVP).to.equal(0)
  })
})

// =============================================================================
// IMPL DELTA I3 — vote JSON string parsing
// =============================================================================

describe('Member Vote tally / vote payload parsing (I3)', () => {
  it('IMPL I3: vote provided as JSON string is parsed', () => {
    const votes: MemberVoteRow[] = [{ address: '0xa', vote: JSON.stringify({ '1': 100 }) }]
    const power = { '0xa': 100 }
    const tally = computeMemberProposalTally(votes, power)
    expect(tally.forVP).to.equal(100)
    expect(tally.passed).to.equal(true)
  })

  it('IMPL I3: invalid JSON string yields zero contribution', () => {
    const votes: MemberVoteRow[] = [
      { address: '0xa', vote: 'not-json' as any },
      { address: '0xb', vote: { '1': 100 } },
    ]
    const power = { '0xa': 100, '0xb': 100 }
    const tally = computeMemberProposalTally(votes, power)
    expect(tally.forVP).to.equal(100)
    // The malformed-vote voter exists in the row list but didn't
    // express a preference, so they shouldn't count toward turnout
    // either (would inflate abstain-share-of-turnout otherwise).
    expect(tally.totalParticipationVP).to.equal(100)
  })

  it('IMPL I3: falls back to legacy `distribution` field', () => {
    // Snapshot rows from `resolveSnapshotDistributions` use the
    // `distribution` column name (project quarterly vote shape);
    // the helper accepts both so it can drive either pipeline.
    const votes: MemberVoteRow[] = [{ address: '0xa', distribution: { '1': 100 } }]
    const power = { '0xa': 100 }
    const tally = computeMemberProposalTally(votes, power)
    expect(tally.forVP).to.equal(100)
  })
})

// =============================================================================
// IMPL DELTA I4 — empty distribution does not count toward turnout
// =============================================================================

describe('Member Vote tally / empty rows (I4)', () => {
  it('IMPL I4: row with VP > 0 but no choices skipped from turnout', () => {
    const votes: MemberVoteRow[] = [
      { address: '0xa', vote: { '1': 100 } },
      { address: '0xb', vote: {} },
      { address: '0xc', vote: { '3': 100 } },
    ]
    const power = { '0xa': 100, '0xb': 100, '0xc': 100 }
    const tally = computeMemberProposalTally(votes, power)
    // 0xb has VP but no expressed choice → not in turnout.
    expect(tally.totalParticipationVP).to.equal(200)
    // abstainShareOfTurnout = 100 / 200 × 100 = 50%.
    expect(tally.abstainShareOfTurnout).to.equal(50)
  })
})

// =============================================================================
// Defensive: empty / undefined inputs
// =============================================================================

describe('Member Vote tally / defensive inputs', () => {
  it('returns a zeroed tally for undefined votes', () => {
    const tally = computeMemberProposalTally(undefined, {})
    expect(tally.forVP).to.equal(0)
    expect(tally.againstVP).to.equal(0)
    expect(tally.abstainVP).to.equal(0)
    expect(tally.decidedVP).to.equal(0)
    expect(tally.forPctOfDecided).to.equal(0)
    expect(tally.passed).to.equal(false)
  })

  it('returns a zeroed tally for an empty VP map', () => {
    const votes: MemberVoteRow[] = [{ address: '0xa', vote: { '1': 100 } }]
    const tally = computeMemberProposalTally(votes, {})
    expect(tally.forVP).to.equal(0)
    expect(tally.passed).to.equal(false)
  })

  it('skips rows with non-string addresses', () => {
    const votes: MemberVoteRow[] = [
      { address: null as any, vote: { '1': 100 } },
      { address: undefined as any, vote: { '1': 100 } },
      { address: '0xa', vote: { '1': 100 } },
    ]
    const power = { '0xa': 100 }
    const tally = computeMemberProposalTally(votes, power)
    expect(tally.forVP).to.equal(100)
  })
})
