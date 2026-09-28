# Engineering critique — PR-F (Onramp in BetModal)

| Field | Value |
|---|---|
| **Reviewer** | Staff-engineering pass (design judgment, not correctness) |
| **Date** | 2026-09-16 |
| **Subject** | [`.cursor/plans/pr-f-onramp.md`](pr-f-onramp.md) (post-review, Status: Ready) |
| **Lens** | Engineering quality. The correctness pass ([`pr-design-docs-review.md`](pr-design-docs-review.md)) is already applied; findings below are new. |
| **Did not** | Implement, commit, or edit any other file |

Files opened for this pass: `pr-f-onramp.md`, `pr-design-docs-review.md`,
`ui/lib/mission/useOnrampFlow.ts`, `ui/lib/coinbase/useOnrampJWT.tsx`, plus narrow windows of
`ui/components/deprize/BetModal.tsx` (575–629) and `ui/pages/deprize/[id].tsx` (366–427).

---

## 1. Scorecard

**Overall: Weak — not ready to implement.** The correctness review fixed *what* to call; nobody has
yet designed the *flow*. This is a state machine that survives a full-page redirect to a third party
and comes back holding real money, and the doc specifies one happy path plus a green banner.

| Rubric group | Verdict | Single most important improvement |
|---|---|---|
| **Framing** | Adequate | Change `Depends on: None`. §6.3 deliberately removes the `bettingAllowed` gate and §6.4 edits two more call sites; the blast radius is `[id].tsx` + `BetModal.tsx` + both index mounts, and the doc owns none of the merge ordering the parent review already mapped. |
| **Decision quality** | Adequate | Make provider selection a `chainId → funding strategy` map, not an `if (Arbitrum)` branch inside a 700-line modal. And re-derive the return-flow timing from the new MoonPay default (see MF-4) — that default was accepted from the review without revisiting the 2-minute poll it invalidates. |
| **Operational rigor** | **Weak** | Specify the terminal states. There is no poll-timeout state, no partial-fill state, no chain pinning on the balance read, no kill switch, and `clearJWT` on unmount contradicts the `verifyJWT`-on-return requirement in the same section. |
| **Trust & safety** | **Weak** | Bind the success affordance to the server-signed JWT and an observed balance delta. Today `?onrampSuccess=true&amount=…` is believed on sight (MF-1). Also: no line anywhere tells the user the ETH they just bought is theirs, is not a bet, and is not refundable by MoonDAO. |
| **Verifiability** | **Weak** | Extract the reopen decision into a pure reducer so a unit test can fail. `buildOnrampReturnUrl`/`parseOnrampReturn` tests prove string formatting; they cannot fail if the reopen logic is wrong (MF-5). |
| **Process hygiene** | **Weak** | Name reviewers, state the decision being asked, and label the frozen defaults (`0.01` prefill, 2-minute poll, 2–3 s interval, faucet URL, `context: 'deprize'`) as decisions with owners. |

What is good, briefly: the four alternatives in §5 are real options with honest trade-offs and F2/F3
are rejected for the right reasons; the non-goals in §4 are load-bearing rather than decorative; and
keeping the permit fetch inside `placeBet` (`BetModal.tsx` 276) means a redirect cannot strand an
expired permit — the doc should say that out loud, because it is the one hard state the design gets
for free.

---

## 2. State table

`?` = mentioned but behavior not defined. Row 1 is the only fully specified path.

