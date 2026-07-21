# Project Cycle Operator Runbook

Step-by-step guide for Executive Branch operators to move MoonDAO’s project
system between phases. Use this every quarter.

**Who can do this:** wallets in `OPERATORS` in `ui/const/config.ts` (currently
pmoncada, ryand2d, miguel). Sign in on [moondao.com/projects](https://moondao.com/projects)
with that wallet; the purple **Operator Panel** appears at the top of the page.

**Who signs on-chain txs:** the GCP HSM wallet
(`GCP_HSM_SIGNER_ADDRESS` / `0xb206…f5d32`), which owns the `Proposals` and
`ProjectTable` contracts. Your click hits a server API; the HSM signs. Your EOA
does **not** need contract ownership.

---

## Phase overview

| Phase | What’s live | How you get there |
|---|---|---|
| **Senate Vote** | Pending proposals; senators vote Yes/No | Edit `PROJECT_CYCLE` + deploy (start of quarter) |
| **Member Vote + Retro** | Member Vote distribute UI; retroactive rewards for prior quarter | One click: **Close Senate & Open Member Vote** |
| **Idle** | Neither voting UI is active | One click: **Wrap Up Cycle** (after member tally) |

Member Vote and Retroactive Rewards run **at the same time**. Advancing into
the *next* quarter’s Senate Vote is a config edit (new budget/deadlines/retro
pool), not a runtime button.

---

## 0. Start of a new quarter (roll forward)

Do this once when opening a new cycle. Requires a PR + deploy.

1. Open `ui/const/config.ts` and edit **`PROJECT_CYCLE` only**:
   - `quarter` / `year` → the new proposal quarter
   - `phase` → `'senate'`
   - `submissionDeadline` / `editingDeadline` / `votingDate`
   - `budgetUSD` → new quarterly budget
   - `memberVoteSubmissionsOpen` → `false` until Member Vote opens (or leave false; Advance will open the phase, and you can set this `true` in the same PR if you want submissions ready when Member Vote starts)
   - `memberVoteExcludedAddresses` → `[]`
   - `retro` → pool for the **prior** quarter’s completed projects:
     - `payoutToken` (`USDC` or `ETH`)
     - `usdBudget` or `ethBudget` (post-upfront remainder for projects)
     - `communityCirclePrimary` = **10% of the prior quarter’s own budget** (not the new `budgetUSD`)
2. Open a PR, merge, wait for production deploy.
3. Confirm `/projects` shows Senate Vote (Temperature Check proposals).

---

## 1. During Senate Vote

Senators vote on each proposal page. Operators can close a single proposal via
the per-proposal **Close Senate Vote** control, or wait and batch-close in step 2.

Optional prep while senators vote:

- Collect final reports for completed prior-quarter projects.
- Use **Add Final Report & Mark Eligible** in the Operator Panel so the retro
  tab has a cohort ready when Member Vote opens.

---

## 2. Close Senate → open Member Vote + Retro

When senators have voted (quorum met on the proposals you intend to advance):

1. Go to `/projects` → **Operator Panel** → **Cycle Phase**.
2. Click **Preview (dry run)**. Review the per-MDP list (each row shows the
   MDP number **and title**):
   - `passed` / `failed` — would tally
   - `below-quorum` — still needs senators (or Force later)
   - `already-closed` / `passed`/`failed` from prior close — already done
   - Proposals blocked from the UI (withdrawn / resubmitted / in
     `BLOCKED_MDPS` or `BLOCKED_PROJECTS`) are **skipped automatically** — they
     never show up as blockers, so a withdrawn proposal can't stall the advance.
3. Click **Close Senate & Open Member Vote**. Confirm the dialog.
4. The server will:
   - Sign `Proposals.tallyVotes(mdp)` for every pending current-cycle MDP
     (idempotent; skips closed / below-quorum)
   - Flip the live phase to **Member Vote + Retro** (stored in Upstash; no redeploy)
5. Within about a minute, `/projects` should show:
   - Member Vote UI for Senate-passed proposals
   - Retroactive Rewards tab for the prior-quarter cohort

**If some proposals are below quorum:** either wait for more senator votes and
retry, or use **Force advance past blockers** only if you intentionally want to
leave those proposals untallied and still open Member Vote.

**If a tx fails:** the panel lists the MDP + error. Fix (RPC / HSM / ownership)
and click Advance again — already-closed MDPs are skipped.

---

## 3. During Member Vote + Retro

### Member Vote

- Citizens / voting members submit distributions on the proposals tab.
- To freeze new submissions but keep results visible: set
  `PROJECT_CYCLE.memberVoteSubmissionsOpen = false` in a PR (or keep it open
  until wrap-up).

### Retroactive rewards

1. For each completed prior-quarter project: **Add Final Report & Mark Eligible**.
2. Citizens / members allocate on the Retroactive tab.
3. After the retro window, run **Clear Retro Cohort** so `eligible` is reset
   before the next cycle marks new projects.

---

## 4. Close Member Vote (on-chain tally)

When the Member Vote window should end (typically ~5 days after the third
Thursday):

1. In **Cycle Phase**, click **Run Member Vote Tally**.
2. This calls `POST /api/proposals/vote`, which:
   - Tallies √vMOONEY-weighted distributions
   - Flips winners to `active` / losers to vote-failed on `ProjectTable` (HSM)
   - Logs a vMOONEY + distributions snapshot to the server console
3. **Paste that snapshot** into `ui/lib/proposals/vMooneySnapshots.ts` under
   `MEMBER_VOTE_VMOONEY_SNAPSHOTS` and open a follow-up PR so the public audit
   stays frozen.
4. Optionally upgrade the snapshot later with  
   `yarn --prefix ui snapshot:vmooney -- --kind=member --quarter=Q --year=Y`.

If the API returns “Voting period has not ended,” wait until the window is over
(mainnet enforces this).

---

## 5. Wrap up the cycle (UI)

After the member tally (and after retro is settled):

1. Click **Wrap Up Cycle** in the Operator Panel.
2. Live phase → **idle**. Senate / Member / Retro UIs stop highlighting as active.
3. Run **Clear Retro Cohort** if you haven’t already.
4. Pin the completed retro pool into `HISTORICAL_RETRO_POOLS` in
   `computeRetroactiveOutcome.ts` when you roll config to the next cycle.

---

## 6. Next quarter

Return to **§0**. Edit `PROJECT_CYCLE` (new quarter, budget, retro for the
cohort you just closed, `phase: 'senate'`), PR, deploy.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Operator Panel missing | Wallet not in `OPERATORS` / not signed in | Sign in with an allowlisted wallet |
| Advance fails: HSM not available | Missing `GCP_SIGNER_*` env on Vercel | Restore HSM env; do not transfer ownership to a personal EOA |
| `OwnableUnauthorizedAccount` | HSM is not contract owner | Transfer ownership back to `GCP_HSM_SIGNER_ADDRESS` |
| Advance 409 with blockers | Quorum not met on some real (non-blocked) MDPs | Wait for votes, or Force if intentional |
| A withdrawn/resubmitted proposal shows as a blocker | It isn't in `BLOCKED_MDPS`/`BLOCKED_PROJECTS` yet | Add it to `const/whitelist.ts` and deploy; it will then be skipped |
| UI still on Senate after Advance | Stale ISR / cache | Wait ~60s or hard-refresh; panel polls `/api/operator/phase-status` |
| Phase stuck / wrong after deploy | Live KV override still set | Expected — override wins over `PROJECT_CYCLE.phase`. Wrap up or advance, or clear the Redis key `moondao:operator:cycle_phase` |

---

## Mental model (short)

```
[Edit PROJECT_CYCLE + deploy]
        ↓
   Senate Vote  ──(Advance: tallyVotes + flip)──►  Member Vote + Retro
                                                         │
                                              (Run Member Vote Tally)
                                                         │
                                              (Wrap Up Cycle)
                                                         ↓
                                                       Idle
                                                         │
                                              [Edit PROJECT_CYCLE + deploy]
                                                         ↓
                                                  next Senate Vote
```

Runtime advances (Senate → Member → Idle) = button + HSM txs + Redis phase.
Starting a new quarter = edit `PROJECT_CYCLE` + deploy.
