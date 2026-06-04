# DePrize — Milestone 3: Bet Router (`DePrizeMint`)

**Status:** Implemented, unit-tested (+ guarded fork test)
**Scope:** A single `bet()` call that splits an incoming ETH bet into the **5% Juicebox prize slice** (bettor receives `$OVERVIEW`) and **95% collateral** used to buy a team's outcome tokens on the existing Gnosis Conditional Tokens (CTF) + `LMSRWithTWAP` market. Gated by the DePrize lifecycle.
**Depends on:** Milestone 1 (`DePrizeRegistry`).
**Files:**

- `subscription-contracts/src/deprize/DePrizeMint.sol` (new — the router, UUPS + Ownable + `IERC1155Receiver`)
- `subscription-contracts/src/deprize/interfaces/ILMSRWithTWAP.sol` (new)
- `subscription-contracts/src/deprize/interfaces/IConditionalTokens.sol` (new)
- `subscription-contracts/src/deprize/interfaces/IWETH.sol` (new)
- `subscription-contracts/test/deprize/DePrizeMint.t.sol` (new — 15 unit + 3 guarded fork tests)
- `subscription-contracts/script/deprize/DePrizeMint.s.sol` (new — UUPS proxy deploy)
- `prediction/migrations/08_create_deprize_market.js` + `prediction/deprize.config.js` (new — per-DePrize market provisioning)
- `fee-hook/script/base/Config.sol` (WETH / ConditionalTokens / LMSR address config)

See the full design in [`DEPRIZE.md`](./DEPRIZE.md).

---

## Locked decisions

- **Scope = bet router + market wiring only.** Resolution (`reportPayouts`), winner redemption (`redeemPositions`), and the refund path on terminal states are **M4**.
- **CTF oracle = a MoonDAO multisig**, fixed at `prepareCondition` time; it will call `reportPayouts` in M4.
- **Reuse the existing Gnosis CTF + `LMSRWithTWAP` stack as externally-deployed Solidity `0.5` contracts.** They are not ported to `0.8`; the `0.8` router calls them through interfaces.
- **The 1% swap fee is the LMSR `fee` param (`1e16`)**, set at market creation — no Uniswap v4.

### Why external deps

Gnosis CTF (`@gnosis.pm/conditional-tokens-contracts`), `LMSRMarketMaker`, and `prediction/contracts/LMSRWithTWAP.sol` are `^0.5.x`; `subscription-contracts` is `0.8.20 + via-ir`. They can't co-compile, but deployed instances are callable from `0.8` via interfaces. Testnet deployments already exist in `ui/const/config.ts` (`LMSR_WITH_TWAP_ADDRESSES`, `CONDITIONAL_TOKEN_ADDRESSES`, `COLLATERAL_TOKEN_ADDRESSES`).

## Bet flow

```
bettor sends ETH + (outcomeIndex, qty, maxCost)
        │
        ▼
DePrizeMint.bet()
  1. require registry.bettingOpen(deprizeId)           ── else revert
  2. slice  = msg.value / 20            (5%)
     budget = msg.value - slice         (95%)
  3. jbTerminal.pay{value: slice}(jbProjectId, …, beneficiary = bettor)
        → bettor receives $OVERVIEW (cash-out floor)
  4. cost = market.calcNetCost(amounts[outcomeIndex] = qty)
     require cost <= budget && cost <= maxCost          ── slippage guard
  5. weth.deposit{value: cost}; weth.approve(market, cost)
  6. market.tradeWithTWAP(amounts, cost)
        → CTF mints ERC-1155 outcome tokens to DePrizeMint
        → captured in onERC1155(Batch)Received
  7. forward outcome tokens → bettor (safeBatchTransferFrom)
  8. refund leftover ETH (budget - cost) → bettor
```

### Why "quantity + maxCost + refund"

LMSR prices a *quantity* of outcome tokens, not a fixed spend. The frontend derives `qty` from the bettor's desired ETH (via `calcNetCost`, the pattern in the archived `ui/archive/components/betting/Market.tsx`). `calcNetCost` and `tradeWithTWAP` execute atomically in the same tx, so the quote equals the charged cost; any unspent ETH is refunded. `maxCost` is the explicit slippage cap.

## `DePrizeMint` shape

