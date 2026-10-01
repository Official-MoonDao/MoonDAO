# State of MoonDAO and priorities for the next two quarters

Research brief behind [`EB_PROPOSAL_Q4_2026_Q1_2027.md`](./EB_PROPOSAL_Q4_2026_Q1_2027.md).
Snapshot taken September 28–29, 2026 from public chain data, Tableland, IPFS, and this repository.
Prices: ETH $2,697, WBTC $83,826, MOONEY $0.000190 (DefiLlama, 2026-09-29 06:43 UTC).

This is a compilation, not an audit. Every number below comes with its source in §10.

---

## 1. Summary

1. **The products are built; almost none of them are public.** The DePrize contracts are on Arbitrum mainnet, but the four capability-ladder rungs run on Sepolia only. `/moonbase`, `/deprize`, and `/deprize-play` sit behind a shared-password gate. Nothing can earn until it ships.
2. **Touchdown has a hard deadline.** Astrobotic's Griffin launches no earlier than November 2026 and is the only competitor that can land in 2026. The rung has to be live and public before that launch, which is why the proposal's first milestone is November 1.
3. **Revenue is far below what past proposals assumed.** Measured cash revenue over the trailing twelve months is about **$4.5k**. MDP-249 cited $24.5k, and MDP-194 set a target of $100k.
4. **The treasury rallied, but the burn has not changed.** Official liquid AUM is **$451.8k**. It was $288.8k on July 1 and $327.9k on August 14; the increase is almost entirely ETH price. After about $22k of committed but unpaid outlays (§4.4), that is about 15 months of runway at the MDP-249 cost stack, against the three-year standard set in MDP-176 and MDP-194.
5. **The August financial disclosure double-counts $181k.** It lists 96 ETH as still staked, but Kiln returned 97.8 ETH to the treasury on June 15, 2026. Its "16 months including staked ETH" runway figure is therefore wrong. Staking income has also stopped.
6. **Stablecoins are about $27k.** That is less than one month of burn, so the next EB budget has to be converted from ETH and WBTC as it is paid. The draft pays it in two transactions three months apart.
7. **Frank's raise has stalled since the re-open.** About $172k was raised or pledged in March and April. The Juicebox project holds 27.39 ETH (~$74k), and only +0.65 ETH has come in since the July re-open. Holders voted 92.9% for "keep options open, two seats".
8. **The network grew but missed its targets.** Citizens went 199 → 262 (target 300) and Teams 20 → 26 (target 30). Q3 2026 was still the best subscription quarter on record.
9. **This is probably the last EB term the treasury can fund at this rate.** At today's prices, and after committed outlays, the proposed envelope leaves about $220k–$263k at the end of March 2027. The term therefore has to produce revenue, external capital, or a lower fixed cost. The automation objective is the plan for the last of those.

---

## 2. What the past EB proposals looked like

| Proposal | Term | Budget | Core team | Headline targets | Outcome |
| :-- | :-- | :-- | :-- | :-- | :-- |
| MDP-176 | Q2–Q4 2025, 6 months | $216k ($36k/mo) | 5 | On-chain ARR $18.7k → $126k | Launchpad launched May 2025 |
| MDP-194 | Q4 2025–Q2 2026, 6 months | $222k + 85M MOONEY ($37k/mo) | 5 | ARR $100k+; flagship raise $1M; Citizens 150 → 250; Teams 20 → 25 | Final report: $7.8k network ARR; Space Camp raise ~$11k; Citizens 164 at midpoint. Grades: Meets, Meets, Does Not Meet |
| MDP-249 | May–Sep 2026, 5 months | $132k core + $24k bonus ($26.4k/mo) | 3 | DePrize deploy; lunar challenge raise; Citizens 199 → 300; Teams 20 → 30; EB election | See §5 |

**Template notes carried into the new draft**

