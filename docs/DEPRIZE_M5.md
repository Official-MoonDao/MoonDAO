# DePrize — Milestone 5: Provider Prize Disbursement (30/70)

**Status:** Implemented, unit-tested
**Scope:** Close the **provider** money-out loop — the 30%/70% milestone release of the prize pool to the winning provider, and the return of the undistributed remainder to Juicebox if the mission fails post-M1. This is orthogonal to the **bettor** payouts M4 closed: bettors are paid in full at settlement (CTF redemption); the provider's prize is what's split across milestones.
**Depends on:** M1 (`DePrizeRegistry` lifecycle + the `releaseM1`/`completeM2`/`failM2` transitions), M2 (`LaunchPadPayHook` cashOut gating). Independent of M4's redemption code.
**Files:**

- `subscription-contracts/src/deprize/IDePrizeRegistry.sol` (extended — `setProviderPayoutAddress` / `providerPayoutAddress` + event/error)
- `subscription-contracts/src/deprize/DePrizeRegistry.sol` (extended — `_providerPayoutAddress` mapping in a reserved gap slot, setter, view)
- `subscription-contracts/script/deprize/DePrizeDisburse.s.sol` (new — milestone disbursement pre-flight + Safe calldata builder)
- `subscription-contracts/script/deprize/DePrizeRegistryUpgrade.s.sol` (new — UUPS upgrade for the live registry proxy)
- `subscription-contracts/test/deprize/DePrizeRegistry.t.sol` (extended — 10 provider-address tests)
- `subscription-contracts/test/deprize/DePrizeDisburse.t.sol` (new — 13 disbursement-builder tests)

See the full design in [`DEPRIZE.md`](./DEPRIZE.md) §Settlement.

---

## The blocker that shaped this milestone

The original design (`DEPRIZE.md`) envisioned a `DePrizeMilestoneEscrow` contract that *holds* the prize pool and releases 30%/70%. An investigation of the live Juicebox V5 mission config (`MissionCreator.sol`) showed this is **not achievable** as drawn:

- The mission's three ETH **payout splits are permanently locked** (`lockedUntil: type(uint48).max`) and already consume `999_999_999 / 1_000_000_000` of the allocation: ~2.5% → MoonDAO treasury, ~5% → poolDeployer, **~90% → the project-owner Safe (`to`)**.
- JB enforces that locked splits carry forward into every future ruleset, so an escrow **can never be added as a payout-split beneficiary**, and the existing ones can't be modified. `sendPayoutsOf` will only ever pay those three.

What *is* available:

| Mechanism | Available? | Notes |
|---|---|---|
| `sendPayoutsOf` → escrow | ❌ | locked splits, no room |
| `useAllowanceOf` → arbitrary beneficiary | ⚠️ | works, but needs the owner Safe to grant `USE_ALLOWANCE` and only in the funding ruleset (the payout ruleset has 0 surplus allowance) |
| `addToBalanceOf` (return ETH to JB) | ✅ | **permissionless**, mints no tokens — perfect for the refund leg |
| plain transfer from the owner Safe | ✅ | no JB coupling |

Since the prize ETH lands in the **project-owner Safe** anyway (the locked ~90% split), the clean path is: the admin Safe extracts the prize via the mechanism it already controls, then pays the provider directly. The same Safe is already the registry owner, the CTF oracle (M4), and the project owner — so wrapping the prize in a contract the same Safe funds and controls would add audit surface without reducing trust.

## Locked decisions

