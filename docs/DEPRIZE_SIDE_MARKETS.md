<!-- deprize:freeze-table -->
| Block | Lifecycle |
|---|---|
| Outcome labels and outcome order | Frozen at `prepareCondition` |
| Settlement criteria and the partition rule | Frozen at `open` |
| Which parent race a market attaches to | Frozen at `open` |
| Pool destination | `open` — undecided, see §6 |
| Resolution procedure, evidence standards | `always` editable as interpretation only |
| Editorial framing, worked historical examples | `always` editable |

# DePrize side markets

**Owner:** *unassigned — product*
**Last updated:** 2026-09-23
**Status:** Defined, not registered. No side market has an on-chain id on any chain.

Touchdown asks **which operator** lands next. A side market asks what that landing
looks like. This file is the rules of record for the side markets attached to
[DEPRIZE_TOUCHDOWN.md](DEPRIZE_TOUCHDOWN.md).

Nothing on this page is an offer to award a prize.
A side market has **no purse and no competitor** to pay — see §4.

---

## 1. What a side market is

A side market is a full `DePrizeRegistry` entry: its own CTF condition, its own LMSR,
its own outcome set, its own sunset. It inherits the whole jurisdiction stack — the
Schedule A geo gate, the compliance permit, the Terms acceptance log, the per-wallet
position cap — because all of those key on a DePrize id and a side market has one.
That inheritance is the main reason to build side markets as registry entries rather
than as a lighter parallel mechanism.

It is deliberately **not** a race binding. In `ui/lib/deprize/sideMarkets.ts` a side
market carries `parentGoalId`, never `sharedGoalId`, so `findDePrizeIdForGoal` keeps
mapping one Moon Base Zero goal to exactly one primary market and the duplicate-binding
guard in `goalIndexForChain` stays meaningful. A spec pins that invariant.

Outcome `teamId`s are synthetic. `DePrizeRegistry.register` treats `teamIds` as opaque
`uint256` values — at least two, non-zero, unique — and never looks up a Team NFT, so an
outcome like "Lost on descent" does not need one.

### The partition rule

A side market's outcomes **must be mutually exclusive and exhaustive**. CTF payout
numerators are reported across the whole outcome set, so a gap makes the market
unresolvable and an overlap makes it arguable on the day it matters. Every outcome below
is written so that exactly one of them is true for any landing attempt.

`sideMarketOutcomesArePartition` checks the structural half of this — at least two
outcomes, unique keys, unique non-zero team ids. The semantic half is the criteria text
in §2 and §3, and it is only as good as the review it gets.

---

## 2. How it comes to rest

> **How will the next lunar landing attempt end?**

Scored against the same Qualifying Landing tests as the parent prize, on the same
attempt, from the same Senate checklist.

| # | Outcome | Settles when | Team id |
|---|---|---|---|
| 0 | Upright and working | Comes to rest in the orientation the operator published as nominal, and returns surface data for 24 hours, or for its full published mission if that is shorter. Tests 3 and 4 both pass | 701 |
| 1 | Upright, then silent | Nominal orientation, but surface data stops before 24 hours and before the published mission ends. Test 3 passes, Test 4 fails | 702 |
| 2 | Down, but not as planned | Reaches the surface intact but Test 3 is not satisfied, whatever it returns afterwards. Test 3 fails | 703 |
| 3 | Lost on descent | No controlled arrival at the surface: the vehicle is destroyed, or contact is lost and never regained, before touchdown. Test 2 fails | 704 |

**Outcome 2 is the default for an unevidenced attitude.** Part VI(c) of the Touchdown
rules makes Test 3 an evidence test, not a presumption: an operator livestream alone does
not satisfy it, and it needs horizon imagery, independently received telemetry, or
LRO-class orbital imaging. A vehicle that reaches the surface and whose orientation
cannot be established from public sources therefore settles here, not in outcome 0. This
is the clause most likely to be argued, and it is deliberately the conservative reading.

**Worked against the record.** Blue Ghost 1 settles 0. IM-1, IM-2 and SLIM settle 2.
Resilience settles 3. A lander that touches down cleanly and dies at hour 6 settles 1.
Peregrine never reached the Moon and would not have been a scoring attempt at all.

### What counts as the attempt

The next attempt at a controlled lunar landing by any operator, named or in the Open
Field, that would be a scoring attempt for the parent prize. Orbiters, impactors,
flybys, and hoppers deployed from an already-landed vehicle are not attempts, exactly as
in Part III of the Touchdown rules.

If **no** attempt occurs before the market sunsets, there is no outcome to report. The
market settles through `settleNoWinner`, which is a refund-enabling terminal state.
Extend the sunset rather than letting it lapse if an attempt is close.

---

## 3. When it happens

> **When will the landing that settles Touchdown touch down?**

