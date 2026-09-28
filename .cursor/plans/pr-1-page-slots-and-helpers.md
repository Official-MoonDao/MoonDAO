# PR-1 — Page section slots and shared helpers (pre-factor, no behavior change)

| Field | Value |
|---|---|
| **Ask** | Approval to land a mechanical refactor of the `/deprize/[id]` render block into ordered section components, plus three shared helpers, **immediately after PR-0 and before any feature PR**. |
| **Owner** | *unassigned — needs a named person; this PR's whole value is that one person owns the composed page* |
| **Approvers** | *unassigned* — required: one frontend approver for the extraction, and the **DePrize compliance owner** for the preserved gate conditions in `[id].tsx` |
| **Reviewers** | *unassigned* — the owners of C, D, E, F, whose slots this PR defines |
| **Status** | **Ready to implement**, subject to the approvals in this table. The design is settled — twelve section components, the order, the three helpers, the widened glob — and eight documents in the program now depend on the slot names and helper shapes defined here, so this doc states a verdict rather than leaving them provisional. The honest caveat is not a hedge on that verdict: this PR is **purely mechanical and delivers no user-visible change whatsoever**, and its acceptance criterion is an empty rendered diff (§7). It is worth landing for the program's sake, not the product's. Merge blockers: a named owner in the Owner row, the frontend approver, and the compliance owner's separate review. |
| **Sign-off** | Recorded as approving review on the PR; the compliance owner's approval must be a separate explicit review, not a batched LGTM. |
| **Constraints** | Bound by [`deprize-engineering-constraints.md`](deprize-engineering-constraints.md) **C1, C2, C3, C4, C10, C11**. Does **not** implicate C5, C7, C8, C9, C12-bounds, C13 — this PR adds no store, no route, no cron, and no personal data. C3 and C4 bind because the PR moves gate-adjacent and claim/exit JSX: it must change neither, and PR-0's assertions for both must pass with zero test edits (§7.2). That is the whole of this PR's relationship to them. |
| **Depends on** | **PR-0** ([`pr-0-geo-gate-fix.md`](pr-0-geo-gate-fix.md)), merged. Specifically PR-0's `restricted` prop, its `useDePrizeRestricted()` context, and its ESLint `no-restricted-imports` rule. |
| **Blocks** | C, E, D1, G1 (see [`pr-program-architecture.md`](pr-program-architecture.md) §4). |

---

## 1. Problem

Six of the nine merge units in the DePrize program edit
[`ui/pages/deprize/[id].tsx`](../../ui/pages/deprize/[id].tsx) — PR-0, B, C, D, E, F. Its render block
is a flat ~340-line JSX child list (lines ~587–930) inside a single
`<div className="flex flex-col gap-4">`. Nothing about that structure makes an insertion independent of
its neighbours, so the file behaves like a shared mutable variable across six branches.

Concretely, four things go wrong, and none of them is anyone's individual mistake:

1. **Two pairs of PRs edit the same JSX nodes.** C and E both rewrite the header stat grid
   (623–669): C rewrites the `Stat label="Prize pool · to winner"` node at 624–627 plus its tooltip
   and adds an explainer beside it, E adds a Fund CTA adjacent to the same node. D and E both insert
   at the point where the Competitors block closes (813).
2. **Nobody owns the resulting page.** Each PR reasonably claims a slot; the sum is composed by
   whichever PR merges last, by hand, with no test that looks at the composed page and no reviewer
   whose job it is. Worse, the UX review's recommended order disagrees with the slot three of the PRs
   specified for themselves — so the ordering question gets litigated five times, in five reviews,
   each of which sees only one section.
3. **Two PRs create the same new file.** D and G both create `ui/lib/deprize/serverMarket.ts`. That is
   an add/add conflict git cannot three-way-merge, and the two intended shapes genuinely differ (D
   needs `resolved`, `payoutNumerators`, `payoutDenominator` and the block timestamp of the payout
   report; G needs per-outcome `calcMarginalPrice` and pool size). Left alone it yields two divergent
   price normalizations and, worse, two different notions of "resolved" — the failure mode is a
   Discord `/odds` embed printing live odds for a settled market.
4. **Two PRs append to the same 14-line JSON array**, and the second to merge does not fail loudly:
   its new specs silently do not run.

