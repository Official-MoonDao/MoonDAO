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
import { extractUsdBudget } from '../../../lib/proposals/extractUsdBudget'

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

  describe('Q2 2026 expected state', () => {
    it('MDP-245 resolves to the agreed $2,700 cap-fitting amount', () => {
      // The point of the override: MDP-245's IPFS body parses to ~$3,234,
      // which would push the Q2 2026 approved set over the 3/4 cap and
      // reject the project. The override drops it to the $2,700 the
      // author agreed to so it fits as the 5th Member-Vote winner.
      const proposal = {
        totalBudgetUSDC: 3234,
        budget: [{ token: 'USDC', amount: 3234 }],
      }
      expect(extractUsdBudget(proposal, { MDP: 245 })).to.equal(2700)
      expect(extractUsdBudget(proposal, { MDP: '245' })).to.equal(2700)
    })
  })
})
