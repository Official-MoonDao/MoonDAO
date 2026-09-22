# Capability ladder — Sepolia deployment plan

Dress rehearsal for an Arbitrum launch of the four ladder prizes. Sepolia uses the
v2 stack in [`DEPRIZE_SEPOLIA_ADDRESSES.md`](./DEPRIZE_SEPOLIA_ADDRESSES.md).
Arbitrum uses a different stack ([`DEPRIZE_ARBITRUM_ADDRESSES.md`](./DEPRIZE_ARBITRUM_ADDRESSES.md)):
proxies, `LMSRWithTWAP`, and a FeeRouter. A Sepolia market is not copied onto
Arbitrum. What carries over is the roster order, the question text, and the
proof that the page can show a live market for that goal.

The ladder is these four rungs, in order. It is not the rest of the planning-stage
grid on `/deprize` (pads, habitat, comms, ISRU, fission, the crewed rover).

| Rung | Prize | Goal | Sepolia today |
|---|---|---|---|
| 0 | Touchdown | `shared-next-landing` | **Already registered** on the v2 registry as id **1** (JB 269, stock LMSR `0x3cdC9814…0A44`). Do not register it again. |
| 1 | First Tracks | none | No atlas goal, no roster, no spec file. Cannot register. |
| 2 | Ice | none | Same. |
| 3 | Night Shift | `shared-night-shift` | Atlas goal and provisioner row exist. **Not registered.** |

The app still reads the **v1** Sepolia registry
(`0x299F163705AbBFa1A8DE7670F33171730F828F3D` in `ui/const/config.ts`) and still
treats v1 DePrize **#22** as the Touchdown tip. Until that rebind lands, a new
v2 registration will not show up as a live market in the UI.

## What I would do

1. **Rebind the UI to the v2 stack before registering anything else.** Same PR:
   `DEPRIZE_REGISTRY_ADDRESSES.sepolia`, mint, and redeem from the v2 ledger,
   clear the v2 fee-router slot, set `DEPRIZE_EVENTS_FROM_BLOCK.sepolia` to
   `11727650`, and point `competitions.ts` at v2 Touchdown id **1**
   (`questionId` `0x2c633f9b…1f7b`, `sharedGoalId: 'shared-next-landing'`).
   Mark v1 **#22** `supersededBy: 1`. The address ledger already has this block.
   Shipping only the address change would make the site read id 22 on an empty
   v2 registry.

2. **Leave the Touchdown market alone.** v2 id 1 is the dress rehearsal. The
   provisioner in `ui/scripts/provision-sepolia-races.ts` still lists
   `shared-next-landing`. Running that script without `GOAL_ID` would
   `register` a second Touchdown. Skip it. ispace is on the atlas roster and
   not in the live team list `[601, 602, 603, 604, 605, 24]`; adding it is a
   new generation, not part of this pass.

3. **Register Night Shift on v2**, one goal at a time, with a real Juicebox
   mission. Then bind that id in `competitions.ts` and append a section to
   `DEPRIZE_SEPOLIA_ADDRESSES.md`.

4. **Do not register First Tracks or Ice until each has an atlas goal and a
   frozen roster.** Outcome count is fixed at `prepareCondition`. A Sepolia
   market opened on a guessed roster has to be superseded, the way Touchdown
   #21 was. Arbitrum should wait until that roster is the one we intend to
   freeze.

5. **Repeat the same questions on Arbitrum only after the Sepolia page is
   live**, on the Arbitrum contracts, with new `questionId`s. Sepolia
   condition ids and market addresses do not transfer.

## Night Shift — the one prize to deploy now

Atlas goal `shared-night-shift`. Seven named systems plus the Open Field.
The provisioner already reserves this mapping:

| Order | Project | Team id |
|---|---|---|
| 0 | `zeno-harmonia` | 611 |
| 1 | `astrobotic-nite` | 612 |
| 2 | `venturi-lunar-battery` | 613 |
| 3 | `perpetual-atomics-endure` | 614 |
| 4 | `cnnc-lunar-rtg` | 615 |
| 5 | `rosatom-lunar-rtg` | 616 |
| 6 | `isro-barc-rhu` | 617 |
| 7 | Open Field | 24 |

`questionId` is `keccak256("deprize:sepolia:shared-night-shift:v1")` =
`0x6058f2c9f314734e1f1ecf8c34c8d8835fff5d8fb5e075d8044823e1717f00d4`.
That string is not stored on-chain. Losing it blocks `reportPayouts`.

Seed is `0.01 ETH` per outcome: **0.08 ETH** for eight slots, 1% fee, sunset
about two years out. Those numbers are what
`ui/scripts/provision-sepolia-races.ts` already uses.

`register` is `onlyOwner`. The owner is the deployer
`0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011`. A faucet key cannot do this.

Do not assume the new id. v1 notes guessed **23**. On the v2 registry
Touchdown is id **1**, so the next id is `registry.count()` at the moment of
`register` (likely **2** if nothing else has been registered since 2026-09-18).
Read `count()` and use the `DePrizeRegistered` id.

### Transactions, in order

Run from `ui/`, with `DEPLOYER_PK` in the environment (the script also accepts
`PRIVATE_KEY`). Do not run the script’s full `RACES` list.

```
GOAL_ID=shared-night-shift yarn tsx --tsconfig tsconfig.json scripts/provision-sepolia-races.ts
```

The script already does this sequence against the v2 registry, mint, and stock
LMSR factory. Confirm each receipt before the next:

1. `MissionCreator.createMission` for team 22, token `DePrize Night Shift` /
   `DNGT`, memo `DePrize Lunar night power`. Record `missionId`,
   `jbProjectId`, and the payhook.
