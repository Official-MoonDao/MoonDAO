# DePrize — Milestone 4: Resolution, Redemption & Refund

**Status:** Implemented, unit-tested (+ guarded fork tests)
**Scope:** Close the money-out loop. **M4a** = resolution (`reportPayouts`) + winner redemption. **M4b** = refund/unwind on the refundable terminals (`CANCELLED` / `NO_WINNER` / `M2_FAILED`) including the LMSR market unwind. This is the **mainnet launch gate**: the market must not custody mainnet ETH until both exist.
**Depends on:** M1 (`DePrizeRegistry`), M3 (`DePrizeMint` + provisioned CTF/LMSR market). M2 (`LaunchPadPayHook`) provides the JB-side refund gating consumed here.
**Files:**

- `subscription-contracts/src/deprize/DePrizeRedeem.sol` (new — bettor redemption helper, used by **both** the winner and refund paths)
- `subscription-contracts/src/deprize/interfaces/IConditionalTokens.sol` (extended — M4 resolution/redemption + id-helper surface)
- `subscription-contracts/src/deprize/interfaces/ILMSRWithTWAP.sol` (extended — owner/unwind surface: `pause`/`close`/`withdrawFees`/`transferOwnership`)
- `subscription-contracts/test/deprize/DePrizeRedeem.t.sol` (new — 30 unit + 3 guarded fork tests)
- `subscription-contracts/script/deprize/DePrizeResolve.s.sol` (new — resolution pre-flight checks + Safe calldata builder)
- `subscription-contracts/script/deprize/DePrizeRedeem.s.sol` (new — deploy script, no proxy)
- `prediction/migrations/08_create_deprize_market.js` (changed — transfers LMSR ownership to the oracle multisig at provisioning; prints a reminder to record the `questionId`)

See the full design in [`DEPRIZE.md`](./DEPRIZE.md).

---

## Locked decisions

- **Oracle = the MoonDAO multisig.** ✅ Decided. The CTF derives `conditionId` from `keccak256(oracle, questionId, outcomeSlotCount)` where `oracle = msg.sender` of `reportPayouts` — so the multisig itself must submit `reportPayouts` as a direct Safe transaction. This is consistent with the M3 provisioning (`prepareCondition(DEPRIZE_ORACLE, …)`) and is irreversible per condition.
- **Consequence: there is no `DePrizeReporter` contract.** The design doc's reporter-as-oracle cannot work here (a contract calling `reportPayouts` would resolve a *different* conditionId). The reporter's job collapses into **off-chain tooling**: `DePrizeResolve.s.sol` performs registry-consistency pre-flight checks and emits the exact Safe calldata; the Safe runbook below is the process. Trust surface = the multisig, same entity that already owns the registry.
- **Winner redemption and refund redemption are the same code path.** A no-winner/cancellation resolution is just an equal-payout report (`[1,1,…,1]`), after which `CTF.redeemPositions` pays every outcome token 1/N. One `DePrizeRedeem` helper serves both.
- **`reportPayouts` is one-shot and immutable** (`payoutDenominator` write-once). In particular: once a winner is reported at `SETTLED`, a later `M2_FAILED` **cannot** change the CTF payout vector — see §M2_FAILED below.
- **`DePrizeRedeem` is a thin, stateless, non-custodial convenience.** Redemption is already permissionless on the CTF (bettors hold the ERC-1155 directly since M3); the helper only improves UX (one call, ETH instead of WETH). It is deliberately **not** UUPS — no state worth upgrading, smaller trust surface. Bettors can always bypass it and call the CTF directly.
- **No "None flies by X date" outcome slot.** Considered and rejected: (a) it funds a participant class whose payday is the mission failing while paying 5% into the prize pool they're shorting; (b) honest resolution of a delivery-worded question must wait for the flight/deadline, locking *all* bettor capital ~18 months past settlement; (c) it converts the disclosed ~80–95% partial refund into a 100% loss for team bettors on no-winner; (d) it touches the audited M3 router (slot count, index mapping) and irreversibly changes the conditionId; (e) the multisig (oracle + registry owner) would control an outcome people hold positions on. The market's question is **"which provider is selected"**, resolved at `SETTLED`; delivery risk lives with the winning provider via the M5 milestone escrow. If failure-hedging demand materializes, add a *separate* parallel market later — it composes without touching anything M4 ships.