- Section order follows MDP-194 and MDP-249: Abstract, Problem Statement, Solution (with a revenue table and team structure), Benefits, Risks, OKRs, Performance Bonus, Budget.
- MDP-249's body was titled "Q4 2025 – Q2 2026" (copied from MDP-194), and it cited three different core totals ($132k, $145.5k, $157k). The new draft uses one set of numbers throughout.
- MDP-194 and MDP-249 set targets without midpoints, which made the "off pace" call in the MDP-194 final report subjective. The new draft gives every key result a December 31 midpoint.
- Revenue targets have been missed by roughly an order of magnitude two cycles in a row. The new draft counts only cash that reaches a Safe, measured the same way `/admin/financial-overview` measures it, and keeps accrued LP fees and staking out of the target.

---

## 3. Treasury

### 3.1 Official AUM (definition used by the site: eight Safes on their home chains plus the WETH side of the Uniswap V3 position; MOONEY excluded)

| Holding | Units | USD |
| :-- | --: | --: |
| ETH treasury — ETH | 90.047 | 242,864 |
| ETH treasury — WBTC | 1.435 | 120,309 |
| ETH treasury — USDC | 8,920 | 8,920 |
| ETH treasury — DAI | 8,576 | 8,576 |
| ETH treasury — WETH, SAFE | 0.108 / 7,419 | 1,087 |
| Uniswap V3 #686147 — WETH side | 21.657 | 58,411 |
| Arbitrum treasury — ETH + USDC | 0.782 / 9,560 | 11,670 |
| Other designated Safes | — | 0 |
| **Official AUM** | | **451,837** |

MoonDAO controls another **$12.1k** outside that perimeter: 4 WETH on Polygon at the Arbitrum treasury address, 0.05 ETH on Base, and $1.1k left in the EB Safe. The expanded total is **$463.9k**.

The mix is about 67% ETH (112.6 ETH), 27% WBTC, and 6% stablecoins. Each $100 move in ETH changes AUM by about $11.3k, so a 20% drop in ETH would take about $61k off.

**MOONEY (memorandum only).** The DAO holds about 653M MOONEY, roughly $124k at $0.000190. That breaks down as 270.9M in the ETH treasury, 302.1M in the LP, 47.3M in the Arbitrum treasury, and 24.9M in the `VotingEscrowDepositor`. Total supply is 2.62B. About 306M is locked as vMOONEY (127M on Ethereum, 179M on Arbitrum). The main pool is full-range at a 1% fee with about $58k per side, so a $10k buy would move the price about 37% and a $1k buy about 3.5%.

### 3.2 Change over time

| Date | Figure | Basis |
| :-- | --: | :-- |
| Mar 2025 (MDP-176) | ~$974k | All treasuries incl. staked ETH and amounts owed, ex-MOONEY |
| Oct 2025 (MDP-194) | ~$1,239k | Same basis |
| May 2026 (MDP-249) | ~$600k | Stated "starting assets" |
| Jul 1, 2026 | $288.8k | Official AUM, ETH $1,570 (Q4 project-budget base) |
| Aug 14, 2026 | $327.9k | Official AUM, ETH $1,885 |
| Sep 28, 2026 | $451.8k | Official AUM, ETH $2,697 |

The first three figures use a wider perimeter than the last three, so the comparison is directional only.

### 3.3 Correction: the 96 ETH is no longer staked

On June 15, 2026, Kiln's `ConsensusLayerFeeDispatcher` (`0x56a0…a3bc`) sent the ETH treasury three transfers of 32.48, 32.85, and 32.48 ETH, for 97.81 ETH in total. That is the three validators' principal plus rewards. Two days later, on June 17, 59 ETH went to the payout Safe `0xbbbc…d886` to fund MDP-249 (see §4.2). The August 14 disclosure nevertheless counted "96 ETH staked, not withdrawn, $181,119" on top of liquid ETH that already included it. As a result, its expanded net assets, its "16.2 months including staked ETH" runway, and its note that the project base includes staked ETH are all overstated.

