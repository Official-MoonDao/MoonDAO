# Engineering critique — PR-C (payload purse) and PR-D (forecasts)

| Field | Value |
|---|---|
| **Reviewer** | Staff-engineering pass (design quality, not correctness) |
| **Date** | 2026-09-16 |
| **Scope** | [`pr-c-payload-purse.md`](pr-c-payload-purse.md), [`pr-d-forecasts.md`](pr-d-forecasts.md) |
| **Prior art** | [`pr-design-docs-review.md`](pr-design-docs-review.md) — correctness pass, already applied. Not repeated here. |
| **Did not** | Write product code, commit, or edit any existing file |

This is a different axis from the prior review. That one asked "do the cited facts hold and
will this compile." This one asks "is this the right design, and could two engineers build it
twice and get the same system." Where the prior review already fixed something, it is not
mentioned.

**Headline verdicts.** **PR-C: Needs revision** — the engineering is small and mostly right,
but the two mechanisms it picked (conditional prose as a legal switch, and marketing consent
stored inside a five-year compliance artifact) are both the wrong shape and both get more
expensive the longer they ship. **PR-D: Do not start as written** — the idea is the best in
the rollout and the Brier math section is genuinely good, but the scoring pipeline has a
data-model hole where the leaderboard should be, `resolvedAt` is derived from when a cron
happened to run rather than from the chain (which is exploitable, not just imprecise), and
sybil is not mentioned at all on a free, email-identity, public leaderboard.

---

## 1. Scorecard

### PR-C — Payload purse

| Rubric group | Verdict | Single most important improvement |
|---|---|---|
| Framing | **Adequate** | Say at the top what decision is being asked for and who owns the counsel gate; "Reviewers: Counsel" is a role, not a person who can unblock it. |
| Decision quality | **Adequate** | C3 (separate store for the display name) is rejected on "two writes, two export paths" — that is a straw-man of the strongest alternative. Re-argue it on retention, not on write count. |
| Operational rigor | **Weak** | There is no switch. Derive copy mode from `DEPRIZE_TERMS_VERSION` instead of sprinkling "proposed" prose across six surfaces. |
| Trust & safety | **Weak** | User-supplied display names land in a five-year legal archive with no erasure path, a blocklist sanitizer, and no named moderator. |
| Verifiability | **Adequate** | `describePayloadTier` cases are properly falsifiable; the eligibility-leak claim is "backed" only by `git diff eligibility.cy.ts` being empty, which tests nothing. Write the leak test. |
| Process hygiene | **Weak** | The copy policy is written as "keep X **or** label Y" in five places. An implementer must not be the one choosing between two legal postures. |

### PR-D — Free forecasts and Brier leaderboard

| Rubric group | Verdict | Single most important improvement |
|---|---|---|
| Framing | **Strong** | Good as is. Problem precedes solution, non-goals are real, and the audience (restricted-region, wallet-less) is named and correct. Fix only the stale `Depends on: None`. |
| Decision quality | **Weak** | Every alternative considered is a storage backend. The two consequential forks — cron-scoring vs recompute-on-read, and server vs client scoring — were never put on the table. See §4. |
| Operational rigor | **Weak** | `forecast:{chain}:{id}:scored` is simultaneously the idempotency flag and the `resolvedAt` store; the design deadlocks on its own key. Everything downstream inherits that. |
| Trust & safety | **Weak** | A free leaderboard on email identities is farmable in minutes and the word "sybil" does not appear. Neither does retention, erasure, or the compliance-export boundary. |
| Verifiability | **Adequate** | The `brier.ts` cases are the best test list in the rollout. Everything outside that one file is deferred to "browser verification," which is carrying six subsystems. |
| Process hygiene | **Adequate** | The frozen-defaults table and Review-response footer are good practice; give each frozen default an owner, and reconcile with PR-0. |

---

## 2. PR-C findings

### Must-fix

**C-1. "Proposed" prose is not a switch; derive the copy mode from the version constant.**
§6.3 and §7 step 5 spread the same legal hedge across the pool `Stat` label and tooltip in
[`ui/pages/deprize/[id].tsx`](../../ui/pages/deprize/[id].tsx), two strings in
[`LiveDePrizeHero.tsx`](../../ui/components/deprize/LiveDePrizeHero.tsx), two in
[`RaceMarketCard.tsx`](../../ui/components/deprize/RaceMarketCard.tsx), the 5% line in
[`BetModal.tsx`](../../ui/components/deprize/BetModal.tsx), and the optional explainer. §8
then says **"Flags: none."** When counsel approves 1.2, someone has to find all six, delete
the hedge from each, and not miss one — and the failure mode of missing one is a page that
says both "proposed, Terms v1.1 govern" and "buys the payload" at the same time.

