# DePrize — Arbitrum mainnet launch plan

**Goal:** publish the first DePrize on Arbitrum mainnet (browse → bet → cash out → resolve → redeem), with trade fees growing the prize pool.

**Status of the stack:** contracts M1–M5 + `DePrizeFeeRouter` are built, unit-tested (178 Foundry tests), and fully exercised on Sepolia — see [`DEPRIZE_QA.md`](./DEPRIZE_QA.md). The UI shipped in PR #1482. Nothing DePrize-related is deployed on Arbitrum yet, and `/deprize` renders `DePrizeComingSoon` while the selected chain is `arbitrum`.

This document is the ordered runbook. Phases 2–5 are mainnet transactions with real ETH; each ends with values that must be recorded before the next phase starts.

---

## Two findings that shape the plan

1. **The prediction-market stack does not exist on Arbitrum mainnet.** `WETH_ADDRESSES` / `CONDITIONAL_TOKENS_ADDRESSES` in `fee-hook/script/base/Config.sol` and `ui/const/config.ts` only cover `sepolia` + `arbitrum-sepolia`. Gnosis ConditionalTokens and `LMSRWithTWAPFactory` must be deployed (Phase 2) before any 0.8 DePrize contract can be deployed, because the deploy scripts read those maps by `block.chainid`.

2. **`MissionCreator` is not upgradeable and constructs a `LaunchPadPayHook` per mission** (`new LaunchPadPayHook(...)`). The Arbitrum creator at `0x87e80c0d3a1D484A58f88f6383EF7E6FB333a64F` predates M2, so the hooks it produces have no `setDePrizeRegistry` and cannot gate cashOut on DePrize state. The prize-pool mission therefore needs a **newly deployed MissionCreator** compiled from current source. Sepolia QA did exactly this with a "fresh, not app-wide" creator (`0xa692eEd6…`).

---

## Phase 0 — Decisions required before any transaction

These are product/treasury calls, not engineering. Every later phase is blocked on them.

