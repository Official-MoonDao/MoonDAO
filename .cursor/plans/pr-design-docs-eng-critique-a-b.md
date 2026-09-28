# Engineering critique — PR-A (capability specs) and PR-B (ladder UI)

| Field | Value |
|---|---|
| **Lens** | Engineering quality and design judgment. **Not** a correctness pass — [`pr-design-docs-review.md`](pr-design-docs-review.md) already did that and its patches are applied. |
| **Subjects** | [`pr-a-capability-specs.md`](pr-a-capability-specs.md), [`pr-b-ladder-ui.md`](pr-b-ladder-ui.md) |
| **Date** | 2026-09-16 |
| **Context taken as given** | PR-0 (client region gate reads the EU/EEA flag instead of the DePrize restricted list) merges first. An independent design review rated PR-B **Weak**. |

**Bottom line: A — Needs revision (split it). B — Weak, do not ship as written.**

---

## 1. Scorecard

### PR-A — Capability prize specs and Touchdown v0.2

| Rubric group | Verdict | Single most important improvement |
|---|---|---|
| Framing | **Strong** | Nothing. §3 precedes §6, non-goals are specific and enforceable, blast radius is five named paths. |
| Decision quality | **Weak** | A1–A4 are four spellings of "write the docs." The cheapest real option — publish the ladder now, defer the First Tracks / Ice **rosters** until registration — is rejected in A3 by appeal to the parent plan, not on merits. |
| Operational rigor | **Weak** | The doc knows that outcome sets freeze at `prepareCondition` and rules freeze at `open`, but never labels which *blocks of its own text* fall on which side. Add a per-file freeze table. |
| Trust & safety | **Strong** | NDA handling is the best thing in either doc. Residual: step 1 restores a file whose own header says `CONFIDENTIAL — INTERNAL / NDA` and mitigates it with an override ~300 lines below the banner. |
| Verifiability | **Weak** | "A stranger can answer five questions" is not falsifiable. Three of the acceptance criteria are already mechanizable; make them CI gates, especially the NDA grep. |
| Process hygiene | **Weak** | `N = 10 m`, the two rosters, and the four rung boundaries are asserted. No owner, no revisit trigger, no abandonment criteria, and the doc never states what approving it commits MoonDAO to. |

### PR-B — Ladder metadata and UI

| Rubric group | Verdict | Single most important improvement |
|---|---|---|
| Framing | **Adequate** | Non-goals are excellent. The problem statement asserts a user need with no evidence that any visitor has it. |
| Decision quality | **Weak** | B1 is rejected on a false premise, and the resulting two-source model has a field (`ladder?`) whose own spec says consumers must ignore it. Delete the field; derive from `sharedGoalId`. |
| Operational rigor | **Weak** | `deprizeIdByChain: { sepolia: 22 }` rots on the first supersede, and PR-A's own nine-step runbook contains no step that updates it. |
| Trust & safety | **Strong** | Night Shift `specHref` is correct and — unusually — enforced by a unit test rather than prose. One sentence, moving on. |
| Verifiability | **Adequate** | Eight named cases in the right glob with the right runner. Missing the two tests that matter most: survives-a-supersede, and every `specHref` resolves to a file that exists. |
| Process hygiene | **Weak** | Status is "Ready with nits" after an independent review called it Weak. No named reviewer, no stated decision being asked for, no abandonment criterion for the strip. |

---

## 2. PR-A findings

### Must-fix

**A-M1. The immutability asymmetry is understood but never applied to the doc's own text.**
This is the whole risk of a spec PR and the doc gets it half right. §6.3(f) step 4 says "Outcome set is frozen at `prepareCondition`," and the Part VI header says "Rules still freeze at `open`." Good. But §6.4 then writes five tests, a six-row roster, and a tie-break rule for First Tracks and treats all of it as equally revisable: *"Write the tests against `N` so a later addendum can change the number without rewriting the roster."* That sentence is true only before registration. After `open`, changing `N` is a supersede — nine steps, a new CTF condition, a new LMSR — not an addendum. The roster is worse: it becomes `teamIds[]` at `prepareCondition` and is then immutable for the life of the generation, and roster size sets the 1/N prior.
**Recommendation.** Every new spec file opens with a freeze table before the one-pager:

| Block | Lifecycle |
|---|---|
| Roster / named slots | Frozen at `prepareCondition`. Changing it is a `supersede`. |
| Win tests, `N`, tie-break | Frozen at `open`. Editable freely until then. |
| Purse, waterfall | Governed by Terms, not this file. Never in force from here. |
| Field discussion, "how it goes wrong", reviewer questions | Editable forever. |

Without this, the first implementer to "just update the roster" after registration silently invalidates a live market's outcome set.

**A-M2. Acceptance is not falsifiable, and the entire NDA-safety argument rests on prose.**
§8 says "Tests: none." §7 step 9 is a read-through by an unnamed stranger. Meanwhile the doc repeats "do not link / restore / quote `DEPRIZE_NIGHT_SHIFT.md`" in §1, §4, §6.6, §6.8, and the review-response block — five times, enforced zero times. Prose repeated five times is a smell that the constraint wants to be a test.
**Recommendation.** State acceptance as three gates, all cheap:
1. `rg -n 'DEPRIZE_NIGHT_SHIFT|night-shift-brief' docs/ ui/` returns nothing. Wire it into the existing `yarn test:deprize` script or a CI step so it also guards PR-B's `SPEC()` and PR-G's Discord copy, not just this PR.
2. Every relative `*.md` link under `docs/` resolves to an existing path (a ~20-line script over `docs/**`).
3. `git diff --name-only` equals exactly the five paths in §6.1, and matches no `*.local.md`.
   Gate 1 is the one that matters. It converts the strongest part of this PR from a discipline problem into a machine-checked invariant, permanently.

**A-M3. The restored v0.1 NDA banner is handled the worst possible way: publish it, then contradict it.**
§6.2 forbids touching Parts I–V and puts the override in Part VI, asserting "The NDA banner does not apply to the published addendum." A public reader opening the rules-of-record file that GTM cites sees `CONFIDENTIAL — INTERNAL / NDA` first and the retraction several hundred lines later. If the banner is decorative, strike it in place with a dated one-line footnote — that is a *smaller* edit than appending Part VI and it is the one edit to v0.1 that is clearly safe. If it is legally meaningful, an engineer's assertion does not clear it and the restore must be gated on the counsel listed in the Reviewers row, with a name.
The §Reviewers row says "counsel for any public-facing prize language." This is public-facing prize language. Name the person and make it a merge gate, or drop the pretense.

### Should-fix

**A-S1. Docs-only is the right unit for Touchdown v0.2 and the wrong unit for First Tracks / Ice.** The prompt frames this as a coupling question with PR-B's 404s. The coupling cuts the other way. Touchdown v0.2 documents a market that is live on Sepolia #22 today; GTM and QA already cite the path; it has real consumers and should merge immediately with no dependencies. First Tracks and Ice are full specs — nine named companies, five tests, a tie-break rule, a purse waterfall, "Deadline: rolling — open until it happens" — for markets with no pool, no condition, no registration, and no committed date. Their only consumer is PR-B's stepper. Publishing a rules-of-record-shaped document for a prize nobody can win is a promise the repo cannot keep, and every volatile fact in those rosters (ispace Mission 3 in 2028, VIPER on MK1-2, Griffin manifest) must be re-verified at registration anyway. That is textbook speculative generality in editorial form.
**Recommendation.** PR-A ships `DEPRIZE_TOUCHDOWN.md` v0.2 + `DEPRIZE_CAPABILITY_LADDER.md` (rung names, one-line bars, `PLANNED` status, **no rosters, no tests, no purse language** for rungs 1–3) + the GTM §0 pointer. First Tracks and Ice full specs move to PR-A2, which merges when the corresponding market is registered or when product commits to a registration date. This also collapses PR-B's 404 problem from three broken links to zero, because the ladder page is the one URL that always exists.

