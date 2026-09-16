# Q4 2026 Cycle Open — Operator Checklist

Manual steps to confirm **Q4 2026 intake** is live and ready for incoming
proposals. Companion to
[`PROJECT_CYCLE_OPERATOR_RUNBOOK.md`](./PROJECT_CYCLE_OPERATOR_RUNBOOK.md).

Do these on [moondao.com/projects](https://www.moondao.com/projects). Operator
actions require an allowlisted wallet (`OPERATORS` in `ui/const/config.ts`:
pmoncada, ryand2d, miguel).

---

## Config pin (this PR)

| Field | Value |
|---|---|
| Phase | `intake` |
| Quarter / year | Q4 2026 |
| Submission deadline | October 8, 2026 |
| Editing deadline | October 13, 2026 |
| Senate / voting date | October 15, 2026 |
| `budgetUSD` | **$8,500** (3% of official liquid AUM $288,847 at 2026-07-01 00:00 UTC, ETH $1,569.94, nearest $500) |
| Grant cap (¼) | **$2,125** |
| Retro (Q3 cohort) | $4,427 USDC projects + $2,431 community circle (v8 leftover; already closed) |

Budget recalculated 2026-09-16 via
`node scripts/calculate-budget.mjs --year 2026 --quarter 4` under MDP-267.

---

## After deploy

- [ ] `/projects` Operator Panel shows **Intake (proposals open)** for Q4 2026
- [ ] Senate Vote / Member Vote UIs are **not** active
- [ ] Site-wide banner reads Project Proposals Open, deadline October 8, 2026,
      total budget $8,500, max $2,125
- [ ] `/proposals` shows the Q4 intake countdown and the budget / max-ask cards
- [ ] A leftover Q3 `idle` override (if still in Upstash) is ignored — no
      manual Redis delete required
- [ ] Optional: click **Reset to config default** if a same-cycle override is
      active and you want to follow `PROJECT_CYCLE.phase`

---

## October 8 — submissions close

- [ ] New proposals after the deadline return 422 with a next-cycle message
- [ ] Authors can still edit existing Q4 proposals until October 13
- [ ] Banner hides after the deadline

---

## October 13–15 — open Senate Vote

After Townhall presentations:

1. `/projects` → Operator Panel → **Preview (dry run)**
2. **Open Senate Vote**
3. If the editing deadline has not passed, the server 409s — wait or Force
4. Confirm `/projects` shows Senate Vote (Temperature Check)

From here, follow the runbook (Close Senate → Member Vote + Retro).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Operator Panel missing | Sign in with an `OPERATORS` wallet |
| Phase still idle after deploy | Stale unstamped overrides are ignored; confirm `/api/operator/phase-status` reports `livePhase: "intake"` and `overrideIsStale: true` if a leftover exists |
| Banner missing | Confirm `ANNOUNCE_PROJECT_BUDGET` is true and the deadline has not passed |
| Budget figure looks old | Re-run `node scripts/calculate-budget.mjs --year 2026 --quarter 4` |