- **No escrow contract.** M5 is a **Safe-operated runbook + tooling**, mirroring M4's `DePrizeResolve.s.sol` resolution flow. The 30/70 milestone ordering is enforced off-chain by the script's state-machine checks and the registry's `releaseM1`/`completeM2`/`failM2` guards, not by custody in a new contract. (Decision: build no escrow given the prize already sits in the trust-anchor Safe.)
- **Provider payout address lives on-chain in the registry.** `setProviderPayoutAddress(deprizeId, provider)` — `onlyOwner`, settable in `SETTLED` or `M1_RELEASED` (winner declared, prize not yet fully resolved), updatable between milestones (provider can rotate Safes). Auditable target for the disbursement.
- **M2_FAILED remainder returns to Juicebox**, not the treasury. The Safe calls `addToBalanceOf` (permissionless, no minting) to push the undistributed 70% back into the mission project, raising the `$OVERVIEW` cashOut floor for refundable bettors. (Decision: `refundToJB`. Note this differs from the `DEPRIZE.md` §Settlement prose that once said "treasury" — M5 resolves the contradiction in favour of JB.)
- **Prize-pool figure is an operator-recorded snapshot.** The 30/70 split is computed against `DEPRIZE_PRIZE_WEI` (the agreed prize-pool amount at M1), not read live from JB — the live balance drifts with late contributions and the JB fee on extraction. The script computes `m1 = floor(prize * 30/100)` and `remainder = prize − m1`, so M1 + M2 sum to the snapshot exactly.

---

## Money path

```
prize pool = the mission's Juicebox project balance (5% bet slices + direct contributions)
        │
        │  admin Safe extracts it via the existing locked ~90% owner payout
        │  (sendPayoutsOf in the payout ruleset) — the Safe IS the 90% beneficiary
        ▼
admin Safe (holds the prize ETH)
        │
   ┌────┴───────────────── M1 (SETTLED → M1_RELEASED) ──────────────┐
   │  registry.releaseM1(id)        (state)                          │
   │  Safe → provider Safe: 30%      (plain ETH transfer)            │
   └────────────────────────────────────────────────────────────────┘
        │
   ┌────┴──────────── M2 success (M1_RELEASED → M2_COMPLETE) ────────┐
   │  registry.completeM2(id)       (state)                          │
   │  Safe → provider Safe: 70%      (plain ETH transfer)            │
   └────────────────────────────────────────────────────────────────┘
        │
   ┌────┴──────────── M2 failure (M1_RELEASED → M2_FAILED) ──────────┐
   │  Safe → JB: addToBalanceOf(70%) (raises $OVERVIEW floor)        │
   │  registry.failM2(id)           (state; JB cashOut now enabled)  │
   └────────────────────────────────────────────────────────────────┘
```

`DePrizeDisburse.s.sol` is read-only: it validates the registry state and the recorded provider address, then prints the exact ordered Safe transactions (state-advance tx, then the payout/refund tx). It never broadcasts.

## State → action matrix (provider side)

| Registry state | `setProviderPayoutAddress` | Disbursement (Safe) | Registry advance |
|---|---|---|---|
| `SETTLED` | ✅ (set/update) | M1: pay provider 30% | `releaseM1` |
| `M1_RELEASED` | ✅ (rotate before M2) | M2 win: pay provider 70% **or** M2 fail: `addToBalanceOf` 70% → JB | `completeM2` / `failM2` |
| `M2_COMPLETE` | ❌ (`InvalidState`) | — (fully paid) | terminal |
| `M2_FAILED` | ❌ | — (refunded to JB) | terminal |
| `OPEN`/`LOCKED`/`VOTING`/`NONE` | ❌ (`InvalidState`/`UnknownDePrize`) | — | — |

This dovetails with M2's `LaunchPadPayHook`: `M1_RELEASED` keeps `$OVERVIEW` cashOut disabled (no double-dip while the provider is being paid); `M2_FAILED` flips to a refund terminal so cashOut opens, and the `addToBalanceOf` top-up makes that refund whole.

---

## `DePrizeDisburse.s.sol`

```
DEPRIZE_REGISTRY=0x<registryProxy> DEPRIZE_ID=<id> \
DEPRIZE_MILESTONE=<M1|M2|REFUND> DEPRIZE_PRIZE_WEI=<wei> \
forge script script/deprize/DePrizeDisburse.s.sol --rpc-url $RPC
```

