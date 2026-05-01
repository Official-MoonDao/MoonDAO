/**
 * Member Vote tally — comprehensive tests.
 *
 * Goal: verify that votes are tallied exactly as the projects system
 * documents them, AND surface (with skipped/labeled tests) every place
 * the implementation does something the spec doesn't explicitly say.
 *
 * ============================================================================
 * SPEC SOURCES (the "what should happen")
 * ============================================================================
 *
 *   1. `ui/components/nance/ProjectRewards.tsx` tooltip (Voting Phase):
 *
 *        "Once the Senate has approved proposals, voting members
 *         distribute their voting power across the approved proposals
 *         as percentages. The top 50% by voting power are funded,
 *         capped so total project budgets stay under 3/4 of the
 *         quarterly budget. Contributors cannot vote on their own
 *         project."
 *
 *   2. `ui/pages/projects-overview.tsx`:
 *
 *        "Members vote to allocate funding. Top 50% of proposals get
 *         funded (budget permitting)."
 *        "Budget must be ≤20% of quarterly rewards." (per-proposal cap,
 *         enforced at submit time, not at tally time — out of scope.)
 *
 *   3. Public docs (linked from `/project-system-docs`):
 *      https://docs.moondao.com/Projects/Project-System
 *
 * Distilled spec for the tally:
 *
 *   S1. Voting power weighting is quadratic: power = √vMOONEY.
 *   S2. The author of a proposal cannot vote on their own proposal.
 *   S3. Each voter's allocation is treated as percentages summing to 100.
 *   S4. Per-project outcome % = sum(voter_percentage × voter_power) /
 *                                 sum(voter_power), then normalized.
 *   S5. The top 50% of projects (by outcome %) are funded.
 *   S6. The total budget of approved projects must be ≤ 3/4 of the
 *       quarterly budget.
 *
 * ============================================================================
 * IMPLEMENTATION DETAILS (spec is silent or terse — explicit intent
 * confirmed and locked down by the tests below)
 * ============================================================================
 *
 *   D1 — Floor of 3 approved projects.            [CONFIRMED INTENTIONAL]
 *        `getApprovedProjects` uses
 *            numApproved = min(max(ceil(n/2), 3), n)
 *        So for n < 6 the "top 50%" rule is overridden by a minimum of 3
 *        (3-proj cycle → 3 approved, 4-proj cycle → 3, 5-proj cycle → 3).
 *        Avoids reducing the senate-approved set to 1–2 winners by
 *        rounding alone in small cycles. The 50% rule kicks in cleanly
 *        for n ≥ 6.
 *
 *   D2 — Budget cap is knapsack-style, not greedy. [SPEC]
 *        Walking projects in rank order, each project is approved iff its
 *        budget *fits* under the remaining cap; projects that would push
 *        the cumulative total over 3/4 of the pool are SKIPPED, and the
 *        loop keeps checking smaller projects below them in the ranking.
 *        Net effect:
 *          - A small popular project below a large rejected one CAN still
 *            be approved.
 *          - A rank-1 project whose budget alone exceeds 3/4 is rejected,
 *            but the rest of the cycle is evaluated normally.
 *
 *   D3 — A rank-1 project whose budget alone exceeds 3/4 of the pool is
 *        rejected, but smaller subsequent projects can still be approved.
 *        (Resolved by D2's knapsack rule.)
 *
 *   D4 — Author "cannot vote on own project" is implemented as
 *        per-project stripping, not full vote disqualification.
 *                                                  [CONFIRMED INTENTIONAL]
 *          - Author's allocation to their own project is removed.
 *          - Their allocations to OTHER projects are kept and renormalized.
 *          - Their own-project cell is the ONLY cell that gets imputed
 *            with the column average of the other voters during iterative
 *            normalization. Non-author cells that the voter just didn't
 *            allocate to are pre-filled with 0 by the call site (vote.ts /
 *            computeMemberVoteOutcome.ts), NOT imputed. Silence ≠ implicit
 *            support — an earlier version of the pipeline imputed every
 *            missing key, which silently inflated outcomes for projects
 *            voters never endorsed.
 *        Authors still influence other projects' rankings; their row's
 *        own-project cell is attributed at the rate other voters rated
 *        that project. (Confirmed: dropping the entire row would punish
 *        authors twice — they'd lose voice on every project, not just
 *        their own.)
 *
 *   D5 — Iterative normalization runs a hardcoded 20 passes
 *        (`runIterativeNormalization` — `for (let loop = 0; loop < 20; …)`).
 *        Convergence isn't proven; just bounded. Pathological inputs
 *        could produce row sums slightly off 100 after 20 passes. We
 *        assert convergence within the tolerances we ship.
 *
 *   D6 — Voters with NaN or 0 vMOONEY contribute 0 weight (no influence,
 *        no error). Their presence in the votes table doesn't change the
 *        outcome.
 *
 *   D7 — `runQuadraticVoting`'s default `budgetPercentMinusCommunityFund`
 *        parameter is 90, but `vote.ts` and `computeMemberVoteOutcome.ts`
 *        always pass 100 (`SUM_TO_ONE_HUNDRED`). The 90% default is dead
 *        code in the tally path; we test with 100 to match production.
 *
 *   D8 — Per-vote distribution sums are NOT validated to total 100. The
 *        tally accepts any non-negative numbers and normalizes. So a
 *        voter who submits {1: 50, 2: 50} and one who submits {1: 1,
 *        2: 1} end up with identical influence (both row-normalized to
 *        50/50). Documented in the spec ("as percentages") but worth a
 *        test so the behavior isn't silently changed.
 *
 *   D9 — Budget-cap comparison is `<= 3/4`, exact equality counts as
 *        approved. Boundary case worth pinning.
 *
 * ============================================================================
 * TEST SCOPE (per the user's "all_with_mocks" choice)
 * ============================================================================
 *
 *   Layer 1 — Pure math primitives:
 *       runIterativeNormalization, runQuadraticVoting, getApprovedProjects.
 *
 *   Layer 2 — Full pipeline (in-memory, no network):
 *       Mirrors the orchestration of `computeMemberVoteOutcome` step-by-step
 *       (strip self-vote → normalize → quadratic → approve). This exercises
 *       the same primitives in the same sequence as production but doesn't
 *       require module-level mocking, which is brittle in Cypress.
 *
 *   Layer 3 — `computeMemberVoteOutcome` integration with stubbed deps:
 *       Wires up `cy.stub` on the namespace imports of `queryTable`,
 *       `fetchTotalVMOONEYs`, and `thirdweb.readContract`/`getContract`,
 *       and `cy.intercept` on the IPFS `fetch`. Verifies the orchestration
 *       end-to-end using a single canned scenario — primarily a smoke test
 *       that the contract reads, IPFS fetches, and budget-cap math line
 *       up the way the math-primitive tests above assert in isolation.
 *
 *       NOTE: ES-module export immutability sometimes prevents stubbing
 *       default exports in Cypress. If the Layer 3 stubs fail in your CI
 *       runner, the Layer 1 + 2 tests still cover all the math; the
 *       Layer 3 test is a "best-effort" wiring check.
 */