2. If the payhook’s `deprizeRegistry()` is not the v2 registry, call
   `setDePrizeRegistry`. This latch is one-way.
3. Refuse a synthetic Juicebox id. The script falls back to `3000 + n` when
   `createMission` fails. Touchdown generation 1 did that (JB 3003) and had to
   be superseded because it had no prize pool. If mission creation fails, stop.
4. `ConditionalTokens.prepareCondition(deployer, questionId, 8)` if the
   condition does not already exist. Oracle is the deployer. `conditionId` is
   `keccak256(abi.encodePacked(oracle, questionId, 8))` — packed, not ABI-padded.
5. Wrap ETH to the Sepolia WETH (`0x8cfF28F9…74c6`) for the shortfall under
   0.08 ETH, then `approve` the factory.
6. `LMSRMarketMakerFactory.createLMSRMarketMaker` with the stock factory
   `0x30b449b6…5674`, collateral WETH, that one condition, fee `1e16`, no
   whitelist, funding 0.08 ETH. Record the market from
   `LMSRMarketMakerCreation`.
7. `DePrizeRegistry.register(jbProjectId, teamIds, sunset)`.
8. `setCondition(deprizeId, conditionId)`, then `open(deprizeId)`.
9. `DePrizeMint.setMarket(deprizeId, market)`.
10. Confirm `complianceSigner` is the deployer, or the key the UI will use.
    v2 does **not** transfer the LMSR to a FeeRouter. Owner stays the deployer.
    `DePrizeVerify.s.sol` is the check, with `DEPRIZE_ID`, `DEPRIZE_MARKET`,
    `DEPRIZE_PAYHOOK`, and `DEPRIZE_JB_PROJECT` set to the values just recorded.

### Bind it

Append the printed block to `sepolia` in `ui/lib/deprize/competitions.ts`:
title from the atlas goal, `sharedGoalId: 'shared-night-shift'`, the
`questionId` above, and outcomes in the table order with
`{ projectId: OPEN_FIELD_PROJECT_ID, teamId: 24, field: true }` last.
Add the same numbers to `docs/DEPRIZE_SEPOLIA_ADDRESSES.md`. Do not invent any
address the script did not print.

On Sepolia, `/deprize` should then show Night Shift as a live market instead
of a Planning stage list. `/deprize/shared-night-shift` should resolve to that
id.

## First Tracks and Ice — not deployable yet

Both rungs are a name and a one-line bar. There is no `sharedGoalId`, no
project list, and no rules file in this repo. First Tracks is “first commercial
rover egress and drive.” Ice is “2027 in-situ surface water ice.” Neither is
the existing rover card (`shared-lunar-rover`) or the ISRU card
(`shared-isru-oxygen`). Those are different questions and already have v1
bindings.

Before either can go through the Night Shift procedure:

1. Add an atlas shared goal with a stable id, a title, the named competitors
   in roster order, and the Open Field. Outcome count freezes at
   `prepareCondition`, so this list is the decision.
2. Assign team ids that do not collide with 24, 601–605, or 611–617.
3. Add one `RACES` row to `provision-sepolia-races.ts`. Question id
   `keccak256("deprize:sepolia:<goalId>:v1")`. Compute it and write it down
   before sending transactions.
4. Run with `GOAL_ID` set to that goal only.
5. Bind `competitions.ts` and the address ledger the same way as Night Shift.

Arbitrum registration for these two waits until that roster is the one we
mean to keep. A Sepolia market can be the place we discover the roster is
wrong. Changing it afterwards is a new generation, not an edit.

## Touchdown — rebind, don’t redeploy

| Slot | v2 value |
|---|---|
| Registry | `0x7208B0Ba9B1013000b8D30b60A462079300984E2` |
| Mint | `0x22E22C4135be93595f341e072321D18e7D4Ee0D0` |
| Redeem | `0x7a6B6AaC8Efbe894EDEe224a6bC3b09874c10849` |
| id | `1` |
| Teams | `601, 602, 603, 604, 605, 24` |
| JB | `269` (mission 15) |
| Payhook | `0x82B4B19232B860362B796a6f1aF06BB3BE006fFD` |
| questionId | `0x2c633f9b1a6bd1a6252c49ed56f89d554a85e421ff84a146b1ae9e21f6311f7b` |
| conditionId | `0xda4fd1b1d84fa7a990ec7d7379f35606e6c23610c879ec60054833a39b1672c2` |
| LMSR | `0x3cdC98142a9Fc1E05D22a2f39500d5DE2F290A44` |

`DePrizeVerify` already passed for this id on 2026-09-18. The follow-up is
the UI rebind in the v2 address ledger, not another `register`.

## What Sepolia is for, and what Arbitrum still requires

Sepolia checks that each rung can be registered, opened, and rendered: mission,
payhook latch, condition, stock LMSR, mint binding, and a `competitions.ts`
entry whose outcome order matches `teamIds`.

Arbitrum does not reuse those contracts. Its registry, mint, redeem, and
FeeRouter are the proxy stack in `DEPRIZE_ARBITRUM_ADDRESSES.md`. Markets
there are `LMSRWithTWAP`, and the FeeRouter owns them. Each Arbitrum prize
gets its own `questionId` (include `arbitrum` in the preimage, not `sepolia`),
its own `prepareCondition`, its own mission, and a Safe ownership step that
this Sepolia deployer-EOA rehearsal does not cover. Team ids on Arbitrum are
not the Sepolia ids.

Order for a later Arbitrum pass: Touchdown first (the market shape we have
already run), then Night Shift, then First Tracks and Ice only after their
rosters are frozen.
