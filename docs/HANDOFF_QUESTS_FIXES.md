# Handoff: Quests-Fixes PR #1352

**Branch:** `Quests-Fixes` → `main`  
**PR:** [#1352](https://github.com/Official-MoonDao/MoonDAO/pull/1352)  
**Date:** June 2, 2026  

---

## Project Summary

Full audit and fix of all 8 MoonDAO XP quests in `ui/`. The quests allow users to earn XP and MOONEY by completing on-chain actions (voting, contributing, joining a team, etc.). Work covered endpoint fixes, UI rework, eligibility logic, loading/timeout handling, and progress bar semantics.

---

## Current State

### ✅ Everything is committed and pushed to `origin/Quests-Fixes`

All working tree is clean (`git status` shows no uncommitted changes).

### Files Changed vs. `main` (base commit `c0b860348`)

| File | What changed |
|------|-------------|
| `ui/pages/api/xp/has-voted-proof.ts` | Fixed: now counts on-chain Tableland votes + Snapshot votes combined |
| `ui/pages/api/xp/has-contributed-proof.ts` | Fixed: calls `getSheetContributions` correctly, returns count |
| `ui/pages/api/xp/has-completed-citizen-profile-proof.ts` | Fixed: reads citizen profile fields properly |
| `ui/pages/api/xp/has-joined-a-team-proof.ts` | Fixed: queries Hats subgraph for team membership |
| `ui/pages/api/contributions/feed.ts` | Fixed: graceful error handling |
| `ui/lib/contributions/getSheetContributions.ts` | Fixed: try/catch around fetch, returns `[]` on network error instead of throwing |
| `ui/lib/xp/staged-quest-info.ts` | Added `getProgressThreshold(progress)` helper — returns highest *met* threshold when claimable, else next unmet threshold |
| `ui/components/xp/Quest.tsx` | Major rework — see below |
| `docs/QUESTS_AUDIT.md` | Full audit doc for all 8 quests |

---

## `Quest.tsx` Changes (the big one)

### UI
- Unified card layout: icon + title + description + reward badge in header; progress bar; action row in footer — consistent across all quest types
- `isCompleted` wrapped in `Boolean(...)` (was falsy-bug with `"0"`)

### Eligibility
- Added `singleQuestEligible` state (`null` | `false` | `true`)
- Effect fetches eligibility metric for ALL single quests on mount
- Claim button gated: `singleQuestEligible === true` (single) or `totalClaimableXP > 0` (staged)
- This fixes single quests showing "Claim +0" while "Not started"

### Loading / Timeout
- `fetchWithTimeout(input, init, ms = 8000)` — AbortController-based 8s timeout on all fetches
- `retryWithBackoff` — max 2 retries, 500ms base, 4s cap
- Loading split: spinner only while `isLoadingStagedProgress`; "Couldn't load progress · Retry" shown on failure
- Bounded auto-retry effect (max 3 attempts, 1.5s → 4.5s spacing)

### Progress Bar Semantics
- Uses `getProgressThreshold(stagedProgress)` as the bar's denominator
- When a stage is claimable: `stagedDisplayMetric = Math.min(userMetric, threshold)` → bar shows `5/5 (100%)` until claimed, then `5/10 (50%)` after claiming

### Claim Error Surfacing (MOST RECENT CHANGE)
- **Before:** on non-2xx response, threw `HTTP 500: Internal Server Error` (discarded real error body)
- **After:** reads JSON body *before* checking `response.ok`; uses `data?.error` as the error message if present, falling back to the status text
- This means real server errors (oracle proof invalid, signer out of gas, XP Manager out of MOONEY, etc.) now show in the toast instead of a blank `HTTP 500:`

---

## Claim Flow: CONFIRMED WORKING (June 2, 2026)

Voting Power and Has Voted (both staged quests) were successfully claimed on the Vercel preview. **No wallet signature is required — this is by design.** The server-side HSM signer (or `XP_ORACLE_SIGNER_PK` fallback) submits the `claimBulkXPFor` transaction on behalf of the user. The user never signs anything.

When the "Quest claimed successfully!" toast appears with a tx hash, the claim went through.

### How the relayer works
```
Frontend POST /api/xp/<quest>-proof
  → server fetches user metric (votes, VP, etc.)
  → signOracleProof() — HSM or PK signs EIP-712 proof server-side
  → submitBulkClaimFor() — server submits claimBulkXPFor() to Arbitrum
  → returns { eligible: true, txHash: '0x...' }
  → frontend shows success toast, polls hasClaimedFromVerifier() for confirmation
```

### Key signing files
- `ui/lib/oracle/index.ts` — `signOracleProof()`, balance/authorization pre-flight checks, HSM signing path
- `ui/lib/xp/index.ts` — `submitBulkClaimFor()`, `submitHasVotedBulkClaimFor()`, etc.
- `ui/lib/google/hsm-signer.ts` — Google Cloud KMS wrapper; `createHSMWallet()`, `sendTransaction()`, `getPublicKey()`

### Signing architecture
```
isHSMAvailable()  ←  !!process.env.GCP_SIGNER_SERVICE_ACCOUNT
    ├── true  → getHSMSigner() / createHSMWallet() using GCP Cloud KMS
    │              needs: GCP_SIGNER_SERVICE_ACCOUNT (base64 JSON)
    │                     GCP_PROJECT_ID
    │                     GCP_SIGNER_PUBLIC_KEY (PEM, for address derivation)
    └── false → Wallet(process.env.XP_ORACLE_SIGNER_PK)
```

---

## Quest Inventory

| # | Quest | Type | Verifier Route | Status |
|---|-------|------|---------------|--------|
| 1 | Voting Power | staged | `/api/xp/voting-power-proof` | ✅ Working |
| 2 | Has Voted | staged | `/api/xp/has-voted-proof` | ✅ Fixed |
| 3 | Has Contributed | staged | `/api/xp/has-contributed-proof` | ✅ Fixed |
| 4 | Citizen Profile | single | `/api/xp/has-completed-citizen-profile-proof` | ✅ Fixed |
| 5 | Joined a Team | single | `/api/xp/has-joined-a-team-proof` | ✅ Fixed |
| 6 | Submit PR | single | `/api/xp/has-submitted-pr-proof` | ✅ Was working |
| 7 | Submit Issue | single | `/api/xp/has-submitted-issue-proof` | ✅ Was working |
| 8 | Citizen Referral | single | `/api/xp/citizen-referrals` | ✅ Was working |

---

## Key Configs

```
ui/const/config.ts           — XP_ORACLE_ADDRESSES, XP_MANAGER_ADDRESSES, verifier addresses
ui/lib/xp/config.ts          — XP_VERIFIERS array (verifierId per verifier address)
ui/lib/xp/staged-quest-info.ts — threshold/stage helpers for staged quests
```

---

## PR Copilot Review Comments (all resolved)

1. **`getSheetContributions` unhandled throw** → wrapped in try/catch, returns `[]` ✅  
2. **Staged reward badge shows `+0` while loading** → shows spinner during load ✅  
3. **Single quest claim gating** → `singleQuestEligible` state added ✅  

---

## Full Logical Audit — All 8 Quests (June 2, 2026)

Performed without live testing by tracing every route → sign → submit → UI path. Findings:

| Quest | Severity | Issue Found | Status |
|-------|----------|-------------|--------|
| Voting Power | — | No issues | ✅ Tested live |
| Has Voted | — | No issues | ✅ Tested live |
| Contributions | INFO | Requires `CONTRIBUTIONS_SHEET_CSV_URL` env var; silent `[]` if unset | ⚠️ Config-only |
| Citizen Profile | MEDIUM | `signHasCompletedCitizenProfileProof` hardcoded `xpAmount=5` instead of `fetchVerifierXp()` | ✅ Fixed |
| Join a Team | HIGH | `has-joined-a-team-proof.ts` returned `teamJoined` but `config.ts` reads `metricKey: 'teamsJoined'` → Claim button permanently hidden for eligible users | ✅ Fixed |
| Join a Team | LOW | `submitHasJoinedTeamClaimFor` had no oracle proof pre-validation (sends tx blind) | ✅ Fixed |
| Submit PR | LOW UX | Ineligible response included `error: "You need at least 1 merged PR…"` → red error box for normal "not started" state | ✅ Fixed |
| Submit Issue | LOW UX | Same as PR — spurious error box for 0-issue state | ✅ Fixed |
| Citizen Referral | LOW | POST handler submits tx without pre-checking eligibility (UI gates on `totalClaimableXP > 0`; on-chain revert is safety net) | Acceptable |

### `CONTRIBUTIONS_SHEET_CSV_URL` check
Verify this env var is set in Vercel → Project Settings → Environment Variables. If missing, all users show 0 contributions.

---

## Additional Fixes — June 2, 2026 session

| File | What changed |
|------|-------------|
| `ui/lib/xp/index.ts` | Removed dead-code `submitHasVotingPowerClaimFor` and `submitHasVotedClaimFor` (both called `getVerifierId` with the XP Manager address instead of the verifier address, and used `claimXPFor` instead of `claimBulkXPFor`; neither was imported by any route) |
| `ui/lib/xp/config.ts` | Added explicit `type: 'single'` to Citizen Profile verifier (was implicitly treated as single but lacked the field) |
| `ui/components/xp/Quest.tsx` | Fixed MOONEY balance pre-flight check in `claimQuest`: for staged quests `xpAmount` state is always 0, so the check was a no-op. Now uses `stagedProgress?.totalClaimableXP` for staged quests |

---

## Next Steps for New Chat

1. **Verify `CONTRIBUTIONS_SHEET_CSV_URL`** is set in Vercel env vars (silent failure if missing)
2. **Verify `GITHUB_TOKEN`** is set for PR and Issue quests (returns 0 silently if missing)
3. **End-to-end test with a citizen account that has:**
   - Completed profile → Citizen Profile quest claim
   - Wears a MoonDAO hat → Join a Team quest claim
   - Has contributions in the sheet → Contributions quest claim
4. **Watch the blockchain confirmation toast** — after "Quest claimed successfully!" the UI polls on-chain and should fire "Quest claim confirmed on blockchain!" within ~30s. If it doesn't appear, the tx may be pending (refresh after a minute).
5. Once all 8 quests are verified end-to-end, **merge the PR** (#1352)
