# DePrize — Terms & Conditions (DRAFT)

> **Status: DRAFT for legal review.** This document adapts the public
> disclosure approach used by non-custodial prediction markets (notably
> Polymarket's resolution docs, help-center articles, and Terms of Service) to
> MoonDAO's DePrize. It is **not legal advice** and must be reviewed by counsel
> and reconciled with MoonDAO's existing Website Terms & Conditions and Privacy
> Policy before publication. Bracketed items (`[…]`) need MoonDAO-specific input.

Last updated: [DATE] · Effective: [DATE]

---

## 1. Acceptance of these Terms

By accessing or using DePrize (the "Service") — including connecting a wallet,
placing a bet, cashing out, or redeeming a position — you acknowledge that you
have read, understood, and agree to be bound by these Terms & Conditions (these
"Terms"), MoonDAO's [Website Terms & Conditions] and [Privacy Policy]. If you do
not agree, do not use the Service.

You represent that you are at least 18 years old (or the age of majority in your
jurisdiction) and that your use of the Service is lawful where you live.

## 2. What DePrize is

DePrize is a **non-custodial, on-chain prediction market**. For each challenge
("DePrize"), you buy and sell **outcome tokens** representing the teams/providers
competing to win. Prices move as people trade and reflect the market's collective
belief in each team's probability of winning — they are **not** a promise, a
guarantee, or investment advice.

- **Non-custodial.** MoonDAO never takes possession of the funds you trade with.
  Your outcome tokens and collateral are held by audited smart contracts and by
  your own wallet, secured by your private key. All trades, positions, and
  resolutions are recorded on-chain and are publicly verifiable.
- **Collateral.** Bets are denominated in **ETH** (wrapped to WETH internally).
- **How you trade.** Each DePrize is backed by an automated market maker
  (an LMSR market on the Gnosis Conditional Token Framework). You can buy a
  team's outcome tokens at the current price and, while the market is open, sell
  them back ("cash out") at the then-current price.

## 3. Outcome tokens — how they pay

Outcome tokens are ERC-1155 tokens on the Gnosis Conditional Token Framework
(CTF). When a DePrize with **N** teams resolves:

| Resolution | A team's outcome token redeems for |
|---|---|
| That team **wins** | its full share of the collateral (worth the most) |
| That team **loses** | **$0 — worthless** |
| **Cancelled / no eligible winner / delivery failure** | an **equal share: `1/N`** of the collateral per token (see §6) |

**Risk of total loss.** If the team you backed does not win, your outcome tokens
for that team expire **worthless** and you lose the entire amount you put into
that position. Prices reflect collective belief, not guaranteed outcomes. **Never
bet more than you can afford to lose.**

## 4. Each DePrize's rules are the contract

Every DePrize has **pre-defined, published rules** on its page that specify:

- the competing teams (outcome slots);
- the **resolution source and criteria** — how the winner is determined;
- the **sunset** time after which betting can be closed;
- edge cases, including how cancellation and a no-winner result are handled.

**The published rules — not the headline or marketing copy — govern how a DePrize
resolves.** You are responsible for reading a DePrize's rules before you bet. If
you cannot articulate exactly what must happen for a team to be declared the
winner, do not bet on that DePrize.

## 5. Resolution and finality

When a DePrize concludes, the outcome is reported on-chain by the
**MoonDAO-designated oracle / administrator** (a MoonDAO governance-controlled
Safe and the oracle address published for that market), strictly according to the
DePrize's published rules. Resolution proceeds through the on-chain lifecycle
(open → locked → settled/no-winner, or cancelled).

**Resolution is final and immutable.** Once the payout is reported on-chain, the
result **cannot be reversed, altered, or refunded** by MoonDAO, by you, or by any
third party. Redemption of a resolved position is **permissionless** — you (or
anyone) can redeem directly against the CTF contract; MoonDAO cannot block, claw
back, or reverse it.

## 6. Cancellation, no winner, and the equal-payout refund

A DePrize may end in a **refund-terminal** state — **cancelled**, **no eligible
winner declared**, or **delivery failed after the first milestone**. Cancellation
requires a **7-day public notice** window, during which new bets are paused.

In any refund-terminal state, the market resolves on an **equal-payout basis**:
the payout vector is `[1, 1, …, 1]`, so **every outcome token — whichever team you
backed — redeems for `1/N` of the collateral** (where N is the number of teams).
This is the same mechanism major non-custodial prediction markets use for
invalid/void markets (e.g., a binary market resolving "50/50," where every share
redeems for $0.50).

**What this means for you — read carefully:**

- The equal-payout refund is **based on the outcome tokens you hold, not on the
  ETH you paid.** It is **not** a return of your original stake.
- Because each token is worth `1/N`, the break-even price is `1/N` (the average /
  uniform implied probability). A position **acquired at odds above `1/N`** (a
  favorite) **will redeem for less than it cost** — you may recover materially
  less than you put in. A position acquired **below `1/N`** (an underdog) may
  redeem for **more** than it cost.
- Example (N = 3, so `1/N ≈ 33%`): a token bought at 86% odds redeems for ~33% of
  its price (a loss); a token bought at 3% odds redeems for ~11× its price.
- If you sold or transferred outcome tokens before resolution, only the tokens
  you **still hold** at resolution redeem.

You accept this equal-payout mechanism as the exclusive refund method for
refund-terminal DePrizes. MoonDAO does **not** guarantee return of principal on
cancellation and has no obligation to top up, backstop, or otherwise supplement
the on-chain equal-payout amount.

## 7. The 5% prize contribution (separate from your bet)

**5% of every bet** is routed to the DePrize's prize pool (a Juicebox project)
rather than to the trading market. In exchange, you receive that project's token
(currently **$OVERVIEW**) as the beneficiary of that contribution. This 5% is
**separate** from the 95% you trade with:

- it is **not** part of your outcome-token position and is **not** returned by the
  equal-payout refund in §6;
- if you are entitled to recover it (e.g., on cancellation), it is handled through
  the prize-pool token's own redemption path (e.g., burning your $OVERVIEW), which
  is independent of your market position.

## 8. Fees, slippage, and gas

- **Market fee.** The automated market maker charges a fee (typically ~1%) on the
  95% traded portion. It is not refundable.
- **Slippage.** Because prices are set by an automated market maker, larger bets
  move the price; the average price you pay can exceed the displayed odds.
- **Gas.** All on-chain actions (betting, cashing out, redeeming) require network
  gas fees paid by you. These are never recovered.

Displayed payouts, odds, and multiples are **estimates** and may change between
quote and execution.

## 9. Eligibility and prohibited jurisdictions

The Service is not available to persons in restricted or sanctioned
jurisdictions, and access may be geo-blocked. You are responsible for ensuring
that your use of the Service is legal in your jurisdiction. You represent that you
are not located in, or a resident of, any jurisdiction where use of the Service
is prohibited, and that you are not a sanctioned person. [Insert MoonDAO's
specific restricted-jurisdiction list.]

## 10. No advice; assumption of risk

Nothing on the Service is financial, investment, legal, or tax advice. DePrize is
provided **"as is"** and **"as available."** You alone are responsible for your
decisions and for evaluating each DePrize's rules and risks. You assume all risks
of using blockchain systems, including smart-contract bugs, oracle error or
disagreement, network congestion, wallet loss, and total loss of funds.

## 11. Limitation of liability

To the maximum extent permitted by law, MoonDAO, its contributors, and its
affiliates are not liable for any indirect, incidental, special, consequential,
or exemplary damages, or for any loss of funds, profits, or tokens, arising from
your use of the Service — including losses from market resolution, the
equal-payout refund mechanism, fees, slippage, or smart-contract behavior.
[Insert liability cap / governing-law / dispute-resolution clauses consistent
with MoonDAO's Website Terms & Conditions.]

## 12. Changes to these Terms

MoonDAO may update these Terms from time to time. Material changes will be posted
with an updated "Last updated" date. Your continued use of the Service after
changes take effect constitutes acceptance of the revised Terms. Changes do not
retroactively alter the on-chain rules of a DePrize you have already bet on;
those are governed by that DePrize's published rules at the time you bet.

---

### Appendix: mapping to the on-chain mechanism (for reviewers, not users)

- Outcome tokens: Gnosis CTF ERC-1155 positions bought via `DePrizeMint.bet()`
  (5% slice → Juicebox project; 95% → LMSR/CTF collateral).
- Winner resolution: payout vector `[0,…,1,…,0]` — winning tokens redeem 1:1.
- Refund-terminal resolution: payout vector `[1,1,…,1]` — each token redeems for
  `1/N` (`DePrizeRedeem` or direct `ctf.redeemPositions`).
- Finality: `ctf.reportPayouts` is write-once; redemption is permissionless.
- Lifecycle & 7-day cancellation notice: `DePrizeRegistry`.
