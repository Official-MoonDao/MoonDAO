# DePrize — Legal Analysis and Compliance Recommendations

> **Status: internal working analysis for MoonDAO leadership and outside counsel.**
> Prepared September 10, 2026 from the DePrize design documents (`docs/DEPRIZE.md`,
> `docs/DEPRIZE_ROSTER_CHANGES.md`), the deployed/planned contracts (`prediction/`,
> `ui/lib/deprize/`), MoonDAO's existing legal documents, and public regulatory and
> case-law sources current as of the date above.
>
> **This document is not legal advice.** It is a structured issue-spotting memo intended
> to make a review by licensed counsel faster and cheaper. Several conclusions depend on
> unsettled law (there is an active federal circuit split and pending CFTC rulemaking on
> exactly the questions DePrize raises). Counsel qualified in U.S. derivatives law (CEA /
> CFTC), U.S. state gaming law, U.S. securities law, sanctions/AML, U.S. tax, privacy,
> and Republic of the Marshall Islands (RMI) entity law should review before DePrize
> accepts real-money bets from the public.
>
> Companion documents produced with this analysis (published under `ui/content/docs/Legal/DePrize/`):
>
> | Document | Audience | Purpose |
> |---|---|---|
> | DePrize Terms and Conditions | Bettors / market participants | Contract governing use of the market |
> | DePrize Official Prize Rules | Competitors / prize recipients | Eligibility, judging, milestones, payment |
> | DePrize Privacy Notice | Everyone | DePrize-specific data practices (supplements the Website Privacy Policy) |
> | DePrize Risk Disclosures and Disclaimers | Everyone; UI & marketing | Short-form disclosures to surface at point of bet and in marketing |

---

## 0. Executive summary

DePrize combines three legally distinct activities in one product:

1. **A real-money prediction market** (binary outcome tokens on the Gnosis Conditional
   Token Framework, priced by an LMSR automated market maker, denominated in ETH/WETH).
2. **A prize competition** (a milestone-based cash prize paid from a Juicebox/Launchpad
   pool to whichever team the MoonDAO Senate declares the winner).
3. **A token distribution** (5% of every bet buys the bettor the governance token of the
   Launchpad mission that DePrize is bound to — the "**mission token**"; $OVERVIEW for the
   first DePrize, a different token for any other bound mission).

Each activity has its own regulatory regime, and the combination creates issues that
neither a plain prediction market nor a plain prize competition would face on its own.

**Highest-risk findings**

| # | Finding | Why it matters | Recommended posture |
|---|---|---|---|
| 1 | **U.S. persons cannot lawfully be offered DePrize outcome tokens** unless traded on a CFTC-registered exchange. Outcome tokens on the occurrence of a future event are "swaps" (event contracts) under CEA § 1a(47); CEA § 2(e) makes it unlawful for a non-eligible-contract-participant to enter into a swap other than on or subject to the rules of a designated contract market (DCM). The CFTC's January 2022 order against Polymarket (an on-chain, non-custodial market) is directly on point. The alternative characterization — that the tokens are **bets** — puts them under state anti-gambling statutes (e.g., N.Y. Penal Law § 225.00(2), "a future contingent event not under his control or influence"), which is worse, not better. | Enforcement risk against MoonDAO DAO LLC and, under *CFTC v. Ooki DAO*, potentially against individual governance participants. | **Exclude U.S. persons** from trading (geo-block, attestation, IP/VPN and wallet controls) unless and until DePrize markets are listed on a registered DCM or Congress/the CFTC create an applicable exemption. |
| 2 | **Several non-U.S. regulators now treat prediction markets as unlicensed betting.** UK Gambling Commission (Feb. 4, 2026 statement: a prediction market is a "betting intermediary"; operating without a licence is a criminal offence), Australia (ACMA warning Aug. 4, 2026; ISP blocking under the Interactive Gambling Act 2001), New Zealand (DIA: "bookmaking"/remote interactive gambling), Singapore (site blocking since Jan. 2025), Canada (CSA/CIRO: event contracts are derivatives; provincial gaming law), and multiple EU member states. | Criminal exposure for the operator; enforcement via ISP blocks and payment/marketing bans. | Adopt a **Restricted Jurisdictions schedule** at least as broad as the block lists used by the largest offshore prediction market, and refuse trades from those locations. |
| 3 | **MoonDAO is not a neutral venue.** The treasury seeds the LMSR (so MoonDAO is the counterparty to net bettor profits), MoonDAO sweeps the 1% market fee, the MoonDAO Safe is the on-chain oracle, and vMOONEY holders (some with disclosed financial interests, e.g. the Overview Effect Organizing Entity) vote on the winner. | This is the profile regulators describe as a "house" or "bookmaker," and it is the conflict-of-interest fact pattern the CFTC's June 2026 proposed rule flags (settlement must be "clear, objective, and publicly verifiable"; insider/"concentration of insight" risk). | Disclose every role plainly; publish objective resolution criteria; adopt a **trading blackout for insiders**; add a pre-resolution **public challenge window** (because `reportPayouts` is write-once); put a **timelock** on `DePrizeRegistry` upgrades. |
| 4 | **Market resolution and prize eligibility are coupled.** Competitors are listed without consent; a government agency (NASA, CNSA, ESA, JAXA) or a sanctioned/embargoed entity could "win" the market. MoonDAO cannot lawfully pay a prize to a sanctioned person, and government agencies generally cannot accept it. | OFAC strict liability on payment; contract impossibility; bettor disputes if the market resolves one way and the prize goes another. | **Decouple**: the market resolves on the published objective event; the prize is paid only to a *Prize-Eligible Winner* that passes KYC/sanctions screening and signs a Prize Acceptance Agreement. Define what happens to the pool otherwise. |
| 5 | **The 5% slice sells a governance token with a contingent redemption right.** The token is the bound mission's own project token (the "mission token" — $OVERVIEW for the first DePrize, something else for any other mission), and its holders can `cashOut` against the ETH pool in refund-terminal states. A token that conveys a claim on a pool of assets managed by others sits uneasily inside the SEC's March 2026 non-security categories (digital commodities / collectibles / tools), which are defined by the *absence* of "rights to future income, profits, or assets" of an enterprise. | Unregistered securities-offering risk (Howey still governs; the SEC's August 2026 Proposed Regulation Crypto Assets is not yet effective). | Keep U.S. persons out; re-frame the 5% as a non-refundable **prize contribution**; consider making bettors' mission tokens non-transferable or omitting the token distribution; obtain securities counsel sign-off on each bound mission's token before launch. |
| 6 | **The Terms are browse-wrap and unenforceable as written.** `BetModal` links to a Terms URL that returns 404, and nothing requires assent. Courts routinely refuse to enforce terms without conspicuous notice plus an affirmative act (*Nguyen v. Barnes & Noble*, *Berman v. Freedom Financial*, *Meyer v. Uber*). | Arbitration clause, class waiver, liability cap, and jurisdictional representations would all be at risk. | **Click-wrap** at the point of bet (checkbox + versioned Terms link), with server-side logging of wallet, Terms version, timestamp and IP-derived country. Implemented in this PR. |
| 7 | **The Website Privacy Policy is inaccurate for this product.** It states MoonDAO uses no cookies or tracking; the site uses Google Analytics (gtag, consent mode), Vercel Analytics, a cookie-consent banner, Privy authentication, and IP-geolocation via `ipapi.co` cached in Upstash Redis. | Deceptive-practice exposure (FTC Act § 5, state UDAP), and it undermines the "consent" the cookie banner purports to collect. | Publish a **DePrize Privacy Notice** (this PR) and correct the Website Privacy Policy (recommendation; not edited here). |

**Bottom line.** DePrize can launch responsibly as a non-U.S., non-restricted-jurisdiction
product with (a) affirmative acceptance of the Terms, (b) a geo/sanctions gate in front of
`bet()`, (c) hard separation between market resolution and prize eligibility, (d) insider
trading and conflict-of-interest rules that are actually enforced, and (e) accurate privacy
disclosures. Offering it to U.S. persons requires either a registered venue partner or a
change in law; neither exists today.

---

## 1. Facts that drive the legal characterization

The analysis depends on how money and decisions flow. The following is drawn from
`docs/DEPRIZE.md`, `prediction/`, and `ui/lib/deprize/`.

### 1.1 Money flows

- A bettor calls `DePrizeMint.bet()` with ETH.
  - **5%** is paid to the Juicebox/Launchpad project of the mission that DePrize is bound
    to (the prize pool), identified by the `jbProjectId` recorded in `DePrizeRegistry`. The
    bettor receives **that project's** governance token — the "mission token" — at a
    materially lower rate than the campaign's original contributors (for the first DePrize,
    whose bound mission is the Overview Effect launchpad, 50 $OVERVIEW per ETH versus
    1,000). Neither the contracts nor the UI hardcode a token: the front end resolves the
    symbol from the project at runtime.
  - **95%** is wrapped to WETH and used to buy Gnosis CTF outcome tokens (ERC-1155) from
    an `LMSRWithTWAP` market. The LMSR charges a built-in ~1% fee.
