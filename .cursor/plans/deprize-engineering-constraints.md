# DePrize engineering constraints — standing decisions for the capability-ladder program

| Field | Value |
|---|---|
| **What this is** | The single home for constraints that bind more than one PR in the DePrize capability-ladder program. Each entry states the constraint, **why** it exists, and **which kinds of PR it binds**. |
| **Why it exists** | The constraint block was pasted verbatim into all seven PR docs. Two things went wrong. (a) It carried policy with no rationale, so a future reader can only obey it, not adapt it when the context shifts. (b) Because it was pasted everywhere, it bound PRs it had no business binding — PR-B adds a static constant and a UI strip, and carried the Upstash persistence rule, the `CRON_SECRET` rule and the `hashIp` rule — and it **pre-settled the alternatives sections**: PR-D's storage comparison was decided by its own constraints section before the comparison began. |
| **Status** | Draft. Requesting adoption as the program's constraints reference so per-PR docs link instead of paste. |
| **Owner** | *unassigned — must be a named person before the first PR implements against it* |
| **Approvers** | *unassigned — needs one engineering approver and, for C4/C5/C6/C11, the DePrize compliance owner* |
| **Scope** | `ui/` and `docs/` only. Applies to PR-0, PR-1, A′, B′, C, D1, E, F, G1 and their gated follow-ups (A2, **PR-C2**, D2, G2). Note: the follow-up to PR-C is written **PR-C2** throughout, never bare `C2`, because `C1`–`C13` in this document are constraint ids. |

---

## 0. How to use this document

**In a PR design doc, do not restate any constraint below.** Write one line:

> Constraints: this PR is bound by [`deprize-engineering-constraints.md`](deprize-engineering-constraints.md)
> C1, C2, C3, C7, C10, C11 (scopes `ALL`, `UI`, `PERSIST`). It does not implicate C8, C9 (no API route, no cron).

Then the doc's own alternatives section is free to argue. That is the point of the split: a constraint
here is a **standing decision**, not a conclusion your PR gets to claim it reached. If your design
turns on reopening one of these, say so explicitly, argue it in your own alternatives section, and
name the approver you need — do not quietly restate the constraint as though it were your finding.

### Scope tags

| Tag | Binds a PR when it… |
|---|---|
| `ALL` | …exists in this program at all. |
| `UI` | …renders or changes a DePrize surface (`pages/deprize/**`, `components/deprize/**`). |
| `API` | …adds or changes an API route under `pages/api/**`. |
| `PERSIST` | …writes durable server-side state. |
| `CRON` | …adds or changes a scheduled job. |
| `ELIG` | …touches eligibility, jurisdiction gating, permits, or the bet/sell/redeem paths. |
| `PII` | …handles an IP address, a user-supplied name, an email, or a Privy user id. |
| `SPEC` | …writes or edits prize-rule or spec copy in `docs/**` or `ui/content/**`. |

### Which PR is bound by what

Derived from the scope tags. A blank cell means the constraint does not apply and the PR doc should
say so rather than carry it.

| PR | `ALL` | `UI` | `API` | `PERSIST` | `CRON` | `ELIG` | `PII` | `SPEC` |
|---|---|---|---|---|---|---|---|---|
| **PR-0** geo gate fix | ✓ | ✓ | | | | ✓ | | |
| **PR-1** slots + helpers | ✓ | ✓ | | | | ✓ (preserves, changes nothing) | | |
| **A′** specs + ladder doc | ✓ | | | | | | | ✓ |
| **C** payload purse | ✓ | ✓ | ✓ (`accept-terms`) | ✓ (acceptance log) | | ✓ (must **not** feed) | ✓ (consent boolean) | ✓ |
| **F** onramp | ✓ | ✓ | | | | ✓ | | |
| **E** patrons + Fund | ✓ | ✓ | | | | ✓ (must **not** gate) | | |
| **B′** capability ladder | ✓ | ✓ | | | | | | ✓ (links only) |
| **D1** forecasts | ✓ | ✓ | ✓ | ✓ | | ✓ (must **not** gate) | ✓ | |
| **G1** Discord + odds wire | ✓ | | ✓ | ✓ | ✓ | | | ✓ (embed copy) |
| **PR-C2** display-name opt-in | ✓ | ✓ | ✓ | ✓ | | | ✓ | |
| **D2** leaderboard | ✓ | ✓ | ✓ | ✓ | | | ✓ | |
| **G2** `/leaderboard` `/forecast` | ✓ | | ✓ | | | | | ✓ |

