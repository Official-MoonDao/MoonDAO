# Manual Refunds — Work Summary

## Problem
Missions launched with refunds disabled on Juicebox V5 have no way to issue refunds if the funding goal isn't met. The `MissionCreator.stage()` returns 4 (closed) instead of 3 (refundable) because the original PayHook has `refundsEnabled=false` and `refundPeriod=0`.

## Solution
Queue a new ruleset on the Juicebox project with a new PayHook and ApprovalHook that have refunds enabled. The UI was updated to read the mission stage from the **active ruleset's dataHook** instead of the original PayHook stored in MissionCreator.

---

## Contract Work (`set-up-refunds` branch)

### Tests
- **`subscription-contracts/test/ManualRefundTest.t.sol`** — 3 end-to-end tests:
  1. `testManualRefundViaQueuedRuleset` — queues refund ruleset, waits for activation, contributor redeems
  2. `testManualRefundWhenGoalMet` — verifies refund still works even when goal is met
  3. `testManualRefundWindowExpires` — confirms redemption fails after refund period ends
- Run with: `forge test --match-contract ManualRefundTest --via-ir --optimizer-runs 200 -vvv`

### Scripts
- **`subscription-contracts/script/QueueRefundRuleset.s.sol`** — generic script that builds the refund ruleset config and calls `queueRulesetsOf` on the JB Controller. For use with Safe UI (generate calldata, propose via Transaction Builder).
- **`subscription-contracts/script/QueueRefundViaExec.s.sol`** — Safe-aware script that deploys new hooks and executes `queueRulesetsOf` through a 1/1 Gnosis Safe via `execTransaction`. Used for Sepolia testing.

### Documentation
- **`subscription-contracts/REFUND_PLAYBOOK.md`** — step-by-step guide for operators to enable refunds on a mainnet mission.

### Sepolia Test (Mission 8, Project 249)
- Created team 20 with Safe `0xe774...286` (1/1, signer `0x31CD...827`)
- Created mission 8 on team 20, contributed ETH
- Deployed new PayHook `0x1e88CBafEC9310918e463dc3Ee606cd3BcE2A9eb` (refundsEnabled=true, refundPeriod=28d)
- Deployed new ApprovalHook `0x2513AA2D2Fae927Cf9D08F9C7c88185D28012982` (refundsEnabled=true)
- Queued refund ruleset via Safe — new ruleset ID `1774497024`
- After deadline passed, ruleset advanced. New PayHook `stage()` returns 3 (refundable).

---

## UI Work (`Remove-tooltip` branch)

### `ui/lib/mission/fetchMissionServerData.ts`
- **SSR fix**: After reading `MissionCreator.stage()`, checks if `currentRulesetOf`'s `dataHook` differs from the original PayHook stored in `missionIdToPayHook`. If so, reads `stage()` from the active dataHook.
- Also returns `activePayHookAddress` so `fetchTimeData` reads `deadline` and `refundPeriod` from the correct hook.

### `ui/lib/mission/useMissionData.tsx`
- **Client-side polling fix**: `refreshStage()` previously called `MissionCreator.stage()` every 60s, overwriting the SSR-provided stage=3 with stage=4. Now, when MissionCreator returns stage 4, it also checks the active ruleset's dataHook and reads stage from there if it differs from the original PayHook.

### `ui/components/mission/MissionPayRedeem.tsx`
- Always renders when `isRefundable` (stage=3) instead of returning `null`
- Shows Redeem button when user has tokens, or a sign-in/loading message otherwise
- When `onlyButton && stage === 3` in the header slot, renders the full refund UI instead of a "Contribute" button

### `ui/components/mission/MissionProfileHeader.tsx`
- Hides Tokens/Payouts manager buttons when `stage === 3` to prevent accidental distribution during refund period

### `ui/components/mission/MissionProfile.tsx`
- Mobile pay/redeem panel stays `xl:hidden` (refund card lives in MissionInfo sidebar on desktop)

---

## Key Insight
`MissionCreator.stage(tokenId)` reads from the **original PayHook** stored in `missionIdToPayHook[tokenId]`. When a new refund ruleset is queued, the active ruleset's `dataHook` changes but MissionCreator still points to the old one. Both the SSR (`fetchMissionServerData`) and client-side polling (`useMissionData.refreshStage`) needed to be updated to read from the active dataHook.

---

## Mainnet Flow
1. Get mission's project ID and team Safe address
2. Deploy new PayHook + ApprovalHook with refunds enabled
3. Queue new ruleset via Safe (either script or Safe UI Transaction Builder)
4. Wait for current ruleset to expire
5. Contributors see Redeem button on mission page and can claim refunds

See `subscription-contracts/REFUND_PLAYBOOK.md` for detailed steps.