| # | State | Specified? | Recommended behavior |
|---|---|---|---|
| 1 | Funds arrive ≥ typed amount, same wallet, market Running | **Yes** | As written: reopen on `outcome`, prefill, "Funds arrived," strip params. |
| 2 | Funds arrive **short** of the amount (fee slippage, partial fill) | ? §7 says "existing insufficient state" | Show the shortfall explicitly ("≈0.004 ETH short"), keep the CTA, and rebuild the next return URL for the **shortfall**, not the original amount. Never show "Funds arrived." |
| 3 | Funds never arrive; poll window (~2 min) expires | **No** | Terminal, named state: "We haven't seen the funds yet — card and bank purchases can take a while. Your amount is saved; refresh when your wallet updates." Stop polling, keep the prefill, do not imply failure. |
| 4 | User returns hours/days later on a bookmarked or shared return URL | **No** | Require a stored JWT whose `timestamp` (`useOnrampJWT.tsx` 14) is within N minutes (propose 60). Otherwise strip params and render the page normally — no modal, no banner. |
| 5 | Market **paused** / halted while away | **No** — actively broken by the §6.3 instruction to bypass `bettingAllowed` | Bypass only the geo/eligibility portion. Still require `deprize.bettingOpen && !tradingHalted && market.stage === Running` (`[id].tsx` 374–384). If false: reopen nothing, show a page-level notice. |
| 6 | Market **resolved** while away | **No** | Same as #5. Do not open a bet modal on a resolved market; point at the claim panel. |
| 7 | Prize **superseded** while away (#21 → #22 is a live concept in this repo) | **No** | Same as #5, plus redirect the reopen to the live tip via `resolveLiveDePrizeId` — or refuse and explain. Reopening a bet modal on a superseded generation is the worst outcome in this table: the user just paid for ETH to bet into a dead market. |
| 8 | Wallet **disconnected** on return | ? | The handler waits on `userAddress` with no timeout, so params linger forever. Wait max ~10 s, then strip and show "Connect the wallet you funded to continue." |
| 9 | Wallet **switched accounts** on return | **Yes** | `verifyJWT` address mismatch → error, no bet (`useOnrampJWT.tsx` 121–125). Correct. Add: name the funded address in the error so the user knows which wallet to reconnect. |
| 10 | Wallet switched **chains** on return | Partial | `wrongNetwork` precedes `insufficient` in the §6.2 branch order, so the CTA hides — but §6.3 step 5 computes `spendableFromBalanceEth(balance, chain.id)`. Pin that read to the **DePrize market chain**, never the wallet's current chain, or "Funds arrived" is computed against the wrong balance. |
| 11 | **Two tabs**, one mid-flight | **No** — and the doc's own fix makes it worse | `onrampJWT` is a single global key (`useOnrampJWT.tsx` 41). Namespace it (`onrampJWT:deprize`) instead of `clearJWT`-on-unmount; see MF-3. |
| 12 | User closes the reopened modal | **No** | Strip params on first successful handle. Otherwise you inherit `useOnrampFlow` 96–102, which **reopens** the modal on every render while `onrampSuccess` is in the URL — the user cannot dismiss it. |
| 13 | Browser **back** after the return | **No** | Params reappear, the once-ref is fresh on remount, banner replays. The JWT freshness check in #4 plus a consumed-JWT marker bounds this. |
| 14 | Crafted / edited `outcome` or `amount` | Partial (`parseOnrampReturn` shape validation only) | See MF-1 and MF-2: require the JWT, clamp to the cap, bound decimals, and derive the banner from an observed delta. |
| 15 | Onramp abandoned at the provider (user closes the tab) | **No** | No return happens, so nothing breaks — but this is the state the funnel exists to measure and it is invisible. See MF-6. |
| 16 | `generateJWT` fails (rotated `CB_API_KEY`, 500) | **No** | `generateJWT` returns `null` and only `console.error`s (`useOnrampJWT.tsx` 88). The CTA must not redirect without a token: toast the failure, keep the modal open, count the error. |
| 17 | Permit expired while away | n/a — safe by construction | The permit is fetched inside `placeBet` (`BetModal.tsx` 276), so there is nothing to expire across a redirect. Say so in §6.5 so no one "helpfully" pre-fetches it. |
| 18 | Non-Arbitrum, non-Sepolia DePrize chain | **Yes** | Faucet/no-widget branch. Fine, and the MF-4 config map makes it explicit rather than an `else`. |

---

## 3. Findings

### Must-fix

**MF-1 — The return handler trusts the URL. §6.2 and §6.3 contradict each other about the JWT.**
§6.2 says "On return, `verifyJWT(token, address, undefined, 'deprize')`." §6.3's numbered handler
(steps 1–6) never mentions the JWT: it parses `router.query`, waits for `router.isReady` /
`userAddress` / `numOutcomes` / `!market.loading`, and opens. That is strictly weaker than the
pattern it claims to copy — `useOnrampFlow` 84–94 refuses to reopen unless a wallet **and** a stored
JWT are present. As written, `/deprize/22?onrampSuccess=true&outcome=3&amount=0.99` from any source
(a DM, a bookmark, a search result) reopens the bet modal on an outcome the user never chose with
0.99 prefilled. Nothing weakens the bet gates — Terms, attestations and eligibility still hold via
`canSubmitDePrizeBet` (`BetModal.tsx` 597–604) — but the product is now a link that pre-aims
someone's money at an outcome. **Fix:** make the stored JWT a hard precondition in §6.3 step 2, and
state which section owns the gate. Cross-check the JWT's `usdAmount` against the URL `amount` when
present. Note that `getAddressFromJWT` (`useOnrampJWT.tsx` 163–181) `atob`s the payload with **no
signature check** — it is a display helper, never a gate; only the `verifyJWT` server round-trip
counts. Say that explicitly or someone will use the cheap one.

**MF-2 — "Funds arrived" can be true off dust, and decouples from the amount immediately.**
§6.3 step 5 sets `fundsArrived` when `spendable >= amount`, where `amount` is the attacker- or
user-editable URL param. `?amount=0.000001` renders a green financial confirmation to anyone with
gas money. Worse in the honest case: §6.3 says `initialAmountEth` initializes `betAmount` "once (do
not fight user edits)," so the moment the user types a larger number the banner says "Funds arrived"
while the branch below says "You only have ≈ X available" (`BetModal.tsx` 587–591) — two
contradictory claims in one modal. **Fix:** derive the banner from a **balance delta observed during
this return's poll window** (snapshot on mount, compare on each `refreshNonce` tick — `[id].tsx` 186,
298), not from a comparison against a URL param; and recompute or drop it against the live
`betAmountNum` (`BetModal.tsx` 103) rather than the param. If no delta is observed, row 3 of the
state table applies.

