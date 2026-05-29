# DePrize — Milestone 1: `DePrizeRegistry`

**Status:** Implemented, unit-tested
**Scope:** The on-chain state machine and source of truth for the DePrize (Overview Prize) lifecycle.
**Files:**

- `subscription-contracts/src/deprize/IDePrizeRegistry.sol`
- `subscription-contracts/src/deprize/DePrizeRegistry.sol`
- `subscription-contracts/test/deprize/DePrizeRegistry.t.sol`

This is the foundation milestone. It deliberately has **no external-protocol dependencies** (no Juicebox, CTF, or Uniswap) so it is small, fast to test, and decision-independent. Every later DePrize contract reads its lifecycle state from here.

See the full design in [`DEPRIZE.md`](./DEPRIZE.md).

---

## What this contract does

`DePrizeRegistry` tracks, for each DePrize:

- the Juicebox project whose prize pool it tops up (`jbProjectId`),
- the Gnosis ConditionalTokens condition id for the outcome set (`ctfConditionId`),
- the competing `MoonDAOTeam` token ids (the outcome slots),
- the sunset timestamp,
- the declared winning team (once settled),
- and the **current lifecycle state**.

It exposes the reads every other contract needs — most importantly `state(deprizeId)` and `deprizeIdByJBProject(projectId)`, which the registry-aware `LaunchPadPayHook` (M2) and the betting/settlement contracts (M3–M5) will consume.

## State machine

```
register() ──► DRAFT ──open──► OPEN ──lock──► LOCKED ──startVote──► VOTING
                                                  │                    │
                                                  └─────settleWinner───┤
                                                                       ▼
                                                                    SETTLED
                                                                       │
                                                                   releaseM1
                                                                       ▼
                                                                  M1_RELEASED
                                                                    │      │
                                                           completeM2      failM2
                                                                  ▼          ▼
                                                         M2_COMPLETE    M2_FAILED

settleNoWinner:  LOCKED | VOTING ──► NO_WINNER
cancel:          any non-terminal ──► CANCELLED   (after a 7-day notice window)
```

| State | Meaning | Bets open? | Refundable? | Terminal? |
|---|---|---|---|---|
| `NONE` | Not registered (zero value) | — | — | — |
| `DRAFT` | Registered, being configured | no | no | no |
| `OPEN` | Accepting bets | **yes** | no | no |
| `LOCKED` | Bets closed, awaiting winner | no | no | no |
| `VOTING` | Senate winner vote in progress | no | no | no |
| `SETTLED` | Winner declared, M1 releasable | no | no | no |
| `M1_RELEASED` | 30% milestone released | no | no | no |
| `M2_COMPLETE` | Flight delivered, 70% released | no | no | **yes** (success) |
| `M2_FAILED` | Post-M1 delivery failed | no | **yes** | **yes** |
| `CANCELLED` | Admin-cancelled after notice | no | **yes** | **yes** |
| `NO_WINNER` | No eligible winner / vote failed | no | **yes** | **yes** |

"Refundable" terminals are what the M2 `LaunchPadPayHook` upgrade will use to re-enable Juicebox cashOut. (`bettingOpen` is also false whenever a cancellation is pending — see below.)

## Cancellation: 7-day notice

Matches the policy in the design doc (admin Safe may cancel for any reason, but only after a public notice period):

1. `announceCancellation(id)` — records the notice timestamp and emits `CancellationAnnounced(id, noticeAt, executableAt)`. From this moment `bettingOpen(id)` returns `false`, so the betting contract (M3) pauses new bets immediately.
2. `abortCancellation(id)` — clears a pending notice; betting resumes if the DePrize is still `OPEN`.
3. `cancel(id)` — only succeeds once `block.timestamp >= noticeAt + CANCELLATION_NOTICE` (7 days), transitioning any non-terminal DePrize to `CANCELLED`.

## Access control & upgradeability

- **Owner-gated.** All mutating functions are `onlyOwner`; the owner is the admin Safe. This matches the existing MoonDAO contract pattern (`MissionCreator`, `LaunchPadPayHook` are `Ownable`).
- **UUPS upgradeable** (`Initializable` + `OwnableUpgradeable` + `UUPSUpgradeable`). `initialize(owner)` runs behind an `ERC1967Proxy`; `_authorizeUpgrade` is `onlyOwner`. The timelocked upgrade path from the design doc is deferred to a later milestone (decision: UUPS now, timelock later).

## Key interface surface (for later milestones)

```solidity
function state(uint256 deprizeId) external view returns (DePrizeState);
function deprizeIdByJBProject(uint256 jbProjectId) external view returns (uint256); // 0 = none
function bettingOpen(uint256 deprizeId) external view returns (bool);
function isRefundable(uint256 deprizeId) external view returns (bool);
function winningTeamId(uint256 deprizeId) external view returns (uint256);
function teamIds(uint256 deprizeId) external view returns (uint256[] memory);
function isTeam(uint256 deprizeId, uint256 teamId) external view returns (bool);
```

DePrize ids start at **1**; `deprizeIdByJBProject` returns **0** for projects with no DePrize attached. This is the exact convention the doc's `LaunchPadPayHook.stage()` upgrade relies on (`deprizeId == 0` → original behavior).

## Tests

`forge test --match-path 'test/deprize/DePrizeRegistry.t.sol'` — **39 passing**, covering:

- registration (id assignment, reverse mapping, team storage, all revert paths: zero project, duplicate project, too few teams, duplicate team, past sunset, non-owner)
- configuration (`setCondition` draft-only + overwritable, `setSunset` guards)
- open guards (condition required, sunset must be in the future)
- the full happy path `DRAFT → … → M2_COMPLETE`, plus `settleWinner` directly from `LOCKED`, `settleNoWinner`, and the `M2_FAILED` path
- every invalid transition revert
- cancellation timing (too-early reverts at `T` and `T+7d−1`, success at exactly `T+7d`), abort, cancel-without-notice, cancel from multiple states, and the terminal-state guard
- access control on transitions (non-owner reverts)
- unknown-DePrize view behavior
- UUPS upgrade authorization (owner upgrades + state persists; stranger reverts)

> Note: the repo currently has two unrelated, pre-existing broken test files (`test/ManualRefundTest.t.sol`, `test/OwnerOnlyPayoutsRulesetTest.t.sol`) that reference a stale `MoonDAOTeamCreator.TeamMetadata` shape. They block whole-suite compilation regardless of this change. Run the M1 suite with:
>
> ```
> forge test --match-path 'test/deprize/DePrizeRegistry.t.sol' \
>   --skip 'test/ManualRefundTest.t.sol' --skip 'test/OwnerOnlyPayoutsRulesetTest.t.sol'
> ```

## Next milestone (M2)

Registry-aware `LaunchPadPayHook` v2: read `registry.state(deprizeId)` to gate Juicebox cashOut (disabled during an active campaign, enabled on refund terminals) while staying backwards-compatible for non-DePrize missions. Fork tests against the live JB V5 stack, as `MissionTest.t.sol` does today.