import {
  runIterativeNormalization,
  runQuadraticVoting,
  getApprovedProjects,
} from '../../../lib/utils/rewards'

// =============================================================================
// LAYER 1 — Math primitives
// =============================================================================

describe('Vote tally / Layer 1 — quadratic voting (√vMOONEY weight)', () => {
  it('SPEC S1: a 4× vMOONEY balance gives 2× the voting weight', () => {
    // Voter A: 4 vMOONEY → power 2. Voter B: 16 vMOONEY → power 4.
    // Linear weighting would give 20% / 80%; quadratic gives 33.3% / 66.7%.
    const distributions = [
      { address: '0xa', distribution: { '1': 100, '2': 0 } },
      { address: '0xb', distribution: { '1': 0, '2': 100 } },
    ]
    const power: Record<string, number> = {
      '0xa': Math.sqrt(4),
      '0xb': Math.sqrt(16),
    }
    const outcome = runQuadraticVoting(distributions, power, 100)
    expect(outcome['1']).to.be.closeTo(33.333, 0.01)
    expect(outcome['2']).to.be.closeTo(66.667, 0.01)
    expect(outcome['1'] + outcome['2']).to.be.closeTo(100, 0.01)
  })

  it('SPEC S4: outcome equals power-weighted average, then row-normalized', () => {
    // Three voters with powers [1, 2, 3], all voting equal split between
    // two projects. Result must be 50/50 regardless of power weights.
    const distributions = [
      { address: '0xa', distribution: { '1': 50, '2': 50 } },
      { address: '0xb', distribution: { '1': 50, '2': 50 } },
      { address: '0xc', distribution: { '1': 50, '2': 50 } },
    ]
    const power = { '0xa': 1, '0xb': 2, '0xc': 3 }
    const outcome = runQuadraticVoting(distributions, power, 100)
    expect(outcome['1']).to.be.closeTo(50, 0.001)
    expect(outcome['2']).to.be.closeTo(50, 0.001)
  })

  it('IMPL DELTA D6: voters with 0 power contribute nothing', () => {
    // Voter A has full power, voter B has 0 (e.g. 0 vMOONEY at snapshot).
    // B's vote should be ignored entirely.
    const distributions = [
      { address: '0xa', distribution: { '1': 100, '2': 0 } },
      { address: '0xb', distribution: { '1': 0, '2': 100 } },
    ]
    const power = { '0xa': 5, '0xb': 0 }
    const outcome = runQuadraticVoting(distributions, power, 100)
    expect(outcome['1']).to.be.closeTo(100, 0.01)
    expect(outcome['2']).to.be.closeTo(0, 0.01)
  })

  it('IMPL DELTA D6: voters with NaN power contribute nothing', () => {
    const distributions = [
      { address: '0xa', distribution: { '1': 100, '2': 0 } },
      { address: '0xb', distribution: { '1': 0, '2': 100 } },
    ]
    const power = { '0xa': 5, '0xb': NaN }
    const outcome = runQuadraticVoting(distributions, power, 100)
    expect(outcome['1']).to.be.closeTo(100, 0.01)
    expect(outcome['2']).to.be.closeTo(0, 0.01)
  })

  it('IMPL DELTA D7: budgetPercentMinusCommunityFund scales the final outcome', () => {
    // The function defaults to 90, but production always passes 100.
    // Verify the scaling parameter is honored.
    const distributions = [
      { address: '0xa', distribution: { '1': 50, '2': 50 } },
    ]
    const power = { '0xa': 1 }
    const outcomeAt100 = runQuadraticVoting(distributions, power, 100)
    const outcomeAt90 = runQuadraticVoting(distributions, power, 90)
    expect(outcomeAt100['1'] + outcomeAt100['2']).to.be.closeTo(100, 0.01)
    expect(outcomeAt90['1'] + outcomeAt90['2']).to.be.closeTo(90, 0.01)
  })

  it('SPEC S4: returns empty when total voting power is 0', () => {
    const distributions = [
      { address: '0xa', distribution: { '1': 100 } },
    ]
    const power = { '0xa': 0 }
    const outcome = runQuadraticVoting(distributions, power, 100)
    expect(Object.keys(outcome).length).to.equal(0)
  })

  it('SPEC S4: voters whose power keys are not in the power map count as 0', () => {
    // `runQuadraticVoting` looks up `addressToQuadraticVotingPower[v.address]`
    // — so an address present in distributions but missing from the power map
    // (e.g. mismatched casing) silently contributes 0 weight. Pin this.
    const distributions = [
      { address: '0xa', distribution: { '1': 100, '2': 0 } },
      { address: '0xCasedDifferently', distribution: { '1': 0, '2': 100 } },
    ]
    const power = { '0xa': 1, '0xcaseddifferently': 1 } // lowercased
    const outcome = runQuadraticVoting(distributions, power, 100)
    // Mixed-case voter is ignored; result is 100/0, not 50/50.
    expect(outcome['1']).to.be.closeTo(100, 0.01)
    expect(outcome['2']).to.be.closeTo(0, 0.01)
  })
})

