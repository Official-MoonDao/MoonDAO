<!-- deprize:freeze-table -->
| Block | Lifecycle |
|---|---|
| Payload framing and waterfall | `open` — product decision recorded 2026-09-17 |
| Tier brackets | `always` editorial until a broker/operator quote lands |
| Runbook ops steps | `always` |

# DePrize payload purse

**Status:** Product decision. Terms v1.2 and these rules describe the purse as a community payload purchase.  
**Owner:** *unassigned — product* · **Last updated:** 2026-09-17

This file is the procurement runbook and the source of record for how the prize pool is spent. Click-wrap Terms and Prize Rules live in `ui/content/docs/Legal/DePrize/`.

---

## 1. What the pool is

The prize pool is Juicebox project `jbProjectId` on the bound DePrize. Sepolia Touchdown generation 2 is DePrize **#22**, Juicebox project **268**, mission 14. The pool is funded by the 5% bet slice, direct pays, and live market fees. It is not a CLPS task-order change and not a cash prize paid to a corporate treasury.

## 2. Who signs

The MoonDAO admin Safe pays the operator or broker from that project (or a Safe-controlled withdrawal). This runbook does not migrate the CTF oracle.

## 3. How the purse is used

The Prize is a **community payload purchase** on a future flight, not ETH wired to the Winner's corporate treasury. Terms §10.1–10.2 (5% contribution / project token) stay in force: they fund the pool, not a new payee.

Contracting order:

1. **Winner's next qualifying flight** — a payload slot on the winning landing-vehicle operator's next vehicle that can carry it.
2. If the Winner does not claim the payload, the Winner may **designate a nonprofit** to receive the Prize (as a payload purchase or equivalent support for that nonprofit).
3. If there is **no response**, the Prize Pool is **rolled into a future prize**.

Market resolution is unaffected (Terms §7.4 / Prize Rules §5). Start winner outreach at Senate determination, not at `open`.

## 4. Tier decision

Payload tier brackets set 2026-09-16. Not a quote from any operator or broker. **Revisit when** any of: (a) a broker or operator quote lands for any tier, (b) the pool first crosses `PAYLOAD_TIER_SLOT_USD` ($25,000), (c) 12 months elapse. Whoever revisits updates this line and the constants together.

| Rounded pool USD | Tier |
|---|---|
| no quote / invalid | `unknown` — no purchase claim |
| < $5,000 | nameplate / plaque |
| $5,000–$24,999 | data capsule |
| ≥ $25,000 | larger outreach / payload slot |

Brackets use the pool rounded to the nearest $500.

## 5. What goes in the payload

Settlement record hash (condition id + `reportPayouts` tx) and a copy or hash of the MoonDAO constitution / prize one-pager. A flown name manifest can be added later; it is not part of this version.

Mass/volume budget = whatever the tier and the operator agreement allow.

## 6. Fallback

If the Winner does not claim, they may name a nonprofit. If they do not respond, roll the pool into a future prize. Do not re-award the slot to another roster member's next flight.

## 7. What this is not

Not a CLPS task-order change. Not a cash prize. Not a bet. Not tax-deductible (Terms §10.1 still in force).

## 8. Exports

`yarn export:deprize-compliance` — five-year legal extract. Never write raw IPs.

---

## Terms v1.2 (purse destination)

The following is the in-force purse destination for capability-ladder prizes. Milestone payment mechanics in the Prize Rules are unchanged here and will be simplified in a later change.

### Waterfall

For capability-ladder prizes, the Prize is a **community payload purchase** on a future flight, not ETH wired to the Winner's corporate treasury. Contracting follows §3 above.

### Clauses that still describe ETH milestones

Prize Rules §9 and Terms §7.5 still describe milestone tranches. Those sections are out of scope for this change. Do not treat them as a second purse destination: §6.3 (payload purchase + the waterfall) is what the pool buys.
