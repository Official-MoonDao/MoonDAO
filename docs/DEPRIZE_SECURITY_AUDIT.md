# DePrize Smart Contract Security Audit

**Scope:** the DePrize on-chain system — the bespoke "glue" contracts MoonDAO wrote
to connect Gnosis prediction markets to the Juicebox launchpad, plus the LMSR
market subclass that sits between them.
**Method:** AI-assisted audit, grounded in compilation, the existing test suite,
static analysis, and executable proof-of-concept exploits run against live
Arbitrum One state.
**Date:** 2026-09-10
**Branch reviewed:** `cursor/touchdown-gtm-strategy-8d22`

---

## 0. TL;DR

- **One exploitable bug found, fixed, and proven.** `LMSRWithTWAP.tradeWithTWAP`
  routed its trade through an **external self-call** (`this.trade(...)`), which
  makes the market itself the trader. Because the market is its own counterparty,
  **any address, supplying no collateral and holding no tokens, can force the
  market to merge its own escrowed backing into loose collateral for the price of
  gas.** That loose collateral is then indistinguishable from accrued fees to the
  permissionless `DePrizeFeeRouter.sweepFees`, which pulls it out and routes it
  into the Juicebox prize pool (or treasury). This breaks the market's
  collateralisation invariant, corrupts prize/refund accounting, and lets anyone
  brick the AMM sell-side. **Severity: High.**
  - Reproduced on live Arbitrum One (not just by reasoning). Fixed by changing the
    self-call to an internal call. See [H-01](#h-01).
- **The user's risk thesis holds and is confirmed by this audit.** The primitives
  that actually custody and move money — the Gnosis Conditional Tokens Framework
  (CTF) and Juicebox — are third-party audited and used as-is. The bug we found is
  **not** in those primitives and **not** an arithmetic/settlement error; it is a
  missing-access-context defect in MoonDAO's own thin LMSR subclass. That is
  exactly the class of risk a full third-party re-audit of the money-movers would
  *not* have caught, and exactly the "unaudited glue" this audit targeted.
- **No theft-of-user-funds path was found.** The High finding moves MoonDAO's own
  seed capital into MoonDAO-controlled destinations (prize pool / treasury) and
  griefs the market; it does not send funds to the attacker. This caps it below
  Critical but does not make it safe to ship.
- **The deployed DePrize-1 market cannot be patched** (it is an immutable
  EIP-1167 clone). The fix protects **future** deployments. The Touchdown mainnet
  market must be deployed from the fixed source, and the existing test market
  treated as disposable. See [§7](#7-deployed-market-remediation).

---

## 1. Why this audit, and what it deliberately did and did not cover

The DePrize product is assembled from three layers:

| Layer | Who wrote it | Audit status | In scope here? |
|---|---|---|---|
| **Settlement / custody**: Gnosis Conditional Tokens (`ConditionalTokens.sol`), the LMSR market-maker core (`MarketMaker.sol` / `LMSRMarketMaker.sol`) | Gnosis | Externally audited, widely deployed (Polymarket et al.) | Reviewed only at the **interface/assumption** boundary |
| **Prize custody / payments**: Juicebox v5 (`@bananapus`/`nana-core`) terminals, rulesets, cash-out | Juicebox | Externally audited, widely deployed | Reviewed only at the **interface/assumption** boundary |
| **The glue**: `LMSRWithTWAP` (+ factory), `DePrizeRegistry`, `DePrizeMint`, `DePrizeFeeRouter`, `DePrizeRedeem`, `DePrizeDisburse`, the LaunchPad pay hook | MoonDAO (much of it AI-assisted) | **Unaudited** | **Primary focus** |

This split is deliberate and matches the project's own risk assessment: re-auditing
the money-moving primitives is low-yield because they are already audited and
unchanged; the real residual risk lives in the bespoke glue and in the *seams*
where the glue makes assumptions about the audited primitives. **The one High
finding is exactly such a seam** — MoonDAO's `LMSRWithTWAP` subclass re-exposed a
Gnosis entry point in a way that violates an assumption `DePrizeFeeRouter` makes
about the Gnosis market.

**Explicitly out of scope (and why):**
- The internal correctness of Gnosis CTF and LMSR math, and of Juicebox — trusted
  as audited third-party code.
- **Key management / signer authority.** The most consequential real-world risk to
  this system is not contract logic but *who holds the keys* (the market/router
  owner, the resolution oracle, the Juicebox project owner, upgrade authority on
  the UUPS contracts). That is an operational-security problem tracked as gate
  **G4** in `DEPRIZE_GTM_TOUCHDOWN.md`, not a code defect, and it is not re-argued
  here beyond noting it is the top residual risk.

---

## 2. Methodology — adopting the state of the art for AI-assisted auditing

LLM-only auditing has a well-documented failure mode: fluent, confident findings
that do not reproduce (false positives), and a blind spot for cross-function and
economic/invariant bugs. The current state of the art therefore treats the model
as a **hypothesis generator** and insists that **deterministic tools and
executable PoCs are the verifier**. This audit followed that discipline:

1. **Ground the model in reality, not just source.** Every claim was checked
   against one of: a successful compile, the existing Foundry test suite, a static
   analyzer, or a live fork execution. No finding is reported on reasoning alone.
2. **Threat-model first** (§3): enumerate assets, actors, entry points, trust
   boundaries, and external-call surfaces before reading line-by-line.
3. **Invariant-first, attacker-minded passes** (§4–§5): for each protocol
   invariant, ask "how would an attacker break *this* for profit, for grief, or to
   corrupt accounting?" — rather than scanning for syntactic bug patterns only.
4. **Systematic per-class coverage**, using the recognised taxonomies (SWC
   Registry, DASP Top 10, and the Trail of Bits / ConsenSys Diligence / OpenZeppelin
   checklists) as a checklist: access control, reentrancy, arithmetic/overflow,
   oracle/price manipulation, upgradeability & storage layout, external-call &
   token-callback (ERC-1155/777) hazards, token accounting, DoS/griefing, and
   MEV/front-running.
5. **Reproduce or discard.** Every candidate finding must be reproduced with an
   executable PoC. Candidates that do not reproduce are dropped, to keep the
   false-positive rate near zero. The one surviving finding has a PoC that runs
   against **live deployed bytecode**.
6. **Differential / fork testing** against the real deployed clones and real
   Gnosis + Juicebox dependencies, so the audit reflects production, not a
   simplified local mock.
7. **Corroborate LLM output with static analysis** (Slither) and treat any
   disagreement as a prompt to dig, not to trust either blindly.

### Why this discipline — what the evidence actually supports

The methodology above is not folklore; it tracks the measured state of the art as
of 2026:

- **Detection, not exploitation or repair, is the bottleneck.** On OpenAI/Paradigm's
  EVMbench the best model scored ~46% on *detect* vs ~72% on *exploit*; an
  independent re-evaluation reproduced a ~47% detection ceiling and generated
  **0/110** real-incident exploits without hints. The classes models miss most are
  exactly this system's hard parts: rounding, multi-step state, and
  protocol-specific logic (LMSR math, the CTF state machine, Juicebox semantics).
  The classes they find reliably are missing access control and textbook
  reentrancy. **Implication:** do not trust an LLM "all clear"; spend the effort on
  the seams and invariants, and treat every lead as unproven until executed.
- **False positives are the dominant failure mode, and benchmarks do not penalise
  them.** The techniques with measured FP reductions were all adopted here: static
  confirmation of LLM output (GPTScan-style filtering), a separate critic/judge
  stage (GPTLens/iAudit), one scoped pass per bug class rather than one broad pass
  (LLM-SmartAudit/AuditGPT), and invariant/property framing before pattern-matching
  (PropertyGPT).
- **A finding without a runnable PoC is a lead, not a finding.** This mirrors the
  Code4rena rule (coded PoC required for every High/Medium; a reverting PoC must
  show the exact revert) and Sherlock's "invalid without a PoC if not clearly
  understandable". Practitioner tooling encodes the same split — Trail of Bits'
  `fp-check` gates and Pashov's `FINDING` (requires `proof:`) vs `LEAD`. The single
  finding here (H-01) carries a PoC that executes against **live deployed
  bytecode**; no unproven leads are reported as findings.
- **Consensus is human/tool-in-the-loop, not autonomous.** OpenZeppelin, Trail of
  Bits and Pashov all run agents to *complement* human review, and Code4rena treats
  autonomous-scanner output as "known issues", not as the audit. This report is
  written in that posture.

### Tooling

| Tool | Version | Status in this audit |
|---|---|---|
| Foundry (`forge` / `cast`) | current | **Ran** — compile, 350-test suite, live-fork PoC, on-chain queries |
| Slither | 0.11.6 | **Ran** — static analysis of the 0.8 glue |
| solc (via `solc-select`) | 0.5.1 / 0.8.26 | **Ran** — compiled the fixed 0.5 `LMSRWithTWAP` and the 0.8 suite |
| Public Arbitrum One RPC | — | **Ran** — PoC executed against production state |
| Aderyn / 4naly3er | — | Recommended second-opinion static/QA sweep (not run; Slither + manual + fork PoC judged sufficient for a bounded glue audit) |
| Echidna / Medusa (property fuzzing) | — | **Recommended next depth increment** — fuzz LMSR pricing/fee round-trips and refund accounting (the rounding/multi-step classes LLMs miss) |
| Halmos / Certora (bounded proof / formal) | — | **Recommended** for the refund-math, fee-conservation and upgrade-authorisation invariants if budget allows |

> The operative, non-negotiable takeaway adopted throughout: **model proposes,
> tools + PoC dispose.** The fuzzing/formal rows are honestly out of the depth of
> this bounded pass; they are the recommended next step if the glue is to carry
> significant value beyond the per-wallet cap. SOTA references and reusable prompt
> templates are in [Appendix B](#appendix-b); the per-stack pitfall checklist with
> DePrize verdicts is in [Appendix C](#appendix-c).

---

## 3. System model

### Assets
- **WETH** escrowed as LMSR market backing (the funding seed) and as trade
  collateral inside the CTF.
- **CTF ERC-1155 outcome tokens** (the market's inventory and users' positions).
- **The Juicebox prize pool** (ETH held by the JB terminal for the DePrize project).
- **$OVERVIEW** launchpad tokens whose cash-out value tracks the prize pool.

### Actors & trust
- **Anyone (permissionless):** `LMSRWithTWAP.trade` / `tradeWithTWAP` /
  `updateCumulativeTWAP`, `DePrizeMint.bet`, `DePrizeFeeRouter.sweepFees`,
  `DePrizeRedeem.redeem`. (The market's Gnosis `whitelist` is unset — see §5 —
  so `onlyWhitelisted` gates no one.)
- **Owner / Safe (trusted):** registry lifecycle, market pause/close, fee-router
  admin & recovery, UUPS upgrades.
- **Resolution oracle (trusted):** reports payouts on the CTF condition. Its
  authority is a key-management assumption (G4), not enforced by these contracts.

### Entry points (glue)
`DePrizeMint.bet` (5% → JB pay hook, 95% → LMSR buy), `DePrizeFeeRouter.sweepFees`
(withdraw market fees → prize pool/treasury), `DePrizeRedeem.redeem` (CTF payout
redemption after resolution), `DePrizeRegistry.*` (lifecycle), and the LMSR
market's inherited public surface.

---

## 4. Invariants checked

1. **Market collateralisation:** a Running/Paused LMSR market's standalone
   collateral balance equals accrued trade fees only; all trade collateral and the
   funding seed stay escrowed inside the CTF. *(← the invariant H-01 breaks.)*
2. **Fee attribution:** `sweepFees` moves *only* real fees into the prize pool;
   seed/backing is never reclassified as prize.
3. **Bet conservation:** `bet()` splits exactly 5%/95%, mints outcome tokens to
   the bettor, and never lets a caller extract more than they paid.
4. **Redemption soundness:** `redeem` pays out strictly per the CTF payout vector,
   with floor division matching the CTF, and cannot over-pay.
5. **Access control:** privileged lifecycle/upgrade/recovery calls are owner-gated;
   ERC-1155 acceptance hooks reject unsolicited deposits.
6. **Upgrade safety:** UUPS contracts disable initializers in the constructor, gate
   `_authorizeUpgrade` to the owner, and preserve storage-gap layout.

Invariants 2–6 held under review and PoC attempts. Invariant 1 is violable —
[H-01](#h-01).

---

## 5. Findings

| ID | Title | Severity | Status |
|---|---|---|---|
| [H-01](#h-01) | `tradeWithTWAP` external self-call lets anyone drain market backing into "fees" and brick the AMM | **High** | **Fixed** (source); redeploy required for live clone |
| [I-01](#i-01) | `DePrizeFeeRouter.recoverERC20` ignores ERC-20 transfer return value | Informational | Open (recommend `SafeERC20`) |
| [I-02](#i-02) | `DePrizeRegistry` admin ordering foot-guns (`setCondition` drift, `cancel()` from `SETTLED`) | Informational | Open (operational) |
| [I-03](#i-03) | Slither recap — no actionable issues in glue | Informational | — |

---

<a name="h-01"></a>
### H-01 — `tradeWithTWAP` external self-call drains market backing and corrupts prize accounting (High)

**Contract:** `prediction/contracts/LMSRWithTWAP.sol`
**Live instance:** market clone `0x351aF5AcfBC4Df750B7BD58b4c4cbE94147aF211`
(Arbitrum One), owned by fee router `0x0EF00977e37e2e106BB6E9fa15952bB43a2761e1`.

#### Root cause

`tradeWithTWAP` forwarded to `trade` via an **external** call on `this`:

```solidity
function tradeWithTWAP(int[] memory outcomeTokenAmounts, int collateralLimit) public {
    updateCumulativeTWAP();
    require(outcomeTokenAmounts.length == cumulativeProbabilities.length, "Mismatched array lengths");
    this.trade(outcomeTokenAmounts, collateralLimit);   // <-- external self-call
}
```

An external call re-enters the contract as a fresh message whose `msg.sender` is
**the market itself**. In the Gnosis `MarketMaker.trade` sell path, `msg.sender` is
both the source of the sold outcome tokens *and* the recipient of the collateral
payout:

```solidity
// MarketMaker.trade, sell branch (outcomeTokenAmounts[i] < 0):
if (touched) pmSystem.safeBatchTransferFrom(msg.sender, address(this), positionIds, transferAmounts, "");
if (outcomeTokenNetCost < 0) mergePositionsThroughAllConditions(uint(-outcomeTokenNetCost));
...
if (netCost < 0) require(collateralToken.transfer(msg.sender, uint(-netCost)));
```

When `msg.sender == address(this)`:
- the "pull tokens from the seller" transfer is **market → market** (a no-op that
  always succeeds — the market already holds its inventory),
- `mergePositionsThroughAllConditions` converts a **complete set** of the market's
  own outcome tokens back into WETH **held by the market**,
- the payout `transfer(msg.sender, ...)` is **market → market** (also a no-op).

Net effect: the caller pays nothing, provides nothing, and the market converts its
own escrowed backing into **loose WETH sitting on the market**, shrinking its
outcome-token inventory. `onlyWhitelisted` does not stop this — the deployed
market's `whitelist` is the zero address, so the modifier is a no-op for everyone:

```solidity
modifier onlyWhitelisted() {
    require(whitelist == Whitelist(0) || whitelist.isWhitelisted(msg.sender), "...");
    _;
}
```

#### Why it becomes a loss: `sweepFees` treats the loose WETH as fees

`DePrizeFeeRouter` owns the market and documents this assumption in its own header:

> *"While the market is Running/Paused that balance is exactly the accumulated fees
> (trade collateral is escrowed inside the CTF via splitPosition, and the funding
> seed likewise), so sweeping mid-campaign is safe."*

`withdrawFees()` sweeps the market's **entire** collateral balance to the owner:

```solidity
function withdrawFees() public onlyOwner returns (uint fees) {
    fees = collateralToken.balanceOf(address(this));   // entire balance, not just fees
    require(collateralToken.transfer(owner(), fees));
}
```

and `sweepFees` (permissionless) measures the delta on the **router** side and
routes it onward:

```solidity
function sweepFees(uint256 deprizeId) external nonReentrant returns (uint256 swept) {
    uint256 before = weth.balanceOf(address(this));
    ILMSRWithTWAP(market).withdrawFees();
    swept = weth.balanceOf(address(this)) - before;    // faithfully captures the illegitimate WETH too
    ...
    // live -> Juicebox prize pool; terminal/cancelling -> treasury
}
```

The balance-delta guard defends against stray WETH in the *router*, but cannot tell
that the WETH pulled *out of the market* was backing rather than fees. So the forced
merge is laundered straight into the prize pool (or, on a cancelling DePrize, the
treasury — silently distorting the very refund math the router tries to protect).

#### Impact

- **Breaks invariant #1 (collateralisation) and #2 (fee attribution)**: the funding
  seed / backing is reclassified as fees and moved out of the market.
- **Permissionless griefing / DoS**: repeatable by anyone for gas; drains a
  freshly-funded market and bricks its sell-side liquidity.
- **Silent misallocation of MoonDAO seed capital** into the JB prize pool or
  treasury; on a cancelling DePrize this corrupts the disclosed refund.
- **Not** direct theft to the attacker (funds land in MoonDAO-controlled
  destinations), which is why this is High and not Critical. But it is zero-cost,
  needs no preconditions, and defeats a core accounting invariant, so it is not
  shippable as-is on a market holding real value.

#### Severity mapping (per-platform, exact criteria)

Rated against the three standard rubrics, because "High" means different things on
each and this finding sits on a boundary (no theft *to* the attacker, but a
zero-cost, replayable break of a core invariant + DoS):

| Platform | Rating | Governing criterion |
|---|---|---|
| **Code4rena** | **High** | "Assets can be … lost/compromised indirectly if there is a valid attack path that does not have hand-wavy hypotheticals." The path is proven on live bytecode; the market's backing is compromised. |
| **Sherlock** | **Medium** | "Breaks core contract functionality, rendering the contract useless" (the AMM sell-side); the loss stays within the protocol so it is not "direct loss of funds … significant" to a third party. Note Sherlock's replay clause: a small per-call loss "replayed indefinitely … considered a 100% loss." |
| **Immunefi (v2.3)** | **Medium** | "Smart contract unable to operate due to lack of token funds" / griefing — the attacker has no profit motive but damages the protocol. |

**Reported severity: High**, taking the Code4rena reading as primary (a
permissionless, zero-cost, proven path that compromises escrowed backing and bricks
core functionality), while flagging honestly that a strict Sherlock/Immunefi reading
lands at Medium because the funds do not leave MoonDAO's control. Either way it is
above the "ship it" line for a market holding real value.

**Independent corroboration:** the SOTA system-specific pitfall checklist compiled
for this audit ([Appendix C](#appendix-c)) flags this exact class from two
directions without reference to the code — **§E8** ("external self-calls `this.f()`
and `msg.sender` confusion": *"any function intended for self-call only must
`require(msg.sender == address(this))` or it is a public entry point"*) and **§E2**
(the Gnosis `withdrawFees()` sweeps the market's entire collateral balance, so any
transiently-loose collateral is treated as fees). H-01 is the intersection of the
two.

#### Proof of concept (reproduced on live Arbitrum One)

`subscription-contracts/test/deprize/AuditTradeWithTWAP.t.sol` (RPC-gated; no-ops
in CI). Attacker `0xBAD5EED` holds nothing and approves nothing:

```
DEPRIZE_FORK_RPC=https://arb1.arbitrum.io/rpc \
  forge test --match-contract AuditTradeWithTWAP -vvv
```

Observed against production state:

```
[PASS] testForkAnyoneCanForceMarketToMergeCollateral()
  market min inventory before: 23261266467536762
  market WETH before:          0
  market min inventory after:  17445949850652572   (Δ = 5815316616884190)
  market WETH after:           5815316616884190     (created from nothing the caller paid)

[PASS] testForkForcedMergeIsSweptAsFees()
  loose WETH on market pre-sweep:          5815316616884190
  swept out of market via sweepFees(1):    5815316616884190
```

The numbers close exactly: selling a complete set of `q = 23261266467536762 / 4 =
5815316616884190` merges to precisely `5815316616884190` WETH, all of which
`sweepFees(1)` then extracts as "fees." (A self-call *buy* reverts for lack of a
self-allowance — `testForkSelfCallBuyReverts` — confirming the sell/merge direction
is the damaging one.) On this test market the loss is bounded by the `0.04` WETH
seed; on a production market it scales with whatever is seeded.

#### Fix (applied)

Call `trade` **internally**, preserving the real caller as the trader:

```solidity
function tradeWithTWAP(int[] memory outcomeTokenAmounts, int collateralLimit) public {
    updateCumulativeTWAP();
    require(outcomeTokenAmounts.length == cumulativeProbabilities.length, "Mismatched array lengths");
    trade(outcomeTokenAmounts, collateralLimit);   // internal call: msg.sender stays the caller
}
```

With an internal call the caller must fund and approve their own trade exactly as a
direct `trade` would require, so the self-merge is impossible.

This function has **no legitimate caller** anywhere in the system: `DePrizeMint`
deliberately calls `updateCumulativeTWAP()` then `trade()` directly and documents
*why* it avoids `tradeWithTWAP` ("`tradeWithTWAP` internally does `this.trade(...)`,
which would make the market … the trader, so collateral/outcome-token flows would be
misattributed"). The function is therefore pure attack surface; the fix removes the
hazard with zero behavioural cost to the product.

---

<a name="i-01"></a>
### I-01 — `DePrizeFeeRouter.recoverERC20` ignores the ERC-20 return value (Informational)

```solidity
function recoverERC20(address token, address to, uint256 amount) external onlyOwner {
    IERC20(token).transfer(to, amount);   // return value unchecked
}
```

For tokens that return `false` instead of reverting, a failed rescue would appear to
succeed. `onlyOwner` and rescue-only, so impact is low, but recommend `SafeERC20`'s
`safeTransfer` for consistency with the rest of the codebase.

<a name="i-02"></a>
### I-02 — Registry admin ordering foot-guns (Informational)

- `setCondition` can be changed after `setMarket`, letting the registry's condition
  drift out of sync with the market it is bound to (the bind-time check in
  `DePrizeFeeRouter.setMarket` / `DePrizeMint.setMarket` would no longer hold).
- `cancel()` is reachable from `SETTLED`, allowing an admin-driven double state.

Both require the trusted owner to act against their own interest; they are
operational foot-guns, not vulnerabilities. Recommend either freezing `setCondition`
once a market is bound, or re-validating the market/condition pairing on
`setCondition`.

<a name="i-03"></a>
### I-03 — Slither recap (Informational)

Slither's flags on the 0.8 glue are all known-safe patterns: ETH sends guarded by
`nonReentrant`, ERC-1155 receivers gated by the `_inBet` / `_inClose` transient
flags, intentional return-value / zero-check omissions in owner-only paths, and
block-timestamp comparisons used for coarse lifecycle windows. Nothing actionable
beyond I-01.

---

## 6. Fix verification

| Check | Result |
|---|---|
| Fixed `LMSRWithTWAP.sol` compiles under solc 0.5.1 | Pass (bytecode 25,609 hex chars, `tradeWithTWAP` still in ABI) |
| Fix changes compiled bytecode | Pass — pre-fix 25,991 → post-fix 25,609 (external self-call dispatch removed) |
| Full Foundry suite (no RPC) | 350 pass; **every DePrize suite green** (Registry 51, Mint 29, Redeem 37+3, FeeRouter 24+4, Disburse 13, Generations 17+4, PayHook 14, LaunchConfig 4, RosterSpike 5, WethPreflight 1) |
| Pre-existing failures unrelated to this change | 12 non-DePrize suites revert at `setUp() (gas: 0)`; **proven pre-existing** — the identical 12 fail with all changes stashed (they require a fork/live Tableland/Juicebox/Uniswap deployments) |
| PoC no-ops safely in CI | Pass — 3 tests early-return (~2.5k gas) when `DEPRIZE_FORK_RPC` is unset |

---

## 7. Deployed-market remediation

The live DePrize-1 market (`0x351aF5…F211`) is an **EIP-1167 minimal-proxy clone**
delegating to implementation `0x7473ef3d2e9bc12f0c9b52590e57489d0bee190c`. Clones
have no upgrade mechanism — the implementation address is hard-coded in bytecode —
so **the source fix cannot be applied to the already-deployed market.**

Recommended actions before the Touchdown mainnet launch:
1. **Redeploy** the LMSR implementation and factory from the fixed source, and
   deploy the Touchdown market as a fresh clone of the fixed implementation.
2. Treat the existing DePrize-1 test market as **disposable** — do not place real
   value behind it; if it must remain, keep its seed negligible and expect it to be
   drainable.
3. **Defense-in-depth (optional):** set a non-zero Gnosis `whitelist` on production
   markets so `trade`/`tradeWithTWAP` are gated even if a future subclass regresses,
   and keep `DePrizeMint`'s pattern of calling `trade` directly.

---

## 8. Reproduction & artifacts

- **Fix:** `prediction/contracts/LMSRWithTWAP.sol` (`this.trade` → `trade`).
- **PoC:** `subscription-contracts/test/deprize/AuditTradeWithTWAP.t.sol`
  (RPC-gated fork test, matches the repo's existing `DEPRIZE_FORK_RPC` convention).
- **Run the PoC:**
  `DEPRIZE_FORK_RPC=<arbitrum-one rpc> forge test --match-contract AuditTradeWithTWAP -vvv`
- **Run the suite:** `forge test` from `subscription-contracts/`.

### Appendix A — on-chain facts (Arbitrum One, at audit time)

| Item | Value |
|---|---|
| Market (LMSRWithTWAP clone) | `0x351aF5AcfBC4Df750B7BD58b4c4cbE94147aF211` |
| Market implementation | `0x7473ef3d2e9bc12f0c9b52590e57489d0bee190c` |
| Market owner | `0x0EF00977e37e2e106BB6E9fa15952bB43a2761e1` (DePrizeFeeRouter) |
| Fee router owner | `0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011` |
| CTF (ConditionalTokens) | `0x12DAC07Bf586E06a9bDa32c422864C8Fda43FA29` |
| Collateral (WETH) | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` |
| Market `whitelist` | `0x0000…0000` (unset → no gate) |
| Market `stage` / `funding` / `fee` / outcomes | Running / `0.04` WETH / 1% / 4 |

---

<a name="appendix-b"></a>
## Appendix B — AI-auditing SOTA: references and prompt templates

Curated for MoonDAO's own future passes. The load-bearing rule is that a model
proposes and **tools + a runnable PoC dispose**; everything below serves that.

**Evidence / benchmarks:** EVMbench (OpenAI/Paradigm) and its independent
re-evaluation (detection is the bottleneck; FPs are unpenalised); GPTScan (static
confirmation cut ~66% of LLM FPs); GPTLens and iAudit (a critic/ranker stage);
LLM-SmartAudit and AuditGPT (one scoped pass per bug class); PropertyGPT (invariant/
property framing + a prover); LLM4Vuln (knowledge retrieval ≈ doubles F1 for
non-reasoning models).

**Practitioner tooling to copy:** Trail of Bits skills (`fp-check`,
`audit-context-building`, `entry-point-analyzer`, `differential-review`,
`variant-analysis`) and `slither-mcp`; Pashov's open `solidity-auditor` (nine
single-lens agents + gap-hunters; `FINDING` requires `proof:`, else it is a `LEAD`);
OpenZeppelin's in-house AI Auditor + Contracts MCP; Code4rena's V12 known-issues
policy and PoC-required submission rules.

**Checklists for retrieval:** Solcurity, OWASP Smart Contract Top 10 (2025),
Secureum Pitfalls 101/201 and Audit Findings 101/201, the Cyfrin/Solodit checklist,
and the ToB token-integration checklist. (SWC registry is unmaintained — use as
vocabulary only.)

**Condensed prompt templates** (fill `<>`; run each per-contract):

*Per-class pass (one class only):*
> ROLE: senior Solidity auditor, ONE bug class only: `<class>`. SCOPE `<files>`,
> ENTRY POINTS `<…>`, TRUST MODEL `<who is trusted>`, INVARIANTS `<…>`. Paste the
> exact external functions you may rely on (CTF/LMSR/WETH/JB) — do not invent
> signatures. For each candidate: restate the bug in one plain sentence, quote the
> `file:line` that enables or prevents it, verdict TRUE/FALSE/UNKNOWN. Emit only
> TRUE/UNKNOWN as `FINDING|LEAD | path | preconditions | attack (tx#, actor,
> calldata, msg.value, state delta) | impact | proof (Foundry sketch; if absent →
> LEAD) | fix`. Reject anything requiring a compromised admin unless an
> **unprivileged** actor amplifies it.

*Critic / judge (run cold, on a different model):* PASS/FAIL each gate with
`file:line` evidence — (1) every step callable by the stated actor, (2)
preconditions reachable without admin error, (3) precise revert selector or balance
delta shown, (4) impact quantified and above dust, (5) no existing guard
(`nonReentrant`, WETH 2300-gas stipend, `try/catch`) fully blocks it, (6) not a
duplicate. Then give severity under Code4rena/Sherlock/Immunefi with the exact
criterion quoted.

*PoC writer:* write a Foundry fork test at a pinned block using the **real** CTF,
WETH and JB addresses; `vm.prank` each actor; assert the concrete loss as balance
deltas (or `vm.expectRevert(<selector>)`); the test must pass on current code and
fail after the fix.

---

<a name="appendix-c"></a>
## Appendix C — system-specific pitfall checklist, with DePrize verdicts

Each row is a known hazard class for this exact stack (Gnosis CTF + LMSR + UUPS +
WETH + Juicebox + ERC-1155 callbacks), with the status **verified in the DePrize
code** during this audit. This is the per-class coverage record.

| # | Hazard | DePrize status |
|---|---|---|
| **E1** | CTF `reportPayouts` trusts the oracle absolutely, is single-shot, and accepts **non-one-hot** payout vectors; `redeemPositions` rounds down per position | **OK.** `DePrizeRedeem.redeem` redeems every nonzero position (`indexSet = 1<<i`) and lets the CTF floor-divide per position; `previewRedeem` mirrors it (`stake * payoutNumerators / den`). Handles split resolutions, not just winner-takes-all. Oracle authority is a key-mgmt (G4) assumption, not a code defect. |
| **E2** | Gnosis `withdrawFees()` sweeps the market's **entire** collateral balance as "fees"; unbounded `changeFee`; `close()` requires the owner to be an ERC-1155 receiver | **One High (H-01)** — the entire-balance sweep is what turns the forced merge into a loss. **Otherwise OK:** `changeFee`/`changeFunding` have no router passthrough (unreachable unless ownership is moved to an EOA); creation fee is bounded by the factory (`_fee < FEE_RANGE`); `DePrizeFeeRouter` implements the ERC-1155 receiver gated by `_inClose`, so `close()` succeeds. |
| **E3** | UUPS: unprotected implementation `initialize`, two-tx init front-running, unrestricted `_authorizeUpgrade`, storage-layout drift | **OK.** `DePrizeMint` and `DePrizeRegistry` call `_disableInitializers()` in the constructor and gate `_authorizeUpgrade` with `onlyOwner`; `DePrizeRedeem`/`DePrizeFeeRouter` are non-upgradeable by design. Upgrade authority is a G4 concern (untimelocked owner), not a code defect. |
| **E4** | WETH `withdraw` uses a 2300-gas `transfer`; the caller's `receive()` must not `SSTORE` | **OK.** All three ETH-handlers (`FeeRouter`, `Mint`, `Redeem`) have an empty `receive() external payable {}` (no storage writes). Target is canonical Arbitrum WETH. |
| **E5** | JB `pay{value}` overrides `amount` with `msg.value`, **mints project tokens to the beneficiary** (who can cash out), and can revert synchronously (paused ruleset, reverting data hook) | **OK, with one liveness note.** `sweepFees` sets `beneficiary = owner()` (treasury), so no unprivileged caller receives mintable tokens. `DePrizeMint.bet` wraps its `sweepFees` call in `try/catch`. *Note:* a **direct** `sweepFees` call has no `try/catch` around `jbTerminal.pay`, so a paused JB ruleset would revert it until unpaused (fees simply accrue). Liveness only — no fund loss; optional to harden. |
| **E6** | Your ERC-1155 receiver runs during CTF split / transfers-in / LMSR `close()` — an external re-entry point | **OK.** Every receiver is restricted (`msg.sender == ctf` and a transient `_inBet`/`_inClose`/`_inRedeem` flag) and does no value logic; all value-moving entry points are `nonReentrant`. |
| **E7** | ETH refunds via `.call` and gas griefing; never compute refunds from `address(this).balance` | **OK.** Payouts/refunds are scoped to a measured **balance delta** (`wethBefore`/`before`), not `address(this).balance`; ETH is sent with checked `.call` and reverts on failure. Recipients are EOAs/the caller, so a reverting `receive()` only self-DoSes. |
| **E8** | External self-calls `this.f()` set `msg.sender = address(this)` and `msg.value = 0`; a self-call-only function with no `require(msg.sender == address(this))` is a public entry point | **Root cause of H-01** — `tradeWithTWAP` used `this.trade(...)`. **Fixed** to an internal call. No other `this.`-self-calls in the DePrize glue. |
