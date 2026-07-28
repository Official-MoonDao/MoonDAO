/**
 * Pin tests for the manual budget-override flow.
 *
 * The shared `extractUsdBudget` consults `BUDGET_OVERRIDES_USD` *before*
 * any IPFS-derived parsing. This is how author-negotiated post-submit
 * budget revisions (e.g., trimming a request to fit under the 3/4 cap)
 * propagate to BOTH the read-only display (`useProposalJSON`,
 * `computeMemberVoteOutcome`) and the on-chain tally (`vote.ts`) without
 * requiring the proposal author to re-pin a new IPFS payload.
 *
 * These tests exist so:
 *   - A future cleanup that removes the option without a real refactor
 *     plan trips a red test instead of silently restoring the old
 *     IPFS-only behavior (which would re-fund the original budget and
 *     blow the cap).
 *   - The precedence order (override > totalBudgetUSDC > budget[] >
 *     body parsing) stays explicit.
 */
import {
  BUDGET_OVERRIDES_USD,
  getBudgetOverrideUSD,
} from '../../../lib/proposals/budgetOverrides'
import {
  extractUsdBudget,
  parseUsdBudgetFromBody,
} from '../../../lib/proposals/extractUsdBudget'

describe('budget overrides', () => {
  describe('getBudgetOverrideUSD', () => {
    it('returns the override for an MDP with an entry', () => {
      // Use whichever MDP is currently in the override map. Pinning the
      // exact current value would make the test brittle every time we
      // add or remove an entry; instead we assert the value matches what
      // the map says, plus the lookup helper's contract.
      const entries = Object.entries(BUDGET_OVERRIDES_USD)
      if (entries.length === 0) {
        // Map is empty — nothing to test, but the helper still behaves.
        expect(getBudgetOverrideUSD(123)).to.equal(null)
        return
      }
      const [mdpKey, expectedAmount] = entries[0]
      expect(getBudgetOverrideUSD(mdpKey)).to.equal(expectedAmount)
      expect(getBudgetOverrideUSD(Number(mdpKey))).to.equal(expectedAmount)
    })

    it('returns null for an MDP not in the map', () => {
      expect(getBudgetOverrideUSD(999999)).to.equal(null)
      expect(getBudgetOverrideUSD('999999')).to.equal(null)
    })

    it('returns null for null / undefined / non-numeric input', () => {
      expect(getBudgetOverrideUSD(null)).to.equal(null)
      expect(getBudgetOverrideUSD(undefined)).to.equal(null)
    })
  })

  describe('extractUsdBudget precedence', () => {
    it('override beats totalBudgetUSDC', () => {
      const entries = Object.entries(BUDGET_OVERRIDES_USD)
      if (entries.length === 0) return
      const [mdpKey, overrideAmount] = entries[0]
      const proposal = {
        totalBudgetUSDC: 99999,
        budget: [{ token: 'USDC', amount: 88888 }],
        body: '## Budget\n| Total | $77,777 |',
      }
      expect(
        extractUsdBudget(proposal, { MDP: mdpKey })
      ).to.equal(overrideAmount)
    })

    it('override beats budget[] sum', () => {
      const entries = Object.entries(BUDGET_OVERRIDES_USD)
      if (entries.length === 0) return
      const [mdpKey, overrideAmount] = entries[0]
      const proposal = {
        budget: [{ token: 'USDC', amount: 50000 }],
      }
      expect(
        extractUsdBudget(proposal, { MDP: mdpKey })
      ).to.equal(overrideAmount)
    })

    it('override beats body parsing', () => {
      const entries = Object.entries(BUDGET_OVERRIDES_USD)
      if (entries.length === 0) return
      const [mdpKey, overrideAmount] = entries[0]
      const proposal = {
        body: '## Budget\n| Total | $99,999 |',
      }
      expect(
        extractUsdBudget(proposal, { MDP: mdpKey })
      ).to.equal(overrideAmount)
    })

    it('falls through to the IPFS-derived value when no override exists', () => {
      const proposal = {
        totalBudgetUSDC: 1234,
        budget: [{ token: 'USDC', amount: 5678 }],
      }
      expect(extractUsdBudget(proposal, { MDP: 999999 })).to.equal(1234)
    })

    it('falls through to budget[] when totalBudgetUSDC is missing and no override', () => {
      const proposal = {
        budget: [
          { token: 'USDC', amount: 1000 },
          { token: 'DAI', amount: 500 },
          { token: 'ETH', amount: 1 }, // ignored — not a stablecoin symbol
        ],
      }
      expect(extractUsdBudget(proposal, { MDP: 999999 })).to.equal(1500)
    })

    it('still works without an MDP option (no-op override lookup)', () => {
      const proposal = {
        totalBudgetUSDC: 4242,
      }
      expect(extractUsdBudget(proposal)).to.equal(4242)
      expect(extractUsdBudget(proposal, {})).to.equal(4242)
    })
  })

  describe('extractUsdBudget rejection cases', () => {
    it('returns 0 for a non-object proposal even with no override', () => {
      expect(extractUsdBudget(null as any)).to.equal(0)
      expect(extractUsdBudget(undefined as any)).to.equal(0)
      expect(extractUsdBudget('not an object' as any)).to.equal(0)
    })

    it('returns 0 when no source resolves to a positive number', () => {
      const proposal = {
        totalBudgetUSDC: 0,
        budget: [{ token: 'ETH', amount: 1 }],
        body: 'no budget anywhere here',
      }
      expect(extractUsdBudget(proposal, { MDP: 999999 })).to.equal(0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Parser regression tests — one test per Q3 2026 failure shape so each
  // bug is caught if the body-parsing logic regresses.
  // ─────────────────────────────────────────────────────────────────────────
  describe('parseUsdBudgetFromBody — regression suite', () => {
    // MDP-266 shape: 3-column table (desc | quantity | cost), plural "Totals"
    // row, and an invisible U+200E mark embedded in the amount cell.
    it('reads the last (cost) column of a 3-column table, plural Totals row (MDP-266 shape)', () => {
      const body = [
        '# Budget',
        '',
        '| Description | Man-days | Cost |',
        '| --- | --- | --- |',
        '| Main modules / Airlocks | 1 | US$ 500 |',
        '| Central Hub / Counter-rotation | 1 | US$ 500 |',
        '| Environment Control | 1.5 | US$ 750 |',
        // U+200E embedded before the dollar sign, as in the real proposal
        '| Totals | 8 | US\u200E$ 4,000 |',
        '',
      ].join('\n')
      expect(parseUsdBudgetFromBody(body)).to.equal(4000)
    })

    // MDP-259 shape: Totals row cell contains a mixed-currency string
    // "$2430 USD 1.30 ETH". The old isUsdValue() rejected the whole cell
    // because "ETH" appeared in it, even though a $ USD amount was present.
    it('extracts USD amount from a mixed-currency total cell "$X USD N.N ETH" (MDP-259 shape)', () => {
      const body = [
        '# Budget',
        '',
        '| Description | Amount | Justification |',
        '| --- | --- | --- |',
        '| Kits | $1560 | 150 kits |',
        '| Transport | $280 | logistics |',
        '| Total | $2430 USD 1.30 ETH | |',
        '',
      ].join('\n')
      expect(parseUsdBudgetFromBody(body)).to.equal(2430)
    })

    // MDP-250 shape: budget written as prose with an arithmetic expression.
    // "Total costs: (820 + 88 + 3200) $= $4108" — the inline parser must
    // find the LAST / largest $ amount on the trigger line, not the first
    // number inside the parentheses.
    it('parses inline "Total costs: (items) $= $total" prose (MDP-250 shape)', () => {
      const body =
        'Software costs:\nNvivo $820\nGoogle Workspace $88\n\nResearcher Compensation $3200\n\nTotal costs: (820 + 88 + 3200) $= $4108'
      expect(parseUsdBudgetFromBody(body)).to.equal(4108)
    })

    // MDP-255 shape: proposal has a # Budget section whose table carries
    // no dollar amounts (only category labels), AND the body contains a
    // large Revenue Potential table. The parser must NOT fall through to
    // the whole-body scan and accidentally sum the revenue figures.
    it('does not sum a Revenue table when a Budget section heading exists but has no parseable total (MDP-255 shape)', () => {
      const body = [
        '# Solution',
        'Some description.',
        '',
        '# Revenue Potential',
        '',
        '| Channel | Revenue |',
        '| --- | --- |',
        '| Online courses | $60,000 |',
        '| Premium paths | $62,500 |',
        '| Total | $122,500 |',
        '',
        '# Budget (Table C)#',
        '',
        '| Budget Category |',
        '| --- |',
        '| Platform Completion |',
        '| Marketing |',
        '',
      ].join('\n')
      // Should return 0 (no parseable total in the budget section) rather
      // than $122,500 from the Revenue table.
      expect(parseUsdBudgetFromBody(body)).to.equal(0)
    })

    // Regression: standard 2-column budget table still works after the
    // extractTableRowPairs refactor.
    it('still reads a standard 2-column budget table correctly', () => {
      const body = [
        '## Budget',
        '',
        '| Item | Cost |',
        '| --- | --- |',
        '| Dev work | $3,000 |',
        '| Marketing | $1,000 |',
        '| Total | $4,000 |',
      ].join('\n')
      expect(parseUsdBudgetFromBody(body)).to.equal(4000)
    })

    // Regression: 3-column desc|amount|justification table (MDP-251 style).
    // The amount is in the middle column, not the last.
    it('picks the middle USD column when last column is non-numeric justification text (MDP-251 style)', () => {
      const body = [
        '## Budget',
        '',
        '| Description | Amount | Justification |',
        '| --- | --- | --- |',
        '| Crew registration fee | $3,500 | Published MDRS rate |',
        '| Security deposit | $250 | Refundable |',
        '| Travel | $700 | Round-trip |',
        '| Total | $5,500 USD | Sent in ETH or MOONEY |',
      ].join('\n')
      expect(parseUsdBudgetFromBody(body)).to.equal(5500)
    })

    // MDP-264 shape: a line-item row whose justification prose contains a
    // trigger substring ("Unexpected project costs") must NOT hijack the $
    // amount that appears BEFORE the trigger. The real "Total budget $4000"
    // line, appearing later, is the correct answer.
    it('ignores a $ amount that precedes a trigger phrase embedded in prose (MDP-264 shape)', () => {
      const body = [
        '# Budget (Table C)#',
        '',
        'Aerospace research resources        $900        Technical papers',
        'Research assistance        $1,000        Engineering analysis',
        'Community presentation & publication        $400        Final report',
        'Contingency        $400        Unexpected project costs',
        'Total budget $4000',
      ].join('\n')
      expect(parseUsdBudgetFromBody(body)).to.equal(4000)
    })

    // Guard: the inline trigger must still pick up an amount that follows the
    // trigger phrase, even when other (smaller) amounts appear earlier on the
    // line. "Total Budget: $5,000 (includes $500 contingency)" → 5000.
    it('takes the max $ amount that appears after the trigger phrase', () => {
      expect(
        parseUsdBudgetFromBody('Total Budget: $5,000 (includes $500 contingency)')
      ).to.equal(5000)
    })

    // Guard: "Total costs: (820 + 88 + 3200) $= $4108" — the arithmetic in
    // parentheses precedes no $, and the real amount follows the trigger.
    it('parses inline "Total costs" prose with a trailing $ total (MDP-250 shape)', () => {
      expect(
        parseUsdBudgetFromBody('Total costs: (820 + 88 + 3200) $= $4108')
      ).to.equal(4108)
    })
  })
})
