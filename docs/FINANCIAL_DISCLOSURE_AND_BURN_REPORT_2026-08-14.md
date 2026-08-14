# MoonDAO

## Compiled Statement of Net Assets, Operating Budget, and Burn Report

| | |
|---|---|
| **Reporting entity** | MoonDAO (decentralized autonomous organization) |
| **Statement date** | 14 August 2026 |
| **Reporting period** | Mid–Q3 2026 (as-of snapshot) |
| **Functional currency** | United States dollars (USD) |
| **Basis of compilation** | Public on-chain balances and DAO-approved budgets |
| **Level of assurance** | **Compilation — not an audit, review, or attestation** |

This report is a compilation of publicly observable on-chain positions and of budgets already approved by MoonDAO governance. It is intended as a financial disclosure for members, senators, and treasury signers. It is **not** a GAAP, IFRS, or statutory financial statement, and it has **not** been audited.

Every asset figure is either (a) a Safe Global USD balance, (b) a direct contract read, or (c) a mark using the prices in Note 1. Every cost figure is taken from an approved proposal or from the project-system rules in `PROJECT_CYCLE`. Where a number is an estimate or a policy exclusion, the note says so.

---

## Contents

1. [Compilation report and basis of presentation](#1-compilation-report-and-basis-of-presentation)
2. [Statement of net assets](#2-statement-of-net-assets)
3. [Schedule of assets by custodian](#3-schedule-of-assets-by-custodian)
4. [Schedule of assets by class](#4-schedule-of-assets-by-class)
5. [Statement of approved operating budget](#5-statement-of-approved-operating-budget)
6. [Statement of functional expenses](#6-statement-of-functional-expenses)
7. [Burn, liquidity, and runway](#7-burn-liquidity-and-runway)
8. [Twelve-month projection](#8-twelve-month-projection)
9. [Notes to the statements](#9-notes-to-the-statements)
10. [Appendix A — wallet register](#appendix-a--wallet-register)
11. [Appendix B — sources](#appendix-b--sources)

---

## 1. Compilation report and basis of presentation

### Nature of the compilation

MoonDAO’s books are the chain. This report reads those books and restates them in the form of a normal financial disclosure:

- a **statement of net assets** (balance-sheet equivalent);
- an **approved operating budget** (forward-looking statement of activities);
- a **burn and runway analysis**.

It does **not** reconstruct a historical profit-and-loss for Q1–Q3 2026. Subscription and Launchpad inflows exist, but a full trailing P&L was not compiled for this report. Stated revenue is the figure used in the latest Executive Branch proposal (Note 8).

### Recognition policies used here

| Item | Treatment |
|---|---|
| ETH, WETH, WBTC, USDC, DAI, SAFE, POL | Recognized at spot USD (Note 1) |
| Uniswap V3 LP NFT #686147 | Recognized; official AUM counts the **WETH side only** (Note 4) |
| Staked ETH (3 × 32 ETH, Kiln) | Recognized as a **restricted / illiquid** asset; excluded from official AUM (Note 5) |
| MOONEY held by the DAO | **Memorandum only.** Official AUM excludes MOONEY because the DAO controls issuance (Note 6) |
| OVERVIEW and other mission tokens | Unpriced; disclosed, not recognized |
| Spam / airdrop tokens | Omitted |
| Project Safes (funded project multisigs) | Not MoonDAO treasury; unused funds are required to return (Note 10) |
| Executive Branch performance reward (2% of capital gains + 10% of trailing revenue) | Variable; last audited quarter was $212. Treated as nil under constant-cost burn (Note 9) |

### Going-concern framing

On the constant-cost stack in §5–§7, unrestricted liquid assets cover approximately **ten months** of net burn. Including staked ETH extends that to approximately **sixteen months**. That is a liquidity fact, not a prediction that the DAO will cease operations. Mitigation is discussed in Note 12.

---

## 2. Statement of net assets

**As of 14 August 2026**

| | Official AUM policy | Expanded (this report) |
|---|---:|---:|
| **Unrestricted liquid assets** | | |
| Digital assets at spot, ex-MOONEY, home-chain Safes + LP WETH | $327,851 | $327,851 |
| Same addresses / other chains, and operating Safes (Notes 3, 7) | — | 15,852 |
| **Total unrestricted liquid** | **327,851** | **343,703** |
| **Restricted / illiquid** | | |
| Staked ETH — 96 ETH, not withdrawn (Note 5) | — | 181,119 |
| **Total recognized net assets** | **327,851** | **524,822** |
| **Memorandum — not in net assets** | | |
| MOONEY inventory, ~643.3 million tokens at $0.000145 (Note 6) | 39,225 | 93,148 |
| **All-in economic interest (informational)** | 367,076 | **617,970** |

Official AUM is the figure the website and `aum-onchain.ts` use: eight designated Safes on their home chains, plus the WETH side of the Uniswap V3 position, **excluding MOONEY and excluding staked ETH**.

The expanded column adds (i) the Arbitrum treasury address on Polygon, Base, and Ethereum, (ii) the Executive Branch team Safe, and (iii) small operational wallets. Those balances are MoonDAO-controlled but are not in the official AUM query.

---

## 3. Schedule of assets by custodian

**As of 14 August 2026. USD except where noted.**

### 3.1 Constitutional treasury — Ethereum

Gnosis Safe `0xce4a1E86a5c47CD677338f53DA22A91d85cab2c9`  
5-of-7 signers (Constitution §2.3). This is the wallet linked from [moondao.com/treasury](https://moondao.com/treasury).

| Asset | Units | USD |
|---|---:|---:|
| ETH | 90.047 | 169,779 |
| WBTC | 1.435 | 91,048 |
| USDC | 8,901 | 8,898 |
| DAI | 8,576 | 8,575 |
| SAFE | 7,419 | 654 |
| WETH | 0.108 | 204 |
| Other (immaterial) | | <1 |
| **Subtotal, ex-MOONEY** | | **279,158** |
| MOONEY (memorandum) | 270,947,905 | 39,225 |
| **Safe-reported total** | | **318,383** |

Also holds ~15.5 million legacy JBX (Safe marks $0) and various unsolicited airdrop tokens (omitted).

### 3.2 Liquidity position — Uniswap V3 (held by the Ethereum treasury)

Non-fungible position **#686147** in Uniswap V3 NPM `0xC36442b4a4522E871399CD717aBDD847Ab11FE88`.  
Pool `0x6de28f1176311b7408329a4d21c2bd1441be157f` — MOONEY/WETH, 1% fee, full range.

| Side | Units | USD | In official AUM? |
|---|---:|---:|---|
| WETH | 22.391 | 42,244 | Yes |
| MOONEY | 292,198,252 | 42,302 | No |
| **Full LP (informational)** | | **84,546** | |

### 3.3 Staked ETH — Kiln (restricted)

Contract `0xbbb56e071f33e020daEB0A1dD2249B8Bbdb69fB8`.  
Three `Deposit` events at Ethereum block 21,839,730; `getWithdrawnFromPublicKeyRoot` is false for all three.

| | |
|---|---|
| Validators | 3 × 32 ETH |
| ETH staked | 96.000 |
| USD | **181,119** |
| Official AUM | Excluded (side metric) |

### 3.4 Arbitrum treasury (cross-chain)

Safe `0xAF26a002d716508b7e375f1f620338442F5470c0`.  
Primary L2 treasury. Citizen and Team mint fees settle here. The **same address is funded on other chains**; official AUM reads Arbitrum only.

| Chain | Assets (ex-MOONEY) | USD | MOONEY (units) | In official AUM? |
|---|---|---:|---:|---|
| Arbitrum | 5,498 USDC + 0.505 ETH | 6,449 | 47,347,851 | Yes |
| Polygon | 4.000 WETH + 108 POL | 7,547 | 612,500 | **No** |
| Base | 0.050 ETH | 94 | 636,395 | **No** |
| Ethereum | — | — | 6,411,407 ($928) | **No** |
| **Total this address** | | **14,090** | **55,008,153** | |

### 3.5 Other designated cross-chain Safes

| Name | Address | Home chain | USD |
|---|---|---|---:|
| Polygon / L2 treasury | `0x8C0252c3232A2c7379DDC2E44214697ae8fF097a` | Polygon | 0 |
| Base treasury | `0x871e232Eb935E54Eb90B812cf6fe0934D45e7354` | Base | 0 |
| Optimism treasury | `0x7CCa1d04C95e237d5C59DDFC6E8608F5E9cB45e4` | Optimism | 0 (not a registered Safe) |
| Multichain routing | `0x7CCa1d04C95e237d5C59DDFC6E8608F5E9cB4537` | Arb / Polygon / Base | 0 |

These wallets are in the official AUM set. They currently contribute nothing. The routing Safe is a pass-through.

### 3.6 Executive Branch treasury

MoonDAO Team #0 (“Executive Branch” / “Core operations at MoonDAO”).  
Team NFT owner / Safe: `0xdfc31084ad3887076913e5d0759a27c65a3c5291` (Arbitrum).

| Asset | Units | USD |
|---|---:|---:|
| USDC | 7,978 | 7,975 |
| WETH | 0.012 | 23 |
| **Recognized** | | **7,997** |
| MOONEY | 100 | — |
| OVERVIEW (mission token) | 11,966 | Unpriced |

Not in official AUM. Separate from the 5-of-7 constitutional treasury.

### 3.7 Operational wallets

| Wallet | Address | Purpose | USD |
|---|---|---|---:|
| FeeHook (Base) | `0x3F74A92F6D68a0638802d32D40a1Cb63C49b0844` | Weekly vMOONEY LP-fee rewards | 11 |
| FeeHook (Ethereum) | `0x1b9f3544dC4915E0C08882d1C3F39B6E464E4844` | Same, Ethereum | 0 |
| FeeHook (Arbitrum) | `0x6D9C97c94c88a67d1A93BBC8ccAe3a5322208844` | Same, Arbitrum | 0 |
| GCP HSM signer | `0xb206325e6562517532686dfeeead4c104d9f5d32` | XP oracle, referrals, gas | 202 |
| Admin / deployer Safe | `0x29B0D7d7f0C88Ce0DF1De5888b37B90A6faF75cB` | Protocol admin | 1 |
| VotingEscrowDepositor | `0xBE19a62384014F103686dfE6D9d50B1D3E81B2d0` | Quarterly project MOONEY escrow | 0 USD / 25,193,353 MOONEY |
| Mission cross-chain pay | `0x32D7ceD515A27CB60c6dcAd47225A7f300134983` | LayerZero pay router | 0 |

The HSM signer is a hot operational key, not a treasury.

---

## 4. Schedule of assets by class

**Expanded basis, 14 August 2026**

| Class | USD | % of recognized ($524,822) |
|---|---:|---:|
| ETH / WETH — liquid (incl. LP WETH side) | 221,854 | 42.3% |
| ETH — staked (Kiln) | 181,119 | 34.5% |
| WBTC | 91,048 | 17.3% |
| Stablecoins (USDC + DAI) | 30,946 | 5.9% |
| Other (SAFE, POL, ops dust) | 855 | 0.2% |
| **Recognized** | **524,822** | **100%** |
| MOONEY inventory (memorandum) | 93,148 | — |

Concentration: **76.8%** of recognized assets is ETH-beta (liquid ETH + staked ETH). A 20% ETH move is about **±$80,600** on recognized net assets, before any change in the 5% project budget.

---

## 5. Statement of approved operating budget

**Forward-looking. Constant-cost assumption: latest approved rates held flat.**

This is a budget, not a historical statement of activities. Two programs:

1. **Management and general** — Executive Branch, MDP-249 (Q2–Q3 2026).
2. **Program services** — Projects system v8, `PROJECT_CYCLE` for Q3 2026.

### 5.1 Executive Branch — MDP-249

Five-month envelope (approximately May–September 2026). Passed Member House (approximately 91% of decided voting power). Project `#131`.

| Line | Monthly | Five-month | Annualized |
|---|---:|---:|---:|
| Pablo (Executive Lead) | 12,000 | 60,000 | 144,000 |
| Ryan | 7,500 | 37,500 | 90,000 |
| Miguel (full-time 3 mo, half-time 2 mo) | 4,400 avg | 22,000 | 52,800 |
| **Personnel** | **23,900** | **119,500** | **286,800** |
| Operations (subscriptions, tools, infra) | 1,500 | 7,500 | 18,000 |
| Flexible | 1,000 | 5,000 | 12,000 |
| **Core (guaranteed)** | **26,400** | **132,000** | **316,800** |
| Performance bonus pool (four milestones, at-risk) | 4,800 | 24,000 | 57,600 |
| **Stated envelope** | **31,400** | **157,000** | **376,800** |

Line items sum to $156,000 plus the $1,000 rounding in the proposal header ($157,000). Bonuses pay only if DePrize deployment, lunar-initiative raise, network targets, and operational milestones are verified.

**Constant-cost base case used below: core $26,400 / month ($316,800 / year).** Bonuses are shown as a sensitivity.

### 5.2 Projects system — Q3 2026 rate, held constant

| Rule | Quarterly | Annualized |
|---|---:|---:|
| Stablecoin rewards = 5% of liquid non-MOONEY assets | **24,310** | **97,240** |
| of which community circle (10%) | 2,431 | 9,724 |
| of which projects (90%, subject to 3/4 approval cap on *new* asks) | 21,879 | 87,516 |
| Per-proposal maximum (1/5 of quarterly) | 4,862 | — |
| New-ask approval cap (3/4 of quarterly) | 18,233 | — |
| MOONEY emission (15,000,000 × 0.95^n from Q4 2022) | 6,949,368 tokens (~$1,006) | ~$3,700–4,000 |

Q2 2026 spent the **entire** 5% ($15,439 upfront + $5,629 retro + $2,341 community = $23,409). Constant cost therefore uses the full 5%, not the 3/4 cap.

The configured $24,310 implies an NMA base of about **$486,200** when Q3 was set. That is consistent with official AUM plus staked ETH (~$509,000 today). The budget calculator **includes** staked ETH in the 5% base; official AUM does not.

### 5.3 Combined constant budget

| | Monthly | Annual |
|---|---:|---:|
| Executive Branch, core | 26,400 | 316,800 |
| Projects system, USD | 8,103 | 97,240 |
| **Gross burn** | **34,503** | **414,040** |
| Stated revenue (Note 8) | (2,042) | (24,500) |
| **Net burn — base** | **32,461** | **389,540** |
| If all EB bonuses pay | 4,800 | 57,600 |
| **Net burn — bonuses in** | **37,261** | **447,140** |
| MOONEY emitted (Q3 rate, memorandum) | 2.32M tokens | 27.8M tokens (~$4,000) |

Executive Branch is about **77%** of USD burn; the projects system is about **23%**.

---

## 6. Statement of functional expenses

**Annualized constant-cost presentation**

| | Program (projects) | Management & general (EB) | Total |
|---|---:|---:|---:|
| Personnel | — | 286,800 | 286,800 |
| Project seed + retro + community circle | 97,240 | — | 97,240 |
| Operations / tools | — | 18,000 | 18,000 |
| Flexible / discretionary | — | 12,000 | 12,000 |
| **Core expenses** | **97,240** | **316,800** | **414,040** |
| Contingent personnel bonuses | — | 57,600 | 57,600 |
| **If bonuses earned** | **97,240** | **374,400** | **471,640** |
| Stated revenue (contra) | | | (24,500) |
| **Net core** | | | **389,540** |

MOONEY locked four years as vMOONEY for project and community-circle rewards is a token emission, not a USD cash expense. It is disclosed in §5.2 and Note 6.

---

## 7. Burn, liquidity, and runway

### 7.1 Liquidity coverage

| | USD | Months of net burn ($32,461 / mo) | Months if bonuses pay ($37,261 / mo) |
|---|---:|---:|---:|
| Official AUM | 327,851 | **10.1** | 8.8 |
| Expanded unrestricted liquid | 343,703 | **10.6** | 9.2 |
| + Staked ETH | 524,822 | **16.2** | 14.1 |
| All-in incl. MOONEY mark | 617,970 | **19.0** | 16.6 |

**Primary disclosure figure: 10.1 months of net burn against official AUM.**

Staked ETH is the difference between “about ten months” and “about sixteen months.” Unstaking it also shrinks the 5% project-budget base.

### 7.2 Monthly cash (stablecoin + ETH) burn waterfall

```
Gross EB core                         $26,400
Gross projects (5% NMA / 3)             8,103
                                      -------
Gross burn                             34,503
Stated revenue                         (2,042)
                                      -------
Net burn — base                        32,461
```

At this rate, official AUM is exhausted in the first half of Q3 2027 if prices, revenue, and policy are unchanged.

### 7.3 Why “constant $24,310 projects” is not internally consistent past a few quarters

The projects line is **5% of remaining NMA**, not a fixed appropriation. Holding EB spend constant and ignoring mark-to-market:

| After | Approx. NMA (official AUM + stake, start $509k) | Next quarter’s 5% |
|---|---:|---:|
| Statement date | $509,000 | $24,310 (configured) |
| Four quarters (−$390k net) | ~$119,000 | ~$6,000 |
| Six quarters | Official AUM consumed | Projects line collapses |

Long-run USD burn, absent new revenue or a market rally, tends toward **EB salaries and ops only (~$26,400 / month)** plus a shrinking projects line.

---

## 8. Twelve-month projection

**Illustrative. Not a forecast. Prices frozen at the statement date. No new Launchpad or DePrize revenue beyond the $24,500 cited in MDP-249.**

| Quarter | Opening liquid AUM | EB core | Projects 5% | Revenue | Closing liquid AUM |
|---|---:|---:|---:|---:|---:|
| Q3 2026 (remaining ~1.5 mo from 14 Aug) | 327,851 | (39,600) | (12,155) | 3,063 | 279,159 |
| Q4 2026 | 279,159 | (79,200) | (14,000)* | 6,125 | 192,084 |
| Q1 2027 | 192,084 | (79,200) | (9,600)* | 6,125 | 109,409 |
| Q2 2027 | 109,409 | (79,200) | (5,500)* | 6,125 | 30,834 |

\*Projects 5% restated each quarter on a shrinking NMA (official AUM only, conservative). Opening Q3 uses the configured $24,310 pro-rated for the remaining half-quarter.

This projection **does not** spend staked ETH. If the 96 ETH remains locked, official AUM approaches zero in **Q2–Q3 2027** under these assumptions. If staked ETH is unstaked and spent, the same path extends roughly two quarters.

MDP-249’s own narrative was a $120,000 net Executive Branch draw over five months, a mid-cycle DePrize / Launchpad offset in the second half, a path toward ~$200,000 **gross** annual burn once revenue ramps, and cash-flow sustainability by the end of 2027. That $200,000 target is about **half** of today’s constant stack ($414,040 gross) and requires either a large revenue step-up or a cut after this five-month bridge (Miguel already tapers to half-time in months 4–5; an Executive Branch election is scheduled by the end of Q3).

---

## 9. Notes to the statements

### Note 1 — Prices

| Asset | Source | Price used |
|---|---|---:|
| ETH / WETH | Safe USD feed / DefiLlama, 14 Aug 2026 | $1,885.44–$1,886.66 |
| WBTC | Safe USD feed | $63,438 |
| USDC / DAI | Safe USD feed | ~$1.00 |
| MOONEY | DefiLlama / Safe (Ethereum) | $0.00014477 |
| SAFE | Safe USD feed | implied ~$0.088 |

Safe-reported fiat totals are used for Safe-held tokens. LP amounts are from `positions(686147)` + pool `slot0`. Staked ETH is 96 × ETH spot.

### Note 2 — Constitutional treasury

The Ethereum Safe is the treasury named in Constitution §2.3. Outflows require a passed proposal and 5-of-7 signer execution. The original Juicebox project *is* this Safe. Mission Juicebox projects belong to those missions, except the locked ~2.5% protocol split.

### Note 3 — Cross-chain treasury

Official AUM queries eight Safes (`MOONDAO_SAFES` / `aum-onchain.ts`) on a single home chain each. The Arbitrum treasury address also holds **4 WETH on Polygon ($7,547)** and **0.05 ETH on Base ($94)**. Those balances are MoonDAO-controlled and are included in the expanded column only.

### Note 4 — Liquidity

The DAO’s only material DEX position is Uniswap V3 NFT #686147. Official AUM counts WETH only, consistent with the MOONEY-exclusion policy. No Uniswap V4 positions were found on the main treasury. FeeHooks on Ethereum, Arbitrum, and Base collect pool fees for weekly distribution to checked-in vMOONEY holders; only Base held a material balance ($11) at the statement date.

### Note 5 — Staked ETH

96 ETH is staked via Kiln. Withdrawals would return ETH to the Ethereum treasury. Until then it is restricted: it earns (or loses) validator yield, cannot pay invoices, and *is* counted in the project-system 5% NMA base by `ui/scripts/calculate-budget.mjs`.

### Note 6 — MOONEY

Official AUM excludes MOONEY (`useAssets`, `aum-onchain.ts`) because the DAO controls supply. Locations of DAO-held MOONEY:

| Location | Tokens |
|---|---:|
| Ethereum treasury | 270,947,905 |
| Uniswap V3 LP | 292,198,252 |
| Arbitrum treasury (Arbitrum) | 47,347,851 |
| VotingEscrowDepositor (project escrow) | 25,193,353 |
| Arbitrum treasury address on Ethereum | 6,411,407 |
| Arbitrum treasury address on Base | 636,395 |
| Arbitrum treasury address on Polygon | 612,500 |
| Executive Branch Safe | 100 |
| **Total** | **643,347,763** |
| **Mark at $0.00014477** | **$93,148** |

Safe marks Arbitrum MOONEY at $0 even though DefiLlama has a price. This report marks all MOONEY at the Ethereum DefiLlama price for the memorandum column only.

Quarterly project MOONEY follows \( R_n = 15{,}000{,}000 \times 0.95^n \) from Q4 2022. Q3 2026 is 6,949,368 tokens. Recipients receive four-year locked vMOONEY.

### Note 7 — Executive Branch Safe vs constitutional treasury

Team #0 is an operating Safe for day-to-day EB execution. It is not a substitute for the 5-of-7 treasury. MDP-249 funds flow from the constitutional treasury into EB operations; residual at the statement date is $7,997.

### Note 8 — Revenue

MDP-249 cites “current revenue of approximately $24,500” per year (~$12,000 over five months). That figure is used as stated revenue. It is **not** a compiled trailing-twelve-month on-chain revenue statement. On-chain subscription revenue (Citizen + Team mints to the Arbitrum treasury) is calculated separately for EB rewards (`canonicalRevenue.ts`) and was small in the last audited quarter. Launchpad / DePrize fees, if material, would improve runway and are **not** in the base projection.

### Note 9 — Executive Branch variable reward

Per `eb-rewards.ts`: 2% of quarterly capital gains (floored at zero) plus 10% of trailing-365-day revenue. Q4 2025 audit: **$212.34** (revenue component only; treasury shrank). Treated as nil in the constant-cost burn.

### Note 10 — Project Safes and unused funds

Each funded project receives a multisig. Those balances are not MoonDAO treasury. Project System v8 requires unused funds to return to `0xce4a1E86a5c47CD677338f53DA22A91d85cab2c9`. Returns would extend runway and are not estimated here.

### Note 11 — Commitments and contingencies

- MDP-249 remaining term: roughly 1.5 months from the statement date if the five-month clock started in early May 2026.
- At-risk bonus pool: $24,000.
- Q3 2026 project cycle is in `idle` after Member Vote / retro wrap-up; the next cycle will recompute 5% of then-current NMA.
- Executive Branch election is an MDP-249 key result for the end of Q3 2026 and may change the salary stack.
- No legal claims or off-chain debt were identified in the materials reviewed.

### Note 12 — Liquidity risk and going concern

Unrestricted liquid assets cover about ten months of the constant net burn. That is tight for an organization whose program spend is defined as a percentage of remaining assets. Material mitigants already in governance documents:

- Miguel’s salary taper in months 4–5 of MDP-249;
- Q3 Executive Branch election;
- stated intent to cut toward ~$200,000 gross annual burn as revenue ramps;
- optional unstaking of 96 ETH;
- Launchpad / DePrize fees not modeled here;
- ETH / BTC mark-to-market (76.8% of recognized assets).

A 30% ETH decline, with costs unchanged, shortens official-AUM runway by roughly two months and immediately cuts the following quarter’s 5% project budget.

### Note 13 — Subsequent events

None identified between the on-chain reads and the issuance of this compilation (14 August 2026). Balances move continuously; this is a point-in-time snapshot.

---

## Appendix A — Wallet register

| Role | Chain(s) | Address |
|---|---|---|
| Constitutional treasury | Ethereum | `0xce4a1E86a5c47CD677338f53DA22A91d85cab2c9` |
| Arbitrum treasury (also funded on Polygon, Base, Ethereum) | Arbitrum + others | `0xAF26a002d716508b7e375f1f620338442F5470c0` |
| Polygon / L2 treasury | Polygon | `0x8C0252c3232A2c7379DDC2E44214697ae8fF097a` |
| Base treasury | Base | `0x871e232Eb935E54Eb90B812cf6fe0934D45e7354` |
| Optimism treasury | Optimism | `0x7CCa1d04C95e237d5C59DDFC6E8608F5E9cB45e4` |
| Multichain routing | Arb / Polygon / Base | `0x7CCa1d04C95e237d5C59DDFC6E8608F5E9cB4537` |
| Executive Branch (Team #0) | Arbitrum | `0xdfc31084ad3887076913e5d0759a27c65a3c5291` |
| Kiln staking | Ethereum | `0xbbb56e071f33e020daEB0A1dD2249B8Bbdb69fB8` |
| Uniswap V3 NPM (LP NFT #686147) | Ethereum | `0xC36442b4a4522E871399CD717aBDD847Ab11FE88` |
| VotingEscrowDepositor | Arbitrum | `0xBE19a62384014F103686dfE6D9d50B1D3E81B2d0` |
| FeeHook | Ethereum / Arbitrum / Base | see §3.7 |
| Admin Safe | Arbitrum | `0x29B0D7d7f0C88Ce0DF1De5888b37B90A6faF75cB` |
| GCP HSM signer | Arbitrum | `0xb206325e6562517532686dfeeead4c104d9f5d32` |

Individual senator and executive EOAs are not treated as DAO treasuries.

---

## Appendix B — Sources

| Item | Source |
|---|---|
| Safe balances | Safe Client `balances/usd` API, 14 Aug 2026 |
| Uniswap V3 position | `positions(686147)` + pool `slot0` |
| Staked ETH | Deposit logs at block 21,839,730; `getWithdrawnFromPublicKeyRoot` |
| Executive Branch Safe | `ownerOf(0)` on MoonDAOTeam `0xAB2C354eC32880C143e87418f80ACc06334Ff55F` |
| Official AUM set | `ui/lib/coinstats/index.ts`, `ui/lib/treasury/aum-onchain.ts`, `ui/const/config.ts` |
| MDP-249 budget | IPFS `QmRdCFFnXTYbYU4CvE8KjUBBE4ShdQAbsXVFm7QhrWnUoa` (project `#131`) |
| Project-system rates | `PROJECT_CYCLE` in `ui/const/config.ts`; [docs.moondao.com/Projects/Project-System](https://docs.moondao.com/Projects/Project-System) |
| MOONEY decay | `getMooneyBudgetForCycle` in `ui/lib/proposals/computeRetroactiveOutcome.ts` |
| Q2 2026 actual project spend | `PROJECT_CYCLE.retro` comments; `HISTORICAL_RETRO_POOLS['2026-Q2']` |
| Q4 2025 EB reward | `docs/Q4_2025_EB_REWARD_AUDIT.md` |
| Constitution | [docs.moondao.com/Governance/Constitution](https://docs.moondao.com/Governance/Constitution) |

---

*Compiled 14 August 2026. Point-in-time. Not audited.*
