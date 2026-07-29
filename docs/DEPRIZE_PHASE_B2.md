# DePrize Phase B2: live markets in Moon Base Zero

Phase B2 wires live on-chain DePrize odds into the Moon Base Zero race panels.
It ships in two waves because the atlas lives on a separate branch.

- **Wave 1** (this document, landed): retire the consent visibility gate in favour
  of disclosure, add the pure odds merge helper, and point bound competitors at
  their atlas pages.
- **Wave 2** (after the Moon Base Zero PR merges): consume the merge helper in
  `ui/pages/moonbase/index.tsx`, wire the race panel, add atlas competitor
  identity with claim-gated branding, and add `?race=` deep links.

Part 2 of the original B2 draft — in-flight roster changes — was designed and
built ahead of schedule. See [DEPRIZE_ROSTER_CHANGES.md](DEPRIZE_ROSTER_CHANGES.md).

## Where the race binding lives

`SharedGoalMarket` in the atlas carries optional `deprizeRegistryId` and
`deprizeQuestionId` strings. **These are unused and stay unused.** They are plain
strings with no chain dimension, and a DePrize id is chain-specific: registry
entry 9 on Sepolia is unrelated to entry 9 on Arbitrum.

The source of truth is the chain-keyed binding in
[ui/lib/deprize/competitions.ts](../ui/lib/deprize/competitions.ts):

```
DEPRIZE_COMPETITIONS[chainSlug][deprizeId] = {
  sharedGoalId,          // atlas SharedGoal.id this DePrize settles
  raceLabel,
  outcomes: [{ projectId, teamId?, consented?, field? }],
}
```

`findDePrizeIdForGoal(chainSlug, sharedGoalId)` is the reverse lookup, and it
resolves through `supersededBy` to the **live generation tip**, so a race that has
been superseded keeps pointing at the generation that is actually trading.

Consequence for the atlas dataset: no DePrize ids belong in
`atlas.dataset.json`. That keeps the highest-conflict file free of chain-specific
data, and means seeding a new race is a one-file change on the DePrize side.

## Disclosure instead of a consent gate

B1 shipped an all-or-nothing consent gate: outside Sepolia, a single competitor
without `consented: true` forced the whole race to `planned` and redacted live
odds. That was stricter than the risk warranted. Listing a public company as a
market outcome does not require its permission — prediction markets routinely
price named companies and candidates.

The actual exposure is **implied endorsement**: presenting an organization as an
entrant in *our* prize, with its logo and a "Back a competitor" button, can read
as "they signed up." That is a disclosure and trademark-restraint problem, not a
reason to hide a bound market.

Wave 1 therefore:

- replaces `areRaceOutcomesPublishable` with `isRaceBindingComplete` (has at least
  one non-field competitor) and `isDePrizeGoalMarketPublishable` with
  `isDePrizeGoalMarketBound`. No chain carve-outs; Sepolia is no longer special.
- drops the odds redaction in `useDePrizeGoalOdds`, while **keeping** the `teamId`
  checksum and roster-length guards. Those prevent attributing one competitor's
  odds to another, which is correctness rather than policy.
- repurposes `consented` as a **branding** flag via `isCompetitorClaimed`: name and
  link always render; logo and brand color only once claimed. Wave 2 enforces this
  when atlas identity is available.
- adds `ROSTER_DISCLAIMER`, rendered wherever named competitors sit next to a
  market, and section 5.3 of the Terms.

Note the atlas `RosterStatus` union already contains a `'consented'` value. That
stays **editorial** metadata driving panel copy. The binding's `consented` is
authoritative for branding. Do not cross-wire them.

This change had no live effect when it landed: Sepolia DePrize 9 was the only
bound race, and Sepolia was already exempt from the gate.

## Notes for Wave 2 (verified against `feat/lunar-simulator`)

Checked while reviewing Wave 1, so the wiring does not have to rediscover them:

- **Do not add a second disclaimer.** `SharedGoalPanel` already renders a
  no-endorsement caveat, gated on `anyUnconfirmed` (`rosterStatus` of `listed` or
  `invited`). Reconcile it with `ROSTER_DISCLAIMER` — one disclosure per surface,
  not two near-identical paragraphs. The panel's version is also gated on
  editorial `rosterStatus`, whereas the market disclosure should not be, so prefer
  showing `ROSTER_DISCLAIMER` whenever the race is bound.
- **`resolved` markets get the wrong caption today.** The panel picks its odds
  caption off `oddsLive = status === 'live'`, so a `resolved` market falls through
  to "Illustrative curator priors — live odds replace these when the prediction
  market opens." Add a resolved branch when wiring the panel.
- **The Open Field sentinel is safe with today's consumers.** Both `rankedMembers`
  and the panel's `ranked` read `odds[project.id]`, so they never iterate the odds
  keys and the extra `__open-field__` entry cannot become a phantom leader. It
  needs an explicit row to be visible at all.
- **`status === 'live'` already flips the caption** to "Odds are live
  market-implied probabilities," so the merge needs no extra plumbing for that.

## Known Wave 1 → Wave 2 dependency

Bound competitors on `/deprize/{id}` link to `/moonbase/{projectId}`, which **does
not exist until the Moon Base Zero PR merges**. The only bound race today is
Sepolia DePrize 9, a testnet QA fixture, so the dead link is not reachable from
any production race. Do not seed a mainnet race with `projectId`s until the
`/moonbase/[projectId]` route is live.

## The merge point

Three consumers read `goal.market.impliedOdds`, all keyed by atlas `projectId`:
the race panel bars, the district leader in `rankedMembers`, and the Legend leader
in the `races` memo. Rather than touch all three, Wave 2 merges live odds into the
goal's `market` **once**, upstream of `buildTechTrees`, and they all inherit it.

[ui/lib/deprize/goal-market.ts](../ui/lib/deprize/goal-market.ts) is that merge, and
it is intentionally decoupled from the atlas: it defines a structural
`MergeableGoal` subset that the real `SharedGoal` already satisfies, and is
generic so the caller gets its own type back. This is why Wave 1 can ship and
unit test the helper before the atlas branch exists.

It returns the goal untouched when there is nothing trustworthy to show — unbound,
`planned` status (including superseded and still-loading), or an empty odds map —
because curator priors are better than a blank market. Open Field mass is carried
under `OPEN_FIELD_PROJECT_ID` so the bars still sum to roughly 1 instead of
overstating the named competitors.

## Tests

- `yarn test:deprize` — merge helper, binding lookups, lineage, goal-odds mapping
- `yarn test:cypress-unit` — atlas selectors (Wave 2 only)