`buildDisbursement(registry, jbTerminal, id, milestone, prizeWei)` (pure pre-flight) aborts on:

- `ZeroPrize` — empty snapshot;
- `UnknownDePrize` — unregistered id (from the registry view);
- `WrongState` — `M1` not at `SETTLED`, or `M2`/`REFUND` not at `M1_RELEASED`;
- `ProviderNotSet` — no recorded payout address (`M1`/`M2` only; `REFUND` returns to JB and needs none);
- `UnknownMilestone` — tag is not `M1`/`M2`/`REFUND`.

It returns the registry state-advance calldata plus either a plain-ETH provider transfer (`M1`/`M2`) or the `addToBalanceOf(projectId, NATIVE_TOKEN, remainder, false, …)` calldata (`REFUND`).

## Registry change (UUPS upgrade)

`providerPayoutAddress` is a **standalone mapping** placed in a previously-reserved gap slot (`__gap` 46 → 45), not a `DePrize` struct field — so `getDePrize`'s return ABI is unchanged for existing consumers (the UI, `DePrizeMint`, `DePrizeResolve`) and the storage layout stays append-only / upgrade-safe. Ship it to the live proxy with `DePrizeRegistryUpgrade.s.sol`, which deploys the new implementation and (on mainnet) prints the `upgradeToAndCall` calldata for the owner Safe.

## Mainnet runbook (delta to M4)

1. **Pre-settle:** after `registry.settleWinner(id, teamId)`, the Safe calls `registry.setProviderPayoutAddress(id, providerSafe)`.
2. **Extract the prize:** the Safe extracts the prize pool from the mission JB project via the existing locked owner payout (it is the ~90% beneficiary). Record the figure as the prize-pool snapshot.
3. **M1:** run `DePrizeDisburse.s.sol` with `DEPRIZE_MILESTONE=M1` → submit Tx 1 (`releaseM1`) then Tx 2 (30% → provider).
4. **M2 (delivered):** run with `DEPRIZE_MILESTONE=M2` (same `DEPRIZE_PRIZE_WEI`) → submit `completeM2` then 70% → provider.
5. **M2 (failed / 18-month deadline):** run with `DEPRIZE_MILESTONE=REFUND` → submit `addToBalanceOf` of the 70% back into the JB project first, then `failM2` to enable refunds. `$OVERVIEW` cashOut is now live via the existing JB UI.

---

## Tests

`forge test --match-contract 'DePrizeRegistryTest|DePrizeDisburseTest'` — **51 registry + 13 disbursement tests passing** (whole deprize suite: 150 passing).

- **Registry (`setProviderPayoutAddress`):** set at `SETTLED` and `M1_RELEASED`, update between milestones, zero-address revert, wrong-state reverts (pre-settle `OPEN`, post `M2_COMPLETE`), `onlyOwner`, `UnknownDePrize`, default-zero view.
- **`DePrizeDisburse.buildDisbursement`:** M1 = 30% → provider + `releaseM1`; M2 = 70% → provider + `completeM2`; REFUND = 70% → JB `addToBalanceOf` + `failM2`; exact split on an indivisible prize (M1 + M2 == snapshot); guards (`WrongState` per milestone, `ProviderNotSet`, `ZeroPrize`, `UnknownMilestone`, `UnknownDePrize`); tag constants match.

---

## Out of scope / remaining policy decisions

- **JB-hook M2-stage gating** (a `stage() == 2` tied to disbursement) stays deferred — the hook returns `1` for `SETTLED`/`M1_RELEASED`/`M2_COMPLETE`, which is correct for cashOut purposes today.
- **M2 deadline + 6-month extension** (18 months after M1) is a runbook/Senate process, not on-chain.
- **Senate M2 "did it deliver?" vote** is the off-chain trigger for `completeM2` vs `failM2`, same governance surface as the M4 winner vote.
- **Automating extraction for *future* missions** (making the escrow/registry the payout beneficiary at `MissionCreator` time) is a larger, launchpad-wide change and a candidate for a later milestone.