---

## C1 — Work in `ui/` and `docs/`, with Yarn

**Binds:** `ALL`.

**Decision.** All code in this program lands in the `ui/` package. Package manager is Yarn; Node ≥ 18.
Never `npm` or `pnpm`, including in scripts, docs, and CI snippets.

**Why.** `ui/` is a Next.js 13 **Pages Router** app inside a monorepo whose other packages are
Solidity or standalone services. A second lockfile format in `ui/` silently produces a different
dependency tree than CI resolves, and the failure shows up as a version skew in a preview deploy
rather than as a failed install.

**Consequences.** Anything that wants to be shared with `dispatcher/` or `tui/` cannot be, without a
separate decision. Two of this program's helpers (`serverMarket.ts`, `postChannelMessage.ts`) are
plausibly useful to `dispatcher/`; they stay in `ui/lib/` anyway. Accepted.

**Revisit when:** a non-`ui/` consumer actually needs one of these helpers — not before.

---

## C2 — No Solidity changes and no redeployment

**Binds:** `ALL`.

**Decision.** No PR in this program edits `contracts/`, `fee-hook/`, `prediction/`,
`subscription-contracts/` or `xp/`, and none redeploys or reconfigures a deployed contract. On-chain
registration of new capability-ladder rungs (First Tracks, Ice) is out of scope for the whole program.

**Why.** Every capability in this program — ladder metadata, payload-purse framing, free forecasts,
patrons wall, onramp, Discord — is expressible as reads plus off-chain state. A contract change would
put an audit and a deployment on the critical path of a copy change. It would also invalidate the
program's core safety property: nothing here can alter a market's outcome, payout, or a user's ability
to exit a position.

**Consequences.** The capability ladder renders unregistered rungs as `PLANNED` text rather than as
markets, which the UX critique calls out as three links that 404 until A′ merges — an accepted cost of
this constraint, mitigated by B′ rendering planned rungs as plain text with a status chip, not links.
Creator referral splits (a `DePrizeMint` change) are excluded for the same reason.