The question the task poses is flag vs conditional copy. Both are wrong. A feature flag is
better than scattered prose because it is one switch, but a flag is the wrong *kind* of
switch for this: env flags are per-environment, flippable by anyone with dashboard access,
and have no coupling to the thing that actually makes the copy true. You would be able to
turn on in-force payload language on a build still serving Terms 1.1, which is precisely the
blocker the prior review raised.

The right mechanism is to make the legal state the switch. Add a pure function next to the
tier helper:

```ts
// ui/lib/deprize/payloadPurse.ts
export type PayloadCopyMode = 'proposed' | 'in-force'
export function payloadCopyMode(termsVersion: string): PayloadCopyMode
```

`'in-force'` only when `termsVersion >= '1.2'`; every surface renders from the mode. Counsel
approval is then one edit to `DEPRIZE_TERMS_VERSION` in
[`ui/lib/deprize/constants.ts`](../../ui/lib/deprize/constants.ts), the copy cannot drift from
the click-wrap by construction, rollback is reverting that one constant, and the property
becomes unit-testable: *"for `termsVersion = '1.1'`, no surface returns unqualified payload
copy."* That is a test that fails if someone ships the C1 failure mode. Today there is no such
test and no such possibility of one.

**C-2. The payload opt-in does not belong on `AcceptanceRecord`.**
[`ui/lib/deprize/acceptanceLog.ts`](../../ui/lib/deprize/acceptanceLog.ts) writes each record
twice: `SET` on `deprize:accept:latest:*` and `LPUSH` onto `deprize:accept:history:*`. The
history list is append-only by design — that is what makes it evidence. Putting
`payloadDisplayName` on that record means:

- A marketing consent artifact is exported to counsel by
  [`export-deprize-compliance-log.ts`](../../ui/scripts/export-deprize-compliance-log.ts),
  which §2 of the doc notes "dumps acceptance list values as-is."
- Erasure of a display name requires mutating or filtering the append-only compliance log.
  That is the one data structure you never want to have to rewrite, and the doc contains no
  erasure path at all.
- Retention is inherited: five years, because the record it rides on is a five-year artifact.
  Nobody decided five years was right for a nickname on a plaque.
- **Opt-in becomes unreachable for anyone who already accepted.** The fields are only written
  by `accept-terms`, which gates on `termsVersion === DEPRIZE_TERMS_VERSION`,
  `areAttestationsAccepted` ([`attestations.ts`](../../ui/lib/deprize/attestations.ts)), and
  `runEligibilityChecks`. A user who accepted last week cannot opt in later without a fresh
  accept, and a restricted user can never opt in. That may be the intended policy, but the
  doc does not say so, which means it is an accident.
- Revocation does not work. Unchecking writes a new record; the old one with the name stays
  in the history list forever.

C3 rejects the separate store on "two writes, two export paths" and "easy to accidentally
read it in eligibility if it lives next to deny-lists." Both are backwards. Two export paths
is the *feature* — you want the manifest extract to be a different artifact from the
compliance extract, with a different retention clock and a `DEL` endpoint. And a distinct
`deprize:payload:optin:{wallet}` prefix is *harder* to leak into eligibility than a field
hanging off the record the eligibility-adjacent path already writes. Recommend: separate key,
modeled on [`complianceStore.ts`](../../ui/lib/deprize/complianceStore.ts) exactly as the
constraints require, stated retention ("until flight + 12 months, or on request"), and a
delete path. Keep a boolean `payloadNameOptIn` on the acceptance record if you want the
consent timestamp in the legal log; keep the *name* out of it.

**C-3. State what happens to collected opt-ins if counsel rejects the framing.**
§9's rollback row covers copy ("keep 1.1 live copy; drop the explainer") and the version
constant. It does not cover the data. If names were collected for a payload that will not
exist, you are holding personal data for a cancelled purpose. One row in §9: *"counsel
rejects → stop collecting, purge collected names within N days, keep the consent booleans."*
That row is cheap now and impossible later if the names are inside the compliance log (see
C-2 — the two findings are the same finding).

### Should-fix

