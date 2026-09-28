# Engineering critique — PR-E (Patrons wall + Fund the prize)

| Field | Value |
|---|---|
| **Subject** | [`.cursor/plans/pr-e-patrons.md`](pr-e-patrons.md) (Status: Ready) |
| **Lens** | Engineering quality and design judgment — **not** a repeat of [`pr-design-docs-review.md`](pr-design-docs-review.md) (correctness, already applied) |
| **Reviewer** | Staff engineering pass, 2026-09-16 |
| **Did not** | Write product code, commit, or edit any other file |
| **Read budget** | 4 files + targeted greps. `MissionContributeModal.tsx` deliberately not opened; the doc's own quote of the `pay` call is taken as given. |

---

## 1. Scorecard

| Rubric group | Verdict | Why |
|---|---|---|
| **Framing** | Adequate | Real problem ("the pool number is a black box"), strong non-goals, explicit "do not wire `evaluateEligibility`." No blast-radius statement: PR-C shares the header stats grid and the review already flagged that collision; §10 says "ignore the parent plan" but never says "coordinate with C." |
| **Decision quality** | **Weak** | E1–E4 are genuine alternatives with stated rationale — that part is good. But the option space is mis-drawn. Three decisions were made without being argued: subgraph vs explorer/RPC, client-side vs server-side aggregation, and copy-the-`pay` vs extract-a-shared-`pay`. The §10 constraints block pre-settles the transport question before §5 runs. |
| **Operational rigor** | **Weak** | No cache or TTL story; the shared endpoint's caching behavior is accidental and may defeat the doc's own post-pay refresh promise; `error` and `empty` render identically; no observability; "no feature flag" on a surface that publishes user text; cost of a 20-round-trip client fan-out unexamined; the `MAX_PAGES` partial-data policy it says to "mirror" is not carried over. |
| **Trust & safety** | **Weak** | Filtering on `from` while crediting `beneficiary` creates a dust-priced impersonation primitive on a public wall. User-supplied memos are rendered with no moderation, no filter, and no takedown. ENS resolution leaks every patron address to a third party per page view. Sibling PR-C builds a display-name **opt-in** for the same act of publication; PR-E publishes with none. |
| **Verifiability** | Adequate | The `patrons-math` case list is genuinely good and falsifiable, including the fee-router case. But every fixture sets `from == beneficiary`, so no test fails if the display axis is wrong; and nothing tests the query layer, the integer validation the doc mandates, or pagination. One acceptance step ("backer count vs patron count should differ") is not falsifiable. |
| **Process hygiene** | Adequate | The decision asked is clear, and "Fund is geo-open until counsel says otherwise" is at least *labeled* a product decision — better than the sibling docs. But it has no named owner, no revisit trigger, and no pre-specified reversal. Reviewers are role names ("DePrize product, engineering"), not people. |

**Overall: Weak.** Not because the aggregation core is wrong — it is the best-specified part of the doc — but because the two weak groups are exactly the two that matter for a surface that is simultaneously public, money-accepting, and user-authored. A wall with the wrong name on it is worse than no wall.

**Single most important improvement:** make the classification axis and the display axis the same one. Filter on `from`, **credit `from`**, and require `from == beneficiary` for a row to appear. That one predicate closes the impersonation vector, survives contract redeploys better than an address deny list, and subsumes both of the exclusions the doc hardcodes.

---

## 2. Findings

### Must-fix

#### M1 — The wall filters on `from` but credits `beneficiary`. That is a dust-priced name-graffiti primitive.

§6.2 defines `isPatronEvent(ev, mint, feeRouter)` over `ev.from`, then says *"Aggregate by **beneficiary** (checksum-lower)"* and types `PatronRow.beneficiary`. Those are two different addresses and nothing constrains them to match.

The doc's own modal sets `beneficiary = account.address` (§6.5 step 3) — but that is a property of *MoonDAO's modal*, not of the wall. The wall renders whatever `JBV5MultiTerminal.pay` was called with by anyone, including a direct contract call. So:

- **Impersonation.** Pay 1 wei with `from = <attacker EOA>`, `beneficiary = <any address that resolves to a recognizable ENS name>`. `isPatronEvent` passes (`from` is a 0x address, amount > 0, not mint, not fee router). The wall renders that person's ENS `displayName` as a patron of a prediction market they have never touched, next to an attacker-chosen memo. Cost: gas.
- **Wrong attribution.** Pay 10 ETH with `beneficiary = <friend>` and you are invisible; your friend is the top patron. The stated goal is "show who funded the prize **directly**" — by construction the wall does not show that.
- **The fee-router fix is incomplete.** The exclusion is on `from` only. A third party can pay dust with `beneficiary = <fee router owner Safe>` and put the treasury back on the wall, which is precisely the outcome the prior review blocked.