**A-S2. Frozen editorial defaults are asserted, not decided.**
Answering the prompt directly: **no**, they are not labeled as decisions with owners.
- `N = 10 m` (§6.4): "Proposed… Call this out as reviewer question 1." §9 default is "10 m in v0.1; reviewer question 1 can raise it." No owner, no revisit trigger, no deadline. "Reviewer question 1" is addressed to a team, not a person.
- Roster composition (§6.4, §6.5): nine named organizations with no stated inclusion rule. Does a funded-but-unmanifested rover get a slot? Open Field makes this look safe, but roster size is the 1/N prior and becomes immutable at `prepareCondition`.
- Rung boundaries (§6.6): "Why this order" is one paragraph. No alternative ordering is considered — not "first sample return," not "first night survival by any means," not three rungs instead of four.
  **Recommendation.** One table per frozen default: **decision · owner (person) · rationale · revisit trigger**. Reuse the trigger idiom the doc already invented for supersede ("Open Field implied odds near or above ~⅓") — that is a good, falsifiable trigger and it shows the author can write them. E.g. `N = 10 m` · owner · "checkout drive counts, ramp-roll does not" · revisit when a roster rover publishes a planned checkout traverse below 10 m.

**A-S3. No abandonment criteria.** Nothing says under what condition a published spec is withdrawn. If no commercial rover flies by mid-2027, does `DEPRIZE_FIRST_TRACKS.md` get a `WITHDRAWN` header, or does it sit in `docs/` indefinitely implying a prize exists? Ice is worse: it is scoped to a 2027 window, so it has a built-in expiry the doc never names.

**A-S4. "Reconcile wording at merge" across three PRs will ship three versions of Test 4.** §8 rollout: "Those PRs may start from this design's decisions and reconcile wording at merge." The Test 4 sentence is quoted verbatim into PR-B `criteriaNotes`, into `atlas.dataset.json` thresholds, and into PR-C's Terms draft. Three hand-copies of a resolution criterion is how a Senate checklist ends up disagreeing with the prize page.
**Recommendation.** Name one canonical location for each quoted sentence and have B/C reference it, or name the person who reconciles post-merge and the commit by which it must happen.

**A-S5. The purse waterfall is a live contradiction published inside the rules of record.** §6.3(e) is a bolded three-step waterfall with a 24-month clause; the caveat ("Terms v1.1 and Prize Rules 1.0 still say the prize is paid in ETH to the Winner's wallet") is the last sentence of a long paragraph. A reader who skims — which is every reader — takes the bold list and misses the caveat, in a file GTM calls "the rules of record." The instinct is right and the mechanism is wrong.
**Recommendation.** Fence it: a visually distinct `NOT IN FORCE — PRODUCT INTENT ONLY (owner: <name>; counsel gate: PR-C)` block that opens *before* the waterfall, not a trailing qualifier.

**A-S6. The Ice roster names CNSA, Blue Origin, and IM with no listing disclaimer.** §6.4 correctly requires the "named organizations have not been contacted" disclaimer on First Tracks. §6.5 omits it for Ice. Same exposure, same fix.

### Consider

**A-C1. Path stability is now an API.** Once PR-B's `SPEC()` builds `blob/main/docs/<file>` URLs and PR-G puts them in Discord, these five paths are a public contract. Add one line: renaming or moving them is a breaking change with named downstream consumers.

**A-C2. Nothing in this PR re-publishes withdrawn NDA material.** Answering the prompt's last bullet directly: verified against the doc's own link inventory (§6.8) and non-goals (§4) — no href to `DEPRIZE_NIGHT_SHIFT.md` or `night-shift-brief.html`, and it goes further by striking the GTM `DEPRIZE_GTM_SURVIVE_THE_NIGHT.md` line that would have pointed there. The only residual is A-M3 (the restored banner itself). Make it A-M2 gate 1's job to keep it that way.

---

## 3. PR-B findings