**C-4. `describePayloadTier` thresholds are an unowned decision that oscillates.**
`poolUsd` is `(totalFunding / UNIT) * ethPrice` from `useETHPrice`. A pool parked near
$5,000 will render "nameplate" and "data capsule" on alternating page loads as ETH moves,
and the doc has no hysteresis, no rounding, and no "as of" on the price. Worse, the sentence
is forward-looking procurement speech generated by a UI function with no quote behind it: at
$26k the page promises "a larger outreach slot" that ops has not priced. Recommend three
things. Label the constants as a dated editorial decision with a named owner in
[`docs/DEPRIZE_PAYLOAD_PURSE.md`](../../docs/DEPRIZE_PAYLOAD_PURSE.md) ("set by <owner>
2026-09-16; not a quote; revisit when a broker quote lands"). Add a fourth tier id
`'unknown'` instead of folding "price feed down" and "pool is empty" into `nameplate` — the
doc currently has the UI assert a tier when it has no data. And either ratchet the displayed
tier (never downgrade once reached) or round the pool to the nearest $500 before bracketing,
so an FX wiggle does not change what the product claims it is buying.

**C-5. The display-name sanitizer is a blocklist, and impersonation is not a sanitization
problem.** §6.4 says trim, 40 chars, strip `<>`, reject `://` or a raw IP, NFC, collapse
whitespace. Blocklists lose: that passes `javascript&#58;`, homoglyph domains, RTL-override
tricks, and 40 code points of combining marks (Zalgo) that will render as a smear on a
plaque. Specify an allowlist — Unicode letter/mark/number categories plus space, hyphen,
apostrophe, period — applied after NFC, and define "40 chars" as grapheme clusters, not code
points or UTF-16 units. Separately, "MoonDAO Official" and "Vitalik Buterin" defeat every
sanitizer ever written. That needs a human gate, and §9's "runbook says MoonDAO may refuse"
names no owner, no queue, and no timing. The good news is timing is easy: names are collected
now and flown much later, so moderation happens once at manifest-export time. Say that, and
name who does it.

**C-6. Reviewers and frozen defaults have no owners.** "Counsel (Terms / Prize Rules
drafts), DePrize product, engineering" cannot approve anything. The counsel gate is the
single longest-pole dependency in this PR and there is no person attached to it. Same for the
tier brackets and the "keep ETH-to-winner **or** label proposed" fork.

### Consider

**C-7. Resolve the "or" in the copy policy before merge.** §6.3's table offers the
implementer a choice on every surface. Pick one (C-1 makes this trivial: at `'proposed'` mode
each surface has exactly one string) and delete the alternative from the doc.

**C-8. `AcceptanceRecord` gains optional fields with no schema marker.** Old rows have no
`payloadNameOptIn`; the export will produce a ragged CSV/JSON. Optional fields are fine for
reads, but the export header comment proposed in §7 step 8 is weaker than adding a
`recordVersion` the export can branch on. Low urgency — but if you add it, add it now, while
there is one shape rather than three.

### Verifiability: the test that must exist

The doc's guarantee is "the diff of `eligibility.cy.ts` must be empty." That proves nobody
edited a test file; it does not prove the opt-in cannot reach eligibility. `evaluateEligibility`
is pure and typed, so the direct path is already blocked by TypeScript. The real leak vectors
are `accept-terms` forwarding the request body into `runEligibilityChecks`, and `permit.ts`
reading the acceptance record and branching on it. Two cheap tests in the new
`ui/cypress/integration/lib/deprize/payload-purse.cy.ts`:

1. **Behavioral.** Build two eligibility inputs that differ only by `payloadNameOptIn` /
   `payloadDisplayName` (cast through `as any` to defeat the type guard, which is the whole
   point) and assert `evaluateEligibility` returns deep-equal results. Same for
   `canSubmitDePrizeBet`.
2. **Source-level.** Read the text of `ui/lib/deprize/eligibility.ts`,
   `ui/lib/deprize/attestations.ts`, and `ui/pages/api/deprize/permit.ts` and assert no match
   for `/payloadNameOptIn|payloadDisplayName/`. This is an ugly test and it is the one that
   actually fails when a future agent "helpfully" wires the opt-in into the permit path.

Add a third for C-1: `payloadCopyMode(DEPRIZE_TERMS_VERSION)` is `'proposed'`, and every
exported copy string for that mode contains the disclaimer token.

---

## 3. PR-D findings

### Must-fix