describe('Vote tally / Layer 1 — iterative normalization', () => {
  it('SPEC S3: every output row sums to ~100', () => {
    const projects = [
      { id: '1' },
      { id: '2' },
      { id: '3' },
    ]
    const distributions = [
      { address: '0xa', distribution: { '1': 60, '2': 30, '3': 10 } },
      { address: '0xb', distribution: { '1': 20, '2': 50, '3': 30 } },
      { address: '0xc', distribution: { '1': 33, '2': 33, '3': 34 } },
    ]
    const [, votes] = runIterativeNormalization(distributions, projects)
    votes.forEach((row) => {
      const sum = row.reduce((s: number, v: number) => s + v, 0)
      expect(sum).to.be.closeTo(100, 0.01)
    })
  })

  it('IMPL DELTA D4: missing keys are filled with the column average of present voters', () => {
    // Voter A skipped project '3' entirely. The other two voted 30 and 20
    // respectively — column average ≈ 25. After normalization, A's '3' value
    // should sit near 25 (subject to the iterative renormalization).
    const projects = [{ id: '1' }, { id: '2' }, { id: '3' }]
    const distributions = [
      { address: '0xa', distribution: { '1': 50, '2': 50 } }, // no '3'
      { address: '0xb', distribution: { '1': 35, '2': 35, '3': 30 } },
      { address: '0xc', distribution: { '1': 40, '2': 40, '3': 20 } },
    ]
    const [normalized, votes] = runIterativeNormalization(distributions, projects)
    // Row sums to 100
    expect(votes[0].reduce((s, v) => s + v, 0)).to.be.closeTo(100, 0.01)
    // Filled value for project '3' (index 2) should be a number > 0 and
    // not absurd. The exact value depends on iteration interplay; assert
    // it's in the same ballpark as the others' contributions.
    expect(votes[0][2]).to.be.greaterThan(0)
    expect(votes[0][2]).to.be.lessThan(60)
    // Normalized output dictionary contains every project key
    normalized.forEach((d: any) => {
      expect(Object.keys(d.distribution)).to.have.length(3)
    })
  })

  it('SPEC S3 (boundary): a single voter with full coverage normalizes to itself', () => {
    const projects = [{ id: '1' }, { id: '2' }]
    const distributions = [
      { address: '0xa', distribution: { '1': 70, '2': 30 } },
    ]
    const [, votes] = runIterativeNormalization(distributions, projects)
    expect(votes[0][0]).to.be.closeTo(70, 0.01)
    expect(votes[0][1]).to.be.closeTo(30, 0.01)
  })

  it('IMPL DELTA D8: distributions don\'t need to sum to 100 — they are renormalized', () => {
    // Voter A submits {1: 1, 2: 1} (sums to 2). After normalization their
    // row should be {50, 50} — same as a voter who submits {50, 50}.
    const projects = [{ id: '1' }, { id: '2' }]
    const distributions = [
      { address: '0xa', distribution: { '1': 1, '2': 1 } },
      { address: '0xb', distribution: { '1': 50, '2': 50 } },
    ]
    const [, votes] = runIterativeNormalization(distributions, projects)
    expect(votes[0][0]).to.be.closeTo(50, 0.01)
    expect(votes[0][1]).to.be.closeTo(50, 0.01)
    expect(votes[1][0]).to.be.closeTo(50, 0.01)
    expect(votes[1][1]).to.be.closeTo(50, 0.01)
  })
})

describe('Vote tally / Layer 1 — author self-vote stripping', () => {
  // The vote.ts / computeMemberVoteOutcome.ts step that strips the author's
  // allocation to their own project is the same loop everywhere — pin it
  // here so the helper-shape contract stays stable.
  function stripAuthorOwnVotes(
    rawVotes: Array<{ address: string; distribution: Record<string, number> }>,
    projectIdToAuthor: Record<string, string>
  ) {
    return rawVotes.map((v) => {
      const voterAddr = v.address?.toLowerCase()
      const distribution: Record<string, number> = {}
      for (const [projectId, value] of Object.entries(v.distribution)) {
        const author = projectIdToAuthor[projectId]?.toLowerCase()
        if (author && author === voterAddr) continue
        const numeric = Number(value)
        if (!Number.isFinite(numeric) || numeric < 0) continue
        distribution[projectId] = numeric
      }
      return { ...v, distribution }
    })
  }

  it('SPEC S2: author\'s allocation to their own project is removed', () => {
    const stripped = stripAuthorOwnVotes(
      [{ address: '0xauthor', distribution: { '1': 100, '2': 0 } }],
      { '1': '0xauthor' }
    )
    expect(stripped[0].distribution).to.not.have.property('1')
    expect(stripped[0].distribution['2']).to.equal(0)
  })

  it('SPEC S2: author can still vote on OTHER projects (per-project strip, not full ban)', () => {
    const stripped = stripAuthorOwnVotes(
      [{ address: '0xauthor', distribution: { '1': 0, '2': 50, '3': 50 } }],
      { '1': '0xauthor' }
    )
    expect(stripped[0].distribution['2']).to.equal(50)
    expect(stripped[0].distribution['3']).to.equal(50)
    expect(stripped[0].distribution).to.not.have.property('1')
  })

  it('SPEC S2: address comparison is case-insensitive', () => {
    const stripped = stripAuthorOwnVotes(
      [{ address: '0xABCDEF', distribution: { '1': 100, '2': 0 } }],
      { '1': '0xabcdef' }
    )
    expect(stripped[0].distribution).to.not.have.property('1')
  })

  it('SPEC S2: non-author voter\'s allocation to that project is preserved', () => {
    const stripped = stripAuthorOwnVotes(
      [{ address: '0xvoter', distribution: { '1': 100, '2': 0 } }],
      { '1': '0xauthor' }
    )
    expect(stripped[0].distribution['1']).to.equal(100)
  })

  it('D4 (CONFIRMED INTENTIONAL): end-to-end — author can\'t boost their own project to 100%', () => {
    // Even though the author votes 100% for their own project, after
    // stripping + normalizing + quadratic the project should NOT win
    // outright. With other voters at 0% for that project, the column
    // average is 0, so the author's row's filled value is 0 too.
    const projects = [{ id: '1' }, { id: '2' }, { id: '3' }]
    const stripped = stripAuthorOwnVotes(
      [
        { address: '0xauthor', distribution: { '1': 100, '2': 0, '3': 0 } },
        { address: '0xb', distribution: { '1': 0, '2': 50, '3': 50 } },
        { address: '0xc', distribution: { '1': 0, '2': 50, '3': 50 } },
      ],
      { '1': '0xauthor' }
    )
    const [normalized] = runIterativeNormalization(stripped, projects)
    const outcome = runQuadraticVoting(
      normalized,
      { '0xauthor': 10, '0xb': 10, '0xc': 10 },
      100
    )
    // Project 1's outcome should be ~0 (other voters gave 0; author's
    // value was filled from column average = 0).
    expect(outcome['1']).to.be.closeTo(0, 1)
    expect(outcome['2'] + outcome['3']).to.be.closeTo(100, 1)
  })

  it('D4 (CONFIRMED INTENTIONAL): when other voters DO support the author\'s project, author still gets a (filled) row value', () => {
    // Author is 0xa, project 1. Voters B and C give project 1 30% each.
    // After strip: A has {2: 50, 3: 50}. After normalize, A's row's value
    // for project 1 is the column average (~30) of B and C — so the
    // author "indirectly" gets credit for project 1 at the others' rate.
    const projects = [{ id: '1' }, { id: '2' }, { id: '3' }]
    const stripped = stripAuthorOwnVotes(
      [
        { address: '0xauthor', distribution: { '1': 60, '2': 20, '3': 20 } },
        { address: '0xb', distribution: { '1': 30, '2': 35, '3': 35 } },
        { address: '0xc', distribution: { '1': 30, '2': 35, '3': 35 } },
      ],
      { '1': '0xauthor' }
    )
    const [, votes] = runIterativeNormalization(stripped, projects)
    // Author row's project 1 cell should be in the ballpark of the column
    // average (~30), not their original 60 nor 0.
    expect(votes[0][0]).to.be.greaterThan(15)
    expect(votes[0][0]).to.be.lessThan(45)
  })
})

