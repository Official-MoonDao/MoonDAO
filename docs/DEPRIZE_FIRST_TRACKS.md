<!-- deprize:freeze-table -->
| Block | Lifecycle |
|---|---|
| Roster, slot rule, and oracle | Frozen at `prepareCondition` |
| Question, definitions, qualifying tests, and tie-break | Frozen at `open` |
| Sunset | Set at registration, then extended with `setSunset` |
| Purse / waterfall | `never` in force from this file — [DEPRIZE_PAYLOAD_PURSE.md](DEPRIZE_PAYLOAD_PURSE.md) |
| Worked examples and field notes | `always` editable as interpretation only |

# FIRST TRACKS

### A DePrize for the first commercial rover to leave its lander and drive on the Moon

**Owner:** MoonDAO

**Version** 0.2-draft · **Date** 5 November 2026

Competitor listings are editorial and based solely on public sources. No listed
organization has been contacted, has consented, or is affiliated with this prize.

Not available to U.S. persons or anyone located in the United States or another restricted jurisdiction.

## Status

This prize is not registered on the public Arbitrum registry. These rules take
effect when it is registered and opened. Until then they are a draft and can
change.

## Resolution criteria

### The question

> **Which commercial rover will be first to leave its lander and drive at least
> 10 metres across the lunar surface?**

### Definitions

**Rover.** An uncrewed vehicle that moves across the lunar surface on wheels,
tracks, or legs while staying in contact with the ground. Hopping or flying does
not count. No person may be aboard during the qualifying drive, so this is not a
crewed rover race. A crew-capable rover driven remotely with no one aboard is a
rover.

**Commercial.** The rover is operated by an organization that is not a national
government or a government space agency. Companies and universities qualify. A
rover operated by CNSA, ISRO, JAXA, NASA, Roscosmos, ESA, or another government
agency does not qualify, whoever built it.

**Operator.** The organization that drives the rover on the surface. It is not the
lander operator, the launch provider, or a payload customer, unless one of those
also drives the rover.

### Qualifying Drive

All five of the following must be met:

1. **After open.** The whole 10 metres is driven after the prize is `OPEN`. A rover
   that is in transit or already on the surface when the prize opens is eligible,
   but distance driven before open does not count.
2. **Egress.** The whole rover has left the lander and rests on the lunar surface.
   Deployment by the lander (ramp, crane, or release) is allowed. A rover still
   mounted on or attached to the lander has not egressed.
3. **Drive.** The rover moves at least 10 metres across the surface under its own
   propulsion. Distance is the length of ground actually covered, added up across
   one or more drives. Wheels turning while the rover is stuck or slipping in place
   do not count, and neither does being pushed, towed, or carried.
4. **Distance evidence.** The 10 metres is shown by a traverse map, an image
   sequence, or a distance statement published by the rover operator, the lander
   operator, or an agency named in test 5.
5. **Independent confirmation.** At least one of: (a) a public statement by NASA,
   ESA, CNSA, JAXA, ISRO, Roscosmos, CSA, or another national space agency that
   flew or sponsored the rover, confirming that it drove on the surface; (b) imagery
   of the rover off the lander from a camera the rover operator does not control,
   such as another organization's lander camera or an orbiter; or (c) surface
   telemetry received by a third party.

The **qualifying time** is the UTC at which the rover completes 10 metres, as
published. If no time is published, it is the UTC of the earliest published image
or telemetry that shows 10 metres driven.

If any test fails, the drive does not qualify. The operator may try again with the
same rover or a later one.

### Slots

A named slot is the **rover operator**, not one rover. The roster names the rover
each operator was known for when it was listed. Any rover that operator drives
counts for its slot, including a later rover if the named one is lost. A change of
ownership does not split or move a slot.

### Open Field

Open Field wins when a commercial rover operator not named on the roster makes the
first Qualifying Drive. A government rover cannot win through Open Field.

### Ties

The earlier qualifying time wins. If the published evidence cannot put two drives
in order, the earlier egress UTC wins. Two rovers from the same lander are scored
separately.

### Deadline

None. The prize stays open until a Qualifying Drive is confirmed, the prize is
cancelled, or it ends with no winner under the DePrize Terms and Conditions,
Section 8.

### Worked examples

| Case | Result |
|---|---|
| FLIP and CubeRover both leave Griffin-1 | Each is scored on its own. The first to complete 10 metres wins |
| A rover leaves its lander, drives 4 metres, and stops responding | Does not qualify. Test 3 fails. The operator's slot stays live |
| A rover drives 12 metres, and the only evidence is the operator's own video | Not yet. Test 5 is not met |
| A rover is lowered to the surface by a crane, then drives 10 metres | Qualifies. Deployment by the lander is allowed |
| A government agency's rover drives 10 metres | Does not qualify. It is not commercial |
| A hopper lands and hops 30 metres | Does not qualify. Hopping is not driving |

## Resolution

The evidence is public. When MoonDAO believes a Qualifying Drive may have
happened, it publishes a checklist against the five tests. The Eligibility Review
Committee reviews the evidence and publishes a non-binding memorandum. The Senate
votes on the checklist, and the vote is clerical: were the five tests met, by which
operator, and at what UTC. MoonDAO then opens a challenge window of at least 72
hours. After it closes, the oracle reports the result on-chain in a Safe
transaction. This is the same path Touchdown uses. See
[DEPRIZE_TOUCHDOWN.md](DEPRIZE_TOUCHDOWN.md).

If the checklist cannot be completed from public sources within 14 days of the
claimed drive, the drive is scored as not yet qualified and the market stays open.
The claim is reviewed again when more evidence is published.

These rules freeze when the market opens. After that, only clarifications that
cannot change an outcome are allowed.

### Before open

Do not open the prize while a rover from a roster operator is on the lunar surface
and able to drive, or within a week of a landing that carries one. Recheck on the
morning of `open`. If any commercial rover has already met tests 2 to 5, do not
open.

## Purse

The purse is a community payload purchase. See
[DEPRIZE_PAYLOAD_PURSE.md](DEPRIZE_PAYLOAD_PURSE.md). The Winner is the rover
operator. Whether the Winner claims the purse does not change how the market
resolves.

## Roster

| Team id | Name | Slot (operator) |
|---|---|---|
| 631 | Astrolab FLIP | Venturi Astrolab |
| 632 | Voyager CubeRover | Voyager Technologies / Astrobotic |
| 633 | Lunar Outpost MAPP | Lunar Outpost |
| 634 | ispace Tenacious | ispace |
| 635 | Carnegie Mellon Iris | Carnegie Mellon University |
| 24 | Open Field | Any other commercial rover operator |

MoonDAO funded project MDP-262 (FUTURA rover proof-of-concept) is represented
on this rung. It is not a roster slot. A rover from that project could win only
through Open Field, under these rules.

## Oracle

When this prize is registered, the oracle is
`0xAF26a002d716508b7e375f1f620338442F5470c0`, the same oracle as Touchdown.

## Sunset

Not set. At registration the sunset is set 24 months out. It is extended with
`setSunset` until the prize resolves. The market fee and seed liquidity are set at
registration and published on the prize page before open.

## Field notes

- FLIP and CubeRover are manifested on Astrobotic's Griffin-1. See
  [DEPRIZE_TOUCHDOWN.md](DEPRIZE_TOUCHDOWN.md), Slot 0.
- Three named rovers have already been lost with their landers: Iris on Peregrine
  (January 2024), the first MAPP on IM-2, which tipped before the rover could
  deploy (March 2025), and Tenacious on Hakuto-R Mission 2 (June 2025). Under the
  slot rule, those slots count each operator's next rover.
