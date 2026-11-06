<!-- deprize:freeze-table -->
| Block | Lifecycle |
|---|---|
| Roster, slot rule, and oracle | Frozen at `prepareCondition` |
| Question, definitions, qualifying tests, and tie-break | Frozen at `open` |
| Sunset | Set at registration, then extended with `setSunset` |
| Purse / waterfall | `never` in force from this file — [DEPRIZE_PAYLOAD_PURSE.md](DEPRIZE_PAYLOAD_PURSE.md) |
| Worked examples and field notes | `always` editable as interpretation only |

# WATER ICE

### A DePrize for the first confirmation of water ice measured on the lunar surface

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

> **Which mission will be first to publish confirmation, from in-situ
> measurements on the lunar surface, that water ice is present?**

### Definitions

**Water ice.** Water (H₂O) in solid form. Hydrogen alone (for example, a
neutron-spectrometer hydrogen signal), hydroxyl (OH), and water bound in minerals
or glass are not water ice.

**In-situ measurement.** A measurement made by an instrument on a vehicle resting
on the lunar surface (a lander, a rover, or a hopper after it lands), of the
surface or subsurface at that site. Material drilled, scooped, or heated and
analysed on board counts. Measurements from orbit, from a flyby, of an impact
plume, by telescope, or of returned samples in a laboratory on Earth do not count.

**Mission.** One flight and all of its landed elements. For example, Chang'e-7's
lander, rover, and hopper are one mission.

**Qualifying publication.** One of: (a) a public statement or data release by a
national space agency that operates the mission or the instrument (for example
CNSA or NASA); or (b) a peer-reviewed paper by the instrument team. A statement by
a company alone is not enough.

### Qualifying Confirmation

All four of the following must be met:

1. **After open.** The qualifying publication appears after the prize is `OPEN`.
2. **In-situ.** The result rests on in-situ measurements made by that mission.
3. **Ice, stated plainly.** The publication states that water ice was detected. A
   publication that reports water, hydrogen, or hydration without saying it is
   ice does not qualify. Neither does language that only calls ice possible or a
   candidate.
4. **Authoritative source.** The publication is a qualifying publication as
   defined above.

The **qualifying time** is when the first qualifying publication appears: the
UTC of an agency statement, or the first online publication date of a
peer-reviewed paper.

If any test fails, the mission has not qualified yet. A later publication from the
same mission can still qualify.

### Slots

A named slot is the **mission** listed. A later mission, even by the same operator,
is Open Field. Slot 642 is the VIPER rover's first landing, on whichever lander
carries it.

### Open Field

Open Field wins when a mission not named on the roster makes the first Qualifying
Confirmation.

### Ties

The earlier qualifying time wins. If two publications cannot be put in order, for
example because both give only the same date, the earlier measurement time stated
in the publications wins.

### Deadline

None. The "2027" in the capability ladder's one-line bar is when the named missions
are expected to fly. A confirmation published after 2027 still counts. The prize
stays open until a Qualifying Confirmation is confirmed, the prize is cancelled, or
it ends with no winner under the DePrize Terms and Conditions, Section 8.

### Worked examples

| Case | Result |
|---|---|
| Chang'e-5's 2022 lander measurement of water in surface regolith | Would not qualify. Hydroxyl and bound water, not ice |
| LCROSS, 2009, water in an impact plume | Would not qualify. An impactor, not in-situ |
| Orbital ice maps (for example Chandrayaan-1 M3) | Would not qualify. Orbital |
| VIPER's neutron spectrometer reports a hydrogen signal, and nothing more | Not yet. Hydrogen is not ice |
| Chang'e-7's hopper measures inside shadowed ground, and CNSA states that water ice was detected | Qualifies for Chang'e-7 |
| A NASA instrument on IM-4 detects ice, and NASA states it | Qualifies for IM-4 |
| A company announces ice, with no agency statement or peer-reviewed paper | Not yet. Test 4 is not met |

## Resolution

The evidence is public. When MoonDAO believes a Qualifying Confirmation may have
been published, it publishes a checklist against the four tests. The Eligibility
Review Committee reviews the evidence and publishes a non-binding memorandum. The
Senate votes on the checklist, and the vote is clerical: were the four tests met,
by which mission, and at what UTC. MoonDAO then opens a challenge window of at
least 72 hours. After it closes, the oracle reports the result on-chain in a Safe
transaction. This is the same path Touchdown uses. See
[DEPRIZE_TOUCHDOWN.md](DEPRIZE_TOUCHDOWN.md).

If the checklist cannot be completed from public sources within 14 days of the
publication, the claim is scored as not yet qualified and the market stays open.
The claim is reviewed again when more evidence is published.

These rules freeze when the market opens. After that, only clarifications that
cannot change an outcome are allowed.

### Before open

If a Qualifying Confirmation has already been published, do not open the prize.
Recheck on the morning of `open`.

## Purse

The purse is a community payload purchase. See
[DEPRIZE_PAYLOAD_PURSE.md](DEPRIZE_PAYLOAD_PURSE.md). The Winner is the
organization that operates the vehicle carrying the instrument: CNSA for
Chang'e-7, NASA for VIPER, and Intuitive Machines for an instrument on the IM-4
lander. A public body that cannot accept a payload agreement may name a nonprofit
instead. Whether the Winner claims the purse does not change how the market
resolves.

## Roster

| Team id | Name | Slot (mission) |
|---|---|---|
| 641 | Chang'e-7 | CNSA's Chang'e-7 lander, rover, and hopper |
| 642 | VIPER on Blue Moon MK1 | NASA's VIPER rover, delivered by Blue Origin |
| 643 | IM-4 | Intuitive Machines' IM-4 lander and its payloads |
| 24 | Open Field | Any other mission |

## Oracle

When this prize is registered, the oracle is
`0xAF26a002d716508b7e375f1f620338442F5470c0`, the same oracle as Touchdown.

## Sunset

Not set. At registration the sunset is set 24 months out. It is extended with
`setSunset` until the prize resolves. The market fee and seed liquidity are set at
registration and published on the prize page before open.

## Field notes

- Chang'e-7 targets the Shackleton rim, and its hopper is the element that can
  enter permanently shadowed ground. VIPER flies on the second Blue Moon MK1, late
  2027. IM-4 goes to Mons Mouton in 2027. See
  [DEPRIZE_TOUCHDOWN.md](DEPRIZE_TOUCHDOWN.md) for sources.
- Intuitive Machines' IM-2 carried an ice-prospecting drill in March 2025. The
  lander tipped and the primary ice objectives were not met.
