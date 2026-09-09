# Go-to-Market — "Touchdown" DePrize

**Status:** Draft for discussion
**Prize spec:** [`DEPRIZE_TOUCHDOWN.md`](./DEPRIZE_TOUCHDOWN.md) v0.1 (PR #1527) — the rules of record
**Live market:** Sepolia DePrize **#22**, bound to `shared-next-landing` (PR #1566). Nothing on mainnet.
**Companion plans:** [`DEPRIZE_GTM_SURVIVE_THE_NIGHT.md`](./DEPRIZE_GTM_SURVIVE_THE_NIGHT.md) · [`DEPRIZE_GTM_SIX_SECONDS_LATE.md`](./DEPRIZE_GTM_SIX_SECONDS_LATE.md)
**Last updated:** 2026-09-09

---

## 0. The question asked first: what has to be true before we go public

Nine things. Six of them are irreversible, and that is the whole reason for the ordering
below. **Rules freeze at `open`. The CTF oracle is immutable once the condition is
prepared. The outcome set can never be resized. A named roster cannot be un-named.** Every
reversible marketing decision can be fixed next week; none of these can. So they go first,
and nothing in Part III starts until they are closed.

| # | Gate | Why it is a gate | Fails if |
|---|---|---|---|
| **G1** | **The prize is not already void** | Griffin-1 is on the Q4 2026 calendar. §Part IV.5 of the spec: a landing *before* `open` voids the prize on arrival | Griffin is inside a landing window on the morning we register |
| **G2** | **A written legal position exists** | We would be taking money from US residents on a real-money event market, unlicensed, three months after a federal appeals court told Kalshi that federal preemption does not cover it | No counsel memo naming the theory, the jurisdictions, and the disclosures |
| **G3** | **Terms are published and reachable** | `DEPRIZE_QA.md` E5b: the Terms URL is a **404** today. The BetModal links to a page that does not exist | Any live link in the bet flow 404s |
| **G4** | **Resolution authority is not one person** | The CTF oracle is the deployer EOA `0x3c5e…E011`. `const/config.ts` says in its own comment to move it to the admin Safe *before a public prize* — and that this requires preparing a **new condition**, because the oracle is immutable once set | The oracle on the mainnet condition is an EOA |
| **G5** | **The win condition has survived an outside attack** | The spec's Part V is an explicit request for criticism that has not yet been answered. Test 3 (stable planned orientation) and Test 5 (confirmation for a CNSA landing) are the two clauses that decide who gets paid | Fewer than three qualified external reviewers have walked the last seven attempts against the five tests |
| **G6** | **The purse exists, and we can say why** | $25,000 is **7.6% of MoonDAO's $327,851 unrestricted liquid assets** against ~10 months of runway. It also induces exactly zero behaviour from a company holding a $199.5M CLPS award | No funding source identified, or no answer to "so you're offering Blue Origin $25,000?" |
| **G7** | **It is on mainnet and the money is real** | Touchdown is Sepolia-only. Pool: **0.0002 ETH.** Arbitrum has the registry, mint, fee router and redeem deployed but no Touchdown | Registered on a testnet, or a mainnet Juicebox project that has not been paid into |
| **G8** | **One full mainnet rehearsal, by an outsider** | Every DePrize flow has been proved on Sepolia. None has been proved end-to-end with real money by someone who does not work here | No outsider has completed bet → sweep → resolve → redeem on Arbitrum |
| **G9** | **The roster is notified, not asked** | Five real companies are market outcomes. Listing is editorial and does not require consent — but them learning about it from a journalist is an avoidable own goal | Any named operator's comms team is surprised |

**The order matters, and it is not the order of effort.** G1 and G2 can kill the prize;
they run first and in parallel. G4 and G5 are load-bearing on an immutable artifact, so
they must close before G7 registers anything on-chain. G3, G6, G8 and G9 are gating but
not blocking — they run alongside. Marketing spend before G7 is spend against a page
people cannot use.

### Two of these deserve to be argued about now, not later

**G6 is the strategic problem, not an admin item.** A $25,000 purse does not cause a Moon
landing. Astrobotic's Griffin task order is $199.5M. Firefly holds $179.6M and $176.7M
CLPS awards. If Touchdown is presented as an inducement prize, the first competent
journalist asks what $25,000 induces, and the honest answer is *nothing* — which
retroactively makes every other MoonDAO prize sound unserious. Three ways out, and we
should pick one before we write a word of copy:

- **(a) Shrink the seed, grow the pool.** Seed small and let the 5% slice do the work. The
  headline becomes *the prize the audience built*, and the number going up is the story
  rather than the number sitting still.
- **(b) Direct the purse.** The cheque goes to the flight team, a named scholarship, or a
  payload slot — not to the corporate entity. "Astrobotic's landing team" is a story.
  "Voyager Technologies, a public company, accepts $25,000" is not.
- **(c) Sponsor it.** $25,000 of somebody else's money removes the treasury question
  entirely and is worth more than the cash, exactly as the Survive-the-Night plan argues
  about chamber time.

My recommendation is **(a) plus (b)**: a small seed, a growing pool, and a purse directed
at the people who did the work. It is cheaper, more defensible against a ten-month runway,
and it makes the pool chart — the thing we want people to look at — the actual headline.

**G2 has a specific shape worth naming.** The geo gate blocks the EU, EEA and UK
(`ui/lib/geo/index.ts`, 33 jurisdictions, ~450M people) and default-denies unknown
countries. **The United States is fully open.** That list was written for GDPR — for
on-chain personal-data storage — and it is now doing duty as a gambling-restriction list.
Those are different legal questions and their overlap is a coincidence. The good news is
that the category is defensible: Kalshi self-certifies "Will Artemis II launch before…"
and "Will *X* occur at the next SpaceX Starship launch?" as **Science and Technology**
contracts, which sit outside the contested gaming definition in the CFTC's June 2026
proposed rule. A lunar landing is not a sporting event and nobody on the roster can throw
the game. That is a real argument. It is not a substitute for having counsel write it
down, and it does not answer why an unlicensed DAO may take the other side.

---

## 1. Executive summary

Touchdown is not the same kind of object as the other two prizes, and running the same
playbook on it would fail.

Survive the Night and Six Seconds Late are supply-constrained: no roster, no market, so
competitor recruitment is the critical path. **Touchdown has no supply problem and no
supply lever.** The five competitors are billion-dollar programmes that will fly whether
or not we exist, cannot be recruited, cannot be induced, and will never sign anything. The
purse changes no one's behaviour. There is nothing to build and nobody to sign up.

What Touchdown has instead is the one thing the other two prizes cannot buy: **a
guaranteed, televised, externally-scheduled climax inside the next twelve months, that we
do not have to produce.** Somebody is going to try to land on the Moon, on camera, and
either stick it or tip over, and the world will watch. IM-1's landing broadcast did 1.46M
views. Artemis II peaked at 3.66M concurrent. We do not have to manufacture the moment —
we have to own the scoreboard pointing at it.

So the strategy is a substitution. **Stop selling a prize. Start operating a scoreboard.**

> **The one-liner:** *Nobody has landed on the Moon since March 2025. Five organizations
> are about to try. Here are the live odds — and every bet raises the purse for whoever
> makes it.*

The spec already says the true thing: *"the product here is the odds board, not the
cheque."* This plan takes that literally. The primary build is not a campaign, it is **an
embeddable, free, always-live odds board that space media puts on their own pages**, plus
**a free global prediction game that needs no wallet and no jurisdiction**. Everything else
is downstream of those two.

And the honest internal framing, which should not be in the press release but should be in
every budget conversation: **Touchdown is the cheapest audience MoonDAO will ever buy, and
the only chance to prove the DePrize mechanism resolves cleanly before a prize where the
purse actually matters.** Its ROI is the list it hands to Night Shift.

---

## 2. What transfers from the best operators, and what does not

I looked at how the strongest go-to-market operations in adjacent categories actually
work. Three of them do not transfer at all, and saying why is more useful than the parts
that do.

### Does not transfer

| Playbook | Why not |
|---|---|
| **XPRIZE's "super credibility" launch** | Diamandis's rule is that the purse must be ≥$10M *specifically* to break through and attract non-traditional entrants. Ours is $25,000 — 400× under the line, aimed at incumbents who cannot be attracted. Launching on the purse number makes us look small. **Never lead with the cheque.** What we borrow from XPRIZE is the other half of the rule: launch with credibility borrowed from named third parties. See §6.4 |
| **Polymarket's liquidity flywheel** | Polymarket did ~$23.9B nominal volume in March 2026 with 865k monthly users; Kalshi did $12.35B. Our pool is 0.0002 ETH. Any framing that invites a depth comparison loses it. **Never position Touchdown as a place to trade.** Position it as a place to see |
| **Kalshi's regulatory moat** | Kalshi's advantage is being a CFTC-registered DCM. We are not one and will not become one. Our compliance position has to be built from *category*, *geography* and *size*, not licensure — see G2 |

### Transfers directly

**1. Polymarket: the market is media infrastructure, not a destination.** The growth did
not come from people finding polymarket.com. It came from Bloomberg terminals, the X
partnership, and — most relevant to us — Substack embeds, where **one in five of
Substack's 250 highest-revenue publications adopted the odds card even while it still
required manually pasting a URL.** Substack shipped native Polymarket embeds in February
2026 because writers wanted them. The lesson is that a live odds card is a *thing writers
want to put in their post*, and every embed is a self-updating inbound link you never have
to maintain. Space publishing is overwhelmingly Substack and YouTube. **This is our single
highest-leverage build.**

**2. Kalshi: the category you file under is a strategic choice, and the words are the
position.** Kalshi's space contracts are filed as Science and Technology, not gaming. Our
copy is our filing. Language discipline is not brand tone here, it is legal posture.

**3. FanDuel / NCAA: the free contest has no geography and is not betting.** FanDuel's
Bracket Madness is "open to people everywhere because it's a free contest and, thus, not
considered betting," and it exists to acquire users who cannot or will not deposit. We
geo-block 33 jurisdictions and ~450M people, and the overwhelming majority of everyone
else will never connect a wallet. **A free, no-purchase-necessary pick game reaches all of
them.** MoonDAO has already run a legally-structured, verifiably-random public sweepstakes
at consumer scale — 9,060 free Ticket to Space mints, drawn on Chainlink VRF. That
machinery is a bigger asset than the X account.

**4. Robinhood: a queue with a visible position is a growth engine on its own.** 10,000
signups on day one, 50,000 in a week, a million in a year, on nothing but a position
number and a referral link. We should not build a *waitlist* — we have a date problem, not
a scarcity problem — but the mechanic transfers exactly onto a **public leaderboard of who
called the landing.**

**5. MoonDAO's own precedent, which is better than anything above.** $8.3M raised from
over 2,000 people in a single month. A 37M-view YouTube moment. Two civilians in space. An
on-chain sweepstakes with a published, auditable draw. The organization has done
consumer-scale before; what it currently lacks is a live surface pointing at any of it.
~38–39k followers on X with engagement well below the account's substance is a distribution
problem, not an audience problem.

---

## 3. Positioning

**Category:** the public scoreboard for the commercial Moon race. Not a betting site, not
a hackathon, not an inducement prize.

**Message hierarchy**

1. **Nobody has landed since Firefly, in March 2025.** Seven attempts between January 2024
   and June 2025 produced two full successes, two tip-overs, and three failures. The
   commercial Moon is real and it is not reliable.
2. **Five organizations are about to try, and the industry cannot tell you who is next.**
   Griffin-1 is the only attempt left on the 2026 calendar. Chang'e-7 has the best record
   on Earth and a 90-day scout orbit that may cost it the race. Blue Origin's lander is
   finished and its rocket blew up its own pad.
3. **We publish what "landed" means, in five tests, in advance.** IM-1 and IM-2 do not
   qualify. That is the whole argument and we are putting it in writing before it happens
   rather than after.
4. **Every bet raises the purse.** Not a house edge — a prize pool. This is the one
   sentence no incumbent can copy without changing their business model.

**Objections, and the answers**

| "..." | Answer |
|---|---|
| "You're offering Blue Origin twenty-five thousand dollars?" | *(Answer depends on the G6 decision — this is why G6 is a gate.)* Under (a)+(b): "We're not paying them to land. The purse is built by the people watching, and it goes to the flight team that pulls it off. The product is the odds board." |
| "This is just gambling on spaceflight." | It is an event market on a scientific outcome, in the same category a CFTC-regulated exchange files Artemis and Starship contracts under. No participant can influence the result and nobody bets against a mission succeeding — you back who gets there first. |
| "Why would I use this instead of Polymarket?" | Because on Polymarket the fee goes to Polymarket. Here 5% of it becomes a prize for the winner. Same bet, different destination. |
| "Isn't it ghoulish to bet on a mission that might crash?" | Every outcome is somebody succeeding. There is no "it fails" contract. The Open Field slot exists precisely so the market can express "none of these five." |
| "How do I know you won't just pick a winner?" | The five tests are published before the market opens and frozen at `open`. Resolution is a public checklist scored against public evidence, ratified by a Senate vote, executed by a Safe. *(True only once G4 closes.)* |
| "What if it's ambiguous, like IM-1?" | Then it does not qualify, and we said so in advance, by name, with that exact case written into the rules. |

**Language discipline** (unchanged from the companion plans, and here it is also the legal
position): say *prize, purse, back a team, fund the prize, odds board*. Never *invest,
returns, wager, sportsbook, guaranteed*. Never imply bettors are paid out of the prize
pool — they are paid from CTF collateral by other bettors, and that distinction has to
survive contact with a headline.

---

## 4. Audience map

There is no competitor recruitment funnel, so the entire map is demand. That is a
simplification the other two plans do not get, and we should spend the surplus on reach.

| Segment | Size / evidence | Hook | Channel | Can they bet? |
|---|---|---|---|---|
| **Space media and newsletters** | Substack embed adoption at 1 in 5 of the top 250 revenue publications | "A live odds card for your Moon coverage, free, no account" | Payload, Orbital Index, Jatan's Space *Moon Monday*, SpaceNews, Ars Technica, NASASpaceflight forums | n/a — they are distribution |
| **Space YouTube** | Everyday Astronaut 1.98M · Scott Manley 1.87M · NASASpaceflight 1.51M · Marcus House 576k | "Put the board on the stream. It moves while you talk" | Direct creator outreach, co-stream on landing night | Their audience, partly |
| **Landing-broadcast audience** | IM-1 1.46M views; Artemis II 3.66M peak concurrent, 23.9M total | "You're already watching. Here's what's at stake for each of them" | Co-stream, clips, live odds overlay | Some |
| **MoonDAO community** | ~38–39k on X, tens of thousands of token holders, Discord | "Our first real prize is live" | Discord, ConvertKit, town halls, `@OfficialMoonDAO` | Yes |
| **Prediction-market natives** | Polymarket 865k MAU; Kalshi onboarded 3M during the World Cup | A market with a mechanism they have not seen and no correlation to sports or politics | r/PredictionMarkets, crypto X, Polymarket/Kalshi community spaces | Yes |
| **The geo-blocked and the wallet-averse** | ~450M people in 33 jurisdictions, plus most of everyone else | The free pick game — no wallet, no deposit, global | Same channels, different call to action | **No — and this is exactly why §5.2 exists** |
| **Local press in operator cities** | Pittsburgh (Astrobotic/CMU), Houston (IM), Cedar Park/Austin (Firefly) | "The Pittsburgh company favoured to be next on the Moon" | Regional TV, city papers, university comms | Some |
| **The five operators** | — | Claim your listing; the purse goes to your flight team | Direct, pre-launch, courtesy | n/a |

The last row is not recruitment and must never read as permission-seeking — listing is
editorial and the roster disclaimer covers it. It is a courtesy notification plus a
genuine offer: free branding via the existing `isCompetitorClaimed` flow, and a purse
pointed at their team. **One claimed listing unlocks the rest**, the same anchor dynamic
the Survive-the-Night plan identifies for competitors.

---

## 5. The four growth mechanics

Everything else in this plan is ordinary execution. These four are where the effort goes,
and they are ordered by leverage.

### 5.1 The Board — an embeddable, free, always-live odds card

One `<iframe>`, one oEmbed, one OG image that renders current odds. Anyone can paste it.
It shows the five operators plus Open Field, current implied odds, the pool, and days
since the last successful landing. It links back but it is **useful without the click** —
that is the entire point, and the reason writers will use it.

Why it carries the campaign:

- **Space media has no canonical "who's ahead" artifact.** Every Moon-race article
  currently hand-rolls a table that is stale the day it publishes. Ours updates itself.
- **Every embed is permanent inbound distribution we never maintain again.** Polymarket's
  Substack adoption happened when embedding was *harder* than this.
- **It survives our own failure.** If betting volume is disappointing, the board is still
  a cited public resource, and the odds still move.
- **It is cheap.** A read-only route over data the detail page already computes.

Ship this **before** any announcement. The launch is the board appearing in other people's
posts, not a thread on our account.

### 5.2 Call the Landing — a free, global, no-wallet prediction game

Pick who lands next, and the date. Email address, no wallet, no deposit, no jurisdiction
check. Public leaderboard. A referral link that shows your position moving. Small prize —
a Citizen pass, merch, a share of a modest pot — run as a **no-purchase-necessary
sweepstakes**, the same legal shape as Bracket Madness and the same shape MoonDAO already
executed with Ticket to Space.

It does five jobs no other asset does:

1. Reaches the ~450M people we geo-block and the far larger number who will never connect
   a wallet.
2. Builds an owned email list, which is the only durable output of this whole campaign.
3. Creates the Robinhood queue dynamic — a position, a leaderboard, a reason to share.
4. Produces the best possible retargeting signal: *this person has an opinion about which
   lander wins.*
5. Converts. After the pick: *"Back it for real"* — one click, pre-filled outcome, for the
   fraction who are eligible and willing.

Do not gate the game behind the market. The game is the front door; the market is one of
the rooms.

### 5.3 The Scorecard — make the argument the content

The most interesting thing we own is not the prize, it is **Test 3**. "Landed" has been
the industry's most litigated word for two years, and we are the only people publishing a
falsifiable definition *in advance*. Build a permanent, updated page that scores **every**
lunar landing attempt against the five tests — Peregrine, SLIM, IM-1, Chang'e-6, Blue
Ghost 1, IM-2, Resilience, and every new attempt as it happens.

This is simultaneously the rules document, an evergreen citable reference, and deliberate
argument bait. Space Twitter and r/space will fight about whether IM-1 counts. They should.
Every one of those fights renders our scorecard. Pair it with an **odds wire**: any move
over five points auto-posts with a one-line reason ("Griffin −11 after the JPL thermal-vac
slip") to X, Discord and an RSS feed, offered free to journalists. Polymarket became
quotable infrastructure this way; a quoted number carries our name into someone else's
article for free.

### 5.4 Borrowed credibility — recruit critics, not endorsers

XPRIZE launches above the line of credibility using gold-plated endorsers. We cannot buy
those. We can get something that works better at our size: **named industry people who
publicly attack the rules and then sign off on them.**

Part V of the spec is already written as a request for criticism — *"This is a request for
criticism, not approval"* — with six specific questions. Run it as a public review round
before `open`. Ask flight dynamics people, CLPS watchers and lunar-industry writers to
score the last seven attempts against Test 3 and tell us where we are wrong. Publish the
critiques *and* the changes. A reviewer who tried to break the rules and failed is a
stronger public signal than a logo, it closes G5, and it makes the eventual resolution
almost impossible to dispute — which is the actual asset we are building.

---

## 6. Phase plan

**The calendar is not ours.** Griffin-1 is Q4 2026 on Falcon Heavy, aggregators list NET
November, and Astrobotic's own cruise numbers are 3–33 days outbound plus 4–25 days in
lunar orbit. A 1 November launch could touch down in **early December 2026**. Working back
from that, a market that opens with less than 30 days of runway before the first plausible
landing is not a market, it is a coin flip with a countdown.

**Target: open by 1 November 2026.** That is roughly seven weeks. If Griffin slips — and
it has already slipped from November 2025 — we get more room and should use it rather than
opening early. Plan for the tight case.

| Phase | Window | Work | Gate to proceed |
|---|---|---|---|
| **P0 — Can this run at all** | Sep 9 – Sep 23 | Counsel engaged (G2). Griffin pad watch stood up as a standing daily check (G1). G6 decision made and written down. Terms drafted for publication (G3) | **Counsel has given a written position and G6 is decided. If either fails, stop — the prize does not open.** |
| **P1 — Freeze the irreversible** | Sep 23 – Oct 14 | Public review round on the rules (G5, §5.4). Rules v1.0 frozen and pinned. New CTF condition prepared with the **Safe** as oracle (G4). Mainnet deploy + funded Juicebox project (G7). Terms live (G3). Roster notified under embargo (G9) | Rules frozen, oracle is the Safe, mainnet registered in `DRAFT`, Terms return 200 |
| **P2 — Build the two assets** *(parallel with P1)* | Sep 23 – Oct 21 | The Board (§5.1) and Call the Landing (§5.2). Scorecard page. Odds wire. **Wire the existing onramp into `BetModal`** — see §8 | Board renders from mainnet data; a stranger can complete a free pick in under 60 seconds; a stranger holding no ETH can place a bet without leaving the site |
| **P3 — Seed distribution under embargo** | Oct 14 – Oct 28 | Board given to 10–15 space writers and 3–5 creators *before* it is public, with the scorecard as the story. Outsider mainnet rehearsal (G8). Community soft-open | ≥5 embeds committed; one outsider has completed bet → resolve → redeem on Arbitrum |
| **P4 — Open** | ~Nov 1 | Remove the access gate. Board goes public and embeddable. Free game opens. Press. First bets | Griffin is not inside a landing window that morning (**recheck the pad — G1 is a daily check, not a one-time one**) |
| **P5 — The race** | Open → landing | Odds wire on every slip and every launch. A content beat per launch, not just per landing. Weekly scorecard updates. Creator co-streams booked in advance of each landing attempt | Odds move at least weekly; if the chart flatlines for 30 days, pull an event forward |
| **P6 — Landing night** | The attempt | Co-stream with the board on screen. Not our broadcast — a layer on somebody else's. Live "what has to happen in the next six minutes" | — |
| **P7 — Resolve in public** | ≤14 days after | Publish the five-test checklist scored against the evidence. Senate vote, livestreamed. Safe executes. Winner paid | A clean, undisputed resolution. **This is the deliverable that matters most** |
| **P8 — Hand off** | After settlement | Everyone acquired goes to Night Shift, where the purse actually changes behaviour. Publish the post-mortem and the full odds history as an open dataset | — |

P7 is the real product launch. Touchdown's lasting value is a public, verifiable
demonstration that this mechanism can take money from strangers, price a hard question,
and pay out correctly without anybody trusting us. Nothing else in this document is worth
as much.

---

## 7. Metrics

| Metric | Must-hit | Target | Stretch |
|---|---|---|---|
| **A clean, undisputed resolution** | ✅ | ✅ | ✅ *in generation 1* |
| Third-party sites embedding the Board | 5 | 25 | 100 |
| Free-game entries | 2,000 | 15,000 | 75,000 |
| Email addresses captured | 1,500 | 12,000 | 60,000 |
| Unique bettors | 150 | 750 | 3,000 |
| Prize pool at settlement | $5,000 | $20,000 | $75,000 |
| Odds-board citations in third-party articles | 3 | 15 | 50 |
| Landing-night co-stream peak concurrent | 500 | 3,000 | 20,000 |
| Named operators who claim their listing | 0 | 2 | 5 |
| Converted to the next prize's list | 500 | 5,000 | 25,000 |

**Pool math, stated honestly, as in the companion plans.** The pool grows by **$50 per
$1,000 of primary betting** and **$10 per $1,000 of secondary trading**, plus direct
contributions one-for-one. "$20,000 at settlement" therefore means roughly $200k primary
plus $350k secondary, *or* a much smaller market plus a few thousand in direct funding.
Direct contribution is by far the cheapest path and needs its own button, visually distinct
from betting. Anyone quoting a pool target without the implied volume behind it is
guessing.

**The metric that actually matters** is none of the above. It is whether, six months from
now, a space journalist writing about the next landing reaches for our odds board without
being asked. If that happens and the pool was small, Touchdown worked. If the pool was
large and nobody cites us, we ran a raffle.

---

## 8. Product dependencies

| Need | Status | Work |
|---|---|---|
| Prize + market page | `pages/deprize/[id].tsx`, `DePrizeIndexContent` exist | Copy only |
| **Embeddable odds board** | — | **New. The highest-leverage build in this plan.** Read-only route + oEmbed + dynamic OG image |
| **Free pick game + leaderboard** | `DePrizeComingSoon.tsx` + `lib/convert-kit/useSubscribe` exist | **New page.** Sweepstakes rules, referral links, leaderboard |
| Scorecard page | — | New static page; content is already written in the spec |
| Odds wire | `lib/discord/sendDiscordMessage`, `lib/notifications` exist | Threshold detection + X/RSS fan-out |
| Odds history chart | `OddsHistoryChart.tsx` exists | Annotate with launch/slip markers so the chart narrates the race |
| Access gate removal | `lib/gate/access.ts`, `middleware.ts` | Drop the `/deprize` prefix at P4 — **this is the literal launch action** |
| Terms page | Draft at `ui/docs/DEPRIZE_TERMS_AND_CONDITIONS.md`; published URL **404s** | Publish (G3) |
| Mainnet Touchdown | Arbitrum registry/mint/fee-router/redeem deployed; no Touchdown | Register, new condition with Safe oracle, JB project, seed LMSR (G4, G7) |
| **Onramp in the bet flow** | Coinbase Onramp and MoonPay both exist (`lib/coinbase/`, `lib/privy/hooks/useMoonPay`) and the Launchpad already uses `lib/mission/useOnrampFlow`. **`BetModal` uses none of them** — an underfunded user is told "Lower your bet or add funds" and the funnel ends there | **Wire the existing onramp into `BetModal`.** Everything acquired by §5.1 and §5.2 arrives without ETH on Arbitrum, so this dead end is where the campaign leaks. The pattern is already proven one flow over |
| Atlas binding | `shared-next-landing` bound to Sepolia #22 | Rebind to the mainnet id |

---

## 9. Budget

There is no marketing budget to speak of. Unrestricted liquid assets are $327,851 against
roughly ten months of net burn, and the social channel is a ≤10 hrs/week contractor role at
$2,000–$2,800/month that is still being hired. This plan is therefore almost entirely
earned, owned and partnered — which is also why §5.1 and §5.2 are the priorities, since
both compound without ongoing spend.

| Line | Lean | Full |
|---|---|---|
| Prize seed | $5,000 *(per G6 option (a))* | $25,000 |
| Legal review (G2, G5, sweepstakes rules) | $4,000 | $12,000 |
| Board + free game development | in house | $6,000 |
| Landing-night co-stream production | $0 *(guest on a creator's stream)* | $3,500 |
| Free-game prize | $500 *(Citizen passes, merch)* | $2,500 |
| Market liquidity seed | ~1 ETH/outcome, recoverable | same |
| **Cash outlay beyond the prize** | **~$4,500** | **~$24,000** |

Legal is the one line that should not be cut. It is cheaper than the alternative and it is
the difference between G2 being closed and being hoped about.

---

## 10. Risks and kill criteria

| Risk | Trigger | Response |
|---|---|---|
| **Griffin lands before we open** | Any landing attempt inside a week of registration | **Do not open.** The prize is void on arrival (spec §IV.5). Pad check is a daily standing item from P0, not a one-time gate |
| **No legal position** | Sep 23 with no counsel memo | **Kill, or restrict to the free game only.** The free pick game is legally clean, globally available, and still builds the list — it is a genuine fallback, not a consolation |
| **The market resolves in three weeks** | Griffin launches early and sticks the landing | Accept it and lean in — a fast, clean, undisputed first resolution is the best possible outcome for the mechanism. Have P7 and the Night Shift handoff ready *before* open, not after |
| **Nothing lands for eighteen months** | Everything slips, as it has before | Rolling sunset with `setSunset`. Manufacture beats from launches and slips, not just landings. This is a real risk: five attempts, all historically slippery |
| **A tipped lander, and everyone argues** | The likeliest resolution scenario on 2024–25 form | This is a feature if the rules held and a catastrophe if they did not — which is the entire reason G5 exists. Publish the scored checklist within 24 hours, before the argument sets |
| **Open Field runs away with the odds** | Field implied odds above ~⅓ | `supersede` onto a new named roster (spec §V.7). Registry generations are a launch dependency |
| **A named operator objects publicly** | Any | Roster disclaimer + the claim flow + the fact that listing is editorial. Having notified them first (G9) turns this from a story into a non-story |
| **"MoonDAO is a gambling site" takes hold** | Press cycle | Lead every single piece with the scorecard and the seven-attempt record, never with the market. The board is the product; the market is a feature of the board |
| **Nobody embeds the board** | 14 days after P3 with fewer than 3 commitments | The distribution thesis is wrong. Fall back to the co-stream and the free game, and do not spend further on the market |
| **We win the audience and lose it** | Settlement | P8 is not optional. An audience acquired for a prize that has resolved is worthless by the following month |

---

## 11. Why run this one first

Set against the companion plans, Touchdown gives up the thing that makes a prize a prize —
it will not cause anything to be built — and in exchange it gets four things neither of the
others can:

- **A climax we do not have to produce, on a date the world already has in its calendar.**
- **No supply-side critical path**, so every hour goes to demand instead of recruitment.
- **A resolution inside months rather than a year**, which means the mechanism gets its
  first public proof early and cheaply.
- **A reason for space media to link to us permanently**, which is an asset that outlives
  the prize.

The cost is that if we describe it wrong — as a $25,000 inducement to companies holding
nine-figure contracts — it makes MoonDAO look like it does not understand its own
industry. That risk is entirely in our control, it is decided by the G6 choice and the
words in §3, and it is the single thing in this document most worth getting right before
anything ships.