**Recommendation.** Make `from` both the filter and the credit key, and add `from.toLowerCase() === beneficiary.toLowerCase()` as a required condition. This single predicate already excludes mint (`from` = mint, `beneficiary` = bettor) and the fee router (`from` = router, `beneficiary` = owner), so the address deny list becomes defense-in-depth rather than the mechanism.

State the trade-off honestly in the doc, because it is real: `from == beneficiary` drops gift-pays and smart-account/relayer pays where `from` is an entrypoint or Safe module. For a public wall, prefer being right about the names you print over being complete. Recover the lost total with one reconciliation row — "plus N contributions via other routes: X ETH" — so the wall's total still ties out against direct pays.

**Test that fails if the code is wrong** (the current suite would not): fixture `from = 0xAlice, beneficiary = 0xVitalik, amount = 1` → assert **no row**, and assert `totalDirectWei` unchanged. Every existing "included" fixture sets `from == beneficiary`, which is why the bug is invisible to them.

#### M2 — The memo is unmoderated user content on a public page, and the length cap is enforced at the wrong layer.

§6.5 step 2 caps the memo at ~80 chars *in the modal*. §6.4 renders "optional memo (truncate)." The cap is client-side on MoonDAO's own modal; anyone calling `pay` directly on the terminal can write an arbitrary-length, arbitrary-content memo and it lands on the DePrize prize page. Input validation at the submit boundary does nothing for a surface whose input is the chain.

XSS specifically is not the risk — the existing precedent renders memos as escaped JSX text:

```255:257:ui/components/mission/MissionActivityList.tsx
function RichNote({ note }: { note: string }) {
  return <div className="text-sm break-words text-white/80 leading-relaxed">{note}</div>
}
```

The risk is everything else: slurs, harassment, phishing URLs, RTL-override and zero-width tricks, and layout-breaking length, rendered on a page MoonDAO publishes. And it is **permanent** — the memo is on-chain, so "moderation" can only mean a render-time filter. The doc has no filter, no allowed-character policy, no report path, no owner, and §8 says **"No feature flag."** Combined, the only way to take down an offensive memo is a code revert and a deploy.

**Recommendation, in preference order:**
1. **v1 renders no memos.** Keep sending the `DePrize #<id>:` prefix on-chain; just don't display user text. This deletes the entire moderation problem at zero product cost and is a two-line change to §6.4.
2. If memos must ship: render-time normalize (NFC), strip control/bidi/zero-width, hard-truncate, reject anything containing `://`, and put it behind a flag that can be flipped without a deploy. Reuse PR-C's sanitizer rather than writing a second one (see §3).

Either way, "no feature flag" needs to be re-argued. The justification given ("hide the button when `jbProjectId` is missing") addresses the *write* path; the risk is on the *read* path.

#### M3 — Subgraph error and subgraph empty render the same thing, and the thing they render is a false claim.

§6.3's hook returns `error`, but §6.4 specifies only one non-populated state: **"Be the first patron."** If Bendystraw is down, or the key is missing, or `MAX_PAGES` trips, a prize with forty patrons tells every visitor there are zero and invites them to be the first. That is a confident wrong answer where "we couldn't load this" was available.

This is also the answer to critique target 3. The pool figure comes from on-chain `useTotalFunding`, the wall total comes from the subgraph, and the doc specifies the disagreement in one direction only — §6.5 accepts "the wall updates and the stat does not." The other direction is unhandled and is the one that scares users: I just paid, the pool moved, and my name is not on the wall.

**Recommendation.** Three distinct states, spelled in §6.4: `loading` → skeleton; `error` → "Couldn't load patrons right now" (never the empty copy); `empty && !error` → "Be the first patron." Add a fourth for the post-pay window: remember the pending tx hash locally and render "Your contribution is indexing — this can take a minute" until the row appears. Also specify the copy relating the two numbers, since "Prize pool 12 ETH" next to "Patrons 3 ETH" is unexplained by design (the difference is bet slices plus swept fees) and reads as a bug.

Carry over the source helper's partial-data policy, which the doc says to mirror but does not mention:

```173:178:ui/lib/mission/fetchMissionFundingStats.ts
  if (!exhausted) {
    console.warn(
      `[fetchMissionFundingStats] hit MAX_PAGES (${MAX_PAGES}) cap for project ${projectId}; refusing to return partial aggregates`
    )
    return null
  }
```

Refusing to publish undercounted aggregates is the right call and PR-E should say whether it does the same or shows a partial wall with a marker. Right now it says neither.

---

### Should-fix

#### S1 — Aggregation should be server-side and cached. The client fan-out inherits a caching behavior nobody chose, and it may break the doc's own refresh promise.

§6.1 has the browser page Bendystraw through `/api/juicebox/query`, up to `MAX_PAGES = 20` sequential POSTs, per page view, per visitor, recomputed every time. That endpoint is `rateLimit` only, with no CDN cache headers, and the urql client is module-scoped:

```10:12:ui/pages/api/juicebox/query.ts
const subgraphClient = createClient({
  url: subgraphUrl,
  exchanges: [fetchExchange, cacheExchange],
```

Note the exchange order. `fetchExchange` is a terminating exchange, so a `cacheExchange` placed *after* it is not reached — which most likely means this endpoint does no caching at all, and PR-E is about to multiply its traffic by twenty per prize-page view on MoonDAO's paid Bendystraw key. If instead the cache is live, the opposite failure applies: urql's document cache is cache-first and there are no mutations here to invalidate it, so bumping `refreshNonce` after a successful pay re-issues the identical query string and the user gets the pre-pay result — the wall does **not** show their contribution, which is the one thing §6.5 promises it will do.

I am not certain which branch is true, and PR-E should not have to be either. That is the point: this is load-bearing behavior that the design inherits by accident.

**Recommendation.** Add `ui/pages/api/deprize/patrons.ts` — `withMiddleware(handler, rateLimit)` plus `setCDNCacheHeaders` (the pattern `logs.ts` already uses) — that takes `deprizeId`, does the pagination and the classification server-side, and returns aggregated rows with an explicit short TTL and an `asOf` timestamp. This kills the client fan-out, makes cost bounded per prize rather than per visitor, puts the patron rule in one place instead of shipping it to the browser, gives the UI a real staleness signal for M3, and removes the urql ambiguity from the critical path. Pass an explicit cache-bust or `requestPolicy` on the post-pay refetch regardless.

#### S2 — Subgraph vs explorer/RPC was never argued, and DePrize already has a house pattern.

§5's alternatives are all about the *modal* (copy / mount / deep-link). The data-source decision — Bendystraw — is asserted in §1 and §6.1 and never appears as an alternative. Meanwhile `ui/lib/deprize/events.ts` already establishes an explorer-first-with-RPC-fallback shape for DePrize events, including a truncation guard and a browser-only assertion:

```7:7:ui/lib/deprize/events.ts
// route is unavailable (no key, explorer outage). Results are cached per
```

with `getContractEvents(... useIndexer: false)` as the fallback leg at ~149/161.

The subgraph is probably still the right choice for `payEvents` — it decodes and pages them for free and DePrize's own event helper does not know about Juicebox. But the doc should say that, and should say what happens when Bendystraw is the *only* source and it is down (today: M3's false empty state). Add a two-line E5 to §5 covering subgraph vs `getContractEvents` on the terminal vs a server-side indexed cache, with the cost and freshness argument for each, so the next reader knows this was a decision and not a default.

#### S3 — The address deny list is not stable across redeploys, and it fails in the direction that puts a wrong name on the wall.

Critique target 2, answered directly: a deny list keyed to `DEPRIZE_MINT_ADDRESSES` and `DEPRIZE_FEE_ROUTER_ADDRESSES` is a snapshot of today's protocol topology applied to a historical event log. Two concrete failure modes:

- **Redeploy.** If `DEPRIZE_MINT_ADDRESSES.sepolia` is updated to a new mint (there is active redeploy work in this program), the config holds one address but the subgraph holds pays from both. Every historical bet slice from the *old* mint retroactively becomes a community patron, with `beneficiary` = the bettor — so the wall fills with people who placed bets and never funded anything. The doc's exclusion must be a **set per chain** (all historical protocol payers), not a single address, and §6.2 should say so explicitly because `?? ''` on a missing slug currently means "exclude nothing."
- **New protocol payer.** §6.2 says "if config later adds another protocol payer, extend the exclusion list from config." That is a process promise with no enforcement and no owner. Nothing fails, no test breaks, no alert fires — the contract just appears on the wall as a generous anonymous whale.