- **Fee sweep.** `DePrizeFeeRouter` sweeps the LMSR fee to the prize pool while the market
  is live and to the MoonDAO treasury in terminal states.
- **Liquidity.** MoonDAO's treasury funds the LMSR (on the order of 1 ETH per team,
  bounded loss). Net bettor profits therefore come, in part, from MoonDAO; net bettor losses
  accrue, in part, to MoonDAO. **MoonDAO is the market-making counterparty.**
- **Prize payout.** On a winner declaration the Safe disburses the Juicebox pool in two
  tranches (30% at Milestone 1, 70% at Milestone 2) to the winner's `providerPayoutAddress`.
  Milestone 2 has an 18-month deadline (extendable by 6 months).
- **Mission-token cashOut** is gated (100% tax) while the campaign is live and enabled only
  in refund-terminal states.

### 1.2 Decision flows

- **Roster.** Competitors are listed "at MoonDAO's editorial discretion" without their
  consent. An **Open Field** outcome slot (team id 999) pays if a qualifying entrant not on
  the roster wins. Long races proceed in **generations**; superseded generations become
  sell-only.
- **Resolution.** The **Eligibility Review Committee (ERC)** issues a non-binding memo;
  the **Senate** (vMOONEY-weighted vote) declares the winner or "no winner"; the **MoonDAO
  admin Safe** — the oracle address baked into the CTF `conditionId` — calls
  `reportPayouts`. `reportPayouts` is **write-once**; there is no on-chain appeal.
- **Terminal states.** `SETTLED` → winner vector `[0,…,1,…,0]`; bettors redeem at
  `SETTLED`/`M1_RELEASED` and do not wait for Milestone 2. `CANCELLED` and `NO_WINNER` →
  equal-payout vector `[1,…,1]` (every outcome token redeems for `1/N` of collateral —
  **not** a refund of stake). `M2_FAILED` is reached only after the market has already been
  resolved to a winner; it affects the **prize pool and project token only** (70% of the
  prize returns to the Juicebox project and `cashOut` is enabled), not outcome tokens.
  Cancellation requires a 7-day on-chain notice. The state machine has **no state for
  "winner declared but not prize-eligible/unpayable"** — see § 7.1 and Appendix B.
- **Upgrades.** `DePrizeRegistry` is UUPS-upgradeable and `Ownable` with **no timelock**.

### 1.3 Who the participants are

| Role | Legal significance |
|---|---|
| **Bettors** | Retail counterparties to a swap/bet; consumers under UDAP law; data subjects. |
| **MoonDAO DAO LLC** (RMI) | Operator, market maker, fee recipient, oracle, prize sponsor, data controller. |
| **Senators / vMOONEY voters** | Decision-makers on resolution; potential insiders; potential "members" of the DAO for liability purposes. |
| **ERC members** | Insiders with material non-public information (MNPI) before resolution. |
| **Competitors** | Non-consenting subjects of the market; some control the outcome (their own success); potential prize recipients; potential insiders. |
| **Launchpad campaign / Organizing Entity** | Receives the pool; has a financial interest in the prize being awarded or not; Frank White is both a Senator and the beneficiary of the Overview Effect campaign. |

### 1.4 Controls that exist today vs. do not

| Control | Status |
|---|---|
| Password gate on `/deprize`, `/deprize-play` | Exists (UI only; contracts are permissionless). |
| EU/UK region block | Exists for GDPR reasons on some routes; **not** applied to betting. |
| Geo-block of U.S. and other restricted jurisdictions for betting | **Not built.** `docs/DEPRIZE.md` lists it as a mitigation ("Geo-block US + selected jurisdictions… Click-through ToS") but no code implements it. |
| Sanctions/OFAC wallet screening | **Not built.** |
| Click-through acceptance of Terms | **Not built** before this PR (link only, and the link 404s). |
| Per-wallet / per-transaction bet caps | **Not built** (listed as an open question). |
| Insider trading blackout | **Not built** (no defined insider list). |
| Upgrade timelock | **Not built.** |
| Prize recipient KYC / sanctions / tax forms | **Not defined** in the docs or contracts. |

---

## 2. U.S. federal derivatives law (Commodity Exchange Act)

### 2.1 Framework

- **Event contracts are swaps.** CEA § 1a(47)(A)(ii) defines "swap" to include any
  agreement that "provides for any purchase, sale, payment, or delivery … that is dependent
  on the occurrence, nonoccurrence, or the extent of the occurrence of an event or
  contingency associated with a potential financial, economic, or commercial consequence."
  Contingencies are "excluded commodities" under § 1a(19)(iv). Binary outcome tokens on
  "which team will achieve X first" fit this definition on their face.
