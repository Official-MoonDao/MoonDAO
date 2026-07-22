# DePrize Phase 2 — QA checklist

**Scope:** Sepolia DePrize lifecycle + FeeRouter + Redeem, plus automated contract/UI suites.  
**Date run:** 2026-07-22 (bettor smoke + full resolve/redeem/terminal follow-up)  
**Branch:** `cursor/deprize-production-ui-51ff` (PR #1482)  
**Subjects:** id **5** (winner → M2_COMPLETE), id **4** (NO_WINNER), id **6** (failM2 + cashOut stage 3), id **7** (M5 provider round-trip → M2_COMPLETE), id **8** (SETTLED + provider for Disburse preflight), id **9** (fresh OPEN + Running LMSR for full in-browser Privy→MetaMask QA). Registry impl upgraded to `0x82a6830F…`.

## Reference addresses (Sepolia)

| Piece | Address / value |
|---|---|
| Registry | `0x299F163705AbBFa1A8DE7670F33171730F828F3D` |
| Redeem | `0x2fec56899a1121a46b6bcba0bb924796b6ddf4f7` |
| DePrizeMint | `0xa6f9632ee9848f7c1f252da5a1e869ac90e57cc8` |
| FeeRouter | `0xbe8cbc97d4ddee28b938c0ed8245f1b5133b783a` |
| DePrize 5 LMSR | `0x9ad7705a1d0a057749b0336fd93961c3983124c0` |
| Condition | `0x9ed3f4688e33403885080d68b63fb7775a3c3adc02ebecb18b85c7e85992a5ee` |
| JB project | **254** (token `0xE9755B52Ee7e1dC499B3137Beaa57Cd0de81BbFf`) |
| Pay hook (registry-aware) | `0x99cF7c1f29c6BFAf7952501Ab8d32CF169Aa39Cb` |
| MissionCreator (fresh, not app-wide) | `0xa692eEd67c4D2C1C73DC0515240d27cf7d6fF9D1` |
| MissionTable (fresh) | `0x0AbB0DB4CffFed867C8A94893e7cFae6ee39F807` |
| **DePrize 9** (browser fixture) | id **9**, JB **256**, LMSR `0x6e1a513f3DfB6288836CacdF0a9d3496b411130C`, condition `0x7334d1e6…560d`, payhook `0xec3ba013…7E66`, teams **301/302/303**, oracle = deployer `0x3c5e…E011` |
| DePrize 9 questionId | `0xab937cdea2250786bf37ee2dd06f244bbeed62159c337927074523844d5759fb` |

UI config (`ui/const/config.ts`) wires registry / redeem / mint / fee-router. It does **not** repoint app-wide `MISSION_CREATOR_ADDRESSES` (intentional — avoids fragmenting general launchpad listing). DePrize **9** resolves its LMSR via `mint.marketOf(9)` (no config LMSR fallback needed).

---

## A. Automated suites

| ID | Check | How | Result |
|---|---|---|---|
| A1 | Forge DePrize suite | `cd subscription-contracts && forge test --match-path 'test/deprize/*'` | **PASS** — 178/178 |
| A2 | UI DePrize unit tests | `cd ui && yarn test:deprize` | **PASS** — 45/45 |
| A3 | Live ABI read harness | `cd ui && yarn verify:deprize-reads` | **PASS** — 16/16 (targets play DePrize **3** + its LMSR) |
| A4 | UI `tsc --noEmit` | `cd ui && yarn tsc --noEmit` | **PASS for DePrize paths**; 2 pre-existing BigInt errors in `cypress/e2e/free-mint.cy.ts` and `lib/hats/resolveEntityIdFromHat.ts` (unrelated) |

Covered by A1 (high value): registry lifecycle, mint bet+sweep integration, FeeRouter prize-pool vs treasury routing, redeem, disburse, LaunchPadPayHook DePrize gating.

---

## B. On-chain wiring (DePrize 5)

| ID | Check | Expected | Result |
|---|---|---|---|
| B1 | `registry.count()` | ≥ 5 | **PASS** — `5` |
| B2 | `registry.state(5)` | `OPEN` (2) | **PASS** |
| B3 | `registry.bettingOpen(5)` | `true` | **PASS** |
| B4 | `registry.isTerminal(5)` / `isRefundable(5)` | `false` / `false` | **PASS** |
| B5 | `registry.deprizeIdByJBProject(254)` | `5` | **PASS** |
| B6 | Condition unresolved | `payoutDenominator(cond)==0` | **PASS** |
| B7 | `mint.marketOf(5)` == LMSR | `0x9ad7705a…` | **PASS** |
| B8 | `feeRouter.marketOf(5)` == LMSR | same | **PASS** |
| B9 | `mint.feeRouter()` | FeeRouter | **PASS** |
| B10 | LMSR `owner()` | FeeRouter | **PASS** |
| B11 | LMSR `stage()` | Running (0) | **PASS** |
| B12 | LMSR `fee()` | 1% (`1e16`) | **PASS** |
| B13 | Pay hook `deprizeRegistry()` | Registry | **PASS** |
| B14 | Pay hook `stage(terminal, 254)` | `1` (active / cashOut disabled) | **PASS** |
| B15 | Config addresses present in `ui/const/config.ts` | mint + fee-router + registry + redeem | **PASS** |
| B16 | Docs mention FeeRouter mid-life sweep | `DEPRIZE.md` / `DEPRIZE_M4.md` | **PASS** |

---

## C. Live bettor flows (on-chain, DePrize 5)

| ID | Check | Evidence | Result |
|---|---|---|---|
| C1 | Place bet via `DePrizeMint.bet` | tx [`0xcf276270…05acb70`](https://sepolia.etherscan.io/tx/0xcf2762708606261cebd9328d9c019621f7cd1eab5e599b8499e5e40fe05acb70) — status success; JB pay “DePrize bet”; outcome tokens to bettor | **PASS** |
| C2 | 5% prize slice paid to JB project 254 | JB terminal pay logs in C1 receipt (project `0xfe` = 254) | **PASS** |
| C3 | Per-bet fee sweep → prize pool | `FeesSwept(5, amount, toPrizePool=true)` on FeeRouter in C1 receipt | **PASS** |
| C4 | Sell via LMSR `trade` (UI exit path) | tx [`0xf3bcae41…4f13db`](https://sepolia.etherscan.io/tx/0xf3bcae410922996565ba8a20cd751652ba4de94d724249693d9fba15234f13db) | **PASS** |
| C5 | Post-sell permissionless `sweepFees(5)` → prize pool | tx [`0xa3e2504e…39b30b`](https://sepolia.etherscan.io/tx/0xa3e2504e66838ea4064f96b1ce1418e9d309908be5365b581ef6fd598039b30b) — `FeesSwept` amount `20726813767665`, `toPrizePool=1` | **PASS** |
| C6 | CashOut gate while OPEN | `isRefundable(5)==false` and payhook `stage==1`; hook reverts `"DePrize is active. Refunds are disabled."` when `!isRefundable` (unit-tested in A1; prior E2E sim on this deployment) | **PASS** (view + suite; full JB cashOut UI not re-run this session) |

---

## D. Resolution / redeem / terminal fee (executed 2026-07-22)

On-chain dry-run after the initial checklist. **DePrize 4 and 5 are now terminal** (not demo-OPEN). Prefer DePrize **6** only as a failM2/cashOut fixture (no LMSR).

### D-A. DePrize 5 — winner redeem → M2_COMPLETE → treasury fees

| ID | Check | Evidence | Result |
|---|---|---|---|
| D1 | Sell leaves unswept LMSR fees | `0x19823e6f…dd23d3` — WETH on market `8.16e12` | **PASS** |
| D2 | `announceCancellation` closes betting; early `cancel` reverts; `abortCancellation` restores | announce `0xd77fab4c…`, abort `0xc94b05b0…` | **PASS** |
| D3 | FeeRouter `pause` → `resume` → `pause` | stages 1 → 0 → 1 | **PASS** |
| D4 | `lock` → `startVote` → `settleWinner(19)` | states 3 → 4 → 5; `isTerminal=false` at SETTLED | **PASS** |
| D5 | Oracle `reportPayouts([1,0,0])` + `closeMarket` | report `0xe8e3581d…`; close `0x62c22eb0…`; stage=Closed | **PASS** |
| D6 | `previewRedeem` + `redeem` (winner 1:1) | preview `4.3e16`; redeem `0xde4eb497…`; ETH +~0.043; second redeem reverts | **PASS** |
| D7 | `releaseM1` → `completeM2` | states 6 → 7; `isTerminal=true`; `isRefundable=false`; payhook stage stays `1` | **PASS** |
| D8 | Terminal `sweepFees` → **treasury** (`toPrizePool=0`) | `0x6b1daac1…` amount `8166539307672`; zero-sweep idempotent | **PASS** |
| D9 | `setProviderPayoutAddress` | Deployed registry impl `0x4610b19c…` **lacks** selector (M5 provider not upgraded on Sepolia) | **BLOCKED** (code+unit only) |

### D-B. DePrize 4 — NO_WINNER equal redeem → treasury fees

| ID | Check | Evidence | Result |
|---|---|---|---|
| D10 | Bet + sell to accrue fees | bets `0xa14dae52…` / `0x2927914a…`; fees left on market | **PASS** |
| D11 | `pause` → `lock` → `settleNoWinner` | state `10` (NO_WINNER); `isTerminal`+`isRefundable` true | **PASS** |
| D12 | `reportPayouts([1,1,1])`; second report reverts | den=3; report `0x154bd5d3…` | **PASS** |
| D13 | `closeMarket` + `redeem` equal refund | preview `1.466e16`; redeem `0xbf04bc7d…` | **PASS** |
| D14 | Terminal `sweepFees` → treasury | `0x90ac103c…` amount `3986059951335`, `toPrizePool=0` | **PASS** |
| D15 | Edges: `settleWinner` on terminal, bet when closed, `resume` after close | all revert | **PASS** |

### D-C. DePrize 6 — failM2 + cashOut re-enable (registry-aware payhook)

Fresh mission: project **255**, payhook `0x3A81E26dE71A37095C4652D65c64B67f86694a6B`, DePrize **6** (no LMSR — lifecycle/cashOut only).

| ID | Check | Evidence | Result |
|---|---|---|---|
| D16 | `setDePrizeRegistry` + register/setCondition/open | active payhook `stage=1`, `isRefundable=false` | **PASS** |
| D17 | `lock` → `settleWinner(20)` **from LOCKED** (skip vote) | state SETTLED | **PASS** |
| D18 | `reportPayouts([0,1,0])` → `releaseM1` → `failM2` | state `8` (M2_FAILED); terminal+refundable | **PASS** |
| D19 | Payhook cashOut stage re-enabled | `stage(terminal,255)=3` | **PASS** |
| D20 | Edges: `completeM2` after fail, announce on terminal, re-open, redeem with no positions | all revert / empty preview 0 | **PASS** |

### D-D. Routes coverage matrix

| Route | Exercised |
|---|---|
| FeeRouter → prize pool (live) | **Yes** — C3/C5 on id 5 (prior run) |
| FeeRouter → treasury (`M2_COMPLETE`) | **Yes** — D8 |
| FeeRouter → treasury (`NO_WINNER`) | **Yes** — D14 |
| FeeRouter → treasury (`M2_FAILED` / `CANCELLED`) | Same `isTerminal` branch as D8/D14; state `M2_FAILED` reached in D18 (no market fees left to sweep) |
| Redeem winner vector | **Yes** — D6 |
| Redeem equal (1/N) vector | **Yes** — D13 |
| Registry: cancel announce/abort + early cancel revert | **Yes** — D2 (`cancel()` after 7d notice not waited — unit-tested in A1) |
| Registry: vote path + skip-vote settle | **Yes** — D4 / D17 |
| Registry: `completeM2` + `failM2` | **Yes** — D7 / D18 |
| Payhook cashOut disabled (active) / enabled (refundable) | **Yes** — stage 1 then 3 on id 6 |
| `setProviderPayoutAddress` / M5 provider disburse on-chain | **Yes** — D9 / D23 below |

### D-E. M5 registry upgrade + provider + disburse (executed after initial D matrix)

| ID | Check | Evidence | Result |
|---|---|---|---|
| D9 | UUPS upgrade to M5 impl | New impl `0x82a6830F4E0752b971bEE6815027774caaB6F0f5` on proxy `0x299F…8F3D`; selectors present; states 5/6 preserved | **PASS** |
| D23 | `setProviderPayoutAddress` round-trip (DePrize **7**) | set at SETTLED → `0x3c5e…`; update at M1_RELEASED → `0x679d…`; before-settle / zero / after-M2_COMPLETE revert | **PASS** |
| D24 | `DePrizeDisburse` M1 preflight (DePrize **8**, provider set) | Script prints Safe txs: ETH to provider + `releaseM1(8)`; `DEPRIZE_PRIZE_WEI=0` → `ZeroPrize()` | **PASS** |

| ID | Check | Result |
|---|---|---|
| D21 | Admin panel UI | **MANUAL** |
| D22 | Full 7-day `cancel()` → CANCELLED | **SKIP** (wall-clock); announce/abort/early-revert **PASS**; unit suite **PASS** |

---

## E. UI / browser

Pixel/Privy click-through still needs a human (or a Playwright MCP + test wallet). Headless static + unit coverage below shrinks that list.

### E-headless (static wiring + units — executed)

| ID | Check | Result |
|---|---|---|
| E1 | Index Live / Former tab wiring (`DePrizeIndexContent` buckets `live`/`closed`) | **PASS** (static) |
| E3 | Badge reconciliation | **PASS** (A2 unit) |
| E4 | Geo-gate: detail `bettingAllowed` requires `!region.isRestricted`; index `handleBet` no-ops when restricted; both render restricted banners; `/api/geo/country` sets `restricted` via `isEUCountry` | **PASS** (static) |
| E5a | BetModal links `DEPRIZE_TERMS_URL`; local draft at `ui/docs/DEPRIZE_TERMS_AND_CONDITIONS.md` | **PASS** (static) |
| E5b | Published Terms URL returns 200 | **FAIL** — `https://docs.moondao.com/Legal/DePrize-Terms-and-Conditions` → **404** (draft not published yet) |
| E6 | Bet path | **PASS** on-chain (C1) + quote units (A2) |
| E7 | Exit → `sweepFees` | **PASS** static (`ExitPositionModal`) + on-chain (C4–C5) |
| E8 | ClaimPanel hidden until `shouldSurfaceResolution` (requires `ctfResolved` + registry/market gate); `if (!resolved) return null` | **PASS** (static + A2 lifecycle units) |

### E-browser (local Playwright on `NEXT_PUBLIC_CHAIN=sepolia` + BrowserStack Live)

Ran 2026-07-22 against `http://localhost:3000` (PR branch). Screenshots under `.cursor/artifacts/deprize-browser-qa/`. BrowserStack Live also opened for desktop (prod URL) and iPhone 15 Pro — **prod `/deprize` currently 404s** (feature not deployed).

| ID | Check | Result |
|---|---|---|
| E1 | Index Live / Former tabs clickable | **PASS** (Playwright + screenshot `01`/`02`) |
| E2 | Detail `/deprize/3` renders odds, providers, status badge | **PASS** — badge **Open · paused** (play LMSR paused); prize pool + Teams #201–203 visible (`03-detail-3.png`) |
| E4 | Geo banner | **PASS** (not shown — unrestricted geo); wiring already static-verified |
| E5a | BetModal DePrize Terms link | **BLOCKED in UI** — “Back this team” disabled while market paused / no wallet; link still present in `BetModal.tsx` (static) |
| E5b | Published Terms URL | **FAIL** — HTTP **404** |
| E8 | ClaimPanel absent on OPEN unresolved | **PASS** (no claim panel on id 3) |
| E9 | Mobile layout (iPhone 14 viewport) | **PASS** — renders; no horizontal overflow (`06`/`07`) |
| E10 | Terminal detail `/deprize/5` | **PASS** — loads as Delivered / M2_COMPLETE (`05-detail-5-terminal.png`) |
| E21 | Admin panel without owner wallet | **PASS** — not shown (expected) |

**Wallet note (updated):** Privy → MetaMask works under headed dappwright (`TEST_PARALLEL_INDEX=0`, `headless: false`). Import `$PRIVATE_KEY`, complete **Connect** then **Confirm** (SIWE). See section **G**.

---

## G. Fresh Running LMSR + full in-browser QA (DePrize 9)

Provisioned 2026-07-22 on Sepolia: new mission (JB **256** via `MissionCreator` `0xa692…`), CTF condition + LMSR (0.03 ETH funding), `register`/`setCondition`/`open`, `mint.setMarket` + `feeRouter.setMarket`, LMSR ownership → FeeRouter. State **OPEN (2)**, LMSR **Running (0)**.

| ID | Check | Result |
|---|---|---|
| G1 | Index Live lists `#9` | **PASS** |
| G2 | Detail `/deprize/9` — Open (not paused), teams 301–303, equal ~33% odds | **PASS** |
| G3 | Privy Sign in → Continue with a wallet → MetaMask Connect + SIWE Confirm | **PASS** — header `0x3c5e…E011` |
| G4 | BetModal opens; empty amount CTA disabled | **PASS** |
| G5 | DePrize Terms link in BetModal | **PASS** href; published URL still **404** (E5b) |
| G6 | UI bet (0.004 ETH) + MetaMask Confirm → position / Cash out CTA | **PASS** (`d01-bet-done.png`) |
| G7 | On-chain bet via mint (0.005 ETH) + fee sweep to prize pool | **PASS** — tx `0xf5f66804…` |
| G8 | ExitPositionModal cash out in browser | **PASS** — Cash out ≈ 0.0094 ETH confirmed in MM |
| G9 | `feeRouter.pauseMarket(9)` → UI shows paused / no Back CTA | **PASS** |
| G10 | `feeRouter.resumeMarket(9)` → Back CTA returns | **PASS** |
| G11 | Former tab excludes live `#9`; Live still shows it | **PASS** |
| G12 | Mobile viewport no horizontal overflow | **PASS** |

Screenshots: `.cursor/artifacts/deprize-browser-qa/` (`b0*`, `c0*`, `d0*`). Fixture env: `/tmp/deprize_deploy.env` (`DPID9`, `MKT9`, `CID9`, `QID9`, `PAYHOOK9`).

---

## F. Negative / safety spot-checks

| ID | Check | Result |
|---|---|---|
| F1 | Unknown registry id: `state(999999)==NONE`, `getDePrize` reverts | **PASS** (A3) |
| F2 | Bet when market unset / not OPEN reverts | **PASS** (A1 + D15) |
| F3 | Sweep on terminal routes to treasury not JB | **PASS** on-chain (D8, D14) + A1 |
| F4 | App-wide MissionCreator still production Sepolia address (not fresh test creator) | **PASS** by design — DePrize UI does not depend on it |
| F5 | Double `reportPayouts` / double `redeem` / resume-after-close | **PASS** (D12, D6, D15) |

---

## Summary

| Bucket | Pass | Skip / manual / blocked |
|---|---|---|
| Automated (A) | A1–A4 | — |
| Wiring (B) | B1–B16 | — |
| Live bettor (C) | C1–C6 | — |
| Resolve/redeem/terminal/M5 (D) | D1–D9, D10–D20, D23–D24, F5 | D21 manual; D22 7d cancel wall-clock |
| UI headless + browser (E) | E1–E4, E8–E10, E21, E6–E7 (chain) | E5b Terms **404**; prod `/deprize` 404 until deploy |
| Fresh Running + in-browser (G) | G1–G12 | G5 published Terms still 404 |

**Verdict:** Phase 2 is green on Sepolia including M5 upgrade and a full in-browser Privy→MetaMask path on fresh DePrize **9** (bet, cash out, pause/resume, Live/Former). Remaining gaps: publish DePrize Terms (404), deploy `/deprize` to prod, and the 7-day full `cancel()`.

### Quick re-run commands

```bash
# Contracts
cd subscription-contracts && forge test --match-path 'test/deprize/*'

# UI units + ABI smoke
cd ui && yarn test:deprize && yarn verify:deprize-reads

# Live bettor smoke (needs DEPLOYER_PK + funded Sepolia ETH)
# source /tmp/deprize_deploy.env  # or recreate from table above
# cast send $DEPRIZE_MINT "bet(uint256,uint256,uint256,uint256)" 5 0 $QTY $MAXCOST \
#   --value ${VALUE}wei --private-key $PK --rpc-url $SEPOLIA_RPC
```
