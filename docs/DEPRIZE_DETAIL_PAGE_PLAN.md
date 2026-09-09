# DePrize detail page — implementation plan

Target: `ui/pages/deprize/[id].tsx` (the individual prize page, e.g. `/deprize/1` on
Arbitrum, `/deprize/22` or `/deprize/shared-next-landing` on Sepolia).

This document is written so that an implementer with no prior context can execute it
step by step. Read **§0 Context**, **§1 Ground rules** and **Phase 0** fully before
touching code. All work targets a real on-chain prize (Sepolia DePrize #22) — there is
no mock page. Work through the phases in order; each phase is independently shippable
as its own PR.

---

## 0. Context you must understand first

### 0.1 The two pots of money (this is the #1 source of user confusion)

A DePrize has **two completely separate pools**. Never mix them in copy or math.

| Pot | Where it lives | Funded by | Paid to | UI today |
|---|---|---|---|---|
| **Prize pool** | Juicebox (JB) project `deprize.jbProjectId` | 5% "slice" of every bet + the LMSR's 1% trade fees (routed by `DePrizeFeeRouter`) | The **winning team/provider** at settlement (`docs/DEPRIZE.md` §Settlement). Bettors never receive it. | Header stat "Prize pool" = `useTotalFunding(jbProjectId)` |
| **Betting market collateral** | Gnosis CTF + `LMSRWithTWAP` market | LMSR seed funding + 95% of every bet | **Bettors**: each outcome token redeems for exactly **1 ETH** if its outcome wins (payout vector), or pro-rata on refund/no-winner | Team card line "If wins · X ETH" = `outcome.balance` (token count) |

So "Prize pool 0.0008 ETH" and "If wins 0.0093 ETH" are unrelated numbers. The second
is the bettor's own payout from the market and will normally be much larger than the
first.

### 0.2 How a bet flows (needed for events work)

`DePrizeMint.bet(deprizeId, outcomeIndex, outcomeTokenAmount, maxCost)` (payable):

1. Splits `msg.value` into `slice` (5%, paid to JB with the bettor as beneficiary) and
   `budget` (95%).
2. Prices the trade on the LMSR: `cost = calcNetCost + calcMarketFee`.
3. Buys outcome tokens, forwards them to the bettor, refunds `budget - cost`.
4. Emits `Bet(uint256 indexed deprizeId, address indexed bettor, uint256 outcomeIndex, uint256 outcomeTokenAmount, uint256 cost, uint256 slice)`.

Therefore per bet: **total the bettor actually spent = `cost + slice`**.

Cash-outs (sells) do **not** go through the Mint. They call the LMSR directly
(`ExitPositionModal`). The LMSR emits
`AMMOutcomeTokenTrade(address indexed transactor, int256[] outcomeTokenAmounts, int256 outcomeTokenNetCost, uint256 marketFees)`
for **every** trade, buys and sells. For buys routed through the Mint, `transactor` is
the **Mint contract**, not the bettor — so use `Bet` events for "who bet", and
`AMMOutcomeTokenTrade` for "how did prices move" and for a user's **sells**
(`transactor == user`, amounts negative).

### 0.3 LMSR price math (needed for the chart rebuild)

Marginal price of outcome `i` (Gnosis LMSR):

```
b      = funding / ln(n)                       // n = number of outcomes
q_i    = net outcome tokens sold for i          // cumulative sum of outcomeTokenAmounts[i] over all trades
p_i    = exp(q_i / b) / Σ_j exp(q_j / b)        // in [0,1]; ×100 for percent
```

`funding` is the LMSR's `funding()` (wei, 18 decimals). `q_i` starts at 0 for every
outcome when the market opens (uniform prior `1/n`). `funding` can change via
`AMMFundingChanged(int fundingChange)`; include it if present.

Use the stable form `p_i = 1 / Σ_j exp((q_j - q_i) / b)` to avoid overflow.

### 0.4 Key existing files

| Concern | File |
|---|---|
| The page | `ui/pages/deprize/[id].tsx` |
| Team row | `ui/components/deprize/DePrizeTeamCard.tsx` |
| Odds chart (Recharts) | `ui/components/deprize/OddsHistoryChart.tsx` |
| Chart domain/padding math (pure) | `ui/lib/deprize/odds-chart.ts` |
| Market hook (prices, balances, odds history, poll) | `ui/lib/deprize/useDePrizeMarket.tsx` |
| Registry hook (`deprize` struct) | `ui/lib/deprize/useDePrize.tsx` |
| Constants (`UNIT`, `OUTCOME_COLORS`, `ODDS_*`, `MarketStage`) | `ui/lib/deprize/constants.ts` |
| Read client, rate-limited `rpcRead` | `ui/lib/deprize/read.ts` |
| Bet quote math (pure) | `ui/lib/deprize/quote-math.ts`; on-chain quote `quoteQtyForBudget` in `ui/lib/deprize/quote.ts` |
| Status copy, `formatBettingCloses` | `ui/lib/deprize/status.ts` |
| Formatting (`fmt`, `fmtPrizeEth`, `toEth`) | `ui/lib/deprize/format.ts` |
| ETH + USD display | `ui/components/deprize/EthUsd.tsx` |
| Competition metadata / race bindings | `ui/lib/deprize/competitions.ts` |
| Atlas goal (criteria, description) | `ui/lib/lunar-atlas` → `sharedGoalById(SEED_ATLAS, id)`; type `SharedGoal` with `criteria?: CapabilityCriterion[]` in `ui/lib/lunar-atlas/types.ts` |
| Planned-race page that already renders criteria | `ui/components/deprize/GoalDePrizeDetail.tsx` (lines ~217–235) |
| Addresses | `ui/const/config.ts`: `DEPRIZE_REGISTRY_ADDRESSES`, `DEPRIZE_MINT_ADDRESSES`, `LMSR_WITH_TWAP_ADDRESSES` |
| ABIs | `ui/const/abis/DePrizeMint.json`, `ui/const/abis/LMSRWithTWAP.json`, `ui/const/abis/DePrizeRegistry.json` |
| Moon Base Zero (the 3D simulation) | `ui/pages/moonbase/index.tsx`, `ui/pages/moonbase/[projectId].tsx`, `ui/components/lunar-atlas/SharedGoalPanel.tsx` |
| Existing examples that already sort by probability | `ui/components/deprize/RaceMarketCard.tsx` (`ranked`), `ui/components/deprize/LiveDePrizeHero.tsx` |
| Unit tests (mocha, no browser) | `ui/cypress/integration/lib/deprize/*.cy.ts`, run with `yarn test:deprize` |

---

## 1. Ground rules

- Work in `ui/` only. Yarn, not npm. Next.js Pages Router, TypeScript strict.
- **Reads** go through `rpcRead({ contract, method, params })` from `lib/deprize/read.ts`
  with `getContract({ client: deprizeReadClient, chain: deprizeReadChain(chain.id), address, abi })`.
  Never call `readContract` directly from thirdweb in new code — `rpcRead` is rate-limit
  aware.
- Never pass a `bigint` into `useRead`/hook param objects that get `JSON.stringify`'d
  (see comment near `jbProjectId` in the page). Convert to `Number` or `string` first.
- Pure logic (math, sorting, aggregation) goes in `ui/lib/deprize/*.ts` with **no React
  and no thirdweb imports**, so it can be unit-tested with `yarn test:deprize`.
- Every new pure module gets a `ui/cypress/integration/lib/deprize/<name>.cy.ts` mocha
  spec. Copy the shape of `odds-chart.cy.ts`.
- Do not touch `deprize-play.tsx` (legacy harness), `mockMarket.ts`, or `DemoBetModal`.
- Keep the visual language: cards are
  `p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 backdrop-blur-xl border border-white/[0.08] shadow-lg`.
  Labels are `text-xs text-gray-400`, values `text-sm font-semibold text-white`.
- Before opening a PR: `cd ui && yarn lint && npx tsc --noEmit && yarn test:deprize`.
  Then run the page locally against Sepolia (`/deprize/22`) with a wallet that has a
  position, and against Arbitrum (`/deprize/1`) read-only.
- Keep each phase a separate PR. Do not refactor unrelated code.

---

## Phase 0 — The real Sepolia prize (already live) and how to launch / re-provision

Nothing in this plan is built against a mock. The page to develop and QA against is a
**real, complete on-chain prize on Sepolia**: DePrize **#22 "Touchdown"**. It was
provisioned by `ui/scripts/provision-sepolia-prize.ts` from the `$PRIVATE_KEY` wallet
(the DePrize deployer/owner `0x3c5e…E011`) and merged to `main` in
[PR #1566](https://github.com/Official-MoonDao/MoonDAO/pull/1566).

### 0.1 Facts for DePrize #22 (copy these, do not re-derive)

| Item | Value |
|---|---|
| Chain | Sepolia (11155111) |
| DePrize id | **22** (state OPEN, betting open) |
| Shareable URL path | `/deprize/shared-next-landing` (resolves to #22); `/deprize/22` also works |
| Race binding | `shared-next-landing` (Moon Base Zero "next Qualifying Landing") |
| Juicebox project | **268** (mission 14), payhook `0xD6597D665cbC74e4Da52da6af34900897A24307B` |
| LMSR market | `0x9d3b999B347c6F9dc6cB314707397A4B505826D0` (6 outcomes, 1% fee, 0.06 ETH funding) |
| CTF condition | `0xb1c4d8775e08aabcaed68cb17645aec155a22ce35316d640a3233679dbecfa66` |
| Question id | `keccak256("deprize:sepolia:shared-next-landing:v2")` = `0x1ba1808c0a0d8a2bbc48462cd3a490e306695713e0cafd362d365c9db3f43513` |
| Team NFT ids (outcome order) | 601 Astrobotic Griffin · 602 Intuitive Machines · 603 Firefly Blue Ghost · 604 Blue Origin Blue Moon MK1 · 605 CNSA Chang'e-7 · 24 Open Field |
| Registry / Mint / FeeRouter | `0x299F163705AbBFa1A8DE7670F33171730F828F3D` / `0xa6f9632ee9848f7c1f252da5a1e869ac90e57cc8` / `0xbe8cbc97d4ddee28b938c0ed8245f1b5133b783a` |
| Existing on-chain activity | one 0.004 ETH bet on outcome 0, tx `0x3c35a1dbe32a7e35877691c48509f7e39979f7b1faf1ac1c438c8369e742364a` |
| Superseded generation | #21 (synthetic JB id, **not** a real prize — never link to it as the live page) |

### 0.2 Launch checklist (make the real page reachable and share it)

1. **Verify chain state** (read-only, no key needed) from `subscription-contracts/`:
   ```bash
   DEPRIZE_REGISTRY=0x299F163705AbBFa1A8DE7670F33171730F828F3D \
   DEPRIZE_MINT=0xa6f9632ee9848f7c1f252da5a1e869ac90e57cc8 \
   DEPRIZE_FEE_ROUTER=0xbe8cbc97d4ddee28b938c0ed8245f1b5133b783a \
   DEPRIZE_ID=22 DEPRIZE_MARKET=0x9d3b999B347c6F9dc6cB314707397A4B505826D0 \
   DEPRIZE_PAYHOOK=0xD6597D665cbC74e4Da52da6af34900897A24307B \
   forge script script/deprize/DePrizeVerify.s.sol --rpc-url https://ethereum-sepolia-rpc.publicnode.com
   ```
   Expect: state OPEN, bettingOpen true, `mint.marketOf(22)` = the LMSR, LMSR owner =
   FeeRouter, stage Running, fee 1%.
2. **Verify the app binding**: `ui/lib/deprize/competitions.ts` has `22` under `sepolia`
   with `supersedes: 21`, and `21` has `supersededBy: 22`. `yarn test:deprize` passes.
3. **Run locally as a testnet build** and open the real page:
   ```bash
   cd ui && NEXT_PUBLIC_CHAIN=testnet yarn dev
   # http://localhost:3000/deprize/shared-next-landing
   ```
   The app is a testnet build whenever `NEXT_PUBLIC_CHAIN !== 'mainnet'`; the header
   chain selector must be on Sepolia. Confirm title "Touchdown", six competitors with
   real names/logos, odds ≈ 26/15/15/15/15/15 (until more bets land), prize pool > 0.
4. **Find or create the public testnet URL.** Production (`moondao.com`) is a
   `NEXT_PUBLIC_CHAIN=mainnet` build and shows Arbitrum prizes. The Sepolia page must be
   shared from a deployment built with `NEXT_PUBLIC_CHAIN=testnet` (CI already uses this
   value, see `.github/workflows/ci.yml`). Check the Vercel project for an existing
   testnet/preview environment; if none exists, add a Vercel preview environment for
   `main` with `NEXT_PUBLIC_CHAIN=testnet` and the same secrets as production. Record the
   resulting URL in `docs/DEPRIZE_QA.md` under DePrize 22. **Ask Pablo which URL is the
   share target before publishing it anywhere.**
5. **Smoke the public URL** with a wallet holding Sepolia ETH: place one small bet
   (0.001–0.005 ETH) through the UI, confirm the odds move and the prize pool ticks up
   (5% of the bet), then cash out part of it. This also seeds real trades for the chart
   work in Phase 3.
6. **Share** `<testnet-url>/deprize/shared-next-landing`. Tell testers they need Sepolia
   ETH (faucet links: https://sepoliafaucet.com, https://www.alchemy.com/faucets/ethereum-sepolia)
   and that betting is geo-gated (restricted regions can view and cash out only).

### 0.3 The `$PRIVATE_KEY` wallet

- `PRIVATE_KEY` is present in the shell environment on Pablo's machine. It is the
  **owner** of the Sepolia DePrize registry, mint and fee router, and the oracle for the
  CTF conditions. Only this wallet can `register`, `open`, `setCondition`, `setMarket`,
  and later resolve. Never print it, never commit it, never write it to a file.
- Check its Sepolia balance before any provisioning (needs ≥ 0.1 ETH: 0.06 LMSR funding
  for a 6-outcome prize + gas):
  ```bash
  cast balance --ether $(cast wallet address --private-key $PRIVATE_KEY) --rpc-url https://ethereum-sepolia-rpc.publicnode.com
  ```
- The provisioning script reads `DEPLOYER_PK` **or** `PRIVATE_KEY`; nothing else is
  needed for auth.

### 0.4 Provisioning another real prize (only when a new race or generation is needed)

Do **not** re-run the script for Touchdown v2 — the CTF condition already exists and
`prepareCondition` will revert, and a second registration would create a duplicate
prize. Provision only when: (a) a new race is going live (e.g. Night Shift → expected
id **23**, see `docs/DEPRIZE_QA.md`), or (b) a roster change requires a new generation
(then bump `questionVersion` to `v3` and set `supersedes`/`supersededBy` in
`competitions.ts`).

Steps, all from `ui/`:

1. Add or edit the `PrizeSpec` in `scripts/provision-sepolia-prize.ts` (`PRIZES` map):
   `slug` = the atlas shared-goal id, `questionVersion`, `title`, `tagline`,
   `metaDescription`, `teamIds` (real MoonDAO Team NFT ids — verify each exists with
   `TeamABI.ownerOf`; a missing NFT makes the page show `Team #NNN` and is what made
   #21 fake), `tokenName`, `tokenSymbol`.
2. Use a non-Infura RPC to avoid 429s during the ~15 transactions:
   ```bash
   SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com \
   PRIZE=<key> yarn tsx --tsconfig tsconfig.json scripts/provision-sepolia-prize.ts
   ```
   The script is idempotent per step (it re-reads registry `count()`, `marketOf`, etc.);
   if it dies mid-way, re-run it with the same `PRIZE`. It writes
   `/tmp/sepolia-prize.json` and prints the `competitions.ts` block to paste.
3. Bind in `lib/deprize/competitions.ts` (paste the printed block; add `sharedGoalId`,
   `raceLabel`, `outcomes[]` with atlas `projectId`s in **the same order as `teamIds`**,
   Open Field last with `field: true`). If it is a new generation, set `supersededBy`
   on the old id and `supersedes` on the new one.
4. Update `cypress/integration/lib/deprize/competitions.cy.ts` and
   `cypress/integration/unit/lunar-atlas-deprize.cy.ts` (ids, `findDePrizeIdForGoal`,
   `partitionDePrizeIndexByRace`). Run `yarn test:deprize`.
5. Run the Forge verify (§0.2 step 1) with the new ids/addresses.
6. Place one real smoke bet through the UI. Record everything (ids, addresses, tx) in
   `docs/DEPRIZE_QA.md`.
7. Open a PR; CI runs the component tests on `NEXT_PUBLIC_CHAIN=testnet`.

---

## Phase 1 — Cut list, then UI-only fixes (no new data)

Ships: the deletions below, ranking (feedback #5), honest labels (#6), criteria above the
fold (#1).

### 1.0 Cut list — delete before adding anything

Rule: every element must either let the user **act** (bet, cash out, claim, navigate) or
**decide** (odds, money, deadline, who). Explanations of how the system works, restated
information, internal identifiers and decorative badges go. Below, every element on the
page today and the verdict. Items marked **CUT** are deleted in this phase; **MOVE**
means it relocates as part of §1.3/§4; **KEEP** stays.

**Header card**

| Element | Verdict | Why / how |
|---|---|---|
| `DePrize #22 — Touchdown` as the h1 | **CHANGE** | h1 becomes `Touchdown`. Render `#22` as `text-xs font-mono text-gray-500` after it (support/QA still needs the id). For unknown competitions keep `DePrize #N`. |
| `StateBadge` | **CUT when normal** | Render only if `statusLabelOverride` is set or `deprize.state !== OPEN`. "Open" next to "Betting closes <date>" says nothing. |
| `Generation N` chip | **CUT** | Lineage is one line at the bottom (§1.0 "Lineage" below). |
| `← All prizes` | KEEP | Navigation. |
| Stat `Prize pool` | KEEP, relabel (§1.2) | Decision input. |
| Stat `Providers` | **CUT** | It is `teamIds.length`; the competitor list already shows it. |
| Stat `Betting closes` | KEEP | Deadline. |
| Winner banner / no-winner banner | KEEP | Only renders when resolved; drives Claim. |

**Notices**

| Element | Verdict | Why / how |
|---|---|---|
| Cancellation-pending notice | KEEP, shorten | `Cancellation announced — bets paused for 7 days; if it goes through, everyone is refunded.` |
| `market.error` notice | KEEP, shorten | `Couldn't load market data — reload.` |
| Region-restricted notice | KEEP, shorten | `Betting isn't available in your region. You can view odds, cash out and claim.` |
| `Connect a wallet to back a team, cash out, or claim.` card + button | **CUT** | Every `Back this team` button becomes the connect entry point: in `DePrizeTeamCard`, when `!userConnected` render the button **enabled** with label `Connect to back` and have the page's `onBet` call `login()` when there is no `userAddress`. Remove `disabled={!userConnected}`. |

**Predictions card**

| Element | Verdict | Why / how |
|---|---|---|
| Title `Predictions` | **CHANGE** | `Odds`. |
| Subtitle `Implied chance since the market opened (date)` | **CUT** | The X axis shows the dates. |
| Legend chips (`● Name · 26%`) | **CUT** | The ranked competitor cards directly below are the legend once colors are unified: in the page compute `outcomeColor(index)` with exactly the rule the card uses (`isField → OUTCOME_COLORS[i]`, `claimed → orgColor(org)`, else `#9ca3af`) and pass that array as `colors` to `OddsHistoryChart`. Tooltip on the chart still names the line. |
| Empty state copy `Odds history will plot here as the market moves. Samples persist across visits, so the line grows from market open to now.` | **CUT** | Replace with `No trades yet.` — the old text explains the implementation. |

**Competitors**

| Element | Verdict | Why / how |
|---|---|---|
| `Competitors` heading | KEEP | Section anchor; no caption. |
| `Official participant` / `Unofficial — not confirmed` legend row | **CUT** | Replace the encoding: remove the colored left bar (`participation` stripe) from the card entirely; render a small `Unconfirmed` chip (`text-[10px] uppercase border border-zinc-500/40 text-zinc-300 rounded-full px-2`) next to the name **only** on unofficial cards, with `title="Listed by MoonDAO; this organization has not confirmed participation."` Official is the default and gets no marker. |
| Big `NN%` + `chance` | KEEP | One word; without it "26%" is ambiguous to a newcomer. |
| Team avatar + name link | KEEP | Links to the simulation. |
| Field subtitle `Any qualifying entrant not listed above` + long tooltip | **SHORTEN** | `Any other team`. Drop the tooltip about the Senate/admin Safe. |
| `Withdrawn — you can still sell your position` | KEEP, shorten | `Withdrawn — sell only`. |
| `If wins · X` line | KEEP in Phase 1, **CUT in Phase 2** | Once the Your-position panel exists (§2.5) all holdings info lives there; the card goes back to `%` · name · button only. |
| Holdings block (`Cash out ~X (+pnl)` + button) | KEEP in Phase 1, **CUT in Phase 2** | Same reason. |
| `Back this team` / `Back the field` | KEEP | Primary action. |

**Description card (bottom)**

| Element | Verdict | Why / how |
|---|---|---|
| `competition.tagline` | **MOVE** | To the question card (§1.3). |
| `effectiveDescription` | **CUT when normal** | For a healthy OPEN market it is boilerplate ("Accepting bets…"). Render `bettingBlockedReason` **only when set**, as an amber `Notice` directly under the header (it is actionable: paused / no market / cancelling). Never render `DEPRIZE_STATE_META[...].description`. |
| SUPERSEDED paragraph (3 sentences) | **SHORTEN** | `Superseded by DePrize #23 — new bets happen there. You can still sell here.` with the link. |
| `Continues from generation N (DePrize #21). Legacy positions remain sellable there until the race settles.` | **SHORTEN** | `Continues from #21` (link). Nothing else. Together with the SUPERSEDED line this is the whole "Lineage" content; render both as `text-xs text-gray-500` at the very bottom. |
| `ROSTER_DISCLAIMER` | KEEP as footnote | Legal wording; keep the text, render it `text-[11px] text-gray-600` as the last line of the page. Do not rewrite it without legal sign-off. |

**Other**

| Element | Verdict | Why / how |
|---|---|---|
| `ClaimPanel` | KEEP | Only when resolved. |
| `DePrizeAdminPanel` | KEEP | Already returns `null` for non-admins. |
| `NoticeFooter` | KEEP | Global layout. |
| Anything proposed elsewhere in this plan that *explains* the system (a "How money moves" block, a three-step strip, chart captions like "each dot is a trade") | **DO NOT BUILD** | Use labels and `title` tooltips only. If a label needs a paragraph to be understood, the label is wrong. |

Also audit `BetModal` and `ExitPositionModal` copy with the same rule when you touch
them; anything that says "this is how the market works" goes, anything that says "you
pay X and get Y" stays.

### 1.1 Rank competitors by chance, Open Field pinned last

**File:** `ui/pages/deprize/[id].tsx`

1. Add a pure helper in a new file `ui/lib/deprize/rank-outcomes.ts`:

   ```ts
   export type RankableOutcome = { index: number; probability: number }

   /**
    * Order outcomes for display: highest implied chance first. Ties (and NaN)
    * keep registry order. Outcomes flagged `isField` (Open Field) are always
    * pinned to the end regardless of chance. When `winningIndex` is provided
    * (market resolved), that outcome is moved to the very top.
    */
   export function rankOutcomes<T extends RankableOutcome>(
     outcomes: T[],
     opts: { isField: (index: number) => boolean; winningIndex?: number },
   ): T[] {
     const score = (o: T) => (Number.isFinite(o.probability) ? o.probability : -1)
     return [...outcomes].sort((a, b) => {
       if (opts.winningIndex !== undefined) {
         if (a.index === opts.winningIndex) return -1
         if (b.index === opts.winningIndex) return 1
       }
       const af = opts.isField(a.index), bf = opts.isField(b.index)
       if (af !== bf) return af ? 1 : -1
       const d = score(b) - score(a)
       return d !== 0 ? d : a.index - b.index
     })
   }
   ```

2. Unit test `ui/cypress/integration/lib/deprize/rank-outcomes.cy.ts`: descending order;
   ties keep index order; NaN sinks below numbers but above field; field always last even
   with 90% chance; winner first when `winningIndex` set.

3. In the page, right after `predictionLabels` is computed, add:

   ```ts
   const rankedOutcomes = useMemo(
     () =>
       rankOutcomes(market.outcomes, {
         isField: (i) => !!raceBinding?.outcomes[i]?.field,
         winningIndex: showResolved && market.winningIndex >= 0 ? market.winningIndex : undefined,
       }),
     [market.outcomes, raceBinding, showResolved, market.winningIndex],
   )
   ```

   Replace **both** `market.outcomes.map(...)` calls in the JSX (the Predictions legend
   and the Competitors list) with `rankedOutcomes.map(...)`. Everything inside the map
   already uses `o.index`, so team ids, colors, anchors (`deprize-outcome-${o.index}`)
   and the `?outcome=N` deep link keep working. Do **not** reorder `market.outcomes`
   itself — indices must stay aligned with the contract.

4. No caption. The order speaks for itself.

### 1.2 Honest labels for the two pots

**Files:** `ui/pages/deprize/[id].tsx`, `ui/components/deprize/DePrizeTeamCard.tsx`

1. Header stat: change `label="Prize pool"` to `label="Prize pool · to winner"` and add
   `title="Paid to the winning team when the race settles. This is separate from what bettors win — bettor payouts come from the betting market."`
   (The `Stat` component already accepts `title`.)

2. Team card `showWinSubtitle` block: change copy from `If wins ·` to
   `Your payout if wins ·` and wrap the `<p>` with
   `title="Each share you hold pays 1 ETH if this team is selected as the winner. Paid from the betting market, not from the prize pool."`

3. Nothing else. No explainer block — the two labels plus their tooltips are the whole
   fix. If the confusion persists in testing, the fix is a better label, not more text.

### 1.3 Criteria and description above the fold

**File:** `ui/pages/deprize/[id].tsx`

1. Resolve the atlas goal for the live race (not just for slugs):

   ```ts
   const raceGoal = raceBinding ? sharedGoalById(SEED_ATLAS, raceBinding.sharedGoalId) : undefined
   ```

   `DePrizeRaceBinding.sharedGoalId` is the field (`lib/deprize/competitions.ts` line ~54).

2. Create `ui/components/deprize/DePrizeQuestionCard.tsx`:

   Props: `{ tagline: string; description?: string; criteria?: CapabilityCriterion[]; closesLabel?: string; moonbaseHref?: string }`.

   Layout (one card, same card classes):
   - Line 1, `text-white text-base font-semibold`: the tagline (this is the market's
     question, e.g. "Which company lands on the Moon next?").
   - Line 2, `text-gray-400 text-sm`: `description` if provided.
   - "What counts as winning" — `<ol>` of `criteria` items, each `text-sm text-gray-300`
     with the criterion `title` bold and its `description` after. Reuse the exact
     markup from `GoalDePrizeDetail.tsx` lines ~217–235 so both pages look identical.
     On screens `< sm`, render inside `<details>` with summary
     `What counts as winning (N criteria)`, open by default on `sm+` (use two renders
     guarded by `hidden sm:block` / `sm:hidden`).
   - Footer row: if `moonbaseHref`, a link `See this race on Moon Base Zero →`. (The
     closing date already sits in the header stats; do not repeat it here.)

3. Mount it in the page **immediately after the header card and before Predictions**.
   Pass `tagline={competition.tagline}`, `description={raceGoal?.description}`,
   `criteria={raceGoal?.criteria}`,
   `moonbaseHref={raceGoal ? `/moonbase?race=${raceGoal.id}` : undefined}`.
   Drop the `closesLabel` prop from the component if you find it unused.

4. The old bottom "Description" card becomes the "Lineage" footer described in §1.0:
   only the shortened SUPERSEDED / "Continues from" line(s) and the `ROSTER_DISCLAIMER`
   footnote. `competition.tagline` moves up; `effectiveDescription` is gone (its
   actionable variant `bettingBlockedReason` renders as a Notice under the header).

5. Header stats grid after Phase 1 has two stats (`Prize pool · to winner`,
   `Betting closes`); Phase 2 grows it to four.

### 1.4 Acceptance for Phase 1

- Every **CUT** row in §1.0 is gone; every **SHORTEN** row uses the new copy.
- Competitors appear highest chance first; Open Field is last even if it has the highest
  chance; on a resolved market the winner is first.
- Chart line colors match the card accent colors one-to-one; there is no legend.
- Clicking `Connect to back` while logged out opens the Privy login.
- Above the fold on a 1280×800 laptop: title, two stats, the question, the criteria list,
  and the top of the odds chart.
- Hovering "Prize pool · to winner" and "Your payout if wins" shows the explanatory
  tooltips.
- `yarn test:deprize` passes with the new `rank-outcomes.cy.ts`.

---

## Phase 2 — On-chain events layer, backers stat, "Your position" panel

Ships: backers metric (#2), personal activity with P/L (#3). Also replaces the fragile
localStorage cost basis.

> **Implementation note (what actually shipped).** The app's RPC proxy caps `eth_getLogs`
> at 10,000 blocks per call, which makes scanning from the registry deploy block
> impractical (Arbitrum is ~25M blocks). Events are therefore served by
> `pages/api/deprize/logs.ts`, a thin proxy over the Etherscan V2 `logs/getLogs` API
> (one key, every chain, timestamps included). It reads `ETHERSCAN_API_KEY`
> (falling back to `NEXT_PUBLIC_ETHERSCAN_API_KEY` / `ARBISCAN_API_KEY`) — **set it in
> the deployment environment**. The chunked RPC fetcher in `lib/deprize/events.ts`
> remains as the fallback when the route fails. Deploy blocks in
> `DEPRIZE_EVENTS_FROM_BLOCK` came from Etherscan `getcontractcreation`
> (Sepolia registry 11068914, Arbitrum registry 495964196).

### 2.1 Record deployment blocks

**File:** `ui/const/config.ts`

Add, next to `DEPRIZE_REGISTRY_ADDRESSES`:

```ts
// First block worth scanning for DePrize events on each chain. Use the block in which
// DePrizeRegistry was deployed (contract-creation tx on the explorer). Every DePrize
// market, mint and trade is created after this block.
export const DEPRIZE_EVENTS_FROM_BLOCK: Record<string, number> = {
  sepolia: 0, // TODO: replace with creation block of DEPRIZE_REGISTRY_ADDRESSES.sepolia
  arbitrum: 0, // TODO: replace with creation block of DEPRIZE_REGISTRY_ADDRESSES.arbitrum
}
```

How to find the numbers: open `https://sepolia.etherscan.io/address/<registry>` and
`https://arbiscan.io/address/<registry>`, click the "Contract Creator" tx, read its block
number. Do not guess. Do not leave `0` in the final PR (a zero start makes the first
scan crawl the whole chain).

### 2.2 Generic chunked log fetcher

**File (new):** `ui/lib/deprize/events.ts`

```ts
import { getContractEvents, prepareEvent, type ThirdwebContract } from 'thirdweb'
import { eth_getBlockByNumber, eth_blockNumber, getRpcClient } from 'thirdweb/rpc'

export const BET_EVENT = prepareEvent({
  signature:
    'event Bet(uint256 indexed deprizeId, address indexed bettor, uint256 outcomeIndex, uint256 outcomeTokenAmount, uint256 cost, uint256 slice)',
})
export const TRADE_EVENT = prepareEvent({
  signature:
    'event AMMOutcomeTokenTrade(address indexed transactor, int256[] outcomeTokenAmounts, int256 outcomeTokenNetCost, uint256 marketFees)',
})
export const FUNDING_EVENT = prepareEvent({
  signature: 'event AMMFundingChanged(int256 fundingChange)',
})
```

Implement:

```ts
/** Fetch logs in block chunks; halve the chunk on "range too large"-style RPC errors. */
export async function fetchEventsChunked<T>(args: {
  contract: ThirdwebContract
  events: any[]
  fromBlock: bigint
  toBlock: bigint
  initialChunk?: bigint          // default 200_000n
}): Promise<T[]>
```

Rules: loop `from..to`, call `getContractEvents({ contract, events, fromBlock, toBlock })`
per chunk, on error whose message includes `range`/`limit`/`10000`/`too many` halve the
chunk and retry (min chunk `1_000n`, then throw). Concatenate. Sort by
`(blockNumber, logIndex)`.

```ts
/** Resolve block → unix ms timestamps for a set of block numbers (deduped, batched 8 at a time). */
export async function fetchBlockTimestamps(chain, blocks: bigint[]): Promise<Map<bigint, number>>
```

Use `eth_getBlockByNumber(getRpcClient({ client: deprizeReadClient, chain }), { blockNumber })`
→ `Number(block.timestamp) * 1000`.

Add a small in-memory cache (module-level `Map<string, Promise<...>>` keyed by
`${chainId}:${address}:${eventName}:${deprizeId ?? ''}`) so navigating between pages
doesn't refetch within a session. Optional but recommended: persist `{ toBlock, items }`
to `localStorage` under `deprize:events:v1:<key>` (serialize bigints as strings) and on
the next load fetch only `toBlock + 1 .. latest`.

### 2.3 Hook: `useDePrizeActivity`

**File (new):** `ui/lib/deprize/useDePrizeActivity.tsx`

```ts
export type BetRow = {
  bettor: string           // lowercase
  outcomeIndex: number
  qty: number              // outcome tokens, ETH units (wei / UNIT)
  costEth: number          // LMSR side (95%) incl. 1% fee
  sliceEth: number         // JB prize slice (5%)
  totalEth: number         // costEth + sliceEth
  blockNumber: bigint
  txHash: string
  timestampMs: number
}
export type SellRow = {
  seller: string
  outcomeIndex: number
  qty: number              // positive number of tokens sold
  proceedsEth: number      // -(outcomeTokenNetCost) - marketFees, ETH units
  blockNumber: bigint
  txHash: string
  timestampMs: number
}
export type DePrizeActivity = {
  bets: BetRow[]
  sells: SellRow[]
  backers: number          // unique bettor addresses
  totalStakedEth: number   // Σ bets.costEth (what the market collateral received from bettors)
  loading: boolean
  error?: string
  refresh: () => void
}

export function useDePrizeActivity(args: {
  deprizeId: number | undefined
  marketAddress: string | undefined
  chain: Chain
  refreshNonce?: number
}): DePrizeActivity
```

Implementation:

1. `mint = getContract({ client: deprizeReadClient, chain: deprizeReadChain(chain.id), address: DEPRIZE_MINT_ADDRESSES[slug], abi: DePrizeMintABI })`.
2. `fromBlock = BigInt(DEPRIZE_EVENTS_FROM_BLOCK[slug])`, `toBlock = await eth_blockNumber(rpc)`.
3. Bets: `fetchEventsChunked({ contract: mint, events: [prepareEvent({ signature: BET_SIGNATURE, filters: { deprizeId: BigInt(deprizeId) } })], fromBlock, toBlock })`.
   The `deprizeId` topic filter is essential — do not fetch all bets and filter in JS.
4. Sells: `fetchEventsChunked({ contract: lmsr, events: [TRADE_EVENT], fromBlock, toBlock })`
   then keep rows where **any** `outcomeTokenAmounts[i] < 0`. For each such row,
   `outcomeIndex` = the index with the negative amount (one per sell in our UI),
   `qty = -amount / UNIT`, `proceedsEth = (-(netCost) - marketFees) / UNIT`.
   Rows whose `transactor` equals the Mint address are buys — ignore them here (they are
   already in `bets`).
5. Timestamps via `fetchBlockTimestamps` for the union of block numbers.
6. Aggregations as pure functions in `ui/lib/deprize/activity-math.ts` (unit-tested):
   - `uniqueBackers(bets)`, `totalStaked(bets)`,
   - `userPosition(bets, sells, user, outcomeIndex)` → `{ qtyBought, qtySold, costEth, sliceEth, proceedsEth }`,
   - `userSummary(bets, sells, user, currentValueByIndex: Map<number, number>)` →
     `{ totalSpentEth, realizedEth, currentValueEth, unrealizedPnlEth, netPnlEth }` where
     `totalSpentEth = Σ(cost+slice)` for the user, `realizedEth = Σ proceeds`,
     `unrealizedPnlEth = currentValueEth − (Σ cost+slice for tokens still held)`;
     use average cost per token per outcome to attribute sold vs held cost.
   - Treat the 5% slice as part of what the user spent (it is real money they paid),
     and say so in the panel tooltip.

### 2.4 Header stats grid: add Backers and Total staked

**File:** `ui/pages/deprize/[id].tsx`

Replace the 3-column grid with `grid grid-cols-2 sm:grid-cols-4 gap-3`:

| Stat | Value | Tooltip |
|---|---|---|
| Prize pool · to winner | existing | existing (Phase 1) |
| Total staked | `activity.totalStakedEth` via `<EthUsd approx />` | "ETH bettors have put into the market. Winning shares are paid from this pool plus the market's seed funding." |
| Backers | `activity.backers` (and `activity.bets.length` bets in small text: `12 backers · 31 bets`) | "Unique wallets that have backed a team." |
| Betting closes | existing | existing |

While `activity.loading` show `…`; on `activity.error` show `—` (never block the page).

### 2.5 "Your position" panel

**File (new):** `ui/components/deprize/DePrizePositionPanel.tsx`

Render **only** when `userAddress` is set **and** (user has any bet or sell, or any
`outcome.balance > 0`). Place it in the page **after the question card, before
Predictions**, so a returning bettor sees their money first.

Props:

```ts
{
  outcomes: MarketOutcome[]                 // market.outcomes
  labels: string[]                          // predictionLabels
  colors: string[]                          // OUTCOME_COLORS (by index)
  bets: BetRow[]; sells: SellRow[]; user: string
  sellQuotes: Map<number, number>           // live cash-out value per index
  redeemValueByIndex?: Map<number, number>  // when resolved
  resolved: boolean; isRefundVector: boolean; winningIndex: number
  onCashOut: (index: number) => void; onBet: (index: number) => void
  loading: boolean
}
```

Layout (one card):

1. Title row: `Your position` and on the right a big signed P/L pill:
   `netPnlEth` via `<EthUsd signed />`, green if ≥ 0 else red, label `so far`.
   Tooltip: "Current value of your shares plus what you've already cashed out, minus
   everything you've spent (including the 5% prize slice)."
2. Four mini stats (`grid-cols-2 sm:grid-cols-4`): `Spent`, `Current value`,
   `Cashed out`, `If your pick wins` (Σ held tokens on the single outcome with the
   highest held qty; if the user holds several, show the max and add "best case").
3. Per-outcome rows, only for outcomes where the user has ever had activity, ordered by
   current value desc: color dot, team name, `shares`, `avg cost / share`, `now worth`
   (sell quote or redeem value), small `Cash out` button (reuse the button styles in
   `DePrizeTeamCard`). If resolved: `WON` / `Lost` / `Refund` chip instead of the quote.
4. Collapsible `Activity` (`<details>`): reverse-chronological list of bets and sells:
   `Backed Firefly · 0.004 ETH · Sep 8, 3:12 PM` / `Cashed out 0.9 shares of Astrobotic · +0.0023 ETH · …`,
   each linking to the explorer tx (`https://sepolia.etherscan.io/tx/` or
   `https://arbiscan.io/tx/` by chain slug).

### 2.6 Retire the localStorage cost basis and slim the team card

**File:** `ui/pages/deprize/[id].tsx`, `ui/components/deprize/DePrizeTeamCard.tsx`

1. Per §1.0, remove the `If wins` subtitle and the holdings block (`Cash out` quote,
   P/L suffix, button) from `DePrizeTeamCard`; delete the now-unused props
   (`redeemValueEth`, `sellQuoteEth`, `investedEth`, `onCashOut`) and `PnlSuffix` if
   nothing else imports it. The card is `%` · name · `Back this team`. Holdings live in
   the position panel only.
2. Delete `costBasis`, `costStorageKey`, `persistCostBasis`, `addCostBasis`,
   `resetCostBasis`, `clearCostBasis` and their call sites. `BetModal.onDone` and
   `ExitPositionModal.onDone` just call `refreshAll()`; `refreshAll` must also bump the
   `refreshNonce` passed to `useDePrizeActivity` (it already increments `refreshNonce`).
3. After a bet/sell, events land a block or two later. Keep the existing 2.5s delayed
   second refresh; add a third at 8s.

### 2.7 Acceptance for Phase 2

- `/deprize/22` on Sepolia shows `Backers ≥ 1` and a non-zero `Total staked`.
- With the wallet that placed the smoke bet, "Your position" shows Spent ≈ 0.0005 ETH
  (0.000475 cost + 0.000025 slice), current value ≈ the card's cash-out quote, and one
  activity row linking to the bet tx.
- Reload in a fresh browser profile: the panel shows the same numbers (no localStorage
  dependence).
- `/deprize/1` on Arbitrum loads in under ~3s with the header stats filled; check the
  Network tab for a handful of `eth_getLogs` calls, not hundreds (tune `initialChunk`).
- `activity-math.cy.ts` covers: unique backers dedupe by lowercase address; total staked
  sums `cost` only; average-cost attribution after a partial sell; net P/L sign.

---

## Phase 3 — Odds chart rebuilt from chain

Ships: a chart that is identical on every device and shows every trade (#4).

### 3.1 Pure reconstruction

**File (new):** `ui/lib/deprize/lmsr-history.ts` (no React/thirdweb imports)

```ts
export type TradeLike = { timestampMs: number; amounts: number[] /* ETH units, signed */ }
export type FundingLike = { timestampMs: number; deltaEth: number }

export function lmsrMarginalPrices(qEth: number[], fundingEth: number): number[]
// p_i = 1 / Σ_j exp((q_j - q_i) / b), b = fundingEth / ln(n); returns percents summing to ~100

export function rebuildOddsHistory(args: {
  marketStartMs: number
  initialFundingEth: number         // funding() at market open (== current funding if no AMMFundingChanged)
  trades: TradeLike[]               // all AMMOutcomeTokenTrade rows, chronological (buys AND sells, any transactor)
  fundingChanges?: FundingLike[]
  numOutcomes: number
}): OddsSample[]                    // first sample at marketStartMs with uniform 100/n, then one after each trade
```

Unit tests (`lmsr-history.cy.ts`): uniform prior at start; one buy on outcome 0 raises
p_0 and lowers the rest, sums to 100; a sell reverses it; result for the final state
matches `lmsrMarginalPrices(finalQ, funding)` within 1e-9; with `fundingEth = 0.04`,
`n = 3`, buying `0.01` of outcome 0 gives p_0 ≈ 41.6% (check against the live Sepolia
market once, then hard-code the expected value).

### 3.2 Wire into the market hook

**File:** `ui/lib/deprize/useDePrizeMarket.tsx`

1. Read `funding()` from the LMSR alongside `fee`/`startTime` in the static load and
   store `fundingEth` in `staticRef`.
2. Add an effect: when `marketAddress`, `marketStartMs`, `fundingEth`, `numOutcomes`
   are known, fetch `TRADE_EVENT` (+ `FUNDING_EVENT`) via `fetchEventsChunked` from
   `DEPRIZE_EVENTS_FROM_BLOCK[slug]`, resolve timestamps, run `rebuildOddsHistory`, and
   `setOddsHistory(rebuilt)` **replacing** whatever was hydrated from localStorage.
   Keep the `loadGenRef` guard so a stale fetch for a previous market can't overwrite.
3. Self-check: compare the last rebuilt sample with the live `outcomes[].probability`.
   If any outcome differs by more than 0.5 pt, `console.warn` and append the live sample
   so the right edge is always truthful.
4. Keep `recordOddsSample` for **live** samples from the poll (they extend the rebuilt
   history in-session). Change the localStorage role to a cache: write the rebuilt +
   live history under a new key `deprize:oddsHistory:v3:<market>` and delete the v2 key.
   Hydration from cache should only be used while the chain rebuild is in flight.
5. Expose `oddsHistoryLoading: boolean` and `tradeMarkers: { t: number; index: number }[]`
   (one per trade, the outcome that was bought/sold) from the hook.

### 3.3 Chart component

**File:** `ui/components/deprize/OddsHistoryChart.tsx`

1. New optional prop `markers?: { t: number; index: number }[]`. Render a Recharts
   `<Scatter>` (or `<ReferenceDot>` per marker) at `(t, value of v{index} at t)` using
   the outcome's color, radius 3. Tooltip on a marker says `Trade · <label>`.
2. New optional prop `loading?: boolean`. When true and `data.length < 2`, show
   `Loading odds…` instead of the empty state.
3. Empty state copy is `No trades yet.` (set in §1.0). No caption under the chart; the
   marker tooltip (`Trade · <label>`) is the only explanation.

### 3.4 Acceptance for Phase 3

- Open `/deprize/22` in two different browsers: charts are identical and show the
  smoke bet as a step with a dot.
- Clear localStorage; reload; the chart is unchanged.
- The right-hand edge of every line equals the legend percentage.
- `/deprize/1` on Arbitrum shows the step at the user's bet (the one from the feedback)
  with the correct date on the X axis.

---

## Phase 4 — Layout, polish, and the simulation link (UX proposal)

This phase is optional but strongly recommended once Phases 1–3 land. It is a set of
suggestions; each bullet is independent.

### 4.1 Final information order on the page (top → bottom)

1. **Header**: `Touchdown` `#22` · (badge only when abnormal) · `← All prizes` · **`Open in Moon Base Zero`** link (right side).
2. **Question card** (Phase 1.3): the question, description, criteria, simulation link.
3. **Stats row** (Phase 2.4): Prize pool · to winner / Total staked / Backers / Betting closes.
4. **Your position** (Phase 2.5) — only when connected with activity. Nothing renders
   in its place otherwise.
5. **Odds chart** with trade dots (Phase 3), no legend.
6. **Competitors** ranked, Open Field last (Phase 1.1): `%` · name · button.
7. Claim panel (resolved only), admin panel (admins only), lineage line, roster footnote.

### 4.2 Make competitors feel like the simulation

- Each `DePrizeTeamCard` already links to `/moonbase/<projectId>`. Add a second-line
  subtitle sourced from the atlas project: type (`PROJECT_TYPE_LABEL`), planned year
  (`milestoneArrivalYear`), and status (`TIME_STATUS_OPACITY` key) — the same words the
  simulation shows in its panel — so the two views describe a team identically.
- Use `orgColor(atlasOrg)` for the team's chart line as well as the card accent (today
  the chart uses `OUTCOME_COLORS[index]` while the card uses the org color — pick one,
  prefer org colors so the chart legend matches the simulation's legend).
- Add a "Where this happens" strip under the question card: a static
  `moonbase` region screenshot or the goal's `regionLabel` with a `Fly there →` link to
  `/moonbase?race=<goalId>`.

### 4.3 Connect the simulation back to the prize

- `SharedGoalPanel.tsx` links to `/deprize/${marketDeprizeId}`. Add per-competitor
  `Back this team` links to `/deprize/${id}?outcome=<index>` — the detail page already
  scrolls to and opens the bet modal for `?outcome=N`.
- In the simulation's goal panel, show the same four stats (prize pool, staked,
  backers, closes) using `useDePrizeActivity` so the numbers match across both surfaces.

### 4.4 Plain-language and reduced clutter

- Team card "Back this team" button: below it show a preview line
  `0.01 ETH → ~0.02 shares → pays ~0.02 ETH if wins` using `quoteQtyForBudget` at a
  default stake (e.g. 0.01 ETH). This turns the abstract percentage into money before
  the user opens the modal.
- Sticky mini-bar on mobile after scrolling past the header: title + top team % +
  `Back a team` button.
- Empty states should always tell the user the one action to take: no wallet →
  `Connect to back a team`; region blocked → `View only in your region`; resolved →
  `Claim your winnings` / `Claim your refund`.

### 4.5 Shareability

- Add an OG image route (`pages/api/og/deprize/[id].tsx` with `@vercel/og`) rendering
  title, top three competitors with percentages, prize pool, and closes date, so a
  shared link previews live odds. Set it in `<Head>` via `competition.metaDescription`
  plus an `og:image` URL.
- Add a `Share` button (copies `/deprize/<slug>` when the race has a slug, else `/deprize/<id>`).

---

## Appendix A — Pitfalls checklist for the implementer

- `market.outcomes` is index-aligned with the contract. **Never** sort it in place.
  Sort a copy for display only.
- `Bet.cost` already includes the 1% LMSR fee; `slice` is separate. Total spent =
  `cost + slice`.
- `AMMOutcomeTokenTrade.transactor` is the Mint for buys. Use `Bet` for identity of
  buyers; use trade rows only for price reconstruction and for a user's sells.
- All wei values are 18-decimal (`UNIT = 10n ** 18n`); divide with `Number(x) / Number(UNIT)`
  only for display; do aggregation in `bigint` where sums can exceed 2^53 wei (they can).
- `getContractEvents` returns `bigint` block numbers; `JSON.stringify` throws on bigint —
  convert to string before caching.
- Filter `Bet` by the `deprizeId` indexed topic; the Mint serves every DePrize on the chain.
- Arbitrum blocks are ~0.25s; a naive `fromBlock: 0` scan will never finish. Fill
  `DEPRIZE_EVENTS_FROM_BLOCK` with real values.
- Do not re-introduce a uniform `1/n` sample after a traded sample (see the comments in
  `recordOddsSample`); the rebuild makes those guards mostly moot but keep them.
- Anything that fails in the events layer must degrade to `—`, never block the page.