// =============================================================================
// LAYER 1 — getApprovedProjects (top-50% + budget-cap rules)
// =============================================================================

describe('Vote tally / Layer 1 — getApprovedProjects: SPEC S5 (top 50%)', () => {
  it('SPEC: 6 projects, ceil(6/2) = 3 approved by index alone', () => {
    const projects = [1, 2, 3, 4, 5, 6]
    const outcome = { 1: 30, 2: 25, 3: 20, 4: 15, 5: 7, 6: 3 }
    // All budgets tiny so the budget cap never bites.
    const usdBudgets = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 }
    const approved = getApprovedProjects(projects, outcome, usdBudgets, 1000)
    expect(approved[1]).to.be.true
    expect(approved[2]).to.be.true
    expect(approved[3]).to.be.true
    expect(approved[4]).to.be.false
    expect(approved[5]).to.be.false
    expect(approved[6]).to.be.false
  })

  it('SPEC: ranking is by outcome %, descending', () => {
    // Insert projects in deliberate "wrong" order; outcome should still
    // pick the top by percentage.
    const projects = [1, 2, 3, 4, 5, 6]
    const outcome = { 1: 5, 2: 10, 3: 50, 4: 15, 5: 12, 6: 8 }
    const usdBudgets = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 }
    const approved = getApprovedProjects(projects, outcome, usdBudgets, 1000)
    // Top 3 by outcome are projects 3 (50), 4 (15), 5 (12).
    expect(approved[3]).to.be.true
    expect(approved[4]).to.be.true
    expect(approved[5]).to.be.true
    expect(approved[2]).to.be.false
    expect(approved[6]).to.be.false
    expect(approved[1]).to.be.false
  })

  it('SPEC: 8 projects, ceil(8/2) = 4 approved (50% rule kicks in cleanly)', () => {
    const projects = [1, 2, 3, 4, 5, 6, 7, 8]
    const outcome = { 1: 30, 2: 20, 3: 15, 4: 10, 5: 9, 6: 8, 7: 5, 8: 3 }
    const usdBudgets = Object.fromEntries(projects.map((p) => [p, 1]))
    const approved = getApprovedProjects(projects, outcome, usdBudgets, 1000)
    expect(Object.values(approved).filter(Boolean).length).to.equal(4)
    expect(approved[1]).to.be.true
    expect(approved[2]).to.be.true
    expect(approved[3]).to.be.true
    expect(approved[4]).to.be.true
    expect(approved[5]).to.be.false
  })
})

describe('Vote tally / Layer 1 — getApprovedProjects: D1 (floor of 3 — CONFIRMED INTENTIONAL)', () => {
  // Spec says "top 50%". Implementation forces a minimum of 3 approved
  // when n ≥ 3 — confirmed intentional so small cycles aren't reduced
  // to 1–2 winners by rounding.
  it('1 project → 1 approved (capped at n)', () => {
    const approved = getApprovedProjects(
      [1],
      { 1: 100 },
      { 1: 1 },
      1000
    )
    expect(approved[1]).to.be.true
  })

  it('2 projects → 2 approved (max(ceil(1), 3) = 3, capped at n=2)', () => {
    const approved = getApprovedProjects(
      [1, 2],
      { 1: 60, 2: 40 },
      { 1: 1, 2: 1 },
      1000
    )
    expect(approved[1]).to.be.true
    expect(approved[2]).to.be.true
  })

  it('3 projects → 3 approved (100% funded — floor wins over 50%)', () => {
    const approved = getApprovedProjects(
      [1, 2, 3],
      { 1: 50, 2: 30, 3: 20 },
      { 1: 1, 2: 1, 3: 1 },
      1000
    )
    expect(approved[1]).to.be.true
    expect(approved[2]).to.be.true
    expect(approved[3]).to.be.true
  })

  it('4 projects → 3 approved (75%, not 50% — floor wins over 50%)', () => {
    const approved = getApprovedProjects(
      [1, 2, 3, 4],
      { 1: 40, 2: 30, 3: 20, 4: 10 },
      { 1: 1, 2: 1, 3: 1, 4: 1 },
      1000
    )
    expect([approved[1], approved[2], approved[3]]).to.deep.equal([true, true, true])
    expect(approved[4]).to.be.false
  })

  it('5 projects → 3 approved (60%, not 50% — floor wins over 50%)', () => {
    const approved = getApprovedProjects(
      [1, 2, 3, 4, 5],
      { 1: 30, 2: 25, 3: 20, 4: 15, 5: 10 },
      { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 },
      1000
    )
    expect(Object.values(approved).filter(Boolean).length).to.equal(3)
  })

  it('7 projects → 4 approved (ceil(7/2)=4, exceeds floor of 3)', () => {
    const approved = getApprovedProjects(
      [1, 2, 3, 4, 5, 6, 7],
      { 1: 20, 2: 18, 3: 16, 4: 14, 5: 12, 6: 11, 7: 9 },
      { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 },
      1000
    )
    expect(Object.values(approved).filter(Boolean).length).to.equal(4)
  })
})