Underneath all four is PR-0's problem. PR-0 fixes a jurisdiction gate that was wrong for 52
jurisdictions because a component re-derived the restriction signal instead of consuming it. Three new
PRs (D, E, F) need that signal. Threading it as a prop means **five separate edits to the prop list of
the file everyone is already fighting over** — which is both the merge problem again and an incentive
to just call `useRegionRestriction`, which is one import away and reads correct at the call site. This is
about the five *later* PRs, not about this one: PR-1 passes props to its twelve extracted sections inside
a single diff reviewed by a single owner, and PR-0's `useDePrizeRestricted()` is what keeps each
subsequent PR's `[id].tsx` diff to one import and one list entry (§5.1, G5).

**Who is hurting.** The engineers on C, D, E, F and G, who each pay a rebase tax proportional to how
late they merge, and who cannot develop in parallel despite their features being independent. And,
downstream of #4 and #3, users: a silently-not-running test suite and a divergent notion of "resolved"
both surface as production behavior, not as red CI.

**What is not the problem.** The file is not badly written and this is not a code-quality complaint.
A 340-line ordered list of sections is a perfectly reasonable shape for a page with one author. It is
the wrong shape for a page with six concurrent authors.

---

## 2. Goals

- G1. Make adding a page section **one new file and one line** in an ordered list, so five feature PRs
  conflict on at most one line each instead of re-anchoring inside a 1,000-line file.
- G2. Decide the section order **once, here**, in the UX review's recommended order, rather than five
  times inside five feature reviews.
- G3. Land `serverMarket.ts` and `payerClassification.ts` once, before either of their two consumers,
  with the shapes both consumers need.
- G4. Remove `ui/scripts/.mocharc-deprize-unit.json` from the program's conflict set permanently.
- G5. Make PR-0's corrected signal reachable by the feature PRs' sections through one
  `useDePrizeRestricted()` call each, instead of five edits to this page's prop list. PR-1's *own*
  extracted sections take it as a prop from the page — see §5.1.
- G6. Do all of the above with an **empty rendered diff**, provable to a very high standard.

---

## 3. Non-goals

These are things a reviewer might reasonably expect in a refactor of this file, explicitly declined:

- **No copy changes, at all.** Not even obvious typo fixes. This is enforced mechanically (§7.3): no
  string literal is added or removed anywhere in the diff. The reason is not tidiness — it is that
  copy changes on this page are C's and D's, and both need the compliance owner. If PR-1 can absorb a
  copy change, it can absorb one nobody reviewed.
- **No accessibility fixes**, despite the UX review listing several on this page (the `Modal.tsx`
  `role="dialog"` / focus-trap gap, the odds chart's missing table view, the low-contrast provenance
  text). Every one of them changes rendered HTML, which destroys this PR's only strong verification.
  They belong to the PRs the UX review assigned them to, or to their own PR.
- **No `BetModal.tsx` extraction**, even though C and F both edit it. Its conflict is two edits in two
  regions with a clean merge order (C before F); the payoff does not justify refactoring a file inside
  the bet flow.
- **No `DePrizeIndexContent.tsx` extraction.** Only PR-0 and B′ touch it, and PR-0 already rewrites
  the exact block B′ anchors to.
- **No shared Redis store factory.** This is a deliberate non-abstraction; see
  [`deprize-engineering-constraints.md`](deprize-engineering-constraints.md) C7. The duplicated
  two-line Upstash constructor per domain is buying an import-graph guarantee.
- **No forecast or prize-pool content.** Both slots render `null`. A slot with a placeholder is a copy
  change and a design decision this PR is not entitled to make.
- **No prop-drilling cleanup — including for the restriction signal.** Section components take the props
  the page already computes, in the shapes it already computes them, even where that is ugly. The
  restriction signal is one of those props here, not a context read; PR-0's `useDePrizeRestricted()` is
  for the feature PRs that follow (§5.1).

---

## 4. Audience and blast radius

**Users affected: none, by construction.** Every rendered surface is byte-identical. If any user-visible
difference exists, this PR has failed its acceptance criteria.

**Changed:**

