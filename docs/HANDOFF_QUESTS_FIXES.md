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

## Unresolved: Claim Transactions Failing

### Symptom
Clicking "Claim" returns a 500. The real error message is now surfaced in the toast (as of the latest commit), but hasn't been re-tested yet on the preview.

### Root Cause — UNKNOWN (pending re-test)
The claim flow is: **frontend** → `POST /api/xp/has-voted-proof` (or equivalent) → `signOracleProof()` → `submitBulkClaimFor()` → on-chain `claimBulkXPFor`. The failure happens server-side in one of those steps.

Most likely candidates:
1. **Signer EOA out of gas** — `signOracleProof` checks the signer's ETH balance and throws if < 0.01 ETH. The HSM signer address can be found by calling `getAddressFromEnvPublicKey()` in `ui/lib/google/hsm-signer.ts`. Fund it on Arbitrum.
2. **Signer not authorized on oracle** — `isSigner(signerAddress)` returns false. Add signer via oracle admin.
3. **XP Manager out of MOONEY** — the contract that distributes rewards has no tokens. Fund `XP_MANAGER_ADDRESSES[arbitrum]`.
4. **Oracle EIP-712 domain mismatch** — chain or contract address mismatch between env config and deployed oracle.

### How to diagnose
1. Push the latest `Quest.tsx` (already committed) and trigger a Vercel Preview deploy
2. Attempt a claim
3. Read the toast — the real server error message will now appear
4. Match against the candidates above

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

## Next Steps for New Chat

1. **Trigger Vercel Preview deploy** (or check if it auto-deployed from the last push)
2. **Attempt a claim** on any quest
3. **Read the real error toast** — this will tell you exactly what's wrong on the server
4. Most likely fix: **fund the HSM signer address with ETH on Arbitrum** or **fund the XP Manager with MOONEY**
5. Once claims work end-to-end, the PR is ready to merge
