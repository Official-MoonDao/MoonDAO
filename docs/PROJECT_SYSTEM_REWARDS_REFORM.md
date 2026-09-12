# Project System & Rewards Reform — Implementation Analysis

**Source brief:** MoonDAO Project System & Rewards Reform Brief (Draft for Discussion, June 26, 2026)
**Analyzed against:** production `ui/` (Q3 2026 cycle, `PROJECT_CYCLE.budgetUSD = $24,310`) and [Projects v8.0](https://docs.moondao.com/Projects/Project-System)
**Status:** Recommendations for Senate / Executive Branch — not yet implemented

This document maps each proposed change to the live codebase and public docs, then recommends what to change, what to decide, and what impact the reform would have on the project system.

---

## 1. How the system actually works today

The brief describes v8.0 accurately at the policy level. The implementation is more specific, and a few gaps matter for scoping.

### 1.1 Quarterly budget is already a pinned number, not a live 5% formula

`PROJECT_CYCLE` in `ui/const/config.ts` is the single source of truth operators edit each quarter. `budgetUSD` is hardcoded (`24310` for Q3 2026). Comments still say “5% of liquid non-MOONEY assets,” and `getBudget()` in `ui/lib/utils/rewards.ts` still computes `usdValue * 0.05` from live treasury tokens — but that live number is **not** what the Member Vote uses.

Operators pin `budgetUSD` at cycle start (see `ui/docs/PROJECT_CYCLE_OPERATOR_RUNBOOK.md`). The 5% NMA formula is therefore an **off-chain operator calculation**, not an on-chain or UI-enforced rule. Unpredictability is real; computational overhead in the app is already low.

### 1.2 Winner selection is a two-constraint knapsack

`getApprovedProjects()` in `ui/lib/utils/rewards.ts`:

- Rank Senate-passed proposals by √vMOONEY-weighted Member Vote share
- Fund `min(max(ceil(n/2), 3), n)` — top 50%, floor of 3
- Walk rank order and approve each project that still fits under `0.75 * budgetUSD` (knapsack, not greedy-stop)

Q3 2026 funded **5 projects / $17,452** against a $24,310 pool and $18,232.50 cap. The brief’s “~$23k for ~5 projects” matches recent quarters.

Per-proposal max is `MAX_BUDGET_USD = round(budgetUSD / 5)` ($4,862 in Q3). Enforced in the proposal form (`RequestBudgetActionForm`), AI review, and the markdown template (`getProposalTemplate()`).

### 1.3 Retroactives are already a separate, pinned remainder

The retro pool is **not** “5% NMA minus budgets” computed at payout time. It is pinned on the **prior** quarter:

- `PROJECT_CYCLE.retro.usdBudget` / `ethBudget` = post-upfront remainder for projects
- `communityCirclePrimary` = 10% of the **retro cohort’s original quarterly budget** (not a carve-out of the remainder)
- MOONEY follows `15_000_000 * 0.95^n` from Q4 2022, then a 90/10 project / community split

Q2 2026 (paid during Q3): $5,629.26 USDC + ~6.58M MOONEY to projects; $2,340.90 USDC + ~732k MOONEY to the community circle.

Member House still allocates USDC/MOONEY **between completed projects**. Each project’s `rewardDistribution` JSON (from the final report) then splits that project’s share to contributors. That is the “per-project governance rewards” the brief wants to remove.

### 1.4 Community Circle is already a product — and it is split across three systems

| Surface | What it does today |
|---|---|
| `/contributions` | “Community Circle” page. Google Form submit + public sheet feed. Copy promises **ETH and vMOONEY**. |
| Coordinape | `ContributionEditor` + `lib/coordinape/*` still write to a Coordinape circle. Official docs still describe Discord slash commands. |
| Discord `#wdygdtw` | Project-contributor weekly updates. **No code reads this channel.** The 5% missed-update penalty is policy-only. |

There is no compliance tracker, no missed-week counter, and no operator control that applies the 5% retro deduction. `docs/RETRO.md` still tells operators to paste a Coordinape distribution object into `ProjectRewards.tsx` by hand.

### 1.5 Constitution vs Project System

[Constitution v1.3](https://docs.moondao.com/Governance/Constitution) §3 points at the Project System for operating rules. It does **not** embed the 5% NMA formula. It **does** give Senators the right to distribute Community Circle rewards (§2.2.1) and lets each active project seat one Senator.

A Project System amendment can go through ordinary DAO governance (Senate super-majority + Member House). A **constitutional** amendment (80% Senate, 80% Member House, 10-day vote, 3-month transition) is only required if you also change Senate rights, Senate composition, or want the new reward formula locked into the Constitution. The brief should not treat those as the same process.

---

## 2. Verdict on the proposal

**Adopt the direction. Do not ship it as a single quarter-start flip.**

The brief correctly names the real costs: variable spend, a 90/10 split that creates two payout rails, per-project vMOONEY allocations, and unenforceable weekly updates. The live code already centralized cycle numbers in `PROJECT_CYCLE`, so a fixed cap is a small config change. The hard work is (a) rewriting winner selection and its test suite, (b) separating USDC retro from vMOONEY, and (c) building the reporting/penalty product that v8.0 documented but never built.

Recommended policy package (see §5 for rationale):

| Open question | Recommendation |
|---|---|
| Quarterly cap | **$12,000** (not $10k). Per-project max **$4,000** (1/3). |
| Projects funded | **Top 3 by Member Vote.** Drop the 3/4 knapsack. No small-budget exception in v1. |
| Retro USDC pool | **Option A — fixed $4,000 / quarter.** Keep Member House allocation between completed projects. |
| Community stables | **Remove.** vMOONEY-only for the unified circle. |
| vMOONEY | **100% to one community-wide pool.** No per-project `rewardDistribution` for MOONEY. |
| Reporting | **Mandatory weekly posts on `/contributions`**, tagged to a project or “community.” |
| Penalties | **Detect in-app; apply via Operator Panel.** First miss = warning. Do not auto-shutdown. |
| Timeline | **Pilot reporting in Q4 2026. Bind budget/tally rules in Q1 2027** after a Project System proposal (not a constitutional amendment unless Senate rules also change). |

Net stables outlay vs recent quarters: roughly **$16k/quarter** ($12k budgets + $4k retro + $0 community) versus **~$23–26k** today. That is a **~35–40% cut**, not a rounding change. Model it as a treasury policy, not just a UX cleanup.

---

## 3. Documentation changes

Canonical policy lives at [docs.moondao.com/Projects/Project-System](https://docs.moondao.com/Projects/Project-System) (v8.0). `/project-system-docs` is an iframe of that page. In-app copy and operator runbooks must stay in lockstep or the vote-tally tests will describe a different system than the UI.

### 3.1 Project System (v8.0 → v9.0) — rewrite these sections

**Proposal Process, Step 2 (budget cap)**

- Replace “≤ 1/5 of total project rewards” with “≤ **$4,000** (1/3 of the $12,000 quarterly project budget).”
- Keep the launchpad sentence for asks above the cap. Add one sentence: multi-quarter programs should still split into quarterly milestones; they should not use a “small-budget exception” to sneak in a fourth project.

**Proposal Process, Step 5 (Member House Vote)**

Delete the top-50% / min-3 / 3/4-budget paragraph. Replace with:

> Voting members allocate voting power across Senate-approved proposals. The **three proposals with the highest voting-power share are funded**, each at the budget requested in the proposal (≤ $4,000). Contributors must abstain from voting on their own project.

If fewer than three Senate-approved proposals exist, fund all of them.

**Updates And Responsibilities**

Replace Discord `#wdygdtw` + monthly Senate report + 5%-per-missed-update with:

1. **Weekly Contribution Circle report** on [moondao.com/contributions](/contributions), tagged to the project. Required of the Project Lead (contributors may post as well).
2. **Monthly Town Hall verbal update** (keep; this is the only remaining live check-in).
3. **Penalty ladder** from the brief (warning → 10% vMOONEY cut → retro ineligibility + Senate review → shutdown review after 4+ missed weeks).

State explicitly that Discord posts **do not** count.

**Quarterly Rewards**

Split into two independent pools:

| Pool | Size | Who votes | Who receives |
|---|---|---|---|
| Project budgets (upfront) | $12,000 / quarter | Member House (top 3) | Project Safes |
| Retroactive USDC | $4,000 / quarter | Member House (completed, eligible projects) | Project Safes, then lead-defined USDC split if desired |
| vMOONEY | Geometric series, **100%** | Senators (or Senators + Citizens — decide before v9.0 ships) | Individual wallets in the unified Contribution Circle |

Delete: 5% NMA formula; “minus the sum of project budgets”; 10% automatic Contributor Circle carve-out of stables; per-project vMOONEY via final-report percentages.

Keep: final report + EB eligibility gate; Member House USDC allocation among completed projects; 4-year lock on MOONEY.

**FAQs**

- “How much can I ask for?” → $4,000.
- “What if I need more?” → Launchpad / Mission, or a later quarterly milestone.
- “Where do I post weekly updates?” → `/contributions`, not Discord.
- “Do project leads get vMOONEY automatically?” → No. They compete in the same circle as every other contributor.
- Add: “Who tracks missed reports?” → Operator Panel; EB applies penalties; the feed is the audit trail.

### 3.2 Community Rewards page

[Community Rewards](https://docs.moondao.com/Reference/Nested-Docs/Community-Rewards) still describes Discord slash commands, Coordinape GIVE, and “stablecoins and staked MOONEY.” Rewrite to match `/contributions`:

- Submit on the site (citizen-gated).
- Rewards are **vMOONEY only**.
- Project leads’ weekly reports appear in the **same feed**.
- Senators allocate the single pool at quarter end (or Citizens, if that option is chosen).
- Coordinape becomes optional/legacy, not the official path.

### 3.3 Constitution — only if you change Senate rights

Do **not** open a constitutional amendment solely to change the 5% NMA formula. That formula is not in the Constitution.

Consider a constitutional amendment only if you:

- Remove or alter Senators’ right to distribute Community Circle rewards (§2.2.1), or
- Change “each active Project can select one Senator” because a 3-project cap shrinks the Senate, or
- Move vMOONEY allocation from Senators to Citizens.

If Senate composition stays “5 elected + 1 per active project,” a 3-project cap **automatically shrinks the Senate by ~2 seats**. Call that out in the townhall. It is a governance side-effect, not just a budget change.

### 3.4 In-repo operator docs (must update in the same PR as the code)

| File | Change |
|---|---|
| `ui/docs/PROJECT_CYCLE_OPERATOR_RUNBOOK.md` | `budgetUSD` is a **fixed cap**, not 5% NMA. Drop “communityCirclePrimary = 10% of prior budget.” Add retro `usdBudget = 4000` (or whatever is decided). Add a **Compliance** section: review missed weekly reports, apply penalties before retro eligibility. |
| `ui/docs/Q3_2026_CYCLE_CLOSE_CHECKLIST.md` | Leave as a historical close checklist. Do not reuse its 5-winner / 3/4-cap expectations. |
| `docs/RETRO.md` | Mark obsolete. It still has operators editing `ProjectRewards.tsx` and running `isRewardsCycle` in `dates.ts`. Replace with a pointer to the runbook + Operator Panel. |
| `ui/cypress/integration/unit/vote-tally.cy.tsx` | This file **is** the executable spec (S5 top 50%, S6 3/4 cap, D1 floor of 3). Rewrite S5/S6/D1 for “top 3, no budget knapsack.” |

### 3.5 In-app copy that currently hardcodes v8.0 rules

These strings will be wrong the day the tally changes. Update them in the same release:

- `ProjectRewards.tsx` phase tooltips — Submit (1/5 cap), Member (top 50% + 3/4), Build (`#wdygdtw` + 5% penalty), Retro (ETH and vMOONEY to projects)
- `projects-overview.tsx` — “1/5 of the quarterly project budget”
- `getProposalTemplate()` — “1/5 of this quarter’s project budget”
- `/contributions` title/description — “ETH financial rewards and vMOONEY”
- `RetroactiveResults.tsx` — “community circle’s parallel slice (10%…)”
- `DashboardActiveProjects` — “Q{n} Budget” still fine; add a “Funded this quarter: 3 max” hint

---

## 4. Frontend and protocol changes

Work is almost entirely in `ui/`. No Solidity change is required for the budget cap, top-3 rule, or vMOONEY-only community pool. Tableland columns already store `eligible`, `finalReportLink`, `rewardDistribution`, and `upfrontPayments`.

### 4.1 Config — small, do first

`ui/const/config.ts` `PROJECT_CYCLE`:

```ts
budgetUSD: 12000,                    // fixed cap, not 5% NMA
// MAX_BUDGET_USD becomes budgetUSD / 3 → 4000
retro: {
  payoutToken: 'USDC',
  usdBudget: 4000,                   // dedicated retro pool (Option A)
  ethBudget: 0,
  communityCirclePrimary: 0,         // no stables to the circle
}
```

Add explicit constants so operators cannot silently re-derive 1/5 or 10%:

```ts
export const PROJECTS_FUNDED_PER_QUARTER = 3
export const MAX_BUDGET_USD = Math.round(NEXT_QUARTER_BUDGET_USD / 3)
export const RETRO_USD_POOL_FIXED = 4000
export const COMMUNITY_CIRCLE_STABLES = false
```

`getBudget()` should stop advertising a live 5% USD number on `/projects`. Keep it only for the MOONEY geometric series. If the live 5% figure remains on screen, operators and members will think the cap is still variable.

### 4.2 Winner selection — the only on-chain-adjacent logic change

Replace the body of `getApprovedProjects()`:

```ts
const TOP_N = 3
// sort by percent desc (existing)
for each project in rank order:
  approved = approvedCount < min(TOP_N, projects.length)
```

Drop `budgetCap` and the knapsack. With a $4,000 per-project max and 3 winners, the 3/4 cap is redundant ($12,000 = 100% of the new pool) and would **reject the third project** if all three ask $4,000.

Call sites (must stay in sync):

- `pages/api/proposals/vote.ts` (HSM tally → `ProjectTable.active`)
- `lib/proposals/computeMemberVoteOutcome.ts` (public preview / audit)
- `cypress/integration/unit/vote-tally.cy.tsx` and `voting.cy.tsx`

`BUDGET_OVERRIDES_USD` can remain for extractor mistakes. It is no longer needed to “trim to fit under 3/4.”

**Small-budget exception (brief open question): do not build in v1.** It reintroduces a second class of winners, a second cap, and Senate auto-approval — the exact complexity this reform removes. Point sub-$1,000 work at the Contribution Circle or a later milestone. Revisit after two quarters of top-3 data.

### 4.3 Retro USDC — keep the Member House UI, change the pool story

Keep:

- Retro tab on `/projects`
- Eligibility via Operator Panel (“Add Final Report & Mark Eligible”)
- Member House percentage allocation among eligible projects
- Audit at `/projects/retro-audit`

Change:

- Pool header: “$4,000 USDC retro pool” — not “remainder after upfront” and not “90% of 5% NMA”
- `computeRetroactiveOutcome.ts` / `HISTORICAL_RETRO_POOLS`: new cycles pin `primaryProjectsAmount = 4000`, `communityCirclePrimary = 0`
- `getPayouts()`: stop injecting a synthetic community-circle project with 10% of **USD**. USD CSV should list only project Safes / USDC recipients
- Final-report `rewardDistribution` may still split **USDC** among contributors if you want leads to pay teammates in stables. It must **not** drive vMOONEY

Option B (keep 5% NMA for retro only) reimports the operator calculation the brief is trying to kill. Option C (retro = multiple of budgets disbursed) is fairer when a quarter funds $6k instead of $12k, but it needs a new formula, new audit copy, and a new “what if only one project finishes?” rule. Start with A; revisit C after two completed cohorts.

### 4.4 Unified vMOONEY pool — largest product change

Today `getPayouts()` does:

```
for each project:
  usd  += projectShare * contributor%
  mooney += projectShare * contributor%
+ 10% of both to communityCircle object
```

Target:

```
usd    → only eligible projects, Member House shares (USDC)
mooney → only the unified circle allocation (addresses × senator/citizen %)
```

Frontend work:

1. **Remove** per-project vMOONEY fields from the final-report / “Add to Retroactives” modal (`upfrontPayments.vMOONEY`, MOONEY columns in payout tables).
2. **Add** a quarter-end “Allocate vMOONEY” panel (Operator or Senator-gated) that writes one distribution map — the same shape as today’s empty `communityCircle = {}` in `ProjectRewards.tsx`.
3. **Decide the allocator** before building the panel:
   - **Senators only** — already a constitutional right; least new UI
   - **Senators + Executives** — brief default; add EB wallets to the allowlist
   - **Citizens** — reuse the retro quadratic-vote UI against **people** instead of projects. Highest legitimacy, highest build cost, and a constitutional question

Recommendation: **Senators allocate in v1**, with the public feed as the ballot. Citizen allocation is a v2 experiment, not a launch blocker.

### 4.5 Contribution Circle as the reporting system — build the missing product

This is the piece that actually reduces administrative overhead. Policy without UI will fail the same way `#wdygdtw` failed.

**Use `/contributions` + the published sheet as the system of record.** It already has a citizen-gated submit path, a public feed, Discord announce-on-new-row (`/api/cron/contribution-notifications`), and an XP verifier. Coordinape should be a write-through or retired — do not ask leads to post in two places.

Required product changes:

| Feature | Why |
|---|---|
| **Project tag** on every submission (`projectId` / MDP / “Community”) | Distinguishes lead reports from community work; enables compliance |
| **Cadence badge** on the feed and on `/project/[id]` | “Last report: 3 days ago” / “Missed this week” |
| **Lead reminder** (email/Discord) if no tagged post by Sunday 23:59 UTC | Makes the first-miss warning automatic |
| **Compliance table** in the Operator Panel | Rows: project × week × posted? → warning / 10% / ineligible / shutdown-review |
| **Penalty write** | Store `missedReports` and `penalty` on the project row (or a small KV/sheet). `eligible = 0` when 3+ misses. Surface the 10% vMOONEY haircut in the allocate panel |
| **Dashboard widget** | Brief is right: project activity on the Dashboard is currently empty. Show this week’s reports + “help wanted” links |

Do **not** scrape Discord. That is the problem the brief describes.

Sheet vs Tableland: the sheet is fine for v1 if you add a `project` column and a `week` column. If Senators need an on-chain audit trail for penalties, promote compliance flags to Tableland (`updateTableCol`) so they sit next to `eligible`.

### 4.6 Proposal UX

- `RequestBudgetActionForm` max: already bound to `MAX_BUDGET_USD` — flips to $4,000 when config changes
- Template and AI review: same constant
- `/projects` and `/projects-overview`: show “$12,000 quarterly cap · 3 projects · $4,000 max”
- Member Vote results panel: “Funded: top 3” instead of pass/fail-under-3/4
- Launchpad CTA on the propose page when the ask exceeds $4,000 (template already mentions it; the form should block and link)

### 4.7 What you can skip

- New contracts
- Changing quadratic voting, self-vote stripping, or iterative normalization
- Changing Senate Vote mechanics
- Recomputing 5% NMA in the UI
- A Discord bot for `#wdygdtw`
- Auto-approval of no-MVP / sub-$1k proposals

---

## 5. Recommendations on the brief’s open questions

### 5.1 Retro pool: choose A ($4k fixed)

| Option | Fit to current code | Predictability | Fairness | Recommendation |
|---|---|---|---|---|
| **A. Fixed $3–5k** | Already how `retro.usdBudget` works | Highest | May over/under-reward a thin cohort | **Yes — $4k** |
| B. 5% NMA, retro only | Reuses `getBudget()` | Lowest — the problem you are solving | Scales with treasury | No |
| C. Multiple of budgets disbursed | New formula + audit | Medium | Best when spend varies | v2, after two cohorts |

$4k is in the brief’s $3–5k band and is close to Q2’s actual project retro ($5,629) after the community-stables cut. It is also easy to explain: “$12k to build, $4k to reward completion.”

### 5.2 vMOONEY-only community rewards: accept the participation risk, offset in-product

Removing ~$2.3k/quarter of community stables is correct for overhead. The risk is real: `/contributions` currently markets **ETH + vMOONEY**. Shipping vMOONEY-only without copy and incentive changes will look like a rug.

Offsets that do not recreate a stables rail:

- The unified pool is **100% of the quarterly MOONEY emission**, not 10%. That is a large governance-power increase for non-project contributors — say so on the page.
- Require funded projects to list **one public “help wanted” role** on the Dashboard (bounties paid from the $4k project budget, not a new pool).
- Keep XP / citizen quest credit for submissions (`has-contributed-proof` already keys off the sheet).

Do not “increase the vMOONEY allocation” as a separate lever — under this design the community *is* the allocation.

### 5.3 Top-3 limit: no exception path in v1

Q3’s fifth-place funded project (Satellite Payload, $4,682) and several sub-$2k proposals show there is demand below the old 1/5 cap. An exception path (“Senate auto-approves no-MVP under $1k”) creates:

- A second winner-selection function
- Pressure to game “no-MVP”
- More Safes, more final reports, more compliance rows — the overhead you are cutting

Launchpad is the documented overflow. If the Senate wants a micro-grant program, make it a **named, separate** $2k Community Circle USDC experiment later — not a hole in the top-3 rule.

### 5.4 Contribution Circle capacity: the site feed scales; Coordinape is the wrong bottleneck

The brief asks whether Coordinape can absorb project leads. That is the wrong system to scale.

`/contributions` already publishes every row. Coordinape is a third-party GIVE circle with a leftover editor and outdated docs. Putting leads into Coordinape **and** the Google Form **and** Discord is how signal dies.

v1: one form, one feed, project tags, senator allocation at quarter end. If the feed gets noisy, add filters (`Project` / `Community` / `This week`) — that is a day of UI, not a new circle.

### 5.5 Penalty enforcement: detect automatically, apply manually

| Step | Owner | Mechanism |
|---|---|---|
| Detect missed week | Cron (same pattern as `contribution-notifications`) | No row with `projectId` + week |
| Warn (1st miss) | Bot / Discord + in-app banner | No reward change |
| 10% vMOONEY cut (2nd) | EB in Operator Panel | Stored penalty flag; allocate panel reads it |
| Retro ineligible (3+) | EB confirm | Sets `eligible = 0` (already exists) |
| Shutdown review (4+ weeks) | EB + Senate | Existing project-termination right; do not auto-flip `active = 0` |

Automating detection is cheap and solves the audit problem. Automating shutdown is how you create disputes. The Constitution already lets Executive Leads jointly propose termination.

### 5.6 Timeline: do not target a binding Q4 2026 flip

Today is mid-August 2026. Q4 Senate Vote would need new rules, new copy, new tests, and a passed Project System proposal **before** the second Thursday of Q4 (early October). That is possible for the **budget cap + top-3 tally** (config + `getApprovedProjects` + copy). It is not possible for a trustworthy reporting/penalty system plus a vMOONEY allocator if you also want community input at a townhall.

Suggested sequence:

1. **Now — discussion:** circulate this analysis with the brief.
2. **Townhall:** lock the $12k / top-3 / $4k retro / vMOONEY-only package.
3. **Q4 2026 (pilot, non-binding):** ship `/contributions` project tags + compliance table + Dashboard widget. Keep v8.0 tally and 5% NMA pin for one more cycle *or* switch only the cap + top-3 if a Project System proposal passes in time.
4. **Q1 2027 (binding v9.0):** new tally, new retro pool, vMOONEY-only circle, penalties applied from Q4 pilot data (warn-only in Q4 so leads are not retroactively punished).

If the Senate wants Q4 binding for the **cap and top-3 only**, that is a coherent slice. Do not bind penalties or vMOONEY unification in the same week.

---

## 6. Impact on the project system

### 6.1 Money

Using Q3 2026 as the baseline ($24,310 budgets, 5 winners, $17,452 upfront; Q2 retro $5,629 projects + $2,341 community):

| | Recent actual | Proposed ($12k + $4k retro) | Delta |
|---|---:|---:|---:|
| Upfront project budgets | ~$15–17k | ≤ $12,000 | −$3–5k |
| Community Circle stables | ~$2,300 | $0 | −$2,300 |
| Project retro USDC | ~$5,600 | $4,000 | −$1,600 |
| **Stables / quarter** | **~$23–26k** | **≤ $16,000** | **−$7–10k** |
| vMOONEY to projects | 90% of emission | 0% | All of it moves to the circle |
| vMOONEY to community | 10% of emission | 100% of emission | ×10 for non-project contributors |

The MOONEY geometric series is unchanged. What changes is **who** receives it. Project leads who used to receive a large locked allocation through `rewardDistribution` must now earn it in public, week by week. That is the intended incentive. It is also the most likely source of pushback.

### 6.2 Throughput and quality

Top-3 + $4k max concentrates ~$12k on three teams instead of spreading ~$17k across five. That matches the brief’s “work closer with each lead” goal and matches how the Operator Panel is staffed (three allowlisted wallets).

Costs:

- **More rejected Senate-passed work.** In Q3, two funded projects would have lost under a strict top-3 (FUTURA Rover and Satellite Payload sat at ~7.6%). Those teams will feel the rule as a cliff, not a cap.
- **Hardware / education proposals get squeezed.** Several recent asks were $4.6–4.9k. They fit today’s 1/5 cap ($4,862) and miss a $4,000 max. Expect more launchpad traffic — make that path obvious on `/propose`.
- **Senate shrinks** if each project still seats one Senator. Fewer projects → fewer project Senators → higher quorum risk (70% of a smaller body). Decide whether to add at-large seats.

Benefits:

- Member Vote ballots get shorter (3–8 Senate-passed proposals is typical; funding 3 is easy to explain).
- The 3/4 knapsack and `BUDGET_OVERRIDES_USD` “trim to fit” dance go away.
- EB can actually read every weekly report.

### 6.3 Administration

| Task | v8.0 | v9.0 |
|---|---|---|
| Pin quarterly USD | Manual 5% NMA + comments | Type `12000` |
| Pin retro remainder | Subtract every upfront from 90% | Type `4000` |
| Community stables CSV | Separate 10% rail | Deleted |
| Per-project vMOONEY splits | Final-report JSON + `getPayouts` | Deleted |
| Weekly compliance | Impossible (Discord) | Feed + Operator table |
| Winner selection | Top 50% + knapsack + overrides | Top 3 |

Net admin time drops **if and only if** the compliance table exists. If you ship top-3 + cap without the feed, you have cut spend and left the enforcement problem untouched.

### 6.4 Culture and participation

The reform reframes project leads as **contributors who happen to hold a budget**, not a separate privileged class. That is consistent with Constitution values (Community First, Don’t Can’t Be Evil). It will be felt as a pay cut by leads who treated the 90% vMOONEY share as compensation.

Mitigations to write into the Project System, not just the townhall script:

- Leads can still pay **USDC** from the $4,000 project budget and from the project’s retro share.
- Leads who report weekly and show impact should win a **larger** vMOONEY share than an average citizen — the feed is how they prove it.
- First quarter of penalties is warn-only.

### 6.5 Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Q4 binding before reporting UI exists | High | Split the release (see §5.6) |
| Coordinape + Form + Discord remain in parallel | High | Declare `/contributions` canonical; archive Coordinape docs |
| $4k max kills hardware proposals | Medium | Launchpad CTA; allow multi-quarter milestones |
| Senate quorum after losing project seats | Medium | Revisit at-large Senate seats in the same proposal |
| Senators capture the unified vMOONEY pool | Medium | Public feed + published allocation; consider Citizen vote in v2 |
| Option A retro overpays a one-project quarter | Low | Accept; or add a “pool unused retro returns to treasury” sentence |
| Penalty disputes | Medium | Manual apply; warn-only first cycle; keep shutdown as a proposal |

---

## 7. Suggested implementation slices

Ship in this order. Each slice is a standalone PR.

1. **Docs + copy alignment (no behavior change)** — v9.0 draft on docs.moondao.com; in-app tooltips still say v8.0 until slice 2 ships.
2. **Config + tally** — `budgetUSD = 12000`, `MAX_BUDGET_USD / 3`, `getApprovedProjects` top-3, rewrite `vote-tally.cy.tsx`.
3. **Retro pool + community stables off** — `usdBudget = 4000`, `communityCirclePrimary = 0`, payout tables and audit copy.
4. **Contributions v2** — project tag, week, feed filters, Dashboard widget, Discord reminder cron.
5. **Operator compliance + penalties** — table, warning, `eligible` flip, 10% flag on the vMOONEY allocator.
6. **Unified vMOONEY allocator** — senator (or citizen) distribution UI; delete per-project MOONEY from `getPayouts`.

Do not merge 2 without 1. Do not merge 6 without 4. Slice 2+3 can be Q4 if governance passes; 4–6 should run as a Q4 pilot and bind in Q1.

---

## 8. Next steps (replaces the brief’s list)

1. Senate + EB review of this analysis alongside the June 26 brief.
2. Townhall: lock $12k / top-3 / $4k retro / vMOONEY-only / no exception path.
3. Draft **Project System v9.0** (ordinary proposal, not a constitutional amendment unless Senate composition is also changing).
4. If Senate seats-per-project stays, add a sentence on quorum and at-large seats.
5. Implement slices 4–5 immediately (they help even under v8.0).
6. Implement slices 2–3–6 only after the Project System proposal passes.
7. Financial model for the townhall: one slide with the table in §6.1 using the last four quarters’ actuals, not the 5% NMA theoretical.

---

## Appendix A — Code map

| Concern | Primary files |
|---|---|
| Cycle numbers | `ui/const/config.ts` (`PROJECT_CYCLE`, `MAX_BUDGET_USD`, `RETRO_*`) |
| Winner selection | `ui/lib/utils/rewards.ts` (`getApprovedProjects`, `getBudget`, `getPayouts`) |
| On-chain tally | `ui/pages/api/proposals/vote.ts` |
| Preview / audit | `ui/lib/proposals/computeMemberVoteOutcome.ts`, `computeRetroactiveOutcome.ts` |
| Budget overrides | `ui/lib/proposals/budgetOverrides.ts` |
| Proposal form / template | `ui/components/nance/RequestBudgetActionForm.tsx`, `ui/lib/nance/index.ts` |
| Projects UI + tooltips | `ui/components/nance/ProjectRewards.tsx` |
| Overview marketing | `ui/pages/projects-overview.tsx` |
| Community Circle | `ui/pages/contributions.tsx`, `ui/lib/contributions/getSheetContributions.ts` |
| Coordinape leftover | `ui/components/contribution/ContributionEditor.tsx`, `ui/lib/coordinape/*` |
| Operator eligibility | `ui/pages/api/operator/project-add-to-retroactives.ts` |
| Executable spec | `ui/cypress/integration/unit/vote-tally.cy.tsx` |
| Operator runbook | `ui/docs/PROJECT_CYCLE_OPERATOR_RUNBOOK.md` |
| Public policy | https://docs.moondao.com/Projects/Project-System |
| Constitution | https://docs.moondao.com/Governance/Constitution |

## Appendix B — Q3 2026 Member Vote (for modeling)

From `ui/docs/Q3_2026_CYCLE_CLOSE_CHECKLIST.md` ($24,310 budget, $18,232.50 cap):

| Result | MDP | ~% | Budget | Project |
|---|---|---:|---:|---|
| Yes | 260 | 30.87% | $4,640 | Human Rated DAO Vacuum Chamber |
| Yes | 265 | 21.12% | $1,100 | Interactive NASA Lunar Base Model |
| Yes | 259 | 9.28% | $2,430 | Mission Cosmic Colombia |
| Yes | 262 | 7.62% | $4,600 | FUTURA Rover |
| Yes | 258 | 7.61% | $4,682 | Satellite Payload & Secondary Education |
| No | 254 | 7.09% | $4,000 | PULSE / TOGO |

Under the recommended rules: **MDP-260, 265, 259 funded** ($8,170). MDP-260 would need to cut $640 to meet a $4,000 max. MDP-262 and 258 would lose despite passing today’s 3/4 cap. That single table is the best illustration to put in front of the Senate.