The failure direction matters: a deny list fails **open**. Anything unknown is treated as a patron and published. M1's `from == beneficiary` predicate fails **closed** — anything unknown is omitted — and a missing patron is a support ticket while a wrong patron is a screenshot. Derive membership from shape; keep the address set as a second filter.

#### S4 — `pay` failure semantics are underspecified, and the modal makes no durability promise.

§6.5 covers wrong-chain (reuses `useDePrizeChainGuard` — good) and toasts on success/error. Missing:

- **No minimum.** Dust rows pollute the wall and make M1's impersonation attack free. Set a floor.
- **No maximum and no confirm step.** BetModal is capped at `DEPRIZE_MAX_BET_WEI = UNIT`; Fund has no cap and no second confirmation. A fat-fingered decimal sends an unbounded amount into a pool with no withdraw path.
- **Irreversibility is not in the copy.** The one-liner says "not a bet, does not buy outcome tokens, does not move the market." It never says the money cannot come back. §9 acknowledges the patron receives mission tokens "same as any JB pay," which means the actual refund/redeem status depends on a ruleset the doc explicitly declines to read. Either state the redemption status or say plainly: treat this as non-refundable.
- **Succeeded-but-invisible** is M3's fourth state.

`min tokens = 0n` I will grant: for a donation, slippage protection is not the point, and refusing to block funding on a failed Sepolia quote is the right call.

#### S5 — Observability is absent.

There is no counter for how many events were excluded and by which rule, no signal when the subgraph errors, no alert when a previously populated wall goes to zero. Given S3's silent-misclassification mode and M3's silent-empty mode, the failure modes of this feature are *specifically* the invisible kind. Minimum: log excluded-event counts by reason on the server aggregator from S1, and treat "patron count dropped to zero for a prize that had patrons" as an alertable condition.

#### S6 — Publishing names with no opt-in, while the sibling PR builds an opt-in for the same act.

The prior review's §2.4 assigns PR-C a display-name sanitizer and PR-C builds a `payloadNameOptIn` flow — an explicit consent step before MoonDAO publishes a contributor's chosen name. PR-E publishes address, ENS name, amount, and free text with no consent step at all. "It's on-chain already" is true and not sufficient: aggregating pays into a named wall on a prize page is a new publication surface, and the sibling doc concedes that by building consent for it.

Two concrete gaps: no opt-out path, and ENS resolution via `ensideas.com` (§2) means rendering the wall discloses every patron address to a third party on every page view, which is unmentioned. At minimum, say in §8 who can remove a row and how fast.

Related, and worth one line in §9: the wall lists anyone who paid JB 268, including people who contributed through `/mission/14` believing they were backing a mission. They will be published on a prediction-market page. Say whether that is intended.

#### S7 — The geo-open decision has no owner, no trigger, and no pre-specified reversal — and the reversal is where the PR-0 bug class will reappear.

Critique target 8. "Fund is geo-open until counsel says otherwise" is correctly labeled a decision and correctly instructs the implementer not to freelance an `evaluateEligibility` call. What is missing is everything that makes it a decision rather than a default: who decides, by when, and what specifically changes on a "no."

The PR-0 interaction is the sharp edge. The Fund CTA reads no jurisdiction signal at all, so it does not inherit the bug — but it also has no correct signal plumbed to it. When counsel says gate it, the implementer will reach for what is nearest on the page:

```195:195:ui/pages/deprize/[id].tsx
  const region = useRegionRestriction()
```

which is the EU/EEA-flavoured client signal PR-0 exists to stop trusting, and will reproduce the exact bug class in a brand-new surface. The page already has the careful comment about a missing geo header at ~374 for betting; Fund would get none of that care.

**Recommendation.** Have `FundPrizeModal` and the Fund button accept the SSR `restricted` prop that PR-0 threads, and ignore it behind a single named constant (`FUND_GEO_OPEN = true`) with a comment pointing at the open counsel question. Reversal becomes flipping one boolean against the already-correct signal, rather than a redesign under time pressure. Name the owner and add the revisit trigger — "before Arbitrum mainnet funding goes live" is the obvious one, since geo-open on testnet and geo-open with real money are different risk postures and the doc treats them as the same decision.

---

### Consider