The Q4 project pot is not affected, because MDP-267 bases it on official liquid AUM. Two things still need checking: any site metric that reads `STAKED_ETH_ADDRESS`, and the monthly-burn figures in `docs/FINANCIAL_DISCLOSURE_AND_BURN_REPORT_2026-08-14.md`.

---

## 4. Revenue and costs

### 4.1 Cash revenue into the Arbitrum treasury, trailing 365 days

| Stream | ETH | USD | Payments |
| :-- | --: | --: | --: |
| Citizen subscriptions | 0.955 | 2,575 | 86 |
| Team subscriptions | 0.668 | 1,800 | 6 |
| Launchpad (Juicebox terminal payouts) | 0.048 | 128 | 2 |
| DePrize fees | 0 | 0 | — |
| **Total** | **1.670** | **~4,500** | |

These come from Etherscan v2 internal transactions to `0xAF26…70c0`, matched by sending contract, using the same method as `canonicalRevenue.ts` and `programRevenue.ts`. Larger inflows in the window came from bridges and MoonDAO-controlled Safes (8.53 ETH in Nov 2025, 20.28 ETH in Jan 2026, and 31.9k + 6.4k USDC in May and August 2026). They are internal moves, not revenue.

**Subscriptions by quarter (ETH):**

| 2025 Q3 | 2025 Q4 | 2026 Q1 | 2026 Q2 | 2026 Q3 |
| --: | --: | --: | --: | --: |
| 0.145 | 0.111 | 0.189 | 0.422 | **0.878** |

Q3 2026 had 28 Citizen payments and 3 Team payments, the best quarter on record. Current prices are 0.0111 ETH (~$30) per year for Citizens. For Teams, `/join` shows 0.0333 ETH; the on-chain base is 0.5 ETH per year with a discount applied. One Team paid the full 0.5 ETH on Aug 26, and every other Team payment this year was 0.0335 ETH.

**Not in the total.** Uniswap V3 fees accrue inside the position and are not cash. MDP-194 estimated them at about $10.6k per year, but that figure was not re-measured here. Staking yield ended on June 15.

**Secured Launchpad fee on Frank's raise.** The campaign has already taken in ~$172k raised or pledged. At today's ETH price that is about **$190k**: 27.39 ETH in JB project 73 ($73.9k) plus $116.5k in off-chain pledges. The raise is treated as successful, so the Launchpad fee is taken from that total on payout. The usual split is 2.5% cash to the treasury and 5% into MoonDAO-owned liquidity. No liquidity will be added, so both slices go to the treasury as cash: **7.5% ≈ $14,300** ($4,800 + $9,500). That is one-time, not recurring. It is in the proposal's revenue table and the end-of-term cash target.

### 4.2 What MDP-249 actually cost

MDP-249 disbursed about $125.6k against a five-month core of $132k, so it came in on budget:

- May 28: 26,400 USDC from the Arbitrum treasury to the EB Safe (month 1; salaries paid May 29).
- June 17–18: 59 ETH from the ETH treasury went to the payout Safe and was then routed through LI.FI and CoW. That produced 52.76 ETH and 9,990 USDC in the EB Safe, worth about $99k at the time.
- June 19: 52.77 WETH went into four `Simple Vesting Escrow` contracts (26.04 for Pablo, 16.28 for Ryan, and 8.95 + 1.49 for Miguel). The escrows vest from **June 1 to September 29, 2026**, and were sized at about $1,825 per ETH to cover the remaining MDP-249 salary lines.

The EB Safe now holds $1.1k. Because the salary escrows end September 29, the new term starts cleanly on October 1, and there is a pay gap until the new proposal passes.

The bonus pool payout was not traced.

### 4.3 Project system

| Cycle | Pot | Rule |
| :-- | --: | :-- |
| Q3 2026 | $24,310 | 5% of net member assets (v8) |
| Q4 2026 | $8,500 | 3% of official liquid AUM on Jul 1 (MDP-267, v9); max $2,125 per proposal |
| Q1 2027 | ~3% of AUM on Jan 1 | ~$10–13k at current prices |