### Must-fix

**B-M1. The ladder breaks on the first supersede, and PR-A's runbook does not know it exists.**
`CAPABILITY_LADDER` hardcodes `deprizeIdByChain: { sepolia: 22 }` (§6.1). PR-A §6.3(f) specifies a nine-step supersede that replaces #22 with a new generation: step 3 updates `competitions.ts` lineage, step 7 rebinds outcomes and the atlas. **No step updates `CAPABILITY_LADDER`.** After a supersede to #23:
- §6.2 rule 4 computes `current` as `resolveLiveDePrizeId(chainSlug, deprizeId) === deprizeIdByChain[chainSlug]` → `23 === 22` → **false**. The live prize page renders a ladder with no current rung.
- §6.2 rule 3 sets `href = '/deprize/22'`. The rung-0 link on the live page points at a **superseded market where new bets are closed.**

A component whose only job is orientation will actively misdirect, and it will do so on exactly the event PR-A says is the normal lifecycle.
**Recommendation.** Do not store an id. Key the rung on `sharedGoalId` and derive. `findDePrizeIdForGoal(chainSlug, sharedGoalId)` already exists in [`ui/lib/deprize/competitions.ts`](../../ui/lib/deprize/competitions.ts) (~513), is memoized per chain, already walks `liveTipOf`, and already returns the tip for a lineage — #21 and #22 both carry `sharedGoalId: 'shared-next-landing'`, so it returns 22 today and 23 after the supersede with **zero edits**. This makes PR-B's own test case 3 (id 21 → href points at 22) pass for free and makes the supersede case correct by construction.

**B-M2. `ladder?` on `DePrizeCompetition` is a redundant second source whose own spec says to ignore it.**
Answering the prompt directly: **yes, it is redundant, and one can fully derive from the other.** After the review patches, `DePrizeLadderMeta` on a competition row carries `rung`, `key`, `label`, `deprizeId`, `specHref` — all five duplicated verbatim from the `CAPABILITY_LADDER` entry with the same `key`. §6.1 instructs the implementer not to write `status` on the row; §6.2 rule 2 instructs the consumer to **ignore** `competition.ladder.status` if anyone re-adds it. A field whose documented contract is "the reader must ignore this" should not exist. The only non-derivable bit is the row↔rung association, and `sharedGoalId` already supplies that (B-M1).
**Recommendation.** Delete `ladder?: DePrizeLadderMeta` entirely. Replace `deprizeIdByChain` with `sharedGoalId?: string` on the `CAPABILITY_LADDER` entry. Planned rungs simply have no `sharedGoalId` and render `planned` — which is exactly the behavior §6.2 rule 2 wants. Net effect: **PR-B stops editing `competitions.ts` at all except to import**, removing it from the merge-conflict blast radius that the prior review's §2.3 table already flags for B/C/D/E/F.

**B-M3. Ladder metadata does not belong in `competitions.ts`.**
Answering the prompt directly: **no.** The file's own header comment (lines 1–20) states its contract: seeding `questionId` is what derives the oracle role (`keccak(caller, questionId, numOutcomes) == conditionId`) and unlocks the admin resolve panel; `teamId` is the alignment checksum that makes `mapOutcomeOddsToProjectIds` refuse a mismatched roster; race binding is "chain-keyed here on purpose." This is the module that decides whether a live market can be resolved and whether odds map to the right competitors. It is reviewed — correctly — as on-chain-binding data.
A roadmap of unbuilt prizes has the opposite lifecycle: it changes when product changes its mind, it has no chain semantics, and a typo in it is harmless. Colocating them means an editorial edit to the word "Ice" lands in the same diff-review lane as a `teamId` checksum, and it grows a 649-line load-bearing file for no reuse benefit.
**Recommendation.** New `ui/lib/deprize/capabilityLadder.ts`. Pure and dependency-free (same constraint as `liveTipOf`, so mocha imports it directly), importing `findDePrizeIdForGoal` from `competitions.ts`. One-way dependency: **content → chain, never the reverse.** A CMS or content-file layer is over-engineering for four rows and adds a fetch to a component §6.4 correctly says must not fetch; a sibling pure module is the right size.