| # | Decision | Notes |
|---|---|---|
| 0.1 | **Which Juicebox project funds the prize?** | Must be a mission whose pay hook is registry-aware. Practically: create a **new** mission in Phase 3. Attaching an existing Arbitrum mission means no cashOut gating (its hook lacks `setDePrizeRegistry`). |
| 0.2 | **Competing teams** — the `MoonDAOTeam` token ids, in outcome-slot order | Arbitrum `MoonDAOTeam` = `0xAB2C354eC32880C143e87418f80ACc06334Ff55F`. Order is fixed forever: `outcomeIndex` = position in `registry.teamIds`. Ids must be non-zero and unique; ≥ 2 required. |
| 0.3 | **Sunset timestamp** | Must be in the future at `register` time. |
| 0.4 | **Admin Safe** = registry owner, mint owner, fee-router owner, **and CTF oracle** | The oracle is baked into `conditionId = keccak256(oracle, questionId, outcomeSlotCount)` and is irreversible. Verify the Safe's fallback handler accepts ERC-1155 (`close()` pushes inventory to the market owner, which will be the FeeRouter — but `recoverERC1155` forwards to the Safe). |
| 0.5 | **LMSR funding seed** (real ETH) | Design target ~1 ETH × number of teams. This is the treasury's bounded maximum loss. Sepolia used 0.03 ETH; mainnet should be a deliberate number. |
| 0.6 | **`questionId`** — unique bytes32 per DePrize | Record it alongside the `conditionId`; resolution needs it and it is **not stored on-chain**. |
| 0.7 | **Confirm fee-routing policy** | As built: fees → JB prize pool while the DePrize is non-terminal; → treasury once terminal (so refundable terminals don't inflate the `$OVERVIEW` cash-out floor). Already implemented and QA'd; confirm it is still the intent. |

---

## Phase 1 — Code prerequisites (PR, no mainnet transactions)

Ship these before touching mainnet. None of them depend on Phase 0 decisions.

| # | Task | File |
|---|---|---|
| 1.1 | **Add a standalone registry deploy script.** Only `DePrizeRegistryUpgrade.s.sol` exists today; the registry proxy was deployed ad hoc on Sepolia. Add `DePrizeRegistry.s.sol` (impl + `ERC1967Proxy` + `initialize(owner)`) so the mainnet deploy is reproducible and reviewable. | `subscription-contracts/script/deprize/DePrizeRegistry.s.sol` (new) |
| 1.2 | **Commit a `truffle-config.js` with an `arbitrum` network.** `prediction/.gitignore` ignores `truffle.js`, so there is no committed network config — the migrations in `prediction/migrations/` cannot be run reproducibly by anyone else. Add a committed config reading RPC/key from env. | `prediction/truffle-config.js` (new) |
| 1.3 | **Pre-flight assertions in the deploy scripts** — fail loudly if `WETH_ADDRESSES[42161]` / `CONDITIONAL_TOKENS_ADDRESSES[42161]` are unset (they already `require`, verify the message is clear). | `script/deprize/*.s.sol` |
| 1.4 | *(Optional, recommended)* **Run the M4 fork rehearsal against an Arbitrum fork** once Phase 2 addresses exist — `DePrizeM4ForkTest` / `DePrizeMintForkTest` with `DEPRIZE_FORK_RPC`, which asserts wei-level ETH conservation across the full close-out loop. | `test/deprize/` |

Items **1.5** (Config.sol addresses) and **1.6** (UI cutover) are also code, but must land *after* the addresses exist — see Phases 2 and 6.

---

## Phase 2 — Deploy the prediction-market stack (Arbitrum, one-time)

Run from `prediction/` (Truffle, Solidity 0.5). This is shared infrastructure — done once for all future DePrizes.

1. **Do not deploy WETH9.** Use canonical Arbitrum WETH `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1`. Pass it via `DEPRIZE_WETH` so migration 08 does not fall back to a Truffle-deployed mock.

   > **Pre-flight check.** Arbitrum's WETH is the bridged `aeWETH` behind a **proxy**, not a vanilla WETH9. `DePrizeMint` and `DePrizeFeeRouter` depend on `deposit()` (payable) and `withdraw(uint256)` via `IWETH`, and the LMSR uses the plain ERC-20 surface. Confirm both selectors on the live contract (a fork test or a 1 wei `deposit`/`withdraw` round-trip) before Phase 3 — everything downstream assumes it.
2. **Deploy** `ConditionalTokens` (migration 02), `Fixed192x64Math` (03), `LMSRWithTWAPFactory` (04, linked):

```bash
cd prediction
npx truffle migrate -f 2 --to 4 --network arbitrum
```

3. **Record** the `ConditionalTokens` and `LMSRWithTWAPFactory` addresses.
4. **Verify** both contracts on Arbiscan.

**Then land a small PR (1.5):**
- `fee-hook/script/base/Config.sol` — `WETH_ADDRESSES[ARBITRUM]`, `CONDITIONAL_TOKENS_ADDRESSES[ARBITRUM]`, `LMSR_FACTORY_ADDRESSES[ARBITRUM]`
- `ui/const/config.ts` — `CONDITIONAL_TOKEN_ADDRESSES.arbitrum`, `COLLATERAL_TOKEN_ADDRESSES.arbitrum`

> The 0.8 deploy scripts read `Config.sol` by chain id, so Phase 3 **cannot start** until this merges.

---

## Phase 3 — Deploy the 0.8 DePrize stack (Arbitrum)

Run from `subscription-contracts/` with `--via-ir --optimizer-runs 200 --broadcast`. Set `DEPRIZE_OWNER` to the admin Safe on every script so nothing is left owned by the deployer EOA.

| Order | Contract | Script | Notes |
|---|---|---|---|
| 3.1 | **MissionCreator** (new) | `script/MissionCreator.s.sol` | Required for a registry-aware `LaunchPadPayHook`. Decide whether this becomes the canonical Arbitrum creator (repoint `MISSION_CREATOR_ADDRESSES.arbitrum`, so all future missions are registry-aware) or stays DePrize-only (Sepolia's choice — avoids fragmenting launchpad listings, but the DePrize mission won't appear in the main list unless its `MissionTable` is wired). **Flag for review.** |
| 3.2 | **Create the mission** → yields the **JB project id** and the mission's `LaunchPadPayHook` address | via the new MissionCreator | Record both. |
| 3.3 | **DePrizeRegistry** (impl + `ERC1967Proxy`) | `DePrizeRegistry.s.sol` (from 1.1) | Deploy the **M5 implementation** (with `providerPayoutAddress`) from the start — avoids the Sepolia mid-flight upgrade. |
| 3.4 | **DePrizeMint** (UUPS proxy) | `DePrizeMint.s.sol` | `DEPRIZE_REGISTRY=0x…` |
| 3.5 | **DePrizeRedeem** | `DePrizeRedeem.s.sol` | Non-upgradeable. |
| 3.6 | **DePrizeFeeRouter** | `DePrizeFeeRouter.s.sol` | Non-upgradeable. |

Verify all on Arbiscan. Confirm `owner()` on registry / mint / fee-router is the Safe.

---

## Phase 4 — Provision the first market

1. **Prepare the condition + create the funded LMSR** (migration 08), reusing Phase 2 infrastructure:

```bash
cd prediction
DEPRIZE_ORACLE=<admin-safe> \
DEPRIZE_NUM_OUTCOMES=<#teams> \
DEPRIZE_QUESTION_ID=0x<unique> \
DEPRIZE_CTF=<phase2 CTF> \
DEPRIZE_WETH=0x82aF49447D8a07e3bd95BD0d56f35241523fBab1 \
DEPRIZE_FACTORY=<phase2 factory> \
DEPRIZE_FUNDING_PER_OUTCOME=<wei> \
npx truffle migrate -f 8 --to 8 --network arbitrum
```

2. **Record** `conditionId`, the LMSR market address, and the `questionId` (not recoverable on-chain).
3. Migration 08 transfers LMSR ownership to `DEPRIZE_ORACLE`. For the fee router to sweep, ownership must end at the **FeeRouter** — so from the Safe: `lmsr.transferOwnership(feeRouter)`. (Alternatively pass the FeeRouter as `DEPRIZE_ORACLE`'s successor and transfer once; ordering just has to end with FeeRouter owning the market.)

---

## Phase 5 — Register and open (Safe transactions, strict order)

| # | Call | Caller | Note |
|---|---|---|---|
| 5.1 | `registry.register(jbProjectId, teamIds, sunset)` → returns `deprizeId` | registry owner (Safe) | Ids start at 1. Binds the JB project. |
| 5.2 | `registry.setCondition(deprizeId, conditionId)` | Safe | Required before `open`. |
| 5.3 | `payHook.setDePrizeRegistry(registry)` | **mission `to` owner** (may differ from the Safe) | **One-way latch** — cannot be undone or repointed. Enables DePrize-driven cashOut gating. |
| 5.4 | `registry.open(deprizeId)` | Safe | DRAFT → OPEN. |
| 5.5 | `mint.setMarket(deprizeId, lmsr)` | Safe | Validates CTF/collateral/slot-count/condition match. **Betting is impossible without this.** |
| 5.6 | `feeRouter.setMarket(deprizeId, lmsr)` | Safe | Same validations. |
| 5.7 | `mint.setFeeRouter(feeRouter)` | Safe | Turns on the per-bet fee sweep. |

**Verify before announcing** (mirrors QA section B): `registry.state == OPEN`, `bettingOpen == true`, `deprizeIdByJBProject(jb) == deprizeId`, `mint.marketOf == feeRouter.marketOf == lmsr`, `mint.feeRouter()` set, `lmsr.owner() == feeRouter`, `lmsr.stage() == 0 (Running)`, `lmsr.fee() == 1e16`, `payHook.deprizeRegistry() == registry`, `payoutDenominator(condition) == 0`.

---

## Phase 6 — UI cutover (PR)

1. Populate the `arbitrum` slots in `ui/const/config.ts`: `DEPRIZE_REGISTRY_ADDRESSES`, `DEPRIZE_MINT_ADDRESSES`, `DEPRIZE_REDEEM_ADDRESSES`, `DEPRIZE_FEE_ROUTER_ADDRESSES`, `LMSR_WITH_TWAP_ADDRESSES` (fallback; `mint.marketOf` also resolves it), plus the Phase 2 CTF/WETH entries if not already merged.
2. Point `ORACLE_ADDRESS` / `OPERATOR_ADDRESS` at the mainnet Safe (currently Sepolia EOAs), or make them chain-indexed — they are single-value constants today and are used by admin/resolve surfaces.
3. **Remove the coming-soon gate** — the `getChainSlug(selectedChain) === 'arbitrum'` early-return in `ui/pages/deprize/index.tsx` and `ui/pages/deprize/[id].tsx`. Keep `DePrizeComingSoon.tsx` only if another chain still needs it; otherwise delete.
4. **Publish the Terms** to `https://docs.moondao.com/Legal/DePrize-Terms-and-Conditions` (currently **404**; draft at `ui/docs/DEPRIZE_TERMS_AND_CONDITIONS.md`). The bet flow links this — it should not 404 at launch.
5. Sanity-check prize-pool copy against the real JB project (wording should not assume `$OVERVIEW` if the project differs).

---

## Phase 7 — Mainnet smoke test

Re-run the shape of [`DEPRIZE_QA.md`](./DEPRIZE_QA.md) sections B/C against Arbitrum, with **small real amounts**:

- Index lists the DePrize as **Live**; badge reads **Open** (not "Open · paused" / "betting unavailable").
- Place a small bet through the UI → confirm the JB `pay` (5% slice) and a `FeesSwept(deprizeId, amount, toPrizePool=true)` in the same receipt.
- Cash out a position → confirm the follow-up permissionless `sweepFees` lands in the prize pool.
- Confirm the prize-pool figure increases after both.
- Confirm cashOut is blocked while active (`payHook.stage() == 1`).
- Mobile viewport check; geo-gate banner behavior.

Then keep the resolution path rehearsed but unexecuted until settlement: pause → `reportPayouts` → close → `withdrawFees`/terminal sweep → redeem. **Ordering invariant: the market must be paused or closed before reporting payouts** — a live market with a known outcome is free money against treasury inventory (`DePrizeResolve.s.sol` enforces this when `DEPRIZE_MARKET` is set).

---

## Risk register

| Risk | Mitigation |
|---|---|
| `setDePrizeRegistry` is a one-way latch on the wrong hook | Verify the mission's hook address and that `deprizeRegistry()` is zero immediately before 5.3. |
| Oracle baked into `conditionId` is wrong/irrecoverable | Triple-check `DEPRIZE_ORACLE` in Phase 4; it cannot be changed after `prepareCondition`. |
| `questionId` lost | Record in this repo (Phase 4) — resolution is impossible to construct without it. |
| LMSR ownership left on the deployer EOA | Phase 4 step 3; assert `lmsr.owner() == feeRouter` in the Phase 5 verification. |
| Treasury loses more than intended to the market | Bounded by the funding seed (0.5) — pick deliberately. |
| Fees routed to JB inflate refunds on cancellation | Already handled: terminal states route fees to the treasury instead. Confirmed in 0.7. |
| New MissionCreator fragments launchpad listings | Decide 3.1 explicitly; if DePrize-only, confirm the mission's visibility expectations. |
| Betting silently unavailable after launch | Phase 5 verification + the reconciled status badge ("Open · betting unavailable") surfaces this in the UI rather than hiding it. |
| Arbitrum `aeWETH` proxy behaves unlike WETH9 | Pre-flight `deposit`/`withdraw` check in Phase 2 before any 0.8 contract is deployed against it. |

---

## Critical path

```text
Phase 0 decisions
  └─► Phase 1 PR (registry script, truffle config)
        └─► Phase 2 deploy CTF + factory ──► Config.sol / UI address PR
              └─► Phase 3 MissionCreator + mission + Registry/Mint/Redeem/FeeRouter
                    └─► Phase 4 condition + funded LMSR ──► ownership → FeeRouter
                          └─► Phase 5 register → setCondition → setDePrizeRegistry → open → setMarket ×2 → setFeeRouter
                                └─► Phase 6 UI cutover + publish Terms
                                      └─► Phase 7 mainnet smoke
```

Phase 1 and the Phase 0 decisions can proceed in parallel. Everything from Phase 2 onward is strictly sequential.