**D-1. `resolvedAt` from the cron tick is exploitable, not merely imprecise.**
§6.5: *"`resolvedAt` = block time of the report if cheap; otherwise ISO of the cron tick when
`resolved` first becomes true."* The scoring rule (§6.1, frozen by the prior review) includes
every UTC day up to but excluding the `resolvedAt` calendar date, scoring the vector standing
at 00:00 UTC of each day. Combine those two with §9's rule that the cron must wait for
`shouldSurfaceResolution` rather than the raw CTF report, and you get a window — hours, or
days while the Senate surfaces a determination — in which the payout vector is **publicly
readable on-chain** but `resolvedAt` has not been recorded. Anyone watching the chain submits
a one-hot on the winner during that window; it becomes the standing vector at the next 00:00
UTC boundary; that day scores a perfect 0 and pulls their time-average down. They did not
forecast anything. They read the answer.

This is not a hypothetical edge: the design deliberately delays `resolvedAt` past the
on-chain report, which is exactly what opens the window. Three changes, all required:

- `resolvedAt` is the **block timestamp of the payout report**, always, never the tick.
  "If cheap" is not a specification. It is one `getBlock` on a log you already have to find.
- Before scoring, **drop** every history entry with `at >= resolvedAt`. Day-boundary
  exclusion is not sufficient; drop at the entry level.
- `submit` refuses once `payoutDenominator > 0` for the condition, not once the cron notices.
  This is the same `deprizeReadClient` call the panel already needs to render a resolved
  state.

The second-order benefit is determinism: with block time, the score is a pure function of
immutable inputs and two independent runs produce identical numbers. With the tick, a Redis
flush or a re-run produces different scores for the same forecasts, which means you can never
recompute and never audit a dispute.

**D-2. The `scored` key is overloaded and the pipeline deadlocks on itself.**
§6.2 defines `forecast:{chain}:{id}:scored` as "ISO time of last successful score
(idempotency)." §6.5 then says to store the fallback `resolvedAt` on that same key. §6.6 says
"If `forecast:{chain}:{id}:scored` is set, skip." Read those three together: the first tick
that observes resolution writes `resolvedAt` into the skip key, and every subsequent tick
skips before scoring anybody. Either nothing is ever scored, or the one tick that does both
uses a `resolvedAt` equal to its own scoring time. Fixing D-1 removes the need for the second
use; fixing this needs distinct keys regardless (`:resolvedAt` observed vs `:scoredAt`
completed), and the completion key must be written **after** the ZADDs, not with them.

**D-3. The leaderboard data model cannot hold what the leaderboard page renders.**
Three separate gaps in one table:

- `ZADD forecast:lb:2026 <-score> <privyUserId>` is **last-write-wins per member**. A user
  scored on prize A and later on prize B ends up ranked by B alone. Nothing in the design
  aggregates across prizes, and nothing says B-only is intended. You need a per-user
  accumulator — `forecast:user:{id}:season:{season}` as a hash with `scoreSum` and `count`,
  written idempotently per `(user, prize)` so a re-run cannot double-count — and the ZSET
  becomes a derived index over the mean.
- §6.4 returns `forecastsCount` per row. **No key stores it.** It cannot be computed from the
  ZSET, and after the prize book is scored nothing links a user back to their books.
- `forecast:lb:{season}` is **not namespaced by chain**, while every other key is
  (`forecast:{chain}:{deprizeId}:...`). Sepolia test prizes and Arbitrum mainnet prizes rank
  in the same table. On a testnet you control the resolution. That is the leaderboard's
  cheapest exploit and it is a one-word fix — but only if you do it before anyone writes
  to `forecast:lb:2026`, because `FORECAST_SEASON` is also consumed by PR-G.

**D-4. Sybil is not mentioned, and it is the whole ballgame.**
The identity is a Privy `userId` obtainable with any email address, at zero cost, in
unlimited quantity. The only per-identity control in the design is a 10-minute edit cooldown.
[`ui/middleware/rateLimit.ts`](../../ui/middleware/rateLimit.ts) does not help: it keys on
IP + method + path + a 48-char user-agent fragment (so rotating the UA multiplies the budget),
allows 500 requests/minute, and **returns `next()` immediately unless
`NEXT_PUBLIC_ENV === 'prod'`**. Register 200 accounts, spray the outcome space, and one of
them tops the board with a "skill" score.

Decide and write down which of these you are:

- **(a) Leaderboard is decoration.** Then say so in the doc, label it on the page ("unranked,
  unverified, for fun"), and never attach anything of value to it. This is a legitimate
  choice for v1 and costs nothing.
- **(b) Leaderboard means something.** Then it needs a cost on identity — minimum a
  linked wallet *or* a Discord account for leaderboard eligibility (forecasting itself stays
  wallet-less, which preserves the core goal), plus a minimum-N-prizes-scored floor before a
  user appears at all, plus the per-prize uniqueness the accumulator in D-3 gives you.

The floor alone kills the cheapest farm: spraying works because a one-prize sample has huge
variance. Requiring, say, three scored prizes before ranking makes the spray strategy
require 3× the accounts for a strictly worse expected score. That is a scoring-rule change,
not a UI change — which is the pattern in D-7 below.

**D-5. `Depends on: None (can start immediately)` is false, and §6.7's region-notice step is
superseded.** PR-0 fixes the client region gate reading an EU/EEA flag instead of the DePrize
restricted list — roughly 52 jurisdictions including the US currently render enabled Back
CTAs. PR-D must merge after it and must read the corrected value. Two consequences the doc
should state: the panel's audience *grows* after PR-0 (all those users flip to restricted and
become exactly the target users §3 describes), and the browser-verification step "restricted
region — panel still there, Buy still blocked" is only meaningful against the corrected gate.
Also strike the §6.7 region-notice amendment; PR-0 owns that string. Most importantly, add a
constraint: **the panel's visibility must not be coupled to whatever variable PR-0 introduces.**
The panel renders in every restriction state. Wiring it to the new flag "to be consistent" is
the obvious mistake the next agent makes.

### Should-fix

**D-6. Concurrency: the user doc is a read-modify-write with no atomicity.**
§6.2 stores `{ latest, updatedAt, history[] }` as one JSON value, and the write path is
"pipeline SET user doc + SADD users." Upstash pipelines are batched, not transactional —
[`execCompliancePipeline`](../../ui/lib/deprize/complianceStore.ts) uses `pipeline()`, which
gives ordering, not isolation. Two submits racing (double-click, two tabs, a retried request)
both read the old doc and the second `SET` silently drops the first's history entry. The
10-minute cooldown narrows the window but does not close it, because the cooldown is itself
read from the same non-atomic doc. Fix by splitting the shape: `RPUSH` history entries to a
list and `SET` a separate `latest` key. Appends are atomic, submit becomes O(1) instead of
O(history), and the doc stops growing without bound — at 144 entries/day/prize under the
cooldown, a long-running prize's single JSON value is the kind of thing that gets discovered
when it stops fitting.

**D-7. The design reviewer's Weak rating is right, and two of the four items are scoring
problems, not UI problems.**

- **Raw Brier as the public headline is a data-model decision.** "Score, 3 decimals" is
  lower-is-better, unnormalized Σ (range 0–2), and — critically — **not comparable across
  prizes with different outcome counts**. A 2-outcome prize and a 12-outcome prize produce
  numbers on different effective scales, and D-3's accumulator would average them. Restyling
  the column does not fix that. Store a **Brier skill score** relative to the uniform 1/N
  baseline, `1 − B / B_uniform`: higher is better (which also deletes the negate-before-ZADD
  hack in §6.2, itself a latent sign bug), 0 means "no better than knowing nothing," positive
  means skill, and it is comparable across N. Keep raw Brier as a secondary column for the
  people who want it. Then the headline reads the way every reader already assumes it does.
- **Auto-normalizing sliders are the wrong control, and the fix removes API surface.** Three
  independent reasons, all correct: editing slider *i* silently rewrites values the user
  deliberately set; the control is not invertible, so many valid vectors are unreachable
  without fighting it; and with n > 3 the result depends on edit order, so the same intent
  produces different vectors. The replacement is not a better slider — it is a different
  input. Take **unnormalized relative weights** (any non-negative numbers), show the
  normalized percentages read-only beneath, and normalize server-side. That deletes the
  "sum 100 ± 0.5" validation and its arbitrary tolerance entirely; the API validates length
  2–12, all components finite and ≥ 0, at least one > 0. The ±0.5 fudge exists only to
  paper over client-side float drift that a weights model never produces.
- **Crowd at n = 1 is your own forecast with extra steps.** `crowd.ts` already returns
  `count`; require `count >= 5` before rendering the crowd column, and render "crowd forecast
  appears at 5 participants" below that. Also note that `setCDNCacheHeaders(res, 60, 60)`
  means a user's own submit will not appear in the crowd for up to a minute — with n small,
  that reads as a bug. Either exclude the caller from the crowd aggregate (correct anyway:
  comparing yourself to a crowd that includes you is not a comparison) or say the number is
  up to 60 s stale.
