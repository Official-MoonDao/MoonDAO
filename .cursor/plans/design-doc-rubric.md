# Design Doc Review Rubric

A reusable rubric for judging technical design documents, distilled from published guidance by
engineers at Google, Uber, Microsoft, Stripe/Calm, and the originator of the ADR format.

Use it to review any design doc in this repo. It is deliberately checkable: each criterion has a
pass condition you can look for and a smell that tells you it failed.

---

## 1. Sources

| URL | Author | One-line takeaway |
|---|---|---|
| https://www.industrialempathy.com/posts/design-docs-at-google/ | Malte Ubl (then Google, Tech Lead for AMP) | The design doc exists to record **trade-offs**; if it only says "here is how we will implement it," you should have written the code instead. |
| https://google.github.io/eng-practices/review/reviewer/looking-for.html | Google (public eng-practices) | Reviewers must actively hunt over-engineering, concurrency bugs, and tests that would not fail when the code is broken. |
| https://google.github.io/eng-practices/review/reviewer/standard.html | Google (public eng-practices) | Approve once the change definitely improves the system — "there is no such thing as perfect code, there is only better code." |
| https://lethain.com/good-engineering-strategy-is-boring/ | Will Larson | Start from the problem, show your work, and notice that repeated cross-doc policy belongs in one strategy doc rather than pasted into every spec. |
| https://newsletter.pragmaticengineer.com/p/rfcs-and-design-docs | Gergely Orosz | RFC effort should be proportionate to complexity, and scaling the process requires explicit **approver** fields, not ambient visibility. |
| https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions | Michael Nygard | Record each significant decision as Context / Decision / Status / **Consequences** — including the negative and neutral ones. |
| https://caitiem20.wordpress.com/2020/03/29/design-docs-markdown-and-git/ | Caitie McCaffrey (Azure Sphere Security Services, Microsoft) | Name the owner, approvers, and reviewers in a first PR *before* writing the doc, and record sign-off durably. |

### Direct quotes worth keeping in mind

- Ubl: "A clear indicator that a doc might not be necessary are design docs that are really
  implementation manuals. If a doc basically says 'This is how we are going to implement it'
  without going into trade-offs, alternatives, and explaining decision making … then it would
  probably have been a better idea to write the actual program right away."
- Ubl on non-goals: "non-goals aren't negated goals like 'The system shouldn't crash', but rather
  things that could reasonably be goals, but are explicitly chosen not to be goals."
- Google eng-practices: "Will the tests actually fail when the code is broken?"
- Google eng-practices: "Encourage developers to solve the problem they know needs to be solved
  now, not the problem that the developer speculates might need to be solved in the future."
- Larson: "Bad strategies state a policy without explanation, which decouples them from the context
  they were made. Without context, your strategy rapidly becomes incomprehensible."
- Larson: "Start from the problem. The clearer the problem statement, the more obvious the
  solutions. If solutions aren't obvious, spend more time clarifying the problem."
- Nygard: "All consequences should be listed here, not just the 'positive' ones."

---

## 2. The rubric

Twenty criteria in six groups. Score each **pass / weak / fail**. A doc does not need every
criterion — apply the ones the change actually implicates, and say which you skipped.

### Framing

**1. The problem is stated before any solution.**
- *Passes when:* a reader who knows nothing about the proposal can state, after the first page, who
  is hurting and how, without reference to the proposed mechanism.
- *Smell:* the problem section describes the absence of the proposed feature ("we do not have X")
  rather than a condition in the world that X would relieve.

**2. Non-goals are plausible goals explicitly declined.**
- *Passes when:* at least one non-goal would make a reasonable reviewer say "wait, really?" — it is
  something a sibling team might have expected in scope.
- *Smell:* non-goals are negated goals ("should not crash", "no bugs") or restatements of the
  constraints section.

**3. Audience and blast radius are named.**
- *Passes when:* the doc names who is affected, which existing surfaces/callers change behavior, and
  which explicitly do not.
- *Smell:* no list of touched systems, or a list of files instead of a list of affected users and
  dependent teams.

### Decision quality

**4. Alternatives are real, not straw men.**
- *Passes when:* at least one rejected alternative is described strongly enough that you can see why
  a competent engineer would have chosen it, and the rejection turns on a stated trade-off.