**MF-3 — `clearJWT` on unmount breaks the flow it is meant to protect, and breaks other tabs.**
The review's patch (`clearJWT` on BetModal unmount, retained in §6.2) collides with a **full-page
redirect**: the Coinbase/MoonPay navigation unmounts BetModal, so cleanup can delete the token before
the return ever reads it, and the MF-1 precondition would then always fail. Cross-tab, one tab's
close wipes another tab's mid-flight mission token (`onrampJWT` is one global key,
`useOnrampJWT.tsx` 41, 77, 152–156). **Fix:** namespace the storage key per flow
(`onrampJWT:deprize`) instead of clearing a shared one. That solves the mission-collision the review
was worried about, removes the unmount hazard, and makes two tabs independent. Clear on explicit
user dismissal and after a successful bet — never on unmount.

**MF-4 — The `bettingAllowed` bypass is too broad.** §6.3 and §9 both say the onramp handler "must
not wait on `bettingAllowed`." But `bettingAllowed` (`[id].tsx` 374–384) is five gates fused into
one boolean: `deprize.bettingOpen`, `market.mintBound`, `mintConfigured`, region, `!tradingHalted`,
`market.stage === Running`. The review's concern was only the region term (a restricted user should
still see the reopened modal and its eligibility message). Discarding the whole boolean buys rows
5–7 of the state table: a user who just spent money is invited to bet into a paused, resolved, or
superseded market, and BetModal has no branch for any of those — the page's `bettingAllowed` check
is what normally prevents the modal from opening at all. **Fix:** split the predicate. Export
something like `marketAcceptsBets` (stage/halt/bound terms only) and have the onramp handler require
that while bypassing region/eligibility. One-line change to the doc, removes three unspecified
states.

**MF-5 — The provider default the review forced invalidated the return-flow timing model, and the
doc did not notice.** §6.3 step 4 polls "every 2–3 s for up to ~2 minutes." That cadence is
calibrated to Coinbase headless Apple Pay, which settles in seconds. The accepted blocker fix makes
**MoonPay** the default for the eligible (non-US) population — and MoonPay's non-card rails settle in
hours, not two minutes. So the default path's modal path is: redirect, come back, poll fruitlessly,
fall into an unspecified state. Accepting a provider change without re-deriving the timing is the
design-judgment miss here. **Fix:** state the expected settlement distribution per provider, make
the poll window a named constant per provider, and specify row 3's terminal copy as the *expected*
MoonPay outcome rather than an error.

### Should-fix

**SF-1 — Provider/chain strategy should be config, not a branch.** §6.2 is `if (Arbitrum) mount
FundOnramp else faucet link`, inline in a 700-line modal. The repo already keys DePrize config by
chain (`DEPRIZE_MINT_ADDRESSES`, `DEPRIZE_FEE_ROUTER_ADDRESSES`). Put a
`FUNDING_STRATEGY_BY_CHAIN: Record<number, { kind: 'onramp' | 'faucet' | 'none'; providers?: …;
faucetUrl?: string }>` in `ui/lib/deprize/` or `const/config.ts` and have BetModal render from it.
A third chain, a provider outage, or a "disable MoonPay in region X" incident then becomes a config
edit and a unit test instead of JSX surgery. This also gives you the **kill switch** §8 lacks:
`kind: 'none'` restores today's copy. `NEXT_PUBLIC_MOCK_ONRAMP` is a screenshot aid, not a rollback.