- **The market row.** Per-outcome `calcMarginalPrice` values converted through
  `(Number(p) / 2**64) * 100` will not display as summing to 100 next to two rows that do.
  Decide in `serverMarket.ts`, not in the component: return both the raw prices and a
  normalized vector, display the normalized one in the comparison, and footnote it. If you
  would rather show raw prices, relabel the row "market price" and drop it out of the
  three-row comparison, because a row that does not sum to 100 next to two that do reads as
  an arithmetic error.

**D-8. No schema version, and vector length can change under a stored forecast.**
Every Redis value in §6.2 is untagged JSON. Add `v: 1`. Then handle the case the task names:
a prize is superseded onto a new roster, and a stored 6-length vector meets a 4-length
`resolvedVector`. The doc does not say what `brierScore` does on a length mismatch, and the
prior review already found the exact analogue in PR-G (`maxProbDelta` returns `Infinity` on a
length mismatch, which then compares `>= 5` as true). Specify: `brierScore` throws on
mismatched lengths, the scorer catches per-user, and those users are **counted and logged as
skipped**, not silently dropped. Second half of the same problem: forecasts already sitting
on an id that later becomes SUPERSEDED. §6.7 correctly refuses *new* submits there, but the
existing ones are stranded — that prize may never report its own CTF vector, so those users
wait forever with no signal. Either score them against the superseded generation's built
payouts or state in the panel that forecasts on a superseded generation are void, and write
the tombstone key so it is observable rather than inferred from silence.

**D-9. Privacy and retention are absent for a system whose entire point is collecting data
from people who never bet.** Forecast history plus an optional display name, keyed to an
email-derived identity, for users in restricted jurisdictions, held indefinitely. The doc
says nothing about retention, nothing about erasure, and nothing about the compliance
boundary beyond D4's "wrong prefix." Three additions. State a retention period for
`forecast:profile:*` and history (and note that scores can survive as aggregates after the
raw history is dropped — that is the whole reason to separate them). Provide a deletion path,
which is cheap only if D-6's split has happened. And state explicitly that
`yarn export:deprize-compliance` must not pick up `forecast:*` — the export walks
`scanComplianceKeys(match)` against the **same Upstash instance**, so the separation is a
match-pattern away from failing, and "different prefix" is a convention until a test asserts
it. The pseudonym default (`Forecaster ` + hash prefix) is the right default; one sentence,
moving on. Finally: "free forecasts are not a bet" is the load-bearing legal claim of this
entire PR and it appears nowhere in §9. Name the owner who made that determination, and
record the constraint that follows — the day anything of value attaches to leaderboard rank,
that determination has to be re-made.

**D-10. Observability: there is none, and the failure mode is invisible by construction.**
The cron only acts on resolved prizes. If no prize resolves for two months, "working
correctly" and "the GitHub Action stopped firing" produce identical evidence: an unchanged
leaderboard. (Scheduled GitHub Actions workflows are also disabled automatically after a
period of repository inactivity — a real way for this to stop without anyone touching it.)
Minimum viable: write `forecast:cron:lastRunAt` and `forecast:cron:lastResult` on **every**
tick regardless of whether anything was scored, log one structured line per run with
`{booksScanned, booksResolved, usersScored, usersSkipped, errors}`, surface `lastRunAt` on
the leaderboard page footer ("scores updated <time>"), and alert on `now - lastRunAt > 3 h`.
The footer is the cheapest of these and the most effective, because the people most likely to
notice a frozen leaderboard are the users on it.

**D-11. `SCAN forecast:*:users` runs against a shared, hot keyspace.**
The same Upstash database backs compliance keys *and*
[`rateLimit`](../../ui/middleware/rateLimit.ts), which writes sliding-window keys per
IP + route + UA fragment across three windows — a very large, high-churn key population. An
hourly `SCAN MATCH` walks all of it to find a handful of book keys. Maintain an explicit index
instead: `SADD forecast:books "{chain}:{id}"` on first write to a book, and iterate that. It
is one extra command on a path already writing, and it removes an O(keyspace) operation and
its per-command cost from the hourly path. Related and unstated: the cron has
`maxDuration: 60` and no bound on user count. At a few thousand users that is a few thousand
REST round-trips. State the pipeline batch size and a resumable cursor, or state the user
ceiling at which this design stops working.