- **Retail swaps must be on a DCM.** CEA § 2(e) (7 U.S.C. § 2(e)): "It shall be unlawful
  for any person, other than an eligible contract participant, to enter into a swap unless
  the swap is entered into on, or subject to the rules of, a board of trade designated as a
  contract market under section 5." Most individuals are not eligible contract participants
  (ECPs) — the ECP test requires roughly $10 million invested on a discretionary basis
  (§ 1a(18)).
- **Operating an unregistered venue is separately unlawful.** CEA § 5h (SEF registration)
  and § 4(a) (off-exchange futures/options). The CFTC has treated binary event contracts
  offered to retail as illegal off-exchange **options** as well as swaps.
- **The Special Rule.** CEA § 5c(c)(5)(C) and Rule 40.11 (17 C.F.R. § 40.11) let the CFTC
  prohibit event contracts that "involve" terrorism, assassination, war, **gaming**,
  activity unlawful under law, or that are otherwise contrary to the public interest.

### 2.2 Directly analogous enforcement: *Polymarket* (2022)

On January 3, 2022 the CFTC issued an order against Blockratize, Inc. d/b/a Polymarket
for offering off-exchange event-based binary options via smart contracts on Polygon. The
order found the markets were swaps required to be traded on a registered venue, imposed a
$1.4 million civil monetary penalty, and required Polymarket to wind down non-compliant
markets. Polymarket's architecture — non-custodial smart contracts, an AMM/CTF design,
outcome tokens redeemable 1:1 — is essentially DePrize's architecture. Polymarket has since
excluded U.S. persons from its offshore platform and entered the U.S. market only through
a CFTC-registered DCM (QCX LLC).

### 2.3 The 2026 landscape

- **Circuit split on state preemption (relevant to the "bet" characterization).**
  - *KalshiEX LLC v. Flaherty*, 172 F.4th 220 (3d Cir. Apr. 2026): the CEA gives the CFTC
    exclusive jurisdiction over event contracts listed on a DCM; New Jersey's sports
    wagering law is preempted as applied.
  - *KalshiEX LLC v. Assad*, No. 25-7516 (9th Cir. Aug. 28, 2026): sports-outcome
    contracts are bets; the Special Rule / Rule 40.11 bar contracts that "involve" gaming;
    Nevada may enforce its gaming law. New Jersey filed a certiorari petition on September
    2, 2026.
  - The CFTC and DOJ have sued several states (Arizona, Connecticut, Illinois, New Mexico,
    New York, Minnesota, Rhode Island, Wisconsin) over state enforcement against
    DCM-listed event contracts.
  - **Takeaway for DePrize:** every one of these cases concerns contracts listed on a
    *registered* DCM. Nothing in the split helps an unregistered venue. If the tokens are
    swaps, § 2(e) is violated; if they are bets, state law applies; DePrize loses either way
    with respect to U.S. persons.
- **CFTC rulemaking.** The CFTC issued an Advance Notice of Proposed Rulemaking on event
  contracts on March 12, 2026 (91 Fed. Reg. 12516, Mar. 16, 2026) and a Notice of Proposed
  Rulemaking on June 10, 2026 (RIN 3038-AF65; published June 12, 2026) amending Rule 40.11
  and Appendix F. Key features:
  - A definition of "gaming" centered on contests of recreation, games conducted under
    rules, and outcomes turning on luck, skill or athletic ability. The NPRM's preamble
    indicates that contracts on outcomes like the Nobel Prize or the Academy Awards are
    *not* gaming. A technology-milestone race (a robotic lunar landing, a crewed flight) is
    closer to those examples than to sports.
  - A definition of "involve" and a set of **public-interest factors**, including whether
    settlement is "clear, objective, and publicly verifiable," whether there is a risk of
    insider trading or a **"concentration of insight"** among a small group of people who
    control the outcome, and whether the contract serves a hedging or price-discovery
    function.
  - A 90-day review mechanism and the possibility of delisting.
  - **Takeaway:** even if DePrize were on a DCM, a market whose settlement depends on a
    discretionary Senate vote, whose outcome is controlled by a handful of identifiable
    companies, and where the venue's own governance participants have MNPI, would score
    poorly on these factors. Objective, publicly verifiable resolution criteria and strict
    insider rules are needed regardless of venue.
- **Insider trading enforcement has begun.** *CFTC v. Van Dyke*, 26 Civ. 3369 and
  *United States v. Van Dyke*, 26 Cr. 156 (S.D.N.Y., filed Apr. 23, 2026) and the
  Spagnuolo matters (May 27, 2026) are the first civil and criminal insider-trading actions
  involving event contracts, charged under CEA § 6(c)(1) and Rule 180.1 (fraud/manipulation)
  and the CEA's MNPI-misappropriation provisions (§ 4c(a)(3)–(4)). Kalshi and Polymarket
  published insider-trading rules in March 2026. Any DePrize market where competitors,
  ERC members, Senators or MoonDAO staff can trade is exposed to the same theory.
- **Legislation.** The CLARITY Act (H.R. 3633) passed the House on July 17, 2025 and was
  reported by Senate Banking on June 1, 2026; a cloture vote on the motion to proceed is
  scheduled for September 15, 2026. It is **not law** and, as reported, does not create a
  retail exemption for unregistered event-contract venues.

### 2.4 Conclusions and recommendations (CEA)

1. **Do not offer outcome tokens to U.S. persons.** Implement: (a) IP geo-blocking of the
   U.S. and its territories at the UI and API layer for all betting actions; (b) a
   contractual representation and per-bet attestation that the user is not a U.S. person
   and is not located in the U.S.; (c) VPN/proxy/datacenter-IP detection; (d) refusal to
   market to U.S. persons; (e) a server-issued "compliance signature" required by
   `DePrizeMint.bet()` so the on-chain entry point cannot trivially bypass the UI gate
   (design option — evaluate gas/UX cost).
2. **Do not describe the product with the vocabulary of investing** ("returns," "yield,"
   "earn," "invest") or of a licensed exchange ("exchange," "trading venue," "broker").
3. **Consider a compliant U.S. path** only via a registered DCM partner listing the DePrize
   question, with MoonDAO acting solely as prize sponsor/data provider.
4. **Be precise that the CFTC's "not gaming" reasoning is not a safe harbor.** It matters
   only to contracts already on a DCM.

---

## 3. U.S. state gambling and prize-promotion law

### 3.1 Gambling statutes

