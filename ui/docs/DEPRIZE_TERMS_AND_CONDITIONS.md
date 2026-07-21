# DePrize — Terms & Conditions (DRAFT)

> **Status: DRAFT for legal review.** This document is drafted to be *consistent
> with and incorporated into* MoonDAO's existing legal documents — the
> [MoonDAO Website Terms and Conditions](https://docs.moondao.com/Legal/Website-Terms-and-Conditions)
> (the "**Agreement**"), the
> [MoonDAO Website Privacy Policy](https://docs.moondao.com/Legal/Website-Privacy-Policy),
> and MoonDAO's Launchpad campaign terms (e.g. the
> [Overview Effect Flight Terms and Conditions](https://docs.moondao.com/Legal/Overview-Effect-Flight/Overview-Effect-Flight-Terms-and-Conditions)).
> It is **not legal advice** and must be reviewed by counsel before publication.
> Bracketed items (`[…]`) need MoonDAO-specific input.

Effective Date: [DATE] · Last Updated: [DATE]

Organized by MoonDAO — moondao.com/deprize

---

## 1. Introduction and acceptance

These DePrize Terms & Conditions (these "**Terms**") govern your use of DePrize
(the "**Service**"), a prediction-market feature operated by **MoonDAO DAO LLC**
("**MoonDAO**," "**we**," "**our**," or "**us**"). These Terms are a supplemental
document that is **incorporated into, and form part of, the Agreement** (the
MoonDAO Website Terms and Conditions). Capitalized terms not defined here have the
meanings given in the Agreement (including "**Applicable Law**," "**Covered
Parties**," and "**MoonDAO™ Offerings**").

By accessing or using the Service — including connecting a wallet, placing a bet,
cashing out, or redeeming a position — you acknowledge that you have read,
understood, and agree to be bound by these Terms, the Agreement, and the Privacy
Policy in their entirety. **If you do not agree, do not use the Service.**

**Precedence.** These Terms control over the general Agreement solely with respect
to the DePrize-specific subject matter below (mirroring how Owner Agreements and
Contest Rules control for their subject matter under Section 27 of the Agreement).
In all other respects the Agreement governs.

## 2. Eligibility

The Service is available only to individuals who can enter into legally binding
contracts under Applicable Law and who are at least **eighteen (18) years old** (or
the age of majority in their jurisdiction, if greater), consistent with Section 1
of the Agreement.

Consistent with the Privacy Policy, **the Service is not available to users
located in the European Union or the United Kingdom**, and may be geo-blocked in
other restricted or sanctioned jurisdictions. You represent that you are not
located in, or a resident of, any jurisdiction where use of the Service is
prohibited, that you are not a sanctioned person or located in an embargoed
country, and that your use of the Service is lawful where you live. Prediction
markets may be regulated or prohibited in your jurisdiction; determining the
legality of your participation is **your sole responsibility** (Agreement,
Section 14 — Compliance with Laws).

## 3. What DePrize is

DePrize is a **non-custodial, on-chain prediction market**. For each challenge (a
"**DePrize**"), you buy and sell **outcome tokens** representing the teams competing
to win. Prices are set by an automated market maker and reflect the market's
collective belief in each team's probability of winning — they are **not** a
promise, guarantee, or investment advice.

- **Non-custodial.** MoonDAO never takes custody of the funds you trade with. Your
  outcome tokens and collateral are held by smart contracts and by your own wallet,
  secured by your private key. All trades, positions, and resolutions are recorded
  on-chain and are publicly verifiable.
- **Collateral.** Bets are denominated in **ETH** (wrapped to WETH internally).
- **How you trade.** Each DePrize is backed by an automated market maker (an LMSR
  market on the Gnosis Conditional Token Framework, "CTF"). While a DePrize is open
  you may buy a team's outcome tokens at the current price and sell them back
  ("cash out") at the then-current price.

## 4. Outcome tokens — how they pay

Outcome tokens are ERC-1155 tokens on the Gnosis CTF. For a DePrize with **N**
teams:

| Resolution | A team's outcome token redeems for |
|---|---|
| That team **wins** | its full share of the collateral |
| That team **loses** | **nothing — worthless** |
| **Cancelled / no eligible winner / delivery failure** | an **equal share: `1/N`** of the collateral per token (see Section 6) |

**Risk of total loss.** If the team you backed does not win, your outcome tokens
for that team expire **worthless** and you lose the entire amount put into that
position. Prices reflect collective belief, not guaranteed outcomes. As with
$MOONEY and $OVERVIEW, **outcome tokens are not investments, carry no expectation
of profit, and should not be treated as financial instruments.** **Never bet more
than you can afford to lose.**

## 5. Each DePrize's rules; resolution and finality

Every DePrize has **pre-defined, published rules** on its page specifying the
competing teams, the **resolution source and criteria**, the **sunset** time after
which betting can be closed, and how cancellation / a no-winner result are handled.
**The published rules — not the headline or marketing copy — govern how a DePrize
resolves.** You are responsible for reading a DePrize's rules before you bet.

When a DePrize concludes, the outcome is reported on-chain by the
**MoonDAO-designated oracle / administrator** (a MoonDAO governance-controlled Safe
and the oracle address published for that market), strictly per the DePrize's
published rules. **Resolution is final and immutable:** once the payout is reported
on-chain, the result cannot be reversed, altered, or refunded by MoonDAO, by you,
or by any third party. Redemption is **permissionless** — you (or anyone) can
redeem a resolved position directly against the CTF contract.

## 6. Cancellation, no winner, and the equal-payout refund

A DePrize may end in a **refund-terminal** state — **cancelled**, **no eligible
winner declared**, or **delivery failed after the first milestone**. Cancellation
requires a **7-day public notice** window, during which new bets are paused.

In any refund-terminal state, the market resolves on an **equal-payout basis**: the
payout vector is `[1, 1, …, 1]`, so **every outcome token — whichever team you
backed — redeems for `1/N` of the collateral** (N = number of teams). This is the
same mechanism major non-custodial prediction markets use for invalid/void markets
(e.g., a binary market resolving "50/50," where every share redeems for $0.50).

**What this means for you — read carefully:**

- The equal-payout refund is **based on the outcome tokens you hold, not on the ETH
  you paid.** It is **not** a return of your original stake.
- The break-even price is `1/N` (the average/uniform implied probability). A
  position **acquired at odds above `1/N`** (a favorite) **will redeem for less than
  it cost**; a position acquired **below `1/N`** (an underdog) may redeem for more.
  Example (N = 3, `1/N ≈ 33%`): a token bought at 86% redeems for ~33% of its price
  (a loss); a token bought at 3% redeems for ~11× its price.
- Only the tokens you **still hold** at resolution redeem.

Consistent with MoonDAO's Launchpad refund practice (e.g., Overview Effect Terms,
Section 8): **redemptions and refunds are made in ETH**, regardless of how you
acquired the ETH; **gas/transaction fees are your responsibility**; **no fiat
refunds are issued**; and MoonDAO is **not responsible** for changes in the value
of ETH (in fiat or otherwise) between the time you bet and the time you redeem.

You accept this equal-payout mechanism as the **exclusive** refund method for
refund-terminal DePrizes. MoonDAO does **not** guarantee return of principal on
cancellation and has no obligation to top up, backstop, or supplement the on-chain
equal-payout amount.

## 7. The 5% prize contribution (separate from your bet)

**5% of every bet** is routed to the DePrize's prize pool — a MoonDAO **Launchpad**
(Juicebox) project — rather than to the trading market. In exchange you receive
that project's governance token (currently **$OVERVIEW**) as the beneficiary of
that contribution. Consistent with the Overview Effect Terms (Section 3), that
governance token **is not a security, investment instrument, financial asset, or
currency**, carries **no expectation of profit**, and exists solely for governance.

This 5% is **separate** from the 95% you trade with. It is **not** part of your
outcome-token position and is **not** returned by the equal-payout refund in
Section 6. Any recovery of the 5% is governed by the bound Launchpad campaign's own
terms and refund mechanism (for example, burning your $OVERVIEW through the
Launchpad refund payhook to receive your proportional ETH back, minus fees, when a
refund window is enabled).

## 8. Fees, slippage, and gas

- **Market fee.** The automated market maker charges a fee (typically ~1%) on the
  95% traded portion; it is not refundable.
- **Slippage.** Because prices are set by an automated market maker, larger bets
  move the price, and the average price you pay can exceed the displayed odds.
- **Gas.** All on-chain actions require network gas fees paid by you and are never
  recovered.

Displayed payouts, odds, and multiples are **estimates** and may change between
quote and execution. Consistent with the Agreement, all fees are otherwise final
and non-refundable except as expressly stated in these Terms.

## 9. Assumption of risk

You acknowledge and accept the risks of using blockchain systems and the Service,
including: cryptocurrency price volatility between betting and redemption;
smart-contract vulnerabilities (even where audited); oracle error or disagreement;
network congestion and failed transactions; wallet loss or compromise; regulatory
change; and **total loss of funds**. These risks are consistent with, and
supplement, the risk disclosures in Section 19 of the Agreement.

## 10. Privacy and on-chain transparency

MoonDAO's collection and use of personal data are governed by the Privacy Policy.
You acknowledge that **on-chain activity — including your wallet address, bets,
positions, and redemptions — is public by nature and cannot be made private after
it is recorded on-chain** (consistent with Overview Effect Terms, Section 14).

## 11. No advice

Nothing in the Service or these Terms is financial, investment, legal, or tax
advice. The Service is provided **"as is"** and **"as available."** You are solely
responsible for evaluating each DePrize's rules and risks and for any tax
obligations arising from your participation; MoonDAO does not provide tax advice
(consistent with Overview Effect Terms, Section 9, and Section 14 of the Agreement).

## 12. Warranties, liability, indemnification, and dispute resolution

The following provisions of the Agreement are **incorporated by reference** and
apply to your use of the Service to the same extent as if restated here, including
losses arising from market resolution, the equal-payout refund mechanism, fees,
slippage, or smart-contract behavior:

- **Disclaimer of Warranties** — Agreement, Section 19.
- **Limitation of Liability** — Agreement, Section 20 (including the aggregate
  liability cap).
- **Indemnification** — Agreement, Section 18 (for the benefit of the Covered
  Parties).
- **Dispute Resolution Provisions** — Agreement, Section 25: **New York** governing
  law; binding **AAA arbitration in New York, NY**; **class-action waiver**; and the
  **30-day opt-out**. California users retain the rights described in Section 26 of
  the Agreement.

## 13. Changes to these Terms

MoonDAO may amend these Terms from time to time, consistent with Section 2 of the
Agreement. Material changes will be posted with an updated "Last Updated" date and
communicated through MoonDAO's official channels. Your continued use of the Service
after changes take effect constitutes acceptance. Amendments do not retroactively
alter (a) the on-chain rules of a DePrize you have already bet on, which are
governed by that DePrize's published rules at the time of your bet, or (b) the
Dispute Resolution Provisions or charges, as described in Section 2 of the
Agreement.

## 14. General provisions

Severability, entire agreement (as to DePrize subject matter, together with the
Agreement), no waiver, force majeure, and no employment/agency relationship apply
as set out in Section 27 of the Agreement and Section 17 of the Overview Effect
Terms. The "MoonDAO," "$MOONEY," and "Moonlist" marks are trademarks of LuckDAO
Limited d/b/a MoonDAO.

## 15. Contact

Questions about these Terms: **info@moondao.com** — MoonDAO, 398B Capp St., San
Francisco, CA 94110 (consistent with Section 28 of the Agreement).

---

## 16. Acknowledgment

By using DePrize, you acknowledge and agree that:

1. You have read, understood, and agree to these Terms, the Agreement, and the
   Privacy Policy in their entirety.
2. Outcome tokens and the $OVERVIEW governance token are **not** securities,
   investments, or financial assets and carry no expectation of profit.
3. If your team does not win, your position can become **worthless** — you may lose
   your entire stake.
4. If a DePrize is cancelled or resolves with no winner, it resolves on an
   **equal-payout (`1/N` per token)** basis in ETH — **not** a return of your
   original stake — and a bet placed above the average (`1/N`) may redeem for less
   than you put in.
5. Resolution is **final and immutable**, and redemption is permissionless.
6. You are solely responsible for the legality of your participation under
   Applicable Law, and the Service is not available in the EU, the UK, or other
   restricted jurisdictions.
7. Refunds/redemptions are in ETH; gas is your responsibility; no fiat refunds.

---

### Appendix: mapping to the on-chain mechanism (for reviewers, not users)

- Outcome tokens: Gnosis CTF ERC-1155 positions bought via `DePrizeMint.bet()`
  (5% slice → Juicebox/Launchpad project; 95% → LMSR/CTF collateral).
- Winner resolution: payout vector `[0,…,1,…,0]` — winning tokens redeem 1:1.
- Refund-terminal resolution: payout vector `[1,1,…,1]` — each token redeems for
  `1/N` (`DePrizeRedeem` or direct `ctf.redeemPositions`).
- Finality: `ctf.reportPayouts` is write-once; redemption is permissionless.
- Lifecycle & 7-day cancellation notice: `DePrizeRegistry`.
- Canonical published location: `https://docs.moondao.com/Legal/DePrize-Terms-and-Conditions`
  (linked from the bet flow via `DEPRIZE_TERMS_URL`).
