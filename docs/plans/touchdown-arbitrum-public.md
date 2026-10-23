---
name: arbitrum touchdown public
overview: 'Deploy a new Arbitrum Touchdown prize. The treasury is the oracle and receives the trading fee. The executive branch owns the prize and the launchpad project. ispace is a named outcome. Nothing in this plan has been broadcast.'
todos:
  - id: provision
    content: 'Dry-run, then broadcast, a provision script that deploys a fresh v2 registry and mint owned by the executive branch, prepares the condition with the treasury as oracle, seeds the market at 0.008 ETH per name, and transfers the market to the executive branch'
    status: pending
  - id: safe-wire
    content: 'Executive branch signs the latch, register, setCondition, setMarket, compliance signer, and open. Open is last'
    status: pending
  - id: launchpad-list
    content: 'List DEPRIZEMISSION_42161_162 on /launch, excluding the internal demo mission'
    status: pending
  - id: fee-sweep
    content: 'Point the live fee sweep at the treasury instead of the Juicebox prize pool'
    status: pending
  - id: ledger
    content: 'Record the new addresses, condition id, and deprize id in DEPRIZE_ARBITRUM_ADDRESSES.md and competitions.ts after the broadcast'
    status: pending
isProject: false
---

# Touchdown on Arbitrum — public prize

Nothing in this plan has been broadcast. The current Arbitrum Touchdown stays
as it is: DePrize 2 on registry `0xf8B2244634c6eCeF32de10BFe0D7436413A59924`,
oracle `0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011`.

This prize is a new registry, a new condition, and a new market. The app reads
one registry per chain, so pointing Arbitrum at the new registry takes the
current five prizes off `/deprize`. That cutover happens after the addresses
exist. The password gate on `/deprize` stays up until a separate launch.

## Roles

Checked on Arbitrum on 23 October 2026. Both Safes accept ERC-1155 and ERC-721.

| Seat | Wallet | What it can do |
|---|---|---|
| Oracle, and recipient of the 1% trading fee | Treasury `0xAF26a002d716508b7e375f1f620338442F5470c0` | 5 of 7. One `reportPayouts`, once. It cannot pause the market or move the prize pool |
| Registry, mint, market, Juicebox project, pay hook | Executive branch, Team #0 `0xdFc31084ad3887076913e5d0759a27C65A3C5291` | 4 of 5. Open, lock, name the prize winner, cancel, pause, close, withdraw fees, send the purse |

The Team #0 NFT is held by the executive branch. That Safe wears the team
admin hat. It does not wear the manager hat.

Treasury signers, 5 of 7 required:

| | Address |
|---|---|
| Pablo | `0x679d87D8640e66778c3419D164998E720D7495f6` |
| Ryan | `0xB2d3900807094D4Fe47405871B0C8AdB58E10D42` |
| Eiman | `0xe2d3aC725E6FFE2b28a9ED83bedAaf6672f2C801` |
| | `0x823b92d6a4b2AED4b15675c7917c9f922ea8ADAD` |
| | `0x6bFd9e435cF6194c967094959626ddFF4473a836` |
| | `0xb00E7F2C408D23337dFEe6be44EA2D7AAd4B0FE7` |
| | `0x5640Ddc028f2436B5C0BA0305D2199556C1b5a95` |

Executive branch signers, 4 of 5 required:

| | Address |
|---|---|
| Pablo | `0x679d87D8640e66778c3419D164998E720D7495f6` |
| Ryan | `0xB2d3900807094D4Fe47405871B0C8AdB58E10D42` |
| Miguel | `0xAF6f2A7643A97b849bD9cf6d3f57e142c5BbB0DA` |
| Eiman | `0xe2d3aC725E6FFE2b28a9ED83bedAaf6672f2C801` |
| | `0xb00E7F2C408D23337dFEe6be44EA2D7AAd4B0FE7` |

The oracle address is fixed inside the condition id when the condition is
prepared. On this prize that address is the treasury. `reportPayouts` from any
other wallet resolves a different bet. The call takes the question id below
and seven numbers, one per name. A single `1` pays that name's backers. A `1`
in every slot refunds every backer an equal share. The contract then refuses
a second report. Backers redeem against the ETH trading inside the market.
The treasury does not hold that ETH, and it does not hold the Juicebox pool.

## Roster

Seven outcomes. ispace is named. Order is the registry order and the payout
vector order.

| Slot | Name | Team id |
|---|---|---|
| 0 | Astrobotic, Griffin Mission One | 601 |
| 1 | Intuitive Machines, Nova-C IM-3 | 602 |
| 2 | Firefly, Blue Ghost M2 | 603 |
| 3 | Blue Origin, Blue Moon MK1 | 604 |
| 4 | CNSA, Chang'e-7 | 605 |
| 5 | ispace | 606 |
| 6 | Open Field | 24 |

Seed is 0.008 ETH per name, **0.056 ETH** total, from the deployer wallet
`0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011`. The seed returns to the
executive branch when the market is closed, minus the market's bounded loss.
It does not go to the treasury.

Question id, written here before the broadcast and given to the treasury
signers:

```text
keccak256("deprize:arbitrum:touchdown-public:v1")
0xd81ff517bc437933758e3679c1107fca6983ca98f2798926af562ab5bdf4b32e
```