- *Smell:* every alternative is rejected in one line; or the constraints section already mandates the
  chosen option, making the alternatives section decorative. (Ubl calls this section "one of the most
  important ones.")

**5. Rationale is shown, not asserted.**
- *Passes when:* each significant decision carries the forces that produced it and its consequences,
  including the ones that hurt (Nygard's Consequences section).
- *Smell:* declarative policy with no "because" — "We will use X. No Y." Larson's test: could a future
  reader adapt this decision when the context shifts, or only obey it?

**6. Scope is right-sized, and the doc does not over-build.**
- *Passes when:* the doc's weight is proportionate to the risk (Orosz), it solves the problem known
  now rather than a speculated future one, and it is a design doc rather than an implementation
  manual (Ubl).
- *Smell:* generality with no present caller; abstractions introduced "for later"; or, in the other
  direction, pages of literal code, full schema dumps, and a numbered keystroke-level build plan,
  which is the signal that the doc should have been the code.

### Operational rigor

**7. Failure modes and degraded behavior are enumerated.**
- *Passes when:* for each external dependency the doc says what happens when it is down, slow, or
  wrong, and whether the system fails open or closed.
- *Smell:* only the happy path is described; failure appears once as "returns 503."

**8. Idempotency, concurrency, and retries are reasoned about.**
- *Passes when:* anything that can run twice (cron, webhook, retried write) is shown to be safe, and
  concurrent writers to the same key/row are addressed. Google singles concurrency out as a class of
  bug that "usually needs somebody to think through them carefully."
- *Smell:* an idempotency guard exists but there is no story for the case where the guard is set and
  the underlying input later turns out to be wrong.

**9. Data model, units, and backward compatibility are explicit.**
- *Passes when:* stored shapes, units, and their conversion boundaries are pinned down, and the doc
  says what happens to data written by the previous version (migrate, dual-read, or orphan).
- *Smell:* a new schema with no word about existing rows; or units that differ between UI, API, and
  storage with the conversion point left to the implementer.

**10. Observability and alerting are part of the design.**
- *Passes when:* the doc names the signal that would tell an on-call human this is broken, and who
  or what receives it.
- *Smell:* "we will add logging," or a background job with no stated way to notice it stopped.

**11. Rollout, flags, and rollback are specified.**
- *Passes when:* there is a stated sequence to turn it on, a flag or kill switch where the blast
  radius warrants one, and a rollback that is actually possible given the data written.
- *Smell:* "Flags: none. Rollout: merge anytime" on a change that writes durable state.

**12. Cost, quotas, and third-party limits are estimated.**
- *Passes when:* unbounded growth is bounded (TTL, cap, retention) and per-call metered dependencies
  have a rough volume estimate against the plan's limits.
- *Smell:* append-only arrays with no cap; a periodic full scan of a metered keyspace; no number
  anywhere.

### Trust & safety

**13. Privacy and retention are addressed.**
- *Passes when:* the doc names what personal data is stored, for how long, and why that period. Ubl
  notes Google *requires* a dedicated privacy design doc and a privacy review.
- *Smell:* identifiers persisted indefinitely with no retention policy, or a rule about one data
  store ("never log raw IPs") copied in while the new store's contents go unexamined.

**14. Abuse, sybil, and gaming are considered where incentives exist.**
- *Passes when:* any ranking, reward, reputation, or free-entry mechanism has a stated cheapest
  attack and a stated response (even if the response is "accepted, here is why").
- *Smell:* a leaderboard or reward whose only abuse note concerns display-name sanitization.

**15. Legal and compliance deferrals are explicit and owned.**
- *Passes when:* anything punted to legal, compliance, or a geo/regulatory question is written down
  as a deferral with a named owner and a date or trigger.
- *Smell:* a one-line "Legal: not a bet" inside an alternatives table, doing the work of a review
  that never happened.

### Verifiability

**16. Acceptance criteria are falsifiable.**
- *Passes when:* each criterion has a concrete input and expected output that a third party could
  check without asking the author what they meant.
- *Smell:* criteria phrased as prohibitions ("must not import X", "do not change Y") with no
  mechanism that would catch a violation; manual screenshot lists standing in for assertions.

**17. At least one test would fail if the code were wrong.**
- *Passes when:* the doc names specific cases with expected values, including a case that
  distinguishes the chosen semantics from the plausible wrong ones. This is Google's explicit
  question: "Will the tests actually fail when the code is broken?"
- *Smell:* "add unit tests" with no cases; or only tests that pass under both the intended and a
  common misimplementation.

**18. Success is measurable in production.**
- *Passes when:* there is a number, observable after launch, that would distinguish this working
  from this shipping.
- *Smell:* success defined as "the feature is merged."

### Process hygiene

**19. The ask and the approvers are explicit.**
- *Passes when:* the doc states what decision it is requesting, from which named people, and how
  sign-off will be recorded (McCaffrey's owner/approver/reviewer PR; Uber's approver fields).
- *Smell:* reviewers listed as roles or teams rather than people; a Status field asserting the doc's
  own approval instead of requesting one; a "review response" section answering an unnamed,
  unlinked reviewer.

**20. Frozen defaults, deferrals, and kill criteria each have an owner and a trigger.**
- *Passes when:* every item in the risks/open-questions table is either a real open question with an
  owner, or a decision with its consequence and the condition that would reopen it; and the doc says
  what result would make the team abandon or reverse the work.
- *Smell:* an open-questions table where every row is resolved by a "Default" column — decisions with
  the rationale, the consequence, the owner, and the expiry all stripped out.

---

## 3. How to apply it — a 10-minute reviewer's pass

Run these seven steps in order. Stop and report as soon as you have three or more fails; the doc
needs another round regardless of what the rest says.

1. **Minute 0–1 — Read only the summary and problem statement.** Write down, in your own words, who
   is hurting. If you cannot, criterion 1 fails and everything downstream is unmoored. (Larson:
   spend more time clarifying the problem.)
2. **Minute 1–2 — Read the non-goals.** Does any of them surprise you? If they are all negated goals,
   criterion 2 fails.
3. **Minute 2–4 — Read the alternatives section backwards**, strongest rejection first. Ask: would a
   competent engineer have picked this? If no alternative survives that question, criterion 4 fails.
   Then check whether the constraints section already forced the answer.
4. **Minute 4–6 — Grep for operational nouns.** Search the doc for: *retry, idempoten, concurren,
   migrat, alert, rollback, flag, quota, TTL, retention, cost*. Each miss is a candidate fail in
   criteria 7–12. Missing terms are not automatically failures; ask whether the change implicates
   them.
5. **Minute 6–7 — Find one test with a number in it.** If the test list has no expected values, or
   only prohibitions no mechanism enforces, criteria 16–17 fail.
6. **Minute 7–9 — Read the risks/open-questions table as if it were an ADR.** For each row: is there
   a consequence, an owner, and a reopen trigger? Rows that are decisions wearing a question's
   clothes are criterion 20 fails.
7. **Minute 9–10 — Check the header.** Named approvers, a stated ask, a recorded sign-off. Then apply
   Google's standard of review: does this doc, as it stands, definitely improve the team's
   understanding of the system? If yes, approve with comments rather than blocking for polish.

**Output format.** Report as *Blocker* (ship-stopping: wrong semantics, data loss, unreviewed
privacy/abuse surface), *Should-fix* (a criterion fails but the design survives), and *Nit*. Google's
standard is explicit that reviewers should not hold a change hostage to their own best work —
"focus on pushing designs to be good, rather than fixating on your own best as the relevant quality
bar" (Larson).

---

## 4. Quick observations on this document set

From a skim of `.cursor/plans/pr-d-forecasts.md` and `.cursor/plans/pr-b-ladder-ui.md` only. These
are pattern-level notes for the doc set; per-PR critique belongs to the sibling reviewers.

- **The alternatives sections are largely decorative.** In PR-D, §10 already mandates "Persistence =
  Upstash Redis … No Postgres," so §5's D1 wins before the comparison starts; D2–D4 get two to four
  bullets and a one-word "Rejected." Same shape in PR-B. Ubl treats this as the section that carries
  the doc's value.

- **§10 "Cross-cutting constraints" states policy with no rationale, and is pasted across docs.** It
  is near-identical in both, including constraints irrelevant to the PR at hand (PR-B adds a static
  constant and a stepper, yet carries the Redis persistence, `CRON_SECRET`, and `hashIp` rules).
  This is exactly Larson's "write five, then synthesize": the repeated block wants to be one
  strategy doc, with rationale, that each spec links to.

- **The "Risks and open questions" tables are decisions in disguise.** Every row resolves to a
  "Default" with no owner, no consequence, and no reopen trigger — e.g. PR-D freezes
  `FORECAST_SEASON = '2026'` with no statement of what happens in 2027. Nygard's format exists
  precisely so the reasoning survives the decision.

- **Implementation-manual smell.** PR-B §6.1 inlines the full literal `CAPABILITY_LADDER` constant
  with all four rungs, and both docs carry line-numbered file references and ten-step build plans.
  Ubl: "Design docs should rarely contain code, or pseudo-code," and a doc that is mostly *how we
  will implement it* is a signal to write the code instead.

- **Operational sections are thin relative to what is being built.** PR-D adds an hourly cron that
  writes a durable leaderboard from on-chain resolution data, and §8 covers testing, flags, and
  rollout in four bullets. There is an idempotency guard (the `:scored` key) but no failure modes,
  no alerting, no backfill story, and no path for a CTF report corrected *after* `:scored` is set —
  which the guard would make permanently unscoreable.

- **Cost, quota, and retention are absent.** PR-D stores an unbounded `history[]` per user per prize
  in metered Upstash with no TTL or cap, and proposes `SCAN forecast:*:users` on every hourly tick.
  No volume or cost estimate appears in either doc.

- **Sybil resistance is unaddressed on a free-entry leaderboard.** PR-D's identity is a Privy
  `userId` obtainable with any email — stated approvingly — and the only abuse note in §9 concerns
  40-character display-name sanitization. Google's guidance is that someone qualified in the area
  must be on the review; no such reviewer is named.

- **Process: reviewers are roles, and the docs approve themselves.** Both headers read "Reviewers:
  DePrize product, engineering" and carry Status "Ready" / "Ready with nits," plus a "Review
  response (2026-09-16)" answering an "independent review" that is neither named nor linked.
  McCaffrey's and Uber's processes both converged on named approvers and durably recorded sign-off
  for this reason. Neither doc states a success metric or an abandonment condition.