**D-12. Cron auth in non-production is open, and the leaderboard key is shared.**
[`authorizeCronRequest`](../../ui/lib/deprize/reconcile.ts) returns `{ok: true}` when
`production` is false and `expectedSecret` is undefined. Reconcile lives with that because a
staging reconcile touches staging chain state. A staging `forecast-score` writes to
`forecast:lb:2026` — a key with no chain and no environment in it (D-3). If staging and
production share an Upstash instance, an unauthenticated POST to a staging URL writes the
production leaderboard. Namespacing the season key by environment as well as chain closes
this without touching the shared auth helper.

**D-13. The 10-minute cooldown is the wrong control in both directions.**
It does not protect scoring integrity — only the vector standing at 00:00 UTC is ever read,
so edits between boundaries are free. It does not deter sybil, since a new email is a new
identity with a fresh cooldown. What it does do is lock a user out for ten minutes after they
fat-finger a slider, which is the single most likely thing a first-time user does. Drop it to
something like 30 seconds as pure write-abuse protection, cap history entries per user per
UTC day (which is the quantity scoring actually cares about), and put the real control on
identity cost per D-4.

### Consider

**D-14. `submit` verifies the Privy token twice, and a NextAuth session slips through.**
[`authMiddleware`](../../ui/middleware/authMiddleware.ts) verifies the bearer and then calls
`next()` **without attaching the claims**, so `privyUserIdFromRequest` must call
`verifyPrivyAuth` again — two verifications per submit (both local if
`PRIVY_VERIFICATION_KEY` is set per [`privyAuth.tsx`](../../ui/lib/privy/privyAuth.tsx), both
an 8-second network JWKS fetch if it is not). More importantly, `authMiddleware` also admits
a **NextAuth session** with no Privy bearer at all. In that case `privyUserIdFromRequest`
returns `null` and the doc does not say what happens. Spell it: `null` → 401, explicitly, in
the handler. It is a one-line rule and its absence is how a route ends up writing to
`forecast:...:user:null`.

**D-15. `getForecastRedis` duplicates the constructor; make that the reason, not an
apology.** §6.2 says "duplicating the two-line constructor is fine" to keep compliance
logging out of the forecast path. Correct, and it is a stronger argument than the doc makes —
the duplication buys an import-graph guarantee that no forecast route can reach compliance
code. Say that; it is the same class of structural argument as the prefix separation, and it
makes the next agent less likely to "DRY it up."

### Verifiability: what "browser-verified" is covering for

The `brier.ts` cases in §6.8 are the strongest test list in the rollout — the 2/3
uniform-vs-one-hot case with its "do not fix this to 1/N-averaged" warning is exactly right,
and the frozen D0/D1/D2 time-average case is the kind of thing that catches a rewrite. One
sentence of praise, then the problem: those cases cover one pure file, and §7 step 9 asks a
manual browser pass to cover identity, cooldown, superseded refusal, the 429 path, crowd
counting, restricted-region rendering, and both leaderboard states. Browser verification is
non-repeatable, is not run in CI, and — for the restricted-region check especially — cannot
actually be performed by a reviewer in the wrong country. Name these unit tests instead:

1. **Post-resolution forecasts do not score** (D-1): history with an entry timestamped after
   `resolvedAt` yields the same result as history without it.
2. **`resolvedAt` handling is deterministic**: the same inputs scored twice produce identical
   output, with no reference to `Date.now()`.
3. **Length mismatch is explicit** (D-8): `brierScore([a,b,c,d,e,f], [1,0,0,0])` throws, and
   the scorer records a skip.
4. **Accumulator idempotency** (D-3): applying the same `(user, prize)` score twice leaves
   `scoreSum` and `count` unchanged.
5. **Leaderboard ordering** (D-7): given three users' aggregates, the emitted rows are
   best-first — asserted on the *rendered* ordering, which is the test that catches a sign
   flip in the ZSET.
6. **Vector validation at the API boundary**, already listed, kept as is — and rewritten for
   the weights model if D-7 is adopted.
7. **Source-level isolation**: read the text of every file under `ui/pages/api/forecasts/`
   and assert no match for `/evaluateEligibility|runEligibilityChecks|walletFromSession|permit/`.
   §7 step 4 asks the implementer to grep for these by hand. Make the grep a test; it is five
   lines and it is the only thing that keeps the constraint true in six months.