- **State:** `registry`, `jbTerminal`, `weth`, `ctf`, `mapping(uint256 => address) marketOf` (deprizeId → LMSR market), plus transient receive buffers used only within a `bet`.
- **`initialize(owner, registry, jbTerminal, weth, ctf)`** — UUPS, matching `DePrizeRegistry`.
- **`setMarket(deprizeId, market)`** (onlyOwner) — binds a market and **validates the wiring**: `market.pmSystem() == ctf`, `market.collateralToken() == weth`, and `market.atomicOutcomeSlotCount() == teamIds.length`. This makes a misconfigured market un-bindable rather than failing at bet time.
- **`bet(deprizeId, outcomeIndex, outcomeTokenAmount, maxCost)`** (payable, `nonReentrant`).
- **ERC-1155 receiver:** `onERC1155Received` / `onERC1155BatchReceived` only accept transfers **from the configured CTF, mid-bet** (`_inBet` flag) — any unsolicited 1155 deposit reverts. Captured ids/values are forwarded to the bettor after the trade returns (avoids manual positionId math).

Outcome-slot convention: `outcomeIndex` is the team's position in `registry.teamIds(deprizeId)`.

### Money conservation

`msg.value = slice (→ JB) + cost (→ WETH/market) + leftover (→ refund)`. The router holds no ETH or WETH after a bet (asserted in tests).

### Safety

- `nonReentrant` on `bet`; checks-effects ordering; the 1155 receiver only buffers state (forwarding happens after the external trade returns, inside the `nonReentrant` frame).
- Betting P&L lives entirely in CTF collateral (WETH), separate from the 5% prize funding in Juicebox. The LMSR is a bounded-loss market maker seeded by the treasury — different from a parimutuel pool.

## Market provisioning (per DePrize)

1. **(prediction / Truffle)** `npx truffle migrate -f 8 --to 8` with `DEPRIZE_*` env vars → `ConditionalTokens.prepareCondition(oracleMultisig, questionId, numOutcomes = #teams)` then `LMSRWithTWAPFactory.createLMSRWithTWAP(ctf, weth, [conditionId], fee = 1e16, 0x0, funding)`. `funding` defaults to ~1 ETH × `numOutcomes` (the design-doc seed). Existing testnet CTF/WETH/factory can be reused via `DEPRIZE_CTF` / `DEPRIZE_WETH` / `DEPRIZE_FACTORY`.
2. **(subscription-contracts / Foundry)** `registry.setCondition(deprizeId, conditionId)` then `registry.open(deprizeId)`.
3. **(subscription-contracts / Foundry)** `DePrizeMint.setMarket(deprizeId, lmsrMarket)`.

Deploy the router with `script/deprize/DePrizeMint.s.sol` (`DEPRIZE_REGISTRY=0x… forge script …`), which reads WETH/CTF for the chain from the shared `Config.sol`.

## Tests

`forge test --match-path 'test/deprize/DePrizeMint.t.sol'` — **18 passing**:

**`DePrizeMintTest` (15, deterministic, no RPC)** — real `DePrizeRegistry` + lightweight mocks for the JB terminal, WETH, CTF, and an LMSR (linear-price) market:

- happy path: 5% routed to JB with the bettor as beneficiary, 95% wrapped, outcome tokens forwarded to the bettor, leftover refunded, no funds stuck (money conservation asserted); buying a non-zero outcome index;
- gates: `bettingOpen` false (LOCKED and cancellation-pending), bad outcome index, market not set;
- slippage: `maxCost` exceeded and cost-exceeds-budget both revert with the exact cost/budget/cap;
- `setMarket` validations: CTF mismatch, collateral mismatch, slot/team mismatch, zero address, onlyOwner;
- ERC-1155 guard: unsolicited transfers revert; `supportsInterface`.

**`DePrizeMintForkTest` (3, guarded)** — reuses the **live** Arbitrum-Sepolia CTF + `LMSRWithTWAP` market and mocks only the JB terminal. Skips (no-ops) unless `DEPRIZE_FORK_RPC` is set, so CI without an RPC is unaffected. Run with:

```
DEPRIZE_FORK_RPC=<arb-sepolia rpc> forge test --match-contract DePrizeMintForkTest -vvv
```

It asserts a real bet against the live market (slice routing, real outcome-token receipt, refund, money conservation), the `maxCost` guard, and the `bettingOpen` gate.

> Note: if whole-suite compilation is blocked by the coverage `0001-struct.patch` files, run with `--match-path 'test/deprize/DePrizeMint.t.sol'` (this milestone's tests have no dependency on those files).

## Out of scope (M4)

- `reportPayouts` resolution bridge from `registry.winningTeamId`.
- `redeemPositions` for winning bettors.
- The unified refund path on `CANCELLED` / `NO_WINNER` / `M2_FAILED` (CTF collateral + the JB-side `$OVERVIEW` floor).
