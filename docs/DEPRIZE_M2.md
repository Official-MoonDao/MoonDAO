# DePrize — Milestone 2: Registry-aware `LaunchPadPayHook`

**Status:** Implemented, unit-tested
**Scope:** Teach the existing Juicebox data hook to read the DePrize lifecycle so cashOut (refunds) follow the DePrize state machine instead of the immutable funding deadline — while staying 100% backwards-compatible for every non-DePrize mission.
**Depends on:** Milestone 1 (`DePrizeRegistry`).
**Files:**

- `subscription-contracts/src/LaunchPadPayHook.sol` (modified)
- `subscription-contracts/test/deprize/LaunchPadPayHookDePrize.t.sol`

See the full design in [`DEPRIZE.md`](./DEPRIZE.md); this implements the `LaunchPadPayHook.stage()` / cashOut-gating upgrade described there.

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
| `stage()` | `1` (active) | `3` (refund) | `1` |

- "Closed to new contributions" = any terminal state (`registry.isTerminal`).
- "Refund allowed" = `registry.isRefundable` (the three refundable terminals only).
- `fundingTurnedOff` remains an emergency owner override that wins over everything, DePrize or not.
- The refund-supply math is unchanged from the original (`currentFunding × rulesetWeight / 2e18`, accounting for the 50% reserve), so existing JB cashOut accounting is preserved.

### Deliberately deferred

`stage()` returns `1` for `SETTLED` and `M2_COMPLETE` rather than a milestone-gated value. Finer-grained staging (e.g. enabling partial cashOut after M1/M2 milestone releases) depends on the **MilestoneEscrow** contract, which is a later milestone. Keeping M2 free of that dependency keeps it small and independently reviewable.

## Wiring (no MissionCreator change required)

Because the hook resolves the DePrize via `registry.deprizeIdByJBProject(projectId)`, attaching a DePrize to an existing mission is two calls made by **two different owners** (these are distinct trust domains, not a single account):

1. **Registry admin** (`DePrizeRegistry` owner) calls `DePrizeRegistry.register(jbProjectId, teamIds, sunset)` — binds the project to a DePrize. `register` is `onlyOwner` on the registry.
2. **Hook owner** (the mission `to` account set in `MissionCreator.createMission`) calls `hook.setDePrizeRegistry(registryAddress)` — points the mission's hook at the registry. `setDePrizeRegistry` is `onlyOwner` on the hook, and is write-once (see above).

No constructor/immutable changes, so the same deployment flow `MissionCreator` already uses still applies.

## Tests

`forge test --match-path 'test/deprize/LaunchPadPayHookDePrize.t.sol'` — **12 passing**, using lightweight mock `IJBTerminalStore` / `IJBRulesets` stand-ins so the gating logic is deterministic and needs no RPC fork:

- setter access control + write-once latch (detach/repoint and zero-address both revert)
- backwards compatibility: no registry, and registry-set-but-project-unregistered, both fall through to original pay/cashOut behavior
- active DePrize: contributions allowed past the immutable deadline, cashOut reverts, `stage() == 1` — across `LOCKED / VOTING / SETTLED / M1_RELEASED / M2_COMPLETE` and `DRAFT`
- refundable terminals (`CANCELLED / NO_WINNER / M2_FAILED`): cashOut enabled with correct supply math, contributions closed, `stage() == 3`
- `fundingTurnedOff` overrides the DePrize path

> Original (non-DePrize) pay/cashOut behavior continues to be exercised end-to-end against the live JB V5 stack by `MissionTest.t.sol` on a Sepolia fork.
>
> Note: run with `--skip 'test/ManualRefundTest.t.sol' --skip 'test/OwnerOnlyPayoutsRulesetTest.t.sol'` until the test-cleanup PR (#1323) merges; those two pre-existing files block whole-suite compilation.

## Next milestone (M3)

The betting/mint contract: split an incoming bet into the 5% JB prize slice and the 95% CTF collateral, route outcome tokens to the bettor, and pause on `registry.bettingOpen(deprizeId) == false`.