This market resolves on the qualifying landing — the one that settles the parent — not on
the next attempt.

| # | Outcome | Settles when | Team id |
|---|---|---|---|
| 0 | By 31 Dec 2026 | Touchdown UTC on or before 2026-12-31T23:59:59Z | 711 |
| 1 | First half of 2027 | Touchdown UTC in 2027-01-01T00:00:00Z .. 2027-06-30T23:59:59Z | 712 |
| 2 | Second half of 2027 | Touchdown UTC in 2027-07-01T00:00:00Z .. 2027-12-31T23:59:59Z | 713 |
| 3 | 2028 or later | Touchdown UTC on or after 2028-01-01T00:00:00Z, or no qualifying landing before the market sunsets | 714 |

Touchdown UTC is established the same way as for the parent: a public statement from
NASA, ESA, CNSA, JAXA, ISRO or Roscosmos, or the operator plus one of those agencies.
Where two clocks disagree, publish both and use the more conservative one.

Outcome 3 absorbs the no-landing case on purpose, so this market always has an answer and
never needs a refund vector. That makes it structurally different from §2, and bettors
should read it as "not before 2028" rather than as a prediction about 2028 specifically.

---

## 4. A side market is not a prize

The parent prize pays a purse: a community payload purchase on the winner's next flight,
per [DEPRIZE_PAYLOAD_PURSE.md](DEPRIZE_PAYLOAD_PURSE.md).
A side market has **no purse and no competitor**.
"Upright and working" is a condition, not an organization, and nobody is paid for
causing it.

This matters for copy. A side market is never described as a prize, a competition, or
something an operator can enter or win. The UI heading is "Also on this landing" and the
prose word is "side market". Nothing on a side market surface may imply that a listed
operator has entered, endorsed, or is affiliated with it, which is the same standard the
roster disclaimer sets for the parent.

---

## 5. Resolution

**Side markets settle in the same Senate vote and the same Safe batch as the parent.**

This is not a convenience. Both side markets resolve off facts the Senate is already
establishing for the parent checklist, so whoever holds the oracle role learns the side
outcomes at the moment they learn the parent outcome. Resolving them in separate
transactions opens a window in which that person can trade the side markets on knowledge
the market does not have yet. The existing insider blocklist is the control that bounds
this; sequencing is what removes the window.

One consequence worth stating plainly: the attitude market can settle while the parent
prize does not. An attempt that settles outcome 2 or 3 in §2 tells us a landing failed
Test 3 or Test 2, which leaves the parent open for the next attempt. The markets are
coupled by evidence, not by lifecycle.

---

## 6. Open decisions

**Pool destination.** `_deprizeIdByJBProject` enforces one DePrize per Juicebox project,
and only `supersede` reuses one, so side markets cannot literally share the Touchdown
pool. `DePrizeMint` splits 5% of every bet into the bet's own DePrize project regardless.
Two options, neither chosen:

1. Each side market registers with its own Juicebox project whose payout recipient is the
   Touchdown payload-purse beneficiary, so the 5% still funds one payload.
2. Side-market pools stand alone and are rolled into a future prize.

Option 1 keeps a single story about where the 5% goes, which is the story Terms v1.2 and
the payload purse already tell. This must be settled before registration, because the
project id is fixed at `register`.

**Whether to add a third market.** A confirmation market ("which agency confirms it
first") was considered and left out: it prices a procedural detail rather than an
outcome, and it would be the third market resolving off one checklist.

---

## 7. Behaviour on a parent supersede

Neither outcome set names an operator, which is what keeps side markets stable when the
parent roster changes. Naming ispace as a Touchdown slot is a new generation with a new
roster and a new condition under Part VI(b) of the Touchdown rules; the side markets do
not change and do not need to be superseded with it.

A side market only needs superseding if its own outcome set is wrong — for the window
market, most likely because every bucket but the last has passed.

---

## Frozen editorial defaults

| Decision | Owner | Revisit when |
|---|---|---|
| Two side markets on Touchdown, not three | *unassigned — product* | A fourth question is asked more than the first three |
| Attitude outcomes partition on Tests 2, 3 and 4 | *unassigned — product* | A Touchdown test is reinterpreted under Part VI |
| Unevidenced attitude settles as "Down, but not as planned" | *unassigned — product* | Counsel or the Senate reads Test 3 as a presumption rather than an evidence test |
| Window buckets are Q4 2026, H1 2027, H2 2027, 2028+ | *unassigned — product* | The first bucket passes with no qualifying landing |
| Side markets settle in the parent's Safe batch | *unassigned — product* | Never — this is the insider control |

Ladder context (read-only): [DEPRIZE_CAPABILITY_LADDER.md](DEPRIZE_CAPABILITY_LADDER.md).
