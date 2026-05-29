# DePrize — Milestone 2: Registry-aware launchpad hooks

**Status:** Implemented, unit-tested
**Scope:** Teach the existing Juicebox launchpad hooks to read the DePrize lifecycle so contributions, cashOut (refunds) **and the payout-ruleset transition** follow the DePrize state machine instead of the immutable funding deadline — while staying 100% backwards-compatible for every non-DePrize mission. Mission creators can opt into "prize" mode at creation, or keep the classic time-based launchpad.
**Depends on:** Milestone 1 (`DePrizeRegistry`).
**Files:**

- `subscription-contracts/src/LaunchPadPayHook.sol` (modified — pay/cashOut/stage gating)
- `subscription-contracts/src/LaunchPadApprovalHook.sol` (modified — payout-ruleset transition gating)
- `subscription-contracts/src/MissionCreator.sol` (modified — `createMission` mode option)
- `subscription-contracts/test/deprize/LaunchPadPayHookDePrize.t.sol`
- `subscription-contracts/test/deprize/LaunchPadApprovalHookDePrize.t.sol`

See the full design in [`DEPRIZE.md`](./DEPRIZE.md); this implements the `LaunchPadPayHook.stage()` / cashOut-gating upgrade described there, plus the matching payout-gating that keeps the pot locked for the indefinite duration of a prize.

## The three valves (why the pay hook alone is not enough)

A launchpad mission is governed by **three** independent gates on the JB project, not one. Money/state only stay consistent if all three defer to the same source of truth:

| Valve | Controls | Gated by |
|---|---|---|
| `LaunchPadPayHook.beforePay / beforeCashOut` | contributor pay-ins & refunds | DePrize registry (this milestone) |
| `LaunchPadApprovalHook.approvalStatusOf` | ruleset 0 → 1 transition = **unlocking team payouts** | DePrize registry (this milestone) |
| Fund-access limits (`payoutLimits` / `surplusAllowances`) | how much the owner can pull once payouts are unlocked | the active ruleset |

The original "fail if the goal isn't met" behavior lives in the **approval hook**: once `deadline + refundPeriod` elapses it approves the payout ruleset regardless of funding. For an indefinite prize that immutable clock *will* elapse, which would let the team drain the pot mid-campaign even while the pay hook's cashOut lock is active. So M2 makes the approval hook DePrize-aware too: for a prize, payouts unlock **only** when the prize wraps up successfully.

---

## Why

In the original hook, refunds (`beforeCashOutRecordedWith`) are gated purely by `fundingGoal`, `deadline`, and `refundPeriod` — all immutable at construction. A DePrize runs on a different clock: contributions and refunds are governed by an on-chain lifecycle (`DePrizeRegistry`), not a fixed deadline. M2 lets the hook defer to that lifecycle when (and only when) a DePrize is attached, so:

- the **5% prize slice** and betting collateral stay locked while a campaign is live, and
- `$OVERVIEW` holders can reclaim their ETH floor the moment a DePrize hits a refundable terminal — with **no expiry window**.

## How (backwards-compatible by construction)

A single optional pointer is added: `IDePrizeRegistry public deprizeRegistry`, set via owner-gated `setDePrizeRegistry(address)` (defaults to `address(0)`). The setter is a **one-way latch**: it reverts once a registry is already set, so it can neither be detached nor repointed. The hook owner is the mission `to` account (a different trust domain from the registry admin), so a mutable pointer would let that owner drop the registry mid-campaign and bypass the cashOut lock — the latch closes that hole.

The "is this a DePrize?" decision is one helper:

```solidity
function _deprizeIdFor(uint256 projectId) internal view returns (uint256) {
    if (address(deprizeRegistry) == address(0)) return 0; // no registry → original behavior
    return deprizeRegistry.deprizeIdByJBProject(projectId); // 0 → original behavior
}
```

So **every** path keeps its exact original behavior unless a registry is set *and* the project is bound to a DePrize. Live missions (which never set a registry) are untouched. This is the `deprizeId == 0 → original` convention M1 was built around.

### Behavior when a DePrize *is* attached

| Hook path | Non-terminal (DRAFT…M1_RELEASED) | Refundable terminal (CANCELLED / NO_WINNER / M2_FAILED) | Success terminal (M2_COMPLETE) |
|---|---|---|---|
| `beforePayRecordedWith` | contributions **allowed** (deadline ignored) | **reverts** "closed to new contributions" | **reverts** "closed" |
| `beforeCashOutRecordedWith` | **reverts** "DePrize is active" | refund **allowed** (supply = `funding × weight / 2e18`, no expiry) | **reverts** "DePrize is active" |
| `approvalStatusOf` (payouts) | `Failed` — stay locked (deadline ignored) | `Failed` — stay locked so refunds work | **`Approved`** — unlock payout ruleset |
| `stage()` | `1` (active) | `3` (refund) | `2` (payouts) |

