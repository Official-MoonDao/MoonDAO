# Design: Project Cycle — Intake Phase & Quarter-Source Hardening

**Status:** proposed
**Target package:** `ui/` only
**Written:** 2026-09-16
**Audience:** the engineer/agent implementing the PR

---

## 1. Why this exists

The July 2026 batch (PR-era commits `0094add23`, `30ab4efa6`, `b86053177`,
`2a78b4c16`, `01974ab25`) introduced the modern project-cycle machinery:

- `PROJECT_CYCLE` in `const/config.ts` as the single per-cycle config object.
- A live phase override in Upstash KV (`lib/operator/cyclePhase.ts`) so the
  Executive Branch can advance `senate → member → idle` without a redeploy.
- The Operator Panel (`components/operator/OperatorPanel.tsx`) with one-click
  Senate batch-close, member tally, wrap-up, and retro cohort management.
- `PROJECT_CYCLE_OPERATOR_RUNBOOK.md` + `Q3_2026_CYCLE_CLOSE_CHECKLIST.md`.

That machinery was built during, and validated by, the Q3 2026 close. It has
never been exercised on the **opening** half of a cycle. This PR closes the
gaps that only show up when you open a cycle rather than close one.

### Current state as of 2026-09-16

`PROJECT_CYCLE` (`const/config.ts:822-851`) is already rolled forward to Q4
2026 and the numbers are correct — the roll landed in `d4f924d84` (2026-08-17):

| Field | Value |
|---|---|
| `phase` | `'senate'` |
| `quarter` / `year` | 4 / 2026 |
| `submissionDeadline` | October 8, 2026 |
| `editingDeadline` | October 13, 2026 |
| `votingDate` | October 15, 2026 |
| `budgetUSD` | 20029 |
| `retro` | Q3 cohort: $4,427 USDC projects + $2,431 community circle |

The Q3 close freeze also landed correctly: `MEMBER_VOTE_VMOONEY_SNAPSHOTS` has
`2026-Q3`, `RETRO_VMOONEY_SNAPSHOTS` has through `2026-Q2`, and
`HISTORICAL_RETRO_POOLS` has `2026-Q1` and `2026-Q2`. **No snapshot or pool
work is needed in this PR.**

What is wrong is everything about *where we are in the cycle right now*.

---

## 2. Problems

### P0-A — The Q3 `idle` override still wins over the Q4 config

`resolveLivePhase` (`lib/operator/cyclePhase.ts:154-158`) is:

```154:158:ui/lib/operator/cyclePhase.ts
export function resolveLivePhase(
  override: LivePhaseOverride | null | undefined
): ProjectCyclePhase {
  return override?.phase ?? PROJECT_CYCLE.phase
}
```

