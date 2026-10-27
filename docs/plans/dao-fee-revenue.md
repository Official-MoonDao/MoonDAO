---
name: dao fee revenue
overview: 'Raise the DePrize trading fee to 2% on new markets, sweep it to the treasury without a monthly Safe batch, take the launchpad treasury fee when contributions arrive instead of at payout, and run more races on the same contracts. Nothing in this plan is deployed.'
todos:
  - id: fee-2pct
    content: 'Decide the fee before the Touchdown broadcast. Set FEE to 2e16 in the provision script and DePrizeVerify, and update the Terms, Prize Rules, and fee copy'
    status: pending
  - id: auto-sweep
    content: 'Enable a Zodiac Roles keeper on the executive branch scoped to withdrawFees and a WETH transfer to the treasury, and run it on a schedule'
    status: pending
  - id: exit-sweep
    content: 'Stop the post-sell fee router sweep in ExitPositionModal for v2 prizes'
    status: pending
  - id: mission-fee
    content: 'Take 2.5% at contribution in LaunchPadPayHook for non-DePrize missions, drop the payout treasury split, and deploy a new MissionCreator'
    status: pending
  - id: ladder
    content: 'Make the Touchdown provision script take a race spec so later rungs reuse the registry and mint'
    status: pending
  - id: revenue-copy
    content: 'Update the treasury revenue labels and the executive branch financial summary'
    status: pending
isProject: false
---

# DAO fee revenue

The trading fee is the DAO's passive income. This plan makes it larger,
collects it without a monthly signing round, and adds an earlier launchpad
fee. It does not add any charge on the stake or on winners.

## What the treasury earns today

| Source | Rate | Where it goes |
|---|---|---|
| DePrize trading fee | 1% of each buy and sell | Sits in the market. The owner withdraws it. For the public Touchdown the executive branch sends it to the treasury by hand ([`touchdown-arbitrum-public.md`](./touchdown-arbitrum-public.md)) |
| DePrize prize slice | 5% of each bet | Juicebox prize pool. Not the treasury |
| Launchpad payout split | 2.5% | Treasury, but only when a successful mission takes payouts (`MissionCreator` ruleset 1, split group `0xEEEe`). Nothing on refunded missions |
| DePrize purse | — | Leaves through the ruleset 0 surplus allowance, so the 2.5% payout split never applies. Keep it that way. The prize is the product |

The Touchdown go-to-market target is about $200k of bets and $350k of later
trading. At that volume the treasury takes roughly $5k at a 1% fee and
roughly $11k at 2%.

## 1. A 2% trading fee on new markets

The fee is charged on every buy and every sell. It does not grow when a
favorite wins, so it does not make correct favorite bets lose money the way a
cut of winnings does. 2% is at the top of Polymarket's range and below
Kalshi's peak of about 3.5% near even odds. With the 5% prize slice, a bet
costs about 7% to enter instead of 6%.

The fee is the `fee` argument to `createLMSRWithTWAP`. The owner can call
`changeFee` only while the market is paused. Do not use that on a live
market. Decide the fee before the Touchdown broadcast. Existing markets stay
at 1%.

Changes:

- `ui/scripts/provision-touchdown-arbitrum-public.cjs`: `FEE` becomes
  `2e16`. The post-deploy check reads the same constant.
- `subscription-contracts/script/deprize/DePrizeVerify.s.sol`: the
  `lmsr.fee == 1e16` assertion takes the expected fee from the environment.
- `StockLmsrFork` runs with `FEE = 2e16`. ETH must still be conserved to
  the wei.
- Terms 11.1 says “approximately 1%”. Change it to 2% for markets created
  after this date.
- The Terms definition of Prize Pool and Prize Rules 6.1(c) say market fees
  go to the prize pool while a DePrize is live. The Touchdown plan already
  sends them to the treasury, so this text is wrong for that prize whatever
  the rate is. Rewrite both.
- Confirm that the bet and sell quotes read `fee()` from the market and do
  not assume 1%. Check the “Market fee” line in `deprize-play.tsx`.

## 2. Automatic sweep to the treasury

Today the executive branch signs a three-call batch printed by
`DePrizeSweepFees.s.sol` with `DEPRIZE_FEE_TREASURY` set. That is 4 of 5
signers for a routine transfer.

v2 removed `DePrizeFeeRouter` on purpose. The audit found the one High
issue in MoonDAO's own code around the market, and the go-to-market gates
G4 and G7 depend on stock Gnosis markets owned directly by the Safe. A new
contract that owns the market undoes that. This plan therefore uses a Safe
module and keeps the market owned by the executive branch.

**Zodiac Roles keeper (chosen).** Enable the Zodiac Roles Modifier v2 on the
executive branch Safe. Give one keeper address a role that allows only:

1. `withdrawFees()` on each listed market address
2. `WETH.transfer(to, amount)` where `to` is the treasury
   `0xAF26a002d716508b7e375f1f620338442F5470c0`

The treasury receives WETH. Skipping the unwrap leaves one call to scope.
The keeper key holds gas only. At worst it sweeps early, and an early sweep
still pays the treasury. A scheduled job runs the sweep weekly when the
balance is above a floor that covers gas. Each new market is added to the
role in the same executive branch batch as `setMarket`.

Enabling a module is a Safe-level change. The signers review the role
config before enabling it. That config is the new security surface.

**Sweeper contract (not chosen).** A contract owns the market. Anyone can
call `sweep`, and it can only pay the treasury. The executive branch keeps
pause, resume, and close through it. This also takes `changeFee`,
`changeFunding`, and an unrestricted `withdrawFees` away from the executive
branch. It puts a MoonDAO contract back in the value path. It needs an
ERC-1155 receiver for `close`, fork tests, a `SurfaceAllowlist` update, and
an audit note. Revisit it only if removing those executive branch powers
becomes the goal. It can be adopted later with one `transferOwnership`.

**Post-sell sweep.** `ExitPositionModal.tsx` calls `sweepFees` on
`DEPRIZE_FEE_ROUTER_ADDRESSES` after every sell. For a v2 prize this targets
the v1 router with the wrong id. It is caught, but it costs the seller a
wallet prompt and gas. Skip it when the prize is on the v2 registry.

## 3. The launchpad fee at contribution

For new missions only. `createMission` deploys a new `LaunchPadPayHook` for
each mission, and those hooks are immutable. Live missions keep the payout
split.

- `LaunchPadPayHook.beforePayRecordedWith`, non-DePrize branch: return one
  `JBPayHookSpecification` that forwards `amount * 250 / 10_000` to a
  `TreasuryPayHook`. Scale `weight` by `9_750 / 10_000` so tokens track the
  money that stays. `beforeCashOutRecordedWith` sizes refunds from
  `funding * weight`, so an unscaled weight would mis-size refunds.
- The DePrize branch does not change. No fee on the bet slice or on direct
  contributions to a prize.
- New `TreasuryPayHook`: implements `IJBPayHook`, has an immutable treasury
  address, and forwards `msg.value` in `afterPayRecordedWith`. Juicebox does
  not take its 2.5% on amounts forwarded to pay hooks
  (`JBMultiTerminal._fulfillPayHookSpecificationsFor`), so the treasury gets
  the full 2.5%.
- `MissionCreator`: remove the treasury payout split so a mission is not
  charged twice. The 5% liquidity pool split and the 90% split are written as
  amounts after the Juicebox fee. Recompute them, then deploy a new creator.
  Check that the new creator can write `MissionTable_42161_151`, and point
  the UI at it.
- `_totalFunding` now counts the money the mission keeps. Treat
  `fundingGoal` as that amount and say so in the create flow.
- A refunded contributor gets 97.5% back. That is where the new income comes
  from. Disclose it in `LaunchpadFAQs.tsx` and the mission terms.
- Confirm cross-chain pays go through the same terminal and hook.

Tests: hook unit tests for the forwarded amount and the scaled weight. A fork
test that pays, refunds, and takes payouts, and checks the stage changes at
the goal.

`subscription-contracts/` and `ui/` change together here. Ship the contract
and its deploy in one PR, and the UI pointer and copy in a second.

## 4. More races on the same contracts

The fee grows with trading volume, not with the number of prizes. Each
ladder rung needs a new condition with the treasury as oracle, a new market
at the chosen fee, a seed, and a new DePrize mission. It registers on the
same v2 registry and mint. Turn the Touchdown provision script into a script
that takes a race spec: question id string, roster, seed per name, sunset,
and funding goal.

## Order

1. Decide the fee. This blocks the Touchdown broadcast in
   [`touchdown-arbitrum-public.md`](./touchdown-arbitrum-public.md).
2. Launch Touchdown with the manual sweep. The script already pays the
   treasury.
3. Add the Roles keeper and drop the post-sell sweep.
4. Ship the launchpad fee as its own pair of PRs.
5. Provision ladder rungs from the race spec.

## Decisions needed

- 2%, or stay at 1% or 1.5%.
- Roles keeper, or a sweeper contract that also takes fee and funding
  control away from the executive branch.
- The launchpad fee rate, whether it stays with the treasury on refunds,
  and whether the funding goal counts gross or net contributions.

## Not doing

- A second 5% slice to the treasury. It doubles the entry cost.
- A 10% fee for selling early. It traps people in positions that have
  gone stale and makes prices worse.
- A share of winnings or of winning tokens. It makes correct bets on
  favorites lose money.