**Revisit when:** a rung is genuinely ready to register, which is a separate program with its own
oracle, factory and Safe steps (PR-A's nine-step supersede runbook is the reference).

---

## C3 — `evaluateEligibility` stays pure, and no new input reaches it

**Binds:** `ELIG`.

**Decision.** `evaluateEligibility` remains a pure function of its declared inputs. No PR adds a field
to it, changes its semantics, or routes a new signal into it. New user-supplied data — a payload
display-name opt-in, a forecast vector, a patron memo — must be provably incapable of reaching it or
the permit decision.

**Why.** It is the function that decides whether a person in a restricted jurisdiction may place a
bet. It is the subject of a live compliance surface hardened by PRs #1579/#1581, and the only reason
its behavior is reviewable at all is that it has no hidden inputs. The moment a copy PR can influence
it, every future copy PR needs a compliance review.

**Consequences.** PR-C's opt-in boolean lives on `AcceptanceRecord` and is written *after* the permit
decision, never read before it. PR-D's and PR-E's tests must include a negative assertion (no forecast
route and no Fund path calls `evaluateEligibility`) — a prohibition needs a mechanism, so the
assertion is on the import graph or a spy, not on prose.

**Revisit when:** never, without the compliance owner in the review.

---

## C4 — Never gate sell, redeem, or claim

**Binds:** `ELIG`, and any `UI` change near the position, claim, or exit surfaces.

**Decision.** Jurisdiction gating suppresses **entry** only. Selling a position, redeeming, and
claiming a resolved payout stay available to every visitor regardless of jurisdiction signal, wallet
state, or restriction banner.

**Why.** The gate exists so the product does not *offer* a new bet where it may not. Trapping money
that is already in a position is a worse outcome than the one the gate prevents, and it is the failure
mode a restriction-flag bug produces most naturally: the flag flips on, and a blanket `disabled`
propagates into the exit path.

**Consequences.** PR-0's regression list is explicit that `ClaimPanel` and `ExitPositionModal` still
render **and are enabled** with `restricted={true}`, and PR-1 must preserve those assertions with zero
test edits. Any PR that adds a gate near these components carries the same two assertions.

**Revisit when:** counsel states otherwise in writing, recorded in
[`docs/DEPRIZE_JURISDICTIONAL_CONTROLS.md`](../../docs/DEPRIZE_JURISDICTIONAL_CONTROLS.md).

---

## C5 — Never log or store a raw IP

**Binds:** `PII`.

**Decision.** IP addresses are hashed (`hashIp`) before storage or logging, everywhere, including in
error paths, debug branches, and third-party calls.

**Why.** The compliance log is a durable record whose purpose is to show *what the product disclosed
to whom*. A raw IP converts it from a disclosure record into a location-tracking dataset, with a
retention obligation nobody in this program signed up for.

**Consequences and the trap.** This constraint was pasted into PR docs whose new stores hold different
data, and satisfying it there is trivially true and completely uninformative. **A PR that stores no IP
does not get to check this box and move on** — it must state what personal data its *own* store holds,
for how long, and why that period. Concretely: a Privy `userId` keyed forecast history is personal
data; a patron beneficiary address rendered next to an ENS name is personal data; a payload display
name is personal data with a moderation surface. Each needs its own retention answer, which is the
per-PR privacy section, not this constraint.

**Revisit when:** never for the hashing rule. The per-PR retention answers are per-PR.

---

## C6 — Never commit `*.local.md`, and never commit NDA material

**Binds:** `ALL`; the enforcement gate is owned by A′.

**Decision.** `*.local.md` files are working notes and never enter a commit. Separately, no tracked
file in this program may carry material from a private or NDA-covered source — operator conversations,
unpublished payload pricing, unannounced mission dates, or anything copied out of a private doc.

**Enforcement is a gate, not a sentence in seven documents.** A prose rule repeated in every PR doc
catches nothing; the rubric's criterion 16 is that a prohibition with no mechanism is not an
acceptance criterion. So:

1. `yarn test:deprize` runs an `rg` gate over the tracked diff (and over `docs/**`, `ui/content/**`)
   for the deny-list.
2. The deny-list has two halves. The **public half** is committed and holds only patterns that are
   safe to publish: `*.local.md` paths, provenance markers (`NDA`, `CONFIDENTIAL`, `do not
   distribute`, `internal only`), and the filenames of known private documents. The **private half**
   comes from a CI secret (`NDA_DENYLIST_EXTRA`, newline-separated patterns) so that the sensitive
   strings themselves are never committed — a deny-list of secrets in a public repo is itself the
   leak.
3. The gate fails the build. It does not warn.
4. A2 (First Tracks / Ice full specs) is the PR most likely to trip it, which is why the gate must
   exist before B′ and G1 write any spec copy, and why A′ lands it.

**Why the gate rather than the rule.** Roughly half this program is writing prize-rule prose from
research notes. The failure is a copy-paste, not a decision, and copy-pastes are caught by grep, not
by intention.

**Consequences.** False positives on legitimate prose (a spec that must use the word "confidential"
in a rules sentence) need an explicit inline allow marker, reviewed as part of the PR. That is the
intended friction.

**Revisit when:** the gate produces more false positives than findings over a full program cycle.

---

## C7 — Upstash Redis is the server-side store. This is a standing decision, not your PR's conclusion

**Binds:** `PERSIST`.

**Decision.** Durable server-side state in this program is stored in Upstash Redis, through a
per-domain helper modeled on [`ui/lib/deprize/complianceStore.ts`](../../ui/lib/deprize/complianceStore.ts)
(`getComplianceRedis`, `execCompliancePipeline`, `scanComplianceKeys`).

**Why — the part that was missing.** Three forces, in order of weight:

1. **There is no Postgres.** Not "Postgres is worse" — there is no instance, no migration tooling, no
   connection pooling story for serverless functions in this app, and no owner. Introducing one is a
   platform decision with an on-call consequence, not a storage choice inside a feature PR.
2. **Upstash is already a production dependency** of `middleware/rateLimit` and of the compliance
   store, so its failure modes, quota, and auth are already understood and already on someone's
   dashboard.
3. **Serverless request model.** Every write in this program happens in a short-lived function
   invocation. An HTTP-based store with no connection lifecycle is the shape that fits.

**Consequences, including the ones that hurt.**

- Relational queries are unavailable. A leaderboard is either a sorted set or a recompute-on-read
  fold, and cross-entity queries must be denormalized by hand.
- Upstash is **metered per command**. Unbounded key growth and periodic full scans are cost bugs, not
  just style problems. Every store in this program therefore needs a cap, a TTL, or a stated
  retention — see C12.
- The same Upstash instance holds compliance keys *and* rate-limit keys *and* whatever this program
  adds. That is why the key-prefix boundary matters (below).

**What this decision does *not* settle.** It fixes the store; it does **not** fix your data model, your
key shape, your idempotency strategy, or whether you need durable state at all. Those are exactly what
your PR's alternatives section is for. Two live examples:

- PR-D's real storage question was never Redis-vs-Postgres. It was *writer-of-record versus
  recompute-on-read*: a cron that writes a durable leaderboard, versus a pure fold over immutable
  on-chain inputs with a content-addressed memo. Same store either way; completely different failure
  surface. The pasted constraint block hid that question by making "persistence" look already decided.
- PR-B has no persistence at all and should never have carried this constraint.

**Do not factor a shared Redis-store factory.** Keep the two-line Upstash constructor duplicated per
domain (`getForecastRedis`, `getOddsWireRedis`, `getPayloadOptInRedis`). The duplication is not
laziness and not an apology — it buys an **import-graph guarantee** that a forecast route cannot reach
compliance code. A shared factory downgrades "the compliance export cannot pick up `forecast:*`" from a
structural property to a runtime convention, on the same instance that also holds rate-limit keys.

**Instead, own the boundary mechanically** (PR-1 lands both): a key-prefix registry in the ops docs,
and one test asserting the compliance export's scan pattern matches nothing outside `deprize:`.

**Revisit when:** a feature needs a multi-key transaction or a query Redis cannot express, *or* the
Upstash command bill from this program's stores exceeds the point where a managed Postgres is cheaper
including its on-call cost. Whoever hits either condition writes the ADR; it is not a PR-local call.

---

## C8 — API routes use the existing middleware composition

**Binds:** `API`.

**Decision.** Authenticated routes are `withMiddleware(handler, authMiddleware, rateLimit)` from
[`ui/middleware/`](../../ui/middleware/). The client sends `Authorization: Bearer <privyAccessToken>`;
the wallet is resolved through [`ui/lib/deprize/sessionWallet.ts`](../../ui/lib/deprize/sessionWallet.ts).
Public read routes are unauthenticated but still rate-limited, and set `publicHeaders` / `cacheHeaders`.

**Why.** Auth in this app is Privy access tokens verified server-side; `authMiddleware` is where that
verification lives and where its failure modes are already handled. A hand-rolled token check in a
feature route is one `try`/`catch` away from treating a malformed token as anonymous rather than as
rejected. The rate limiter is not optional on public routes either: they are the cheapest lever on a
metered store.

**Consequences.** Identity is a Privy `userId`, which is obtainable with any email address. For
anything with a reward or a ranking, that is a **sybil surface**, and this constraint does not
address it — see C13. Public cached routes mean a forecast crowd aggregate can be up to its cache TTL
stale next to live market odds on the same screen; the UI must not present the two as simultaneous.

**Revisit when:** a route needs an identity stronger than an email-derived `userId`, which is a
product decision, not a middleware one.

---

## C9 — Scheduled work is a `CRON_SECRET`-guarded API route called by GitHub Actions

**Binds:** `CRON`.

**Decision.** Cron handlers live at `ui/pages/api/cron/*.ts`, authorize with `CRON_SECRET` via
`authorizeCronRequest` ([`ui/lib/deprize/reconcile.ts`](../../ui/lib/deprize/reconcile.ts)), and are
scheduled by a workflow in `.github/workflows/` — `deprize-reconcile.yml` is the working reference.
Server-only environment variables are read from `process.env` **inside the API or cron module**, and
are not added to [`ui/const/config.ts`](../../ui/const/config.ts), exactly as `CRON_SECRET` already is.

**Why.** Two reasons, and the second is the load-bearing one. (a) The pattern already exists and is
already monitored, so a new cron inherits a known auth story instead of inventing one. (b)
`const/config.ts` is a **client-bundled** module that also holds contract addresses; adding
server-only env plumbing there both risks shipping the value to the browser and drags every DePrize
branch into the same 649-line merge point. Keeping server env reads out of it removes PR-D and PR-G
from that file's conflict set entirely.

**Consequences.** GitHub Actions schedules are best-effort — a tick can be late or skipped — so a cron
in this program may not be the writer of record for anything a user sees, unless the design states
what a missed tick looks like to that user. Every cron handler must be idempotent per logical unit,
and "idempotent" must include the case where the guard key is set and the underlying input is *later
corrected*: a guard that makes a corrected CTF report permanently unscoreable is a bug, not a
safeguard.

**Preference before you add one:** if the work is a pure function over immutable inputs, prefer
recompute-on-read with a cache over a cron that writes durable state. This is not a style note — it
deletes the entire class of "the writer of record wrote the wrong thing and nobody noticed." Add a
warmer cron later only if a measured p95 demands it.

**Revisit when:** a p95 measurement, not an intuition, shows recompute-on-read is too slow.

---

## C10 — Tests: pure logic under `ui/cypress/integration/lib/**`, run by `yarn test:deprize`

**Binds:** `ALL`.

**Decision.** Pure logic in `ui/lib/**` is tested at
`ui/cypress/integration/lib/<domain>/*.cy.ts` and run headlessly by `yarn test:deprize`. The spec glob
in [`ui/scripts/.mocharc-deprize-unit.json`](../../ui/scripts/.mocharc-deprize-unit.json) is widened
**once**, in PR-1, to `cypress/integration/lib/**/*.cy.ts`; after that no PR edits that file. Any UI
change is additionally verified in a browser, with screenshots in the PR.

**Why.** The 14-line mocharc with an explicit two-element `spec` array was about to be appended to by
both PR-D and PR-G on the same line. That conflict is trivial to resolve and nasty in one specific
way: the PR that merges second does not fail loudly — **its new specs silently do not run**. A
widened glob removes the file from the program's conflict set permanently.

**Consequences.** A test file dropped in the wrong directory silently does not run, which the glob
widens but does not fix; PR docs should name the exact spec paths they add. Browser verification is
manual and therefore not a regression guard — screenshots are evidence a thing worked once, not an
acceptance criterion. Where behavior matters, write the assertion.

**Revisit when:** the unit suite grows past the point where a single glob run is fast enough to keep
in the pre-review loop.

---

## C11 — The corrected jurisdiction signal is consumed, never re-derived

**Binds:** `ELIG`, `UI`.

**Decision.** DePrize surfaces read the restriction signal from PR-0's plumbing — the `restricted`
prop on `DePrizePageProps`, produced by `getDePrizePageEligibility` / `resolveDePrizePageProps` in
`ui/lib/deprize/pageEligibility.ts`, and the `useDePrizeRestricted()` context PR-0 ships. No file under
`pages/deprize/**`, `components/deprize/**` or `ui/lib/deprize/**` calls `useRegionRestriction` or
reconstructs a restriction boolean from country data. An ESLint `no-restricted-imports` rule under those
three paths, also shipped by PR-0, enforces it.

`ui/lib/deprize/**` is in scope deliberately: a helper there could import the EU flag and re-export a
wrong verdict into DePrize components without tripping a components-only rule — the same laundering path
as the original defect, one indirection deeper. The single carve-out is
`ui/lib/deprize/deprizeRestrictedContext.tsx`, exempt by exact filename because it is the module that
defines the corrected signal; every other module under that directory consumes `useDePrizeRestricted()`
like any other caller. Widening the carve-out is a compliance-owner decision, not a lint tweak.

**Why.** This is the exact defect PR-0 exists to fix, and re-derivation is how it shipped: a
`region.isRestricted` read that looks correct at the call site and is wrong for 52 jurisdictions, with
no test that would catch it. Three new PRs (D, E, F) each need this signal, `useRegionRestriction` is
one import away, and nothing mechanical prevents its return. A rule that lint enforces is a rule; a
rule in seven design docs is a hope.

**Consequences — the two mechanisms are consumed at different levels, deliberately.** The context is
what the **feature** PRs use: D, E and F each call `useDePrizeRestricted()` inside their own section
component, which is what removes five separate edits to the prop list of the file six PRs are already
fighting over. **PR-1 is the deliberate exception.** Its extracted section components receive the signal
as **props from the page**, not by calling the hook, because PR-1 must be behavior-preserving to a
rendered-HTML equality standard and adding a context read inside a newly extracted component is a new
subscription in a component whose only claim to safety is that the move was mechanical. So PR-1 depends
on the context *existing* — it is PR-0's deliverable and PR-1's stated dependency, and PR-1 must not land
it itself, or its owner is ambiguous — while prop-drilling within the tree it extracts. The PRs that come
after PR-1 use the hook. Neither level licenses re-derivation: no file under these paths calls
`useRegionRestriction`, and the lint rule is what says so.

**The provider-mount rule for new page routes.** `useDePrizeRestricted()` throws outside a provider —
deliberately, so that a missing provider fails loudly instead of reading as "not restricted". That makes
one rule binding on every PR in this program: **a new top-level DePrize page must either mount
`DePrizeRestrictedProvider` seeded from its own `DePrizePageProps` (i.e. call `resolveDePrizePageProps`
in its `getServerSideProps`), or not consume `useDePrizeRestricted()` anywhere in its tree.** There is no
third option — a consumer without a provider throws at runtime, and a provider seeded from anything other
than `resolveDePrizePageProps` is a second source of geo truth, which is the defect class C11 exists to
close. Descendants of `/deprize` and `/deprize/[id]` are already covered by PR-0's two mount points and
need no action; this binds *new* routes. A PR that adds one states which of the two options it takes, in
its own doc, before implementation — PR-G2's `/leaderboard` and `/forecast` are the first cases.

Each consumer still carries one assertion of its own, because the accessor guarantees the value
is *right*, not that the PR used it correctly: D asserts the forecast panel renders with
`restricted={true}` (forecasting is not betting and must reach restricted visitors); E asserts the
availability legend renders and the Fund path never calls `evaluateEligibility`; F asserts both the
Add-funds CTA and the `?onrampSuccess` reopen are suppressed with `restricted={true}`.

**Revisit when:** the signal's shape changes — and then in one place, which is the whole point.

---

## C12 — Every store is bounded; every frozen default has an owner and a revisit trigger

**Binds:** `PERSIST` for the first half; `ALL` for the second.

**Decision.** No store in this program grows without a cap, a TTL, or a written retention period with
a reason for that period. And every value this program freezes — a threshold, a tier boundary, a
season key, a distance in metres — is recorded with **a named person who owns it** and **the condition
that reopens it**. The program-level registry lives in the parent plan
([`deprize_capability_ladder_rollout.md`](deprize_capability_ladder_rollout.md)); a PR that freezes a
new value adds a row there in the same PR.

**Why.** Upstash is metered per command and per stored byte, so an append-only history per user per
prize is a cost bug with no ceiling. And an open-questions table where every row resolves to a
"Default" column has not answered the questions — it has deleted them, along with the rationale, the
consequence and the expiry. `FORECAST_SEASON = '2026'` with no statement of what happens in 2027 is
not a decision; it is a decision-shaped hole that becomes someone's incident.

**Consequences.** Some rows will read `owner: unassigned`, and that is the intended output: an
unassigned owner on a frozen default is a **blocker on that PR**, visible in one table, rather than a
default that quietly became permanent.

**Revisit when:** each row says.

---

## C13 — Where there is a ranking or a reward, state the cheapest attack

**Binds:** `API`, `PERSIST` — specifically anything with a leaderboard, score, reward, or free entry.

**Decision.** Any mechanism that ranks or rewards states its cheapest attack and its response. "Accepted,
and here is why" is a valid response. Silence is not.

**Why.** Identity here is a Privy `userId` obtainable with any email (C8), so the cheapest attack on
any free-entry ranking is *n* accounts submitting spread forecasts and keeping the best. Nothing in the
middleware stack addresses that, and a display-name sanitizer is not an abuse story — it is an XSS
story wearing an abuse story's clothes.

**Consequences.** D2 (leaderboard) needs a stated posture before it starts: a
minimum-scored-prizes floor, a per-`(user, prize)` idempotent accumulator, a season key namespaced by
chain **and** environment, and an explicit sentence on what a multi-account operator gains. If the
answer is "nothing worth defending against because the prize is a name on a wall," write that
sentence and name who accepted it.

**Revisit when:** a leaderboard position becomes worth money.

---

## Appendix — surfaces this program treats as compliance-adjacent

Not a constraint; a list, so that "compliance-adjacent" is checkable rather than a feeling. A change
inside any of these needs the compliance owner on the review, and a diff small enough to read line by
line:

- `ui/lib/deprize/pageEligibility.ts`, `evaluateEligibility`, and the permit path
- `ui/lib/deprize/acceptanceLog.ts` and `export-deprize-compliance-log.ts`
- `ui/lib/deprize/complianceStore.ts`, `compliancePermit.ts`, `runReconcile.ts`
- the region-notice and gate conditions in `ui/pages/deprize/[id].tsx` and
  `ui/components/deprize/DePrizeIndexContent.tsx`
- [`docs/DEPRIZE_JURISDICTIONAL_CONTROLS.md`](../../docs/DEPRIZE_JURISDICTIONAL_CONTROLS.md)
- the DePrize Terms, in both `ui/docs/` and the published `ui/content/docs/Legal/DePrize/` copy

---

## Revision log (2026-09-16)

1. **C11's consequences paragraph was reworded to agree with PR-1 §5.1.** It previously read "PR-1's
   extraction depends on the context existing" while
   [`pr-1-page-slots-and-helpers.md`](pr-1-page-slots-and-helpers.md) §5.1 specified the opposite
   mechanism ("the restriction signal are passed down, not recomputed"). One model is now stated in both
   files: the context exists, shipped by PR-0, **and** PR-1's extracted section components receive the
   signal as props from the page rather than each calling the hook. The feature PRs (D, E, F) use the
   hook; PR-1 prop-drills within the tree it extracts.
   - **Why this way round, with the rejected option kept visible:** the alternative was to have PR-1's
     extracted components call `useDePrizeRestricted()` directly, which reads cleaner and removes the
     prop-drilling. Rejected because PR-1's entire safety argument is that its diff is a move —
     rendered-HTML equality against snapshots captured on the PR-0 commit — and a new context read inside
     a freshly extracted component is new render behavior, in the one PR that is not allowed to have any.
     The prop-drilling is deliberate, not an oversight, and PR-1's behavior-preservation guarantee is
     unchanged.
   - C11's decision is unchanged: PR-0 ships the prop, the `useDePrizeRestricted()` context **and** the
     ESLint rule, and `pr-0-geo-gate-fix.md` now names all three as deliverables rather than delivering
     only the prop.
2. **`C2` as a PR label was disambiguated to `PR-C2`** in the "Which PR is bound by what" table and in the
   Scope row, so a reader cannot conflate PR-C's display-name follow-up with constraint C2 (No Solidity).
   The Scope row now states the convention explicitly. The other PR labels in that table (`A2`, `D1`,
   `D2`, `G1`, `G2`, `A′`, `B′`) do not collide with any constraint id, and no other occurrence of the
   collision exists in this document.
3. **C11's enforced scope widened from two globs to three: `ui/lib/deprize/**` is now named alongside
   `pages/deprize/**` and `components/deprize/**`,** in both the decision and the ESLint rule it cites.
   A components-only rule left a helper under `ui/lib/deprize/` free to import the EU-flag hook and
   re-export a wrong verdict into DePrize components — the original defect, one indirection deeper, in a
   file no compliance reviewer is watching. `ui/lib/deprize/deprizeRestrictedContext.tsx` is carved out
   by exact filename as the module that defines the corrected signal. Matching change in
   [`pr-0-geo-gate-fix.md`](pr-0-geo-gate-fix.md), which owns the rule and now also grep-checks for
   pre-existing violations before landing it.
4. **The provider-mount rule was added to C11's consequences**, so that it binds future PRs rather than
   living only in PR-0's risk list: a new top-level DePrize page must either mount
   `DePrizeRestrictedProvider` seeded from its own `DePrizePageProps`, or not consume
   `useDePrizeRestricted()` at all. `useDePrizeRestricted()` throws outside a provider by design — a
   missing provider must fail loudly rather than read as "not restricted" — so a page that does neither
   throws at runtime, and a page that seeds a provider from something other than `resolveDePrizePageProps`
   reintroduces the second source of geo truth C11 exists to remove. PR-G2's `/leaderboard` and
   `/forecast` are the first cases and owe the choice in PR-G's doc.