The override has no expiry and no cycle stamp. "Wrap Up Cycle" at the end of Q3
wrote `{ phase: 'idle' }` to `moondao:operator:cycle_phase`, and that value
outranks the Q4 `phase: 'senate'` default **forever**, across any number of
deploys. The config author knew this and left a prose warning at
`const/config.ts:823-825` ("If a leftover Upstash override from Q3 Wrap Up is
still `idle`, clear `moondao:operator:cycle_phase`"), plus a runbook
troubleshooting row — but nothing in code enforces it, and there is no UI
affordance to clear the key. `setLivePhaseOverride({ phase: null })` exists and
is never called by anything.

Unless someone manually cleared Redis, production has been sitting in `idle`
since the Q3 wrap-up. Rolling a new cycle should invalidate the old cycle's
override automatically.

### P0-B — There is no phase for "collecting proposals"

`PHASE_ORDER` is `['senate', 'member', 'idle']`
(`lib/operator/cyclePhase.ts:28`). But the governance doc
(`content/docs/Projects/Project System.md`, §Proposal Process) defines four
distinct stages inside a quarter:

| Doc step | Q4 2026 date | Modeled phase |
|---|---|---|
| Step 2 — proposal submission | by Oct 8 | **none** |
| Step 3 — Senate review / edits | until Oct 13 | **none** |
| Step 4 — Townhall + Senate approve/reject | Oct 15 | `senate` |
| Step 5 — Member House vote | after Oct 15 | `member` |

Steps 2 and 3 have no representation. The only way to express "the cycle is
open" is `phase: 'senate'`, which makes the UI claim "Senate Vote In Progress"
(`components/nance/Proposal.tsx`, `ProjectCard.tsx`) for the ~5 weeks before
any senator can vote. It also arms the Operator Panel's "Close Senate & Open
Member Vote" button from day one of the quarter.

Today — Sep 16, three weeks before the Q4 submission deadline — we are in the
intake stage, and the system has no way to say so.

### P1-A — The on-chain member tally reads the calendar, not the config

`getCurrentQuarter` silently ignores its `offset` argument and returns the
calendar quarter:

```37:39:ui/lib/utils/dates.ts
export function getCurrentQuarter(offset: number = 0) {
  return getRelativeQuarter(0)
}
```

`pages/api/proposals/vote.ts:166` uses it, and discards the `quarter`/`year`
the caller sent in the request body:

```165:174:ui/pages/api/proposals/vote.ts
async function POST(req: NextApiRequest, res: NextApiResponse) {
  const { quarter, year } = getCurrentQuarter()
  // ...
  const voteStatement = `SELECT * FROM ${PROPOSALS_TABLE_NAMES[chainSlug]} WHERE quarter = ${quarter} AND year = ${year}`
```

Meanwhile the proposal slate on `/projects`, the Senate batch-close in
`advance-phase.ts:96`, and the member-vote distribute keys all come from
`PROJECT_CYCLE` (`pages/projects/index.tsx:105-115` has an explicit comment
rejecting `getRelativeQuarter(0)` for exactly this reason).

So the read path and the write path use different clocks. They agree only when
the operator happens to act inside the calendar quarter that matches
`PROJECT_CYCLE`. Right now — Q4 config, calendar Q3 — they disagree: a member
tally today would query and flip **Q3 2026** rows.

The same split affects the retro cohort. `pages/projects/index.tsx:86-88` and
`components/nance/ProjectRewards.tsx:357-359` both do:

```357:359:ui/components/nance/ProjectRewards.tsx
  const { quarter, year } = getRelativeQuarter(
    isRewardsCycle(new Date(), livePhase === 'member') ? -1 : 0
  )
```

`isRewardsCycle(date, true)` short-circuits to `true` (`lib/utils/dates.ts:96-97`),
so in member phase this is always calendar−1. The retro cohort should be the
quarter before `PROJECT_CYCLE.quarter`, which is Q3 2026 — but calendar−1 today
is Q2 2026.

Default (no-query-param) audit routes have the same problem:
`api/proposals/vote-results.ts`, `api/proposals/vote-audit.ts`, and
`pages/projects/audit.tsx` default to the calendar quarter;
`api/proposals/retro-results.ts`, `api/proposals/retro-audit.ts`, and
`pages/projects/retro-audit.tsx` default to calendar−1.

### P1-B — `/api/proposals/vote` is not operator-gated

```725:725:ui/pages/api/proposals/vote.ts
export default withMiddleware(POST, rateLimit)
```

This is the endpoint that runs the member tally and flips winning projects to
`active` on `ProjectTable` via the HSM signer. Every comparable route is gated
— `api/proposals/closeSenate.ts:239` and `api/operator/advance-phase.ts:510`
both use `withMiddleware(handler, rateLimit, isOperator)`. This one is missing
the gate, so any anonymous caller can trigger an HSM-signed on-chain tally.

The existing "Voting period has not ended" guard (`vote.ts:443-448`) limits the
blast radius to the post-close window, and it is mainnet-only. That is not a
substitute for auth.

### P2 — Intake is not actually ready for proposers

- `ANNOUNCE_PROJECT_BUDGET = false` (`const/config.ts:897`). It was turned off
  in `e0179fc02` with the message "until the next-quarter number is confirmed."
  The Q4 number **is** confirmed and pinned ($20,029, max ask $4,006). While the
  flag is false: the submission banner never renders
  (`components/layout/ProjectBanner.tsx:45`), `/proposals` hides the budget and
  max-ask cards, `/proposal-template` hides the max ask, and
  `/projects-overview` drops the pool column.
- Nothing gates submission on the deadline. `api/proposals/submit.ts` checks
  auth and content only. A proposal created on Oct 20 is tagged Q4 by
  `getSubmissionQuarter()` and appears in the Senate slate after the Senate has
  already voted.
- `getSubmissionQuarter()` (`lib/utils/dates.ts:130-146`) tags new proposals
  from calendar math, independent of `PROJECT_CYCLE`. It happens to return Q4
  today, but it is a fourth clock in a system that should have one.
- `isApprovalActive` is hard-wired open (`lib/utils/dates.ts:112-113`,
  `if (true) return true`) — dead code that reads like a live gate.

### P3 — No tests, stale runbook

Nothing under `ui/cypress/` touches `cyclePhase`, `useLivePhase`,
`advance-phase`, `phase-status`, or `OperatorPanel`. The runbook documents the
three-phase model and tells operators to hand-clear Redis.

---

## 3. Design

### 3.1 Four-phase model

```
intake  →  senate  →  member  →  idle  ──[config edit + deploy]──►  intake (next cycle)
```

| Phase | Window (Q4 2026) | What is live |
|---|---|---|
| `intake` | now → Oct 15 | Proposal submission (to Oct 8) + Senate review/edits (to Oct 13) + the 48h freeze before the Townhall. Banner + countdown. No voting UI. |
| `senate` | Oct 15 → close | Senators vote Yes/No on each proposal. |
| `member` | close → tally | Member Vote distributions + retroactive rewards (concurrent, unchanged). |
| `idle` | after wrap-up | Nothing active. |

`intake` is deliberately one phase, not two. Submission (step 2) and Senate
review/edits (step 3) differ only by the `submissionDeadline` date, which the
UI already renders from config — they do not need separate KV states.

The `intake → senate` advance does **no on-chain work**; it only writes the KV
override. Every other transition keeps its current behavior.

### 3.2 Cycle-stamped overrides

`LivePhaseOverride` gains `quarter` and `year`, written by
`setLivePhaseOverride` from `PROJECT_CYCLE`. `resolveLivePhase` ignores any
override whose stamp does not match the current `PROJECT_CYCLE`, falling back
to `PROJECT_CYCLE.phase`.

**An override with no stamp is treated as stale.** This is the migration path:
the only unstamped override that can exist in production is the Q3 wrap-up
`idle`, which is exactly the value we want to discard. The first operator
action after this deploys writes a stamped record.

This makes the "edit `PROJECT_CYCLE` + deploy" roll-forward self-healing and
retires the runbook's manual Redis instruction.

### 3.3 One source of truth for cycle quarters

New module `lib/projectCycle/cycleQuarters.ts` — three exported helpers, all
derived from `PROJECT_CYCLE`, zero `new Date()`:

- `getProposalCycle()` → `{ quarter, year }` — the Senate/Member vote cohort.
- `getRetroCohort()` → the quarter *before* the proposal cycle (with year
  rollover: Q1 2027 → Q4 2026).
- `getSubmissionTargetCycle(phase)` → `getProposalCycle()` when `phase` is
  `intake`, otherwise the quarter *after* the proposal cycle. Once the slate
  locks at `senate`, new proposals belong to the next cycle.

Every call site that means "the current cycle" switches to these. Explicit
`?quarter=&year=` query params on audit routes keep working unchanged — only
the defaults move.

---

## 4. Implementation plan

### 4.1 `lib/projectCycle/cycleQuarters.ts` — new

```ts
import { PROJECT_CYCLE } from 'const/config'
import type { ProjectCyclePhase } from 'const/config'

export type CycleQuarter = { quarter: number; year: number }

function shiftQuarter({ quarter, year }: CycleQuarter, offset: number): CycleQuarter {
  const zeroBased = quarter - 1 + offset
  return {
    quarter: ((zeroBased % 4) + 4) % 4 + 1,
    year: year + Math.floor(zeroBased / 4),
  }
}

export function getProposalCycle(): CycleQuarter {
  return { quarter: PROJECT_CYCLE.quarter, year: PROJECT_CYCLE.year }
}

export function getRetroCohort(): CycleQuarter {
  return shiftQuarter(getProposalCycle(), -1)
}

export function getSubmissionTargetCycle(phase: ProjectCyclePhase): CycleQuarter {
  return phase === 'intake' ? getProposalCycle() : shiftQuarter(getProposalCycle(), 1)
}
```

Keep `getRelativeQuarter` in `lib/utils/dates.ts` — it still has legitimate
calendar-display callers. Do not delete it.

### 4.2 `const/config.ts`

- `ProjectCyclePhase` → `'intake' | 'senate' | 'member' | 'idle'`.
- Add to `ProjectCycleConfig`: `enforceSubmissionDeadline: boolean` — the single
  lever for late-submission policy (see 4.7).
- `PROJECT_CYCLE.phase` → `'intake'`. Set `enforceSubmissionDeadline: true`.
  Replace the "clear the leftover Upstash override" comment
  (`const/config.ts:823-825`) with a note that stale-cycle overrides are now
  ignored automatically.
- Update the roll-forward instructions in the header comment
  (`const/config.ts:763-769`): step 3 currently says "Set `phase` to 'senate'
  (Senate Vote opens first)" — it becomes `'intake'`.
- `ANNOUNCE_PROJECT_BUDGET` → `true`, with a comment that the Q4 figure is
  confirmed and pinned.
- Add `export const IS_INTAKE = PROJECT_CYCLE.phase === 'intake'` alongside the
  existing `IS_*` flags for symmetry. (All four are currently unimported; leave
  them, they are the documented deploy-time fallback surface.)

### 4.3 `lib/operator/cyclePhase.ts`

- `PHASE_ORDER = ['intake', 'senate', 'member', 'idle']`.
- `PhaseFlags` gains `isIntake`; `getPhaseFlags` returns
  `isIntake: phase === 'intake'`. `isMemberVote`/`isRewardsCycle` unchanged.
- `isProjectCyclePhase` accepts `'intake'`.
- `LivePhaseOverride` gains `quarter?: number` and `year?: number`.
- `setLivePhaseOverride` stamps `PROJECT_CYCLE.quarter` / `.year` on write.
- `getLivePhaseOverride` parses and returns the stamp.
- `resolveLivePhase` returns `PROJECT_CYCLE.phase` unless
  `override.quarter === PROJECT_CYCLE.quarter && override.year === PROJECT_CYCLE.year`.
- `resolveMemberVoteSubmissionsOpen` applies the same staleness check before
  honoring the override. Keep the existing legacy branch
  (`override?.phase === 'member'` → open) but make it reachable only for
  stamp-matching overrides.
- Add `clearLivePhaseOverride()` (thin wrapper over
  `setLivePhaseOverride({ phase: null })`) for the new operator action.

### 4.4 `pages/api/operator/advance-phase.ts`

- `intake → senate`: no on-chain work. Write the override, revalidate
  `/projects`, return `{ newPhase: 'senate' }`. The existing Senate batch-tally
  path stays bound to `senate → member`.
- Guard: if advancing `intake → senate` before `PROJECT_CYCLE.editingDeadline`,
  return 409 with a blocker explaining that proposals are still editable,
  overridable by the existing `force` flag. Reuse the current 409/`force`
  contract so the panel's existing error rendering works unchanged.
- Accept `{ reset: true }` → `clearLivePhaseOverride()`, returning the config
  default. Still `isOperator`-gated.
- Replace the `PROJECT_CYCLE.quarter/year` literals at line 96 with
  `getProposalCycle()`.

### 4.5 `pages/api/operator/phase-status.ts`

Add `overrideIsStale: boolean` to the response so the panel can explain why a
KV value is being ignored. Everything else is already derived from the
resolvers and needs no change.

### 4.6 `components/operator/OperatorPanel.tsx`

- `phaseLabel` gains `intake` → `"Intake (proposals open)"`.
- `PhaseInfo` type gains `overrideIsStale`.
- New `livePhase === 'intake'` block: shows the submission/editing/voting
  deadlines from `PROJECT_CYCLE` and an **Open Senate Vote** button
  (`doAdvance(false)`), with the same Force path on 409.
- New **Reset to config default** button, shown whenever
  `livePhase !== configPhase`, posting `{ reset: true }`. Confirm dialog.
- When `overrideIsStale`, render an amber note that a previous cycle's override
  is being ignored.
- `runMemberTally` must send the resolved cohort explicitly (see 4.8).

### 4.7 Intake gating

`pages/api/proposals/submit.ts`:

- Replace `getSubmissionQuarter()` at line 537 with
  `getSubmissionTargetCycle(resolveLivePhase(await getLivePhaseOverride()))`.
- When `PROJECT_CYCLE.enforceSubmissionDeadline` is true and
  `Date.now() > PROJECT_CYCLE.submissionDeadline`, reject **new** proposals with
  422 and a message naming the next cycle. Edits and deletes by the author are
  unaffected — they are governed by `editingDeadline`, and blocking them would
  break the Step 3 review loop.

`pages/proposals.tsx`: surface the intake state — deadline, days remaining, and
a closed-state message once past `submissionDeadline` — using `useLivePhase()`.

Delete `isApprovalActive` (`lib/utils/dates.ts:112-128`) and its callers'
imports. It is unreachable dead code that misleads readers into thinking
approval is date-gated.

### 4.8 Quarter-source migration

Mechanical. In each file, swap the calendar call for the helper:

| File | Line | From | To |
|---|---|---|---|
| `pages/api/proposals/vote.ts` | 166 | `getCurrentQuarter()` | `getProposalCycle()` |
| `pages/api/proposals/vote-results.ts` | 26 | `getCurrentQuarter()` default | `getProposalCycle()` |
| `pages/api/proposals/vote-audit.ts` | 26 | `getCurrentQuarter()` default | `getProposalCycle()` |
| `pages/projects/audit.tsx` | 49 | `getRelativeQuarter(0)` fallback | `getProposalCycle()` |
| `lib/proposals/excludeMemberVotes.ts` | 60 | `getCurrentQuarter()` fallback | `getProposalCycle()` |
| `pages/projects/index.tsx` | 86-88 | `getRelativeQuarter(isRewardsCycle(...))` | `getRetroCohort()` |
| `components/nance/ProjectRewards.tsx` | 357-359 | same | `getRetroCohort()` |
| `pages/api/proposals/retro-results.ts` | 34 | `getRelativeQuarter(-1)` fallback | `getRetroCohort()` |
| `pages/api/proposals/retro-audit.ts` | 31 | `getRelativeQuarter(-1)` fallback | `getRetroCohort()` |
| `pages/projects/retro-audit.tsx` | 61 | `getRelativeQuarter(-1)` fallback | `getRetroCohort()` |
| `pages/final-reports.tsx` | 108 | `getRelativeQuarter(-1)` | `getRetroCohort()` |
| `pages/projects/thank-you.tsx` | 39 | `getRelativeQuarter(-1)` fallback | `getRetroCohort()` |

Both `final-reports.tsx` and `thank-you.tsx` mean "the cohort whose reports are
being reviewed this cycle" — the retro cohort — so `getRetroCohort()` is the
correct replacement, not `getProposalCycle()`.

Leave calendar math in place where the display genuinely means "today's
quarter": `pages/projects-overview.tsx:108` and
`components/project/DashboardActiveProjects.tsx:20`. Change
`ProjectRewards.tsx:360` (`currentQuarter`/`currentYear`, used for the
`Q{n}: {year} Rewards` header) to `getRetroCohort()` — that header labels the
retro pool, so calendar-now is wrong there.

Once `vote.ts` derives the cohort itself, have `OperatorPanel.runMemberTally`
and `ProjectRewards.tallyVotes` keep sending `{ quarter, year }` from
`getProposalCycle()`, and have `vote.ts` **validate** the body against its own
derivation, returning 409 on mismatch rather than silently ignoring it. That
turns today's silent divergence into a loud one.

### 4.9 Security

`pages/api/proposals/vote.ts:725` →
`export default withMiddleware(POST, rateLimit, isOperator)`.

Check callers before merging: the Operator Panel already sends
`credentials: 'include'`. Confirm `ProjectRewards.tallyVotes` does too, and
that no unauthenticated surface calls this route.

### 4.10 Tests

Follow the existing pattern in `ui/cypress/integration/unit/`.

`cycle-phase.cy.tsx`:
- `PHASE_ORDER` / `getNextPhase` across all four phases; `idle` → `null`.
- `getPhaseFlags` for each phase, including `isIntake`.
- `resolveLivePhase`: matching stamp wins; mismatched stamp ignored; **unstamped
  ignored**; `null` override falls back to config.
- `resolveMemberVoteSubmissionsOpen`: closed outside `member`; stale override
  ignored; legacy stamped `phase: 'member'` treated as open.

`cycle-quarters.cy.tsx`:
- `getRetroCohort` rollover (Q1 2027 → Q4 2026).
- `getSubmissionTargetCycle` for each phase, including Q4 → Q1 next-year
  rollover out of `senate`.

Update `cypress/integration/layout/project-banner.cy.tsx`: its `hideBanner`
guard skips most assertions while `ANNOUNCE_PROJECT_BUDGET` is false. With the
flag flipping to true those branches become live for the first time — run the
spec and fix any assertion that was never actually exercised.

### 4.11 Docs

- `PROJECT_CYCLE_OPERATOR_RUNBOOK.md`: four-phase table and mental-model
  diagram; new §for `intake → senate`; document **Reset to config default**;
  replace the "clear the Redis key" troubleshooting row with the automatic
  stale-override behavior; note that new proposals retarget the next cycle once
  the phase leaves `intake`.
- New `Q4_2026_CYCLE_OPEN_CHECKLIST.md`, mirroring the Q3 close checklist:
  verify intake live → announce budget → Oct 8 submissions close → Oct 13
  editing closes → Oct 15 Open Senate Vote → hand off to the runbook.
- `content/docs/Projects/Project System.md` needs **no change**. This PR moves
  the code toward the doc, not the other way around.

---

## 5. Rollout

1. Merge and deploy. `PROJECT_CYCLE.phase = 'intake'` ships in the same PR.
2. The stale Q3 `idle` override is ignored automatically (§3.2). Optionally
   delete `moondao:operator:cycle_phase` from Upstash for cleanliness — no
   longer required.
3. Verify on `/projects`: phase reads **Intake**, Q4 2026, banner live with the
   Oct 8 deadline, no Senate or Member voting UI, Operator Panel shows the
   intake block with **Open Senate Vote**.
4. Oct 8 — submissions close automatically via `enforceSubmissionDeadline`.
5. Oct 13-15 — after the Townhall, click **Open Senate Vote**.
6. From there, the existing runbook applies unchanged.

**Rollback:** revert the PR. Because stale overrides are ignored rather than
deleted, any pre-existing KV value returns to its prior behavior on revert.
Reverting after an operator has advanced to `senate` would leave a stamped
`senate` override that the old `resolveLivePhase` still honors — correct
behavior, no manual cleanup.

---

## 6. Acceptance criteria

- [ ] `resolveLivePhase` ignores overrides stamped to a different cycle, and
      ignores unstamped overrides.
- [ ] A fresh `PROJECT_CYCLE` roll-forward takes effect on deploy with no Redis
      intervention.
- [ ] `/projects` on a clean deploy shows Intake for Q4 2026, no voting UI.
- [ ] Operator Panel exposes **Open Senate Vote** in intake and **Reset to
      config default** whenever the live phase differs from config.
- [ ] `intake → senate` before `editingDeadline` returns 409 unless forced.
- [ ] No production code path derives the proposal or retro cohort from
      `new Date()`. Explicit audit query params still work.
- [ ] `/api/proposals/vote` returns 401/403 unauthenticated, and 409 when the
      body's cohort disagrees with `getProposalCycle()`.
- [ ] New proposals after `submissionDeadline` are rejected with a message
      naming the next cycle; author edits still work.
- [ ] `ANNOUNCE_PROJECT_BUDGET` is true and the banner renders the Oct 8
      deadline with the $4,006 max ask.
- [ ] New unit specs pass; `yarn --prefix ui lint` and the existing Cypress
      suite are clean.

---

## 7. Out of scope

- Any change to `HISTORICAL_RETRO_POOLS`, `MEMBER_VOTE_VMOONEY_SNAPSHOTS`, or
  `RETRO_VMOONEY_SNAPSHOTS`. Q3 is frozen correctly; the Q3-cohort retro pool
  is live in `PROJECT_CYCLE.retro` and gets pinned at the *end* of Q4.
- Retro payout mechanics, Coordinape, VotingEscrowDepositor.
- Nance, the proposal editor's content model, and the Google Docs import path.
- Contracts. No Solidity changes; `Proposals` / `ProjectTable` ownership and
  the HSM signer are untouched.
- Any package outside `ui/`.