**SF-2 — Two geo authorities now decide one CTA.** By omitting `defaultProvider`, the design
delegates provider choice to `FundOnramp`'s internal region detection (US → Coinbase, else MoonPay).
That is a *different* geo source from DePrize's restricted list. A user in a sanctions-restricted
non-US jurisdiction is, by that heuristic, "not US" and therefore gets MoonPay offered. The CTA's
visibility gate must be the DePrize eligibility decision — which §6.2's pseudocode does get right
(`!eligibility.allowed → no CTA`) — but the doc should state the invariant: *the provider heuristic
may never be the thing that decides whether funding is offered, only which widget renders once
DePrize has already said yes.*

**SF-3 — Idempotency is under-specified in both directions.** §6.3 step 6 hedges: strip "after the
modal has opened (or after params are copied into React state)." Those are different contracts.
Copy-then-strip immediately is correct and should be stated as the rule; wait-for-open inherits
`useOnrampFlow` 96–102 (forced reopen while the param is present, state-table row 12) and leaves a
refresh window. Also specify a **consumed** marker (JWT id or a `sessionStorage` nonce) so back/forward
(row 13) does not replay the banner, and say that `router.replace` is `shallow` so the once-ref
survives. And drop the copied 500 ms timer: `useOnrampFlow` 104–108 uses it as a hydration guess;
here you already have real conditions (`userAddress`, `!market.loading`) to wait on, so wait on them.

**SF-4 — Clamp and bound `amount` on the way out as well as in.** `parseOnrampReturn`'s
`/^\d+(\.\d+)?$/` accepts `999` and accepts 40-digit decimals that turn into precision garbage
through `Number()`. Inbound, `overCap` precedes the CTA so no oversized bet can be placed — the cap
is not weakened — but `buildOnrampReturnUrl({ amountEth: betAmount || '0.01' })` will happily send a
user off to *purchase* 999 ETH. Clamp to `DEPRIZE_MAX_BET_WEI` in both helpers, and cap the decimal
places (18) and total string length.