- "Closed to new contributions" = any terminal state (`registry.isTerminal`).
- "Refund allowed" = `registry.isRefundable` (the three refundable terminals only).
- "Unlock payouts" = a **non-refundable terminal** (`isTerminal && !isRefundable`), i.e. `M2_COMPLETE` — "requirements met by a team". This is the only state that advances ruleset 0 → 1; the immutable `deadline` is ignored entirely for a prize.
- `fundingTurnedOff` remains an emergency owner override that wins over everything, DePrize or not.
- The refund-supply math is unchanged from the original (`currentFunding × rulesetWeight / 2e18`, accounting for the 50% reserve), so existing JB cashOut accounting is preserved.
- The approval hook reads the registry **from the pay hook** (`payHook.deprizeRegistry()`) rather than holding its own pointer, so there is exactly one source of truth and the two gates can never disagree.

### Deliberately deferred

Payouts unlock **fully** at `M2_COMPLETE`; there is no partial release at `M1_RELEASED`. The milestone-split disbursement (30% at M1, 70% at M2, paid to the winning *provider* rather than the team's payout split) is the **MilestoneEscrow**'s job in a later milestone. Until it exists, the safe behavior is to keep funds fully locked until the prize is fully delivered, which is what this milestone does. `stage()` returns `1` for `SETTLED` / `M1_RELEASED` for the same reason.

## Choosing a funding model at creation

`MissionCreator.createMission` now has two overloads:

1. `createMission(…, memo)` — the original signature, unchanged. Creates a **classic time-based launchpad** (registry left unset; every DePrize path stays dormant; fails-to-refund if the goal isn't met by the deadline). Existing callers (frontend included) keep working with no change.
2. `createMission(…, memo, address deprizeRegistry)` — when `deprizeRegistry != address(0)`, the mission is created in **prize mode**: the pay hook is wired to the registry atomically at creation (the creator deploys the pay hook owned by `MissionCreator`, calls the write-once `setDePrizeRegistry`, then hands ownership to `to`), and the approval hook picks the registry up from the pay hook. The pot then stays locked with no deadline until the DePrize reaches a terminal.

In prize mode the **DePrize admin still binds the project to a DePrize** via the registry's `onlyOwner` `register(jbProjectId, teamIds, sunset)` (the project id only exists after `launchProjectFor`, so this is a follow-up admin call). `createMission` just wires the hooks to obey the registry; until `register` runs, `deprizeId == 0` and the mission behaves like a classic launchpad.

### Retrofitting an existing mission

Existing missions (e.g. the Frank mission) are bound after the fact with **two calls by two different owners** (distinct trust domains, not one account):

1. **Registry admin** (`DePrizeRegistry` owner) calls `DePrizeRegistry.register(jbProjectId, teamIds, sunset)`.
2. **Hook owner** (the mission `to` account) calls `payHook.setDePrizeRegistry(registryAddress)` — owner-gated and write-once.

The approval hook needs no separate wiring; it reads the registry from the pay hook.

## Tests

`forge test --match-path 'test/deprize/LaunchPad*.t.sol'` — **20 passing** (15 pay hook + 5 approval hook), using lightweight mock `IJBTerminalStore` / `IJBRulesets` / pay-hook stand-ins so the gating logic is deterministic and needs no RPC fork.

`LaunchPadPayHookDePrize.t.sol`:

- setter access control + write-once latch (detach/repoint and zero-address both revert)
- backwards compatibility: no registry, and registry-set-but-project-unregistered, both fall through to original pay/cashOut behavior
- active DePrize: contributions allowed past the immutable deadline, cashOut reverts, `stage() == 1` — across `LOCKED / VOTING / SETTLED / M1_RELEASED` and `DRAFT`
- success terminal (`M2_COMPLETE`): cashOut still reverts, `stage() == 2` (payouts)
- refundable terminals (`CANCELLED / NO_WINNER / M2_FAILED`): cashOut enabled with correct supply math, contributions closed, `stage() == 3`
- `fundingTurnedOff` overrides the DePrize path

`LaunchPadApprovalHookDePrize.t.sol`:

- backwards compatibility: no registry and registry-set-but-unregistered fall through to the original deadline/goal approval logic
- active + refundable states stay `Failed` (payouts locked) **even well past the immutable deadline + refund period**
- `M2_COMPLETE` returns `Approved` — the only state that unlocks the payout ruleset

> Original (non-DePrize) pay/cashOut behavior continues to be exercised end-to-end against the live JB V5 stack by `MissionTest.t.sol` on a Sepolia fork.
>
> Note: run with `--skip 'test/ManualRefundTest.t.sol' --skip 'test/OwnerOnlyPayoutsRulesetTest.t.sol'` until the test-cleanup PR (#1323) merges; those two pre-existing files block whole-suite compilation.

## Next milestone (M3)

The betting/mint contract: split an incoming bet into the 5% JB prize slice and the 95% CTF collateral, route outcome tokens to the bettor, and pause on `registry.bettingOpen(deprizeId) == false`.