### Should-fix

**B-S1. Shipping a component that is 75% broken links is not a "risk," it is the merge-day default.**
§8: *"If PR-A is late, GitHub blob URLs will 404 on new files until that merge — acceptable; do not block the UI."* Three of four rungs are links and three of four 404. That is not degraded behavior, it is the designed initial state, and it ships to every `/deprize` visitor.
**Recommendation.** A rung renders as a link only when `specHref` is non-empty. Ship `first-tracks` and `ice` with `specHref: ''` and have **PR-A's own diff** flip them to real URLs in the same commit that creates the files. The doc adding the file is the doc that knows the URL is valid; that is the natural place for the coupling, and it removes the ordering dependency in both directions instead of just documenting it away.

**B-S2. The index placement collides head-on with PR-0.** §6.5 anchors the strip "after the region notice and before search." In [`ui/components/deprize/DePrizeIndexContent.tsx`](../../ui/components/deprize/DePrizeIndexContent.tsx) that is the gap between `bettingBlockedReason` (~127–135, built from `useRegionRestriction`) and the search input (~170) — precisely the block PR-0 is rewriting to read the DePrize restricted list instead of the EU/EEA flag. Anchor to the search block instead, or state explicitly that B sequences after PR-0 and takes the conflict.

**B-S3. The atlas edit is scope creep into someone else's surface.** §6.3 has PR-B editing three `threshold` strings **and** the `shared-next-landing` goal `description` in `ui/lib/lunar-atlas/seed/atlas.dataset.json`. That is Moon Base Zero seed data — the `competitions.ts` header comment literally says to "agree with Miguel before either side writes atlas seed data that conflicts." It is also not a ladder change: it is Touchdown v0.2 copy propagation that happened to get noticed here. Same for `criteriaNotes` on [`DePrizeQuestionCard.tsx`](../../ui/components/deprize/DePrizeQuestionCard.tsx).
**Recommendation.** Move `criteriaNotes` + the atlas edit into their own PR alongside PR-A ("v0.2 lands in product surfaces"). PR-B is then purely additive: one new module, one new component, one or two mount points — and reviewable in a single sitting.

**B-S4. Two missing tests, one of which is the best available test in either doc.**
Answering the prompt directly — what fails if the ladder is wrong:
1. **Supersede survival.** Given a synthetic registry where `23` supersedes `22`, `getLadderForCompetition('sepolia', 23)` returns touchdown with `current: true` and `href === '/deprize/23'`. **As currently designed this test cannot pass without hand-editing the constant** — which is the whole argument for B-M1, and why writing the test first is worth it.
2. **Every `specHref` resolves to a file that exists.** For each rung, derive the filename from `specHref` and assert `fs.existsSync(path.join(repoRoot, 'docs', file))`. This is ~5 lines in the existing mocha setup and it makes PR-A's un-testable "cross-links resolve" acceptance criterion (A-M2) executable from PR-B's side. It fails loudly on merge-day 404s, on a PR-A rename, and on a typo. Best single test available here.
   Also: §6.6 case 1 ("length 4, keys in order") is a change-detector, not a behavior test — it fails when a fifth rung is added, which is intended system behavior. Keep it only if the intent is "adding a rung must be deliberate," and say so in the test name.

**B-S5. No flag and no stated removal path** for a component §8 calls "informational" that ships four off-site links and a rotting id. It *is* trivially removable (two mount points) — say so explicitly so an on-call has the one-line answer.

### Consider

**B-C1. The problem statement has no evidence.** §3: "Visitors cannot see that Touchdown is one rung of a published ladder." True, but is it a problem any visitor has? No ticket, no metric, no user question is cited. Everything downstream — two mount points, a new type, an atlas edit — rests on that unvalidated premise. One sentence of evidence, or one sentence conceding it is a bet, would change how a reviewer weighs the cost.