- **C1 — §10 pre-settles §5.** Same pattern the sibling reviews found. The pasted cross-cutting block names Upstash Redis, `authMiddleware` + `sessionWallet`, and cron conventions — none of which PR-E uses — while the transport decision that PR-E *does* make (client → `/api/juicebox/query`) is stated in §1 as fact. If S1 is accepted, §10's "Persistence = Upstash Redis" becomes relevant for the first time, as the cache backing the aggregator. Either way, the block should be trimmed to what this PR actually touches.
- **C2 — Reviewers are roles, not people.** "DePrize product, engineering" cannot approve the geo-open decision or own the deny-list extension promise in S3. Name humans against S7 and S3.
- **C3 — Acceptance criterion 8 is not falsifiable.** "Backer count vs patron count should differ if bets exist" can pass for unrelated reasons. Replace with: assert the configured mint address appears in the raw `payEvents` response for JB 268 **and** does not appear in the rendered wall, and assert the wall's patron count equals the number of distinct `from` values passing the predicate.
- **C4 — Integer validation is mandated but untested.** §6.1 requires `Number.isInteger` checks on `jbProjectId` and `chainId` before interpolation; §6.6 has no case for it. Add two: non-integer and negative → no fetch issued.
- **C5 — No test at the pagination layer.** The dedupe-by-`id` and `timestamp_lte` overlap logic is the subtlest code in the PR and the only thing being copied wholesale. Add one fixture where a page boundary ties on timestamp.
- **C6 — Blast radius.** §10 tells the implementer to ignore the parent plan but not that PR-C edits the same header stats grid. One sentence naming the integrator would save a merge conflict the prior review already predicted.

---

## 3. Shared-helper note (for the cross-PR reviewer)

PR-E needs four helpers that other PRs in this set also need. None currently has an owner.

| Helper | PR-E's need | Also needed by | If duplicated |
|---|---|---|---|
| **`prepareJBPay` / `lib/juicebox/payProject.ts`** | §5 E1 copies ~20 lines of `pay` params out of a 2,800-line mission modal. This is the missing alternative: §5 argues copy vs mount vs deep-link and never considers *extract*. | PR-F (onramp lands in a pay/bet flow), PR-C (payload purse touches the same terminal and quote surface), the mission modal itself | Two `pay` call sites drift on min-tokens policy, memo format, and terminal constant. The mission copy is the one that gets fixed; the DePrize copy is the one that silently rots. **Recommend PR-E writes the helper and calls it; migrate the mission call site in a follow-up so PR-E's blast radius stays small.** Needs a named owner. |
| **Display-text sanitizer** (NFC, control/bidi/zero-width strip, length cap, no `://`) | M2's memo rendering | PR-C already owns this per the prior review's §2.4 (40 chars, no `://`, no raw IP, NFC), PR-D profile opt-in | Divergent rules on two public surfaces. **PR-E should consume C's, not write a second.** If PR-E ships before C, PR-E writes it and C consumes. |
| **Cached subgraph aggregation endpoint** (`withMiddleware(handler, rateLimit)` + `setCDNCacheHeaders` + `asOf`) | S1's `/api/deprize/patrons` | PR-G's `/pool` has the same shape of problem (the prior review already told G it cannot import `useTotalFunding` because it is a hook) | Two conventions for "server-side read of Juicebox project money," two TTL policies, two staleness stories. Worth one shared module alongside D's `serverMarket.ts`. |
| **Protocol-payer registry** (set of all historical protocol addresses per chain, not a single current address) | S3's deny list | Any future reconciliation, export, or accounting script that must separate protocol flow from community flow | Every consumer re-derives "is this address one of ours" from whatever `const/config` happens to hold today, and each one breaks differently on the next redeploy. |

One cross-PR observation for the sibling reviewer: **PR-C builds consent for publishing a contributor's name and PR-E publishes names without it.** That is a policy inconsistency inside one program, not two independent design choices, and it should be resolved once at the program level rather than per-PR.

---

## 4. What is good

The `patrons-math` module is correctly isolated as pure, and its test list in §6.6 is specific and falsifiable rather than aspirational. §5's rejection of mounting `MissionContributeModal` is well-argued from concrete coupling (required props, onramp, cross-chain) instead of vague size concerns. The `useTotalFunding.refetch` avoidance is right for the stated reason. Passing the DePrize `chain.id` rather than inheriting `DEFAULT_CHAIN_V5` is a real bug caught before it was written. And "do not helpfully wire `evaluateEligibility`" is exactly the kind of negative instruction that stops an agent from improvising legal policy.