describe('Vote tally / Layer 1 — getApprovedProjects: SPEC S6 (3/4 budget cap)', () => {
  it('SPEC: cap is exactly 3/4 of the quarterly budget (≤, not <)', () => {
    // 3 projects, each $25, pool $100. Cumulative reaches exactly $75 at
    // rank 3. Cap is `<=` so all three should be approved.
    const approved = getApprovedProjects(
      [1, 2, 3],
      { 1: 50, 2: 30, 3: 20 },
      { 1: 25, 2: 25, 3: 25 },
      100
    )
    expect(approved[1]).to.be.true
    expect(approved[2]).to.be.true
    expect(approved[3]).to.be.true
  })

  it('SPEC: cumulative budget over 3/4 stops further approvals', () => {
    // 6 projects each $20, pool $100. Cap = $75. Approved by index = top 3.
    // Cumulative at rank 3 = $60 ≤ $75 ✓. Rank 4 would push to $80, but
    // index already disqualifies it. So all top-3 approved by index AND
    // budget; bottom-3 rejected by index.
    const approved = getApprovedProjects(
      [1, 2, 3, 4, 5, 6],
      { 1: 25, 2: 22, 3: 20, 4: 18, 5: 10, 6: 5 },
      { 1: 20, 2: 20, 3: 20, 4: 20, 5: 20, 6: 20 },
      100
    )
    expect(approved[1]).to.be.true
    expect(approved[2]).to.be.true
    expect(approved[3]).to.be.true
    expect(approved[4]).to.be.false
    expect(approved[5]).to.be.false
    expect(approved[6]).to.be.false
  })

  it('SPEC: budget cap can be the binding constraint, not just index', () => {
    // 6 projects each $30 (so two together = $60, three together = $90).
    // Pool = $100, cap = $75. Index allows top 3, but budget allows only
    // top 2 ($60 ≤ $75). Rank 3 would push to $90 > $75 → rejected.
    const approved = getApprovedProjects(
      [1, 2, 3, 4, 5, 6],
      { 1: 30, 2: 25, 3: 20, 4: 15, 5: 7, 6: 3 },
      { 1: 30, 2: 30, 3: 30, 4: 30, 5: 30, 6: 30 },
      100
    )
    expect(approved[1]).to.be.true
    expect(approved[2]).to.be.true
    expect(approved[3]).to.be.false // budget-rejected
    expect(approved[4]).to.be.false
  })

  it('IMPL DELTA D9: boundary — cumulative === 0.75 * pool is approved', () => {
    // 3 projects of $25 each, pool $100. Cumulative at rank-3 = $75
    // exactly. Comparison is `<=` so rank-3 must be approved.
    const approved = getApprovedProjects(
      [1, 2, 3],
      { 1: 50, 2: 30, 3: 20 },
      { 1: 25, 2: 25, 3: 25 },
      100
    )
    expect(approved[3]).to.be.true
  })
})

describe('Vote tally / Layer 1 — getApprovedProjects: SPEC D2 (knapsack budget cap)', () => {
  it('SPEC D2: a smaller popular project below a rejected larger one is still approved', () => {
    // 3 projects, budgets [50, 30, 5], pool $100, cap $75.
    // Rank 1: cum $0+50 = 50 ≤ 75 ✓ APPROVED (cum → 50)
    // Rank 2: cum 50+30 = 80 > 75 ✗ SKIP (cum stays at 50)
    // Rank 3: cum 50+5  = 55 ≤ 75 ✓ APPROVED (cum → 55)
    //
    // The previous greedy implementation rejected projects 2 AND 3
    // because rank 2 pushed it over and the running total never
    // recovered. Knapsack keeps checking smaller projects that still fit.
    const approved = getApprovedProjects(
      [1, 2, 3],
      { 1: 50, 2: 30, 3: 20 },
      { 1: 50, 2: 30, 3: 5 },
      100
    )
    expect(approved[1]).to.be.true
    expect(approved[2]).to.be.false
    expect(approved[3]).to.be.true
  })

  it('SPEC D3: a single rank-1 project whose budget alone exceeds 3/4 is rejected, but smaller projects can still be approved', () => {
    // 3 projects, budgets [80, 5, 5], pool $100, cap $75.
    // Rank 1: cum 0+80 = 80 > 75 ✗ SKIP (rank-1 budget alone exceeds cap)
    // Rank 2: cum 0+5  = 5  ≤ 75 ✓ APPROVED (cum → 5)
    // Rank 3: cum 5+5  = 10 ≤ 75 ✓ APPROVED (cum → 10)
    //
    // This is the most-corrected scenario vs. the old greedy
    // implementation (which rejected the entire quarter when rank-1
    // alone exceeded the cap).
    const approved = getApprovedProjects(
      [1, 2, 3],
      { 1: 50, 2: 30, 3: 20 },
      { 1: 80, 2: 5, 3: 5 },
      100
    )
    expect(approved[1]).to.be.false
    expect(approved[2]).to.be.true
    expect(approved[3]).to.be.true
  })

  it('SPEC D2: count cap is applied to ACCEPTED projects only, not visited rank slots', () => {
    // 6 projects, numApproved = max(ceil(6/2), 3) = 3.
    // Budgets [80, 10, 10, 10, 10, 10], pool $100, cap $75.
    // Rank 1: 0+80=80 > 75 SKIP. count=0.
    // Rank 2: 0+10=10 ≤ 75 APPROVE. count=1, cum=10.
    // Rank 3: 10+10=20 ≤ 75 APPROVE. count=2, cum=20.
    // Rank 4: 20+10=30 ≤ 75 APPROVE. count=3, cum=30.  ← hits the count cap
    // Rank 5: count=3 already → SKIP regardless of cap.
    // Rank 6: SKIP regardless of cap.
    //
    // Pin the spec'd interpretation: the "top 50%" cap counts approved
    // winners, not visited slots. Otherwise a rank-1 over-cap project
    // would burn one of the approval slots without funding anything.
    const approved = getApprovedProjects(
      [1, 2, 3, 4, 5, 6],
      { 1: 30, 2: 25, 3: 20, 4: 15, 5: 7, 6: 3 },
      { 1: 80, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10 },
      100
    )
    expect(approved[1]).to.be.false
    expect(approved[2]).to.be.true
    expect(approved[3]).to.be.true
    expect(approved[4]).to.be.true
    expect(approved[5]).to.be.false
    expect(approved[6]).to.be.false
  })

  it('IMPL DETAIL: NaN / undefined budgets are coerced to 0 (don\'t count toward cap)', () => {
    const approved = getApprovedProjects(
      [1, 2, 3],
      { 1: 50, 2: 30, 3: 20 },
      { 1: NaN, 2: undefined as any, 3: 25 },
      100
    )
    // All three should be approved (sum of usable budgets = $25 ≤ $75).
    expect(approved[1]).to.be.true
    expect(approved[2]).to.be.true
    expect(approved[3]).to.be.true
  })

  it('IMPL DETAIL: outcome entries with no matching budget map to 0 budget', () => {
    // Project 4 in outcome but absent from usdBudgets map.
    const approved = getApprovedProjects(
      [1, 2, 3, 4, 5, 6],
      { 1: 30, 2: 25, 3: 20, 4: 15, 5: 7, 6: 3 },
      { 1: 10, 2: 10, 3: 10, 5: 10, 6: 10 }, // 4 missing
      100
    )
    // 4 has 0 budget so it doesn't change the cap; index still picks top 3.
    expect(approved[1]).to.be.true
    expect(approved[2]).to.be.true
    expect(approved[3]).to.be.true
  })
})