**B-C2. B1 was rejected on a false premise — the alternatives section is a straw man.** §5 B1 claims `sharedGoalId` inference fails because "First Tracks / Ice have no `sharedGoalId` and would be invisible." That does not follow. The rung *list* comes from `CAPABILITY_LADDER` under either design; `sharedGoalId` is only the mechanism for resolving the **live id** of rungs that are actual markets. Planned rungs have no goal and render `planned` — the desired behavior. B1 was rejected for a property it does not have, and the rejection is what produced B-M1 and B-M2. Worth flagging as a process note: when the only surviving alternative is the one the parent plan already chose, the alternatives section is decoration.

---

## 4. Position on the "PR-B is Weak" call

**Concur with the verdict. One of the three stated reasons is overweighted, and the reviewer missed the worse defect.**

- **Agree — three of four rungs link to 404s.** Disqualifying on its own for a component whose entire function is to make the product look coherent. A stepper that lands the user on GitHub's 404 page three times out of four teaches exactly the opposite of what it exists to teach. See B-S1 for the fix that does not depend on merge ordering.

- **Agree, and it is worse than stated — below the fold.** §6.5 places the stepper between `DePrizeQuestionCard` and `DePrizePositionPanel`: literally between the question and the user's own money. §9 concedes the stepper stacks vertically below `sm`, so on mobile four rungs of label + one-line bar + status chip is roughly a full viewport of roadmap inserted above the position panel of a live market. That is a conversion regression on the only page that has a market, in exchange for advertising two prizes that do not exist.

- **Refine — the `aria-current="step"` point is correct but should not carry weight in a design verdict.** It is genuinely wrong: `aria-current="step"` tells a screen-reader user "you are at this step of a process you are completing," and three of these four steps are not completable by anyone, ever. But the fix is two tokens (`aria-current="true"`, or drop it and mark the current rung with a visible label plus `<span className="sr-only">Current prize</span>`). Fixing it changes nothing about whether the feature should ship. Cite it as a nit, not as a third pillar of a Weak rating.

- **The reviewer missed the worse defect: B-M1.** The 404s are embarrassing and *self-healing* the moment PR-A merges. A hardcoded `deprizeIdByChain: { sepolia: 22 }` that no runbook step maintains is a permanent correctness bug that gets worse with time, that PR-A's own nine-step procedure guarantees will be triggered, and whose failure mode is pointing live users at a superseded market. A design review that rates B on 404s and `aria-current` and not on this is grading the paint.

### What PR-B v1 should actually be

Cut to the honest minimum — four rungs deserve one link, not four:

1. **`ui/lib/deprize/capabilityLadder.ts`** — `CAPABILITY_LADDER` (four entries, `sharedGoalId` instead of `deprizeIdByChain`) plus pure `getLadderForCompetition`, ids derived via `findDePrizeIdForGoal`. Full test file including B-S4's supersede case and spec-file-exists case. This is the piece PR-G's Discord `/odds` and PR-D actually need, it has zero UI risk, and it is the only part of PR-B that is unambiguously worth having today.
2. **No stepper on the prize page.** One line under the question card: *"Touchdown is rung 0 of MoonDAO's capability ladder — see the roadmap,"* linking to `DEPRIZE_CAPABILITY_LADDER.md`. One link, one target, the one URL PR-A guarantees exists. Cannot 404 in three places, cannot push the position panel below the fold, and there is no `aria-current` question because there is no step list.
3. **The four-rung strip on `/deprize` only** — the index has no position panel to push down and the user is browsing, so a roadmap is on-topic there. Render planned rungs as plain text with a status chip, **not as links**, until their spec URL exists (B-S1).
4. **`criteriaNotes` + the atlas edit ship separately, with PR-A** (B-S3).

That version is a fraction of the diff, has no broken links, survives a supersede, stops touching the chain-binding registry, and hands PR-D/PR-G the helper they need. When First Tracks is actually registered, the stepper becomes worth building — because it will then have two real rungs and a reason to exist.
