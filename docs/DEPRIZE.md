# Overview Prize Design Doc

**Status:** Draft proposal — partially implemented (M1–M3 built; see §Implementation status)
**Owner:** pmoncada
**Last updated:** 2026-06-05 (v2.2 — reconciled with the as-built M1–M3 implementation: market layer is CTF + `LMSRWithTWAP`, not Uniswap v4 LP)

---

> Internally, the system described here is called "DePrize." This document is titled "Overview Prize" to reflect its tight coupling with the `$OVERVIEW` token and the existing Overview Effect Flight mission. The two names refer to the same mechanism.

> **Implementation note (2026-06-05).** Milestones 1–3 are built and tested. During implementation the market layer changed from the speculative "per-team Uniswap v4 pools + treasury-as-LP + `DePrizeFeeHook`" design to **reusing MoonDAO's existing Gnosis Conditional Tokens (CTF) + `LMSRWithTWAP` prediction-market stack**, with the **1% fee implemented as the LMSR market-maker's built-in `fee` parameter** rather than a Uniswap swap-fee hook. Sections that still describe the Uniswap/LP model are kept for design-rationale history and are flagged inline; the authoritative as-built description is in [Part III §Implementation status](#implementation-status-as-built) and the per-milestone docs [`DEPRIZE_M1.md`](./DEPRIZE_M1.md), [`DEPRIZE_M2.md`](./DEPRIZE_M2.md), [`DEPRIZE_M3.md`](./DEPRIZE_M3.md).

## Reading guide

This doc is structured for three audiences. Pick your path:

| If you are... | Read |
|---|---|
| **A stakeholder / community member** wanting to understand the proposal | Background, Executive Summary, Part I (How it works), Part II (Why this design), Part IV (Risks) |
| **A `$OVERVIEW` holder** preparing to vote | All of the above plus Part III §Holder vote and §Unified DePrize mechanism |
| **An engineer / reviewer** evaluating the technical design | The full doc (Parts I–VII), plus Appendices E–J for worked examples and code stubs |

Appendices A–D cover decision rationale (alternatives, glossary, cuts). Appendices E–J contain the worked examples, full UX flows, LP economics deep dive, contract code, dilution math, and migration sequence — moved out of the main body to keep it readable.

## Background: the Overview Effect Flight

The first DePrize is a continuation of the **Overview Effect Flight** campaign, MoonDAO's effort to send Frank White (author of "The Overview Effect," 40 years of astronaut interviews) to space alongside one selected community Candidate. The original Juicebox launchpad ran March 12 – April 27, 2026 and raised ~$172k from 157 contributions against a 965 ETH (~$2M) Campaign Goal. The campaign is currently in its 30-day post-end carrier negotiation phase.

The Overview Effect Flight Terms (https://docs.moondao.com/Legal/Overview-Effect-Flight/Overview-Effect-Flight-Terms-and-Conditions) already define:

- **Campaign Goal**: 965 ETH (≈$2M) for two suborbital seats (Frank + Candidate).
- **Milestone Goals** (aspirational, not binding): 25% = 2 stratospheric balloon tickets; 50% = 1 suborbital seat for Frank; 100% = 2 suborbital seats; >100% = orbital/stretch options via `$OVERVIEW` governance.
- **Existing fund split (per Terms Section 4.2)**: 90% to the Organizing Entity multisig (William Frank White LLC), 2.5% MoonDAO treasury, 2.5% Juicebox protocol, 5% retained on-chain for token liquidity. **However: no payouts have been made yet.** The full ~$172k raised is still sitting in the Juicebox launchpad contract awaiting carrier negotiation outcome. This means the entire ~$172k is available as the DePrize seed prize pool if Option 1 wins.
- **`$OVERVIEW` issuance rate**: 1,000 `$OVERVIEW` per 1 ETH contributed.
- **Candidate selection process**: a four-round merit-based process (see §Candidate selection below) culminating in a `$vMOONEY` quadratic governance vote.
- **Refund mechanism**: 30-day post-close carrier negotiation; if unsuccessful, a refund payhook activates and `$OVERVIEW` can be burned for pro-rata ETH for 28 days.
- **Frank-can't-fly contingency** (Section 8.3): `$OVERVIEW` governance vote on partial refund / replacement ambassador / candidate-only flight.

DePrize **builds on top of** this campaign: new bets get a different fund split (5% slice + 1% swap fee), the prize pool keeps growing, providers compete on capability + budget, but existing `$OVERVIEW` holders and the existing JB project are preserved. The Candidate selection process is reused as-is.

## Executive summary

DePrize lets the MoonDAO community bet on which of several competing providers will win the right to fly Frank White to space with a community-selected Candidate. Bettors put in ETH, back the provider they think will win, and live on-chain odds emerge from their trades. When the MoonDAO Senate declares a winner, people who backed the winning provider take ETH from people who backed losing providers. The winning provider receives the prize pool in milestones tied to delivery — partial release on capability demonstration, full release after Frank and the Candidate actually fly.

The recommended design is a **simplified ETH-based prediction market** with two key MoonDAO-specific properties:

1. **Every bet routes 5% to the launchpad prize pool**, growing the prize alongside betting interest. Bettors receive `$OVERVIEW` (the mission's project token) as a receipt for this contribution.
2. **A small trade fee (1%)** on every trade underwrites the market maker that provides live odds and liquidity.

Bettors interact in ETH end-to-end. `$OVERVIEW` exists as a participation receipt with downstream utility but isn't required to think about. The as-built market layer reuses MoonDAO's existing Gnosis CTF + `LMSRWithTWAP` stack; the new on-chain surface is three small contracts (`DePrizeRegistry`, registry-aware `LaunchPadPayHook`, `DePrizeMint`), with resolution/redemption/escrow planned for later milestones.

**Whether the first DePrize launches on the Overview Effect Flight depends on a 3-way vote of existing `$OVERVIEW` holders.** The community will choose between:

1. **Evolve to a unified DePrize** — Virgin Galactic, Zephalto, and a third unnamed provider all compete on two axes: (a) capability demonstration, and (b) their quoted price for two seats must be ≤ the prize pool at settlement. The prize pool keeps growing from betting activity, potentially unlocking higher-tier providers (Zephalto 2-seat at ~$390k, Virgin Galactic 2-seat at ~$1.5M).
2. **Direct purchase from Zephalto now** — admin Safe places the 20% deposit (~$72k for two seats) with Zephalto immediately, runs a follow-up fundraise to close the gap to €360k, Frank + Candidate fly on Zephalto's schedule.
3. **Refunds** — `$OVERVIEW` holders redeem for pro-rata ETH per the existing refund payhook.

DePrize launches on the Overview Effect Flight only if option 1 wins. Details in [Part III §Holder vote](#the-holder-vote-1-vs-2-vs-3) and [§Unified DePrize mechanism](#unified-deprize-mechanism-capability--budget-thresholds). If option 2 or 3 wins, DePrize remains a reusable MoonDAO mechanism for future missions.

This document is structured for two audiences:

- **Bettors and stakeholders** should read Part I (plain English with worked examples).
- **Engineers** should also read Parts III (technical), IV (risks), V (future enhancements), and VI (open questions).

The full architecture trade-off analysis is in Appendices A (decision matrix) and B (alternatives considered). Appendix D documents what was deleted from earlier drafts and why.

---

# Part I — How it works (plain English)

## The problem

We've raised real ETH for the Frank-to-space launchpad, but we don't know which delivery partner can actually pull it off. Multiple stratospheric balloon companies are interested; none have done it before. We want:

1. The community can **fund the prize** without committing it to a specific team upfront.
2. People can **bet on which team will win**, with live on-chain odds.
3. A way to **declare a winner** that the community trusts.
4. Bettors can **enter and exit** their positions as new information arrives.
5. The prize pool **grows with activity**, not just from one-time contributions.

## The bettor's journey, end to end

The full path a participant takes:

| # | Step | What the bettor does | What they see |
|---|---|---|---|
| 1 | **Discover** | Reads about Frank-to-space DePrize via Twitter, Discord, or moondao.com | A landing page with the prize, the teams, and current odds |
| 2 | **Browse** | Visits the DePrize page | Three team cards with live ETH-denominated odds (e.g. Stratos 40%, Helios 40%, Aurora 20%) |
| 3 | **Decide** | Picks a team they believe in | "Back Stratos" button highlighted |
| 4 | **Connect** | Connects wallet via Privy | Wallet address displayed |
| 5 | **Bet** | Enters ETH amount, clicks "Back Stratos" | Modal shows: "You'll pay 1 ETH. You'll receive ~2.32 winning tokens. Max payout if Stratos wins: ~2.32 ETH. You'll also receive 50 `$OVERVIEW` (loyalty receipt)." |
| 6 | **Confirm** | Signs transaction in wallet | Confirmation: "Bet placed. Track your position on the My Bets page." |
| 7 | **Wait** | Periodically checks the market | Live odds shift as news arrives. Position value updates in real time. |
| 8 | **(Optional) Exit** | Decides to sell mid-campaign | "Exit" button: "Sell your 2.32 Stratos tokens for ~0.95 ETH at current market price?" |
| 9 | **Settlement** | Senate votes after the race ends | "Stratos won! Click to claim your winnings." |
| 10 | **Claim** | One-click claim button | Wallet receives 2.32 ETH |

Active decisions for the bettor: choose team, choose amount, click bet, optionally exit, click claim. Five clicks total for the simplest path.

## Two pools, one mechanism

A subtle but important point: **bettors and providers are paid from different pools.**

- **The prize pool** (the JB project balance) is paid to the **winning provider** at settlement. This is what funds the actual Frank + Candidate flight. It grows from the 5% primary-mint slices and direct contributions. (As built, the 1% LMSR trade fee accrues inside the market and is recovered by the treasury at unwind, rather than flowing into the prize pool via a separate `DePrizePrizeEscrow`.)
- **The CTF collateral pool** (Gnosis ConditionalTokens) is paid to **winning bettors** via parimutuel redemption. It comes from the 95% of every bet that goes into CTF. Bettors win from other bettors' losses.

Practical implications for bettors:

| If you bet 1 ETH at 40% odds on the winning provider… |
|---|
| You receive ~2.32 ETH from the CTF collateral pool (your gain comes from losing bettors on other providers). |
| You do NOT directly receive a share of the prize pool. The prize pool goes to the provider. |
| Watching the prize pool grow is exciting (it unlocks higher-tier providers), but your maximum payout per bet is bounded by other bettors' losses, not by the prize size. |
| The 1% LMSR trade fee you pay is retained by the treasury-seeded market maker (it underwrites liquidity and is recovered at unwind), not paid to you directly. |

This two-pool structure is essential to keep clean. If bettors and providers were paid from the same pool, the math breaks down (winners would need to fund both the next provider's mission AND each other's parimutuel payouts, which is impossible). The two-pool model is standard for prediction markets that fund external prizes.

## How a bet plays out (summary)

Four scenarios at a glance. Setup: 100 ETH prize pool, three teams at equilibrium prices Stratos = Helios = 0.40, Aurora = 0.20. 1% LMSR trade fee. Team names illustrative; real providers are Virgin / Zephalto / third provider.

| Scenario | Outcome | Bettor net |
|---|---|---|
| Alice bets 1 ETH on Stratos. **Stratos wins.** | Receives ~2.32 ETH from CTF parimutuel + 50 `$OVERVIEW`. | **+1.32 ETH** (plus `$OVERVIEW` value) |
| Bob bets 1 ETH on Helios. **Helios loses.** | Helios_YES worthless. Holds 50 `$OVERVIEW`. | **−1.0 ETH** (plus `$OVERVIEW` value) |
| Carol bets 1 ETH on Aurora at 0.20, exits when price drops to 0.05. | Sells ~4.62 Aurora_YES → ~0.226 ETH + 50 `$OVERVIEW`. | **−0.77 ETH** |
| Cancellation: Senate declares "no winner." | CTF pays 1/N per token + JB cashOut activates per Overview Effect Terms Section 8. | Concentrated bettors recover **~80–95%**; balanced bettors recover **100%**. |

Cancellation loss for concentrated bettors is mathematically unavoidable with CTF parimutuel once secondary trading happens — disclosed in UI before any bet.

→ See [Appendix E](#appendix-e--worked-examples-full-money-tracking) for the full money-tracking tables showing every fee split, every token transfer, and the underlying parimutuel pool math.

## Is this a good deal for bettors? (Honest EV analysis)

Comparison of effective house edge for a 1 ETH bet at 40% market-implied odds:

| Option | House edge | EV vs ETH-only | Notes |
|---|---|---|---|
| **Do nothing** (hold ETH) | 0% | 0% (baseline) | No upside, no downside, no mission contribution |
| Fair coin flip | 0% | 0% | Theoretical betting baseline |
| Polymarket | ~0.2% | −0.2% per bet | LP fee only, no protocol take |
| **DePrize (assuming `$OVERVIEW` worthless)** | **~7%** | **−7% per bet** | If mission completely fails |
| **DePrize (`$OVERVIEW` recovers 50%)** | **~4%** | −4% per bet | Modest mission success |
| **DePrize (`$OVERVIEW` recovers 100%)** | **~1.5%** | −1.5% per bet | Strong mission success |
| **DePrize (`$OVERVIEW` recovers 200%)** | **~+3% (positive EV!)** | +3% per bet | Strong post-mission token appreciation |
| Sportsbook (mainstream) | 5–10% | −5–10% per bet | Standard vig |
| Lottery | 30–50% | −30–50% per bet | Worst common gambling |

**For a pure profit-seeking Polymarket native:** DePrize is slightly negative EV unless they value `$OVERVIEW` exposure. Competitive enough that some Polymarket bettors may still participate if the odds are mispriced.

**For a community member who cares about Frank reaching space:** DePrize is approximately break-even because the friction includes a small contribution to a cause they value plus `$OVERVIEW` exposure tied to mission success. The 1.5–7% edge is comparable to low-vig sportsbooks.

**For an arbitrageur seeing genuinely mispriced odds:** positive EV if the mispricing is >7%. Standard sophisticated bettor math.

**For a holder who just wants exposure to `$OVERVIEW` upside:** primary minting is the cheapest way to acquire `$OVERVIEW` post-launch (50 `$OVERVIEW` per ETH at 5% slice = 0.001 ETH per `$OVERVIEW`). If you believe `$OVERVIEW` will trade above this floor post-mission, betting on any team is positive EV — the bet itself is the cost of acquiring discounted tokens.

**Doing nothing is a real option.** For most people, holding ETH and not participating is a perfectly rational choice. DePrize must compete with "do nothing" not just with Polymarket. The honest pitch: if you care about the mission, the friction is low enough to participate; if you don't care, this isn't the prediction market for you.

### The honest positioning

DePrize is a prediction market for people who care about the mission. If you only want the absolute best odds, go to Polymarket. If you want to back a team you believe in AND have skin in the game on the prize pool itself, DePrize is for you. You'll pay sportsbook-grade vig (or better, if `$OVERVIEW` retains value) in exchange for funding the prize and getting `$OVERVIEW` exposure.

This is more defensible than pretending DePrize is competitive with Polymarket on pure EV. Positive-sum dynamics ("your bet helps fund the prize") resonate with the right audience.

## UX principles

The mechanics are complex. The UI must hide that complexity from anyone who doesn't want to learn it. Core principles:

- **Single primary button** at every decision point. Advanced settings disclosed only on demand.
- **Plain English for outcomes**, not jargon. "If Virgin wins" not "if Virgin_YES token resolves to 1." Show odds as a single percentage, not as a token price.
- **`$OVERVIEW` as a receipt, not a primary asset.** Visible but not central. Most bettors won't engage with it directly.
- **Milestone escrow is invisible to bettors.** Bettors see "you won, claim X ETH" at M1; M1/M2 distinction only matters for the winning provider.
- **Candidate pledging is separate** from betting (different mental model). Clear visual separation.
- **Cancellation losses disclosed upfront.** Refund estimate shown on every bet preview.

→ See [Appendix F](#appendix-f--ux-flows-end-to-end) for end-to-end flows (bet placement, browse, position management, exit, claim, cancellation refund, Candidate pledging), MVP-cut analysis, and cognitive-load lessons from walking the flows.

## What `$OVERVIEW` does

`$OVERVIEW` is the mission's project token. The right way to think about it: **`$OVERVIEW` is a participation receipt with downstream utility — it's a bonus, not the primary thing your bet is buying.** Your bet primarily buys outcome tokens (your stake in the prediction market). The `$OVERVIEW` you receive is a small additional allocation tied to the prize-pool contribution portion of your bet.

Bettors receive 50 `$OVERVIEW` per ETH bet (from the 5% slice flowing through Juicebox). What it does for the holder:

1. **Voting rights** in `$OVERVIEW` governance — including the 3-way migration vote and any post-settlement governance votes per Overview Effect Terms.
2. **CashOut floor at cancellation.** If the DePrize cancels, `$OVERVIEW` can be redeemed pro-rata for ETH from the JB project. During the active campaign, cashOut is gated (off) to prevent bettors from extracting their 5% slice as an exploit.
3. **Post-mission market value.** After the mission completes, the existing launchpad's `PoolDeployer` creates a `$OVERVIEW/ETH` Uniswap pool. `$OVERVIEW` then trades against ETH at whatever market value emerges from the team's post-mission performance.
4. **Standard launchpad benefits.** Whatever utility the team builds around `$OVERVIEW` post-mission (governance, perks, drops, etc.) — same as any other launchpad mission.

A bettor doesn't need to do anything with `$OVERVIEW` to benefit. It sits in their wallet. They can sell it post-mission for ETH or hold it for utility.

### About the "20× rate difference" vs original launchpad contributors

Existing pre-DePrize contributors received 1,000 `$OVERVIEW` per ETH; new DePrize bettors receive 50 `$OVERVIEW` per ETH. This sounds like a 20× disparity but it's an artifact of comparing two different products:

- **Pre-DePrize contributors paid 100% of their ETH to fund the mission.** They received the full launchpad token allocation as compensation. Their "yield" comes from the mission succeeding (`$OVERVIEW` retaining value post-mission).
- **DePrize bettors pay 5% of their bet to the prize, 95% to the prediction market.** They receive 5%'s worth of launchpad token allocation (which is exactly 1/20th the rate) PLUS parimutuel upside on the 95% that's in the prediction market.

It's not "DePrize bettors get a worse deal." It's "DePrize bettors get a different deal." A bettor putting 1 ETH on the eventual winner at 40% odds can take home ~2.32 ETH from the parimutuel — a return profile that doesn't exist for pre-DePrize contributors. The 50 `$OVERVIEW` is a small bonus on top.

Communicating this clearly is a UI responsibility. The bet preview should foreground the parimutuel payout and treat `$OVERVIEW` as a secondary receipt.

---

# Part II — Why this design

A more elaborate version was originally proposed with mechanisms inspired by Revnet (exit tax, boost vault, staking) and Uniswap v4 (dynamic fees, TWAP settlement). After applying Occam's razor (see Appendix D), those mechanisms were cut because each added complexity without sufficient value.

A formal decision matrix comparing four alternatives across 11 criteria and 3 weighting schemes is in Appendix A. The chosen design wins outright in 2 of 3 schemes and finishes 2nd in the third, with the best average rank (1.3 of 4).

The alternatives considered (and why they fall short):

- **Pure ETH market without the 1% swap fee** (Option A in Appendix A): Simpler, but the prize pool only grows from one-time primary contributions. Loses the "betting volume grows the prize" property.
- **`$OVERVIEW`-as-collateral market** (Option B): Maximum prize efficiency (100% to prize) but compounded volatility, two-hop exit, and higher contract surface. Lost on 3 of 4 criteria scored.
- **USDC market** (Option C): Best public legibility but introduces Circle as a centralized counterparty and weakens MoonDAO's ETH-native culture fit. Reasonable for a general prediction market product separate from MoonDAO.

---

# Part III — Technical deep dive

## Implementation status (as-built)

Milestones 1–3 are implemented and tested in `subscription-contracts/src/deprize/` (Foundry, Solidity `0.8.20`). The single most important deviation from the original draft below: **the market layer reuses MoonDAO's existing Gnosis CTF + `LMSRWithTWAP` stack instead of building per-team Uniswap v4 pools with the treasury as LP.** This deleted several planned contracts (`DePrizeFeeHook`, `DePrizePrizeEscrow`) — the 1% fee is now the LMSR market-maker's built-in `fee` parameter (`1e16`).

| Component | Plan (original draft) | As built | Status |
|---|---|---|---|
| Lifecycle state machine | `DePrizeRegistry` | `DePrizeRegistry` (UUPS, `Ownable`) | **M1 ✅** |
| Refund/cashout gating | Registry-aware `LaunchPadPayHook` | `LaunchPadPayHook` reads `registry` via write-once optional pointer | **M2 ✅** |
| Bet entry point | `DePrizeMint` → split CTF + route via Uniswap pools | `DePrizeMint` → split 5% to JB, 95% → WETH → `LMSRWithTWAP.trade()` | **M3 ✅** |
| Market maker / liquidity | Per-team Uniswap v4 pools, treasury-as-LP | One Gnosis CTF condition + one `LMSRWithTWAP` market per DePrize (external Solidity `0.5` deployments, treasury-seeded) | **Reused (external)** |
| Swap/protocol fee | `DePrizeFeeHook` (1% LP + 1% protocol) | LMSR built-in `fee = 1e16` (1%), retained by the market | **Superseded** |
| Winner reporting | `DePrizeReporter` → `CTF.reportPayouts` | not yet built | **M4 (planned)** |
| Winner redemption | `CTF.redeemPositions` wrapper | not yet built | **M4 (planned)** |
| Milestone prize escrow | `DePrizeMilestoneEscrow` (30/70) | **No escrow contract** — the mission's JB payout splits are permanently locked, so an escrow can't be a beneficiary. The prize lands in the admin Safe (the locked ~90% payout) and is disbursed 30/70 via Safe tx; `DePrizeDisburse.s.sol` builds the calldata and the registry records the provider payout address | **M5 ✅ (Safe runbook)** |
| Unified refund (`refundAll`) | `DePrizeRefund` | not yet built | **M4 (planned)** |

The Senate-reporting bridge, CTF redemption, and unified refund (M4) are **design intent, in review separately**. The milestone-based prize disbursement (M5) shipped as a **Safe-operated runbook + tooling, not an escrow contract** — the mission's locked JB payout splits make an escrow-as-beneficiary impossible, and the prize already lands in the admin Safe (the trust anchor); the 30/70 release and the `M2_FAILED → addToBalanceOf` refund are Safe transactions built by `DePrizeDisburse.s.sol`, with the provider payout address recorded on-chain in the registry. See [`DEPRIZE_M1.md`](./DEPRIZE_M1.md)/[`M2`](./DEPRIZE_M2.md)/[`M3`](./DEPRIZE_M3.md)/[`M5`](./DEPRIZE_M5.md) for what exists today.

## State machine

The implemented `DePrizeRegistry` (M1) uses the following states. Note two refinements over the earlier draft: an explicit **`SETTLED`** state (winner declared, before the M1 prize release) and a distinct **`NO_WINNER`** terminal separate from `CANCELLED`.

| From | To | Trigger |
|---|---|---|
| `NONE` | `DRAFT` | `register(jbProjectId, teamIds, sunset)` |
| `DRAFT` | `OPEN` | `open()` — requires CTF condition set and future sunset |
| `OPEN` | `LOCKED` | `lock()` (deadline elapsed or admin lock) |
| `LOCKED` | `VOTING` | `startVote()` — Senate winner proposal created |
| `LOCKED` / `VOTING` | `SETTLED` | `settleWinner(teamId)` — winner declared (capability demonstrated) |
| `LOCKED` / `VOTING` | `NO_WINNER` | `settleNoWinner()` — vote failed / no eligible winner (refundable) |
| `SETTLED` | `M1_RELEASED` | `releaseM1()` — 30% of prize disbursed to winning provider |
| `M1_RELEASED` | `M2_COMPLETE` | `completeM2()` — Frank + Candidate flown; remaining 70% disbursed |
| `M1_RELEASED` | `M2_FAILED` | `failM2()` — 18 months elapsed without flight (refundable) |
| any non-terminal | `CANCELLED` | `cancel()` — only after a 7-day public notice window (refundable) |

Refundable terminals: `CANCELLED`, `NO_WINNER`, `M2_FAILED`. Success terminal: `M2_COMPLETE`. `bettingOpen` is true only in `OPEN` and is forced false the moment a cancellation notice is announced. Bettor payouts (CTF redemption, M4) happen at `SETTLED`/`M1_RELEASED` — bettors do NOT wait until M2; only the provider's prize disbursement is split across milestones. See §Two pools, one mechanism in Part I.

## Shared infrastructure (exists, reused)

| System | Role | Status |
|---|---|---|
| Juicebox V5 + `MissionCreator` | Prize pool custody, `$OVERVIEW` issuance | Exists |
| Gnosis ConditionalTokens (CTF) | Outcome token accounting, settlement | **Reused as built.** Externally-deployed Solidity `0.5.x` contract; the `0.8` router calls it via `IConditionalTokens`. Testnet deployments already exist (`ui/const/config.ts` → `CONDITIONAL_TOKEN_ADDRESSES`). |
| `LMSRWithTWAP` market maker | Per-DePrize AMM / live odds / liquidity | **Reused as built.** MoonDAO's existing `prediction/` LMSR variant (Solidity `0.5.x`), one market per DePrize, treasury-seeded; called via `ILMSRWithTWAP`. Replaces the planned Uniswap v4 pools. |
| ~~Uniswap v4 + `PoolDeployer`~~ | ~~Per-team pool creation~~ | **Superseded** by CTF + `LMSRWithTWAP` (see §Implementation status). |
| `Proposals.sol` + Senate | Winner declaration | Exists; small extension for discrete winner selection (M4) |
| MoonDAOTeam NFTs + Hats | Competitor identity & admin gating | Exists, unchanged |

## New contracts

As-built status shown. The CTF + `LMSRWithTWAP` decision (see §Implementation status) deleted `DePrizeFeeHook` and `DePrizePrizeEscrow` (the 1% fee is now the LMSR built-in `fee`, retained inside the market).

| Contract | Purpose | Status |
|---|---|---|
| `DePrizeRegistry` | Per-DePrize config: mission, competitors, deadlines, state machine | **Built (M1)** |
| `LaunchPadPayHook` (registry-aware) | Gate JB cashOut/contributions by DePrize state | **Built (M2)** |
| `DePrizeMint` | Entry point: takes ETH, routes 5% to JB, wraps 95% to WETH, buys outcome tokens on the `LMSRWithTWAP` market, forwards tokens + refunds leftover | **Built (M3)** |
| `DePrizeReporter` | Reads Senate result, calls `CTF.reportPayouts` | Planned (M4) |
| `DePrizeRedeem` / `DePrizeRefund` | Winner `redeemPositions`; unified cancellation refund (CTF collateral + `$OVERVIEW` floor) | Planned (M4) |
| ~~`DePrizeMilestoneEscrow`~~ | ~~Holds prize pool post-settlement; releases 30% at M1, 70% at M2~~ | **M5 — built without a contract.** JB payout splits are permanently locked (escrow can't be a beneficiary); prize lands in the admin Safe and is disbursed 30/70 by Safe tx (`DePrizeDisburse.s.sol`); `M2_FAILED` returns 70% to JB via `addToBalanceOf`; registry records `providerPayoutAddress` |
| ~~`DePrizePrizeEscrow`~~ | ~~Holds 1% swap fees during campaign~~ | **Deleted** — LMSR built-in fee |
| ~~`DePrizeFeeHook`~~ | ~~Uniswap v4 hook for LP + protocol fee~~ | **Deleted** — no Uniswap layer |

The market maker itself (`LMSRWithTWAP`) and `ConditionalTokens` are **reused external Solidity `0.5` deployments**, not new contracts in this repo — see §Shared infrastructure.

### Upgrade pattern

All new DePrize contracts are **upgradeable via OpenZeppelin's UUPS proxy pattern**, with upgrades gated by the MoonDAO Admin Safe (multi-sig). A 7-day upgrade timelock is the planned production target; **M1 (`DePrizeRegistry`) currently authorizes upgrades directly via `onlyOwner` with no timelock** — the timelocked upgrade path is a later milestone, so reviewers/operators should not assume a timelock is enforced yet.

**Rationale:**
- The DePrize is a multi-year-running contract suite holding meaningful prize pool ETH. Bug fixes during the campaign (without re-deploying and migrating user positions) are essential.
- UUPS is the modern standard, smaller proxy footprint than Transparent Proxy.
- The planned 7-day timelock gives bettors visibility into upgrades and time to exit if they object to a proposed change (not yet enforced in M1).
- Admin Safe is already the trust anchor for cancellation; reusing it for upgrades doesn't expand trust surface.

**Constraints on upgrades:**
- Cannot change storage layout in a non-compatible way (standard OZ upgrade rules).
- Cannot modify a settled DePrize's payout math (would invalidate bettor claims).
- Cancellation upgrade path: if a bug is discovered that requires emergency upgrade with <7 days, Admin Safe can also `pause` the DePrize (block new bets) and `cancel` (activate refunds) without waiting for the timelock. Recovery path: cancel + refund, then deploy v2.

**Audit scope must include the upgrade pattern itself**, not just the implementation.

### Auto-settle option (considered, rejected)

One simplification considered: skip the Senate winner vote entirely. Auto-settle to the highest-prestige eligible provider per the pre-committed preference order. This would remove ~200 LoC of Senate integration and eliminate the Senate quorum risk.

**Why rejected:**
- The Senate vote provides governance accountability — a public, on-chain record of MoonDAO's choice of winning provider. Auto-settle hides this in code.
- The Eligibility Review Committee memo provides technical input but the Senate vote is the political authority. Both should exist.
- Senate vote infrastructure is already in place (`Proposals.sol`); the marginal cost of including it is low.
- Auto-settle would make capability evidence judgment purely formulaic, which it isn't (edge cases need human review).
- The Senate vote also provides a natural "no winner" escape hatch that auto-settle would have to replicate with additional logic.

Kept the Senate vote. The simplification savings weren't worth the loss of accountability.

## The bet, in code

As built (M3), `DePrizeMint.bet(deprizeId, outcomeIndex, outcomeTokenAmount, maxCost)`:

1. requires `registry.bettingOpen(deprizeId)`;
2. splits `msg.value` into a 5% slice and 95% budget;
3. pays the slice into the DePrize's JB project with the bettor as beneficiary (mints `$OVERVIEW`);
4. prices the trade on the LMSR market: `cost = market.calcNetCost(amounts) + market.calcMarketFee(net)` (the Gnosis `MarketMaker.trade` pulls `netCost + fee`, so `calcNetCost` **excludes** the 1% fee), and reverts if `cost > budget || cost > maxCost`;
5. wraps `cost` to WETH, approves the market, calls `market.updateCumulativeTWAP()` then `market.trade()` **directly** (not `tradeWithTWAP`, which self-calls and would make the market the trader);
6. captures the minted ERC-1155 outcome tokens via the receiver hooks, forwards them to the bettor, and refunds any leftover ETH.

There is no Uniswap swap and no separate fee hook — the 1% fee is charged inside the LMSR market. `outcomeIndex` is the team's position in `registry.teamIds(deprizeId)`.

→ See [Appendix H](#appendix-h--contract-code-stubs) for the Solidity stub and [`DEPRIZE_M3.md`](./DEPRIZE_M3.md) for the full flow, money-conservation invariant, and tests.

## Settlement (with milestone-based prize escrow)

The prize pool is released to the winning provider in **two milestones** to align incentives with actual delivery, not just capability demonstration.

| Milestone | Trigger | Release |
|---|---|---|
| **M1: Capability demonstrated** | Senate vote confirms winner's evidence | 30% of prize pool |
| **M2: Mission delivered** | Frank + Candidate have actually flown (verified by flight records, photos, third-party attestation) | 70% of prize pool |

The 30/70 split means a winning provider has meaningful liquid funds at demonstration (e.g., ~$66k at a $220k Scenario A pool, ~$150k at a $500k Scenario B pool, ~$600k at a $2M Scenario C pool — covers operational expenses, training prep, immediate work) but the majority of the prize is contingent on actually flying Frank. This addresses the "provider walks away after winning the prize" gap.

**M1 — Winner declared (capability demonstrated):**

1. Senate vote concludes.
2. Anyone calls `DePrizeReporter.report(deprizeId)`. Reporter reads Senate result and calls `CTF.reportPayouts(condition, [1, 0, 0, ...])`.
3. `DePrizeMilestoneEscrow.releaseM1(deprizeId)` releases 30% of the prize pool (JB + PrizeEscrow combined) to the winning provider's Safe.
4. The remaining 70% stays in `DePrizeMilestoneEscrow` pending M2.
5. Winning bettors call `CTF.redeemPositions` → receive ETH. (Bettor payouts are NOT subject to milestone timing — bettors are paid in full at M1 because the CTF parimutuel is a separate pool, see Part I §Two pools.)

**M2 — Mission delivered (Frank + Candidate flown):**

1. After the flight, the provider submits delivery evidence (flight records, photos, third-party attestation) to IPFS.
2. Senate votes on M2 release (simpler vote: "did the mission deliver?" Yes / No).
3. If Yes: `DePrizeMilestoneEscrow.releaseM2(deprizeId)` releases the remaining 70% to the winning provider's Safe.
4. If No or deadline missed (default: 18 months after M1): remaining 70% returns to MoonDAO treasury, available for re-allocation by `$OVERVIEW` holder vote (alternative ambassador, candidate-only flight per existing Section 8.3, partial refund pool, etc.).

**M2 deadline:** 18 months after M1 release. Provider can request one 6-month extension via Senate vote (e.g., regulatory delays, weather windows).

**Why 30/70 and not, e.g., 50/50?** A provider needs enough liquid funds at M1 to do real prep work (insurance, training, hardware acquisition, regulatory filings) but the bulk of incentive must be tied to delivery. 30% covers reasonable prep; 70% is the carrot.

**Cancellation override:** if the DePrize is cancelled before M1 (e.g., no provider qualifies at sunset, or `$OVERVIEW` holder vote to cancel), the milestone escrow returns all funds to JB for standard refund flow. No milestone releases occur.

**No-winner declared:**

1. Reporter calls `CTF.reportPayouts(condition, [1, 1, 1, ...])` (each token type pays 1/N).
2. `DePrizeMilestoneEscrow.refundToJB(deprizeId)` returns escrow ETH to JB project, raising `$OVERVIEW` cashOut value.
3. JB refund payhook activates per existing Overview Effect Terms Section 8 (28-day refund claim window after activation).
4. Bettors call `DePrizeRefund.refundAll(deprizeId)`: redeems all outcome tokens for ETH + burns `$OVERVIEW` for JB cashOut → all converted to ETH and returned to bettor.

## `$OVERVIEW` cashOut: gated

`$OVERVIEW` cashOut is gated to prevent the 5% slice from being trivially extracted:

| DePrize state | JB cashOut |
|---|---|
| `DRAFT`, `OPEN`, `LOCKED`, `VOTING`, `M1_RELEASED` | Disabled (cash-out tax = 100%) |
| `CANCELLED`, `NO_WINNER`, `M2_FAILED` | Enabled (cash-out tax = 0%, linear pro-rata) |
| `M2_COMPLETE` (post-mission) | Enabled per standard launchpad rules |

During the active campaign, `$OVERVIEW` is still tradeable on whatever Uniswap pools exist (initially none in this simplified design; the existing launchpad `PoolDeployer` creates the `$OVERVIEW/ETH` pool only after mission completion).

## Senate vote integration

The existing `Proposals.sol` is extended with a small interface for discrete winner selection:

```solidity
function createDePrizeWinnerProposal(
    uint256 deprizeId,
    uint256[] calldata candidateTeamIds
) external returns (uint256 proposalId);

function outcomeOf(uint256 proposalId)
    external view returns (uint256 winningTeamId, bool isNoWinner);
```

The proposal includes a "no winner" option. Voting uses standard vMOONEY weight (no special `$OVERVIEW` bonus weight — that was cut as a flourish). Plurality wins, with a configurable minimum quorum. If quorum is not met, default to "no winner."

## Candidate selection (reuses existing process)

The community-selected Candidate who flies with Frank is determined by the **existing 4-round Selection Process** defined in the Overview Effect Flight Terms (Section 7), reused as-is — but with **revised timing** to run in parallel with DePrize betting rather than serially after it.

| Round | Mechanism | Advancement | DePrize-era timing |
|---|---|---|---|
| 1 — Community Fundraising | `$OVERVIEW` token holders pledge tokens to a Candidate (votes don't burn tokens) | Top 25 Citizens advance | **Runs in parallel with DePrize betting**: opens at DePrize-open, closes 14 days before M1 (capability declaration). Keeps community engaged during the long betting campaign. |
| 2 — AI Evaluation | KYC + 1,000-word written essay on the Overview Effect, AI scored 1–10 across multiple criteria | Top 10 advance | After M1 (carrier known, so health/visa requirements are known). |
| 3 — Astronaut Committee Review | Video submission to committee of professional & commercial astronauts (1–10 ranking) | Top 5 advance | After Round 2. |
| 4 — Community Governance Vote | Public conversations + `$vMOONEY` staked quadratic vote per the MoonDAO Constitution | 1 winner | After Round 3, before M2. Winner is named at M2 release. |

**Why run Round 1 in parallel?** Per the original Terms, "Round 1 closes 14 days after a carrier is secured" — which under DePrize means 14 days after M1, i.e., ~12–18 months into the campaign. Running Round 1 in parallel from day 1 captures community engagement during the betting period: Citizens campaign for support, bettors who hold `$OVERVIEW` pledge to their preferred Candidate, leaderboards stay active. The pledge mechanism doesn't burn tokens, so it's safe to run before the carrier is confirmed. Terms amendment needed; tracked in §Still open.

DePrize does NOT introduce a new Candidate selection mechanism. The teams competing in DePrize are the **providers** (Virgin Galactic, Zephalto, third provider). The Candidate is a person who rides with Frank. Don't conflate.

Eligibility for Candidate (per Overview Effect Terms Section 6.2): MoonDAO Citizen, not Frank, not Executive Branch, not previously been to space, KYC at Round 2, valid passport, 18+, meets provider health requirements at flight time. Anyone who contributes $100+ to the DePrize can become a Citizen at no additional cost.

## Eligibility Review Committee

The Senate has political authority over the winner declaration, but Senate members aren't necessarily aerospace engineers. To bridge this gap, an **independent Eligibility Review Committee** publishes a non-binding eligibility memo before each Senate winner vote.

**Composition (default):** 5 members — 3 professional or commercial astronauts (drawn from the existing astronaut pool used in the Candidate Selection Process Round 3 + recruited as needed) and 2 aerospace engineers (independent of any registered DePrize provider). Approved by Senate vote at DePrize-open.

**Mandate:** for each provider whose evidence is being reviewed, publish a 1–3 page memo to IPFS that addresses:

- Did the provider's submitted evidence demonstrably meet each capability criterion?
- Are there any technical concerns about safety, mission profile feasibility, or fitness for Frank + Candidate?
- What's the committee's confidence (low / medium / high) that this provider can actually deliver the mission?

The memo is **non-binding**. Senate retains political authority over the winner declaration. But the memo provides:

- Public technical baseline for the Senate vote
- Defense against politically-motivated eligibility decisions
- Cover for honest Senate members who lack aerospace background
- Documented basis if the decision is later contested

**Disclosure:** committee members must disclose any commercial relationships with registered providers. Members with material conflicts recuse from that provider's review.

**Timing:** memos published at least 14 days before the Senate winner vote opens. Senate may request follow-up clarification during the vote period.

**Why not make it binding?** The Senate is MoonDAO's ultimate governance authority by constitution. Subordinating it to a technical committee would create governance ambiguity. Keeping the memo advisory preserves the constitutional structure while substantively improving decision quality.

## How Frank White and the Organizing Entity participate

Frank White is the central beneficiary of the mission and is also a **Senator in MoonDAO governance**. The Organizing Entity (William Frank White LLC) is the legal recipient of prize milestone disbursements.

**Frank's participation in DePrize design and operation:**

- Frank actively supports the mission via daily calls and is a current Senator.
- As a Senator, Frank has voting weight on the winner vote per standard `vMOONEY` rules. **Recommended: Frank discloses his Senate vote publicly** (or recuses) given his unique position as the mission's beneficiary. This is good practice rather than a strict rule.
- Frank has informal but real influence on the 3-way holder vote messaging and the migration timeline; the Organizing Entity must consent to Option 1 (the prize structure) and Option 2 (direct Zephalto purchase) before the holder vote can authorize either.

**Organizing Entity (William Frank White LLC) participation:**

- Signs carrier contracts with whichever provider wins (or, in Option 2, with Zephalto directly).
- Receives M1 and M2 milestone disbursements.
- Provides periodic transparency reports per Terms Section 10.
- Coordinates KYC, visa, medical clearances for Frank and the selected Candidate.

**What happens if Frank or the Organizing Entity withdraws consent before DePrize-open:**

- Option 1 is removed from the holder vote ballot. The vote becomes a binary choice (Zephalto direct vs refund).
- The DePrize contracts remain deployed for future MoonDAO missions.

**Practical note:** as a Senator who supports the mission daily, Frank's de facto participation is high. Formalizing his role here is mostly about documenting expectations clearly rather than creating new mechanisms.

## Pool seeding and LP economics

> **As built:** there are no Uniswap LP pools. Each DePrize is one Gnosis CTF condition + one `LMSRWithTWAP` market, **seeded by the treasury with `funding` at creation** (`LMSRWithTWAPFactory.createLMSRWithTWAP(ctf, weth, [conditionId], fee = 1e16, 0x0, funding)`, default ~1 ETH × #teams — the same seed magnitude discussed below). LMSR is a bounded-loss market maker: the treasury's maximum loss is capped by `funding` and the curve's `b` parameter, so the "LP cliff risk" framing below is moot — there is no external-LP role to attract. The LMSR's 1% fee accrues to the market and is recovered by the treasury at unwind. The treasury-as-Uniswap-LP analysis below is retained as design-rationale history.

Outcome-token AMM pools are notoriously hostile to liquidity providers (cliff risk at settlement: an LP holding the losing side gets zero; walk-toward-edge dynamics drive maximum IL; settlement-day total loss). Without explicit incentives, external LPs won't show up and the market becomes illiquid. **Launch-blocker if unaddressed.** This is precisely why the as-built design uses an LMSR market maker (bounded operator loss, no LP needed) rather than constant-product LP pools.

**Original v1 approach (superseded): Treasury-as-sole-LP with bumped fees.**

| Parameter | Value |
|---|---|
| Treasury commitment per DePrize | ~1 ETH per team (3 ETH for Frank's 3-team DePrize) |
| LP fee (treasury earns) | 1.0% per swap |
| Protocol fee (PrizeEscrow earns) | 1.0% per swap |
| Total swap cost | 2.0% |
| Concentrated liquidity | Yes (v4) — treasury LPs only in active probability range |
| Treasury max cliff loss | Bounded at ~3 ETH (the seed) across all pools |
| External LPs | Allowed but not required |

At moderate activity ($5M swap volume), treasury earns ~15 ETH in LP fees against ~2 ETH cliff loss = ~+13 ETH net. At low activity, both shrink proportionally. Treasury is essentially paid to underwrite the LP role.

→ See [Appendix G](#appendix-g--lp-economics-deep-dive) for: full alternatives comparison (LMSR, CLOB, vault-based, hybrid), rationale for choosing treasury-as-LP, treasury LP unwind sequence at settlement, and worked P&L examples across activity levels.

## Fee structure: why 5% slice + 1% swap fee

The protocol takes revenue in two places: a one-time 5% slice on primary mints (routes to JB project, mints `$OVERVIEW` to the bettor), and a 1% fee on every trade. The split between these two mechanisms is deliberate.

> **As built:** the 1% fee is the `LMSRWithTWAP` market-maker's built-in `fee` parameter (`1e16`), charged on every `trade()` and retained inside the market (which the treasury seeds and ultimately unwinds) — **not** a Uniswap LP fee + protocol fee split. There is a single 1% trade fee, not the "1% LP + 1% protocol = 2%" structure described in the original draft below. The revenue tables below remain directionally valid for the 5%-slice-vs-trade-fee tradeoff but should be read with that single-1%-fee correction.

### Revenue dynamics at different activity levels

| Scenario | Primary mints | Swap volume | 5% slice revenue | 1% swap fee revenue | Dominant driver |
|---|---|---|---|---|---|
| Low activity | $100k | $300k | $5k | $3k | Slice (1.7×) |
| Moderate | $500k | $5M | $25k | $50k | Swap fee (2×) |
| Active | $1M | $20M | $50k | $200k | Swap fee (4×) |
| Polymarket-like | $1M | $100M | $50k | $1M | Swap fee (20×) |

The slice is the bootstrap mechanism (dominates early). The swap fee is the scale mechanism (dominates with activity). Crossover at ~10× swap-to-primary ratio.

### Why not 0% slice?

The slice is the structural reason DePrize differs from Polymarket. It's how "every bet funds the prize" works mechanically. Dropping it to zero would make DePrize indistinguishable from a generic prediction market wrapped in MoonDAO branding. The narrative dies.

### Why not 10% slice?

The original design called for 10%. Lowering to 5% was based on participation-elasticity analysis:

- 10% slice → effective house edge ~7–12% (vs 1.5–7% at 5%)
- 12% edge is uncompetitive with Polymarket (~0.2%) and at the high end of mainstream sportsbooks
- Price-sensitive volume drivers (the bettors who matter most for market quality) avoid 12% edges
- Halving the slice halves the upfront friction with minimal narrative loss
- The 1% swap fee already covers most of the revenue gap at moderate activity

### The bypass-arbitrage tradeoff (acknowledged)

A sophisticated bettor can avoid most of the 5% slice by waiting for others to primary-mint, then buying outcome tokens on the secondary market — paying 2.0% per swap (1.0% LP + 1.0% protocol fee).

- Primary minter friction: 5% slice + ~2.0% routing fees = ~7.0% effective
- Secondary buyer friction: 2.0% per swap = ~2.0% effective

This is a 3.5× asymmetry favoring secondary buyers (smaller than the 5× under the original 1.3% LP fee, because bumping LP fee to 1.0% raised both sides but raised secondary friction more). Implications:

- Primary minting is dominated by community believers (who want `$OVERVIEW` and want to fund the prize directly).
- Secondary trading attracts speculators who want pure prediction-market exposure.
- The slice falls disproportionately on believers; speculators free-ride on the prize.

At 5% slice (vs 10%) the asymmetry is 5× instead of 10×. Still asymmetric but materially less punitive on the people we want to encourage. This is an acknowledged design tradeoff. A future tuning consideration is to introduce a small exit fee on secondary sells to better balance entry and exit friction — not in v1.

### Why exactly 1% trade fee (not higher or lower)?

- Above 1%: trading friction rises, price-sensitive volume avoids the market, and signal quality drops.
- Below 1%: revenue at scale becomes negligible.
- As built, 1% is the LMSR market-maker fee — the **total** per-trade cost (there is no separate LP fee). This is well below sportsbook vig (3–10%) and, combined with LMSR's bounded-loss curve, lets the treasury seed the market without needing external LPs.

## The holder vote (1 vs 2 vs 3)

Before any migration happens, existing `$OVERVIEW` holders vote on a proposal with three options. The vote queries `$OVERVIEW` holders specifically (not vMOONEY) because the funds at stake were contributed to this mission. Voting weight is `$OVERVIEW` balance at a snapshot block announced 7 days in advance of the vote opening.

### Option 1 — Unified DePrize (all providers compete)

- Existing JB project ETH becomes the **seed prize pool** for DePrize #0.
- **All three providers compete simultaneously**: Virgin Galactic, Zephalto, and a third balloon provider. **All three providers must be publicly named at least 30 days before the holder vote opens.** No stealth competitors are allowed at launch — bettors cannot reasonably price an outcome on an unidentified provider. The third provider's identity is currently known to MoonDAO leadership and they have agreed to be named publicly when going out of stealth mode, which must happen before the migration vote.
- Each provider's eligibility is gated by **two axes**: capability demonstration (tier-specific criteria) + budget eligibility (their currently-quoted 2-seat price ≤ prize pool at sunset).
- **2-seat budget thresholds (current quotes; providers may revise prices during the campaign; Senate confirms current price at settlement)**:
  - Unnamed provider: always eligible (accepts any prize pool size as full payment for both seats; deposit terms TBD with provider).
  - Zephalto: ~€360k ≈ $390k (2 × €180k per seat).
  - Virgin Galactic: ~$1.5M (2 × $750k per seat).
- Prize pool grows from: existing seed, 5% slice of every new bet, 1% of every swap (primary routing + secondary trades), plus optional direct contributions.
- `$OVERVIEW` cashOut gated during campaign; re-enabled at settlement or cancellation.
- Senate votes at sunset among eligible providers (with a pre-committed preference order to remove ambiguity).
- Timeline: 12–18 months.
- Winning provider delivers **two seats**: Frank + community-selected Candidate (per existing 4-round Selection Process).
- Prize disbursed in milestones: 30% on capability demonstration, 70% on actual flight (see §Settlement).
- Full mechanism in §Unified DePrize mechanism below.

### Option 2 — Direct purchase from Zephalto now (2 seats)

- Admin Safe places the 20% deposit (~€72k / ~$78k) with Zephalto immediately for 2 seats.
- Follow-up fundraise (~€288k / ~$312k via direct JB contributions or a separate launchpad) closes the gap to €360k total.
- Frank + Candidate fly on Zephalto's existing schedule.
- Standard launchpad close after the flight: `$OVERVIEW` becomes liquid via `PoolDeployer`.
- Timeline: weeks to months (depending on Zephalto's schedule and the follow-up raise).
- No new smart contracts.
- 1-seat fallback: if the follow-up raise stalls, can downgrade to 1 seat per Overview Effect Terms Section 8.3 (Candidate gets zero-G alternative).

### Option 3 — Refunds

- Activate JB refund payhook per Overview Effect Terms Section 8.
- `$OVERVIEW` holders redeem for pro-rata ETH (28-day claim window).
- Mission does not happen.
- Timeline: days.
- No new smart contracts.

### Side-by-side comparison

| Dimension | **1 — Unified DePrize** | 2 — Zephalto direct | 3 — Refunds |
|---|---|---|---|
| Frank flies | Yes (to balloon altitude, or actual space if Virgin unlocks) | Yes, to high altitude | No |
| Candidate flies | Yes (always 2 seats target) | Yes (or zero-G fallback if 1-seat) | No |
| Provider selection | Competitive (all three) | Locked to Zephalto | N/A |
| Aspirational ceiling | Virgin Galactic 2-seat at ~$1.5M | Zephalto 2-seat at ~$390k (same as Option 1's Zephalto unlock) | None |
| Time to outcome | 12–18 months | Weeks–months | Days |
| Additional funding needed | None required; prize grows from bets + optional direct | ~$312k via follow-up raise | None |
| `$OVERVIEW` outcome | Gated during campaign, then post-mission utility | Standard post-mission utility | Redeemed for ETH per existing payhook |
| New smart contract risk | New DePrize contracts (audited) | None | None |
| Cancellation downside | Lossy parimutuel refund (~5–20%) + JB cashOut | Zephalto fails to deliver → admin handles | None |
| Community engagement | High (months of competition + live betting + Candidate selection) | Moderate (one-time payment + small raise + Candidate selection) | None |
| Prestige | "Frank to the edge — or to actual space if we raise enough" | "Frank + Candidate to the edge with Zephalto" | None |

### What each option asks of the holder

- **1**: trust the unified DePrize mechanism; accept added time and smart contract complexity for two seats, competitive provider selection, and the chance to unlock Virgin Galactic.
- **2**: trust Zephalto specifically; accept the smaller-scope, single-seat flight as the fastest concrete path.
- **3**: take the ETH back; accept that this mission doesn't happen.

### Honest framing of Option 1's tradeoffs

Option 1 is the highest-effort, highest-upside choice on the ballot. The proposal must say so honestly:

- **Longer timeline** (12–18 months) is the biggest cost; news cycles move on, momentum dissipates.
- **Cancellation friction** is real (~5–20% loss for concentrated bettors if DePrize cancels) on top of normal bet losses.
- **Smart contract risk** is real even with an audit. Novel mechanism.
- **Virgin Galactic 2-seat almost certainly won't unlock without major external contributions.** Reaching ~$1.5M from 5% bet slices alone requires ~$30M in total betting volume. Realistic outcome is Zephalto vs unnamed competing for the prize; Virgin is a stretch goal that needs sponsor matching, partnership contributions, or extraordinary betting volume to reach.
- **The "second seat" is the structural reason option 1 exists.** A community winner rides with Frank. This is the unique upside no other option offers.

Hiding tradeoffs to make option 1 win is a bad way to start a multi-year mission. The proposal must include these explicitly.

### Positive case for Option 1 (for ambitious holders)

After enumerating the downsides, the proposal should also state honestly why Option 1 is the most ambitious and valuable path for holders who want to maximize mission outcomes:

- **Optionality**: Option 1 keeps every door open. If betting volume + sponsor matching unlocks Zephalto or Virgin, that's a real possibility. Options 2 and 3 lock in a specific outcome from day 1.
- **Community engagement scale**: a year of competitive betting + Candidate selection running in parallel produces 10–100× the community engagement of a one-shot Zephalto purchase. This is how MoonDAO grows.
- **Reusable infrastructure**: the DePrize mechanism, once built and audited, becomes a reusable primitive for future MoonDAO missions (lunar settlement DePrizes per Master Plan Part 3). Option 1 produces this infrastructure; Options 2 and 3 don't.
- **Prize pool keeps growing**: even at low activity, the 1% swap fee on secondary trades adds 10–30% to the prize pool over a year, which directly improves Frank's mission profile.
- **Two seats with one named (Frank) and one merit-selected**: this is a uniquely community-centered structure that no traditional space tourism program offers.
- **Aligned with MoonDAO's Master Plan**: per the founder's vision (Part 3 of the Master Plan), the DePrize concept is central to MoonDAO's long-term flywheel. Option 1 funds the pilot of that flywheel; Option 2 sidesteps it.

The honest framing is: Option 1 is **higher variance** (could deliver Virgin or could deliver third provider) but with **higher expected value across the community** if you weight engagement, infrastructure, and optionality alongside the immediate flight outcome.

### Vote mechanics with 3 options

Plurality voting with 3 options. Mitigations against fragmentation:

- **Minimum plurality threshold of 40%**: if no option clears 40%, run a 7-day runoff between the top two options.
- **Pre-announced tiebreak**: if two options are within 2% of each other, the proposal defaults to the lower-numbered option (1 → 2 → 3). This favors the more ambitious option in close races.

These thresholds are configurable in the proposal text; the defaults above are starting points.

## Unified DePrize mechanism: capability + budget thresholds

This section describes how Option 1 from the holder vote actually works mechanically.

### The two axes

Every provider must satisfy both:

1. **Capability axis** — demonstration criteria appropriate to their tech tier (see Part VI §Resolved decisions #2 for tier-specific criteria).
2. **Budget axis** — their currently-quoted 2-seat price ≤ prize pool TWAP (30-day) at the relevant evaluation point.

A provider becomes "eligible to win" only when both are satisfied. The Senate votes among eligible providers at sunset.

### Permanent-once-eligible

To avoid late-game timing issues (a provider qualifies during a fundraising surge, then loses eligibility when the surge ends), eligibility is **sticky**: once a provider's 2-seat quote is ≤ pool TWAP for 30 consecutive days, they become permanently eligible for the remainder of the DePrize. They can lose eligibility only if their own price rises above the current pool (provider-side action), not by pool fluctuation.

This means: bettors can have confidence that once a provider unlocks, they stay unlocked regardless of late-campaign volume changes.

### Eligibility vs ability-to-pay at settlement

There's a subtle but important distinction: **eligibility is permanent, but the actual prize disbursement is limited by the actual pool at settlement.**

If Zephalto unlocked at month 3 during an ETH spike (pool TWAP $450k vs Zephalto quote $390k), then ETH crashed by month 18 (pool now $250k), Zephalto remains *eligible* by the permanent-once-eligible rule. But the pool can only pay them $250k, not $390k. At settlement, Senate must:

1. Confirm Zephalto's current quote (which may have been revised downward; e.g., new quote = $230k after market conditions change).
2. Check current pool ≥ confirmed current quote.
3. If yes: Zephalto wins, receives the actual pool amount (or their confirmed lower quote if lower).
4. If no: Zephalto is bypassed. Move to next eligible provider in preference order. If no eligible provider can be paid with the current pool, default to the always-eligible third provider (who accepts whatever the pool contains).

This is documented in §Settlement and is the reason the third provider's "always eligible, accepts whatever pool" property is structurally important: it guarantees the DePrize always has a settle path, even under adverse macro conditions.

### Mechanism design choices

| Choice | Rationale |
|---|---|
| **30-day TWAP of pool size** for eligibility (not spot) | Spot creates a MEV-able discontinuity; a bot front-runs the threshold crossing. TWAP smooths it and makes manipulation expensive. |
| **Provider quotes NOT locked on-chain** | Aerospace prices move with operational maturity, fuel costs, and strategic positioning. Registry stores the current quote, updated by Senate-authorized tx with 14-day notice. At settlement, Senate confirms the current price directly with each potentially-winning provider. |
| **Pool in ETH, quotes in USD** (via Chainlink ETH/USD TWAP) | ETH-native UX matches MoonDAO bettors. Tradeoff: bettors exposed to ETH/USD volatility (see Part IV §ETH price risk). |
| **Pre-committed Senate preference order** at DePrize-open (default: Virgin > Zephalto > Unnamed) | Removes settlement-time ambiguity; bettors price ties from day 1. Immutable once published. |

### Open question: prize denomination (ETH vs USDC)

The permanent-eligibility edge case above is fundamentally a **denomination mismatch problem**: bettor activity is in ETH; provider quotes are in USD; ETH/USD volatility creates the gap. A **USDC-denominated prize pool** would eliminate this entire class of problems.

| Ship ETH (current spec) | Ship USDC (alternative) |
|---|---|
| ETH-native UX, no Circle counterparty risk, `$OVERVIEW` cashOut floor stays ETH-backed | Stable pool value, eligibility maps 1:1 to ability-to-pay, more stable cashOut floor |
| Bettors exposed to ETH/USD swings; eligibility edge case is real | Circle freeze risk + regulatory surface (esp. US geo restrictions) |
| **Recommended mitigation**: if ETH/USD moves >25% in any 90-day window, open a `$OVERVIEW` vote to migrate mid-campaign (migration contract ~150 LoC, ~1 week of work) | Worth a brief Senate / EB discussion before contract development begins |

Tracked in §Still open. The 1% protocol fee + 5% slice mechanics work identically in USDC.

### Eligibility scenarios at a glance

Setup: ~$172k seed (existing Overview Effect raise). Quotes: Virgin $1.5M, Zephalto $390k, Unnamed $0 (always eligible). Senate preference: Virgin > Zephalto > Unnamed. Sunset: 18 months.

| Scenario | Pool TWAP at sunset | Eligible | Winner (per preference order) |
|---|---|---|---|
| A — Low activity (default) | ~$260k | Unnamed only | Unnamed |
| B — Moderate rally | ~$500k | Zephalto, Unnamed | Zephalto |
| C — Strong rally | ~$2M | Virgin, Zephalto, Unnamed | Virgin |

In each case, `YES` token holders of the winning team redeem ETH from the parimutuel pool; losing-team `YES` tokens are worthless. Milestone escrow releases 30% at M1, 70% after Frank + Candidate actually fly (M2).

→ See [Appendix J](#appendix-j--migration-sequence-and-unified-deprize-scenarios) for the full money-flow per scenario and implied-odds math (`Virgin_YES` ≈ P(Virgin qualifies), `Zephalto_YES` ≈ P(Zephalto qualifies) × P(Virgin doesn't), etc.).

### Backwards-incentive caveat (acknowledged structural conflict)

A bettor on the third provider wants the prize pool to **stay low** (so Zephalto/Virgin don't unlock and beat them in Senate preference order). This creates a perverse incentive: third-provider supporters might actively oppose additional fundraising.

This is a real structural conflict, not a bug. The unified DePrize creates bettors with opposite preferences about the prize pool's growth. There is no clean technical fix.

**What we do about it:**

- **Disclose honestly upfront**: bettors on the third provider should understand they're betting on "low-engagement outcome." This isn't unusual — sports bettors backing an underdog often want to avoid late roster changes that would boost the favorite. But the dynamic should be explicit.
- **Senate preference order is fixed at open** — the dynamic is known and priced in from day 1. There's no surprise at settlement.
- **Per-wallet bet caps** (10 ETH for pilot) limit how much any single bettor can lean on the third provider.
- **Most third-provider supporters will also be MoonDAO-aligned**: they want the mission to succeed at any tier. The hard-core "low engagement" bettor is a minority. Comms should encourage the framing of "I'm backing the most likely outcome" rather than "I'm rooting against fundraising."
- **Direct contributions are the relief valve**: sponsors and committed supporters can route around backwards-incentive bettors by contributing directly to the prize pool. Bettors can't block direct contributions.

**Bottom line**: this is an acknowledged tradeoff of the unified DePrize. Not solved, just managed. If the conflict becomes operationally disruptive (e.g., visible opposition to fundraising on social channels), Senate can intervene with messaging or, in extreme cases, cancel and re-architect for v2.

### Provider eligibility status display (UI)

The DePrize page must show, at all times:

- Current prize pool size and 30-day TWAP.
- Per-provider eligibility status: eligible / not yet eligible (with progress bar to threshold).
- Live implied odds per team.
- Senate preference order (immutable, prominent).
- Sunset countdown.

This is the most important UX detail. If holders/bettors can't see at a glance which providers are currently in the running, the mechanism feels opaque.

## Migration: retrofit of the existing Frank-to-space launchpad

**Applies only if option 1 (unified DePrize) wins the holder vote.**

The first DePrize wraps the existing Frank-to-space Juicebox project — same project ID, same `$OVERVIEW` token contract, same on-chain ETH balance. Existing `$OVERVIEW` holders must be made whole; no token is re-issued, burned, or diluted by the migration itself.

### What stays the same for existing `$OVERVIEW` holders

- Their `$OVERVIEW` balance is unchanged.
- The JB project ETH balance becomes the **initial prize pool** for the DePrize.
- Their pro-rata share of any future cashOut is unchanged. New 5% slices from bettors add proportionally to both treasury and supply, so per-token cashOut value is preserved.
- If the DePrize is cancelled, every `$OVERVIEW` holder (old and new) gets the same pro-rata cashOut.

### What changes for existing `$OVERVIEW` holders

- **CashOut is gated.** Previously, the standard launchpad mechanism allowed cashOut at stage 3 if the funding goal wasn't met by deadline. Under DePrize rules, cashOut is **disabled during the active campaign** and **enabled only at `CANCELLED`** (either no-winner outcome or admin cancellation).
- **New deadline.** The launchpad deadline is extended to the DePrize sunset date (~18 months default).
- **Settlement mechanism.** Instead of "raise goal, ship product, distribute via splits," the project's prize pool is distributed to the Senate-declared winning team at settlement.

These are substantive changes to the original contributor terms. The 3-way holder vote (Part III §Holder vote) is the authorizing event. The proposal pinned in that vote must include:
- The exact contract addresses being deployed and which existing parameters change.
- A clear statement of what's preserved vs what changes for existing holders.
- A snapshot of existing `$OVERVIEW` holders for transparency.
- The honest tradeoffs framing for each option (see §Holder vote).
- The current 2-seat quotes per provider (Virgin ~$1.5M, Zephalto ~$390k, Unnamed $0 always-eligible). Note: these are revisable by Senate-authorized update with 14-day notice; not locked on-chain.
- The Senate preference order for tiebreaking (Virgin > Zephalto > Unnamed).
- The milestone escrow parameters (30% at M1, 70% at M2, 18-month M2 deadline + optional 6-month extension).

### Migration as a sequence of on-chain actions

The migration is an 8-step sequence: deploy contracts → register providers + tier criteria + quotes → upgrade `LaunchPadPayHook` → run the 3-way `$OVERVIEW`-holder vote (7-day discussion + 7-day vote) → execute the winning option's specific transactions. Each option (Unified DePrize, Zephalto direct, refunds) has a distinct execution path.

→ See [Appendix J](#appendix-j--migration-sequence-and-unified-deprize-scenarios) for the full 8-step on-chain sequence and per-option execution path.

### LaunchPadPayHook upgrade (Registry-aware)

The existing `LaunchPadPayHook` defines stages 1–4 based purely on funding goal + deadline + refundsEnabled. We upgrade it to read DePrize state from the `DePrizeRegistry` so cashOut behavior follows the DePrize lifecycle automatically. The hook becomes the single source of truth for "is cashOut allowed right now" by delegating to Registry state, while remaining backwards-compatible for non-DePrize missions.

Deploy plan: ship the upgraded hook on Sepolia first, audit specifically for cashOut-gating correctness, then upgrade Frank mission's payhook in the Option-1-wins migration transaction.

→ See [Appendix H](#appendix-h--contract-code-stubs) for the full `stage(...)` function.

### `$OVERVIEW` dilution over the DePrize campaign

Existing contributors got 1,000 `$OVERVIEW` per ETH (full launchpad rate). New bettors get 50 `$OVERVIEW` per ETH (5% slice routed through JB at the same 1,000-per-ETH rate). That's a 20× advantage for existing holders.

| State | ETH backing | `$OVERVIEW` supply | ETH per token |
|---|---|---|---|
| Pre-DePrize | ~57.3 ETH | 57,300 | 0.001 ETH |
| Sunset (after $1M new bets + $5M swap volume) | ~90.7 ETH | 74,000 | 0.00122 ETH (+22%) |

Existing holders are NOT diluted in ETH terms — per-token backing grows because the 1% protocol swap fee routes ETH into PrizeEscrow without minting new tokens. **No airdrop is needed**; the 20× issuance differential is the compensation for early risk, and additional airdrops would invite anti-dilution attacks.

At M2 disbursement the prize pool flows to the winning provider; `$OVERVIEW` is then purely speculative (same as any launchpad-funded mission). On cancellation, ETH stays in the JB project and `$OVERVIEW` redeems proportionally.

→ See [Appendix I](#appendix-i--overview-dilution-math) for the full per-source breakdown and cancellation accounting.

### Migration risks specific to this retrofit

| Risk | Mitigation |
|---|---|
| **3-way vote fragments and no option clears the 40% minimum plurality.** | Pre-defined runoff: 7-day runoff vote between top two options. |
| **Option 1 wins narrowly with strong dissent.** Dissenting holders feel forced into something they didn't want. | Standard 7-day cooling-off after every vote (see Phase 4). For narrow Option 1 wins (<10% margin), extend the opt-out window to 14 days during which any holder can call the JB refund payhook individually. |
| **Existing holders feel the rules changed under them** even with clear win. | Proposal includes full honest disclosure of every option's tradeoffs (see §Holder vote). Public comment period before vote opens. |
| **Existing holders cashing out en masse before migration.** Drains the seed prize pool. | If stage 3 is currently active, brief cashOut activity is expected and acceptable. Snapshot the post-cashOut balance before deploying. |
| **`$OVERVIEW` issuance rate change confuses new bettors.** Old supply is much larger than new mint. | Show both in UI: "Total `$OVERVIEW` supply: X (Y from original launchpad, Z from new bets)." |
| **Migration deploys before the underlying `LaunchPadPayHook` upgrade is verified.** | Deploy hook upgrade to Sepolia first. Audit the upgrade specifically for cashOut-gating correctness. |
| **Vote is manipulable via last-minute `$OVERVIEW` buys.** | Snapshot-based voting weight from a block announced 7 days in advance. Post-snapshot transfers don't affect vote weight. |
| **Confusion between this vote and standard MoonDAO governance.** MoonDAO normally does Senate → vMOONEY member vote → on-chain execution. This vote is `$OVERVIEW`-holder-only, which is a departure. | Clearly label the proposal as a "mission-funder vote" rather than a "MoonDAO governance vote." Post explanation to docs and Discord. Decision rationale: the funds at stake were contributed to this specific mission, so the people who funded it decide its disposition. |

### Risks specific to the unified DePrize mechanism (capability + budget thresholds)

| Risk | Mitigation |
|---|---|
| **MEV at threshold crossings.** Bot detects pool about to cross Zephalto's $390k threshold, front-runs by buying Zephalto tokens cheap, exits at the post-crossing spike. | Use 30-day TWAP of prize pool size (not spot) for eligibility checks. Combined with permanent-once-eligible behavior (30 consecutive days) and per-wallet bet caps, MEV opportunity is small. |
| **Currency volatility (EUR/USD/ETH).** Provider quotes in EUR (Zephalto) and USD (Virgin); pool denominated in ETH. ETH/USD movement could flip a provider's eligibility week-to-week. | Lock USD-equivalent thresholds at DePrize-open via Chainlink ETH/USD price feed. All eligibility checks use the locked USD values vs ETH pool TWAP at Chainlink-reported ETH/USD. |
| **Asymmetric demonstration criteria perceived as unfair.** Virgin satisfies on day 1 (existing flight history); balloon providers need 3 fresh flights. | Tier-specific criteria are publicly documented and frozen at DePrize-open. The asymmetry reflects reality: a company with proven space-flight track record shouldn't need to re-prove it for a prediction market. Document the rationale explicitly. |
| **Backwards bettor incentive: Unnamed-supporters oppose fundraising** so Zephalto/Virgin don't unlock. | Senate preference order is fixed at open and priced into the market from day 1. Per-wallet bet caps limit any single bettor's leverage. Accepted tradeoff of the mechanism. |
| **Provider drops out mid-campaign** (e.g. Virgin discontinues suborbital flights). | Admin Safe can mark a provider "withdrawn" via Registry. Their team tokens become worth 0; corresponding LP positions and bettor losses are absorbed by other providers' increased win probability. Disclosed in UI. |
| **Provider commercial relationship damaged** by pitting them publicly against competitors. | Pre-negotiate the structure with all three providers before DePrize-open. Ensure each has explicitly agreed to participate. Failure to secure consent from any provider means they're removed from the list. |
| **Only one provider qualifies at sunset** → "competition" was theater. | Acceptable. Mechanism still validly funded the prize. Most likely Scenario A in the worked example. Frame this honestly in proposal. |
| **Senate fails to vote at sunset** (quorum issue). | Default: highest-prestige eligible provider wins per the pre-committed preference order. No re-litigation needed. |
| **New provider emerges mid-campaign** with a better quote than registered providers. | Provider list is locked at DePrize-open. New providers can be added in future DePrizes. Documented limitation. |
| **Ambiguity over what counts as "demonstrated"** for a specific provider. | Each provider's evidence bundle is pinned to IPFS. Senate members review evidence and vote their judgment. Disputes resolved at the Senate level, not on-chain. |

---

# Part IV — Risks and mitigations

## Economic / mechanism design

| Risk | Mitigation |
|---|---|
| **`$OVERVIEW` cashOut during campaign drains prize pool.** Bettor primary-mints, cashes out, extracts the 5% slice. | Gate JB cashOut: disabled during campaign, enabled only at `CANCELLED`. |
| **CTF cancellation refunds are lossy for concentrated bets** (~80–95% recovery). | Disclose in UI before any bet. Mathematically unavoidable with CTF parimutuel. |
| **House edge (1.5–7%) might surprise users.** | Honest positioning: this is for community members, not pure profit-seekers. Document EV analysis publicly. |
| **`$OVERVIEW` post-mission value is uncertain.** | Make clear it depends on what the team does with the mission. Not guaranteed. |

## Smart contract

| Risk | Mitigation |
|---|---|
| **Re-entrancy on refund.** Loops through CTF redeem + JB cashOut + transfers. | OZ `ReentrancyGuard`. Pull-payment pattern (ETH transferred at end of function). |
| **Hook fee miscalculation.** | Comprehensive Foundry tests including fuzz tests on every fee combination. |
| **MEV on routing swaps.** | `minOut` slippage protection in `bet` function. |
| **Smart contract bug post-launch.** | External audit pre-launch. Admin Safe `cancel()` as emergency lever. |

## Failure modes

| Failure | Behavior |
|---|---|
| **No one bets.** | DePrize falls back to traditional launchpad. Direct contributors get standard refund. |
| **All bets on one team.** | Winning team's bettors recover full CTF collateral. LPs in losing-team pools take losses, compensated by accumulated swap fees. |
| **Team withdraws mid-campaign.** | Their pool still trades; Senate vote at sunset reflects the failure. Future enhancement: explicit "team withdrawn" admin path. |
| **Multiple teams jointly succeed.** | Requires crisp pre-bet tie-breaking definition (e.g. first to verifiable altitude). Frozen before bets open. |
| **Senate vote fails quorum.** | Defaults to "no winner" → cancellation. |
| **PrizeEscrow ETH stuck because nobody calls `report()`.** | Permissionless `report()`; keeper bot ensures it runs. |

## Operational

| Risk | Mitigation |
|---|---|
| **`$OVERVIEW` shows up as mystery token in non-UI wallets.** | Rich token metadata (name, symbol, description). Etherscan listing. |
| **Treasury seed for team pools is meaningful capital.** | ~3 ETH per 3-team DePrize. Recoverable LP position. |
| **Many parameters at launch.** | Document explicit defaults (5% slice, 1% hook fee, 1.0% LP fee, 30/70 milestone split, 30-day TWAP, 18-month sunset). |

## Regulatory

| Risk | Mitigation |
|---|---|
| **US regulatory exposure (prediction markets).** | Geo-block US + selected jurisdictions via `ui/middleware/rateLimit.ts` extension. Click-through ToS. |
| **Winning outcome ambiguity.** | Crisp definition frozen in IPFS document referenced by Senate proposal (see Part VI §Resolved decisions). Eligibility Review Committee publishes a technical memo before Senate vote. |
| **Changing terms for existing `$OVERVIEW` holders.** | Mandatory Senate migration proposal with disclosure + opt-out window. See Part III §Migration. |

## Conflict of interest (expanded)

Multiple actors have potential conflicts. The mitigations vary by role.

| Actor | Conflict type | Mitigation |
|---|---|---|
| **Admin Safe signers** | Could rig Senate vote or cancel maliciously | Blocklist admin signer addresses from `DePrizeMint.bet` at contract level. 7-day notice required for cancellation. |
| **Registered provider team admins** | Could bet on their own team and gain insider edge | Blocklist registered team admin addresses from `DePrizeMint.bet` at contract level. |
| **Provider employees / contractors** | Insider knowledge of capability status | Cannot blocklist comprehensively. Disclose in Terms: insider betting may be flagged for review; large positions from addresses linked to providers can be challenged. Realistic mitigation is reputational, not technical. |
| **Senate members betting on the DePrize** | Self-dealing in winner vote | Senate members MAY bet but must (a) disclose positions before voting opens, (b) abstain if material position size (>1% of own vMOONEY value). Failure to disclose treated as a constitutional violation. |
| **Frank White (Senator + mission beneficiary)** | Unique structural conflict | Frank discloses Senate vote publicly OR recuses. Documented in §How Frank White and the Organizing Entity participate. |
| **MoonDAO Executive Branch members** | Could influence provider selection or terms | Executive Branch members cannot bet on the DePrize. Standard MoonDAO conflict-of-interest rules apply. |
| **Eligibility Review Committee members** | Could be paid by providers to favor specific eligibility findings | Members declare any commercial relationships with registered providers at appointment. Members with material conflicts recuse from that provider's review. |
| **Treasury LP** | Treasury benefits from high swap volume regardless of outcome | Aligned with bettors (both benefit from healthy market). Not a true conflict. |
| **Holders voting in the 3-way migration vote** | Each option benefits different holder segments | Snapshot voting prevents post-snapshot vote manipulation. All options documented with honest tradeoffs. |

## Black swans and external risks

Low-probability but high-impact events with explicit contingency plans.

| Risk | Mitigation |
|---|---|
| **Frank cannot fly** (medical / scheduling) | Overview Effect Terms §8.3 already handles this: `$OVERVIEW` holder vote chooses (a) partial refund minus expenditures, (b) replacement ambassador, or (c) reallocate to Candidate. See below for milestone-escrow integration. |
| **Candidate cannot fly** | Selection Process backup mechanism (Terms §7.2 + §11.2): next-highest-ranked Candidate offered the seat. If none qualify medically: $OVERVIEW vote on (a) Frank flies alone with second-seat refund, or (b) postpone + re-run Selection. |
| **ETH price crashes** (e.g., −50%) | Layered mitigations: (1) permanent-once-eligible protects providers who unlocked early; (2) Senate-authorized quote downward revision; (3) $OVERVIEW vote to extend sunset 6 months, cancel, or downsize ambition; (4) optional treasury USD hedge via Aave/OTC (v2); (5) USDC pool variant as v2 fallback. Disclosed to bettors. |
| **Provider goes bankrupt** | YES tokens crash to ~0 on secondary; parimutuel naturally rewards survivors. Senate uses "no winner" if a bankrupt provider somehow wins the vote. If bankrupt between M1 and M2, M2 escrow returns to $OVERVIEW governance for replacement/refund. |
| **Carrier industry consolidation** (Virgin shutdown, etc.) | Market and Senate vote naturally adapt. YES tokens reprice; no special handling. |
| **Regulatory ban** in critical jurisdictions | Geo-block expands; existing bettors can exit but not bet new. Worst case: Senate cancels → standard cancellation refund flow. |

### Frank-can't-fly + milestone escrow integration

The milestone escrow structure was designed partly to handle the Frank-can't-fly scenario. The 70% M2 escrow gives `$OVERVIEW` governance real optionality without losing the entire prize to a provider who can't fly the original passenger:

| State at trigger | Behavior |
|---|---|
| Pre-settlement (OPEN / LOCKED) | Existing 3-way vote runs as planned; Terms §8.3 covers this before any settlement. |
| M1 released, M2 pending | `$OVERVIEW` vote per §8.3. Replacement ambassador / Candidate-only: M2 still releases on modified flight delivery. Partial refund: M2 escrow returns to JB, refund payhook activates pro-rata. M1 funds already disbursed are not clawed back. |
| M2 released | No action needed; post-mission. |

The replacement ambassador would be selected via a new `$OVERVIEW + vMOONEY` vote with criteria similar to the Candidate Selection Process. Selection-Process winners would be presumed top candidates.

---

# Part V — Future enhancements (not v1, but considered)

These ideas were explored but deferred. Documented here so we don't re-litigate them and so v2 has a starting point.

## Multi-tier prize allocation (participation bounties)

Instead of "winner takes all," allocate small bounties (e.g., 5% cap per provider, max 10 ETH) to providers who **demonstrated capability** but weren't chosen by Senate. This incentivizes providers with low betting volume to complete capability demonstrations rather than walk away.

**Not in v1**: complicates prize escrow math, adds per-provider evidence verification, increases Senate workload, marginally reduces the winner's prize. **Simpler v1 alternative**: a flat "completion grant" from MoonDAO treasury (off the prize pool) — same incentive, no contract changes. **v2 trigger**: providers withdrawing mid-campaign citing "no point completing demonstrations if we can't win."

## Insurance pool (opt-in cancellation protection)

Bettors opt in at bet time to "cancellation insurance" by paying an extra 1% premium. On cancellation, insured bettors get 100% recovery (capped per-bettor to prevent gaming); uninsured get standard parimutuel refund (~80–95% for concentrated bettors). Excess premiums flow to PrizeEscrow.

**Risks**: adverse selection (low-conviction bettors buy, high-conviction don't → pool insolvency); treasury implicit underwriter exposure; non-trivial actuarial math. **Better as a separate product** (Nexus Mutual-style cover) than baked into DePrize. **v2 trigger**: significant participation drop attributable to cancellation fear.

## Sponsor matching (direct contributions vs. conditional)

**Original idea**: sponsors pledge "$X if Team Y wins" — conditional, releases only if Y chosen.

**Recommendation for v1**: **don't build this as a contract feature.** Direct contributions already work (anyone can pay JB project). For coordination announcements, use Senate proposals with off-chain commitments ("Sponsor X commits $50k if Virgin wins, payable within 7 days of M1"). Add a "Sponsor This DePrize" CTA with higher denomination presets ($1k, $5k, $25k); sponsor attribution via off-chain registry. **v2 trigger**: multiple sponsors request true conditional pledges and off-chain commitments prove insufficient → build `DePrizeSponsorMatching`.

---

# Part VI — Resolved decisions and remaining open questions

## Resolved (2026-05-22)

1. **First DePrize: contingent on a 3-way vote of existing Frank-to-space `$OVERVIEW` holders.** Options: (1) unified DePrize with all providers competing on capability + budget, (2) direct purchase from Zephalto now, (3) refunds. If option 1 wins, DePrize launches as a retrofit of the existing JB project; existing holders remain whole. Details in [Part III §Holder vote](#the-holder-vote-1-vs-2-vs-3), [§Unified DePrize mechanism](#unified-deprize-mechanism-capability--budget-thresholds), and [§Migration](#migration-retrofit-of-the-existing-frank-to-space-launchpad). This vote queries `$OVERVIEW` holders specifically (not vMOONEY), because the funds at stake were contributed to this mission.
2. **Winning conditions — tier-specific demonstration criteria.** Each provider tier has demonstration criteria appropriate to their technology. A provider becomes "eligible to win" only when they satisfy **both** their capability criterion AND the budget criterion (current 2-seat quote ≤ prize pool TWAP). Tier-specific capability criteria:

   - **Stratospheric balloon tier (Zephalto, unnamed provider)**: All of the following:
     - At least **three flights to ≥60,000 ft** with successful descent and recovery.
     - Each flight carries a payload that meets at least one of: (a) **pressurized capsule certified for human occupancy** by the relevant aviation authority of the provider's jurisdiction, OR (b) **actual crewed flight**, OR (c) **third-party observer attestation** that flight conditions represent human-rated operation including active life-support systems (oxygen, temperature, CO2 scrubbing).
     - **Zero major incidents** during the three flights.
     - Demonstrated ability to fly **two passengers simultaneously** on a single flight within current 2-seat quote.

   - **Suborbital spaceflight tier (Virgin Galactic)**: All of the following:
     - **FAA (or equivalent) flight history** showing at least three successful crewed suborbital flights with no Class A/B incidents in the previous 24 months.
     - Current commercial passenger pricing publicly available.
     - Confirmation Virgin can accept two passengers on a single flight booking within current 2-seat quote.
     - Virgin's existing flight history likely satisfies this on day 1.

   The asymmetry is intentional: a company that already does this routinely shouldn't need to repeat demonstrations to satisfy a prediction market.

   Verification: the Senate vote is the on-chain authority. Senate vote is informed by an off-chain evidence package per provider (flight telemetry, photos/video, third-party observer attestation, FAA reports, etc.). The proposal posts an IPFS link to each provider's evidence bundle.

   "Major incident" definition (Senate's reference, frozen at DePrize-open):
   - Loss of payload integrity, depressurization above 30,000 ft, uncontrolled descent, recovery from outside a 50 km landing radius, structural failure of envelope or capsule, fatality or serious injury, or any event the provider's own safety review classifies as Class A/B.

   Frank does not need to fly to settle the DePrize at M1 (capability demonstrated). The actual Frank + Candidate flight triggers M2 (70% prize release). See §Settlement.
3. **Admin cancellation policy.** The admin Safe can cancel for any reason after publishing a **7-day on-chain notice**. The notice is an on-chain event that pauses new bets immediately. After 7 days, refunds activate per the cancellation flow.
4. **Treasury commitment.** ~1 ETH per team pool seed confirmed. For Frank-to-space (3 teams): ~3 ETH total, recoverable LP positions.

## Still open

- **Senate quorum threshold for the winner vote** (post-DePrize-open, choosing which eligible provider won). Default proposal: 5% of vMOONEY supply, plurality among eligible providers + "no winner." Open for input.
- **Senate preference order.** Default proposal: Virgin Galactic > Zephalto > third provider (highest-prestige eligible provider wins ties). Locked at DePrize-open, immutable thereafter. Open for input.
- **Sunset date.** When does the Senate vote get auto-created if no provider has self-declared completion? Default proposal: 18 months from DePrize-open. Adjustable by admin Safe with 30-day notice.
- **Bet size limits.** Unbounded by default. Consider per-wallet caps for the first pilot (e.g. 10 ETH per wallet) to limit MEV and blast radius.
- **Holder vote thresholds.** Default proposal: plurality with 40% minimum; runoff between top two if no option clears 40%; 2% tiebreak window favors lower-numbered option. Open for input.
- **Concrete terms confirmed for vote.** Final Zephalto 2-seat deposit + total + funding gap for Option 2. Provider consent letters from Virgin, Zephalto, and the third provider (publicly named) for Option 1.
- **Third provider's deposit terms.** Currently "takes the whole amount." Migration to standard deposit + balance-at-flight may be requested. Open for negotiation with provider.
- **Prize denomination: ETH vs USDC for v1.** Current spec is ETH. USDC eliminates the ETH/USD volatility edge case at the cost of Circle centralization and slightly weaker `$OVERVIEW` cashOut floor. See Part III §Eligibility vs ability-to-pay at settlement. Requires Senate / EB decision before contract development begins.
- **Eligibility Review Committee membership.** 5 members (3 astronauts + 2 aerospace engineers) per current spec. Specific nominees to be proposed via Senate vote at DePrize-open.
- **Terms amendment for parallel Candidate Round 1.** Existing Terms Section 7.1 says "Round 1 closes 14 days after a carrier is secured." DePrize design runs Round 1 in parallel with betting. Terms amendment + public comment period required before launch.
- **Upgrade path immutability commitments.** Current proposal: UUPS upgradeable with 7-day timelock under Admin Safe. Senate should review and confirm before contract deployment.
- **Test coverage gate for Phase 3 audit.** Current target: ≥95% line coverage + ≥10k fuzz iterations per critical function + invariant tests. Audit firm to confirm targets as audit pre-requisites.

---

# Part VII — Implementation phases

### Phase 0 — Spec finalization (3–5 days)

- Resolve remaining open questions (vote plurality threshold, sunset date, bet caps, Senate preference order).
- Formalize tier-specific winning-condition language as an immutable IPFS document.
- Legal review of geo-blocking strategy, ToS, and migration disclosures.
- **Confirm provider participation in writing.** Virgin Galactic, Zephalto, and the unnamed provider must each explicitly agree to be listed as competing providers and accept the locked USD-equivalent quote. Without consent from any provider, they are removed from Option 1's roster.
- **Finalize Option 2 terms.** Zephalto 2-seat deposit amount confirmed (~20% × €360k = ~€72k / ~$78k); funding gap estimate (~€288k / ~$312k); follow-up raise mechanism (direct JB contributions or separate launchpad).
- Draft the 3-way `$OVERVIEW`-holder proposal text with honest tradeoffs for each option.

### Phase 1 — Contracts (2–3 weeks)

- Deploy Gnosis ConditionalTokens on Arbitrum.
- Implement and test 5 essential contracts + optional `DePrizeRefund` + `DePrizeMilestoneEscrow`.
- **Upgrade existing `LaunchPadPayHook`** to support cashOut gating via Registry state delegation.
- Extend `Proposals.sol` for discrete winner selection.
- Foundry coverage targets: **≥95% line coverage** on all new contracts, **≥10k fuzz iterations** per critical function (bet, exit, redeem, refundAll, milestone releases), and **invariant tests** for total-ETH-conservation across all state transitions.
- Arbitrum Sepolia deployment with full migration fixture (deploy a clone of the Frank JB project, simulate migration).

### Phase 2 — Frontend (2 weeks, overlaps with Phase 1)

- `ui/pages/deprize/[id].tsx` page with team cards, live ETH odds, back-team modal.
- Update existing `ui/components/nance/DePrize.tsx` to consume new on-chain data.
- `BackTeamModal.tsx` mirroring `MissionContributeModal.tsx` patterns.
- Exit-position UI.
- Senate vote integration (existing UI).
- `refundAll` single-click cancellation refund UI.
- Admin panel.
- Geo-blocking middleware extension.
- Cypress E2E test.

### Phase 3 — Production hardening (1–2 weeks)

- External audit of all new contracts.
- Sepolia bug bounty period.
- Comms / FAQ / docs for non-technical participants.

### Phase 4 — Holder vote + launch (or alternate path)

- Deploy DePrize contracts to Arbitrum mainnet (regardless of vote outcome — useful for future missions).
- Register **current 2-seat quotes** per provider in the Registry (revisable by Senate-authorized update with 14-day notice; not locked on-chain).
- Publish snapshot of existing `$OVERVIEW` holders.
- **Confirm provider participation consent (Virgin, Zephalto, third provider) in writing before vote opens. All providers must be publicly named at this point — no stealth competitors allowed.**
- Pin tier-specific demonstration criteria to IPFS.
- **3-way `$OVERVIEW`-holder proposal** (7-day discussion + 7-day vote, with optional 7-day runoff if no option clears 40%).
- **7-day cooling-off period** after vote conclusion before any migration transaction executes. During this window, any holder can call the existing refund payhook individually (effectively choosing Option 3 for themselves). This applies regardless of margin; narrow-margin wins get an additional 14-day opt-out window per §Migration risks.
- Branch on outcome:
  - **Option 1 (Unified DePrize)**: register Frank JB project as the first DePrize (id `1`; `0` is reserved as the "no DePrize attached" sentinel) with all three providers + current quotes + preference order; seed team pools; transition `OPEN`. Begin monitoring.
  - **Option 2 (Zephalto direct)**: admin Safe places 20% deposit with Zephalto for 2 seats; follow-up fundraise begins. DePrize contracts remain deployed for future missions.
  - **Option 3 (Refunds)**: activate JB refund payhook per Overview Effect Terms Section 8. DePrize contracts remain deployed for future missions.
- Post-vote retro regardless of outcome.

### Phase 5 — Future enhancements (not blocking)

See Part V for full design discussion. Items considered:

- Cross-chain LayerZero entry (Ethereum mainnet, Base, Optimism).
- Multi-tier prize allocation (participation bounties for non-winning providers that demonstrated capability).
- Insurance pool (opt-in cancellation protection).
- On-chain sponsor matching contracts (currently handled off-chain via Senate proposals).
- Phased elimination rounds (multi-stage races).
- Conditional DePrizes (winner triggers next).
- Treasury USD hedge against ETH exposure.
- Stablecoin pool variant (USDC) if ETH/USD volatility proves disruptive in v1.

---

# Appendix A — Decision matrix

11 criteria scored across 4 options under 3 weighting schemes.

## Criteria

| # | Criterion |
|---|---|
| 1 | Public communication |
| 2 | Code complexity |
| 3 | Frank prize funding |
| 4 | Bettor UX |
| 5 | Manipulation resistance |
| 6 | `$OVERVIEW` value capture |
| 7 | Community alignment |
| 8 | Cross-chain accessibility |
| 9 | Legal risk |
| 10 | Long-term maintenance |
| 11 | Multi-mission scalability |

## Raw scores (1–10)

| Criterion | A (no hook) | B ($OVERVIEW coll.) | C (USDC) | **D (this design)** |
|---|---|---|---|---|
| 1. Public communication | 9 | 5 | 10 | 9 |
| 2. Code complexity | 9 | 5 | 7 | 7 |
| 3. Frank prize funding | 6 | 9 | 6 | 8 |
| 4. Bettor UX | 9 | 6 | 9 | 9 |
| 5. Manipulation resistance | 7 | 7 | 8 | 7 |
| 6. `$OVERVIEW` value capture | 4 | 10 | 4 | 5 |
| 7. Community alignment | 5 | 9 | 4 | 6 |
| 8. Cross-chain | 7 | 6 | 9 | 7 |
| 9. Legal risk | 6 | 6 | 4 | 6 |
| 10. Maintenance | 9 | 5 | 7 | 8 |
| 11. Scalability | 8 | 6 | 8 | 8 |

Note: D's scores reflect the **simplified** design (post-Appendix D cuts). The original elaborate D scored higher on `$OVERVIEW` value capture and community alignment (8 and 7) but lower on code complexity and maintenance. The simplified D trades some of those for less surface area.

## Scheme 1 — Frank pilot weighting

| Criterion | Weight | A | B | C | D |
|---|---|---|---|---|---|
| 1 | 12 | 108 | 60 | 120 | 108 |
| 2 | 8 | 72 | 40 | 56 | 56 |
| 3 | 25 | 150 | 225 | 150 | 200 |
| 4 | 12 | 108 | 72 | 108 | 108 |
| 5 | 8 | 56 | 56 | 64 | 56 |
| 6 | 8 | 32 | 80 | 32 | 40 |
| 7 | 12 | 60 | 108 | 48 | 72 |
| 8 | 4 | 28 | 24 | 36 | 28 |
| 9 | 5 | 30 | 30 | 20 | 30 |
| 10 | 3 | 27 | 15 | 21 | 24 |
| 11 | 3 | 24 | 18 | 24 | 24 |
| **Total** | 100 | **695** | **728** | **679** | **746** |

**Winner: D (746)** → B (728) → A (695) → C (679)

## Scheme 2 — Long-term platform weighting

| Criterion | Weight | A | B | C | D |
|---|---|---|---|---|---|
| 1 | 12 | 108 | 60 | 120 | 108 |
| 2 | 12 | 108 | 60 | 84 | 84 |
| 3 | 8 | 48 | 72 | 48 | 64 |
| 4 | 12 | 108 | 72 | 108 | 108 |
| 5 | 10 | 70 | 70 | 80 | 70 |
| 6 | 6 | 24 | 60 | 24 | 30 |
| 7 | 5 | 25 | 45 | 20 | 30 |
| 8 | 7 | 49 | 42 | 63 | 49 |
| 9 | 8 | 48 | 48 | 32 | 48 |
| 10 | 10 | 90 | 50 | 70 | 80 |
| 11 | 10 | 80 | 60 | 80 | 80 |
| **Total** | 100 | **758** | **639** | **729** | **751** |

**Winner: A (758)** → D (751) → C (729) → B (639)

## Scheme 3 — Balanced weighting

All criteria weighted equally at 9.

| Option | Total |
|---|---|
| A | 711 |
| B | 666 |
| C | 684 |
| **D** | **720** |

**Winner: D (720)** → A (711) → C (684) → B (666)

## Combined ranking

| Option | Frank pilot | Platform | Balanced | Avg rank |
|---|---|---|---|---|
| **D** | **1st** | 2nd | **1st** | **1.3** |
| A | 3rd | 1st | 2nd | 2.0 |
| B | 2nd | 4th | 4th | 3.3 |
| C | 4th | 3rd | 3rd | 3.3 |

The simplified D wins outright in 2 of 3 schemes. A is the closest serious alternative, winning only under platform weighting where code simplicity dominates.

---

# Appendix B — Alternatives considered

## Option A — Pure ETH market (no swap fee hook)

Same as D but without the 1% swap fee routing to PrizeEscrow. Prize pool only grows from the one-time 5% slice on primary mints.

**Why D was preferred:** D's 1% perpetual swap fee adds meaningful prize-pool growth (potentially 10–30% on top of primary contributions, depending on secondary volume). The added complexity is contained to one hook contract and one escrow contract — small surface for a real benefit.

A is the right fallback if Phase 1 hits unexpected delays. The downgrade is minor.

## Option B — `$OVERVIEW`-as-collateral market

CTF collateral and per-team pool currency are both `$OVERVIEW` (not ETH). 100% of launchpad contributions flow to prize pool; betting layer operates entirely in `$OVERVIEW`.

**Why D was preferred:** Two-hop exit (`Team_X_YES` → `$OVERVIEW` → ETH), compounded volatility risk, ~1,800 LoC, worse maintenance profile. The 100% prize efficiency was its strongest property; D's 1% perpetual swap fee narrows that gap substantially while preserving clean single-asset UX.

## Option C — USDC market

CTF collateral is USDC, team pools paired against USDC, JB multi-terminal accepts both ETH and USDC, cross-chain via Circle CCTP.

**Why D was preferred:** Circle is a centralized counterparty (can freeze accounts). USDC introduces regulatory surface. `$OVERVIEW` becomes nearly vestigial. Best fit for a general prediction market product separate from MoonDAO; wrong for a community-aligned mission.

---

# Appendix C — Glossary

| Term | Definition |
|---|---|
| `$OVERVIEW` | The mission's project token, minted by Juicebox when bettors pay the 5% slice. A receipt with downstream utility (cashOut floor + post-mission market value). |
| Outcome token (`Team_X_YES`) | An ERC-1155 token from Gnosis ConditionalTokens. Each represents a claim on 1 ETH if team X wins. |
| Split set | A complete set of outcome tokens (1 of each team). Always burns back to 1 ETH. |
| Back a team | Increase your holding of one team's outcome tokens; the high-level user action. |
| CTF | Gnosis ConditionalTokens Framework. Open-source contracts handling outcome token accounting and settlement. |
| Senate | MoonDAO's on-chain governance body using vMOONEY voting weight. |
| Sunset | The deadline by which a team must deliver, after which Senate must declare a winner or cancellation. |
| JB cashOut | Juicebox's mechanism for redeeming project tokens for pro-rata share of project balance. Gated to `CANCELLED` state in DePrize. |
| `DePrizePrizeEscrow` | Holds 1% protocol fees from swaps during campaign. Forwards to milestone escrow at settlement; returns to JB at cancellation. |
| `DePrizeMilestoneEscrow` | Holds the combined prize pool (JB project ETH + PrizeEscrow ETH) at settlement. Releases 30% at M1 (capability) and 70% at M2 (Frank + Candidate flown). |
| `DePrizeFeeHook` | Uniswap v4 hook attached to each `ETH/Team_X_YES` pool. Charges LP fee + protocol fee, routes protocol fee to escrow. |
| M1 (Milestone 1) | "Capability demonstrated" milestone: Senate vote confirms winner meets capability + budget criteria. 30% of prize pool releases to winning provider; bettors paid in full from CTF parimutuel. |
| M2 (Milestone 2) | "Mission delivered" milestone: Frank + Candidate have actually flown, verified by Senate. Remaining 70% of prize pool releases to provider. |
| Permanent-once-eligible | A provider becomes "permanently eligible" once their current 2-seat quote is ≤ pool TWAP for 30 consecutive days. They stay eligible regardless of later pool fluctuations, unless they raise their own quote. Senate still verifies actual current price vs actual pool at settlement. |
| Two-pool model | DePrize uses two distinct pools: (1) CTF collateral pool pays winning bettors via parimutuel; (2) JB + Milestone escrow pool pays the winning provider for the mission. Standard for prediction markets that fund external prizes. |
| Organizing Entity | William Frank White LLC. The legal entity that contracts with carriers and executes the mission on Frank White's behalf. Recipient of prize milestone disbursements. |
| Candidate | The community-selected MoonDAO Citizen who flies alongside Frank White. Selected via existing 4-round Selection Process (Overview Effect Terms Section 7). Distinct from "team" (which refers to providers competing in DePrize). |
| Parimutuel | Betting structure where winners' payouts come from losers' stakes. Inherent to CTF. |
| House edge | Expected % loss to the bettor over many bets, assuming fair market probabilities. |
| Eligibility Review Committee | Independent technical subcommittee (astronauts + aerospace engineers) that publishes a non-binding eligibility memo before each Senate winner-vote. Bridges the gap between Senate political authority and technical capability assessment. |

---

# Appendix D — What was cut from earlier drafts (and why)

Following the Musk method:

1. **Make requirements less dumb.** Several "requirements" turned out to be wants, not needs. The core requirement is "let people bet on which team wins, with proceeds funding a launchpad prize." Everything else was negotiable.
2. **Delete the part or process step.** Aggressively cut anything not directly serving the core requirement.
3. **Simplify or optimize.** Only after deletion.

Cuts made from earlier drafts of this design:

| Mechanism | Reason cut |
|---|---|
| **`BoostVault` (early bettor rewards)** | Bettors will participate without it; rising prize from FeeHook provides natural FOMO. Could be re-added in v2 if data shows we need it. |
| **`OverviewStakingVault` (stake `$OVERVIEW` for swap fees)** | `$OVERVIEW` already has utility via cashOut floor + post-mission market value. Staking is a flourish. |
| **Senate `$OVERVIEW` bonus weight** | Adds complexity to `Proposals.sol`. vMOONEY voters are already MoonDAO-aligned. Marginal benefit. |
| **Dynamic fee curve (0.1% / 1% / 5%)** | Markets handle whales naturally via price shifts. Manipulation only affects market prices, not Senate outcomes. Constant 1% fee is simpler and equivalent. |
| **70/30 protocol fee split (PrizeEscrow / MoonDAO Safe)** | DAO revenue should come from elsewhere; routing 100% to PrizeEscrow is more generous to bettors and simpler. |
| **Early `$OVERVIEW/ETH` pool deployment** | With cashOut gated to cancellation, this pool isn't critical during the campaign. Standard `PoolDeployer` handles it post-mission. |
| **72h dispute window + emergency override** | Senate vote is already on-chain governance. Adding another override layer is governance theater. If Senate is wrong, the broader Senate process can re-vote. |
| **TWAP-based settlement** | DePrize settles via Senate vote (binary outcome), not via pool price. Not applicable. |
| **Revnet exit tax on `$OVERVIEW` cashOut** | JB's bonding curve formula penalizes small holders disproportionately. Anti-community. |
| **Burn `$OVERVIEW` on swap** | Added complexity without clear benefit. |
| **Cross-chain LayerZero entry (v1)** | Deferred to v2. Arbitrum-only for pilot is fine. Doesn't block launch. |
| **Multi-currency entry (ETH + `$OVERVIEW` parallel pools)** | Liquidity fragmentation. Optionality not worth the cost. |

Per Musk's heuristic: I should be reverting roughly 10% of cuts. The likely revert is `BoostVault` — there's a real argument that early-bettor FOMO matters for bootstrapping. Holding it on the shelf as a v2 add if pilot data shows we need it.

The current design has:

- **5 essential contracts + 1 optional helper** (down from 9)
- **~700–900 LoC** (down from ~1,500)
- **Same core mechanic** (ETH betting market with CTF outcome tokens and a 5% launchpad slice)
- **One D-over-A differentiator preserved**: the 1% swap fee that perpetually grows the prize

The cuts don't affect the bettor experience. They affect contract surface, audit scope, and parameter tuning burden.

# Appendix E — Worked examples (full money tracking)

> **Note**: team names below (Stratos, Helios, Aurora) are illustrative placeholders to demonstrate the math at a clean equilibrium. The actual Frank DePrize providers are Virgin Galactic, Zephalto, and the (to-be-named) third provider. The mechanism is identical; only the names differ.
>
> **As-built fee note:** these examples predate the CTF + `LMSRWithTWAP` implementation and model a "2.0% swap fee split to LPs + `PrizeEscrow`." As built there is a **single 1% LMSR trade fee** retained inside the treasury-seeded market (no LP/PrizeEscrow split). The parimutuel payout intuition is unchanged; only the per-swap fee figures and their destination differ. See [Part III §Implementation status](#implementation-status-as-built).

### Setup

| Parameter | Value |
|---|---|
| Mission prize pool (hypothetical) | 100 ETH |
| Competitors | Stratos, Helios, Aurora |
| Equilibrium market prices | Stratos = 0.40 ETH, Helios = 0.40 ETH, Aurora = 0.20 ETH |
| `$OVERVIEW` issuance rate (JB project) | 1,000 `$OVERVIEW` per ETH contributed |
| LP fee on swaps | 1.0% (paid to LPs — treasury, in v1) |
| DePrize hook fee on swaps | 1.0% (goes to prize pool escrow) |
| Total swap cost | 2.0% (1.0% LP + 1.0% protocol) |

### Example 1 — Alice bets 1 ETH on Stratos. Stratos wins.

**Bet placement (one transaction):**

| Action | Money movement |
|---|---|
| Alice sends 1 ETH to `DePrizeMint.bet(stratosTeamId, ...)` | −1.000 ETH from Alice |
| 0.05 ETH routes to JB project | +0.05 ETH to mission prize pool |
| JB mints `$OVERVIEW` to Alice (0.05 ETH × 1,000 rate = 50 tokens) | +50 `$OVERVIEW` to Alice |
| 0.95 ETH routes to CTF as collateral | +0.95 ETH locked in ConditionalTokens |
| CTF mints 0.95 `Stratos_YES` + 0.95 `Helios_YES` + 0.95 `Aurora_YES` | +0.95 of each outcome token to the routing helper |
| Helper sells 0.95 `Helios_YES` at 0.40 = 0.380 ETH gross, minus 2.0% fee | +0.372 ETH from sale; 0.0076 ETH split: 0.0038 to LPs, 0.0038 to PrizeEscrow |
| Helper sells 0.95 `Aurora_YES` at 0.20 = 0.190 ETH gross, minus 2.0% fee | +0.186 ETH from sale; 0.0038 ETH split: 0.0019 to LPs, 0.0019 to PrizeEscrow |
| Helper buys `Stratos_YES` with 0.559 ETH at 0.40, minus 2.0% fee | +1.369 `Stratos_YES`; 0.0112 ETH fee split: 0.0056 to LPs, 0.0056 to PrizeEscrow |
| Alice receives 0.95 (original) + 1.369 (bought) = 2.319 `Stratos_YES` | +2.319 `Stratos_YES` to Alice |

**Result after bet:**

- Alice spent: 1.0 ETH
- Alice holds: ~2.32 `Stratos_YES` + 50 `$OVERVIEW`
- Mission prize pool grew by: 0.05 ETH (from slice) + ~0.0113 ETH (PrizeEscrow from her swap fees) = ~0.0613 ETH
- LPs collectively earned: ~0.0113 ETH
- All numbers balance: 1.0 ETH in = 0.95 collateral + 0.05 prize. Collateral fully accounted in outcome tokens + fees.

**Settlement (Stratos wins):**

| Action | Money movement |
|---|---|
| Senate votes "Stratos won" | (off-chain governance, on-chain finalization) |
| `DePrizeReporter.report()` calls CTF.reportPayouts([1, 0, 0]) | (state change, no money) |
| Alice calls CTF.redeemPositions on 2.319 `Stratos_YES` | +2.319 ETH to Alice (from CTF collateral pool) |
| Winning team's milestone escrow releases 30% at M1, 70% at M2 | (goes to team, not Alice) |

**Alice's final position:**

- Spent: 1.0 ETH
- Received: 2.319 ETH (from winning bet) + 50 `$OVERVIEW`
- **Net profit: +1.319 ETH** plus whatever `$OVERVIEW` is worth post-mission

**Where Alice's profit came from:** The 2.319 ETH she redeemed came from the CTF collateral pool. That pool was funded by people who minted split sets and bought losing teams' tokens — i.e. people who backed Helios and Aurora. Her gain is their loss. Standard parimutuel.

### Example 2 — Bob bets 1 ETH on Helios. Helios loses.

**Bet placement:** identical structure to Alice's. Bob ends up with ~2.32 `Helios_YES` + 50 `$OVERVIEW`.

**Settlement (Stratos wins, Helios loses):**

- Bob's 2.32 `Helios_YES` tokens are worthless. CTF redemption returns 0 ETH.
- Bob still holds 50 `$OVERVIEW`.

**Bob's final position:**

- Spent: 1.0 ETH
- Received: 50 `$OVERVIEW` only
- **Net loss: −1.0 ETH** offset by whatever `$OVERVIEW` is worth post-mission (typically 0.025–0.10 ETH depending on outcome)

### Example 3 — Carol exits mid-campaign

Carol bets 1 ETH on Aurora when Aurora's price is 0.20 ETH. After the same 5% slice + 95% CTF flow, she ends up with ~4.62 `Aurora_YES` (higher token count because Aurora is the underdog) and 50 `$OVERVIEW`.

Two weeks later, news suggests Aurora is no longer competitive. The market price drops to 0.05 ETH. Carol decides to exit.

| Action | Money movement |
|---|---|
| Carol calls `exit(deprizeId, auroraTeamId, 4.62, minEth)` | (no upfront cost) |
| Router sells 4.62 `Aurora_YES` at 0.05 = 0.231 ETH gross, minus 2.0% fee | +0.226 ETH to Carol; 0.0046 ETH split: 0.0023 to LPs, 0.0023 to PrizeEscrow |
| Carol still holds 50 `$OVERVIEW` | (unchanged) |

**Carol's final position:**

- Spent: 1.0 ETH
- Received: 0.226 ETH + 50 `$OVERVIEW`
- **Net loss: −0.774 ETH** (mitigated by `$OVERVIEW` value)

She made a bad bet but limited her loss by exiting before settlement. Without DePrize's secondary market, she'd have been stuck holding worthless tokens at settlement.

### Example 4 — Cancellation

If the Senate declares "no winner" (e.g. sunset date passes without any provider eligible, or `$OVERVIEW` holder vote to cancel), the outcome is:

| Action | Money movement |
|---|---|
| `DePrizeReporter.report()` calls CTF.reportPayouts([1, 1, 1]) | (each outcome token type now worth 1/3 ETH) |
| `DePrizeMilestoneEscrow.refundToJB()` returns escrow ETH to JB | (raises pro-rata cashOut for all `$OVERVIEW`) |
| JB refund payhook activates per Overview Effect Terms Section 8 | (`$OVERVIEW` becomes cashable for ETH; 28-day claim window) |
| Alice calls `refundAll(deprizeId, toEth=true)` | Receives 2.319 / 3 = ~0.773 ETH from CTF + pro-rata JB cashOut |
| Bob calls same | Same: ~0.773 ETH + JB cashOut |
| Carol (who exited): no outcome tokens to redeem | Just JB cashOut on her 50 `$OVERVIEW` |

Concentrated bettors (Alice and Bob) recover ~80–95% of their stake in this scenario (improved vs the prior 10% slice design because more of their bet stayed in the CTF collateral pool). Balanced bettors (someone who held one of each team token) recover 100%. This loss is mathematically unavoidable with CTF parimutuel — once secondary trading happens, the protocol can't unwind trades. **It must be disclosed in the UI before any bet.**

# Appendix F — UX flows end-to-end

The mechanics are complex; the UI must hide that complexity from anyone who doesn't want to learn it. These sketches drove the design principles in Part I.

### Primary flow: placing a bet

The minimum number of steps for a bettor to back a provider.

1. **Land on `/deprize/frank`**. See three cards (Virgin, Zephalto, Unnamed) with: current odds (e.g., "40%"), live prize pool ($172k → growing), time remaining, and a "Back This Team" button.
2. **Click "Back This Team"** on the team they want.
3. **Modal opens**: enter ETH amount. The modal shows in real-time:
   - "You pay: 1 ETH"
   - "You receive if Virgin wins: ~2.32 ETH" (parimutuel payout estimate)
   - "Plus 50 `$OVERVIEW` tokens (mission receipts)" (small, secondary line)
   - "5% (~0.05 ETH) goes to the prize pool. Thanks for funding the mission."
   - One clear primary button: "Bet 1 ETH on Virgin Galactic"
4. **Confirm in wallet**. One transaction.
5. **Success screen**: "Done. You backed Virgin Galactic with 1 ETH. Watch your position at moondao.com/deprize/positions."

### Browse / discover flow

A `/deprize` index page listing all active DePrizes (currently just Frank). Each card:

- Mission name + hero image (Frank in flight suit, or balloon, etc.)
- Total prize pool with growth chart
- Time remaining
- Number of teams competing
- Recent activity ("$3k bet on Zephalto, 2 hours ago")

For the Frank DePrize, additional context: explanation of the Overview Effect, link to Frank's bio, mention of the Candidate selection process.

### Position management flow

A `/deprize/positions` page showing all of the user's active positions across DePrizes.

| Column | Example value |
|---|---|
| DePrize | Frank-to-space |
| Team backed | Virgin Galactic |
| Original bet | 1.0 ETH |
| Current value if settled now | ~1.5 ETH (based on current market odds) |
| Max payout if Virgin wins | ~2.32 ETH |
| `$OVERVIEW` held | 50 |
| Action | "Exit position" / "Increase bet" |

Show what the bettor cares about (P&L, max payout) not the underlying mechanics (CTF token balances, LP shares).

### Exit position flow

1. Click "Exit position" on a position card.
2. Modal shows: "You hold 1 ETH worth of Virgin_YES tokens. Current exit price: 0.67 ETH (accounting for slippage and 2% swap fee). Proceed?"
3. Confirm in wallet.
4. Receive ETH back. `$OVERVIEW` remains in wallet.

### Claim winnings flow (post-settlement)

1. User receives email/notification: "Virgin won! You're owed 2.34 ETH. Click to claim."
2. Land on `/deprize/claim`. Single button: "Claim 2.34 ETH."
3. Confirm in wallet. Receive ETH.

### Cancellation refund flow

1. User receives notification: "The Frank DePrize was cancelled. Click to refund."
2. Land on `/deprize/refund`. Page shows: "You bet 1 ETH on Virgin. Refund estimate: 0.85 ETH (15% loss due to parimutuel mechanics — see why)."
3. Single button: "Claim 0.85 ETH refund."
4. Confirm in wallet. Receive ETH. `$OVERVIEW` also redeemed automatically.

### Candidate selection flow (separate from betting)

Candidate selection runs in parallel and is a separate UI on `/deprize/frank/candidates`:

1. **Browse Candidates**: page lists eligible Citizens with their profile, contributions, and current `$OVERVIEW` pledge count.
2. **Pledge `$OVERVIEW`**: click "Pledge to this Candidate." Modal: "You'll pledge 50 `$OVERVIEW` to Alice. This counts as her support in Round 1 of the Selection Process. Tokens stay in your wallet."
3. Confirm. Done.

This is conceptually separate from betting and uses a different mental model (you're "voting for a person" not "betting on a provider"). The UI must make this distinction visually clear.

### What we'd cut if forced to ship MVP in 4 weeks

- No `/deprize/positions` aggregate view; just per-DePrize position view.
- No notifications; users self-monitor.
- No "Exit position" UI; show how to swap on Uniswap directly with a helper link.
- No advanced features; just bet + claim.

This MVP cuts UI surface by ~60% and still delivers a working DePrize. Useful sanity check on scope.

### Cognitive-load lessons from walking the flows

1. **The 2-pool concept is genuinely confusing.** Bettors will ask "where does my money go?" and the answer involves two different pools. The UI must use plain language ("5% funds the mission, 95% is your bet against other bettors") and not expose CTF / JB / FeeHook nomenclature.
2. **`$OVERVIEW` is the most confusing element.** It's a receipt, a governance token, AND has a cashOut floor — three roles. Most bettors won't engage with it. The UI should treat it like a printed receipt: visible but not central.
3. **Live odds make the bet feel like trading.** Show odds as a single number ("Virgin Galactic: 40% chance"), not a price ("Virgin_YES = 0.40 ETH"). Hide AMM mechanics.
4. **The milestone escrow is invisible to bettors.** Bettors don't need to know about M1/M2; they just see "you won, claim X ETH" at M1. Only the provider's UI surfaces milestones.
5. **Candidate selection feels disconnected.** The `/deprize/frank` page should have a secondary CTA: "Backed a provider? You can also pledge to a community Candidate."

**Implementation insight:** these UX learnings suggest on-chain naming should match user mental models (e.g., `DePrizeMint.bet(deprize, team)` instead of `splitPosition + routeToBettor`). Doesn't change the architecture, but cleaner naming reduces learning curve.

# Appendix G — LP economics deep dive

### Why LPs are hostile to outcome-token pools

Outcome-token AMM pools are notoriously hostile to liquidity providers:

- **Cliff risk at settlement**: an LP holding the losing side at settlement gets zero. Standard impermanent-loss math doesn't capture this — it's permanent loss.
- **Walk-toward-edge dynamics**: as the market converges on a winner, prices walk toward 0 or 1 for the loser tokens, generating maximum IL.
- **Settlement-day total loss**: even an LP who provided liquidity at fair odds for months gets crushed in the final week as the market resolves.

Without explicit incentives, external LPs simply won't show up. Bid-ask spreads will be huge (10–20%), exit prices terrible, and the prediction market loses signal quality.

### Alternatives considered

| Approach | Used by | Pros | Cons |
|---|---|---|---|
| **Standard Uniswap v3/v4 LP** | Generic | Familiar, audited, composable | Cliff risk; needs high fees to compensate |
| **LMSR (Logarithmic Market Scoring Rule)** | Augur, classical Gnosis | Bounded loss for operator, smooth pricing, no LP cliff risk | Operator funds the LMSR bond; capital-intensive; less price discovery |
| **CLOB (off-chain order book + on-chain settlement)** | Polymarket | No AMM problem; tight spreads | Off-chain infrastructure; centralized matching engine |
| **Concentrated liquidity (v3/v4)** | Uniswap | LPs concentrate in their expected range, earn more fees on same capital | Doesn't eliminate cliff risk; just makes LP positions more precise |
| **Vault-based LP (counter-party pool)** | dYdX, GMX | LPs share counter-party exposure across all markets | Doesn't translate well to outcome tokens; designed for perpetuals |
| **Treasury-as-LP** *(chosen)* | (proposed) | Eliminates need to attract external LPs; treasury earns all fees and accepts IL | Treasury bears all cliff risk; capital cost |
| **Hybrid: CLOB orderbook + small AMM backstop** | (proposed) | Tight spreads from CLOB; AMM ensures always-on liquidity | Complex; requires order book infra |

### Why LMSR (the as-built choice — this reverses the original draft)

> **The original draft rejected LMSR; the implementation chose it.** This section is updated to reflect that reversal.

LMSR is mathematically elegant for outcome-token pricing (used by classical Gnosis/Augur): bounded operator loss and smooth price discovery, with no LP cliff risk to underwrite. The original draft rejected it for three reasons, each of which dissolved during implementation:

- *"Requires a bonded operator (treasury)"* — true, but the treasury was already going to be the sole LP under the Uniswap plan, so this is not a new cost; and LMSR's loss is **bounded** by `funding`, which is strictly better than open-ended LP cliff risk.
- *"Less composable with Uniswap v4 / custom math = larger audit surface"* — moot, because MoonDAO **already has a deployed, working LMSR stack** (`prediction/contracts/LMSRWithTWAP.sol` + Gnosis CTF) used by the archived betting UI. Reusing it is *less* new code and audit surface than building Uniswap v4 pools + a custom `DePrizeFeeHook`.
- *"Loses the FeeHook integration that funds the prize pool"* — the FeeHook existed only to skim a protocol fee from swaps; LMSR has a **built-in `fee` parameter** that serves the same purpose without a separate contract. (The 5% primary slice — the main prize-funding mechanism — is unchanged and lives in `DePrizeMint`, independent of the market.)

Net: reusing CTF + `LMSRWithTWAP` deleted two planned contracts (`DePrizeFeeHook`, `DePrizePrizeEscrow`), removed the need to attract or model external LPs, and gave bounded treasury downside. That is why the as-built market layer is LMSR, not Uniswap LP pools.

### Why not CLOB (Polymarket-style)?

CLOB delivers the tightest spreads. But it requires off-chain order matching infrastructure, a team of market makers (not just LPs), centralized custody of matched orders pre-settlement, and significant additional engineering. Out of scope for v1 pilot; possible v2 enhancement if Polymarket-like volume materializes.

### Treasury LP economics worked example

Assume 3-team DePrize, treasury seeds 1 ETH per pool (3 ETH total). Campaign sees $1M in primary mints + $5M in swap volume. At sunset:

- LP fees earned: 1.0% × $5M = $50k = ~16.7 ETH at $3k/ETH
- Cliff loss on 2 losing pools: ~2 × 1 ETH = ~2 ETH (assuming clean walk-to-edge)
- Net treasury profit on LP: ~14.7 ETH
- Treasury also earned: 5% slice on $1M primary = $50k = ~16.7 ETH (to PrizeEscrow, not treasury)
- Plus 1% protocol fee × $5M = $50k to PrizeEscrow

So at moderate activity, the treasury earns ~15 ETH on its LP position with bounded downside. Good economics for the treasury, good UX for bettors (always-on liquidity).

At very low activity (Scenario A), treasury earns proportionally less but cliff loss is also smaller (less price walk). Manageable. At very high activity (Scenario C-like), treasury earns substantially more (10-100x) with the same cliff loss. Excellent economics.

### Treasury LP unwind at settlement

At M1 (settlement), the per-team Uniswap pools enter their endgame:

- The **winning team's pool** prices to ~1.0 ETH per `YES` token (since each `YES` will redeem for 1 ETH via CTF).
- The **losing teams' pools** price to ~0 ETH per `YES` token.

For the treasury's LP position:

| Pool | Treasury position before settlement | Treasury position after settlement |
|---|---|---|
| Winning team's pool | ~half ETH / ~half `Winner_YES` (whatever the concentrated range holds) | All `Winner_YES` (since `YES` price moved to 1.0) — treasury redeems `Winner_YES` for ETH via CTF |
| Losing teams' pools | Concentrated LP including some `Loser_YES` | All `Loser_YES` (since price moved to 0) — `Loser_YES` worthless; treasury writes off |

**Treasury unwind sequence (per pool, called by treasury keeper bot or anyone via permissionless trigger):**

1. After M1, call `DePrizeFeeHook.unwindPool(deprizeId, teamId)` which:
   - Withdraws all LP positions for the treasury.
   - For the winning team: redeems the recovered `YES` tokens via `CTF.redeemPositions` for ETH.
   - For losing teams: `YES` tokens are worthless; treasury accepts the write-off.
2. Withdrawn ETH (and the original seed minus IL minus fees earned) flows back to the MoonDAO treasury.
3. Pool is closed (cannot be reopened for that DePrize).

**Realized P&L example (3-team DePrize, Scenario B with $500k pool):**

- Treasury seeded 3 × 1 ETH = 3 ETH total (at $3k/ETH = ~$9k).
- LP fees earned across all pools over the campaign: ~5 ETH ($15k at moderate $5M swap volume).
- Recovered from winning pool LP unwind: ~1 ETH (the seed plus rebalancing toward winner).
- Recovered from each losing pool LP unwind: ~0 ETH (all converted to worthless `Loser_YES`).
- Net treasury position: 1 ETH recovered + 5 ETH fees − 2 ETH seed cliff loss = +4 ETH net profit.
- Plus: 5% slice on primary mints went to PrizeEscrow (not treasury), 1% protocol fees went to PrizeEscrow (not treasury). Treasury's economic role is purely LP.

**External LPs allowed but not required.** Treasury is the sole LP at launch. External parties (e.g., DEX market makers, prediction market specialists) may add liquidity to any pool. They face the same cliff risk and earn the same 1.0% LP fee. If external LPs show up, the treasury can withdraw proportionally to maintain a target concentration; this is operational, not contractual.

# Appendix H — Contract code stubs

### `DePrizeMint.bet` (as built, M3)

```solidity
function bet(uint256 deprizeId, uint256 outcomeIndex, uint256 outcomeTokenAmount, uint256 maxCost)
    external payable nonReentrant
{
    if (!registry.bettingOpen(deprizeId)) revert BettingClosed(deprizeId);
    uint256[] memory teams = registry.teamIds(deprizeId);
    if (outcomeIndex >= teams.length) revert BadOutcomeIndex(deprizeId, outcomeIndex);
    address market = marketOf[deprizeId];
    if (market == address(0)) revert MarketNotSet(deprizeId);

    uint256 slice  = msg.value / SLICE_DENOMINATOR; // 5%
    uint256 budget = msg.value - slice;             // 95%

    // 5% slice -> Juicebox; bettor is beneficiary (receives $OVERVIEW).
    jbTerminal.pay{value: slice}(
        registry.getDePrize(deprizeId).jbProjectId,
        JBConstants.NATIVE_TOKEN, slice, msg.sender, 0, "DePrize bet", ""
    );

    // Price on LMSR. calcNetCost EXCLUDES the fee; MarketMaker.trade pulls net + fee.
    ILMSRWithTWAP m = ILMSRWithTWAP(market);
    int256[] memory amounts = new int256[](teams.length);
    amounts[outcomeIndex] = int256(outcomeTokenAmount);
    int256 net = m.calcNetCost(amounts);
    if (net <= 0) revert NonPositiveCost();
    uint256 cost = uint256(net) + m.calcMarketFee(uint256(net));
    if (cost > budget || cost > maxCost) revert CostTooHigh(cost, budget, maxCost);

    // Wrap, update TWAP, then trade DIRECTLY (tradeWithTWAP self-calls -> wrong msg.sender).
    weth.deposit{value: cost}();
    weth.approve(market, cost);
    _inBet = true;
    m.updateCumulativeTWAP();
    m.trade(amounts, int256(cost)); // CTF mints ERC-1155 to this contract (captured in receiver hooks)
    _inBet = false;

    _flushOutcomeTokens(msg.sender);          // forward outcome tokens to bettor
    uint256 leftover = budget - cost;          // (+ any swept residual WETH)
    if (leftover > 0) { (bool ok,) = msg.sender.call{value: leftover}(""); if (!ok) revert RefundFailed(); }
    emit Bet(deprizeId, msg.sender, outcomeIndex, outcomeTokenAmount, cost, slice);
}
```

No Uniswap swap, no fee hook, no `splitPosition` — the LMSR market mints the chosen team's outcome tokens directly and charges its built-in 1% fee. `setMarket(deprizeId, market)` (onlyOwner) validates `pmSystem == ctf`, `collateralToken == weth`, `atomicOutcomeSlotCount == #teams`, and `conditionIds(0) == registry.ctfConditionId` before binding.

### `LaunchPadPayHook` (Registry-aware upgrade, as built M2)

The hook gains one **optional, write-once** pointer, `IDePrizeRegistry public deprizeRegistry` (set via owner-gated `setDePrizeRegistry`, which reverts once set so it can't be detached or repointed). A single helper decides whether DePrize gating applies:

```solidity
function _deprizeIdFor(uint256 projectId) internal view returns (uint256) {
    if (address(deprizeRegistry) == address(0)) return 0; // no registry → original behavior
    return deprizeRegistry.deprizeIdByJBProject(projectId); // 0 → original behavior
}
```

So every path keeps its **exact original behavior** unless a registry is set *and* the project is bound to a DePrize. When a DePrize is attached:

| Hook path | Non-terminal (DRAFT…M1_RELEASED) | Refundable terminal (CANCELLED / NO_WINNER / M2_FAILED) | Success terminal (M2_COMPLETE) |
|---|---|---|---|
| `beforePayRecordedWith` | contributions **allowed** (immutable deadline ignored) | **reverts** (closed) | **reverts** (closed) |
| `beforeCashOutRecordedWith` | **reverts** (DePrize active) | refund **allowed**, no expiry window | **reverts** (DePrize active) |
| `stage()` | `1` | `3` | `1` |

`fundingTurnedOff` remains an emergency owner override that wins over everything. Finer milestone-gated staging (a `2` stage tied to `DePrizeMilestoneEscrow`) was **deliberately deferred** to keep M2 free of the escrow dependency — `SETTLED`/`M2_COMPLETE` return `1` for now. The refund-supply math (`currentFunding × rulesetWeight / 2e18`) is unchanged from the original hook. See [`DEPRIZE_M2.md`](./DEPRIZE_M2.md).

# Appendix I — `$OVERVIEW` dilution math

**Pre-DePrize state** (current):

- ~$172k raised → ~57.3 ETH at $3k/ETH → ~57,300 `$OVERVIEW` outstanding (at 1,000 per ETH).
- 100% of contributed ETH minted tokens (full launchpad rate).
- All `$OVERVIEW` outstanding is backed 1:1 by ETH in the JB project.

**Post-DePrize (Option 1) state**:

- Existing 57,300 `$OVERVIEW` remains outstanding, backed by the existing ETH (now seed prize pool).
- **New bets mint `$OVERVIEW` at 1/20 the rate of existing contributors** (because only 5% of bet value goes to JB primary). A new bettor putting 1 ETH gets 50 `$OVERVIEW` (vs 1,000 historically).
- This is a 20× advantage for existing holders. They are NOT diluted in ETH terms — they're diluted in token-count terms, but the per-token ETH backing actually grows (because the 1% swap fee also routes ETH into the JB project / PrizeEscrow without minting new tokens).

**Dilution math worked example:**

Assume DePrize campaign sees $1M in new bets and $5M in swap volume over 12 months.

| Source | ETH into prize pool | `$OVERVIEW` minted |
|---|---|---|
| Pre-DePrize state | 57.3 ETH | 57,300 |
| New bets 5% slice ($1M × 5%) | ~16.7 ETH | 16,700 |
| Swap fees ($5M × 1%) | ~16.7 ETH | 0 (no minting on swap fees) |
| **Total at sunset** | **~90.7 ETH** | **74,000** |
| ETH per `$OVERVIEW` token | — | 0.00122 ETH (was 0.001) |

Existing holders' tokens are worth **22% more in ETH terms** at sunset due to swap-fee inflow without dilution. New bettors who minted at 5% slice get exposure proportional to their primary participation, plus their CTF outcome-token P&L.

This is a desirable property: existing holders are rewarded for taking early risk, and new bettors get a smaller `$OVERVIEW` allocation in exchange for a (potentially large) parimutuel upside on the CTF side.

**At settlement (M2 disbursed):**

- The prize pool flows out to the winning provider. `$OVERVIEW` is no longer backed by ETH; its value is now purely speculative (post-mission market value).
- The cashOut floor disappears at M2 (cashOut becomes 0 or near-0).
- This is communicated upfront and is the same dynamic as any standard launchpad-funded mission.

**On cancellation:**

- ETH stays in JB project. cashOut becomes available.
- Each `$OVERVIEW` token redeems for proportional ETH from the JB project balance.
- Existing holders benefit from the swap-fee buildup; new bettors lose their CTF positions but get back ETH proportional to their 5% slice contribution.

**No airdrop or compensation for existing holders.** Existing contributors got a much more favorable `$OVERVIEW` issuance rate than new bettors will (100% of ETH minted tokens, vs the new 5% slice — a 20× advantage). That is the compensation for taking early risk. No additional airdrop is needed and proposing one would invite anti-dilution attacks (people gaming the migration boundary).

# Appendix J — Migration sequence and Unified DePrize scenarios

### Migration as a sequence of on-chain actions

```text
1. Deploy DePrize contracts on Arbitrum mainnet
   (Registry, Mint, PrizeEscrow, MilestoneEscrow, Reporter, FeeHook).
2. Register Virgin Galactic, Zephalto, and the unnamed provider as MoonDAOTeam NFTs
   (or equivalent identifiers if they are not on-boarded as full MoonDAO teams).
3. Pin tier-specific demonstration criteria per provider to IPFS.
   Register initial 2-seat quotes (Virgin $1.5M, Zephalto $390k, Unnamed $0).
4. Upgrade LaunchPadPayHook to DePrize-aware version that reads state from Registry
   (see Appendix H).
5. 3-way $OVERVIEW-holder proposal opens. 7-day discussion + 7-day vote.
   - Snapshot of existing $OVERVIEW holders posted to IPFS.
   - Pinned spec (this document + addresses) referenced from the proposal.
6. If Option 1 (Unified DePrize) wins:
   - Admin Safe calls Registry.register(jbProjectId=FRANK,
     teamIds=[Virgin, Zephalto, Unnamed], sunset=...), which assigns and
     returns the new deprizeId (1; id 0 is the "no DePrize" sentinel).
     Quotes / preference order are configured separately.
   - LaunchPadPayHook reads DePrize state and gates cashOut accordingly.
   - Treasury seeds the three ETH/Team_X_YES pools (~1 ETH each).
   - DePrize #0 transitions DRAFT → OPEN. New bets accept.
7. If Option 2 (Zephalto direct) wins:
   - Admin Safe places the 20% deposit (~$78k) with Zephalto per the proposal.
   - A follow-up fundraise (~$312k) closes the gap to €360k.
   - DePrize contracts remain deployed for future missions.
8. If Option 3 (refunds) wins:
   - Existing refund payhook activates per Overview Effect Terms Section 8.
   - DePrize contracts remain deployed for future missions.
```

### Worked Unified DePrize scenarios (full money flow)

**Setup (DePrize-open):**

| Parameter | Value |
|---|---|
| Existing JB project pool at migration | ~$172k (the full Overview Effect raise; no payouts have been disbursed) |
| Current 2-seat quotes | Virgin: $1.5M, Zephalto: $390k (€360k), third provider: $0 (always eligible) |
| Senate preference order | Virgin > Zephalto > third provider |
| Sunset date | 18 months from DePrize-open |

**Scenario A — Low activity (most likely default).** Starting from $172k seed, pool grows to ~$300k over 18 months from sparse betting + small direct contributions. Pool TWAP at sunset ≈ $260k.

- Eligible at sunset: third provider only (Zephalto needs $390k; Virgin needs $1.5M).
- Senate confirms with third provider that current price is still ≤ pool. Confirmed.
- Senate vote: third provider wins.
- Their `YES` token holders redeem ETH from the parimutuel pool. Other YES tokens worthless.
- M1 releases 30% (~$90k) to third provider's Safe.
- After Frank + Candidate fly, M2 releases remaining 70% (~$210k).

**Scenario B — Moderate rally (Zephalto unlocks).** Starting from $172k seed, community push drives pool to $500k via heavy direct contributions + active betting volume. Pool TWAP exceeds Zephalto's $390k threshold for 30 consecutive days at month 9. Zephalto becomes permanently eligible.

- Eligible at sunset: Zephalto, Unnamed.
- Senate preference: Zephalto > Unnamed → confirms with Zephalto that quote is still ≤ pool.
- Zephalto wins.
- Zephalto_YES holders redeem ETH. Unnamed_YES holders get nothing.
- Milestone releases tied to actual Frank + Candidate flight on Zephalto.

**Scenario C — Strong rally (Virgin unlocks).** Major external sponsor contributes $1M direct, plus heavy betting brings pool to $2M. Virgin becomes eligible mid-campaign.

- Eligible at sunset: Virgin, Zephalto, Unnamed.
- Senate preference: Virgin > Zephalto > Unnamed → confirms with Virgin.
- Virgin wins.
- Virgin_YES holders redeem ETH. Other YES tokens worthless.
- Frank + Candidate fly Virgin Galactic to actual space.

### Bettor implied-odds dynamics

Throughout the campaign, market prices reflect a probabilistic blend of "which provider will be eligible AND win." Sophisticated bettors price the joint probability:

- `Unnamed_YES` price ≈ P(Zephalto doesn't qualify) × 1.0 + P(Zephalto qualifies but Virgin doesn't) × 0 + P(Virgin qualifies) × 0 = P(only unnamed eligible)
- `Zephalto_YES` price ≈ P(Zephalto qualifies) × P(Virgin doesn't qualify)
- `Virgin_YES` price ≈ P(Virgin qualifies)

In early campaign with pool at $30k, expected prices: Unnamed ~0.85, Zephalto ~0.13, Virgin ~0.02 (rough). As pool grows or community signals stronger rally, Zephalto and Virgin prices appreciate. Bettors with conviction on a particular outcome have asymmetric upside.