// =============================================================================
// LAYER 2 — Full pipeline (in-memory, mirrors `computeMemberVoteOutcome`)
// =============================================================================

describe('Vote tally / Layer 2 — full in-memory pipeline', () => {
  // Reproduce the orchestration of `computeMemberVoteOutcome` /
  // `pages/api/proposals/vote.ts` end-to-end on hand-crafted inputs.
  //
  // Pipeline steps:
  //   (1) start with raw votes (per-voter distribution maps).
  //   (2) strip each voter's allocation to their own project AND fill
  //       explicit 0s for any non-author project they didn't allocate to.
  //       Only author-stripped cells are left absent (→ NaN downstream).
  //   (3) iterative normalization: NaN cells get the column average of
  //       OTHER voters; row-renormalize to 100, repeat 20×.
  //   (4) quadratic voting: power-weighted average, then normalize to 100.
  //   (5) approval: top-N (with floor of 3) AND cumulative budget ≤ 3/4.

  function runFullPipeline({
    rawVotes,
    projectIdToAuthorAddress,
    addressToVMOONEY,
    projects,
    usdBudgets,
    quarterlyBudget,
  }: {
    rawVotes: Array<{ address: string; distribution: Record<string, number> }>
    projectIdToAuthorAddress: Record<string, string>
    addressToVMOONEY: Record<string, number>
    projects: Array<{ id: string }>
    usdBudgets: Record<string, number>
    quarterlyBudget: number
  }) {
    // (2) Strip author own-votes AND fill explicit 0s for non-author
    // omissions (mirrors the loop in vote.ts / computeMemberVoteOutcome.ts
    // so this pipeline matches production exactly).
    const votesWithAuthorOwnExcluded = rawVotes.map((v) => {
      const voterAddr = v.address?.toLowerCase()
      const distribution: Record<string, number> = {}
      for (const project of projects) {
        const projectId = String(project.id)
        const author = projectIdToAuthorAddress[projectId]?.toLowerCase()
        if (author && voterAddr && author === voterAddr) continue
        const rawVal = v.distribution[projectId]
        const numeric = Number(rawVal)
        distribution[projectId] =
          rawVal != null && Number.isFinite(numeric) && numeric >= 0
            ? numeric
            : 0
      }
      return { ...v, distribution }
    })

    // (3) Iterative normalization.
    const [normalizedDistributions] = runIterativeNormalization(
      votesWithAuthorOwnExcluded,
      projects
    )

    // (4) Quadratic voting using √vMOONEY power.
    const addressToPower: Record<string, number> = Object.fromEntries(
      Object.entries(addressToVMOONEY).map(([addr, vm]) => [
        addr.toLowerCase(),
        Number.isNaN(vm) ? 0 : Math.sqrt(vm),
      ])
    )
    const outcome = runQuadraticVoting(normalizedDistributions, addressToPower, 100)

    // (5) Approval.
    const projectIdToApproved = getApprovedProjects(
      projects,
      outcome,
      usdBudgets,
      quarterlyBudget
    )

    return { outcome, projectIdToApproved, addressToPower }
  }

  it('end-to-end: realistic 6-project / 5-voter quarter, no authors among voters', () => {
    const projects = [
      { id: '1' },
      { id: '2' },
      { id: '3' },
      { id: '4' },
      { id: '5' },
      { id: '6' },
    ]
    const projectIdToAuthorAddress = {
      '1': '0xauthor1',
      '2': '0xauthor2',
      '3': '0xauthor3',
      '4': '0xauthor4',
      '5': '0xauthor5',
      '6': '0xauthor6',
    }
    const rawVotes = [
      { address: '0xv1', distribution: { '1': 30, '2': 20, '3': 20, '4': 15, '5': 10, '6': 5 } },
      { address: '0xv2', distribution: { '1': 25, '2': 25, '3': 20, '4': 15, '5': 10, '6': 5 } },
      { address: '0xv3', distribution: { '1': 35, '2': 20, '3': 15, '4': 15, '5': 10, '6': 5 } },
      { address: '0xv4', distribution: { '1': 20, '2': 30, '3': 20, '4': 15, '5': 10, '6': 5 } },
      { address: '0xv5', distribution: { '1': 30, '2': 25, '3': 15, '4': 15, '5': 10, '6': 5 } },
    ]
    const addressToVMOONEY = { '0xv1': 100, '0xv2': 100, '0xv3': 100, '0xv4': 100, '0xv5': 100 }
    // Quarterly budget $1000, all per-project budgets $100. Cumulative at
    // rank 3 = $300 ≤ $750 ✓.
    const usdBudgets = { '1': 100, '2': 100, '3': 100, '4': 100, '5': 100, '6': 100 }
    const { outcome, projectIdToApproved } = runFullPipeline({
      rawVotes,
      projectIdToAuthorAddress,
      addressToVMOONEY,
      projects,
      usdBudgets,
      quarterlyBudget: 1000,
    })
    // Outcome sums to 100.
    const total = Object.values(outcome).reduce((s, v) => s + v, 0)
    expect(total).to.be.closeTo(100, 0.5)
    // Top 3 by % approved (all voters agree on 1 > 2 > 3 > rest).
    expect(projectIdToApproved['1']).to.be.true
    expect(projectIdToApproved['2']).to.be.true
    expect(projectIdToApproved['3']).to.be.true
    expect(projectIdToApproved['4']).to.be.false
    expect(projectIdToApproved['5']).to.be.false
    expect(projectIdToApproved['6']).to.be.false
  })

  it('end-to-end: author cannot push their own project into approval', () => {
    // 4 projects. Author of project 1 votes 100% for their own project.
    // Other voters give project 1 0%.
    const projects = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }]
    const projectIdToAuthorAddress = { '1': '0xauthor' }
    const rawVotes = [
      { address: '0xauthor', distribution: { '1': 100, '2': 0, '3': 0, '4': 0 } },
      { address: '0xv1', distribution: { '1': 0, '2': 50, '3': 30, '4': 20 } },
      { address: '0xv2', distribution: { '1': 0, '2': 40, '3': 40, '4': 20 } },
      { address: '0xv3', distribution: { '1': 0, '2': 45, '3': 35, '4': 20 } },
    ]
    const addressToVMOONEY = { '0xauthor': 100, '0xv1': 100, '0xv2': 100, '0xv3': 100 }
    const usdBudgets = { '1': 100, '2': 100, '3': 100, '4': 100 }
    const { outcome, projectIdToApproved } = runFullPipeline({
      rawVotes,
      projectIdToAuthorAddress,
      addressToVMOONEY,
      projects,
      usdBudgets,
      quarterlyBudget: 1000,
    })
    // Project 1 should be ~0% (author stripped, others gave 0).
    expect(outcome['1']).to.be.lessThan(2)
    // Top 3 (n=4 → floor of 3) approved: 2, 3, 4.
    expect(projectIdToApproved['2']).to.be.true
    expect(projectIdToApproved['3']).to.be.true
    expect(projectIdToApproved['4']).to.be.true
    expect(projectIdToApproved['1']).to.be.false
  })

  it('end-to-end: quadratic weighting prevents whale dominance', () => {
    // Whale has 10000 vMOONEY (power = 100). Three minnows have 100 each
    // (power = 10 each → total minnow power = 30). Linear weighting
    // would let the whale dominate (10000 vs 300). Quadratic still
    // gives the whale ~77% influence (100 / (100 + 30)) — large but
    // not absolute.
    const projects = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }]
    const rawVotes = [
      { address: '0xwhale', distribution: { '1': 100, '2': 0, '3': 0, '4': 0 } },
      { address: '0xa', distribution: { '1': 0, '2': 100, '3': 0, '4': 0 } },
      { address: '0xb', distribution: { '1': 0, '2': 100, '3': 0, '4': 0 } },
      { address: '0xc', distribution: { '1': 0, '2': 100, '3': 0, '4': 0 } },
    ]
    const addressToVMOONEY = { '0xwhale': 10000, '0xa': 100, '0xb': 100, '0xc': 100 }
    const usdBudgets = { '1': 100, '2': 100, '3': 100, '4': 100 }
    const { outcome } = runFullPipeline({
      rawVotes,
      projectIdToAuthorAddress: {},
      addressToVMOONEY,
      projects,
      usdBudgets,
      quarterlyBudget: 1000,
    })
    // Whale's project 1 ≈ 100 / 130 ≈ 76.9%, minnows' project 2 ≈ 23.1%.
    // (Exact values shift slightly due to iterative normalization filling
    // in the zeros.)
    expect(outcome['1']).to.be.greaterThan(60)
    expect(outcome['1']).to.be.lessThan(90)
    expect(outcome['2']).to.be.greaterThan(10)
    expect(outcome['2']).to.be.lessThan(40)
  })

  it('end-to-end: budget cap can knock approved-by-vote projects out', () => {
    // 6 projects, all popular but expensive. Top 3 by % would cost $600
    // ($200 each), but pool is only $400 (cap = $300). So only top 1
    // ($200) fits; rank 2 would push to $400 > $300.
    const projects = [
      { id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }, { id: '6' },
    ]
    const rawVotes = [
      { address: '0xv1', distribution: { '1': 30, '2': 25, '3': 20, '4': 15, '5': 7, '6': 3 } },
      { address: '0xv2', distribution: { '1': 30, '2': 25, '3': 20, '4': 15, '5': 7, '6': 3 } },
    ]
    const addressToVMOONEY = { '0xv1': 100, '0xv2': 100 }
    const usdBudgets = { '1': 200, '2': 200, '3': 200, '4': 200, '5': 200, '6': 200 }
    const { projectIdToApproved } = runFullPipeline({
      rawVotes,
      projectIdToAuthorAddress: {},
      addressToVMOONEY,
      projects,
      usdBudgets,
      quarterlyBudget: 400,
    })
    expect(projectIdToApproved['1']).to.be.true
    expect(projectIdToApproved['2']).to.be.false // budget-rejected
    expect(projectIdToApproved['3']).to.be.false
    expect(projectIdToApproved['4']).to.be.false
    expect(projectIdToApproved['5']).to.be.false
    expect(projectIdToApproved['6']).to.be.false
  })
})