Q4 intake closes October 8, editing closes October 13, and the Senate votes October 15. As a non-project proposal, the EB proposal should be submitted inside this window.

### 4.4 Runway (official AUM $451.8k less $22.3k committed outlays, prices held constant)

**Committed but unspent outlays ($22.3k).** These are already owed and are taken off AUM before the runway is computed.

- **Q3 2026 grant second halves, $6,406.** On Aug 3 the payout Safe (`0xbbbc1ec0…d886`) paid exactly half of each Q3 grant: $2,320 (MDP-260), $2,300 (MDP-262), $2,341 (MDP-258), $1,215 (MDP-259), and $550 (MDP-265), $8,726 in total. The Arbitrum treasury paid MDP-260's second half ($2,320) on Sep 9, and the other four are still owed.
- **Q3 2026 retro and Contributor Circle, $6,858.** $4,427 + $2,431, from `PROJECT_CYCLE.retro`; paid after the Q3 cycle closes.
- **MDP-249 milestone bonuses, up to $9,000.** See §5; subject to the Senate's review.

The same Aug 3 batch paid the Q2 retro ($5,629.26) and the Q2 Contributor Circle ($2,340.89) in full. The May 11 Q2 grant payments do not split cleanly into halves, so whether any Q2 grant balance is still owed was not confirmed.

| Scenario | Net monthly burn | Months |
| :-- | --: | --: |
| MDP-249 stack held flat ($26.4k EB + $2.8k projects − $0.4k revenue) | $28.9k | 14.9 |
| Proposed core only | $27.7k | 15.5 |
| Proposed core + all gated programs | $34.2k | 12.6 |
| Proposed maximum (programs + bonus cash) | $35.0k | 12.3 |
| Three-year standard (MDP-176 / MDP-194) | ≤ $11.9k | 36 |

End-of-term AUM at constant prices would be about $263k with core only and about $220k at the maximum. No proposal in the last three cycles has met the three-year standard, and this one does not either. The draft makes that explicit and commits to a Q2 2027 plan with guaranteed EB cost at or below $15k per month.

---

## 5. MDP-249 scorecard

"Not found" means there was no evidence in the repo or on-chain; it may exist elsewhere.

| Key result | Status | Evidence |
| :-- | :-- | :-- |
| DePrize contracts, mechanics, arbitration deployed | **Met, late** | DePrize 0.8 on Arbitrum; internal prize Aug 25–Sep 1 (month 3); H-01 fix Sep 11 |
| First lunar-component challenge launched via Launchpad with inflow | Not met | Ladder is Sepolia-only; pages gated |
| Simulator live and prototype results published | Partial | Moon Base Zero built, gated; no prototype results |
| Reusable DePrize playbook ratified | Partial | Rules, QA, and rehearsal docs exist; not ratified |
| Seat for Frank secured | Not met | Path vote (Option B) done; raise re-opened |
| Citizens 199 → 300 | Not met | 262 (+63 of +101) |
| Teams 20 → 30 | Not met | 26 (+6 of +10) |
| ≥ 60% Team utilization; 15 new jobs; 15 new listings | Partial | 62% utilization; 7 new jobs; 16 new listings |
| 15 Team discovery calls; ship top two enhancements | Not found | — |
| New project system, 100% migration | **Met** | v9 live (MDP-267, Sep 16) |
| For-profit arm proposal by end of Q3 | Not met | `presentations/newco-seed-deck/` is empty |
| Operational audit; cost reduction from month 4 | Partial | Aug 14 disclosure; no cost-cut report found |
| Realistic Goals 2026–2027 document | Not found | — |
| Within envelope with monthly public burn reporting | Partial | On budget; one public disclosure; dashboard is operator-gated |
| EB election by end of Q3 | Not met | No election found |
| Europe / GDPR | Partial | Teams open to EU/EEA (Jul 23); Citizens still geoblocked in EU/EEA/UK |
| Advisory board plan | Not found | — |

