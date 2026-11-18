---
title: "What four AI forecasters learned about the next Moon landing"
description: "Claude, GPT, Gemini and Grok researched the Touchdown DePrize on their own and placed real bets on Arbitrum. They agreed on the calendar, split on which landers to trust, and traded in ways that tell us something about the market itself."
date: 2026-11-17
author: MoonDAO
authorRole: Executive Branch
category: Mission Report
image: /assets/MoonDAO-OG.png
tags:
  - deprize
  - touchdown
  - ai
featured: false
draft: false
---

The Touchdown DePrize asks one question: **who makes the next Qualifying Landing on the Moon?** Seven outcomes share one market on Arbitrum: Astrobotic, Intuitive Machines, Firefly, Blue Origin, CNSA, ispace and SpaceX.

Today four AI models placed their first real bets on it. Claude, GPT, Gemini and Grok each hold a separate wallet. Each researched the question from scratch, wrote a sourced note, and committed to a probability for every outcome before it saw a single market price. A trading routine then bought whatever each model thought was underpriced.

The four notes add up to nearly 8,000 words and about 70 distinct sources. This post pulls out what they agree on, where they part ways and why, and what happened when their views met the market. Every forecast, trade and full research note is in the appendix at the end.

## The short version

- **They agree on the calendar.** No landing attempt has started, none is likely before 2027, and Astrobotic flies first.
- **They split on the landers.** The widest gap is Intuitive Machines: GPT gives it 11%, Gemini 27%. Astrobotic runs from 18.5% to 33%, CNSA from 16.5% to 29%.
- **The split has one root.** Every model weighed the same trade-off between being early in the queue and having a track record. The probability each gave to the US commercial landers succeeding on their first tries drives almost everything else.
- **The order they traded in mattered.** Each model traded on prices the previous model had already moved, so the last one in line found the market nearly where it wanted it and spent half as much as the others.
- **The market now matches their consensus at the top, but not at the bottom.** The averaged forecasts rank Astrobotic, CNSA, Intuitive Machines and Blue Origin in that order, and so does the market. But SpaceX and ispace still trade at 8.5% each, while no model gives either more than 3%.

## What all four agree on

The research converged on the facts, even though nobody saw another model's work.

- **Every 2026 commercial landing has slipped into 2027.** All four cite NASA's November 7 Moon Base briefing: Griffin-1, IM-3 and Blue Moon Mark 1 moved into next year, and NASA expects four commercial lunar launches in 2027.
- **The queue.** Astrobotic's Griffin-1 is first, no earlier than January 2027, with engine testing still under way. Intuitive Machines' IM-3 follows in March or April, according to its November 12 SEC filing. Blue Origin's Mark 1 is built but waits on New Glenn, which has not flown since its pad explosion. Chang'e-7 came off the pad in August and has no new official date. Firefly's second lander is late in 2027, with a 44-day trip to the far side.
- **The long shots.** ispace's next lander is a 2028 vehicle that has only passed preliminary design review. SpaceX's uncrewed Starship landing depends on an orbital propellant transfer that has never flown. Together the models give these two between 1% and about 4%.
- **Nobody off the roster.** India's Chandrayaan-4 has moved to 2028, and no other lander is on a public 2027 manifest. All four put the chance of an unlisted winner between 1% and 3.5%.

## Where they disagree

Every model framed the question the same way: to win, a lander needs to fly early, land upright, and have everyone ahead of it fail or slip. They disagree on the middle step.

| Outcome | Claude | GPT | Gemini | Grok | Spread |
| :-- | --: | --: | --: | --: | --: |
| Astrobotic | 33.0% | 32.0% | 18.5% | 23.6% | 14.5 pts |
| Intuitive Machines | 26.0% | 11.0% | 27.0% | 22.4% | 16.0 pts |
| CNSA | 16.5% | 19.0% | 28.6% | 29.0% | 12.5 pts |
| Blue Origin | 17.5% | 22.0% | 11.3% | 10.2% | 11.8 pts |
| Firefly | 5.0% | 10.0% | 10.5% | 7.8% | 5.5 pts |
| SpaceX | 0.8% | 2.0% | 1.5% | 3.0% | 2.2 pts |
| ispace | 0.2% | 0.5% | 0.4% | 1.2% | 1.0 pts |

### Intuitive Machines: two tip-overs, read two ways

This is the sharpest split. All four cite the same history: IM-1 and IM-2 both reached the surface and both fell over.

- **GPT (11%)** treats that record as decisive. Its note says the two tip-overs "materially lower" the chance of meeting this market's upright, 24-hour standard. It is the only model that rated Intuitive Machines below the price it found.
- **Gemini (27%)** treats it as a problem with a known fix. It is the only note that dug into the redesign: IM-3 adds a second, independent set of landing sensors, a Doppler lidar backed by two separate laser rangefinders, aimed at the navigation failures behind both tip-overs.
- **Claude (26%)** lands close to Gemini for a different reason. IM-3 goes to Reiner Gamma, a near-side site near the equator that avoids the polar lighting that hurt IM-2, and Nova-C reaches the Moon in about a week, so an April launch means an April landing.
- **Grok (22.4%)** sits in between. It sums up the lander as having "reached the surface twice and stayed upright zero times," but still gives it the second slot in the queue.

### Astrobotic: first in line, or first to slip?

- **Claude (33%) and GPT (32%)** give Astrobotic the most weight because it flies first. Both note that Griffin finished environmental testing at JPL, and that Voyager restated a January launch on November 12. Claude ran the numbers through a simulation, which gave Astrobotic about 31%, then kept its forecast slightly above that because Griffin is "clearly first."
- **Gemini (18.5%)** reads the same NASA briefing and focuses on the other half of the sentence: engine testing is still under way. It adds that missing the early-2027 lighting season at the south pole could cost Griffin months.
- **Grok (23.6%)** shows the most source skepticism of the round. Launch databases list Griffin on January 6, 2027. Grok checked the database's own status label, found the date marked as a placeholder, and refused to count it as evidence. Claude read the same entry's history (November, then December, then January) as a slip pattern. One source, two different readings.

### CNSA: the best lander, but fourth in line

Every model agrees that China's lander is the most reliable on the list. CNSA is 4 for 4 on lunar landings, and Claude puts Chang'e-7's chance of success, once it tries, at 85%. The disagreement is about everyone ahead of it.

- **Claude (16.5%) and GPT (19%)** keep CNSA low because Chang'e-7 has no official date and needs about 90 days of orbital scouting before it can land. It wins mainly if Griffin, IM-3 and Mark 1 all fail or slip past mid-2027.
- **Gemini (28.6%) and Grok (29%)** expect that to happen fairly often. Gemini's base rate is blunt: of seven private lunar landers so far, one landed upright. Three first-time landers in a row each have a real chance of failing, so the reliable lander waiting behind them picks up a lot of probability.

This is the clearest way to read the whole round. **CNSA's probability roughly mirrors how much a model trusts American first flights.** The two models most optimistic about Astrobotic are the two most pessimistic about CNSA, and the reverse holds too.

### Blue Origin and Firefly

- **GPT is the Blue Origin bull at 22%.** It anchored on NASA's October schedule, which put the first Mark 1 landing in the first quarter of 2027. Claude pointed out that Mark 1 is not New Glenn's return-to-flight payload, so its realistic launch is April to June at the earliest. Grok discounted that same October chart because its New Glenn date had already slipped. Gemini was the only model to pick up news from that day: the investigation into the November 15 Vulcan failure, and checked whether it implicated Blue Origin's BE-4 engines. Early reports said it did not.
- **Firefly is the only commercial company with a qualifying landing,** and every model says so. GPT and Gemini give it about 10% as a fallback if the earlier landers fail. Claude gives it 5%: the lander still lacked its engines in late October and faces a 44-day trip to a far-side site that depends on a relay.

## How each model did its research

Same prompt, same tools, four distinct styles.

- **Claude was the modeller.** It was the only one to build an explicit simulation, covering launch slips, transit times, a per-attempt success rate for each lander, and second missions in 2028. It then adjusted the output by hand and explained each adjustment. It also flagged the two rules questions in the next section.
- **GPT was the editor.** At about 780 words, its note is the shortest by far. It gives one or two claims per outcome, each tagged with a direction ("raises slightly", "materially lowers"), and no numerical model. It was also the most willing to stake out a lonely position, on both Intuitive Machines and Blue Origin.
- **Gemini was the archivist.** It numbered every claim and attached several sources to most of them, mixing filings, agency releases, partner statements and trade press. It was the only model to bring in news published the same day, and the one that leaned hardest on base rates.
- **Grok was the skeptic.** At about 3,100 words, its note is the longest. It spends that length questioning the evidence: placeholder dates, schedules that are already stale, and how much a restated plan really says about readiness.

## How they bet

The models chose only the probabilities. Bet sizing came from one shared, rule-based trading routine. It buys only when a model's probability beats the price by enough to cover the 5% prize slice, a 2% allowance for costs, and a 3-point margin. It moves any one outcome by at most 2 points per trade and 5 points per day, makes at most six trades per wallet per day, and can sell only shares it already holds. So the differences in betting below come from two things: what each model believed, and what the market looked like when its turn came.

The models traded one after another: Claude, then GPT, then Gemini, then Grok. Each started from prices its predecessors had already moved.

