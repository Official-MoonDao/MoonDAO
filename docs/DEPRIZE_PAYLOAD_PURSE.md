<!-- deprize:freeze-table -->
| Block | Lifecycle |
|---|---|
| Counsel-facing Proposed 1.2 draft | `never` in force until counsel approves and `DEPRIZE_TERMS_VERSION` becomes `1.2` |
| Tier brackets | `always` editorial until a broker/operator quote lands |
| Runbook ops steps | `always` |

# DePrize payload purse

**Status:** Draft / not in force. I am not a lawyer. Terms v1.1 and Prize Rules 1.0 still govern.
**Owner:** *unassigned — product* · **Counsel gate:** *unassigned — counsel* · **Last updated:** 2026-09-16

This file is the counsel-facing draft and the procurement runbook. It is **not** the click-wrap
target. Do not move this text into `ui/content/docs/Legal/DePrize/` or bump
`DEPRIZE_TERMS_VERSION` until counsel approves.

---

## 1. What the pool is

The prize pool is Juicebox project `jbProjectId` on the bound DePrize. Sepolia Touchdown
generation 2 is DePrize **#22**, Juicebox project **268**, mission 14. The pool is funded by
the 5% bet slice, direct pays, and live market fees. It is not a CLPS task-order change and
not a cash prize paid to a corporate treasury.

## 2. Who signs

The MoonDAO admin Safe pays the operator or broker from that project (or a Safe-controlled
withdrawal). G4 still applies: this runbook does not migrate the CTF oracle.

## 3. Contracting order

Waterfall from Touchdown v0.2 Part VI (e), **product intent only** until counsel:

1. Winner's next qualifying flight.
2. If (1) cannot be contracted within 24 months of resolution: any roster member's next
   qualifying flight in that window.
3. If (2) fails: a flight-team-named recipient (scholarship, student payload, or named lab),
   not the parent company's general treasury.

Start winner outreach at Senate determination, not at `open`. A public-body winner that
cannot accept a payload agreement skips to (2), then (3). Market resolution is unaffected.

## 4. Tier decision

Payload tier brackets set by **\*unassigned — product\*** (DePrize product) on 2026-09-16.
Not a quote from any operator or broker. **Revisit when** any of: (a) a broker or operator
quote lands for any tier, (b) the pool first crosses `PAYLOAD_TIER_SLOT_USD` ($25,000),
(c) 12 months elapse. Whoever revisits updates this line and the constants together.

| Rounded pool USD | Tier |
|---|---|
| no quote / invalid | `unknown` — no purchase claim |
| < $5,000 | nameplate / plaque |
| $5,000–$24,999 | data capsule |
| ≥ $25,000 | larger outreach / payload slot |

Brackets use the pool rounded to the nearest $500.

## 5. What goes in the payload

(a) opted-in display names from the **manifest** extract (PR-C2 — not the compliance extract);
(b) settlement record hash (condition id + `reportPayouts` tx);
(c) a copy or hash of the MoonDAO constitution / prize one-pager.

Mass/volume budget = whatever the tier and the operator agreement allow.

## 6. Manifest name review

**Not in PR-C.** Owner: *unassigned — moderator*. Trigger: manifest export, before the
operator agreement is signed. Queue: the output of `yarn export:deprize-payload-manifest`,
reviewed row by row. Outcome per row: accept, or decline with a reason recorded. Declined
rows are `DEL`-ed and the user is notified at the address on file. Target: complete within
5 business days of export.

PR-C2 does not start until this owner is a person's name, retention is decided, and the
`DELETE` erasure path exists.

## 7. Retention and erasure

Name retention = flight + 12 months, or on request, whichever is sooner. Erasure is
`DELETE /api/deprize/payload-optin` (C2) plus an out-of-band ops step. The acceptance
history is **not** rewritten. The `payloadNameOptIn` boolean stays in the legal log; the
name does not.

## 8. Fallback

If the winner cannot fly a community payload in 24 months, any roster member's next
qualifying flight; then a flight-team-named recipient. Public-body winner → skip (1).

## 9. What this is not

Not a CLPS task-order change. Not a cash prize. Not a bet. Not tax-deductible
(Terms §10.1 still in force). Not legal advice.

## 10. Exports

Two artifacts, two retention clocks:

- `yarn export:deprize-compliance` — five-year legal extract. Never write raw IPs.
- `yarn export:deprize-payload-manifest` — flight + 12 months (PR-C2). Never write raw IPs.

---

## Proposed 1.2 (counsel draft — not the click-wrap file)

I am not a lawyer. The following would replace the in-force cheque-machine clauses **only
after** counsel approval and a `DEPRIZE_TERMS_VERSION` bump to `1.2`. Until then Terms
**v1.1** and Prize Rules **1.0** govern.

### 10.A — Waterfall (proposed)

For capability-ladder prizes, the Prize is a **community payload purchase** on a future
flight, not ETH wired to the Winner's corporate treasury. Contracting follows §3 above.
Terms §10.1–10.2 (5% contribution / project token) stay in force: they fund the pool, not
a new payee.

### 10.B — Manifest opt-in (proposed; shipped in PR-C2)

A bettor may opt in a display name for the flown manifest. The name is stored outside the
acceptance history, is erasable, and is reviewed by a named moderator before flight.

### Clauses this draft must displace for ladder prizes

| In-force text | Why it must be listed |
|---|---|
| Prize Rules **§6.3** — paid in ETH to the Winner's designated wallet; no cash/fiat alternative | Destination of the purse |
| Prize Rules **§9** — claim window, **30/70** Milestone 1 / Milestone 2 ETH wires, 18-month M2 deadline, forfeiture | Payment mechanics; amending §6.3 alone leaves the milestone machine in force |
| Terms **§7.5** — Prize is paid in milestone tranches | Same machine in the click-wrap |
| Terms **§10.1–10.2** | Stay in force; they fund the pool, not a new payee |
| `ui/lib/deprize/lifecycle.ts` copy (`M1_RELEASED` / `M2_COMPLETE` / "30% of the prize has been released") | Product chrome still describes ETH milestones |

Until counsel approves, do **not** change the Prize Rules Version 1.0 header, the published
Terms, or Risk Disclosures.

### Program-level identity-publication decision (open)

PR-C2 requires opt-in before a display name is published. PR-E publishes a patron address
plus ENS with opt-out only. **Owner:** *unassigned — product/privacy*. No name and no
address may be published until this decision is recorded here.