8. **Compliance-export boundary** (D-9): the export's scan pattern does not match a
   `forecast:*` key.

---

## 4. The one alternative I would most want reconsidered: recompute-on-read

§5 of PR-D considers four alternatives, and all four are storage backends — Redis, Tableland,
on-chain, compliance keys. That is one axis. The axis that actually determines the shape of
this system was never raised: **must a scheduled job write the scores at all?**

The case for deleting the cron is that the score is a pure function of immutable inputs. Once
a prize resolves, its forecast history is append-only and frozen, the payout vector is on
chain and final, and — once D-1 is fixed — `resolvedAt` is a block timestamp. Nothing about
that tuple changes again, ever. A scheduled writer is the right tool when inputs drift or
when work must happen exactly once. Neither applies. What you have is a pure function and a
cache, and the design has dressed it up as a pipeline.

Concretely, `/api/forecasts/leaderboard` would, on a cache miss, read the book index
(`forecast:books` from D-11), skip unresolved books, and for each resolved book either read a
memoized per-book result hash or compute it and write it. The memo key includes the payout
vector hash, so it self-invalidates if a condition is ever re-reported and it is
content-addressed rather than time-addressed. A 60-second CDN cache sits on top — §6.4
already specifies it.

What that deletes, item for item from the findings above: the cron route, the workflow file,
the `CRON_SECRET` path and its non-production hole (D-12), the `scored` idempotency flag and
its key collision (D-2), the "cron ran twice" and "cron failed halfway through 800 users"
questions, the `maxDuration: 60` ceiling and the need for a resumable cursor (D-11), and the
entire observability gap (D-10) — because a leaderboard that cannot compute returns an error
to a user *now*, instead of silently serving a stale table for two months. Idempotency stops
being something you engineer and starts being something you get: computing a pure function
twice is the definition of idempotent.

What it costs, honestly:

- **Cold-cache latency.** First request after a resolution pays O(users in that book). At
  hundreds of users that is a pipelined batch read and some arithmetic — well inside a
  serverless budget. At tens of thousands it is not, and the calculus changes.
- **Thundering herd.** Several clients can miss a cold cache simultaneously. Standard fix: a
  short Redis lock key with serve-stale-on-lock. That is real code, roughly a dozen lines,
  and it is the main thing this alternative *adds*.
- **Cost profile inverts.** The cron pays once per hour whether or not anyone looks;
  recompute-on-read pays once per resolution plus cache misses. Given how rarely these prizes
  resolve and how modest the audience is at launch, read-driven is cheaper by a wide margin —
  but a viral leaderboard with a cold cache is the bad case.

The strongest counter-argument is predictability: a cron moves the work off the user's
request path and bounds tail latency. That is a real argument, and the answer is that it does
not require a *writer of record*. Keep the pure `scoreBook()` function and the content-keyed
memo as the source of truth, and add a cron later whose only job is to **warm** that cache.
The difference is not cosmetic. A warmer that fails, runs twice, dies halfway, or gets
triggered by an unauthenticated staging request costs you one slow request. A writer of
record that does any of those corrupts the leaderboard and, without D-10's alerting, does it
silently. Same schedule, same code, categorically different blast radius — and you get to
defer building it until a p95 measurement says you need it.

If the cron is kept, D-1 through D-3 and D-10 through D-12 are all mandatory, because they
are the machinery a writer of record needs and a pure function does not. That is the actual
trade: roughly a dozen lines of lock handling against six findings' worth of pipeline
correctness.

---

## 5. Summary

| | PR-C | PR-D |
|---|---|---|
| **Verdict** | Needs revision | Do not start as written |
| **Must-fix** | 3 | 5 |
| **Should-fix** | 3 | 8 |
| **Blocking dependency** | Counsel 1.2 (no named owner) | PR-0 region gate |

**PR-C** is a small PR carrying two mechanisms that are the wrong shape: a legal switch
implemented as prose in six places, and marketing consent stored inside a five-year evidence
record. Both are fixable now and expensive later — the consent one becomes genuinely hard the
first day real names are in the append-only history list.

**PR-D** has the best idea in the rollout and the weakest specification, which matches the
independent design review's rating. The Brier math is carefully specified; everything
downstream of it — where scores live, when resolution happened, who is allowed to be on the
board, and how you learn it stopped — is not. The single highest-leverage change is to stop
treating scoring as a pipeline and start treating it as a pure function over immutable inputs
with a content-addressed cache. Most of the operational findings are consequences of that one
framing choice.
