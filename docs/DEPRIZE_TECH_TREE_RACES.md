# DePrize tech-tree races — Sepolia seeding (2026-07-31)

Seeds the 7 Moon Base Zero tech-tree races that had no on-chain market
(everything except `shared-fission-power`, DePrize 9). Follow-up to Phase B2 —
see `docs/DEPRIZE_PHASE_B2.md` item 3 ("only 1 of 8 races has a market").

Provisioned with [`subscription-contracts/script/deprize/DePrizeSeedRace.s.sol`](../subscription-contracts/script/deprize/DePrizeSeedRace.s.sol),
a reusable per-race runbook that mints Team NFTs, creates a Juicebox mission
for the prize pool, prepares a CTF condition, deploys + funds a fresh
`LMSRWithTWAP` market, hands it to the FeeRouter, registers the DePrize, and
wires `mint`/`feeRouter` — the exact sequence already proven for DePrize 9,
packaged into one atomic broadcast per race (see the script's own doc comment
for the full step list and usage).

## Shared infra reused (all pre-existing, Sepolia)

| Piece | Address |
|---|---|
| DePrizeRegistry | `0x299F163705AbBFa1A8DE7670F33171730F828F3D` |
| DePrizeMint | `0xA6F9632ee9848f7C1f252DA5a1e869aC90E57cc8` |
| DePrizeFeeRouter | `0xBE8CBC97D4DDeE28B938c0Ed8245f1b5133b783A` |
| MissionCreator (fresh, not app-wide) | `0xa692eEd67c4D2C1C73DC0515240d27cf7d6fF9D1` |
| LMSRWithTWAPFactory | `0x8787Dc3c2b48b19D3Cbd25226Cd6cEAff3398de1` |
| ConditionalTokens | `0xC3B0a34fb9a1c5F9464D7249BF564117e1fe6dE8` |
| WETH (collateral) | `0x8cfF28F922AeEe80d3a0663e735681469F7374c6` |
| Oracle (= deployer, matches DePrize 9) | `0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011` |

**Open Field Team NFT: id 24**, minted fresh while seeding the first race
(crewed-lander) and reused as the last outcome on every race below —
`OPEN_FIELD_TEAM_ID` in `ui/lib/deprize/competitions.ts`. This supersedes the
"intended id 999, pending mint" placeholder from the roster-changes work; 999
was never actually reserved on-chain.

LMSR fee: 1% (`1e16`), matching every other Sepolia DePrize. Funding: 0.002–0.003
ETH per outcome slot (small on purpose — this is a testnet fixture budget, not
a target liquidity depth). Sunset: 365 days from provisioning.

## Races

| DePrize | Shared goal | JB project | LMSR market | Outcomes (registry order) |
|---|---|---|---|---|
| **10** | `shared-crewed-lander` | 257 | `0xC7bD08D93E3D3FC4D3ddBc9B404b21a2416FF0C0` | team 22 SpaceX, team 23 Blue Origin, team 24 Open Field |
| **11** | `shared-south-pole-base` | 258 | `0x33e114De94040A2b93F9725aC8651339A7ef1B3F` | team 25 NASA, team 26 CNSA/Roscosmos (ILRS), team 24 Open Field |
| **12** | `shared-isru-oxygen` | 259 | `0x93cF1821ccC31b4438a51De6bB0a15770B0B3078` | team 27 Blue Origin, team 28 Sierra Space, team 29 Lunar Resources, team 24 Open Field |
| **13** | `shared-lunar-rover` | 260 | `0x96daA9E80c9829C603b86079e3960623cAe8381F` | team 30 Intuitive Machines, team 31 Venturi Astrolab, team 32 Lunar Outpost, team 24 Open Field |
| **14** | `shared-habitat` | 261 | `0x1F08BF0C80d3eCe08f5A5A4049d9b9547958D29c` | team 33 Thales Alenia Space, team 34 Sierra Space, team 35 JAXA, team 24 Open Field |
| **15** | `shared-landing-pads` | 262 | `0x9c1E55A27c7849FC9D6966C633325f62d858536B` | team 36 ICON, team 37 Redwire, team 38 Astroport, team 39 AI SpaceFactory, team 24 Open Field |
| **16** | `shared-lunar-comms` | 263 | `0x5CD09F1E899Fc740402890EE4F1D8737E6306857` | team 40 Nokia Bell Labs, team 41 Intuitive Machines, team 42 ESA, team 43 Crescent Space Services, team 24 Open Field |

Full outcome→`projectId` mapping (the actual UI binding) lives in
[ui/lib/deprize/competitions.ts](../ui/lib/deprize/competitions.ts) — this
table is for cross-referencing on-chain state, not a second source of truth.