**Bonus milestones (for the Senate's review):**

- M3 utilization ($2k) and M4 project system ($1k) are verifiable.
- M1 is a judgment call. The contracts are live on mainnet, but there is no public prize pool.
- M2 was not met, nor were the rest of M3 and M4.
- On the evidence found, $3k of the $24k pool is clearly earned, plus $0–6k for M1.

---

## 6. Status of the major initiatives

### 6.1 DePrize and the capability ladder

- **Arbitrum.** The shared infrastructure is live: Gnosis CTF, the LMSR factory with the H-01 fix (`0x299F…8F3D`), and the DePrize 0.8 registry, mint, redeem, fee router, and a separate MissionCreator. DePrize 1, "The Moon is a harsh mistress", was an internal test (JB project 82, 0.04 ETH seed).
- **Sepolia.** Touchdown is #7; its v2 rehearsal is Executive-Safe operated at 3-of-4 and was written up on Sep 28. First Tracks is #5, Water Ice #6, and Night Shift #3. Only Touchdown has full rules of record. Night Shift is intentionally a placeholder until 2028.
- **Compliance.** Controls are built: the U.S. and restricted-jurisdiction exclusion, VPN, sanctions, and attestation checks, permit logging, the reconciliation cron, and compliance alerts. The marketing checklist forbids paid DePrize promotion into restricted regions.
- **Free forecasts.** The Forecasts table exists on Sepolia only; Arbitrum is not deployed.
- **Touchdown roster timing:**
  - Griffin: Q4 2026, launch NET November, possible December landing.
  - IM-3: January–March 2027.
  - Blue Ghost M2: NET December 2026, more likely 2027.
  - Blue Moon MK1: 2027, after the May 28 New Glenn pad loss.
  - Chang'e-7: launch February–March 2027, landing around May–June.
  - ispace ULTRA: 2028.
- **Revenue model.** The 1% LMSR fee can be swept to the treasury, and 5% of every bet goes to the prize pool (not revenue). Expect fee income to be small unless volume is large, so sponsorship of purses and districts is the more realistic money.

### 6.2 Moon Base Zero (`/moonbase`)

- The dataset (updated Sep 4) has 12 capability races, 50 projects, and 33 organizations.
- Per-competitor models are complete for the Touchdown district (6 of 6) and the habitat district (2 of 2). Comms is 3 of 4. Construction still renders one generic model four times, which is the most visible gap.
- The page was shown at Rio Innovation Week from a local build. It is not public.
- Q3 projects that could feed it or a rung:
  - MDP-261 Digital Lunar Economy Simulation
  - MDP-265 Interactive NASA Lunar Base Model
  - MDP-262 FUTURA rover proof-of-concept (First Tracks)
  - MDP-260 Human Rated DAO Vacuum Chamber (Night Shift's chamber proxy)

### 6.3 Frank White / Overview Effect Flight

- **Original raise.** March 12 – April 27, 2026: ~$172k raised or pledged across 157 contributions, against a 965 ETH goal.
- **On-chain today.** JB project 73 on Arbitrum holds 27.39 ETH (~$74k). All 94 on-chain backers are seeded in the exact-refund ledger.
- **Re-open.** From July at 500 $OVERVIEW/ETH, only +0.65 ETH (~$1.7k) has come in.
- **Path vote** (closed Jun 22). Option B won with 92.9% (9,702 of 10,444 $OVERVIEW; 31 voters): keep options open, fundraise for two seats, refundable deposits only.
- **Negotiation findings.**
  - 12 companies engaged.
  - One stratospheric seat is fundable today; two seats are not.
  - No stratospheric provider is operating crewed flights.
  - Virgin Galactic sent a contract: the deposit is affordable, the full price is not.
  - An early-stage balloon partnership could fit two seats.
  - Zephalto, whose two seats cost about €360k (~$390k), is now MoonDAO Team #25.
- **Candidate pipeline.** The $OVERVIEW delegation leaderboard has 65 entries.

The gap is roughly $390k for two Zephalto seats against ~$172k raised or pledged, so the draft sets +$50k by the midpoint. The end-of-term target is to cover two seats through raise + pledges + a partner price, not through the treasury. On payout, 7.5% of the existing raise (~$14,300 at today's prices) goes to the treasury as cash; see §4.1.

### 6.4 Network, pricing, and growth

- **Size.** 262 Citizens (on-chain supply; 261 Tableland rows) and 26 Teams. Teams include Intuitive Machines, The Mars Society, LifeShip, Space for Humanity, and Zephalto.
- **Jobs.** 18 posted in total by 9 Teams; 7 are active today.
- **Marketplace.** 26 listings by 12 Teams. 16 of 26 Teams (62%) have posted a job or a listing.
- **Region.** Citizen checkout is geoblocked in the EU/EEA/UK under GDPR (`lib/geo`). Teams opened there in July. Ads for Citizenship cannot target Europe until that changes, which is why opening EU Citizenship is a midpoint key result.
- **Tracking.** GTag and a cookie banner exist, so ad → mint attribution can use UTM parameters plus the mint event.

### 6.5 Automation already in place

- **Governance:** the Operator Panel for the project cycle, AI proposal review (Groq), and vote and retro audit endpoints.
- **Communications:** vote and contribution notifications, and the townhall summarizer (YouTube → Whisper → summary → ConvertKit draft).
- **DePrize:** a Discord odds wire, a reconciliation cron, and compliance alerts.
- **Finance:** the EB financial-summary and tracker APIs (operator-gated).
- **Scheduling:** the dispatcher runs scheduled flows.

Coding agents already do most engineering: 1,660 commits and 346 merged PRs on `main` since May 1.

The main manual gaps are social posting, where an X contractor role is open at $2,000–2,800/month pending this budget. The others are the weekly finance and KPI reporting, support, Team outreach and CRM, payout preparation, and prize-resolution monitoring.

**Security note for agent work.** On Sep 9–10, the Arbitrum treasury and the payout Safe were both hit by address poisoning. The attacks used zero-value transfers from lookalikes of `0x75f3…65ed` and a fake "ÚSDС" token sent to a lookalike of the treasury (`0xaf26d581…70c0`). Any agent that copies an address from transaction history would be exposed, which is why the draft requires an allowlisted address book.

---

## 7. Why these priorities

- **Ladder and simulation first.** They are finished, they are MoonDAO's most distinctive work, and one of them has an external deadline (Griffin). Shipping them unlocks sponsorship, the forecast funnel for Citizenship, and the story for the seed round.
- **Frank second.** It is the DAO's biggest public promise, and $172k of community money is waiting on it. The next step is procedural: keep the raise open and sign a refundable two-seat reservation with Frank named. The Candidate process waits until the raise closes. It needs no new treasury money.
- **Network pricing with staked MOONEY.** At $30 a year, 262 Citizens produce about $2.6k, so price is the lever and not volume alone. Putting $25 of each payment into staked MOONEY and $25 into a cash referral turns the increase into a better offer, gives new Citizens voting power, and recycles revenue into MOONEY instead of selling it. Both come out of the price, with no treasury match. The existing `VotingEscrowDepositor` pattern makes this a router, not a new token system.
- **Ads with a kill switch.** MoonDAO has never measured what a Citizen costs to acquire. A $3k test answers that; spending $12k blind would not.
- **Automation as the cost plan.** At $12k per month, the three-year standard cannot be met with today's team doing today's manual work. Automation is what makes a smaller Q2 2027 budget credible.
- **Travel and equipment are capped and tied to key results.** Provider diligence for Frank, sponsor meetings, and conferences (the Mars Society convention in October; ETHDenver in February) justify travel. Content and event kit plus local agent hardware justify equipment.

**Considered and left out:**

- **Re-staking ETH.** The core budget alone needs about 56 ETH, which would leave too little loose ETH to stake meaningfully.
- **A treasury MOONEY buyback without a Citizen attached.** It adds price impact on a thin pool without adding members.
- **Raising salaries.** No case was found given the runway.

---

## 8. Decisions for the author before posting

1. **Salary levels.** The draft holds MDP-249 rates and lets each core member take up to 25% of salary as four-year vMOONEY. Half of the bonus pool is now tied to midpoint milestones and 75% of it is paid in vMOONEY. A lean alternative is a 20% cut to guaranteed pay with a bonus pool twice as large, bringing core to about $20.8k per month.
2. **Citizenship price.** $99, with $25 of staked MOONEY for the Citizen and $25 to the referrer, both out of the price, is the draft. A USD-pegged price in place of ETH repricing is the main alternative.
3. **Lock length for the Citizenship MOONEY.** The draft implies four years, matching project rewards. One year would match the subscription.
4. **X contractor.** Hire from the open role at up to $2,400 per month, or run agent-first with Ryan as editor and save $12k.
5. **Variable reward.** The draft drops the 2% treasury-growth reward and keeps the 10% revenue reward. With ETH up about 70% since July 1, the 2% reward would pay out on price alone.
6. **Term start and pay gap.** The escrows ended Sep 29, and the proposal will not pass before mid-October. Either back-date the lines to Oct 1 or start them on passage.
7. **Moon Base Zero traffic target.** 10,000 unique visitors is a placeholder. Calibrate it against the GA baseline for moondao.com.

---

## 9. Items to verify

- The Uniswap V3 fee income on #686147 was not measured.
- The ~$172k "raised or pledged" for Frank includes off-chain pledges. Confirm the off-chain amount and which pledges are still firm.
- Whether any Q2 2026 grant balances are still owed (see §4.4).
- Whether any site metric still reports the 96 staked ETH.
- The MDP-249 bonus pool payout, and the Team discovery calls.
- The depth of MOONEY liquidity on Arbitrum. If the FeeHook v4 pools are thinner than the Ethereum pool, route the Citizenship MOONEY buys accordingly.
- A baseline for Citizen renewal rate, from Citizen NFT expiry data.

---

## 10. Sources and method

| Data | Source |
| :-- | :-- |
| Past EB proposals | Tableland `PROJECT_42161_122` (ids 16, 81, 83, 131); Nance API `/moondao/proposal/{176,194}`; MDP-249 IPFS `QmRdCFFn…rWnUoa` |
| Past final reports | IPFS `QmTWcdm4…PupUzSe` (MDP-194), `bafkreic5…2bslle` (MDP-176) |
| Balances | `cast` against public Ethereum, Arbitrum, Polygon, and Base RPCs. The Safe Client API returned 403 |
| LP position | `positions(686147)` and pool `slot0` on `0x6de2…157f` |
| Prices | DefiLlama `coins.llama.fi` (current and 2026-06-19 historical) |
| Revenue and flows | Etherscan v2 (`txlistinternal`, `txlist`, `tokentx`) for the treasuries, the EB Safe, and the payout Safe; LI.FI `/v1/status` for bridge legs |
| Salary escrows | `start_time` and `end_time` on the four `Simple Vesting Escrow` clones |
| Network | `totalSupply()` on the Citizen and Team NFTs; Tableland Citizen, Team, Jobs, Marketplace, Votes, and NonProjectProposal tables |
| Frank | JB terminal store `balanceOf(…, 73, ETH)`; `lib/overview-path-vote/closed-snapshot.json`; `options.ts`; `frank-reopen-*.md` |
| DePrize and Moon Base Zero | `docs/DEPRIZE*.md`, `ui/docs/MOONBASE_MODEL_HANDOFF.md`, `ui/docs/ACCESS_GATE.md`, `lib/lunar-atlas/seed/atlas.dataset.json` |
| Budgets and rules | `ui/const/executiveFinance.ts`, `PROJECT_CYCLE` in `ui/const/config.ts`, `ui/docs/Q4_2026_CYCLE_OPEN_CHECKLIST.md` |
| Activity | `git log origin/main --since=2026-05-01` |