---

## M4a — Resolution & winner redemption

### Resolution (multisig Safe transaction)

```
registry.settleWinner(id, teamId)          (Safe tx — already exists, M1)
        │
        ▼
forge script DePrizeResolve.s.sol          (off-chain pre-flight, read-only)
  1. registry.state(id) ∈ {SETTLED, M1_RELEASED, M2_COMPLETE} → winner vector
                        ∈ {NO_WINNER, CANCELLED}             → [1,1,…,1]
                        == M2_FAILED                         → REFUSED (see M4b)
                        else                                 ── abort (WrongState)
  2. winnerIndex = indexOf(registry.winningTeamId(id),
                           registry.teamIds(id))         ── else abort
  3. recompute conditionId = keccak256(oracle, questionId, N)
     and require == registry.getDePrize(id).ctfConditionId   ── else abort
     (catches wrong questionId / wrong oracle / wrong N)
  4. require ctf.payoutDenominator(conditionId) == 0     ── not already reported
  5. print Safe calldata:
       ctf.reportPayouts(questionId, payouts)
       payouts[i] = (i == winnerIndex) ? 1 : 0
        │
        ▼
Safe executes reportPayouts                 (THE irreversible step)
        │
        ▼
bettors redeem (permissionless, forever — no claim deadline on the CTF)
```

Notes:

- The registry stores `ctfConditionId` but **not** `questionId`; the script takes `questionId` as input (from `prediction/deprize.config.js` provisioning records) and step 3 makes a wrong value impossible to submit.
- **Ordering invariant:** the LMSR market must be **paused or closed before reporting** (see M4b §Market unwind). A live market with a publicly-known outcome is free money against the treasury's inventory.
- Outcome-slot convention is unchanged from M3: slot `i` = `registry.teamIds(id)[i]`.

### `DePrizeRedeem` shape

```solidity
contract DePrizeRedeem is ReentrancyGuard, IERC1155Receiver {
    IDePrizeRegistry  public immutable registry;
    IConditionalTokens public immutable ctf;
    IWETH             public immutable weth;

    constructor(address registry_, address ctf_, address weth_); // ZeroAddress-guarded

    /// Redeem all of msg.sender's outcome tokens for this DePrize and pay out ETH.
    function redeem(uint256 deprizeId) external nonReentrant;

    /// View: ETH `account` would receive right now (0 if unresolved). For the UI.
    function previewRedeem(uint256 deprizeId, address account)
        external view returns (uint256);
}
```

