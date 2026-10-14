# DePrize market rebind (2026-09-11) and the "25% with bets" display

## Summary

On 2026-09-11 every DePrize was rebound from its pre-H-01 LMSR market to a new
market built from the fixed implementation (`ui/scripts/redeploy-h01-markets.ts`,
addresses in `DEPRIZE_ARBITRUM_ADDRESSES.md`). The new markets sit on the same CTF
conditions but start from their seed funding at even odds. Bets placed before the
rebind were not replayed into them.

Nothing is wrong with the money. Pre-rebind positions are CTF outcome tokens on
the same condition, so they redeem exactly as before when the DePrize resolves,
and they can be sold into the new market. What was wrong was the race page: it
showed the new market's odds next to stake totals that still counted the old
market's bets.

## What users saw

Arbitrum DePrize #1, 2026-10-14: every team at 25%, while the team rows showed
0.0107 ETH on LifeShip, 0.0019 ETH on The Mars Society and 0.0002 ETH on Space for
Humanity. Read as "the odds ignore the bets".

## Cause

| Source | What it reads | Market |
|---|---|---|
| Odds (`useDePrizeMarket`) | `calcMarginalPrice` on `marketOf(id)` | Current |
| Odds chart (`useOddsHistory`) | `AMMOutcomeTokenTrade` + funding logs on `marketOf(id)` | Current |
| Stakes, volume, backers (`useDePrizeActivity`) | `Bet` events on `DePrizeMint`, filtered by DePrize id | **Every market the DePrize was ever bound to** |

`DePrizeMint` emits `Bet` per DePrize id, not per market, so the stake column kept
counting bets that went to the old market.

## Arbitrum DePrize #1 on-chain

| | |
|---|---|
| Pre-H-01 market | `0x351aF5acfbC4df750B7bd58b4C4CBe94147aF211` |
| Current market | `0xB7fE1530D300C505295B42268e127ceea5aDe703`, started 2026-09-11 22:30 UTC, 0.04 ETH seed |
| Bets before the rebind | 5 bets, 0.0127 ETH, 2026-08-20 to 2026-08-27: 3 on LifeShip (0.0107), 1 on The Mars Society (0.0019), 1 on Space for Humanity (0.0002) |
| Bets on the current market | 0 as of 2026-10-14, so `calcMarginalPrice` is exactly 25.000% for all four outcomes |

None of the five bet transactions emit a trade on the current market. No other
Arbitrum DePrize had bets before the rebind. Sepolia (test network) markets were
rebound the same way.

## Fix in the UI

`splitBetsByMarket` (`ui/lib/deprize/activity-math.ts`) keeps a `Bet` only if its
transaction also carries an `AMMOutcomeTokenTrade` from the current market, because
the mint routes each bet into whichever market it is bound to at that moment.
Everything else is `priorBets`.

- Odds, stake per team, volume and backer count use current-market bets only, so
  they agree with the prices.
- The wallet's position and P&L, and the "backed with ETH" tag on callers, still
  include `priorBets`, because those tokens still pay out.
- The race page shows a notice with the count and ETH of earlier bets, and the date
  the current market opened.

This covers any future rebind without a hard-coded date.

## Not done: replaying the old positions

To make the current odds reflect the pre-rebind bets, an operator wallet can buy
the same net outcome amounts on the new market (about 0.013 ETH for Arbitrum #1).
The wallet then holds those tokens. Optional; nothing depends on it.