- **Claude found a nearly flat market** and saw two clear bargains: Intuitive Machines at 13.2% against its 26%, and Astrobotic at 20.8% against its 33%. It alternated between them until it hit the daily 5-point limit on both. Astrobotic went to 24.4% and Intuitive Machines to 17.3%.
- **GPT found Intuitive Machines already above its view.** Claude had pushed it to about 17%, against GPT's 11%. GPT held no shares, so it could not sell. Instead it put three buys into Blue Origin, its favourite underpriced outcome, one into CNSA, and two more into Astrobotic, which took Astrobotic to its peak of 26.5%. GPT ran out of daily trades while CNSA still looked cheap to it.
- **Gemini found Astrobotic at 26.5%, against its own 18.5%.** That was the most overpriced outcome on the board by its view, and the result of the two previous models' buying. It could not sell either, so it did the next best thing in this kind of market. It bought what it liked, CNSA (the round's largest edge: 12.3% against its 28.6%) and Intuitive Machines. In a single shared market, buying one outcome lowers the prices of all the others, so Gemini's buys pulled Astrobotic and Blue Origin back down.
- **Grok arrived last and found most of the work done.** Astrobotic sat at 23.6%, exactly its forecast, so it didn't trade it. It bought CNSA up to its daily limit, then made one small Intuitive Machines buy that stopped as soon as its edge no longer covered fees and the margin. It made four trades instead of six and spent about 0.0021 ETH, about half of what each of the others spent.

The result is a market that bent toward the group's view, one trader at a time. No one coordinated, and no one saw another model's forecast. Each model simply corrected what the previous ones had left. In total the models made 22 buys and spent about 0.014 ETH, including fees and gas.

| Outcome | Price before | Price after | Average of the four forecasts |
| :-- | --: | --: | --: |
| Astrobotic | 20.8% | 22.0% | 26.8% |
| CNSA | 13.2% | 21.2% | 23.3% |
| Intuitive Machines | 13.2% | 18.4% | 21.6% |
| Blue Origin | 13.2% | 12.9% | 15.3% |
| Firefly | 13.2% | 8.5% | 8.3% |
| SpaceX | 13.2% | 8.5% | 1.8% |
| ispace | 13.2% | 8.5% | 0.6% |

The averages leave out the 2.4% the models gave to a winner not on the roster, which the market does not price.

## What we learned

1. **Agreement on facts doesn't mean agreement on forecasts.** All four found the same schedule, the same filings and the same track records. Their numbers still differ by up to 16 points, almost entirely because they gave different odds to first-time landers succeeding.
2. **The most useful disagreement is a single number.** If you believe the US commercial landers will mostly land on their first tries, Astrobotic and Intuitive Machines are cheap. If you don't, CNSA is cheap. Every model's portfolio follows from where it stands on that question.
3. **Turn order shapes behaviour as much as belief does.** Claude and Grok mostly agreed that Intuitive Machines was underpriced, but Claude spent its full daily limit on it and Grok made one tiny buy, only because Grok came later. Next rounds should rotate the order.
4. **A buy-only market can't correct its tail.** Selling something you don't hold isn't possible here, so the only way to say "SpaceX is overpriced" is to buy everything else. After 22 buys, the three long shots still hold 25.5% of the market between them, against a model consensus of about 11%. That gap is a real opportunity for any forecaster who agrees.
5. **Sourcing habits matter.** The best single catch of the round was Grok checking what a database date actually meant. The most timely context came from Gemini picking up news published that day. Both are habits worth asking every model to follow.

## Questions the models raised about the rules

Claude flagged two points that the market's resolution may need to settle:

1. **Blue Moon Mark 1's planned surface mission is about 24 hours,** so a working upright landing should pass the 24-hours-or-full-planned-mission test. Someone should confirm that at resolution.
2. **Who counts as CNSA.** Chang'e-7 now runs under China's merged lunar exploration programme, with the China Manned Space Agency issuing its notices. Claude assumed "CNSA" covers it.

## How the experiment is set up

- **Four models, four wallets.** Claude, GPT, Gemini and Grok each trade from a separate wallet funded with about 0.014 ETH. The trading routine can only send transactions to the market contracts and cannot move funds anywhere else.
- **Independent research.** Each model searched the web on its own and wrote a note with a dated source for every claim. None saw the market's prices, on-chain data, or another model's notes before committing to its numbers.
- **Forecast first, trade second.** A model's probabilities are fixed before any price is read. Trading pauses for a model that loses half its stake, or while a landing attempt is under way.
- **Same market as everyone else.** The bets go through the same DePrize mint as any other bet and pay the same 5% prize slice. These are MoonDAO house wallets, labelled as such, and each is screened against the same sanctions list as every bettor.

## Appendix: every forecast, trade and note

Each section below lists the model's probabilities, its trades with links to every transaction, and its full research note. The notes appear as the models wrote them, trimmed only of references to internal files.


### Claude

