# Q3 2026 Cycle Close — Operator Checklist

Manual steps to close **Q3 2026 Member Vote** and **Q2 2026 Retroactives**.
Do these on [moondao.com/projects](https://www.moondao.com/projects) signed in
with an allowlisted operator wallet (`OPERATORS` in `ui/const/config.ts`:
pmoncada, ryand2d, miguel).

Companion PR freezes audit snapshots + historical retro pool + deploy-time
`phase: 'idle'` fallback. Runtime phase still comes from Upstash until you
click **Wrap Up Cycle**.

---

## Before you start

Confirm on `/projects` → **Operator Panel** → phase status:

- [ ] Live phase is **member** (Member Vote + Retro)
- [ ] You are ready for **no more ballots** (close window already ended Jul 21;
      UI may still show submissions open via the live override)

Quick verify (optional):

- Member audit: `/projects/audit` or  
  `https://www.moondao.com/api/proposals/vote-audit?quarter=3&year=2026`
- Retro audit:  
  `https://www.moondao.com/api/proposals/retro-audit?quarter=2&year=2026`

**Expected Member Vote outcome (20 ballots, $24,310 budget / $18,232.50 cap):**

| Pass? | MDP | ~% | Budget | Project |
|---|---|---:|---:|---|
| Yes | 260 | 30.87% | $4,640 | Human Rated DAO Vacuum Chamber |
| Yes | 265 | 21.12% | $1,100 | Interactive NASA Lunar Base Model |
| Yes | 259 | 9.28% | $2,430 | Mission Cosmic Colombia |
| Yes | 262 | 7.62% | $4,600 | FUTURA Rover |
| Yes | 258 | 7.61% | $4,682 | Satellite Payload & Secondary Education |
| No | 254 | 7.09% | $4,000 | PULSE / TOGO |
| No | 261–249 | … | … | remaining |

Passing budgets sum **$17,452**.

**Expected Retro pool (13 ballots):** $5,629.26 USDC + ~6.58M MOONEY to projects;
community circle $2,340.90 USDC + ~732k MOONEY. Rankings shift with late ballots —
use the live retro-audit JSON as the payout source of truth at close time.

---

## Step 1 — Run Member Vote Tally (on-chain)

1. Open `/projects` → purple **Operator Panel** → **Cycle Phase**.
2. Click **Run Member Vote Tally**.
3. Confirm the dialog. The server (`POST /api/proposals/vote`) will:
   - Tally √vMOONEY-weighted distributions
   - Flip winners to `active` / losers to vote-failed on `ProjectTable` (HSM)
   - Log a vMOONEY + distributions snapshot to the **server console**
4. Wait for success. If you get “Voting period has not ended,” wait and retry
   (mainnet enforces the window).
5. Spot-check winners on `/projects` (Active / funded set should match the five
   PASS rows above).

> Snapshots for the public audit are already pinned in this PR
> (`MEMBER_VOTE_VMOONEY_SNAPSHOTS['2026-Q3']`). If the tally log differs from
> the pinned distributions (late Tableland edit), re-run  
> `yarn --prefix ui snapshot:vmooney --kind=member --quarter=3 --year=2026`  
> and amend the PR before merge.

---

## Step 2 — Capture final Retro numbers (read-only)

1. Open the **Retroactive Rewards** tab and/or  
   `https://www.moondao.com/api/proposals/retro-audit?quarter=2&year=2026`.
2. Save / screenshot the per-project **USDC + MOONEY** shares — these drive
   treasury payouts.
3. Confirm community circle amounts: **$2,340.90 USDC** + **~731,512 MOONEY**.

Retro vMOONEY + distributions are pinned in this PR as
`RETRO_VMOONEY_SNAPSHOTS['2026-Q2']`. Pool amounts are pinned in
`HISTORICAL_RETRO_POOLS['2026-Q2']`.

---

## Step 3 — Wrap Up Cycle (UI → idle)

1. In **Operator Panel** → **Cycle Phase**, click **Wrap Up Cycle**.
2. Confirm. Live phase → **idle** (Upstash override).
3. Hard-refresh `/projects` (~60s if cached). Senate / Member / Retro voting
   UIs should no longer show as active.

---

## Step 4 — Clear Retro Cohort

1. In **Operator Panel**, click **Clear Retro Cohort**.
2. This clears `eligible` (and retires those projects from the active pool)
   so Q2 retro projects do not leak into the next cycle’s Retro tab.
3. Confirm the Retroactive tab no longer lists the Q2 cohort as eligible.

---

## Step 5 — Pay out Retroactives (treasury)

From the Step 2 audit numbers:

1. **Project USDC** — CSV / Safe airdrop of each project’s `primaryShare`
   (total **$5,629.26**).
2. **Project MOONEY / vMOONEY** — follow the existing VotingEscrowDepositor
   flow in `docs/RETRO.md` (approve + `updateWithdrawAmounts`) for the
   ~6.58M MOONEY project pool.
3. **Community circle** — Coordinape / circle payout for **$2,340.90 USDC** +
   ~731k MOONEY (separate from the project pool).

---

## Step 6 — Merge / deploy this freeze PR

After Steps 1–4 (and ideally after payouts are queued):

1. Merge this PR and wait for production deploy.
2. Confirm `/projects/audit` (and retro audit) still show the frozen Q3 / Q2
   numbers.
3. Confirm phase status shows **idle** (KV override and/or deploy fallback).

---

## Step 7 — Next quarter (separate PR — do not mix)

When opening Q4 2026 Senate Vote:

1. Edit `PROJECT_CYCLE` only: bump `quarter`/`year`, deadlines, `budgetUSD`,
   `phase: 'senate'`, reset `memberVoteExcludedAddresses`, set `retro` for the
   **Q3** completed cohort once upfront funding is known.
2. PR + deploy (see `PROJECT_CYCLE_OPERATOR_RUNBOOK.md` §0).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Operator Panel missing | Sign in with an `OPERATORS` wallet |
| Tally / wrap fails: HSM | Restore `GCP_SIGNER_*` on Vercel; HSM must own Proposals / ProjectTable |
| UI still shows Member Vote after Wrap Up | Wait ~60s / hard-refresh; panel polls `/api/operator/phase-status` |
| Retro projects still listed after Clear | Retry Clear Retro Cohort; check Tableland `eligible` / `active` |
| Audit drifts after close | Ensure this PR’s snapshots are deployed; re-run `snapshot:vmooney` if Tableland rows changed post-pin |