If outcome tokens are not swaps, they are bets. New York (MoonDAO's chosen governing law)
is illustrative:

- N.Y. Penal Law § 225.00(2): a person engages in gambling when he "stakes or risks
  something of value upon the outcome of a contest of chance **or a future contingent event
  not under his control or influence**, upon an agreement or understanding that he will
  receive something of value in the event of a certain outcome." No chance element is
  required for the "future contingent event" prong; a bet on which company lands on the
  Moon first qualifies.
- § 225.05 (promoting gambling in the second degree) and § 225.10 (first degree, bookmaking
  of more than five bets totaling more than $5,000 in a day) apply to whoever "advances or
  profits from unlawful gambling activity." Seeding the LMSR and sweeping fees is
  "profiting from" the activity in the statutory sense.
- Most states have a comparable definition. Skill-contest exceptions do not help, because
  the bettor's skill does not influence the outcome.

State attorneys general and gaming commissions issued cease-and-desist letters to
prediction-market operators throughout 2025–2026 (Nevada, New Jersey, Maryland, Ohio,
Illinois, Massachusetts and others). Those actions targeted registered DCMs; an unregistered
on-chain venue would be a much easier target.

### 3.2 Prize-promotion statutes (the prize side)

- The DePrize **prize** is a competition of skill (achieving a technical milestone) with no
  entry fee and no chance element. It is therefore generally **not** a lottery or a
  sweepstakes, and the registration/bonding statutes for chance-based promotions (N.Y. Gen.
  Bus. Law § 369-e; Fla. Stat. § 849.094; R.I. Gen. Laws § 11-50-1 — all triggered at
  prizes over $5,000) should not apply. Counsel should confirm, because the roster is
  selected by MoonDAO and the "Open Field" mechanism could be argued to introduce
  discretion.
- **Truth in advertising** (FTC Act § 5; state UDAP statutes) applies to all prize claims.
  The prize amount is variable, denominated in ETH, paid in tranches, contingent on
  milestones, and subject to MoonDAO governance. Marketing must not state a fixed dollar
  prize without "approximately," a timestamp, and the volatility/contingency disclosure.
- The prize is **not charitable**. MoonDAO is not a 501(c)(3); the 5% "contribution" is not
  tax-deductible and must not be described as a donation.

### 3.3 Recommendations (state law)

1. Same U.S. exclusion as § 2.4.
2. Use the term "prize contribution" (not "donation") for the 5% slice.
3. Marketing copy for the prize must carry the short-form disclaimer in the Risk Disclosures
   document.

---

## 4. Non-U.S. gambling and financial regulation

The largest offshore prediction market blocks users in roughly 40 countries plus regional
blocks, and excludes all U.S. persons. Regulators in the following jurisdictions have spoken
directly to prediction markets or to closely analogous products:

| Jurisdiction | Position | Consequence for an unlicensed operator |
|---|---|---|
| **United Kingdom** | Gambling Commission statement (Feb. 4, 2026): prediction-market event contracts are betting; a platform matching bets is a "betting intermediary" under the Gambling Act 2005 s. 13; the FCA's retail binary-options ban also applies to some products. | Providing facilities for gambling without a licence (s. 33) and advertising unlawful gambling (s. 330) are criminal offences. |
| **Ireland** | Gambling Regulation Act 2024; GRAI licensing of betting and betting intermediaries. | Unlicensed remote betting is an offence. |
| **Australia** | ACMA and ASIC treat unlicensed prediction markets as prohibited interactive gambling services (Interactive Gambling Act 2001 s. 15); ACMA public warning Aug. 4, 2026; ISP blocking orders in use. | Civil penalties per day of contravention; site blocking; advertising prohibited. |
| **New Zealand** | Department of Internal Affairs: remote interactive gambling by offshore operators is prohibited (Gambling Act 2003 s. 9(2)(b)); betting on events is TAB NZ's exclusive domain (Racing Industry Act 2020). | Offences; advertising overseas gambling is prohibited (s. 16). |
| **Singapore** | Gambling Regulatory Authority blocked prediction-market sites in January 2025 (Gambling Control Act 2022). | Offences for operator and user. |
| **Canada** | CSA/CIRO: event contracts are derivatives requiring registration; Criminal Code ss. 202, 206 reserve betting to provincial regimes (Ontario iGaming). Offshore markets block AB, BC, ON, QC. | Securities/derivatives enforcement plus gaming law. |
| **France, Spain, Portugal, Netherlands, Czech Republic, Poland, Italy, Germany, Belgium** | National gambling regulators (ANJ, DGOJ, SRIJ, KSA, MF, ADM, GGL, BGC) license online betting and block unlicensed sites; several have blocked prediction markets. | Administrative blocking, fines, criminal offences. |
| **EU / UK data protection** | MoonDAO already excludes EU/UK users for GDPR reasons. | Maintain the exclusion; do not process EU/UK personal data. |
| **Comprehensively sanctioned jurisdictions** | Cuba, Iran, North Korea, Syria, the Crimea, Donetsk, Luhansk, Kherson and Zaporizhzhia regions of Ukraine (OFAC); plus Russia and Belarus under extensive sectoral sanctions. | See § 5. |

**Recommendation.** Adopt the Restricted Jurisdictions schedule in the Terms (Schedule A)
and enforce it at the UI/API layer. Review the schedule quarterly; the list has grown every
quarter since 2025. Do not advertise DePrize into any restricted jurisdiction (UK s. 330 and
Australia's Part 7A make advertising an independent offence).

---

## 5. Sanctions and anti-money-laundering

### 5.1 Sanctions (OFAC)

- U.S. sanctions apply on a **strict-liability** basis to U.S. persons and to transactions
  with a U.S. nexus. MoonDAO has a U.S. mailing address, U.S.-based contributors, U.S.
  infrastructure providers, and U.S. governance participants; assume OFAC applies.
- OFAC's October 2021 *Sanctions Compliance Guidance for the Virtual Currency Industry*
  expects geolocation blocking, IP analytics, and blockchain-address screening against the
  SDN list. The Tornado Cash designation was vacated after *Van Loon v. Treasury* (5th Cir.
  Nov. 26, 2024) and delisted on March 21, 2025, but the SDN list still contains many
  digital-currency addresses.
- **Two exposure points:** (i) bettors from embargoed jurisdictions or on the SDN list
  interacting with MoonDAO-operated contracts; (ii) **prize payment** to a competitor that is
  a blocked person or owned 50%+ by blocked persons. Several plausible DePrize competitors
  are state-owned entities of the People's Republic of China (e.g., CASC subsidiaries such
  as the China Academy of Launch Vehicle Technology appear on the Commerce Entity List;
  some appear on the NS-CMIC list). A prize transfer to such an entity requires
  case-by-case sanctions and export-control analysis, and may be prohibited outright.

### 5.2 AML / money transmission

- FinCEN's 2019 CVC guidance (FIN-2019-G001) indicates that providers of non-custodial
  software that does not accept and transmit value are generally not money transmitters.
  DePrize's contracts hold WETH collateral programmatically, and MoonDAO's treasury funds
  the market maker; counsel should confirm the non-custodial analysis holds when the
  operator is also the liquidity provider and fee recipient.
- DOJ's April 7, 2025 memorandum ("Ending Regulation by Prosecution") deprioritized
  § 1960 charges against developers for users' acts, but *United States v. Storm* (S.D.N.Y.;
  jury verdict Aug. 2025 on the unlicensed-money-transmitting conspiracy count) shows the
  theory remains available. Verify current status.