| Surface | Change |
|---|---|
| `ui/pages/deprize/[id].tsx` | Render block replaced by an ordered list of section components. Data hooks, effects, gate computations and the deep-link handler stay in the page, unmoved. |
| `ui/components/deprize/detail/*` (new) | Twelve section components, each holding JSX moved verbatim. |
| `ui/lib/deprize/serverMarket.ts` (new) | Server-side market/payout read over the existing `read.ts`. No caller in this PR. |
| `ui/lib/deprize/payerClassification.ts` (new) | Pure address classification. No caller in this PR. |
| `ui/scripts/.mocharc-deprize-unit.json` | Spec glob widened to `cypress/integration/lib/**/*.cy.ts`. |
| Ops docs | Redis key-prefix registry table. |
| New specs | Rendered-HTML snapshot spec; `serverMarket` and `payerClassification` unit specs; compliance-export scan-boundary test. |

**Explicitly unchanged:** `BetModal.tsx`, `DePrizeIndexContent.tsx`, `LiveDePrizeHero.tsx`,
`RaceMarketCard.tsx`, `competitions.ts`, `constants.ts`, `read.ts`, `const/config.ts`,
`evaluateEligibility` and the permit path, and **every existing test file**.

**Dependent teams.** The compliance owner, because this PR moves gate-adjacent JSX in a file PRs
#1579/#1581 just hardened. The owners of C, D, E, F, because their insertion points become the slot
names defined here.

---

## 5. Design

### 5.1 Section components, in the final order

Twelve components under a new `ui/components/deprize/detail/`, each receiving props the page already
computes. Line ranges are from the current file (render block 587–930) and are provenance for the
reviewer, not an instruction:

| # | Component | Source lines | Note |
|---|---|---|---|
| 1 | `PrizeHeader` | 588–696, incl. the pool `Stat` at 624–634 | C's stat rewrite and E's Fund link both land here |
| 2 | `RegionBanner` | 698–701 and 815–819, **unified into the single position PR-0 chose** (above the market section) | The only structural consolidation in this PR; see §5.2 |
| 3 | `MarketErrorNotice` | 703 | |
| 4 | `PrizeQuestion` | 705–710 | B′'s inline v0.2 criteria notes land here |
| 5 | `PositionSection` | 712–730 | |
| 6 | `OddsSection` | 732–749 | |
| 7 | `CompetitorsSection` | 751–813 | The page's primary action; position unchanged |
| 8 | `ForecastSlot` | — | **Empty, renders `null`.** PR-D1 fills it |
| 9 | `PrizePoolSlot` | — | **Empty, renders `null`.** PR-C's explainer + PR-E's patrons wall, together |
| 10 | `ClaimSection` | 821–834 | Must stay enabled under `restricted` (C4) |
| 11 | `AdminSection` | 837–850 | |
| 12 | `ProvenanceFooter` | 852–930 | B′'s one provenance line lands here |

The page then renders an explicit ordered list. That order is the one from
[`pr-design-docs-ux-critique.md`](pr-design-docs-ux-critique.md) §6.3: header · eligibility banner ·
question · position · odds · competitors · forecast · prize pool · claim · admin · provenance.

Two consequences worth being explicit about, because they are the reason to land the order here rather
than let it emerge:

- The forecast slot sits **after** Competitors, not between Odds and Competitors as PR-D specified for
  itself. A stack of percentage inputs directly above six "Back this team" buttons maximises exactly
  the bet/forecast confusion the program's constraints forbid; after Competitors it reads as "…or call
  it for free."
- The prize-pool slot is **one** section holding C's payload explainer and E's patrons wall, not two
  adjacent sections. C defines the container; E fills part of it.

**Extraction discipline** (this is what makes §7 provable):

- Each component returns exactly the JSX node(s) that were there. Where the source was multiple
  siblings, the component returns a `<>…</>` fragment. **No new wrapper element, ever** — a wrapper
  `div` changes the DOM and fails §7.1.
- Class strings, attribute order, conditional expressions and whitespace-significant JSX are moved
  character-for-character. If a line needs reformatting to satisfy Prettier at its new indentation,
  that is fine; if it needs *rewriting*, stop — that is a behavior change wearing a formatting change's
  clothes.
- No hook moves into a child. Data fetching, `useEffect`s, gate computation and the `?outcome=N`
  deep-link handler stay in the page. Children are presentational and receive computed values.