Claude Opus 5.5. Wallet [0xf7871111f2AdcA0318a6c8910336b86aF3CD947d](https://arbiscan.io/address/0xf7871111f2AdcA0318a6c8910336b86aF3CD947d). Spent about 0.0039 ETH including the 5% prize slice and gas, across 6 buys: Intuitive Machines x3, Astrobotic x3.

| Outcome | Claude's probability |
| :-- | --: |
| Astrobotic | 33.0% |
| Intuitive Machines | 26.0% |
| Blue Origin | 17.5% |
| CNSA | 16.5% |
| Firefly | 5.0% |
| SpaceX | 0.8% |
| ispace | 0.2% |
| No rostered winner | 1.0% |

| Bought | Cost | Transaction |
| :-- | --: | :-- |
| Intuitive Machines | 0.00068 ETH | [view](https://arbiscan.io/tx/0x922128fa507afa178e3890114b6185d41fa0a0dab98a80eddf5db5b8656c14eb) |
| Astrobotic | 0.00075 ETH | [view](https://arbiscan.io/tx/0x6c0bd6ee2303270644d12d7738c1cc6c84da72a71fbddde885adc4f2721e3eae) |
| Intuitive Machines | 0.00070 ETH | [view](https://arbiscan.io/tx/0x8f9dbe1c3d8433aec3535f207710865b4573329d6e0d07b27a46da8128b9988d) |
| Astrobotic | 0.00076 ETH | [view](https://arbiscan.io/tx/0xe9b100aae8fc5d08624c278264b4909c40bc0db3013a44935a734792dc0bd6e0) |
| Intuitive Machines | 0.00035 ETH | [view](https://arbiscan.io/tx/0xbf049964bba2918f68a956fd1bb08b6234ce70d79dd303fece8e82a3b06d14a1) |
| Astrobotic | 0.00039 ETH | [view](https://arbiscan.io/tx/0x3dc0eb894e5649369cc2cc41b70ec6e68551ec703ba867dd29341a682e690ae2) |

<details>
<summary>Read Claude's full research note</summary>

Question: who makes the next Qualifying Landing on the Moon? A Qualifying Landing is upright and working, and it returns surface data for 24 hours, or for the full planned mission if that is shorter. A tip-over does not count. Roster: Astrobotic, Intuitive Machines, Firefly, Blue Origin, CNSA, ispace, SpaceX.

This note is research done on the evening of 2026-11-17 (UTC).

#### Has a rostered landing attempt started?

**No.** No rostered lander is in flight or on the pad. SpaceNexus's weekly digest (published 2026-11-15) lists no lunar launches or landings from 2026-11-16 through 2026-11-29. The earliest rostered launch is Griffin-1, NET 2027-01-06.

#### Claims, sources, and affected outcomes

##### Astrobotic (Voyager Lunar Systems), Griffin-1

- Voyager says Griffin-1 "recently completed acceptance testing and is on track to launch to the lunar South Pole in January 2027", with 10 payloads. [Voyager Technologies, 2026-11-12](https://voyagertechnologies.com/insights/delivering-the-moon-base/). Affects: astrobotic (up: first in line).
- After acceptance testing the lander went back to Pittsburgh for "final preparations ahead of shipment to Cape Canaveral". It had not shipped as of mid-November. [Voyager press release, 2026-10-13](https://voyagertechnologies.com/press-releases/voyagers-griffin-1-on-track-for-the-moon/); [NASA JPL](https://www.jpl.nasa.gov/news/nasa-jpl-testing-readies-voyager-technologies-lander-for-moon-mission/). Affects: astrobotic (slip risk).
- On 2026-11-07, NASA Moon Base program manager García-Galán said Griffin "will not launch until January at the earliest", citing lunar launch windows and "engine testing is still underway". [SpacePolicyOnline, 2026-11-09, updated 2026-11-10](https://spacepolicyonline.com/news/nasa-shares-moon-base-progress-contract-awards/). Affects: astrobotic (down: unfinished engine testing two months before the NET date points to a further slip).
- Launch Library 2 lists Falcon Heavy, LC-39A, 2027-01-06 with status TBD. Its date history shows Nov 2026, then Dec 2026, then Jan 2027, then Jan 6. [SpaceNexus launch page, data as of 2026-11-17](https://spacenexus.us/launch/cml5wsu35006adx9fs0n9rrcn); [Next Spaceflight, accessed 2026-11-17](https://www.nextspaceflight.com/launches/details/6759/). Affects: astrobotic.
- Track record: 0 qualifying landings in 1 attempt (Peregrine failed in transit in 2024 after a propulsion malfunction). Griffin is a new, larger lander on its first flight, aiming at a south-pole site near Mons Mouton / Nobile. Of four CLPS flights so far, only Blue Ghost 1 fully succeeded. [The Space Review, 2026-10-26](https://www.thespacereview.com/article/5344/1). Affects: astrobotic (per-attempt success is moderate at best).

##### Intuitive Machines, IM-3 Trinity

- Q3 results (SEC exhibit 99.1, 2026-11-12): IM-3 and Altus-1 are "on track for a planned launch in the March/April timeframe". [SEC filing, 2026-11-12](https://www.sec.gov/Archives/edgar/data/1844452/000162828026073106/lunr-20260930xexx991.htm). Affects: intuitive_machines.
- Earnings call: the main engine was fired on the fully integrated lander in late October, and final end-to-end testing finishes in Q1. [Motley Fool transcript, 2026-11-12](https://www.fool.com/earnings/call-transcripts/2026/11/12/intuitive-machines-lunr-q3-2026-earnings-call-transcript/). The company "still needs to complete end-to-end functional testing and a landing-sensor flight test". [MarketBeat call summary, 2026-11-12](https://www.marketbeat.com/instant-alerts/transcript-intuitive-machines-q3-earnings-call-highlights-2026-11-12/). Affects: intuitive_machines.
- NASA's event page lists IM-3 for "Early 2027", headed to Reiner Gamma (low-latitude near side). [NASA](https://www.nasa.gov/event/clps-flight-intuitive-machines-im-3/). Affects: intuitive_machines.
- Track record: 0 qualifying landings in 2 attempts. IM-1 and IM-2 both tipped over, and IM-2 operated for less than a day. [The Space Review, 2026-10-26](https://www.thespacereview.com/article/5344/1); [SpacePolicyOnline, 2026-11-10](https://spacepolicyonline.com/news/nasa-shares-moon-base-progress-contract-awards/). Reiner Gamma avoids the polar lighting that hurt IM-2, and Nova-C transit is about one week, so a launch in April means a landing in April. Affects: intuitive_machines (clear second in the queue; per-attempt odds above 0/2 because of the easier site and fixes from two prior flights).

##### Blue Origin, Blue Moon MK1 "Endurance"

- Couluris (AAS von Braun Symposium, 2026-10-26, published 2026-11-02): "The first Mark I will launch in late first quarter 2027, and a second will carry NASA's VIPER rover by the end of that year". At that time LC-36 was expected to be activated in early to mid December. [American Astronautical Society, 2026-11-02](https://astronautical.org/2026/11/02/artemis-iii-practicing-in-earth-orbit-for-the-return-to-the-moon/). Affects: blue_origin (up a little).
- After that, New Glenn's return to flight slipped to January 2027 (Limp memo). [CNBC, 2026-11-05](https://www.cnbc.com/2026/11/05/blue-origin-launch-new-glenn.html). Ars says MK1 is "a crucial launch in the spring". [Ars Technica, 2026-11-06](https://arstechnica.com/space/2026/11/rocket-report-new-glenn-wont-fly-this-year-china-launches-mini-falcon-heavy/). Next Spaceflight lists NET Q1 2027 and a 46-day fastest pad turnaround at LC-36A. [Next Spaceflight, accessed 2026-11-17](https://nextspaceflight.com/launches/details/7189/). Affects: blue_origin. MK1 is not the return-to-flight payload, so realistically it launches in April–June at the earliest.
- Mission profile (Blue Origin's FCC amendment, as quoted on the NSF forum): 7 to 21 days from launch to landing, including loiter in lunar orbit, and about 24 hours on the surface. [NASASpaceflight forum, 2026-03](https://forum.nasaspaceflight.com/index.php?topic=61306.120). Resolution note: about 24 hours of planned surface operations means a working, upright landing should meet the "full planned mission" test. A person may need to check this at resolution. Affects: blue_origin.
- Track record: 0 attempts. It is the first flight of a large cryogenic BE-7 lander to Shackleton Connecting Ridge (south pole). [Blue Origin MK1 page](https://www.blueorigin.com/blue-moon/mark-1). Affects: blue_origin.

##### CNSA, Chang'e-7

- CNSA reposted the CMSA notice: the mission "does not meet launch conditions" and cannot launch in this year's window. [CNSA, 2026-08-23](https://www.cnsa.gov.cn/n6758823/n6758838/c10770822/content.html). Affects: cnsa (down from the original late-2026 landing).
- As of 2026-11-17 no Chinese official source has named a new date. ILOA said 2026-09-14 that launch is now Q1 2027, and CCTV on 2026-10-31 listed Chang'e-7 among missions to be completed "as planned". The plan keeps about 90 days of polar-orbit scouting before landing. [azmth mission page, as of 2026-11-17](https://azmth.space/moon/missions/change-7). Chinese SpaceNews says the new window will be "determined separately according to mission readiness". [spacenews.com.cn, 2026-11-13](https://spacenews.com.cn/article/1113-domestic-03). Affects: cnsa.
- The next window is either February–March 2027 (China in Space "chatter"; Ars) or mid-August 2027 (an expert quoted by Sichuan Observer). [China in Space, Aug 2026](https://www.china-in-space.com/p/change-7-moon-launch-moved-to-early); [Ars Technica, 2026-08](https://arstechnica.com/space/2026/08/due-to-need-for-absolute-success-china-delays-critical-moon-launch-to-2027/); [cbgc.scol.com.cn, 2026-08-24](https://cbgc.scol.com.cn/news/7881854). A February–March launch gives a landing around late May to July 2027. An August launch gives about November 2027. Affects: cnsa (CNSA wins mainly if Griffin, IM-3 and MK1 all fail or slip past mid-2027).
- Track record: 4 qualifying landings in 4 attempts (Chang'e-3, 4, 5, 6). Resolution note: Chang'e-7 now runs under the merged Lunar Exploration Project, with CMSA issuing notices. I assume "CNSA" covers China's state lunar programme.

##### Firefly, Blue Ghost Mission 2

- Firefly's mission page says "no earlier than 2027", with about 44 days of transit and a far-side landing near Nassau crater that relies on the Elytra relay. [Firefly mission page](https://fireflyspace.com/missions/blue-ghost-mission-2/). NASA says "later in 2027". [SpaceNexus mission page, reviewed 2026-11-12](https://spacenexus.us/moon/missions/blue-ghost-2). Affects: firefly (down: late in the queue).
- In late October the lander "was still lacking its engines and other propulsion system components". [The Space Review, 2026-10-26](https://www.thespacereview.com/article/5344/1). Affects: firefly.
- Track record: 1 qualifying landing in 1 attempt (Blue Ghost 1, 2025). Per-attempt odds are the best of the US companies, but it is fourth or later in line.

##### SpaceX, Starship HLS

- NASA's IAC schedule (October 2026): propellant-transfer demo in Q1 2027, Artemis III docking test in LEO in Q3 2027, uncrewed demo lander launch and landing in Q4 2027. [Space.com, Oct 2026](https://www.space.com/space-exploration/artemis/when-will-spacex-and-blue-origin-fly-to-the-moon-nasa-reveals-lunar-lander-timelines-and-an-artemis-iii-update); [The Grid Fin](https://thegridfin.com/starship-flight-15-16-nasa-2027-hls-checklist/). The demo needs only about 2 hours of telemetry on the surface. Affects: spacex (low: late 2027 at best, after several rivals, and dependent on propellant transfer that has not been demonstrated).

##### ispace

- ULTRA PDR done 2026-11-13. Mission 3 is "scheduled for launch in 2028", and CDR, flight-model build and qualification are still ahead. [ispace, 2026-11-13](https://www.ispace-inc.com/2026/11/13/ispace-completes-preliminary-design-review-pdrfor-the-mission-3-ultra-lander/). Track record: 0 qualifying landings in 2 attempts. Affects: ispace (very low).

##### Non-rostered organizations (affects p_no_rostered_winner)

- ISRO's chairman (2026-11-02): Chandrayaan-4 and -5 are targeted for launch in 2028. [Daily Thanthi, 2026-11-02](https://www.dailythanthi.com/news/india/target-set-for-launch-in-2028-work-on-chandrayaan-4-and-5-missions-in-full-swing-isro-chairman). Earlier plan: October 2027. [India Today, 2026-04-11](https://www.indiatoday.in/science/chandrayaan-4-mission/story/chandrayaan-4-rocket-change-semi-cryogenic-engine-lvm3-launch-2027-lunar-sample-return-moon-mission-2894808-2026-04-11). Affects: p_no_rostered_winner (down). I found no other non-roster lander credibly landing in 2027.

#### NASA-level cadence

- NASA expects four CLPS missions in 2027: Endurance, Griffin, Trinity, and Firefly's. The target of 10 a year starts in 2028. [SpacePolicyOnline, 2026-11-10](https://spacepolicyonline.com/news/nasa-shares-moon-base-progress-contract-awards/). Affects: all US rostered outcomes.

#### Expected order and reasoning

Most likely order of landing attempts: Griffin-1 (late January to March 2027, with a meaningful chance of a longer slip because engine testing is unfinished), then IM-3 (April 2027, possibly later), Blue Moon MK1 (roughly April–July 2027), Chang'e-7 (about June 2027 if it launches in February–March, otherwise November 2027), Blue Ghost M2 (late 2027), Starship HLS (Q4 2027 or 2028), and ispace ULTRA (2028 or later). The first three attempts go to landers with no qualifying landing, so the probability mass spreads down the queue. CNSA has the best per-attempt odds but comes fourth.

I re-ran a Monte Carlo over launch-slip distributions, transit times, per-attempt success odds and second missions in 2028. The odds were Griffin 0.40, IM-3 0.55, MK1 0.45, Chang'e-7 0.85, BGM2 0.65 and Starship 0.50. It gave Astrobotic about 0.31, Intuitive Machines 0.28, Blue Origin 0.18, CNSA 0.16, Firefly 0.06, SpaceX 0.01, ispace under 0.01, and non-roster about 0.001. My final forecast keeps Astrobotic a bit above the model, because it is clearly first and Voyager restated January on 2026-11-12. It moves Intuitive Machines up a little because the SEC filing restates March/April. It nudges CNSA down because there is still no official date, and it lowers non-roster because Chandrayaan-4 moved to 2028.

</details>

### GPT

GPT 5.6 Sol. Wallet [0x5894C92973FC2C402cf96225bB3a7B12070E733E](https://arbiscan.io/address/0x5894C92973FC2C402cf96225bB3a7B12070E733E). Spent about 0.0042 ETH including the 5% prize slice and gas, across 6 buys: Blue Origin x3, Astrobotic x2, CNSA x1.

| Outcome | GPT's probability |
| :-- | --: |
| Astrobotic | 32.0% |
| Blue Origin | 22.0% |
| CNSA | 19.0% |
| Intuitive Machines | 11.0% |
| Firefly | 10.0% |
| SpaceX | 2.0% |
| ispace | 0.5% |
| No rostered winner | 3.5% |

| Bought | Cost | Transaction |
| :-- | --: | :-- |
| Blue Origin | 0.00067 ETH | [view](https://arbiscan.io/tx/0xc9ccfcab7fc345c614066ed79aaaa6feecb9638ac978c3d242d2756d0d653c49) |
| Blue Origin | 0.00069 ETH | [view](https://arbiscan.io/tx/0x313021e8553ab0b260c497c3bf9b0957445e3a2d355e6f81e4b26158fd199472) |
| CNSA | 0.00067 ETH | [view](https://arbiscan.io/tx/0xbc451872b2bca2efb427c7171c96568557600ed74209f2abc7826e51d4022328) |
| Astrobotic | 0.00077 ETH | [view](https://arbiscan.io/tx/0x04945d3391ff93aaf13a9c5565df9d1628e3cc30ff6161909e020d6a5ddadde9) |
| Blue Origin | 0.00035 ETH | [view](https://arbiscan.io/tx/0x90be791c3a2b2ac3f7fb3ee7a32d4ff35b3ec89d670de89f5c02fa56390723ef) |
| Astrobotic | 0.00079 ETH | [view](https://arbiscan.io/tx/0x286ab969516cbeaaa56984c4e51a19d193a025ec4abcadd2866c4ae20257072d) |

<details>
<summary>Read GPT's full research note</summary>

#### Claims and forecast effects

##### Astrobotic

- Griffin-1 completed nearly three months of environmental testing at JPL in late September 2026 and returned to Pittsburgh for final assembly. Source date: late September 2026; page accessed 2026-11-17. Source: https://www.jpl.nasa.gov/images/pia26708-voyager-technologies-griffin-1-completes-environmental-testing-at-nasa-jpl/ . Effect: raises astrobotic slightly because a major preflight campaign is complete.
- NASA officials said Griffin will not launch before January 2027 because of both lunar-window timing and unfinished engine testing. The same update says Astrobotic's prior CLPS mission did not reach the Moon. Source date: 2026-11-10. Source: https://spacepolicyonline.com/news/nasa-shares-moon-base-progress-contract-awards/ . Effect: Griffin remains the schedule leader, but the engine work and Astrobotic's 0-for-1 record cap its chance of making the next Qualifying Landing.

##### Intuitive Machines

- Intuitive Machines said IM-3 remains on track for March/April 2027 after a late-October integrated engine hot fire; final end-to-end testing remains. Source date: 2026-11-12. Source: https://www.sec.gov/Archives/edgar/data/1844452/000162828026073106/lunr-20260930xexx991.htm . Effect: raises intuitive_machines slightly because the company supplied a current, narrow window and passed a meaningful hardware milestone.
- Both prior Intuitive Machines CLPS landers reached the surface but tipped over. Source date: 2026-11-10. Source: https://spacepolicyonline.com/news/nasa-shares-moon-base-progress-contract-awards/ . Effect: materially lowers its conditional chance of meeting this market's upright, 24-hour Qualifying Landing standard.

##### Firefly

- Firefly's current mission page says Blue Ghost Mission 2 will launch no earlier than 2027, take about 44 days to reach its far-side landing, and operate on the surface for at least 10 days. Source page accessed: 2026-11-17. Source: https://fireflyspace.com/missions/blue-ghost-mission-2/ . Effect: the long transfer and lack of a narrower launch date reduce firefly's chance to be first, while the planned surface duration would qualify after a successful upright landing.
- Firefly's Blue Ghost Mission 1 was the only complete success among the first four CLPS launches. Source date: 2026-11-10. Source: https://spacepolicyonline.com/news/nasa-shares-moon-base-progress-contract-awards/ . Effect: Firefly has the strongest US commercial landing record and remains a serious fallback if earlier attempts fail.

##### Blue Origin

- NASA's October HLS schedule placed the first uncrewed Blue Moon Mark 1 landing in Q1 2027. Source date: 2026-10-21. Source: https://www.space.com/space-exploration/artemis/when-will-spacex-and-blue-origin-fly-to-the-moon-nasa-reveals-lunar-lander-timelines-and-an-artemis-iii-update . Effect: keeps blue_origin in the leading 2027 group.
- New Glenn's return to flight slipped to January 2027 after a May hot-fire explosion badly damaged its launchpad. Source date: 2026-11-06. Source: https://www.cnbc.com/2026/11/05/blue-origin-launch-new-glenn.html . Blue Origin describes Endurance as a demonstration mission for its first Mark 1 lander, with no exact launch date on the operator page. Source page accessed: 2026-11-17. Source: https://www.blueorigin.com/blue-moon/mark-1 . Effect: launch-system recovery and first-attempt risk offset the nominal Q1 schedule.

##### CNSA

- China's official mission authority said Chang'e-7 did not meet launch conditions and could not use its planned 2026 window. Source date: 2026-08-31. Source: https://english.spacechina.com/n17212/c4696661/content.html . A November update still said the replacement window would be set only after further testing and verification. Source date: 2026-11-13. Source: https://spacenews.com.cn/article/1113-domestic-03 . Effect: lowers cnsa slightly because it still has no public 2027 date, though its strong lunar-landing heritage keeps it competitive if it is rescheduled promptly.

##### ispace

- ispace said its next lander, Mission 3 ULTRA, is scheduled for 2028 and has completed only preliminary design review; its 2027 Mission 2.5 is an orbiter, not a landing attempt. Source date: 2026-11-13. Source: https://www.ispace-inc.com/2026/11/13/ispace-announces-fy2027-q2-financial-results/ . Effect: keeps ispace near zero for winning before the 2027 field.

##### SpaceX

- NASA's current Artemis plan puts the first crewed landing in 2028 and requires Starship refueling in Earth orbit. Source date: 2026-11-04. Source: https://www.nasa.gov/missions/artemis/nasa-shares-plans-to-accelerate-artemis-return-to-moon/ . The detailed HLS milestone schedule targets an uncrewed Starship lunar landing near the end of 2027, after orbital propellant-transfer, tanker, landing-leg, and other demonstrations. Source date: 2026-10-21. Source: https://www.space.com/space-exploration/artemis/when-will-spacex-and-blue-origin-fly-to-the-moon-nasa-reveals-lunar-lander-timelines-and-an-artemis-iii-update . Effect: keeps spacex above zero but behind the earlier robotic landers.

##### No rostered winner

- ISRO's chairman said Chandrayaan-4 is now targeted for 2028. Source date: 2026-11-02. Source: https://www.dtnext.in/news/tamilnadu/kulasekarapattinam-to-launch-1st-rocket-in-march-april-2027-isro-chairman . Effect: lowers p_no_rostered_winner because the clearest non-rostered landing candidate now trails the main 2027 roster.

#### Attempt status

No rostered lunar landing attempt has started and remains unresolved as of 2026-11-17. The earliest public target found is Griffin-1 no earlier than January 2027; all other identified rostered attempts are later or lack a firm date.

</details>

### Gemini

Gemini 4 Carbon. Wallet [0x6CEB5AEb2F2ACB6DA60bEc6fBa67b42f92223827](https://arbiscan.io/address/0x6CEB5AEb2F2ACB6DA60bEc6fBa67b42f92223827). Spent about 0.0038 ETH including the 5% prize slice and gas, across 6 buys: CNSA x3, Intuitive Machines x3.

| Outcome | Gemini's probability |
| :-- | --: |
| CNSA | 28.6% |
| Intuitive Machines | 27.0% |
| Astrobotic | 18.5% |
| Blue Origin | 11.3% |
| Firefly | 10.5% |
| SpaceX | 1.5% |
| ispace | 0.4% |
| No rostered winner | 2.2% |

| Bought | Cost | Transaction |
| :-- | --: | :-- |
| CNSA | 0.00068 ETH | [view](https://arbiscan.io/tx/0x704263c6fc5991127d079e6d122e9ed0a1ac91e3e45f699234075e56c86c0284) |
| CNSA | 0.00069 ETH | [view](https://arbiscan.io/tx/0xd58e10c6ebf50fb727dcd4331818bcf767db39e96d488de15f301aabad860b26) |
| Intuitive Machines | 0.00069 ETH | [view](https://arbiscan.io/tx/0xcf54ce0c9f6cfe58152f4ff8c807bac9a57cb2f5029872a9cfc429a5757bf1f8) |
| CNSA | 0.00035 ETH | [view](https://arbiscan.io/tx/0xa4da45b72e5df0aaf10af66e0b9fa80b27cb5d5d5ecde84fb38f53a029459dec) |
| Intuitive Machines | 0.00071 ETH | [view](https://arbiscan.io/tx/0xe43979741b7970c4a0c493f10e1210e04669450b288c0737aef420a9de1a39bc) |
| Intuitive Machines | 0.00036 ETH | [view](https://arbiscan.io/tx/0xac4843392f9521f7076d22db8747754104ad68159e069ac9b9eeb5a4e8a69456) |

<details>
<summary>Read Gemini's full research note</summary>

#### Active Landing Attempt Status

- **Has a rostered landing attempt started and remained unresolved?** **No.** As of late 2026-11-17 UTC, zero lunar landing missions have launched in 2026 and no rostered or non-rostered spacecraft is in cislunar transit, lunar orbit ahead of descent, or powered descent. The most recent lunar landing attempt globally remains ispace's Hakuto-R Mission 2 (*Resilience*) on 2025-06-05/06 (hard landing), and the most recent Qualifying Landing remains Firefly Aerospace's *Blue Ghost Mission 1* on 2025-03-02 (14+ days of upright surface operations).

#### Claims, Sources, Dates, and Affected Outcomes

##### Cross-Roster CLPS Manifest & Commercial Base Rates

- **Claim 1:** At NASA's Kennedy Space Center Moon Base press conference on 2026-11-07 and MEPAG briefing on 2026-11-09, NASA officials Carlos García-Galán and Lori Glaze confirmed that all three Moon Base Phase 1 CLPS landers previously eyed for 2026 (*Blue Moon MK1 Endurance*, *Griffin-1*, and *IM-3 Trinity*) have slipped into 2027, that NASA expects only four CLPS launches in 2027 (those three plus Firefly's *Blue Ghost Mission 2*), and that NASA's 10-landings-per-year cadence target now begins in 2028 alongside the new 10-year, $10 billion CLPS 2.0 contract awarded to eight vendors.
  - **URL:** https://spacepolicyonline.com/news/nasa-shares-moon-base-progress-contract-awards/ (source date: 2026-11-10, posted 2026-11-09)
  - **Supporting agency release:** https://www.nasa.gov/news-release/nasa-awards-moon-base-transportation-technology-science-projects/ (source date: 2026-11-07)
  - **Outcomes affected:** astrobotic, intuitive_machines, firefly, blue_origin, cnsa, ispace, spacex, p_no_rostered_winner

- **Claim 2:** Across four NASA CLPS missions flown to date (and seven private lunar lander missions globally), only Firefly Aerospace's *Blue Ghost Mission 1* (2025-03-02) achieved an upright Qualifying Landing; Astrobotic's *Peregrine* (2024-01) failed in cislunar space without attempting descent, Intuitive Machines' *IM-1* (2024-02) and *IM-2* (2025-03, 84.79°S) both tipped over at touchdown (with *IM-2* operating less than a day after striking the surface at ~10 m/s), and both ispace *Hakuto-R* missions (2023-04, 2025-06) suffered hard landings.
  - **URL:** https://www.thespacereview.com/article/5344/1 (source date: 2026-10-26)
  - **Supporting source:** https://aerospaceamerica.aiaa.org/a-2027-lunar-landing-will-put-this-navigation-prototype-to-the-test/ (source date: 2026-05-19)
  - **Outcomes affected:** astrobotic, intuitive_machines, firefly, cnsa, ispace

##### Blue Origin (blue_origin) — *Blue Moon Mark 1 "Endurance"* & *New Glenn*

- **Claim 3 (New on 2026-11-17):** On 2026-11-17, ULA CEO Mark Peller and an official ULA update confirmed that the 2026-11-15 *Vulcan* launch failure (which destroyed 40 Amazon Leo satellites) began just after liftoff with a first-stage liquid-core booster performance shortfall, while all six Northrop Grumman solid rocket boosters and the Centaur V upper stage RL10 engines operated nominally; independently, *Ars Technica* reported on 2026-11-17 from two sources that preliminary data indicates the anomaly originated on ULA's launch-vehicle side (potentially methane/LOX propellant feed systems) rather than inside Blue Origin's two BE-4 engines, though the FAA-overseen investigation remains early and complex and *Vulcan* faces a 6+ month grounding.
  - **URL:** https://arstechnica.com/space/2026/11/sources-vulcan-launch-anomaly-investigation-is-complex/ (source date: 2026-11-17)
  - **Supporting sources:** https://spacenews.com/ula-ceo-says-vulcan-failure-probe-focused-on-liquid-core-booster/ (source date: 2026-11-17); https://orbital-wire.com/launch-mission-tracking/ula-vulcan-centaur-booster-shortfall-failure/ (source date: 2026-11-17)
  - **Outcomes affected:** blue_origin, cnsa, intuitive_machines, astrobotic, firefly

- **Claim 4:** On 2026-11-10, Blue Origin announced on its GS1-3 investigation page that the redesigned BE-4 main oxygen valve—developed after the 2026-05-28 LC-36 static-fire pad explosion—completed qualification testing, is already installed on BE-4 engines slated for upcoming flights, and is expected to close out the May anomaly investigation later in November 2026; CEO Dave Limp set *New Glenn*'s return-to-flight (Amazon Leo) for January 2027 on 2026-11-04/05, while SVP John Couluris confirmed that the debut *Blue Moon Mark 1* lander (*Endurance*, MK1-101, powered by a cryogenic LH2/LOX BE-7 engine targeting Shackleton Connecting Ridge) has completed JSC thermal-vacuum/environmental testing and awaits *New Glenn* for a Q1 / spring 2027 launch.
  - **URL:** https://redstoneorbital.com/posts/breaking-blue-origin-be4-oxygen-valve-qualified.html (source date: 2026-11-10)
  - **Supporting sources:** https://arstechnica.com/space/2026/11/rocket-report-new-glenn-wont-fly-this-year-china-launches-mini-falcon-heavy/ (source date: 2026-11-06); https://www.blueorigin.com/blue-moon/mark-1 (accessed 2026-11-17)
  - **Outcomes affected:** blue_origin, astrobotic, intuitive_machines, cnsa

##### CNSA (cnsa) — *Chang'e-7* & *Lanyue*

- **Claim 5:** Although China's CMSA/CNSA postponed *Chang'e-7* on 2026-08-23 hours before liftoff at Wenchang and rolled *Long March 5 Y14* back to the assembly building on 2026-08-24 without publishing a new official Chinese date, international lander payload partner International Lunar Observatory Association (ILOA, flying the ILO-C camera on the *Chang'e-7* lander) states the mission is now scheduled to launch in **Q1 2027**, while Thai orbiter payload partner NARIT (2026-08-25) and *Ars Technica* (2026-08-23) document that *Chang'e-7* requires approximately **90 days (three months) of lunar polar orbit reconnaissance** prior to descending to Shackleton Crater's sunlit rim (~85°S–88.8°S) ahead of its ~100-day continuous illumination season—creating a bimodal 2027 touchdown window of **May–June 2027** (if launched in Feb–Mar 2027) or **Sept–Nov 2027** (if launched ~1 lunar draconic year after August 2026).
  - **URL:** https://iloa.org/ilo-c-on-change-7-lunar-lander/ (source date: 2026-09-14 update, accessed 2026-11-17)
  - **Supporting sources:** https://www.narit.or.th/en/AstronomyNews-20260825-chang-e-7 (source date: 2026-08-25); https://news.cgtn.com/news/2026-08-25/Explainer-Why-Chang-e-7-can-t-simply-launch-a-few-days-later-1PT8y06o38A/p.html (source date: 2026-08-25); https://english.news.cn/20260823/c9f7c3ca36c94a26a6a3ffc09e7a810d/c.html (source date: 2026-08-23)
  - **Outcomes affected:** cnsa, astrobotic, intuitive_machines, firefly, blue_origin

- **Claim 6:** CNSA/CAST holds a 4-for-4 lunar soft-landing record (*Chang'e-3*, *Chang'e-4*, *Chang'e-5*, *Chang'e-6*) with the *Queqiao-2* lunar relay satellite already operational in orbit since March 2024; at the Seventh Manned Spaceflight Conference in Beijing in late October / early November 2026, Chinese officials confirmed *Chang'e-7* proceeds as planned while scheduling the first uncrewed *Lanyue* crew-lander lunar flight for **2028** on *Long March 10*.
  - **URL:** https://arstechnica.com/space/2026/11/rocket-report-new-glenn-wont-fly-this-year-china-launches-mini-falcon-heavy/ (source date: 2026-11-06)
  - **Outcomes affected:** cnsa

##### Astrobotic (astrobotic) — *Griffin Mission 1*

- **Claim 7:** Voyager Technologies (operating Astrobotic as Voyager Lunar Systems) reported on 2026-10-13 and 2026-11-12 that the 1,265 kg *Griffin-1* lander completed environmental, mass-properties, and acceptance testing at NASA JPL, returned to Pittsburgh for final launch preparations, and targets a **January 2027** SpaceX Falcon Heavy launch from KSC LC-39A carrying >455 kg across 10 payloads (including Astrolab's FLIP rover and Voyager's CubeRover) to the Nobile Crater / Mons Mouton south-polar region, with two additional Voyager lander flights scheduled for 2028.
  - **URL:** https://voyagertechnologies.com/insights/delivering-the-moon-base/ (source date: 2026-11-12)
  - **Supporting sources:** https://www.jpl.nasa.gov/news/nasa-jpl-testing-readies-voyager-technologies-lander-for-moon-mission/ (source date: 2026-10-13); https://investors.voyagertechnologies.com/news/news-details/2026/Voyagers-Griffin-1-On-Track-for-the-Moon/default.aspx (source date: 2026-10-13)
  - **Outcomes affected:** astrobotic, intuitive_machines, cnsa, blue_origin, firefly

- **Claim 8:** NASA Moon Base Program Manager Carlos García-Galán stated on 2026-11-07 that *Griffin-1* will launch no earlier than January 2027 both because of south-polar lunar lighting windows and because **engine testing is still underway**; missing the Q1 2027 south-polar sunlit season risks multi-month lighting delays on an unflown debut lander platform.
  - **URL:** https://spacepolicyonline.com/news/nasa-shares-moon-base-progress-contract-awards/ (source date: 2026-11-10)
  - **Supporting source:** https://www.thespacereview.com/article/5344/1 (source date: 2026-10-26)
  - **Outcomes affected:** astrobotic, intuitive_machines, cnsa

##### Intuitive Machines (intuitive_machines) — *IM-3 "Trinity"* & *IM-4*

- **Claim 9:** In Intuitive Machines' Q3 2026 Form 8-K financial release and earnings call on 2026-11-12, CEO Steve Altemus confirmed that the integrated *IM-3* Nova-C lander completed a LOX/methane main-engine hot-fire in late October 2026, has contracted SpaceX Falcon 9 boosters secured through 2028, and targets launch toward the end of Q1 or April 2027 (March–April 2027 window, deploying *Altus-1* and landing at equatorial near-side Reiner Gamma after a ~7-day transit), while noting that Q1 2027 end-to-end functional tests, an aircraft landing-sensor flight test, and long-lead supply-chain management for landing sensors and space radios remain on the critical path.
  - **URL:** https://www.sec.gov/Archives/edgar/data/1844452/000162828026073106/lunr-20260930xexx991.htm (source date: 2026-11-12)
  - **Supporting sources:** https://www.fool.com/earnings/call-transcripts/2026/11/12/intuitive-machines-lunr-q3-2026-earnings-call-transcript/ (source date: 2026-11-12); https://www.nasa.gov/event/clps-flight-intuitive-machines-im-3/ (accessed 2026-11-17); https://www.nextspaceflight.com/launches/details/6826/ (accessed 2026-11-17)
  - **Outcomes affected:** intuitive_machines, astrobotic, cnsa, blue_origin, firefly

- **Claim 10:** To address the laser altimeter/navigation failures that caused *IM-1* and *IM-2* to tip over, Intuitive Machines CTO Tim Crain confirmed that *IM-3* incorporates dissimilar multi-vendor sensor redundancy—pairing a primary four-beam Doppler LiDAR (Psionic PSNDL-L, derived from NASA Langley technology) with two backup single-laser rangefinders to target 0.8–1.2 m/s vertical and under 0.2 m/s lateral touchdown—while contracted follow-on mission *IM-4* (Mons Mouton, targeted late 2027) was simplified on 2026-11-12 by moving *Altus 2–5* onto a dedicated 2028 NASA VADR Falcon 9 launch.
  - **URL:** https://aerospaceamerica.aiaa.org/a-2027-lunar-landing-will-put-this-navigation-prototype-to-the-test/ (source date: 2026-05-19)
  - **Supporting source:** https://www.nasa.gov/event/clps-flight-intuitive-machines-im-4-2/ (accessed 2026-11-17)
  - **Outcomes affected:** intuitive_machines, cnsa, firefly

##### Firefly Aerospace (firefly) — *Blue Ghost Mission 2 ("Riders 2 the Dark")*

- **Claim 11:** Firefly Aerospace's *Blue Ghost Mission 2* uses a 6.9 m dual-spacecraft stack (*Blue Ghost* lander atop the *Elytra Dark* orbital transfer/relay vehicle) launching on Falcon 9 "no earlier than 2027" with an **~44-day transit** before lunar far-side touchdown near Nassau Crater for 10+ days of surface payload operations; however, at the October 2026 AAS Von Braun Symposium, Firefly engines manager Ryan Cole showed *Blue Ghost 2* still in Texas assembly lacking its engines and propulsion components (targeted for closeout by year-end 2026), consistent with NASA scheduling the mission "later in 2027."
  - **URL:** https://www.thespacereview.com/article/5344/1 (source date: 2026-10-26)
  - **Supporting sources:** https://fireflyspace.com/missions/blue-ghost-mission-2/ (accessed 2026-11-17); https://www.nasa.gov/event/clps-flight-firefly-aerospaces-blue-ghost-mission-2/ (accessed 2026-11-17); https://www.nextspaceflight.com/launches/details/7148/ (accessed 2026-11-17)
  - **Outcomes affected:** firefly, cnsa, intuitive_machines, blue_origin, astrobotic

##### SpaceX (spacex) — *Starship HLS*

- **Claim 12:** SpaceX's *IFT-15* (Ship 42 / Booster 22) completed 14 orbits, deployed 26 Starlink V3 satellites, and achieved the first launch-tower catch of an orbital Starship upper stage on 2026-11-14 (though Booster 22 aborted its catch to the Gulf); nonetheless, NASA's 2026-10-23 Artemis architecture update confirms *Artemis III* in Q3 2027 is a LEO-only docking test, SpaceX has not yet demonstrated orbital cryogenic propellant transfer (scheduled for early 2027), NASA's Aerospace Safety Advisory Panel (2026-10-22) estimates ~22 Starship launches may be required per lunar landing (Musk claims 6–8), and 2026-11-16 *Ars Technica* reporting underscores SpaceX's near-term Starlink V3 focus and high schedule slip probability ahead of any late-2027/2028 uncrewed HLS landing demo.
  - **URL:** https://spacepolicyonline.com/news/spacex-catches-a-starship/ (source date: 2026-11-14)
  - **Supporting sources:** https://www.nasa.gov/missions/artemis/nasa-partners-accelerate-lander-development-for-2028-moon-missions/ (source date: 2026-10-23, updated 2026-10-26); https://arstechnica.com/space/2026/10/latest-estimate-for-starship-launches-required-to-support-a-moon-landing-22/ (source date: 2026-10-22); https://arstechnica.com/space/2026/11/when-will-humans-actually-fly-on-starship/ (source date: 2026-11-16)
  - **Outcomes affected:** spacex, blue_origin

##### ispace (ispace) — *Mission 3 ULTRA*

- **Claim 13:** On 2026-11-13, ispace announced completion of the Preliminary Design Review (PDR) for its redesigned 1,000 kg dry-mass *ULTRA* lander (incorporating a replacement Nammo main engine) for *Mission 3*, scheduled for launch in **2028** (internal Q2 FY2027 development plan: by end of 2028) on an H3 rocket with CDR, flight-model manufacturing, and qualification testing still ahead, while *Mission 2.5* (as early as 2027) is a lunar-orbit relay satellite only.
  - **URL:** https://www.ispace-inc.com/2026/11/13/ispace-completes-preliminary-design-review-pdrfor-the-mission-3-ultra-lander/ (source date: 2026-11-13)
  - **Outcomes affected:** ispace

##### Non-Rostered Contenders (p_no_rostered_winner)

- **Claim 14:** India's ISRO officially targets 2027 (no earlier than October 2027 / "by 2028" in roadmap disclosures, with parliamentary committee notes flagging slow budget utilization) for *Chandrayaan-4*, a complex south-polar sample-return mission requiring two separate LVM3 launches and Earth-orbit docking, followed by ISRO/JAXA *Chandrayaan-5 / LUPEX* in September 2028; Turkey's 2027 *AYAP-1* is an orbiter ending in a controlled hard impact (ineligible for a Qualifying Landing), SpaceIL's *Beresheet 2* remains paused, Roscosmos's *Luna-27A* targets 2029, and Impulse Space targets 2028 for its first Helios-stage lunar lander missions.
  - **URL:** https://www.pib.gov.in/PressReleasePage.aspx?PRID=2202454&lang=1&reg=1 (source date: 2025-12-11)
  - **Supporting sources:** https://www.indiatoday.in/science/story/isro-mission-timeline-chandrayaan-4-nglv-venus-orbiter-bas-moon-landing-2040-bharatiya-antarikish-station-2888691-2026-03-29 (source date: 2026-03-29); https://www.globenewswire.com/news-release/2025/10/14/3166735/0/en/Impulse-Space-Unveils-Proposed-Mission-Architecture-to-Deliver-More-Mass-to-the-Lunar-Surface.html (source date: 2025-10-14)
  - **Outcomes affected:** p_no_rostered_winner

</details>

### Grok

Grok 4.7. Wallet [0x749491dea6482Ec60C609ED3c0D6fcf3161aC41F](https://arbiscan.io/address/0x749491dea6482Ec60C609ED3c0D6fcf3161aC41F). Spent about 0.0021 ETH including the 5% prize slice and gas, across 4 buys: CNSA x3, Intuitive Machines x1.

| Outcome | Grok's probability |
| :-- | --: |
| CNSA | 29.0% |
| Astrobotic | 23.6% |
| Intuitive Machines | 22.4% |
| Blue Origin | 10.2% |
| Firefly | 7.8% |
| SpaceX | 3.0% |
| ispace | 1.2% |
| No rostered winner | 2.8% |

| Bought | Cost | Transaction |
| :-- | --: | :-- |
| CNSA | 0.00071 ETH | [view](https://arbiscan.io/tx/0x5e6966a3bd3be3e68326d046a5cbd451453263936ea24b6f9c639ca1b0f90c65) |
| CNSA | 0.00073 ETH | [view](https://arbiscan.io/tx/0x61d26999318d3f43ac0feb85923436920e0511d6f953d2a233ca0f6de7c0e4ac) |
| CNSA | 0.00037 ETH | [view](https://arbiscan.io/tx/0xc02b3f1793c1e40e65c883b5b6b8682ab7a9c912de36d4e402ec13415eefd455) |
| Intuitive Machines | 0.00016 ETH | [view](https://arbiscan.io/tx/0xe87a4e35da57a3b69945216f550319193270f894849f446086d91189f914a859) |

<details>
<summary>Read Grok's full research note</summary>

Fresh pass on 17 November 2026 UTC. A Qualifying Landing is an upright, working landing that returns surface data for 24 hours, or for the full planned mission if that mission is shorter. A tip-over is not one.

#### Landing attempt in progress

No. No rostered lander is in flight and none has started a descent. A 15 November weekly check of Launch Library 2 found no lunar launch or landing from 16 November through 29 November. Griffin Mission One is a future Falcon Heavy launch, status "To Be Determined," not a vehicle on the way.

- Source date: page read 17 November 2026, record last updated 9 November 2026. https://ll.thespacedevs.com/2.2.0/launch/d3bd7fb2-fac6-49fc-ae52-cee07d2fde67/
- Source date: 15 November 2026. https://spacenexus.us/moon/weekly/week-of-2026-11-16
- Affects: all outcomes. The market is still about who attempts next, not about a landing already underway.

#### Claims

##### The 2026 CLPS landings have all moved into 2027, and the 2027 set is the roster

At the 7 November 2026 Moon Base briefing, program manager Carlos García-Galán said Griffin will not launch until January at the earliest, because of lunar launch windows and because engine testing was still underway. Lori Glaze told MEPAG the same week that NASA now expects four CLPS missions in 2027: Griffin, Blue Origin's Mark 1 Endurance, Intuitive Machines' IM-3 Trinity, and one Firefly mission. Of the four CLPS landers already flown, Astrobotic's did not reach the Moon, both Intuitive Machines landers tipped over, and Firefly's Blue Ghost Mission 1 was a complete success. CLPS 2.0 adds ispace-US, Lockheed Martin, Northrop Grumman, and SpaceX to the eligible pool with Blue Origin, Firefly, Intuitive Machines, and Voyager. Those deliveries are spread over ten years. They are not extra 2027 landings. The ten-per-year pace NASA talked about in March now starts in 2028.

- Source date: 9 November 2026, updated 10 November 2026. https://spacepolicyonline.com/news/nasa-shares-moon-base-progress-contract-awards/
- Affects: astrobotic, intuitive_machines, blue_origin, firefly, and p_no_rostered_winner. The next NASA-funded attempts are rostered. A non-rostered CLPS firm does not get a 2027 landing from this award.

##### Astrobotic, now Voyager Lunar Systems: first in line, first landing of this vehicle, south pole

Voyager said on 12 November 2026 that Griffin-1 has finished acceptance testing and is on track to launch to the lunar south pole in January 2027 with ten payloads, including five NASA payloads, Astrolab's FLIP rover, and Voyager's CubeRover. Two further lander missions are scheduled for 2028. That company date and NASA's "January at the earliest" are five days apart. NASA had said engines were still in test. The company then said acceptance testing was complete. January is the working date, and it is not a completed shipment to the pad.

Launch Library 2 lists Falcon Heavy | Griffin Mission One from Launch Complex 39A with a net of 6 January 2027 and status "To Be Determined." The library's own description of that status is a placeholder. On 15 September 2026 García-Galán said the landing site is Mons Mouton, near the south pole.

Peregrine, in January 2024, is the prior Astrobotic lunar flight. It had a propulsion malfunction after launch and did not attempt a landing. Griffin is the first time this organization tries to land. Mons Mouton is the region where Intuitive Machines' IM-2 came down on its side.

- Source date: 12 November 2026. https://voyagertechnologies.com/insights/delivering-the-moon-base/
- Source date: 15 September 2026. https://aerospaceamerica.aiaa.org/nasa-expects-one-lunar-launch-this-year-moon-base-manager-says/
- Source date: 26 October 2026. https://thespacereview.com/article/5344/1
- Source date: record updated 9 November 2026, read 17 November 2026. https://ll.thespacedevs.com/2.2.0/launch/d3bd7fb2-fac6-49fc-ae52-cee07d2fde67/
- Affects: astrobotic. Earliest rostered launch. A January liftoff puts the landing weeks later, still ahead of a March or April IM-3 if both dates hold. South-pole terrain and a first landing are the reasons this is not treated as a likely success. The 2028 flights matter only if Griffin does not qualify.

##### Intuitive Machines: IM-3 is next, at an easier site, on a lander that has tipped twice

On the 12 November 2026 earnings call, CEO Steve Altemus said a late-October hot fire of the liquid-oxygen and methane engine was done on the fully integrated IM-3 lander. End-to-end testing runs into the first quarter, including a landing-sensor flight on an aircraft, for a launch toward the end of the first quarter or in April 2027. He described IM-3 as the same Nova-C production line as the earlier landers, about 130 kilograms of payload. The launch also carries the first Altus relay satellite. NASA's Moon Base manager said on 15 September 2026 that IM-3 is headed to Reiner Gamma. That site is a near-side swirl at about 7.5 degrees north, not the south pole.

IM-2 Athena touched down on 6 March 2025 about 400 meters from Mons Mouton, on its side inside a crater. NASA called an early end of mission at 12:15 a.m. CST on 7 March after the batteries were depleted. The lander was not upright and did not complete a day of surface work. Altemus later named three causes: laser-altimeter noise, south-pole shadows and low-angle light, and crater-recognition limits in the optical navigation. IM-1 Odysseus also failed to stay upright. Reiner Gamma removes the lighting failure mode. The vehicle is still the family that has reached the surface twice and stayed upright zero times. The 12 November call did not give a new date for IM-4. A March 2025 NASA release listed IM-4 in 2027, and also listed IM-3 in 2026, so that page is not a current schedule.

- Source date: 12 November 2026. https://www.fool.com/earnings/call-transcripts/2026/11/12/intuitive-machines-lunr-q3-2026-earnings-call-transcript/
- Source date: 15 September 2026. https://aerospaceamerica.aiaa.org/nasa-expects-one-lunar-launch-this-year-moon-base-manager-says/
- Source date: 7 March 2025. https://www.nasa.gov/news-release/nasa-receives-some-data-before-intuitive-machines-ends-lunar-mission/
- Source date: 14 May 2025. https://spaceflightnow.com/2025/05/14/intuitive-machines-ceo-points-to-issues-that-prevented-upright-touchdown-during-im-2-moon-landing/
- Affects: intuitive_machines. Second in the likely attempt order. The kinder site is worth a higher chance of staying upright than Griffin's site, and it is not worth treating the third Nova-C flight as a favorite. IM-3 wins "next" only if Griffin has not already qualified.

##### Firefly: the only commercial qualifying landing, and the next one is later and on the far side

Blue Ghost Mission 1 landed upright and stable at Mare Crisium on 2 March 2025 at 3:34 a.m. EST. NASA said the ten instruments would operate for about one lunar day, about 14 Earth days, and then for several hours into the night. That is a Qualifying Landing. It is Firefly's only landing attempt.

Blue Ghost Mission 2, Riders 2 the Dark, is set to launch no earlier than 2027, transit about 44 days, and land near Nassau crater on the far side. Elytra Dark has to deploy the lander and ESA's Lunar Pathfinder and then relay communications. The lander is required to operate at least 10 days and then power down before lunar night so LuSEE-Night can observe. The far side has no direct line of sight to Earth, so a landing that stays upright still fails the data requirement if the relay fails. On 26 October 2026 The Space Review reported that, days earlier, Firefly's engine manager showed Blue Ghost 2 still being assembled in Texas and still missing its engines and other propulsion hardware. NASA's Moon Base manager said on 15 September that this flight is "later in 2027," after Griffin, Mark 1, and IM-3.

- Source date: 2 March 2025. https://www.nasa.gov/news-release/touchdown-carrying-nasa-science-fireflys-blue-ghost-lands-on-moon/
- Source date: mission page read 17 November 2026. https://fireflyspace.com/missions/blue-ghost-mission-2/
- Source date: 26 October 2026. https://thespacereview.com/article/5344/1
- Source date: 15 September 2026. https://aerospaceamerica.aiaa.org/nasa-expects-one-lunar-launch-this-year-moon-base-manager-says/
- Affects: firefly. Best commercial record on the roster, on one near-side trial. The second mission is harder and later. It wins only if the earlier 2027 attempts miss.

##### Blue Origin: Mark 1 is built, and it waits on New Glenn

On 15 September 2026 Jacki Cortese of Blue Origin said the next Mark 1 step was a fueling test, then encapsulation and a flight in early 2027, and called a first lunar-lander flight high-risk. García-Galán the same day said the lander was pretty much fully assembled and put the flight in the first part of 2027. NASA's event page, read 17 November 2026, lists the flight in 2027 to the Shackleton Connecting Ridge.

The rocket slipped after that. On 5 November 2026 CEO Dave Limp told employees New Glenn's return to flight moved from the end of 2026 to January 2027 while the pad damaged in the May explosion is rebuilt. CNBC reported the January target as about ten days later than the prior internal date, and quoted Limp the next day saying a lunar customer flies in 2028. That 2028 line is a customer flight, not a cancellation of the NASA pathfinder. Ars Technica on 6 November, reporting the same memo, said New Glenn's manifest after the return-to-flight mission includes a Blue Moon Mark 1 launch in the spring. Mark 1 is not the first New Glenn flight after the stand-down.

An earlier NASA chart, briefed on 5 October and reported by Space.com on 21 October, still had Mark 1 in the first quarter of 2027 and New Glenn back in the fourth quarter of 2026. The November rocket slip supersedes that rocket date, and the spring Mark 1 wording supersedes "first quarter" for the first lander. The same October chart also showed a second Mark 1 flight in the fourth quarter of 2027 and an uncrewed Mark 2 landing in the first quarter of 2028. Those later flights stay in the timeline as discounted chances, because the chart's near-term rocket date has already moved.

- Source date: 15 September 2026. https://aerospaceamerica.aiaa.org/nasa-expects-one-lunar-launch-this-year-moon-base-manager-says/
- Source date: page read 17 November 2026. https://www.nasa.gov/event/clps-flight-blue-origins-blue-moon-mark-1/
- Source date: 5 November 2026, updated 6 November 2026. https://www.cnbc.com/2026/11/05/blue-origin-launch-new-glenn.html
- Source date: 6 November 2026. https://arstechnica.com/space/2026/11/rocket-report-new-glenn-wont-fly-this-year-china-launches-mini-falcon-heavy/
- Source date: 21 October 2026. https://www.space.com/space-exploration/artemis/when-will-spacex-and-blue-origin-fly-to-the-moon-nasa-reveals-lunar-lander-timelines-and-an-artemis-iii-update
- Affects: blue_origin. First south-pole landing, on a cryogenic lander, after a rocket that has not flown since the pad explosion. A spring launch puts the attempt behind Griffin and around or just after IM-3. A second Mark 1 later in 2027 is a second chance only if the first does not qualify and Chang'e 7 has not qualified either.

##### CNSA: four qualifying landings, and Chang'e 7 is off the pad until 2027

Chang'e 3 and Chang'e 4 landed and roved. Chang'e 5 landed on 1 December 2020 and returned samples. Chang'e 6 launched on 3 May 2024, landed on the far side in Apollo basin at 22:23 UTC on 1 June 2024, and lifted its ascender at 23:38 UTC on 3 June 2024. The return capsule landed on Earth on 25 June 2024. That is four landing attempts and four qualifying landings. Chang'e 5 went from launch on 23 November 2020 to landing in about eight days. Chang'e 6 took about four weeks. Neither mission spent months in orbit before landing. Chang'e 7 is the first in the series aimed at the south pole, with an orbiter, lander, rover, and hopper.

On 23 August 2026 the China Manned Space Agency said Chang'e 7 does not meet launch conditions and cannot fly in this year's planned window. Xinhua carried that sentence the same day. No Chinese official date has replaced it. A 15 November weekly check found nothing new on the Chinese lunar schedule. Thailand's NARIT, which flies an instrument on the orbiter, wrote on 25 August that the launch moves to 2027: no 2026 period with favorable light at the landing site remained, the stack had been taken off the pad, and the mission needs at least three months in polar orbit to map a site China has not landed at before. That three-month survey is a partner's explanation. It is not a CNSA flight plan, and it is longer than Chang'e 5 or Chang'e 6 actually used. A first-quarter launch with a Chang'e-like cruise could put the landing in the second quarter, near IM-3. A first-quarter launch plus a three-month survey, or a later launch, puts the landing in the second half of 2027 or into 2028.

- Source date: 23 August 2026. https://english.news.cn/20260823/c9f7c3ca36c94a26a6a3ffc09e7a810d/c.html
- Source date: 25 August 2026. https://www.narit.or.th/en/AstronomyNews-20260825-chang-e-7
- Source date: 15 November 2026. https://spacenexus.us/moon/weekly/week-of-2026-11-16
- Source date: page read 17 November 2026, recording the Chang'e 3 through Chang'e 6 landing record and the Chang'e 6 dates. https://www.planetary.org/space-missions/change-6
- Source date: page read 17 November 2026. https://space.skyrocket.de/doc_sdat/change-5.htm
- Affects: cnsa. Highest conditional success rate on the roster, on a harder first polar landing. China is not first in line. Chang'e 7 becomes the most likely single winner because Griffin and IM-3 try earlier and fail more often, not because China tries first.

##### ispace: next landing is a new vehicle, still before critical design, aimed at 2028

Mission 2's RESILIENCE lander lost communications during descent on 6 June 2025. The 24 June 2025 analysis blamed the laser rangefinder hardware. Mission 1 also failed to land. On 13 November 2026 ispace completed the preliminary design review for the larger ULTRA lander, including a Nammo engine change, and said launch is scheduled for 2028. Critical design review, flight-model build, and qualification are still ahead. Development of ULTRA started in March 2026. The quarterly slides say the launch had been agreed with the Ministry of Economy, Trade and Industry for the end of 2027, and that as of 13 November the internal plan is the end of 2028, pending the ministry's approval. Mission 2.5 does not land.

- Source date: 13 November 2026. https://www.ispace-inc.com/2026/11/13/ispace-completes-preliminary-design-review-pdrfor-the-mission-3-ultra-lander/
- Source date: slides for the quarter ending March 2027, footnote dated 13 November 2026, read 17 November 2026. https://d2xlcgjnpyakn4.cloudfront.net/wp-content/uploads/2026/11/Presentation-Material-for-Q2-of-Fiscal-Year-Ending-March-2027.pdf
- Affects: ispace. The next landing attempt is a different vehicle, still pre-CDR, with a 2028 launch. It is the next qualifier only if every 2027 attempt, and the earlier 2028 attempts, fail.

##### SpaceX: an uncrewed lunar landing is a late-2027 target that needs a propellant transfer nobody has flown

At the International Astronautical Congress on 5 October 2026, NASA HLS acting manager Steve Creech's timeline, reported on 21 October, keeps Artemis III in the third quarter of 2027 as a low-Earth-orbit docking test, not a landing. An uncrewed Starship lunar landing is targeted before the end of 2027, after a lander launch late in the third quarter or early in the fourth. NASA's 23 October architecture note says Starship still aggregates cryogenic propellant from tanker flights, and that the uncrewed demonstration is where that aggregation is shown. Both SpaceX and Blue Origin must fly an uncrewed demonstration of the crew lander before a crewed landing. NASA has not assigned the first crewed landing, targeted for 2028, to either company. Artemis III does not land.

- Source date: 21 October 2026, reporting the 5 October 2026 presentation. https://www.space.com/space-exploration/artemis/when-will-spacex-and-blue-origin-fly-to-the-moon-nasa-reveals-lunar-lander-timelines-and-an-artemis-iii-update
- Source date: 23 October 2026. https://www.nasa.gov/missions/artemis/nasa-partners-accelerate-lander-development-for-2028-moon-missions/
- Affects: spacex and blue_origin. SpaceX has no lunar landing attempt behind it. A late-2027 landing is a stated target sitting on an undemonstrated propellant transfer. It wins "next" only if the 2027 CLPS and Chang'e 7 attempts miss.

##### Anyone not on the roster

India's Chandrayaan-4 is a sample-return landing. On 9 February 2026 The Hindu reported ISRO chairman V. Narayanan's target of 2028, and officials described the mission as at least two years away, with a candidate site at Mons Mouton. A 14 February 2026 report quoted the chairman saying the landing point was not final and the project was still in design, with launch scheduled for 2028. A surface stay planned for a few days would count if the landing is upright and works for that planned time. Chandrayaan-3 already landed in 2023, so it is not "next." No other national lander is on a public manifest ahead of the 2027 roster. Lockheed Martin and Northrop Grumman are CLPS 2.0 vendors, not 2027 flights.

- Source date: 9 February 2026. https://www.thehindu.com/sci-tech/science/isro-identifies-site-for-chandrayaan-4-lander/article70611017.ece
- Source date: 14 February 2026. https://www.newindianexpress.com/states/karnataka/2026/Feb/14/finalising-moon-landing-point-for-chandrayaan-4-isro-chairman
- Source date: 9 November 2026. https://spacepolicyonline.com/news/nasa-shares-moon-base-progress-contract-awards/
- Affects: p_no_rostered_winner. A non-rostered win is a 2028-or-later Indian landing, or a lander not yet on a public manifest, and only if the 2027 rostered attempts fail.

#### Assessment

Order of the next realistic landing attempts: Griffin in the first half of 2027 if the January launch holds, IM-3 about one to two months behind it at Reiner Gamma, Blue Moon Mark 1 in the spring after New Glenn flies, Chang'e 7 one cruise or one orbital survey after whatever 2027 window China uses, Blue Ghost 2 later in 2027 on the far side, an uncrewed Starship only if propellant transfer flies, and ispace's ULTRA lander after a 2028 launch.

Conditional on an attempt, Chang'e-class landers are in a different class from the commercial first flights. Firefly is the only commercial organization with a qualifying landing, and its next try is late and depends on a relay. Intuitive Machines has reached the surface twice and stayed upright zero times. Griffin and Mark 1 are first landings at the south pole. The 6 January Griffin date is a database placeholder, so it does not raise Astrobotic. The October chart's second Mark 1 is an extra 2027 Blue Origin try, discounted because that chart's New Glenn date has already slipped.

- cnsa: 0.290
- astrobotic: 0.236
- intuitive_machines: 0.224
- blue_origin: 0.102
- firefly: 0.078
- spacex: 0.030
- p_no_rostered_winner: 0.028
- ispace: 0.012

</details>

## Caveats

These are experiments with small amounts of ETH. Models can be confidently wrong, their notes are written under time pressure, and sources can be mistaken or out of date. Treat this as a record of what each model concluded and why, not as advice. The forecasts are fixed and will not be edited after the fact. Each new round will get its own post.

You can follow each wallet on Arbiscan from its section of the appendix, and make your own prediction on the [DePrize page](/deprize). Free predictions and voting-power-weighted Citizen forecasts are open worldwide; adding ETH to your prediction is available in eligible jurisdictions.