- Bet caps, wallet screening, and refusing obviously structured activity are standard
  mitigations even where no MSB registration is required.

### 5.3 Recommendations

1. **Wallet screening at bet time** against SDN and other sanctions lists (a commercial
   API or an on-chain sanctions oracle; evaluate the free Chainalysis oracle's Arbitrum One
   deployment).
2. **Geo-block** comprehensively sanctioned jurisdictions in addition to the gaming
   restrictions in § 4.
3. **Prize-side KYC/KYB**: identity and beneficial-ownership verification, sanctions and
   Entity List screening, before any tranche is released; contractual right to withhold and
   to treat an unpayable winner as "no Prize-Eligible Winner."
4. **Per-wallet and per-transaction caps** (also a consumer-protection and manipulation
   control).
5. Document the program (written policy, screening logs, escalation path).

---

## 6. U.S. securities law

### 6.1 Outcome tokens

Binary event contracts on non-security events are CFTC-jurisdiction swaps rather than
securities, so the primary federal regime is the CEA (§ 2). If a DePrize ever references a
security or a company's financial metrics, it would become a security-based swap under
SEC jurisdiction — avoid.

### 6.2 The 5% slice and the mission token

The token a bettor receives is not a DePrize token: it is the project token of whichever
Launchpad mission the DePrize is bound to (its `jbProjectId` in `DePrizeRegistry`). For the
first DePrize that is $OVERVIEW. The analysis below therefore has to be run **per bound
mission**, against that mission's actual token terms and issuance rate — the conclusions are
not transferable from one campaign to the next.

- The SEC's Interpretive Release 33-11412 (March 2026) sorts crypto assets into five
  categories — digital commodities, digital collectibles, digital tools, stablecoins, and
  digital securities. The three non-security categories are all defined by the *absence* of
  "intrinsic economic properties or rights, such as generating a passive yield or conveying
  rights to future income, profits, or assets of a business enterprise or other entity,
  promisor, or obligor."
- The mission token carries a **contingent redemption right against a pool of ETH**
  (Launchpad `cashOut`, enabled in refund-terminal states) and is minted to bettors as
  consideration for a payment. A right to a share of pooled assets on the occurrence of a condition is an
  economic right, and the bettor's 5% is a payment of money into a common enterprise whose
  outcome depends on MoonDAO's and the Organizing Entity's efforts — the *Howey* elements.
  The Overview Effect Terms' statement that the token "is not a security" is a conclusion,
  not an analysis.
- Bettors receive the mission token at a worse rate than the campaign's own contributors
  (20x worse for the first DePrize, because only the 5% slice reaches the project at its
  full issuance rate); if the token has any economic value, that disparity invites a
  consumer-protection claim.
- The SEC's Proposed Regulation Crypto Assets (Rel. 33-11434; Aug. 18, 2026; comments due
  Oct. 20, 2026) would create exemptions and an investment-contract safe harbor, but it is
  **proposed**, not effective.

### 6.3 Recommendations

1. Obtain securities counsel's written analysis of the mission token **before** DePrize
   distributes it to bettors, and repeat it for **each** mission a future DePrize binds to
   rather than relying on the first campaign's clearance.
2. Prefer one of: (a) route the 5% to the prize pool **without** minting a token to the
   bettor (a pure, non-refundable prize contribution); (b) mint a **non-transferable**
   governance-only token with no `cashOut` right; or (c) mint the token only to
   non-U.S. persons under the same gate as betting, with the Terms making clear the token
   is governance-only and that any `cashOut` is governed by the campaign terms.
3. Never describe the 5% slice as an investment or as "getting the mission token at a
   discount."

---

## 7. The prize: eligibility, judging, payment, and third-party rights

### 7.1 Decoupling the market from the prize

Today the design assumes the market winner and the prize recipient are the same entity.
They cannot always be:

- **Government agencies** (NASA, ESA, JAXA, ISRO, CNSA) may lack authority to accept a
  private prize, or acceptance may be politically or legally impossible.
- **Sanctioned or embargoed entities** cannot be paid (§ 5).
- **Entities that decline** the prize or refuse KYC/tax paperwork cannot be paid.
- **Open Field winners** may be unknown or unreachable.

**Recommendation.** The Terms and Prize Rules should provide: the **market** resolves on the
published objective event (the "Resolution Event"), producing bettor payouts regardless of
who the winner is; the **prize** is awarded only to a "Prize-Eligible Winner" that (i)
satisfies the published eligibility criteria, (ii) passes KYC/KYB and sanctions screening,
(iii) provides tax documentation, and (iv) executes a Prize Acceptance Agreement within a
claim window. If there is no Prize-Eligible Winner, the pool is handled per a pre-published
rule (rolled forward to a successor DePrize, or returned to contributors via the Launchpad
mechanism) — **not** left to ad hoc governance.

### 7.2 Judging integrity

- Publish, per DePrize and before betting opens, the **Resolution Event** in objective,
  publicly verifiable terms (what counts as "landing," "crewed," "return," etc.; which
  public sources are authoritative; the deadline; tie-breaks).
- **Public challenge window** (e.g., 72 hours) between the Senate result and the Safe's
  `reportPayouts`, because the on-chain report is irreversible.
- **Recusal**: any Senator or ERC member with a financial interest in a competitor or in the
  Launchpad campaign must disclose and abstain. The Overview Effect Organizing Entity's
  principal is a Senator; his financial interest in whether the pool is disbursed as a prize
  (versus returned to contributors) is a conflict that must be disclosed and managed.
- **Insider blackout**: define "Insiders" (MoonDAO core team, Senators, ERC members,
  competitors and their employees/contractors/affiliates, and anyone with MNPI about the
  Resolution Event) and prohibit them from holding or trading outcome tokens. Publish the
  policy; maintain an internal list; reserve the right to refuse, unwind or forfeit
  positions and to report.
- **Upgrade timelock** on `DePrizeRegistry` (and any other upgradeable component) with a
  public notice period, so no single key can change the rules mid-market.

### 7.3 Third-party rights: listing competitors without consent

- **Trademark.** Identifying a company by name as the subject of an outcome is nominative
  fair use, provided only so much of the mark as is necessary is used and nothing suggests
  sponsorship or endorsement. The current design (neutral placeholder marks for unclaimed
  competitors; logos only for claimed listings; `ROSTER_DISCLAIMER`) is the right pattern.
  Never use logos, stylized marks, or "official" language for unclaimed listings.