`reportPayouts` needs that exact value. It is not stored on-chain. Sunset is
two years from the deploy, the same horizon as the current Arbitrum races.
The Juicebox funding goal is 100 ETH, the same figure those races used.
Mission token name `DePrize Touchdown`, symbol `DTCH2`. The mission is filed
under Team #0.

## Why a new registry

The live Arbitrum registry and mint are UUPS proxies. One owner controls all
five existing prizes and can replace the implementation. A new row there
would leave lock and settle with the deployer. The oracle on DePrize 2 would
stay the deployer for the life of that condition.

The new registry and mint are the immutable v2 contracts. The constructor
owner is the executive branch. Ownership moves only by a two-step transfer.
There is no fee router. The executive branch owns the market directly.

Reuse these contracts. Do not redeploy them.

| | Address |
|---|---|
| Conditional Tokens | `0x12DAC07Bf586E06a9bDa32c422864C8Fda43FA29` |
| WETH | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` |
| H-01 LMSR factory | `0x299F163705AbBFa1A8DE7670F33171730F828F3D` |
| DePrize mission creator | `0x87307f5D73c93B5b0a2e250194d62CD2D4BfEe3B` |

The market comes from the H-01 factory. The factory makes the caller the
first owner, so the deployer holds the market for the creation transaction
and transfers it to the executive branch before betting opens.

## Deploy

The deployer key sends steps 1–4. It is the owner of the DePrize mission
creator, so it can create the mission. It is not the owner of the new
registry or mint.

1. Deploy `DePrizeRegistry` and `DePrizeMint` with the executive branch as
   the constructor owner. Deploy `DePrizeRedeem` against that registry. No
   proxy.
2. `prepareCondition(treasury, questionId, 7)`. Anyone can prepare it. The
   oracle argument is what names the treasury.
3. Create the market, seed 0.056 ETH, and `transferOwnership` to the
   executive branch.
4. `createMission` on the DePrize mission creator. `to` is the executive
   branch. `teamId` is 0. The project NFT and the pay hook are the
   executive branch's from the start.

The executive branch then signs, 4 of 5. Open is last. It freezes the roster
and starts betting.

5. `payHook.setDePrizeRegistry(newRegistry)`. One-way. The hook owner is the
   executive branch.
6. `registry.register(jbProjectId, teamIds, sunset)`.
7. `registry.setCondition(deprizeId, conditionId)`.
8. `mint.setMarket(deprizeId, market)`. Write-once.
9. `mint.setComplianceSigner` to the address of the existing
   `DEPRIZE_COMPLIANCE_SIGNER_KEY`. Bets revert until this is set.
10. `registry.open(deprizeId)`.

Five percent of each bet goes into the Juicebox project. Ninety-five percent
goes into the market.

After the broadcast, record every address, the condition id, the Juicebox
project id, and the deprize id in
[`DEPRIZE_ARBITRUM_ADDRESSES.md`](../DEPRIZE_ARBITRUM_ADDRESSES.md) and in
`ui/lib/deprize/competitions.ts`. Do not invent them in advance.

## Launchpad

`/launch` reads `MissionTable_42161_151`. This mission is created on
`DEPRIZEMISSION_42161_162`
(`0xC27f44B81057242140DB1a4eE4ADf02b1E193C87`).

The production mission creator `0x87e80c0d3a1D484A58f88f6383EF7E6FB333a64F`
writes the table `/launch` already reads, and its pay hooks cannot attach to
a DePrize. A mission created there would show up, and the prize pool would
not follow this prize. The DePrize mission creator is the one whose hooks
can latch.

`/launch` will also read `DEPRIZEMISSION_42161_162`. The four races already
in that table appear with this Touchdown. The internal demo, “The Moon is a
harsh mistress,” stays off the list. `/launch` is already public, so these
cards are visible while `/deprize` is still behind the password.

## Trading fee

The one percent fee sits as standalone WETH in the market. Trade principal
and the seed are escrowed in the Conditional Tokens contract.
`withdrawFees()` sends that standalone balance to the market owner, the
executive branch.

While the prize is live, and once at close, the executive branch signs:

1. `market.withdrawFees()`
2. Unwrap the WETH
3. Send the ETH to the treasury `0xAF26a002d716508b7e375f1f620338442F5470c0`

The treasury cannot pull the fee. The fee does not go into the Juicebox
pool. `DePrizeSweepFees` today prints a Juicebox `pay` for a live prize.
This prize's sweep prints a transfer to the treasury instead.

## Resolution

1. The executive branch pauses the market.
2. The executive branch calls `lock`, then `settleWinner` with the winning
   team id. That records who receives the purse. It does not pay backers.
3. The treasury calls `reportPayouts` with the question id above. Five of
   seven. This pays the backers. It has to come after the pause. Until the
   market is paused, trading stays open against a known result, and the
   treasury cannot pause it.
4. The executive branch sends the purse from the Juicebox project.
5. The executive branch closes the market, withdraws any remaining fee and
   sends it to the treasury, and redeems the leftover inventory. The
   recovered seed stays with the executive branch.

A `1` in every slot is the refund. A single `1` pays that slot. Slot 5 is
ispace.

## Left as they are

- The off-chain betting blocklist. The treasury Safe is already on it. Its
  signers, as personal wallets, are not, and this plan does not add them.
- The password gate on `/moonbase` and `/deprize`.
- DePrize 2 and the other prizes on the current registry. No `supersede`
  call on that registry. This prize is not a row in it.
