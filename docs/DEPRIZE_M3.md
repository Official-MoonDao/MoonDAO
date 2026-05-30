# DePrize — Milestone 3: `DePrizeMilestoneEscrow`

**Status:** Implemented, unit-tested
**Scope:** Custody the prize pool after settlement and release it to the winning provider in two milestones (30% at M1, 70% at M2), gated entirely by the `DePrizeRegistry` lifecycle. Handles the failure/refund terminals too.
**Depends on:** Milestone 1 (`DePrizeRegistry`). Complements the M2 launchpad-hook work (the hooks keep the JB-side pot locked during a prize; this contract is *where the prize goes* once it resolves).
**Files:**

- `subscription-contracts/src/deprize/DePrizeMilestoneEscrow.sol`
- `subscription-contracts/test/deprize/DePrizeMilestoneEscrow.t.sol`

See the full design in [`DEPRIZE.md`](./DEPRIZE.md) §Settlement.

---

## Why

The M2 hooks make a prize mission's JB pot stay locked until the registry reaches a terminal, and unlock the payout ruleset on success. But the standard launchpad payout splits send funds to the *team* (90%) — wrong for a prize, where the pool belongs to the **winning provider** and must be released in step with **actual delivery**, not just capability. `DePrizeMilestoneEscrow` is the destination for a prize's pool:

- **M1 (capability demonstrated):** 30% released, so a winning provider has liquid funds for prep (insurance, training, hardware, filings).
- **M2 (mission delivered):** the remaining 70% — the carrot that's contingent on actually flying.

This addresses the "provider walks away after winning" gap.

## Lifecycle (gated by the registry)

| Escrow call | Registry state required | Effect |
|---|---|---|
| `releaseM1` | `M1_RELEASED` | pay 30% of deposited to the provider recipient |
| `releaseM2` | `M2_COMPLETE` | pay the remaining balance to the provider recipient (finalize) |
| `returnToTreasury` | `M2_FAILED` | send the un-released remainder to the MoonDAO treasury for `$OVERVIEW`-governed re-allocation (the 30% paid at M1 is not clawed back) |
| `refundToJB` | `CANCELLED` or `NO_WINNER` | return the balance to the JB project via `addToBalanceOf`, raising `$OVERVIEW` cashOut value |

- Releases are **permissionless** (keeper-friendly): gated by registry state + the admin-set recipient, so anyone can trigger once the state is right, but the destination is never attacker-controlled.
- `setProviderRecipient` is owner-only, requires a declared winner (`registry.winningTeamId != 0`), and is locked once M1 has released — a release can never be redirected after the fact.
- Per-DePrize accounting (`deposited` / `released` / `finalized`) lets one escrow serve many DePrizes. `deposited - released = pendingBalance`.
- UUPS-upgradeable + `ReentrancyGuard`, matching `DePrizeRegistry`. Checks-effects-interactions on every payout.

## Funding boundary (integration point)

This contract releases percentages of its **own per-DePrize ETH balance**. It is deliberately agnostic about *where* the ETH came from, which keeps it independently reviewable and testable. The settlement process funds it via `deposit(deprizeId)` before `releaseM1`:

- the JB project's prize pool (routed out of the project as a payout/surplus to the escrow), plus
- swap-fee accrual from the future `DePrizePrizeEscrow`.

Wiring a prize mission's **ruleset-1 payout to this escrow** (instead of the team's 90% split) is the remaining integration step and is intentionally **not** included here — it needs JB split/permission design and should land with the betting/mint + PrizeEscrow milestone. Until then the escrow works standalone with explicit `deposit()` calls, and the M2 hooks keep the JB pot locked so nothing leaks in the meantime.

`receive()` reverts: every wei must be attributed to a DePrize via `deposit(deprizeId)`.

## Tests

`forge test --match-path 'test/deprize/DePrizeMilestoneEscrow.t.sol'` — **23 passing**, using the real `DePrizeRegistry` (proxy) + a mock JB terminal:

- init / re-init guard / owner-only setters
- deposit credits per-DePrize balance; unknown / zero / post-finalized deposits revert; `receive()` reverts
- `setProviderRecipient` requires a declared winner, owner-only, locked after M1
- `releaseM1` pays exactly 30%; reverts on wrong state, missing recipient, or double release
- `releaseM2` pays the remainder after M1, or the full balance if M1 was skipped; finalize guard
- `returnToTreasury` sends the remainder on `M2_FAILED` (M1's 30% not clawed back)
- `refundToJB` calls `addToBalanceOf` with the full balance on `CANCELLED` / `NO_WINNER`; wrong-state guard

## Next

- Route a prize mission's ruleset-1 payout into this escrow (JB split/permission wiring).
- `DePrizePrizeEscrow` (swap-fee accrual) forwarding into this escrow at settlement.
- Optional M2 deadline enforcement (18 months + extension) as an on-chain trigger for `returnToTreasury`.