QuestionIds used at `prepareCondition` (needed by `DePrizeResolve.s.sol` at
resolution time — not derivable from the conditionId alone):

| DePrize | questionId |
|---|---|
| 10 | `0xce411ce707a6298b33620f52d6fe8dc4ee0c597372fe0facac81e448f376fd97` |
| 11 | `0x150ec02c609584709e1eb951b255d427430ed2a1a45b50c70666b53874c0ca20` |
| 12 | `0xc041d0d3481ed8c76f987ea9bef2f2e94f81f605badedb52500a8e66a3283843` |
| 13 | `0x209345b41eb64143d5de9cfc822ea958587931d0b94674d5a947fc10ebeee535` |
| 14 | `0x90e01053f7c0cffe0b48dd59e8fcb748b67cae80dd9769ff7cec7d059ad08996` |
| 15 | `0xb4269e81b8bd31980ba176a180674937e8dfb8a27b6c783ff78d205efab5d172` |
| 16 | `0xe6ab30e416fc4073e0b7c3c5fd94defebb01374ce603bdd8671aa25e52daf0bb` |

## Verification performed

For every DePrize 10–16, confirmed on-chain:

- `registry.getDePrize(id).state == OPEN (2)`
- `registry.getDePrize(id).teamIds` matches the table above, in order
- `mint.marketOf(id) == feeRouter.marketOf(id)` (consistent binding)
- LMSR `stage() == Running (0)`
- LMSR `owner() == DePrizeFeeRouter` (ownership correctly handed off post-creation)
- LMSR `atomicOutcomeSlotCount()` matches roster size (competitors + Open Field)
- Marginal prices are uniform across outcomes immediately after funding (e.g.
  DePrize 15: all 5 outcomes read ~20.0%), confirming a freshly-initialized,
  untraded market

Not yet done (needs a browser / real bets, same as the Phase B2 Wave 2
verification pattern in `ui/scripts/smoke-moonbase-deprize.mjs`):

- Visual confirmation of each race's panel on `/moonbase?race=<sharedGoalId>`
- A real bet on one of the new markets to confirm odds move (mirroring the
  fission-race `--bet` proof in `ui/scripts/verify-deprize-moonbase-sepolia.ts`)

## Budget note

Real Sepolia gas cost was materially higher than a first estimate — dominated
by Team NFT minting (each mint deploys a fresh Gnosis Safe + mints a manager
hat), not by LMSR funding. All 7 races together cost ~0.164 ETH (gas + funding)
against a ~0.2 ETH wallet balance; funding per outcome was reduced from 0.003
to 0.002 ETH for the two largest (5-outcome) races to fit the budget with
margin. If seeding further races or re-running any of these, budget roughly
0.02–0.04 ETH per race depending on roster size (2–4 competitors).

## Known gaps / follow-ups

- **Resolution.** None of these races have been resolved end-to-end
  (`DePrizeResolve.s.sol` / `reportPayouts`) — only DePrize 9 has a proven
  resolve path. The questionIds above are recorded so this is possible later.
- **Consent/branding.** No competitor across any of these 7 races has
  `consented: true` — all render with the neutral monogram per the
  disclaimer-first model (see `docs/DEPRIZE_PHASE_B2.md`). Real outreach to
  named orgs is a separate, non-engineering track.
- **DePrizeMint UI betting.** Not smoke-tested per race the way DePrize 9 was
  in `docs/DEPRIZE_QA.md` section G — these markets should behave identically
  (same contracts, same wiring pattern) but that is an inference, not a proof.
- **`ownerOf(301..303)` reverts** on the current `TEAM_ADDRESSES.sepolia`
  contract (noticed while minting these new teams on it) — DePrize 9's teams
  may be on a different/earlier `MoonDAOTeam` instance. Does not affect DePrize
  9's display (the UI always overrides with atlas org names for bound races),
  but worth investigating separately if DePrize 9's Team NFTs need to resolve
  directly again.

## Re-running / seeding more races

```bash
cd subscription-contracts
export PRIVATE_KEY=0x...
export SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com

TEAM_NAMES="Org A,Org B,Org C" \
QUESTION_ID=0x<unique bytes32> \
OPEN_FIELD_TEAM_ID=24 \
RACE_LABEL="Race label" \
FUNDING_PER_OUTCOME=3000000000000000 \
SUNSET_DAYS=365 \
forge script script/deprize/DePrizeSeedRace.s.sol \
  --rpc-url $SEPOLIA_RPC_URL --broadcast --via-ir -vvv
```

Then read `registry.getDePrize(<new id>)` directly (the script's own
`console.log` output for per-team/JB/DePrize-id lines does not reliably print
under `--broadcast` — a Foundry console.log overload quirk, not a script
failure; the on-chain result is authoritative) and add the binding to
`ui/lib/deprize/competitions.ts`.