- **`bettingAllowed` and the restriction signal are passed down as props, not recomputed and not read
  from context here.** PR-0 ships `useDePrizeRestricted()`, and it is what C, D, E and F will each call in
  their own section — one hook call instead of a prop-list edit apiece, which is the point of G5. **This
  PR does not use it, on purpose:** its acceptance criterion is rendered-HTML equality (§7.1), and a
  context read added inside a freshly extracted component is a new subscription and new render behavior in
  the one PR that is not permitted any. So the page reads the signal once, exactly as it does after PR-0,
  and hands it to the two sections that already used it as a boolean prop. Prop-drilling inside the
  extracted tree is the deliberate choice, not a step this PR forgot to take.
  Either way, no child calls `useRegionRestriction`: the ESLint rule PR-0 ships makes that a lint error
  rather than a review comment (C11).

### 5.2 The one structural consolidation, called out for the compliance reviewer

Today the region notice appears in two places (698–701 and 815–819). PR-0 rewrites the 815–819
condition (`restricted` replaces `region.isRestricted || (!isLoading && !isError && !country)`) and
chooses the surviving position. PR-1 unifies both into a single `RegionBanner` **in the position PR-0
chose**, carrying PR-0's condition verbatim.

This is the only place where the rendered DOM could legitimately differ, and it is therefore the only
place a reviewer needs to read closely. If PR-0's chosen position means one of the two occurrences no
longer renders, that difference belongs to **PR-0's** diff, not this one — PR-1's snapshots are captured
on the PR-0 commit, so a difference here shows up as a failing snapshot and must be resolved by
matching PR-0, never by re-baselining.

### 5.3 `ui/lib/deprize/serverMarket.ts`

One module, built on the existing [`ui/lib/deprize/read.ts`](../../ui/lib/deprize/read.ts)
(`deprizeReadClient`, `deprizeReadChain(chainId)`, `rpcRead`) — which it consumes and does not edit.
It returns, for a `(chainSlug, deprizeId)`:

- `resolved`, `payoutNumerators`, `payoutDenominator` — what D1 needs to score a forecast;
- the **block timestamp of the payout report** — D1 needs the resolution *time*, and taking it from a
  wall clock at read time is the bug behind D-1's post-resolution exploit window;
- per-outcome marginal price and pool size — what G1 needs for `/odds` and `/pool`;
- `probabilitiesNormalized` — **one** normalization of prices, so a market row sums to 100 in the web UI
  and in a Discord embed. The field name is pinned here, not left to the implementer, because PR-D
  consumes it by that exact name; a description alone is how two consumers end up with two normalizations.

Two properties matter more than the field list:

1. **One notion of "resolved."** The module exposes the raw `resolved` flag *and* the
   `shouldSurfaceResolution` interpretation, named distinctly, so a consumer cannot accidentally pick
   the wrong one. D1 must use the interpreted value; G1 must refuse to print odds when it is true.
   Two independent derivations is how `/odds` ends up printing fiction on a settled prize.
2. **No caller in this PR.** It is dead code on merge, deliberately: a helper landed with its first
   consumer is a helper shaped by one consumer. Its unit spec is what justifies it, and its shape is
   fixed by both consumers' stated needs.

### 5.4 `ui/lib/deprize/payerClassification.ts`

Pure, no I/O: `isProtocolPayer(address, chainSlug)` over `DEPRIZE_MINT_ADDRESSES` and
`DEPRIZE_FEE_ROUTER_ADDRESSES`, with normalization (lowercase, checksum-insensitive, `0x`-prefix
tolerant) done in exactly one place.

**Why this is worth its own file.** Those two address sets are read in ~12 files today with ad-hoc
lowercase comparisons. E needs the classification to exclude bet slices (`from = DePrizeMint`) and
fee-router flows from the patrons wall. One case-sensitivity or checksum slip turns every bet slice
into a "patron" — and the patrons wall then becomes a **public list of bettors** on a
compliance-adjacent surface. The compliance reconcile path (`compliancePermit.ts`, `runReconcile.ts`)
classifies the same addresses; sharing the function is what stops the UI's notion of "protocol address"
drifting from compliance's.

Tests carry the cases that distinguish a correct implementation from the plausible wrong one:
checksummed vs lowercase vs uppercase input for the same address, an address that is a mint on one
chain and unknown on another, and a near-miss address differing in one character.