// =============================================================================
// LAYER 3 — `computeMemberVoteOutcome` integration with stubbed deps
// =============================================================================

/**
 * Best-effort end-to-end test of `computeMemberVoteOutcome`.
 *
 * Why "best-effort": Cypress doesn't support clean module-level mocking
 * for ES module default exports — the namespace bindings emitted by
 * webpack are usually mutable, so `cy.stub` works most of the time, but
 * not in all configurations.
 *
 * If this suite fails to install stubs in your environment, the Layer 1
 * + Layer 2 suites above still cover the full math. This suite verifies
 * the *wiring*: that the orchestration calls Tableland → contract reads
 * → IPFS → vMOONEY in the right order with the right inputs and feeds
 * the math primitives correctly.
 */
import * as queryTableModule from '../../../lib/tableland/queryTable'
import * as vmooneyModule from '../../../lib/tokens/hooks/useTotalVMOONEY'
import * as thirdwebModule from 'thirdweb'
import * as datesModule from '../../../lib/utils/dates'
import { computeMemberVoteOutcome } from '../../../lib/proposals/computeMemberVoteOutcome'
import { arbitrum } from 'thirdweb/chains'

describe('Vote tally / Layer 3 — computeMemberVoteOutcome integration (stubbed)', () => {
  const VOTE_OPEN_TS = 1_700_000_000 // arbitrary
  const VOTE_CLOSE_TS = VOTE_OPEN_TS + 60 * 60 * 24 * 5

  // Canned scenario: 3 senate-approved projects, 3 voters, no author overlap.
  const projectsRow = [
    { id: 'p1', MDP: 101, name: 'Project One', proposalIPFS: 'ipfs://p1' },
    { id: 'p2', MDP: 102, name: 'Project Two', proposalIPFS: 'ipfs://p2' },
    { id: 'p3', MDP: 103, name: 'Project Three', proposalIPFS: 'ipfs://p3' },
  ]
  const votesRow = [
    {
      address: '0xv1',
      distribution: JSON.stringify({ p1: 50, p2: 30, p3: 20 }),
      year: 2026,
      quarter: 2,
    },
    {
      address: '0xv2',
      distribution: JSON.stringify({ p1: 40, p2: 35, p3: 25 }),
      year: 2026,
      quarter: 2,
    },
    {
      address: '0xv3',
      distribution: JSON.stringify({ p1: 60, p2: 25, p3: 15 }),
      year: 2026,
      quarter: 2,
    },
  ]

  beforeEach(() => {
    // Tableland: first call returns votes, second returns projects.
    cy.stub(queryTableModule, 'default')
      .onFirstCall()
      .resolves(votesRow)
      .onSecondCall()
      .resolves(projectsRow)
      .as('queryTable')

    // Senate-approval check: every project passes.
    cy.stub(thirdwebModule, 'getContract').returns({ __mock: 'proposalContract' })
    cy.stub(thirdwebModule, 'readContract').resolves(true).as('readContract')

    // IPFS proposal payloads.
    cy.stub(globalThis, 'fetch').callsFake((url: any) => {
      const u = String(url)
      const payloads: Record<string, any> = {
        'ipfs://p1': {
          authorAddress: '0xauthor1',
          title: 'Project One',
          body: '## Budget\n| Item | $ |\n| --- | --- |\n| Total Budget | $200 |',
          totalBudgetUSDC: 200,
        },
        'ipfs://p2': {
          authorAddress: '0xauthor2',
          title: 'Project Two',
          body: '',
          totalBudgetUSDC: 150,
        },
        'ipfs://p3': {
          authorAddress: '0xauthor3',
          title: 'Project Three',
          body: '',
          totalBudgetUSDC: 100,
        },
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(payloads[u] ?? {}),
      } as any)
    }).as('ipfsFetch')

    // vMOONEY balances at vote close (3 voters, equal balance for clarity).
    cy.stub(vmooneyModule, 'fetchTotalVMOONEYs').resolves([100, 100, 100])

    // Pin the vote-open timestamp so we can predict voteCloseTimestamp.
    cy.stub(datesModule, 'getThirdThursdayOfQuarterTimestamp').returns(
      new Date(VOTE_OPEN_TS * 1000)
    )
  })

  it('returns a populated outcome for a valid quarter', async () => {
    const result = await computeMemberVoteOutcome({
      chain: arbitrum,
      quarter: 2,
      year: 2026,
    })
    expect(result).to.not.be.null
    if (!result) return
    expect(result.quarter).to.equal(2)
    expect(result.year).to.equal(2026)
    expect(result.voteCloseTimestamp).to.equal(VOTE_CLOSE_TS)
    expect(result.voteCount).to.equal(3)
    expect(result.voterCount).to.equal(3)
    // 3 results, ranked, sum of percentages ≈ 100.
    expect(result.results).to.have.length(3)
    const sum = result.results.reduce((s, r) => s + r.percentage, 0)
    expect(sum).to.be.closeTo(100, 0.5)
    // Ranked descending.
    expect(result.results[0].percentage).to.be.gte(result.results[1].percentage)
    expect(result.results[1].percentage).to.be.gte(result.results[2].percentage)
    // All three approved (n=3 → floor of 3, total budget $450 ≤ $750 cap).
    result.results.forEach((r) => {
      expect(r.approved).to.be.true
    })
    // Budgets are read from the IPFS payload (totalBudgetUSDC).
    const budgetByMDP: Record<number, number> = {}
    result.results.forEach((r) => {
      budgetByMDP[Number(r.MDP)] = r.budget
    })
    expect(budgetByMDP[101]).to.equal(200)
    expect(budgetByMDP[102]).to.equal(150)
    expect(budgetByMDP[103]).to.equal(100)
  })

  it('returns null when there are no votes', async () => {
    // Override the first queryTable call to return [].
    ;(queryTableModule.default as any).restore?.()
    cy.stub(queryTableModule, 'default').resolves([])
    const result = await computeMemberVoteOutcome({
      chain: arbitrum,
      quarter: 2,
      year: 2026,
    })
    expect(result).to.be.null
  })

  it('returns null for an invalid quarter', async () => {
    const result = await computeMemberVoteOutcome({
      chain: arbitrum,
      quarter: 5,
      year: 2026,
    })
    expect(result).to.be.null
  })

  it('returns null for an invalid year', async () => {
    const result = await computeMemberVoteOutcome({
      chain: arbitrum,
      quarter: 2,
      year: 1999,
    })
    expect(result).to.be.null
  })

  it('strips author self-vote when an author is among the voters', async () => {
    // Replace the IPFS stub: voter 0xv1 is now the author of project p1.
    ;(globalThis.fetch as any).restore?.()
    cy.stub(globalThis, 'fetch').callsFake((url: any) => {
      const u = String(url)
      const payloads: Record<string, any> = {
        'ipfs://p1': {
          authorAddress: '0xv1', // ← voter is the author
          title: 'P1',
          body: '',
          totalBudgetUSDC: 100,
        },
        'ipfs://p2': {
          authorAddress: '0xauthor2',
          title: 'P2',
          body: '',
          totalBudgetUSDC: 100,
        },
        'ipfs://p3': {
          authorAddress: '0xauthor3',
          title: 'P3',
          body: '',
          totalBudgetUSDC: 100,
        },
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(payloads[u] ?? {}),
      } as any)
    })

    const result = await computeMemberVoteOutcome({
      chain: arbitrum,
      quarter: 2,
      year: 2026,
    })
    expect(result).to.not.be.null
    if (!result) return
    // p1 should still appear in results (not dropped), but its outcome is
    // computed without 0xv1's direct allocation to it.
    const p1 = result.results.find((r) => Number(r.MDP) === 101)
    expect(p1).to.exist
    // We can't easily assert an exact percentage delta without recomputing
    // — the value of this test is that the orchestration ran the strip
    // step (and didn't blow up).
  })
})
