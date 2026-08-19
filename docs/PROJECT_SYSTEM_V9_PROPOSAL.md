# Project System Update Proposal

**Author:** Executive Branch  
**Date:** August 19, 2026  
**Type:** Non-project proposal (amends [Project System v8.0](https://docs.moondao.com/Projects/Project-System))  
**Transactions:** None

This is an update of the Projects System that introduces the following changes:

- The quarterly project pot is **3% of official liquid AUM** (the same non-MOONEY treasury figure used in the finance overview), rounded to the nearest $500. It is no longer 5% of a larger base that includes staked ETH.
- **The top three** Senate-passed proposals, ranked by Member House voting power, are funded. The top-50% rule and the 3/4 knapsack cap are removed.
- Each funded project receives a grant of **`min(what they asked, ¼ of the pot)`**. They cannot receive more than ¼. They do not receive more than they asked for.
- Whatever those three grants do not take, plus the remaining **¼ of the pot**, is the **retroactive USDC pool** for completed projects. Members still allocate that pool among eligible final reports the same way they do today.
- The Contributor Circle no longer receives stablecoins. Community contributions are rewarded in **vMOONEY only**. The vMOONEY geometric series is unchanged.
- The 3% rate is fixed. The dollar amount changes only when official liquid AUM changes. Changing the rate requires another Project System amendment.

All changes to the Project System document are specified below. Analysis and the August 14 financial snapshot are in [PR #1519](https://github.com/Official-MoonDao/MoonDAO/pull/1519) and [PR #1520](https://github.com/Official-MoonDao/MoonDAO/pull/1520).

---

## What does not change

- Ideation, submission deadlines, Senate review, Townhall pitches, and Senate yes/no.
- Member House still spreads voting power across Senate-passed proposals. Contributors still cannot vote on their own project.
- Final reports, Executive Branch eligibility, unused funds returning to the treasury, and launchpad for asks above the grant cap.
- Monthly Senate updates, weekly Townhall attendance, and weekly written updates.
- How vMOONEY is emitted and locked.

---

## Why

Official liquid AUM on 14 August 2026 is **$327,851**. Five percent of the old project-system base is **$24,310 per quarter ($97,240 per year)** — about 23% of MoonDAO’s USD burn, on a treasury with roughly ten months of runway.

Q2 spent the entire 5% ($23,409). Q3 funded five projects at $17,452 upfront. The current rules (top 50%, 1/5 max, 3/4 cap, 10% community stables) are hard to explain and still spend the whole pot.

This update keeps the pot tied to treasury health, cuts the rate once, funds fewer teams at a known grant size, and stops paying community contributions in USDC.

---

## What this quarter would have looked like

3% of official liquid AUM is $9,836, rounded to **$10,000**. Grant cap is **$2,500**. Applied to the Q3 Member Vote ranking:

| Rank | Project | Ask | Grant |
|---|---|---:|---:|
| 1 | MDP-260 Vacuum Chamber | $4,640 | $2,500 |
| 2 | MDP-265 NASA Lunar Base Model | $1,100 | $1,100 |
| 3 | MDP-259 Mission Cosmic Colombia | $2,430 | $2,430 |
| — | MDP-262 FUTURA, MDP-258 Satellite | $4,600 / $4,682 | not funded |

Grants paid: **$6,030**. Unused grant room ($1,470) plus the reserved ¼ ($2,500) → **$3,970 retro**. Total stables: **$10,000**, versus ~$24,310 today.

| | v8.0 today | This proposal |
|---|---:|---:|
| Pot / quarter | $24,310 | $10,000 |
| Community USDC | $2,431 | $0 |
| Projects / year | $97,240 | $40,000 |
| Net burn / month (finance overview stack) | $32,461 | $27,691 |
| Runway on official AUM | 10.1 months | 11.8 months |

If official liquid AUM doubles later, the pot doubles. No new proposal is required.

---

## Edge rules

- If fewer than three proposals pass the Senate, fund all of them. Unissued ¼-slices go to retro.
- A tie for third is broken by the Senate.
- Retro is paid to the prior quarter’s completed, Executive-Branch-approved projects. Members allocate 100% of that retro pool (there is no 10% community carve-out of USDC).
- Asks above ¼ of the pot should use the launchpad, or a later quarterly milestone.
- There is no mid-quarter budget increase.

---

## Proposed replacements in Project System v8.0 → v9.0

**Version header.** `MoonDAO Projects v8.0` → `MoonDAO Projects v9.0`.

**Step 2 (Proposal Submission).** Replace the 1/5 budget sentence with:

> A winning project receives a grant of **min(the amount requested in the proposal, ¼ of that quarter’s project pot)**. State a requested amount in the proposal. Requests above ¼ of the pot will be capped if the project is funded. If you need more than the cap, use the launchpad or propose a later quarterly milestone.

**Step 5 (Member House Vote).** Replace the top-50% / 3/4 paragraph with:

> Each voter allocates their voting power between Senate-approved proposals on a percentage basis. **The three proposals with the highest voting-power share are funded.** Each receives **min(its requested amount, ¼ of the quarterly project pot)**. If fewer than three proposals are considered, all of them are funded and any unissued ¼-slices are added to the retroactive pool. A tie for third is broken by the Senate. Project contributors must abstain from voting on their own project.

**Quarterly Rewards — stablecoin formula.** Replace the “5% of NMA minus project budgets” paragraph and the 10% Contributor Circle USDC carve-out with:

> Each quarter the project pot is **3% of official liquid AUM** (designated treasury Safes plus the WETH side of the Uniswap V3 LP; exclude MOONEY), priced at midnight UTC on the first day of the quarter, **rounded to the nearest $500**. The 3% rate does not change unless this document is amended.
>
> That pot is split as follows:
> - **Project grants.** The three funded projects each receive min(their ask, ¼ of the pot) at the start of the quarter.
> - **Retroactive rewards.** The remaining ¼ of the pot, plus any unused grant room, is allocated by Citizens and Voting Members among completed projects whose final reports the Executive Branch approved.
>
> The Contributor Circle does not receive stablecoins. Community contributions are rewarded in vMOONEY only.

**Project Reward Calculation.** Delete “We multiply by 0.9 because 10% of the total rewards always goes to the Contributor Circle.” Retro is 100% of the retro pool.

**vMOONEY series.** Unchanged.

**FAQs.**

- *How much can I ask for?* Up to ¼ of that quarter’s pot. Winners receive min(their ask, that cap). More than the cap → launchpad or a later milestone.
- *What if a project requires a budget increase?* It does not. Re-propose next quarter or use the launchpad.
- *What if my project will take multiple quarters?* Still fine as separate quarterly milestones. Each funded quarter is its own grant, not a custom multi-quarter envelope.

---

## Implementation

If this proposal passes, the Executive Branch will:

1. Publish Project System v9.0 on docs.moondao.com.
2. Set the next cycle’s `budgetUSD` to 3% of that quarter’s official liquid AUM, rounded to the nearest $500.
3. Fund the top three Member Vote projects at `min(ask, pot / 4)`.
4. Put unused grant room plus ¼ of the pot into the retroactive USDC pool.
5. Stop paying the Contributor Circle in USDC.

No treasury transaction is required to pass this proposal. The next quarterly cycle executes under the new rules.