`redeem` flow (requires the bettor's one-time `ctf.setApprovalForAll(redeem, true)`):

```
1. dp = registry.getDePrize(deprizeId)                     ── UnknownDePrize if NONE
2. require ctf.payoutDenominator(dp.ctfConditionId) > 0    ── NotResolved
3. N = dp.teamIds.length
   positionId(i) = ctf.getPositionId(weth,
       ctf.getCollectionId(0x0, conditionId, 1 << i))
4. balances = ctf.balanceOfBatch(msg.sender × N, positionIds)
   keep nonzero slots                                      ── NothingToRedeem if none
5. pull held tokens (safeBatchTransferFrom → this, gated by _inRedeem)
6. ctf.redeemPositions(weth, 0x0, conditionId, heldIndexSets) ── burns, pays WETH
   payout = WETH balance DELTA across the redeem call
7. weth.withdraw(payout); send ETH → msg.sender            ── RedeemFailed on send fail
8. emit Redeemed(deprizeId, msg.sender, payout)
```

- **No registry-state gate.** The CTF's `payoutDenominator` is the source of truth; adding a lifecycle gate here would only desync the helper from what bettors can already do directly on the CTF.
- **Payout = the redemption's WETH balance delta**, not the absolute balance — the same lesson as the M3 residual-sweep fix: WETH parked in the helper can never leak into a caller's payout (regression-tested).
- ERC-1155 receiver gated exactly like M3 `DePrizeMint`: only accepts transfers mid-`redeem` (`_inRedeem` flag) from the CTF; unsolicited deposits revert.
- Holds no funds between calls (asserted in tests, same as M3). A redeemer holding only losing tokens gets them burned and is paid 0 (event emitted with `payout = 0`).
- `previewRedeem` mirrors the CTF's integer math exactly (floor division **per position**), so the UI quote always equals the actual payout.
- Works identically for winner payouts (`[0,…,1,…,0]`) and equal-payout refunds (`[1,1,…,1]`).

### Interface additions

`IConditionalTokens` (resolution/redemption + id helpers, mirroring the 0.5 source):

```solidity
function prepareCondition(address oracle, bytes32 questionId, uint256 outcomeSlotCount) external;
function reportPayouts(bytes32 questionId, uint256[] calldata payouts) external;
function splitPosition(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] calldata partition, uint256 amount) external;
function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] calldata indexSets) external;
function payoutDenominator(bytes32 conditionId) external view returns (uint256);
function payoutNumerators(bytes32 conditionId, uint256 index) external view returns (uint256);
function getOutcomeSlotCount(bytes32 conditionId) external view returns (uint256);
function getConditionId(address oracle, bytes32 questionId, uint256 outcomeSlotCount) external pure returns (bytes32);
function getCollectionId(bytes32 parentCollectionId, bytes32 conditionId, uint256 indexSet) external view returns (bytes32);
function getPositionId(address collateralToken, bytes32 collectionId) external pure returns (uint256);
```

`ILMSRWithTWAP` (the owner/unwind surface the Safe runbook uses): `owner()`, `transferOwnership(address)`, `pause()`, `resume()`, `close()`, `withdrawFees()`.

---

## M4b — Refund & market unwind

### Refundable terminals → equal-payout report

| Terminal | CTF action | Bettor recovery (CTF side) | JB side (`$OVERVIEW`) |
|---|---|---|---|
| `NO_WINNER` | Safe reports `[1,1,…,1]` (each token pays 1/N) | `DePrizeRedeem.redeem()` — same contract as the win path | M2 hook re-enables cashOut (refund terminal) |
| `CANCELLED` | Safe reports `[1,1,…,1]` | same | same |
| `M2_FAILED` | **none — already resolved.** The winner was reported at `SETTLED`; `payoutDenominator` is write-once. | Winning bettors already could/can redeem at full value; losing tokens stay worthless. Nothing changes on the CTF. | M2 hook re-enables cashOut — this is the *only* new refund surface at `M2_FAILED` |

- `DePrizeResolve.s.sol` covers the equal-payout case too: if `registry.state(id) ∈ {NO_WINNER, CANCELLED}` it emits `payouts = [1,1,…,1]`; it **refuses** to emit anything for `M2_FAILED` (already-reported guard, step 4, catches this anyway).
- The equal-payout report is what produces the **disclosed parimutuel cancellation loss**: a bettor who bought at an implied probability above 1/N recovers less than they paid (the doc's ~80–95% for concentrated positions); one who bought below 1/N recovers more. This is by design and shown on every bet preview — do not "fix" it (see §Double-count guard).

### Market unwind (treasury seed recovery)

Confirmed against the deployed Gnosis `MarketMaker` source:

- `pause()` / `close()` / `withdrawFees()` are **`onlyOwner`**.
- `close()` transfers the LMSR's remaining ERC-1155 inventory to the owner and sets `stage = Closed` (allowed from `Running` or `Paused`).
- `withdrawFees()` transfers the LMSR's **entire WETH balance** (accrued 1% fees + net trade collateral) to the owner.
- **⚠️ The factory makes `msg.sender` of `createLMSRWithTWAP` the owner** — the Truffle migration deployer EOA, *not* the multisig. Two fixes:
  1. ✅ Done: `08_create_deprize_market.js` now calls `lmsr.transferOwnership(oracle)` right after creation (future markets).
  2. Runbook step for any already-provisioned market: deployer EOA calls `transferOwnership(multisig)` before mainnet bets open. Verify the Safe's fallback handler accepts ERC-1155 (`onERC1155Received`) — `close()` pushes 1155 inventory to the owner.

Unwind sequence (Safe txs, applies to win, no-winner, and cancellation alike):

```
at registry.lock() / cancel():   lmsr.pause()        ── freeze odds; stops DIRECT LMSR
                                                        trading too (DePrizeMint's
                                                        bettingOpen gate only stops the
                                                        router, the LMSR is public)
after winner/no-winner decided:  lmsr.close()        ── inventory (ERC-1155) → multisig
                                 ctf.reportPayouts() ── ONLY after pause/close
                                 lmsr.withdrawFees() ── all WETH → multisig
                                 ctf.redeemPositions(weth, 0x0, conditionId, all slots)
                                                     ── multisig redeems the recovered
                                                        inventory for WETH
                                 weth.withdraw()     ── optional, WETH → ETH
```

Treasury recovers: `funding seed − bounded LMSR loss + accrued fees`. Nothing is stranded.

### Double-count guard (policy, enforced by the runbook)

A refunded bettor is made whole from **two separate pools they already own claims on**: (1) CTF collateral via the 1/N redemption (their 95% slice, minus parimutuel skew), and (2) their own `$OVERVIEW` pro-rata cashOut once the M2 hook re-enables it (their 5% slice). The guard:

- **Unwound market proceeds (seed + fees) go to the treasury, NOT into the JB project.** Topping up the JB pot post-cancellation would raise the `$OVERVIEW` floor and silently push bettor recovery toward 100%, contradicting the disclosed cancellation loss and draining the treasury's 5%-slice prize funding.
- The M2 hook needs no change: refund terminals already enable cashOut with no expiry window and block new contributions.

### Out of scope (unchanged)

- `DePrizeMilestoneEscrow` (provider's 30/70 disbursement, incl. `refundToJB` on no-winner) stays **M5** — different pool, orthogonal to bettor payouts.
- A combined one-click `refundAll` (CTF redemption + JB cashOut in one tx) from the design doc is **dropped for M4**: the JB cashOut leg needs `$OVERVIEW` token approvals + terminal permissions and duplicates a flow Juicebox already ships. Two clicks (redeem + cashOut), one contract less. Revisit as UI polish.

---

## State → action matrix

| Registry state | CTF report (Safe) | LMSR (Safe, as owner) | Bettor | JB hook (M2, existing) |
|---|---|---|---|---|
| `OPEN` | — | running | bet via `DePrizeMint` | contributions open, cashOut blocked |
| `LOCKED` / `VOTING` | — | **`pause()`** | hold | contributions open, cashOut blocked |
| `SETTLED` / `M1_RELEASED` | `[0,…,1,…,0]` (after pause/close) | `close()` + `withdrawFees()` + redeem inventory | `DePrizeRedeem.redeem()` — winners paid in full, not milestone-gated | cashOut blocked |
| `NO_WINNER` / `CANCELLED` | `[1,1,…,1]` (after pause/close) | same | `redeem()` — 1/N per token | cashOut **enabled**, contributions blocked |
| `M2_FAILED` | — (already reported) | already unwound | nothing new | cashOut **enabled** |
| `M2_COMPLETE` | — (already reported) | already unwound | already redeemed | both blocked |

---

## Tests

`forge test --match-path 'test/deprize/DePrizeRedeem.t.sol'` — **30 unit tests passing** (+3 guarded fork tests; the whole deprize suite is 121 passing).

**`DePrizeRedeemTest` (30, deterministic, no RPC)** — real `DePrizeRegistry` + `MockResolvingCTF`, a resolution-capable CTF mock faithful to the deployed 0.5 source (conditionId derived from `msg.sender` in `reportPayouts`, write-once denominator, per-position floor division, burn-on-redeem, ERC-1155 approval checks + acceptance hooks):

- winner path: report `[0,1,0]` → winner redeems full value in ETH, tokens burned, helper holds no ETH/WETH/1155 after; loser-only holder gets tokens burned and `payout = 0`;
- refund path: report `[1,1,1]` → `floor(balance/N)` per the CTF math; parimutuel skew reproduced (per-token payout, not per-ETH-spent);
- `previewRedeem`: equals the actual payout exactly including rounding (amounts not divisible by N across multiple slots); 0 before resolution;
- guards: `NotResolved`, `UnknownDePrize`, `NothingToRedeem` (zero balance and double-redeem), missing `setApprovalForAll`, `RedeemFailed` (non-payable receiver), reentrancy from the ETH payout callback blocked, constructor zero-address checks;
- stray-WETH regression: WETH parked in the helper is never swept into a payout (delta scoping);
- ERC-1155 receiver guard: unsolicited single/batch and non-CTF senders revert; `supportsInterface`;
- mock-CTF fidelity: `reportPayouts` write-once, all-zero vector reverts, a non-oracle sender resolves a *different* conditionId (the DePrize condition stays unresolved);
- `DePrizeResolve.buildReport` pre-flight: winner vector (and the emitted calldata actually resolves the condition when submitted by the oracle), equal vector on `NO_WINNER` and `CANCELLED`, `WrongState` on `OPEN`, `M2FailedCtfAlreadyFinal` refusal, `ConditionMismatch` on wrong questionId and wrong oracle, `AlreadyReported`.

**`DePrizeM4ForkTest` (3, guarded)** — runs against the **real Arbitrum-Sepolia CTF** (the contract whose payout math decides mainnet payouts), preparing a fresh condition with a test oracle so resolution can be exercised without touching the shared live market. Skips unless `DEPRIZE_FORK_RPC` is set:

- `testForkWinnerResolveRedeem` — split real collateral into outcome sets, settle + report winner, winner redeems full value in ETH / loser redeems 0, against the live CTF;
- `testForkCancellationEqualPayoutRedeem` — 7-day-notice cancel, `[1,1,1]` report, 1/N redemption with the real floor division (preview matches);
- `testForkFullCloseOutLoop` (additionally needs `DEPRIZE_FORK_FACTORY`) — the full mainnet rehearsal: factory market provisioning + `transferOwnership(oracle)` → two real `DePrizeMint` bets → `lock` → `pause` → `settleWinner` → `close` → `reportPayouts` → `withdrawFees` → treasury redeems inventory → bettors redeem — with **ETH conservation asserted to the wei**: `bets + funding = JB slices + bettor payouts + treasury recovery + collateral locked behind unredeemed worthless positions`.

```
DEPRIZE_FORK_RPC=<arb-sepolia rpc> [DEPRIZE_FORK_FACTORY=0x<factory>] \
  forge test --match-contract DePrizeM4ForkTest -vvv
```

---

## Mainnet close-out runbook (delta to the M3 provisioning runbook)

1. **Provisioning (amended, automated in migration 08):** the migration now transfers LMSR ownership to the oracle multisig after creation and reminds the operator to record the `questionId` alongside the `conditionId` (resolution needs it; it is not stored on-chain). For any market provisioned before this change: deployer EOA calls `transferOwnership(multisig)` before mainnet bets open. Verify the Safe's fallback handler accepts ERC-1155.
2. **Deploy `DePrizeRedeem`** (`script/deprize/DePrizeRedeem.s.sol`, no proxy) — ship it with the betting UI so the claim surface exists before any money goes in.
3. **At lock/cancellation-notice:** Safe → `lmsr.pause()`.
4. **At settle (winner or no-winner):** run `DePrizeResolve.s.sol` → review the printed payout vector against the registry event → Safe → `lmsr.close()`, then `ctf.reportPayouts(...)` (the printed calldata), then `lmsr.withdrawFees()`, then `ctf.redeemPositions(...)` (inventory). Proceeds → treasury.
5. **Announce:** bettors claim via `DePrizeRedeem.redeem(deprizeId)` after a one-time `ctf.setApprovalForAll` (no deadline); on refund terminals, `$OVERVIEW` cashOut is live via the existing JB UI.

---

## Remaining policy decisions (runbook-level, no contract impact)

1. **Where do unwound proceeds land** — treasury (recommended, see §Double-count guard) vs. JB prize pool.
2. **`pause()` timing** — at `lock()` (recommended; freezes odds during the vote) vs. only pre-report (leaves the public LMSR tradable during `VOTING`).