### 5.5 Mocha glob

`ui/scripts/.mocharc-deprize-unit.json`: replace the explicit two-element `spec` array with
`cypress/integration/lib/**/*.cy.ts`. One line; kills the D×G conflict; after this no PR in the program
edits the file. Verified by counting specs discovered before and after (the number must be ≥ the old
count, and the old two entries must still appear in the run list).

### 5.6 Redis key-prefix registry and the scan-boundary test

A table in the DePrize ops docs listing every Redis key prefix this program will use and its owner
(`deprize:compliance:*`, `deprize:permit:*`, `forecast:*`, `deprize:oddswire:*`,
`deprize:payload:optin:*`, plus `middleware/rateLimit`'s prefix as a *do-not-touch* row), and **one
test** asserting the compliance export's scan pattern matches nothing outside `deprize:`.

This is the mechanical half of C7's "do not factor a shared Redis factory." The registry is
documentation; the test is the enforcement. Without the test, "the compliance export must not pick up
`forecast:*`" is a sentence in a design doc, on an instance shared with the rate limiter.

---

## 6. Alternatives

### 6.1 Merge order alone, no pre-factor — *rejected*

The strongest alternative, and the default if this PR is not approved. It is genuinely attractive: zero
churn in a compliance-hardened file, zero risk of a refactor-induced remount, and a real argument that
two of the six converging PRs (B, D) are being descoped or rewritten anyway, which shrinks the payoff.
A competent engineer would pick it, and if the program slips, it is the right call in hindsight.

Rejected because merge order does not reach the actual failure. Ordering makes conflicts *sequential*;
it does not make them *small*, and it does not produce an owner for the composed page. The last two PRs
to land still re-anchor by hand inside a 340-line list, and no test and no reviewer ever looks at the
sum. It also leaves the five prop-list edits for the restriction signal, which is the path back to the
defect PR-0 just fixed.

### 6.2 Pre-factor **before** PR-0 — *rejected*

Cleaner in one specific way: PR-0 would then edit small section files instead of a 1,000-line page, and
its gate conditions would be more readable in isolation. This is a real argument.

Rejected on review economics, not on code. PR-0 fixes a live disclosure defect and its diff must be
readable line by line by a compliance owner. Putting a ~300-line extraction ahead of it delays the fix
and forces that reviewer to read a refactor to find the four lines they care about. PR-1 rebases onto
PR-0 instead — which is also why the restriction context belongs to PR-0 rather than to this PR: it lands
with its first consumer already correct, and PR-1 inherits a settled signal instead of defining one.

### 6.3 Let each feature PR extract the section it touches — *rejected*

Zero speculative work; each extraction has a present caller, which is the "solve the problem you have"
answer and normally the right instinct.

Rejected because the extractions then land in five branches that cannot see each other, five
verifications of behavior preservation happen inside five PRs whose reviewers are looking at a feature,
and the ordered list is created by whoever goes first — in *their* preferred order. It also does not
solve the pairs that edit the *same node* (C×E in the stat grid): whoever extracts `PrizeHeader` while
also rewriting the pool stat has produced a diff nobody can read as either a move or a change.

### 6.4 Full page rewrite (config-driven section registry, data via context) — *rejected*

Would make the ordered list data rather than code and remove prop threading entirely. Tempting because
it looks like the "real" fix.

Rejected as over-building for a speculated future. There are twelve sections and one page; a registry
buys nothing today, and it destroys the one property that makes this PR safe — that the diff is a move.
Context for the page's *data* would also widen every gate's blast radius, which is the opposite of what
a hardening surface wants.

### 6.5 Two PRs: helpers first, then slots — *rejected, with a fallback*

The helper half (§5.3–5.6) touches no shared file and could merge in parallel with PR-0. Splitting
would let it land days earlier and give the slot extraction a smaller, more reviewable diff. Honestly,
this is close.

Rejected as the default because the two halves are reviewed by different people and the helper half is
worthless until D/E/G exist, so it adds a merge unit and a rebase for no schedule gain. **Fallback:** if
the compliance owner cannot review the extraction promptly, split §5.3–5.6 out and merge them first —
they have no dependency on PR-0 and no shared-file contact. Recorded so the fallback does not have to
be re-argued.

### 6.6 Automated codemod for the extraction — *rejected*

A codemod would guarantee the move is mechanical. Rejected on cost: twelve extractions with distinct
prop sets, done once, is faster by hand than writing the transform, and §7's verification does not care
how the move was performed.

---

## 7. How behavior preservation is verified

The acceptance criterion is that **the rendered output does not change**. Four mechanisms, in order of
strength.

### 7.1 Rendered-HTML equality across four fixtures

A Cypress component spec mounts `DePrizeDetailContent` against four fixtures and asserts
`cy.get('main').invoke('html')` equals a snapshot captured on the **PR-0 commit**:

| Fixture | Why this one |
|---|---|
| Open market, wallet connected, no position | The common path |
| Resolved market | Exercises `ClaimSection` and the resolution branches |
| `restricted={true}` | The compliance-critical state; also PR-0's subject |
| No wallet | The largest first-visit population |

Four identical snapshots is the whole criterion. Not "visually similar" — string-equal.

**Determinism, because a byte-comparison is only as good as its inputs.** Fixtures are static; market
data, chain reads and USD conversion are stubbed; the clock is frozen; addresses are literals. Any
value derived from `Date.now()` or a live RPC is fixture-supplied.

**One known caveat, handled explicitly rather than hand-waved.** React 18's `useId` derives ids from a
component's position in the tree, and extraction changes tree depth. Any subtree that uses `useId`
(Headless UI components do) will emit different id strings even though the DOM is otherwise identical.
So the comparison normalizes React-generated ids before comparing: replace every `useId`-shaped token
(`«r…»` / `:r…:`) with a sequential placeholder, and **assert the replacement map is a bijection** —
same number of distinct ids, and every `id` still referenced by exactly the same `for` / `aria-labelledby`
/ `aria-describedby` attributes as before. That keeps the criterion falsifiable: a genuinely broken
label association fails, a renumbered id does not. If the normalizer is doing more than that, the
extraction went too far.

### 7.2 PR-0's regressions re-run, with zero test edits

All of PR-0's required assertions must pass unmodified:

- no "Back this team" affordance with `restricted={true}`;
- the amber banner is present with `restricted={true}`;
- `ClaimPanel` and `ExitPositionModal` render **and are enabled** with `restricted={true}` (C4);
- `?outcome=N` does not auto-open `BetModal` with `restricted={true}`.

**Any existing test that needs touching is evidence the refactor changed behavior — treat it as a
failure, not a fixup.** This is the criterion most likely to be quietly violated under time pressure,
so it is stated as a hard rule: the PR description must state "existing test files changed: 0," and
that is checkable from the diff.

### 7.3 Move-only diff, asserted mechanically

Two checks in CI, not in a reviewer's head:

1. **No string literal added or removed anywhere in the diff.** A script extracts quoted string
   literals from added and removed lines and asserts the multisets are equal. This is what structurally
   prevents PR-1 from absorbing C's or D's copy edits — copy change becomes impossible, not
   discouraged.
2. **Line accounting.** Lines removed from `[id].tsx` ≈ lines added across `components/deprize/detail/*`
   (import/export boilerplate and prop types are the expected delta, and the PR states the number).

Known false-positive class: a moved line whose JSX attribute order Prettier reflows can change token
positions without changing literals — that passes check 1 correctly. A genuine false positive is a
literal that legitimately appears once more because it is now both a prop name and a value; if that
happens, the PR narrows the extraction rather than weakening the check.

### 7.4 Suite and manual

- `yarn lint`, `yarn test:deprize`, `yarn test:cypress-unit` green, with **no test edits** other than
  the new specs listed in §4.
- Manual: PR-0's three header-override cases (`US`, `DE`, header absent) on the preview deployment,
  with before/after screenshots of both `/deprize` and a live `/deprize/[id]`. Screenshots are evidence,
  not the criterion — §7.1 is the criterion.

---

## 8. Failure modes and what they look like

| Failure | How it shows up | Response |
|---|---|---|
| Extraction changes React identity, causing a remount | A child that held state (an open accordion, a chart's zoom, an input's value) resets on re-render | The four fixtures are static and would **not** catch this. Explicit manual check: expand the criteria accordion, change an odds-chart range, then trigger a parent re-render. Named as a reviewer instruction because no test covers it. |
| A hook accidentally moves into a child | Extra network calls; a gate computed twice with different inputs | Review rule: children contain **no hooks at all**, `useDePrizeRestricted()` included — the page reads the signal and passes it down (§5.1). Grep the new files for `use[A-Z]`; any hit is a finding. |
| `bettingAllowed` consumers pushed into children widen a gate's blast radius | Not visible in tests; visible as a gate evaluated in a component that should not know about it | `bettingAllowed` is passed as a boolean prop to the two sections that already used it, and to no others. Enumerated in the PR description. |
| Snapshots re-baselined instead of investigated | Silent behavior change with green CI | The snapshot fixture files are captured on the PR-0 commit and **committed in a separate first commit** so that any later change to them is visible as its own diff. A snapshot edit in a later commit is a blocking review finding. |
| PR-0 has not shipped the restriction context | C, D, E and F each need a prop-list edit in `[id].tsx` after all, and the incentive to reach for `useRegionRestriction` returns. This PR's own extraction is unaffected — it prop-drills by design (§5.1) | Hard dependency, not a workaround. If PR-0 shipped without it, this PR stops and PR-0 is amended (C11) — PR-1 does not add the context itself, because then its owner is ambiguous. [`pr-0-geo-gate-fix.md`](pr-0-geo-gate-fix.md) now names `useDePrizeRestricted()` and the ESLint rule as deliverables with acceptance criteria, so this row is a check on PR-0's merge rather than an expected outcome. |
| Section order here conflicts with what a feature PR assumed | A feature PR's design doc describes a different slot | The order is decided here and the affected PR docs are updated. D's "between Odds and Competitors" and B's "after `DePrizeQuestionCard`" are both already superseded. |

**Ops and rollout.** No flag, and none is warranted: the change is either byte-identical or wrong, and a
flag would mean shipping both code paths for a refactor. Rollback is a single revert — no durable state
is written, no data is migrated, no external contract changes, so revert is complete. No new
observability: there is no new runtime behavior to observe. No cost or quota impact. No personal data
(C5 is satisfied vacuously — this PR adds no store, and says so rather than checking a box).

**Success is measurable, in the program rather than in production:** the number of *lines* each of C, D,
E and F changes in `[id].tsx` drops to ≤ 2 (one import, one list entry). If a feature PR after this one
still needs a multi-line edit inside the render block, the slots were wrong and the PR did not achieve
its goal. That is a falsifiable number, checkable per PR.

**Abandonment condition.** If the four snapshots cannot be made to match after the id-normalization in
§7.1 — i.e. the extraction genuinely changes rendered output somewhere the author cannot explain — the
PR is abandoned rather than re-baselined. There is no version of this PR worth having with a
non-empty rendered diff.

---

## 9. Frozen defaults in this PR

Per C12: every frozen value gets an owner and a revisit trigger.

| Value | Frozen at | Owner | Revisit when |
|---|---|---|---|
| Section order | UX review §6.3 order (§5.1) | *unassigned — design* | A feature PR argues its slot with user evidence, or a fifth always-rendered section makes the page too long on mobile |
| Snapshot fixture set | Four fixtures (§7.1) | *unassigned — this PR's owner* | A fifth page state becomes reachable — most likely "superseded market" |
| `serverMarket` field set | D1's and G1's stated needs (§5.3) | *unassigned* | A third consumer needs a field, or D1's rewrite changes what it needs |
| Mocha spec glob | `cypress/integration/lib/**/*.cy.ts` | *unassigned* | Unit-suite runtime stops being fast enough for the pre-review loop |
| Redis key-prefix registry | Prefixes in §5.6 | *unassigned* | Any PR adds a prefix — it adds the row in the same PR |

An `unassigned` owner here is a blocker on this PR, not a placeholder to merge past.

---

## 10. Open questions

1. **Does PR-0 ship `useDePrizeRestricted()`, or does this PR? — Resolved: PR-0 does.**
   [`pr-0-geo-gate-fix.md`](pr-0-geo-gate-fix.md) now names the context and the ESLint rule as
   deliverables, in its goals, implementation plan, testing and acceptance criteria, which closes the
   ambiguity in [`pr-program-architecture.md`](pr-program-architecture.md) (§2 assigned it to PR-0, §3(b)
   had PR-1 land it "if PR-0 did not"). **The rejected option — PR-1 lands it as a fallback — is rejected
   because it leaves the accessor's owner ambiguous exactly when D, E and F start writing against it, and
   because adding a context inside this PR would put new render behavior in the one PR that must have
   none.** Note the distinction this resolution makes: PR-1 *depends on* the context and does not *consume*
   it — its extracted sections take props (§5.1). Still worth PR-0's owner confirming at PR-0 review that
   the deliverable did not get dropped in implementation; §7.2's list plus PR-0's own lint-rule assertions
   are what make that checkable rather than a conversation. *Owner: PR-0's owner. Trigger: PR-0 review.*
2. **Which position does the unified `RegionBanner` take?** PR-0's choice, whatever it is. This PR must
   not make it. *Owner: PR-0's owner + compliance.*
3. **Is the `PrizePoolSlot` container defined here or by C?** Here as an empty slot; C defines its
   internal structure and E fills part of it. Needs C's owner to agree, since C otherwise plans to
   create the container. *Owner: C's owner.*
4. **Does any subtree in the render block use `useId` today?** Determines how much §7.1's normalizer
   has to do. Answerable in ten minutes before starting; if the answer is "none," drop the normalizer
   and the comparison is a plain byte-compare. *Owner: this PR's owner.*

---

## 11. Sequencing

Merges **second**, after PR-0 and before every feature PR. See
[`pr-program-architecture.md`](pr-program-architecture.md) §4 for the full order and §1 for the conflict
matrix this PR is designed to empty.

Branch from a **clean `main`**, not from the current working tree — there is an uncommitted ~66-line
project-cycle diff in `ui/const/config.ts` plus ~37 other modified `ui/` files from an unrelated
workstream that will otherwise ride silently into this branch. See the parent plan's ops precondition.

---

## Revision log (2026-09-16)

1. **Status changed from "Draft, requesting approval. Not approved by itself." to Ready to implement.**
   Eight documents depend on the slot names, the section order and the helper shapes defined here, so the
   verdict is stated. The caveat is preserved rather than dropped: this PR is mechanical, delivers no
   user-visible change, and is worth landing for the program rather than the product. The named approvals
   (owner, frontend, compliance) remain merge blockers.
2. **§5.1's restriction-signal bullet, G5, §6.2, §8's two rows and §10 Q1 were reworded so this doc and
   [`deprize-engineering-constraints.md`](deprize-engineering-constraints.md) C11 state one model.** C11
   previously read "PR-1's extraction depends on the context existing" while §5.1 said the signal is
   "passed down, not recomputed" — the same sentence supporting two mechanisms. The single model, now in
   both files: **the context exists and is PR-0's deliverable, and PR-1's extracted section components
   receive the signal as props from the page rather than each calling the hook.** The hook is for the
   feature PRs that follow.
   - **Rationale, now explicit in §5.1:** prop-drilling inside the extracted tree is deliberate. This PR's
     only strong verification is rendered-HTML equality (§7.1), and a context read added inside a freshly
     extracted component is a new subscription and new render behavior. **The behavior-preservation
     guarantee in §7 is unchanged.**
   - **Rejected option, kept visible:** have PR-1's twelve sections call `useDePrizeRestricted()` directly.
     Cleaner to read and removes the prop threading, but it trades away the one property that makes this
     PR safe.
   - §10 Q1 is now resolved rather than open, because `pr-0-geo-gate-fix.md` names the context and the
     ESLint rule as deliverables with acceptance criteria. The rejected fallback (PR-1 lands the context if
     PR-0 did not) is recorded there with its reason.
3. **C3 added to the Constraints row.** The row cited C1, C2, C4, C10, C11 and disclaimed C5, C7, C8, C9,
   C12-bounds and C13, but omitted C3 while the constraints doc marks PR-1 `ELIG ✓ (preserves, changes
   nothing)` — and C3 binds `ELIG`. The row now says what C3 and C4 mean here: gate-adjacent and
   claim/exit JSX moves, neither of which may change behavior.
4. **`probabilitiesNormalized` pinned in §5.3.** The field was promised by description ("one normalization
   of prices") while PR-D consumes it by that exact name. Both docs now bind to the same symbol; nothing
   else in the field list was renamed.