**SF-5 — Nothing tells the user what they just bought.** The doc's legal reasoning ("onramp is
funding a wallet, not placing a bet," §5 F1) is right and is exactly why the *user* needs to be told:
they may buy ETH and then be refused the bet (ineligible, cap, market closed), and MoonDAO cannot
refund a third-party purchase. One pre-redirect line — "This buys ETH into your own wallet. It is not
a bet, and MoonDAO cannot reverse it." — with a named owner for the wording. Related, from the design
review: pair this with distinct verbs so PR-C/PR-E's prize-pool donation and PR-F's self-funding are
not two similarly-worded money buttons on one page ("Add funds to your wallet" vs "Donate to the
prize pool").

**SF-6 — §6.4 (index-page BetModals) is YAGNI for this PR.** Retrofitting `RaceMarketCard` and
`LiveDePrizeHero` to build detail-path return URLs adds a cross-page redirect class to a CTA that
§8 admits is *dormant on Arbitrum until a mainnet Touchdown exists*. Ship the onramp only on
`/deprize/<id>`; on the index, leave today's copy plus a "View prize" link. Fewer states, same user
outcome, and it removes the "user lands on a different page than they left" case the doc waves
through as "acceptable."

### Consider

**C-1 — `spendableEth === 0` showing the CTA before any input, with a hardcoded `0.01` prefill,
is a product guess wearing an implementation detail.** Either drop the pre-type CTA or make the
default a named constant with an owner and a rationale.

**C-2 — "Funds arrived" is one sentence for the riskiest affordance in the PR.** Specify the
partial/timeout/stale variants (rows 2–4), whether it survives an amount edit (MF-2), and how it is
announced — it appears without a focus change after a full-page redirect, so screen-reader users get
nothing. It deserves its own subsection, not a clause.

**C-3 — Mock the Arbitrum path so it is exercisable.** `NEXT_PUBLIC_MOCK_ONRAMP` already
short-circuits `CBOnramp`. Extend that so the whole return handler can be driven on a local
Arbitrum-configured fixture; otherwise the only path verified at launch is a faucet hyperlink.

---

## 4. Verifiability — what tests would actually fail

The proposed suite (`ui/cypress/integration/lib/deprize/onramp-return.cy.ts` over
`buildOnrampReturnUrl` / `parseOnrampReturn`) tests string formatting. **No test in it can fail if
the reopen logic is wrong**, because that logic lives in a `useEffect` inside a page component, and
the doc's acceptance criteria for it are browser steps plus screenshots (§7.9) on a path that is
dormant on the production chain. That is not falsifiable.

**Fix:** extract the decision, not just the parsing, into a pure function in `ui/lib/deprize/`:

```
resolveOnrampReturn({
  parsed, jwtPayload, jwtIssuedAtMs, nowMs, userAddress,
  numOutcomes, marketAcceptsBets, spendableEthAtReturn, spendableEthNow, capEth,
}) => { action: 'ignore' | 'strip' | 'open', betIndex?, prefillEth?, fundsArrived?, notice? }
```

Named tests that must fail if the logic is wrong, all runnable under `yarn test:deprize`:

1. `onrampSuccess=true` with **no JWT** → `ignore` (fails today's design; MF-1).
2. JWT address ≠ connected wallet → `strip` + wrong-wallet notice.
3. JWT `timestamp` older than the freshness window → `strip`, no banner (row 4).
4. `outcome` ≥ `numOutcomes`, negative, or non-integer → `strip`, never `open`.
5. `amount` above `capEth` → `open` with `prefillEth` clamped to the cap (SF-4).
6. `marketAcceptsBets === false` (paused / resolved / superseded) → `ignore` + notice, never `open` (MF-4).
7. `spendableEthNow === spendableEthAtReturn` → `fundsArrived: false` regardless of `amount`, including `amount=0.000001` (MF-2).
8. Balance delta observed but short of the amount → `open`, `fundsArrived: false`, shortfall notice (row 2).
9. Second invocation with the same consumed JWT → `ignore` (replay, row 13).
10. `buildOnrampReturnUrl` → `parseOnrampReturn` round-trip is lossless for 18-decimal amounts.

With that, §9's acceptance criteria become checkable statements rather than "confirm in a browser."

## 5. Observability — currently zero

The doc's entire justification is conversion, and it instruments nothing. Post-launch, no one can
answer: are users clicking the CTA, are they reaching the provider, are they coming back, are they
betting after they come back, or is `/api/coinbase/onramp-jwt` quietly 500ing after a key rotation
(`generateJWT` swallows that into a `console.error`, `useOnrampJWT.tsx` 88).

Minimum, using infrastructure the doc's own §10 already names (Upstash Redis counters modeled on
`ui/lib/deprize/complianceStore.ts`, no PII, no raw IPs): day-bucketed counters for
`cta_shown`, `cta_clicked`, `provider_selected:{coinbase|moonpay|faucet}`, `jwt_generate_error`,
`return_received`, `return_rejected:{no_jwt|stale|address|outcome|market_closed}`, `funds_observed`,
`poll_timeout`, and `bet_placed_within_session`. The JWT route is already a server-side chokepoint
that can count "starts" by `context: 'deprize'` for free. Then §8's rollout can state a falsifiable
success criterion — something like "≥X% of CTA clicks reach `funds_observed`" — instead of the
current dormant-until-mainnet non-plan.

---

## 6. Dependency call: must PR-F wait on PR-0?

**Yes.** Not because the CTA's own gate is broken — it is not. The CTA is gated on BetModal's
server-derived `eligibility.allowed` (`BetModal.tsx` 597–604, eligibility effect ~164–201), so a
restricted user reaching the modal today sees the eligibility message and no funding CTA. The
asymmetry is the problem: the CTA inherits the *correct* gate while the path that opens the modal
inherits the *broken* one (`bettingAllowed` → client `region.isRestricted`, `[id].tsx` 374–384), and
PR-F then explicitly instructs the return handler to bypass `bettingAllowed` altogether. On top of
that, PR-F introduces a second, weaker geo authority in `FundOnramp`'s US/non-US provider heuristic
(SF-2), so the only thing standing between a US visitor and a "buy crypto" affordance is one server
eligibility fetch resolving before the render — a fetch that can be slow, can error, and is the same
surface PR-0 exists to stop relying on client-side. Finally, PR-F's entire thesis is a conversion
rate measured over whoever reaches the bet modal; until PR-0 lands, that population includes ~52
restricted jurisdictions, so any launch judgment is measured against a contaminated funnel. PR-0 is a
prop-threading fix, so the ordering cost is close to nothing and the downside it removes is inviting
a restricted user to purchase crypto for a bet that will be refused. Land PR-0 first; PR-F's
library work (`onrampReturn.ts`, `resolveOnrampReturn`, and their tests) can proceed in parallel
since it touches neither file.