- **False endorsement / Lanham Act § 43(a).** Avoid any implication that a listed
  competitor has "entered," "registered," "partnered," or "approved."
- **Defamation.** Statements about a competitor's eligibility, failure, or disqualification
  must be factual, sourced, and phrased as MoonDAO's determination under its published
  rules.
- **Right of publicity.** Do not use individuals' names or likenesses (founders, CEOs,
  astronauts) as outcomes or in marketing without consent.
- **Government entities as outcomes.** Listing is lawful (public facts), but paying them a
  prize may not be; § 7.1 handles this.
- Provide a **contact and correction process** for listed organizations (the Terms include
  one).

### 7.4 Tax

- **U.S. recipients:** prizes and awards are ordinary income. Form 1099-MISC (Box 3)
  reporting applies at **$2,000 or more** for payments made in 2026 (threshold raised from
  $600 by the One Big Beautiful Bill Act of July 4, 2025, indexed after 2026); crypto is
  reported at fair market value on the payment date; 24% backup withholding applies if no
  valid TIN (Form W-9) is provided.
- **Non-U.S. recipients:** Form W-8BEN/W-8BEN-E; whether 30% withholding under IRC
  §§ 1441/1442 applies depends on the source of the prize income (activities performed
  outside the U.S. are generally foreign-source). Counsel should confirm; Forms 1042/1042-S
  may be required.
- **Bettors:** bettors are responsible for their own taxes. MoonDAO does not currently
  issue information returns to bettors; counsel should confirm no payer obligation arises.
  The IRS "DeFi broker" reporting rule was repealed by Congress in April 2025, so
  Form 1099-DA does not apply to a non-custodial front end.
- **MoonDAO:** LMSR profits and fee sweeps are income; prize payments may be deductible;
  RMI entity treatment and U.S.-member attribution should be reviewed by tax counsel.

---

## 8. Consumer protection and contract enforceability

### 8.1 Assent

- **Browse-wrap fails.** *Nguyen v. Barnes & Noble*, 763 F.3d 1171 (9th Cir. 2014);
  *Berman v. Freedom Financial Network*, 30 F.4th 849 (9th Cir. 2022); *Meyer v. Uber
  Technologies*, 868 F.3d 66 (2d Cir. 2017) (enforcing terms where notice was conspicuous
  and the user took an affirmative act). The current `BetModal` links to the Terms but does
  not require assent, and the link target does not exist.
- **Fix (in this PR):** a required checkbox — "I have read and agree to the DePrize Terms
  and Conditions, Privacy Notice and Risk Disclosures, and I confirm I am not a U.S. person
  and am not located in a Restricted Jurisdiction" — that gates the Bet button, with the
  Terms version exposed as a constant. **Follow-up (engineering):** log acceptance
  server-side (wallet, Terms version, timestamp, IP-derived country) and re-prompt when the
  version changes.

### 8.2 Dispute resolution

- Incorporating the Website Terms' New York law / AAA arbitration / class-waiver / 30-day
  opt-out provisions is reasonable and consistent with the Federal Arbitration Act. Keep
  them even though U.S. persons are excluded (users who misrepresent location should still
  be bound).
- Some non-U.S. consumer regimes (e.g., Australian Consumer Law unfair-contract-terms
  rules) limit arbitration and liability caps; those jurisdictions are on the restricted
  list, which reduces but does not eliminate the issue.

### 8.3 Plain-language risk disclosure

Required disclosures at the point of bet (implemented in the Risk Disclosures document and
`BetModal`): total-loss risk; the equal-payout `1/N` refund is not a return of stake;
MoonDAO is the market maker, fee recipient, and oracle; resolution is final and
irreversible; fees/slippage/gas; the 5% is a non-refundable prize contribution; not
available to U.S. persons or in Restricted Jurisdictions; not investment advice.

### 8.4 Responsible participation

Even on MoonDAO's position that DePrize is not "gambling," it is good practice (and a
regulator's first question) to offer: 18+ (or local age of majority), per-wallet caps, a
self-exclusion request channel, cooling-off on request, and links to help resources
(GamCare 0808 8020 133 in the UK; Gambling Help Online 1800 858 858 in Australia; NCPG
1-800-GAMBLER in the U.S.; Gamblers Anonymous internationally).

---

## 9. Privacy and data protection

### 9.1 What is actually collected (from the codebase)

| Data | Source | Notes |
|---|---|---|
| Wallet address, bets, positions, redemptions | Public blockchain (Arbitrum) | Permanent and public; cannot be erased. |
| Email / social login, embedded-wallet mapping | Privy | Links a pseudonymous wallet to an identity. |
| IP address and derived country/region/state | Vercel and Cloudflare request headers; `ipapi.co` lookups; results cached in Upstash Redis | Used for the EU/UK block and U.S.-state logic today; will be used for the Restricted Jurisdictions gate. |
| Analytics events, device/browser data, cookies | Google Analytics (gtag, consent mode; U.S. visitors auto-granted), Vercel Analytics, `cookie_consent` localStorage | The Website Privacy Policy says none of this exists. |
| Password-gate cookie | HttpOnly cookie | Access control. |
| RPC and price requests | thirdweb, Etherscan | Third parties see IP + wallet queries. |
| KYC/KYB, tax forms, banking/payout details (prize recipients) | To be collected | Sensitive; needs a vendor, retention schedule, access controls. |
| Terms-acceptance logs (recommended) | MoonDAO server | Wallet, version, timestamp, country. |

### 9.2 Legal regimes

- **GDPR / UK GDPR.** MoonDAO blocks EU/UK users for this reason. The block is IP-based;
  if MoonDAO nonetheless processes EU/UK personal data (e.g., a user on a VPN), Article
  3(2) can still apply. Maintain the block and do not market to the EU/UK.
- **U.S. state privacy laws.** CCPA/CPRA thresholds (≈$26.6 million revenue, or 100,000+
  California consumers, or 50%+ revenue from selling/sharing personal information) are
  probably not met, and MoonDAO is excluding U.S. persons from betting anyway; but the
  website is still visited from the U.S. Several state laws use similar thresholds; Texas
  applies to any non-small business. Provide a rights-request channel regardless.
- **FTC Act § 5 / state UDAP.** A privacy policy that misdescribes practices is itself a
  deceptive practice. The "no cookies / no tracking" statements must be corrected.
- **Children.** 18+ requirement; do not knowingly collect data from minors.

### 9.3 Recommendations

1. Publish the **DePrize Privacy Notice** (this PR) as a supplement.
2. **Correct the Website Privacy Policy** (separate task; not edited here): remove the "no
   cookies / no tracking" statements; disclose Google Analytics, Vercel Analytics, Privy,
   IP geolocation providers and caching, and the cookie banner; update the "Last Updated"
   date.
3. Adopt a **retention schedule** for KYC data (e.g., 5 years after final prize tranche, or
   as required by law) and restrict access.
4. Add a data-rights request channel (privacy@ or info@) and honor it for all users.

---

## 10. Entity structure and liability

- **MoonDAO DAO LLC** is a Republic of the Marshall Islands DAO LLC under the Decentralized
  Autonomous Organization Act of 2022 (Act 2022-0050), as supplemented by the 2024 DAO
  Regulation (beneficial-ownership reporting, KYC of certain persons, Representative Agent,
  annual filings). Confirm good standing and that the operating agreement authorizes
  DePrize as an activity of the LLC (and that Senate votes on DePrize matters are acts of
  the LLC, not of an unincorporated association).
- ***CFTC v. Ooki DAO*** (N.D. Cal., default judgment June 2023): a DAO is a "person" under
  the CEA; an unincorporated DAO's voting token holders may be members liable for its
  violations; the DAO was held liable for unregistered retail commodity transactions and BSA
  failures. ***Sarcuni v. bZx DAO*** (S.D. Cal. 2023) denied dismissal of a partnership
  theory against token holders. The LLC wrapper is the principal defense; keep the wrapper
  intact (act through the LLC; sign as the LLC; keep records).
- **U.S. nexus is substantial** (San Francisco mailing address, U.S. contributors, U.S.
  governance participants, U.S. infrastructure). Do not assume the RMI domicile places
  DePrize outside U.S. jurisdiction.
- **Personal exposure.** In the bZeroX/Ooki matter the founders settled individually. The
  U.S. exclusion in § 2.4 is the single most important protection for individuals involved
  in operating DePrize.
- **Smart-contract risk.** Audits of `DePrizeMint`, `DePrizeRegistry`, `DePrizeFeeRouter`,
  `DePrizeRedeem`, and the LMSR/CTF integration; a bug-bounty; a timelock and a documented
  emergency-pause policy.
- **Insurance.** Consider D&O-type coverage for the LLC's officers/Senators if available.

---

## 11. Marketing and communications

- No "investment," "returns," "earn," "guaranteed," "risk-free," or "official odds" language.
- Prize claims must state the approximate value, the currency (ETH), the timestamp, that the
  amount fluctuates, and that payment is contingent (milestones, eligibility, governance).
- Never imply a listed competitor has entered or endorsed DePrize.
- Do not run paid or organic marketing targeted at U.S. persons or Restricted Jurisdictions
  (advertising is an independent offence in the UK and Australia).
- Influencers and community members compensated in tokens must disclose the relationship
  (FTC Endorsement Guides, 16 C.F.R. Part 255).
- Every public post about odds or the prize should carry the one-line disclaimer from the
  Risk Disclosures document.

---

## 12. Document map — which document addresses which risk

| Risk | T&C | Prize Rules | Privacy Notice | Risk Disclosures | Code / ops |
|---|---|---|---|---|---|
| U.S. person / Restricted Jurisdiction exclusion | §§ 3, Sch. A | § 4 | — | Yes | Geo-gate, attestation, VPN detection, compliance signature (to build) |
| Sanctions | § 3 | § 4, § 10 | § 6 | — | Wallet screening (to build); prize KYC |
| MoonDAO's roles (market maker, fee recipient, oracle) | § 5 | § 7 | — | Yes | — |
| Insider trading / conflicts | § 9 | § 8 | — | Yes | Insider list; recusal records |
| Resolution finality & challenge window | § 7 | § 7 | — | Yes | Governance procedure; delay before `reportPayouts` |
| Equal-payout refund (1/N) | § 8 | — | — | Yes | Existing contracts |
| 5% prize contribution / token | § 10 | § 6 | — | Yes | Securities counsel review |
| Decoupling prize from market | § 7.4 | §§ 5, 9 | — | Yes | Prize Acceptance Agreement; payout gating |
| Non-consenting competitors / trademarks | § 6 | § 3 | — | Yes | `ROSTER_DISCLAIMER`; placeholder marks |
| Assent / enforceability | § 1, § 19 | § 1 | — | — | `BetModal` checkbox (this PR); acceptance logging (to build) |
| Privacy accuracy | § 12 | § 10 | All | — | Correct Website Privacy Policy (to do) |
| Taxes | § 13 | § 10 | § 3 | Yes | W-9/W-8 collection; 1099/1042-S |
| Responsible participation | § 11 | — | — | Yes | Caps; self-exclusion channel (to build) |
| Upgrades / admin keys | § 5.5 | — | — | Yes | Timelock (to build) |

---

## 13. Prioritized recommendations

**P0 — before any real-money bet is accepted from the public**

1. Publish the four legal documents; fix `DEPRIZE_TERMS_URL`; require click-through
   acceptance at bet time (this PR).
2. Geo-block the U.S. and Schedule A jurisdictions for all betting actions; add
   VPN/proxy detection; add the non-U.S.-person attestation (engineering).
3. Wallet sanctions screening at bet time (engineering).
4. Publish objective Resolution Event criteria for each live DePrize before betting opens
   (governance).
5. Adopt and publish the Insider and Conflict-of-Interest Policy; obtain Senator/ERC
   disclosures (governance).
6. Securities counsel sign-off on the mission-token distribution to bettors, or remove/modify
   the token distribution (legal + engineering).
7. Correct the Website Privacy Policy (legal).

**P1 — before scaling volume or adding markets**

8. Prize Acceptance Agreement template; KYC/KYB vendor; tax-form collection; sanctions
   screening of recipients; written rule for "no Prize-Eligible Winner."
9. Per-wallet/per-transaction caps; self-exclusion channel.
10. Timelock on `DePrizeRegistry` and any upgradeable component; public challenge window
    before `reportPayouts`.
11. Server-side acceptance logging with Terms versioning.
12. Evaluate USDC collateral (reduces volatility risk for both refunds and the prize;
    payment stablecoins have a settled federal status under the GENIUS Act).

**P2 — ongoing**

13. Quarterly review of the Restricted Jurisdictions schedule and of the CFTC/SEC/state
    landscape (final Rule 40.11 amendments; Supreme Court action on the Kalshi cases;
    CLARITY Act; Proposed Regulation Crypto Assets).
14. Audit and bug-bounty program; incident-response and emergency-pause policy.
15. Explore a registered-DCM partnership for any U.S. offering.

---

## 14. Open questions for counsel

1. Does MoonDAO's role as LMSR liquidity provider and fee recipient change the FinCEN
   non-custodial analysis?
2. Does distributing a bound mission's token to bettors constitute an offer of securities under *Howey*
   as applied through Release 33-11412? Would a non-transferable variant cure it?
3. Are there jurisdictions where a **skill-based prize competition** with a MoonDAO-selected
   roster requires registration or bonding?
4. Withholding obligations on prize payments to foreign entities for activities performed
   abroad; treaty considerations.
5. Whether Senators voting on resolution while holding vMOONEY (whose value may be affected
   by the outcome) creates a disclosable conflict under RMI law or the operating agreement.
6. Enforceability of the incorporated arbitration clause and class waiver against non-U.S.
   consumers in the jurisdictions DePrize *does* serve.
7. Whether any DePrize market could be construed to "involve" an activity unlawful under
   state or federal law (e.g., unlicensed launch activity) under Rule 40.11.

---

## Appendix A — Sources consulted (selected)

**Statutes and rules**
- Commodity Exchange Act §§ 1a(18), 1a(19), 1a(47), 2(e), 4(a), 4c(a), 5, 5c(c)(5)(C), 5h,
  6(c)(1); 17 C.F.R. §§ 40.11, 180.1 and Appendix F to Part 40.
- CFTC, Event Contracts, ANPRM, 91 Fed. Reg. 12516 (Mar. 16, 2026); NPRM, RIN 3038-AF65
  (June 10, 2026; Fed. Reg. June 12, 2026).
- N.Y. Penal Law §§ 225.00, 225.05, 225.10; N.Y. Gen. Bus. Law § 369-e; Fla. Stat.
  § 849.094; R.I. Gen. Laws § 11-50-1.
- Securities Act of 1933 § 2(a)(1); SEC Interpretive Release No. 33-11412 (Mar. 2026);
  SEC Proposed Regulation Crypto Assets, Rel. Nos. 33-11434 / 34-106150, File No.
  S7-2026-27 (Aug. 18, 2026; 91 Fed. Reg. Aug. 21, 2026).
- Gambling Act 2005 (UK) ss. 13, 33, 330; Gambling Regulation Act 2024 (Ireland);
  Interactive Gambling Act 2001 (Cth) ss. 15, 15AA, Part 7A; Gambling Act 2003 (NZ) ss. 9,
  16; Racing Industry Act 2020 (NZ); Gambling Control Act 2022 (Singapore); Criminal Code
  (Canada) ss. 202, 206, 207.
- OFAC, *Sanctions Compliance Guidance for the Virtual Currency Industry* (Oct. 2021);
  FinCEN, FIN-2019-G001 (May 2019).
- Internal Revenue Code §§ 74, 1441, 1442, 3406, 6041; One Big Beautiful Bill Act, Pub. L.
  119-21 (July 4, 2025) (information-reporting thresholds).
- Decentralized Autonomous Organization Act of 2022 (RMI Act 2022-0050) and 2024 DAO
  Regulation.
- H.R. 3633, Digital Asset Market Clarity Act of 2025 (House-passed July 17, 2025; Senate
  Banking reported June 1, 2026).

**Cases and enforcement**
- *In re Blockratize, Inc. d/b/a Polymarket*, CFTC No. 22-09 (Jan. 3, 2022).
- *KalshiEX LLC v. Flaherty*, 172 F.4th 220 (3d Cir. 2026).
- *KalshiEX LLC v. Assad*, No. 25-7516 (9th Cir. Aug. 28, 2026); cert. petition filed
  Sept. 2, 2026 (N.J.).
- *CFTC v. Van Dyke*, No. 26 Civ. 3369 (S.D.N.Y. filed Apr. 23, 2026); *United States v.
  Van Dyke*, No. 26 Cr. 156 (S.D.N.Y.); CFTC and DOJ actions re Spagnuolo (May 27, 2026).
- *CFTC v. Ooki DAO*, No. 3:22-cv-05416 (N.D. Cal. June 2023) (default judgment).
- *Sarcuni v. bZx DAO*, No. 22-cv-618 (S.D. Cal. Mar. 27, 2023).
- *Van Loon v. Dep't of the Treasury*, 122 F.4th 549 (5th Cir. 2024); OFAC delisting of
  Tornado Cash (Mar. 21, 2025).
- *United States v. Storm*, No. 23-cr-430 (S.D.N.Y.) (verdict Aug. 2025).
- *SEC v. W.J. Howey Co.*, 328 U.S. 293 (1946).
- *Nguyen v. Barnes & Noble Inc.*, 763 F.3d 1171 (9th Cir. 2014); *Berman v. Freedom
  Financial Network, LLC*, 30 F.4th 849 (9th Cir. 2022); *Meyer v. Uber Technologies,
  Inc.*, 868 F.3d 66 (2d Cir. 2017).

**Regulator statements**
- UK Gambling Commission, statement on prediction markets (Feb. 4, 2026).
- ACMA (Australia), public warning on prediction markets (Aug. 4, 2026); ASIC guidance.
- NZ Department of Internal Affairs guidance on offshore prediction markets.
- Singapore Gambling Regulatory Authority site-blocking (Jan. 2025).
- CSA/CIRO (Canada) notice on prediction-market event contracts.
- Kalshi and Polymarket insider-trading rules (Mar. 2026).
- DOJ, *Ending Regulation by Prosecution* memorandum (Apr. 7, 2025).

**MoonDAO internal**
- `docs/DEPRIZE.md`; `docs/DEPRIZE_ROSTER_CHANGES.md`; `prediction/README.md`;
  `ui/docs/ACCESS_GATE.md`; `ui/docs/DEPRIZE_TERMS_AND_CONDITIONS.md` (superseded);
  `ui/content/docs/Legal/*`; `ui/lib/deprize/*`; `ui/lib/geo/*`;
  `ui/components/deprize/BetModal.tsx`; `ui/components/layout/CookieBanner.tsx`;
  `ui/components/layout/GTag.tsx`.

## Appendix B — Suggested engineering follow-ups (not in this PR)

1. `pages/api/deprize/eligibility` — returns `{ allowed, reason, country }` using the
   existing `lib/geo` resolution plus a VPN/datacenter check and a wallet sanctions check;
   `BetModal` calls it before enabling the Bet button.
2. Optional "compliance signature": the API signs `(wallet, competitionId, expiry)`;
   `DePrizeMint.bet()` verifies the signature so the contract's public entry point enforces
   the same gate as the UI.
3. `pages/api/deprize/accept-terms` — records `(wallet, termsVersion, timestamp, country,
   userAgent)`; `BetModal` posts on first bet per version.
4. Bet caps enforced in `DePrizeMint` (per-tx) and by the API (per-wallet rolling).
5. `TimelockController` in front of `DePrizeRegistry` upgrades and parameter changes.
6. Governance procedure adding a fixed public challenge window between the Senate result
   and `reportPayouts`.
7. A `DePrizeRegistry` path for "market settled, prize not awardable" (winner declines,
   fails KYC/sanctions screening, is a government body that cannot accept, or does not
   claim within the window): the market stays resolved to the winner, while the prize pool
   is either rolled to a successor DePrize or returned to the Juicebox project
   (`addToBalanceOf`) with `cashOut` enabled — whichever the published Prize Rules specify.
   Today `failM2()` is only reachable from `M1_RELEASED`, so an unpayable winner has no
   on-chain exit.
