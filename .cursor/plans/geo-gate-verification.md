# Geo-gate verification — DePrize client region gate

**Scope:** read-only verification of the claim that the DePrize prize page's client-side region
gate is wired to the EU/EEA list rather than the DePrize restricted-jurisdiction list.
No product code was changed.

---

## 1. Verdict

**Confirmed** — and slightly broader than claimed: the client gate on both DePrize surfaces is
driven by `isEUCountry`, so the 52 non-EU restricted countries (including the US and its
territories) see fully enabled "Back this team" CTAs and no region notice; separately, the
*server-side* `restricted` prop that *is* computed from `isRestrictedJurisdiction` is passed to
the page and then silently discarded by a page component that accepts no props.

---

## 2. Evidence

### 2.1 The API route returns an EU/EEA flag, not the DePrize list

```24:24:ui/pages/api/geo/country.ts
  return res.status(200).json({ country, restricted: isEUCountry(country) })
```

Its own JSDoc says so explicitly:

```11:13:ui/pages/api/geo/country.ts
 * - `country` is null when the country cannot be determined.
 * - `restricted` is true for EU/EEA visitors, who can browse the site but may
 *   not permanently store personal data on chain (GDPR compliance).
```

`isEUCountry` reads the GDPR set only:

```84:87:ui/lib/geo/index.ts
export function isEUCountry(countryCode: string | null | undefined): boolean {
  if (!countryCode) return false
  return EU_EEA_COUNTRIES.has(countryCode.toUpperCase())
}
```

The hook passes that value straight through as `isRestricted`:

```62:68:ui/lib/geo/useRegionRestriction.ts
  return {
    country: data?.country ?? null,
    isRestricted: Boolean(data?.restricted),
    isLoading: isLoading && data === undefined && !error,
    isError: Boolean(error) && data === undefined,
  }
```

The hook's own contract documents the EU semantics and never claims to cover DePrize's list:

```21:22:ui/lib/geo/useRegionRestriction.ts
  // `isRestricted`, which is only ever true for a *confirmed* EU/EEA/UK
  // country code -- an error here does not mean the visitor is restricted.
```

**Set relationship.** `EU_EEA_COUNTRIES` (`ui/lib/geo/index.ts` 43–79, 35 codes) is character-for-character
the same membership as `GDPR_REGIONS` (`ui/lib/deprize/restrictedJurisdictions.ts` 88–123, 35 codes),
and `GDPR_REGIONS` is one of six sets unioned into `ALL_RESTRICTED`:

```148:155:ui/lib/deprize/restrictedJurisdictions.ts
const ALL_RESTRICTED: ReadonlySet<string> = new Set([
  ...US_AND_TERRITORIES,
  ...COMPREHENSIVE_SANCTIONS,
  ...ELEVATED_SANCTIONS_RISK,
  ...PREDICTION_MARKET_RESTRICTED,
  ...GDPR_REGIONS,
  ...LOCAL_LICENCE_REQUIRED,
])
```

So `isEUCountry(c) ⟹ isRestrictedJurisdiction(c)` holds, but not the converse. The client gate has
**no false positives and 52 false negatives**: `ALL_RESTRICTED` is 87 codes, `EU_EEA_COUNTRIES` is 35,
leaving 52 restricted countries the client gate treats as unrestricted — US, PR, GU, VI, AS, MP, UM;
CU, IR, KP, SY; RU, BY, AF, MM, VE, YE, LY, SO, SS, SD, CD, CF, ML, IQ, LB, NI, ZW; AU, NZ, SG, CA;
CN, HK, MO, JP, KR, TW, IN, PK, BD, ID, MY, TH, VN, PH, TR, AE, SA, QA, KW, BR. The occupied-Ukraine
region match (`restrictedJurisdictions.ts` 176–179) has no client-side counterpart at all.

### 2.2 Consumers of the client `restricted` value on DePrize surfaces

**`ui/pages/deprize/[id].tsx`** — hook call at line 195, then:

```375:384:ui/pages/deprize/[id].tsx
  const bettingAllowed =
    !!deprize?.bettingOpen &&
    market.mintBound &&
    mintConfigured &&
    !!region.country &&
    !region.isRestricted &&
    !region.isLoading &&
    !region.isError &&
    !tradingHalted &&
    market.stage === MarketStage.Running
```

`bettingAllowed` is passed to every competitor card as `bettingOpen`:

```778:779:ui/pages/deprize/[id].tsx
                    bettingOpen={bettingAllowed}
                    tradingHalted={tradingHalted}
```

and the card **does not render the CTA at all** when that is false — it is omission, not a disabled button:

```201:211:ui/components/deprize/DePrizeTeamCard.tsx
        {bettingOpen && !tradingHalted && (
          <StandardButton
            onClick={() => onBet(outcome.index)}
            disabled={busy}
            className="rounded-xl shadow-purple-500/10"
          >
            {!userConnected
              ? 'Connect to back'
              : backLabel ?? (isField ? 'Back the field' : 'Back this team')}
          </StandardButton>
        )}
```

`bettingAllowed` also latches the `?outcome=N` deep link that auto-opens `BetModal`:

```411:412:ui/pages/deprize/[id].tsx
    if (!userAddress || !bettingAllowed) return
    setDeepLinkHandled(true)
```

The region notice — the one PR-D proposes to amend — is gated on the same EU flag:

```815:819:ui/pages/deprize/[id].tsx
        {(region.isRestricted || (!region.isLoading && !region.isError && !region.country)) && (
          <Notice tone="amber">
            Betting isn&apos;t available in your region. You can view odds, cash out and claim.
          </Notice>
        )}
```

**`ui/components/deprize/DePrizeIndexContent.tsx`** — hook at line 34, same defect:

```130:136:ui/components/deprize/DePrizeIndexContent.tsx
  const bettingBlockedReason = region.isRestricted
    ? "Betting on live on-chain markets isn't available in your region."
    : !region.isLoading && !region.isError && !region.country
    ? "Can't verify your region — live betting is disabled until it resolves. Demo markets still work."
    : region.isLoading
    ? 'Checking your region…'
    : undefined
```

That single string is the index's entire geo gate: it renders the banner (164–168) and is threaded
into `LiveDePrizeHero` (259) and every `RaceMarketCard` (278, 307), where it is the sole region term:

```255:256:ui/components/deprize/RaceMarketCard.tsx
  const bettingOpenReal = marketTradable && !bettingBlockedReason
  const bettingEnabled = hasRace && (bound ? bettingOpenReal : true) // demo markets never gate
```

```88:93:ui/components/deprize/LiveDePrizeHero.tsx
  const bettingEnabled =
    !!account &&
    !!deprize?.bettingOpen &&
    !betting.bettingBlockedReason &&
    !bettingBlockedReason &&
    !!market.marketAddress
```

For a US visitor `bettingBlockedReason` is `undefined`, so the index banner is absent and every
card/hero Buy path is open.

### 2.3 The server gate is correct — and its result is thrown away

`getDePrizePageEligibility` does use the DePrize list, and default-denies unknown country:

```38:52:ui/lib/deprize/pageEligibility.ts
export function getDePrizePageEligibility(req: HeaderRequest): DePrizePageEligibility {
  const country = normalizeCountry(getCountryFromHeaders(req))
  const region = getRegionFromHeaders(req)

  if (isNonProdBypassEnabled()) {
    return { restricted: false, country }
  }
  if (!country) {
    return { restricted: true, country: null }
  }
  if (isRestrictedJurisdiction(country, region)) {
    return { restricted: true, country }
  }
  return { restricted: false, country }
}
```

```54:60:ui/lib/deprize/pageEligibility.ts
export function resolveDePrizePageProps(
  req: HeaderRequest,
  res: { setHeader: (name: string, value: string) => void }
): { props: DePrizePageProps } {
  setDePrizePageNoStoreHeaders(res)
  return { props: { restricted: getDePrizePageEligibility(req).restricted } }
}
```

**Both suspicions in the task are confirmed.**

*(a) The page component ignores `props.restricted`.* `DePrizeDetailPage` declares no parameter list,
so the prop is unreachable; it renders a child that re-derives region from the client hook:

```132:139:ui/pages/deprize/[id].tsx
export default function DePrizeDetailPage() {
  return <DePrizeDetailContent />
}

export const getServerSideProps: GetServerSideProps<DePrizePageProps> = async ({
  req,
  res,
}) => resolveDePrizePageProps(req, res)
```

The index page is identical:

```5:10:ui/pages/deprize/index.tsx
export default function DePrizeIndexPage() {
  return <DePrizeIndexContent />
}

export const getServerSideProps: GetServerSideProps<DePrizePageProps> = async ({ req, res }) =>
  resolveDePrizePageProps(req, res)
```

The only surviving effect of `resolveDePrizePageProps` is its side effect — the `no-store` cache
headers (`pageEligibility.ts` 23–31). The `restricted` boolean itself is computed, serialized into
`__NEXT_DATA__`, and never read. `ui/cypress/integration/lib/deprize/page-eligibility.mocha.ts`
tests the function in isolation (lines 17–98), which is why the dead wiring passes CI.

*(b) `DePrizeRestrictedNotice.tsx` has no importer.* A repo-wide search for the identifier returns
only its own definition (`ui/components/deprize/DePrizeRestrictedNotice.tsx:7`) plus two mentions in
`.cursor/plans/pr-design-docs-ux-critique.md`. Its doc comment describes the control that the
`restricted` prop was meant to trigger:

```6:7:ui/components/deprize/DePrizeRestrictedNotice.tsx
/** Shown instead of DePrize market UI when the request country is restricted or unknown. */
export default function DePrizeRestrictedNotice() {
```

It is dead code. There is also no edge fallback: `ui/middleware.ts` matches `/deprize` and
`/deprize/:path*` (lines 19–25) but only enforces the pre-launch password gate (`isGatedPath` /
`isSessionValid`, lines 29–36) — it performs no geo check.

**Documentation mismatch.** `docs/DEPRIZE_JURISDICTIONAL_CONTROLS.md` asserts a control that does
not exist in code:

```43:46:docs/DEPRIZE_JURISDICTIONAL_CONTROLS.md
| Failure | Result |
|---|---|
| Unknown or missing country header | DePrize pages show the location notice. New bets are refused. |
| Listed country or occupied Ukrainian region | Pages show the location notice. A screening request permanently denies the wallet for new participation. |
```

For a listed non-EU country (US included) no location notice is shown anywhere on the page. The
unknown-header row happens to hold, but only by accident of the separate `!!region.country` guard —
not via the `restricted` value.

### 2.4 Server-side bet path fails closed for the US

`BetModal` pre-checks eligibility on open:

```178:180:ui/components/deprize/BetModal.tsx
      const res = await fetch(`/api/deprize/eligibility?wallet=${encodeURIComponent(wallet)}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      })
```

and disables the Buy button on the result (`canSubmitDePrizeBet(… eligibilityAllowed …)`, 611–617;
label `'Betting unavailable'`, 626–627). That is still client-side. The hard stops are below it.

**Stop 1 — `/api/deprize/permit` refuses to sign.** The permit is the only way to obtain the
signature the contract requires, and it runs the real check before signing:

```67:73:ui/pages/api/deprize/permit.ts
  const decision = await runEligibilityChecks(req, wallet, { surface: 'permit' })
  if (!decision.allowed) {
    return res.status(403).json({
      ...decision,
      message: eligibilityMessage(decision.reason),
    })
  }
```

`runEligibilityChecks` derives country/region from trusted edge headers — not from anything the
client sends:

```34:35:ui/lib/deprize/runEligibility.ts
  const country = getCountryFromHeaders(req)
  const region = getRegionFromHeaders(req)
```

```59:68:ui/lib/deprize/runEligibility.ts
  const decision = evaluateEligibility({
    country,
    region,
    wallet: wallet || null,
    isVpnOrProxy: vpn.isVpnOrProxy,
    isSanctioned: sanctions.isSanctioned,
    screeningFailed: vpn.failed || sanctions.failed || denial.failed,
    isDeniedWallet: denial.denied,
    isInsiderWallet: Boolean(validWallet && isInsiderWallet(validWallet)),
  })
```

```56:61:ui/lib/deprize/eligibility.ts
  if (!country) {
    return { allowed: false, reason: 'country-unknown', country: null }
  }
  if (isRestrictedJurisdiction(country, input.region)) {
    return { allowed: false, reason: 'restricted-jurisdiction', country }
  }
```

`'US'` is in `US_AND_TERRITORIES` (`restrictedJurisdictions.ts` 6–14), so `isRestrictedJurisdiction('US')`
is `true` and the route returns 403 with no signature. The wallet address is taken from the verified
session (`walletFromSession`), not from the request body, and the route is wrapped in
`withMiddleware(handler, authMiddleware, rateLimit)` (line 157).

**Stop 2 — on-chain permit verification.** Even with a forged or absent permit:

```290:296:subscription-contracts/src/deprize/DePrizeMint.sol
    function _verifyPermit(uint256 deprizeId, uint256 deadline, bytes calldata signature) internal view {
        address signer = complianceSigner;
        if (signer == address(0)) revert ComplianceSignerUnset();
        if (block.timestamp > deadline) revert PermitExpired(deadline);
        address recovered = ECDSA.recover(hashPermit(msg.sender, deprizeId, deadline), signature);
        if (recovered != signer) revert InvalidPermit(recovered);
    }
```

`bet()` calls it first, before any state change:

```201:203:subscription-contracts/src/deprize/DePrizeMint.sol
    ) external payable nonReentrant {
        _verifyPermit(deprizeId, deadline, signature);
        if (!registry.bettingOpen(deprizeId)) revert BettingClosed(deprizeId);
```

with the intent stated in the NatSpec:

```191:193:subscription-contracts/src/deprize/DePrizeMint.sol
    ///      must cover the 5% slice plus the trade cost. `deadline` + `signature`
    ///      are an EIP-712 `CompliancePermit` from `complianceSigner` over
    ///      `(msg.sender, deprizeId, deadline)` — the UI gate is not enough.
```

The permit binds `msg.sender` (`compliancePermit.ts` 6–12, 45–64), so a permit issued to an eligible
wallet cannot be replayed by a US wallet, and the TTL defaults to 120 seconds (`DEFAULT_PERMIT_TTL_SECONDS`,
line 14). The private key lives only in `DEPRIZE_COMPLIANCE_SIGNER_KEY` server-side (lines 31–37).

The only bypass is `isNonProdBypassEnabled()`, which requires **both** `NEXT_PUBLIC_ENV !== 'prod'`
and `DEPRIZE_ELIGIBILITY_BYPASS === '1'`:

```101:103:ui/lib/deprize/eligibility.ts
export function isNonProdBypassEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENV !== 'prod' && process.env.DEPRIZE_ELIGIBILITY_BYPASS === '1'
}
```

**Conclusion for §5: no US person can place a bet.** Three independent controls (client modal check,
server permit issuance, on-chain signature recovery) each fail closed, and the third is not
client-influenceable.

---

## 3. Behavior table

Assumes a live, tradable market (`bettingOpen`, `mintBound`, `stage === Running`) and production
config (`NEXT_PUBLIC_ENV=prod`, bypass unset).

| Visitor | SSR `restricted` prop | Page renders market UI? | Back CTA rendered/enabled? | Region notice shown? | First hard stop | Bet actually possible? |
|---|---|---|---|---|---|---|
| **(a) US** (`x-vercel-ip-country: US`) | `true` — **discarded** | Yes, in full | **Yes, enabled** (`[id].tsx` 375–384 → `DePrizeTeamCard` 201) | **No** (815 tests `region.isRestricted`, false for US) | `/api/deprize/eligibility` disables the modal's Buy button; the first *server* stop is `/api/deprize/permit` 403 (`permit.ts` 67–73) | **No** |
| **(b) EU** (e.g. `DE`, `GB`) | `true` — discarded | Yes | **No** — CTA not rendered (`isEUCountry` → `isRestricted` true) | **Yes** (815–819) | Client, at the page — the modal is unreachable | No |
| **(c) No/unknown geo** (header absent, `XX`, `T1`) | `true` — discarded | Yes | **No** — blocked by the separate `!!region.country` term, not by `isRestricted` | **Yes** (815, `!region.country` branch) | Client, at the page | No — `evaluateEligibility` also returns `country-unknown` (`eligibility.ts` 56–58) |

Same pattern on `/deprize`: for (a) the banner is absent and `bettingOpenReal` is `true`
(`RaceMarketCard.tsx` 255); for (b) and (c) the banner renders and Buy is closed.

**Side effect specific to (a).** Because the CTA invites the click, a US visitor who connects and
opens the modal triggers `/api/deprize/eligibility` with `surface: 'eligibility'`, and
`restricted-jurisdiction` is a permanent-denial reason:

```51:55:ui/lib/deprize/walletObservations.ts
export function shouldCreatePermanentDenial(
  reason: EligibilityReason
): reason is 'restricted-jurisdiction' | 'sanctioned-wallet' {
  return reason === 'restricted-jurisdiction' || reason === 'sanctioned-wallet'
}
```

`runEligibility.ts` 81–93 then calls `denyWallet` and fires a `wallet-denied` compliance alert. So
the UI gap converts "US visitor browses" into "US visitor's wallet is irreversibly denied and
operations gets paged" — for a click the UI itself solicited. That is alert noise plus an
irreversible denial on a wallet that might later connect from a permitted jurisdiction.

---

## 4. Severity

**Disclosure / UX defect — not a compliance hole.** No control fails: every path that moves value
is gated by `isRestrictedJurisdiction` on server-derived headers, and the terminal control
(`_verifyPermit`) is on-chain and cannot be influenced by the browser. A US person cannot place a
bet. The claim's factual mechanism is right; its implied conclusion — that PRs #1579/#1581 left
US persons able to bet — is not.

That said, this is at the severe end of "disclosure defect", for four reasons:

1. **It is a solicitation surface, not just a missing label.** The page renders `Back Voyager Lunar
   Systems` as a live, styled, clickable CTA to a US visitor. In the frameworks that motivated
   Schedule A, offering or soliciting is itself the regulated act; "they couldn't complete it" is a
   weaker position than "they were never offered it". The only US-facing disclosure before the modal
   is the footer legend (`DePrizeAvailabilityLegend` → `DEPRIZE_AVAILABILITY_LEGEND`,
   `constants.ts` 76–77), which is small grey footer text rather than a gate.
2. **It contradicts a signed-off operations record.** `docs/DEPRIZE_JURISDICTIONAL_CONTROLS.md` 44–46
   states that listed countries "show the location notice". They do not. A compliance document that
   describes a control that is not wired is a distinct problem from the UI gap itself, and the
   quarterly review (lines 72–84) has no item that would catch it.
3. **The intended control exists and was built.** `DePrizeRestrictedNotice` and the `restricted`
   prop are both present and correct; only the two-line join is missing. This is an unfinished
   wiring, not an unconsidered risk — which means it will read badly in any review of the
   hardening work.
4. **It has an irreversible side effect on the affected users' wallets** (see the table note above).

**Which control would fail if the server path were also wrong:** none currently. For completeness,
the single point of failure is `_verifyPermit` — if `complianceSigner` were ever left unset the
contract reverts `ComplianceSignerUnset` (fails closed), and if `DEPRIZE_COMPLIANCE_SIGNER_KEY` were
to leak, permits could be minted off-platform. Both are already checklist items
(`DEPRIZE_JURISDICTIONAL_CONTROLS.md` 113).

---

## 5. Implications for `.cursor/plans/pr-d-forecasts.md`

**The proposed copy amendment did not reach US visitors.** An earlier revision of PR-D (the
"Should-fix — region notice" item, later struck in PR-D §6.6, "Region notice — struck from this PR")
said:

> **Region notice** (~817): change "You can view odds, cash out and claim." to "You can view odds,
> cash out, claim, and submit a free forecast." so QA does not treat the panel as a geo bug.

That notice is `[id].tsx` 815–819, gated on `region.isRestricted || !region.country`. A US visitor
satisfies neither condition, so the amended sentence would have rendered for EU/EEA/UK and
unknown-geo visitors only. The same earlier revision compounded this in two places: §2 described
the page as one that "only disables Buy" for restricted visitors (true for EU, false for the other
52 countries), and text that later sat near the panel-visibility rule instructed the implementer
to "skip `resolveDePrizePageProps` or ignore `restricted`" — advice that entrenched the discarded
prop rather than flagging it. PR-D's 2026-09-16 revision struck both: §2 now describes the
post-PR-0 state, and §6.6, "Where the signal comes from — the page computes it, forecast code only
reads it", states the positive consume model. Cross-document citations here are section + quoted
phrase, matching PR-0 revision-log 7 — inter-document line numbers rot.

**Corrected approach.** PR-D's own goal — forecasts *should* be visible to restricted visitors — is
unaffected: `ForecastPanel` mounts unconditionally and must never gate that mount on the restriction
signal. It consumes `useDePrizeRestricted()` for copy and emphasis only (PR-D §6.6, "Use it **only**
to choose *copy and emphasis*"). What had to change — and what PR-0 now owns — is which value the
*eligibility banner* reads. The notice at 815 and the index's `bettingBlockedReason`
(`DePrizeIndexContent.tsx` 130–136) should be driven by the server-derived DePrize verdict, not by
`region.isRestricted`: thread `props.restricted` from `getServerSideProps` into
`DePrizeDetailContent` (and `DePrizeIndexContent`) and use `restricted || !region.country` in place
of `region.isRestricted || !region.country`, feeding the same combined value into `bettingAllowed`
at line 379–380. That value is already correct for the US, is computed from trusted edge headers,
and — unlike the SWR hook — is available on first paint with no loading flash. PR-D should adopt
whichever value the fix lands on rather than patching the string in place; if PR-D ships first, its
copy change is harmless but simply invisible to the audience it was written for.

---

## 6. Recommended fix scope

**Not implemented, per the task.** The minimal change is confined to the two DePrize page shells and
their content components:

- `ui/pages/deprize/[id].tsx` — accept `DePrizePageProps` in `DePrizeDetailPage` and pass `restricted`
  to `DePrizeDetailContent`; add it to the `bettingAllowed` conjunction (375–384) and to the notice
  condition (815).
- `ui/pages/deprize/index.tsx` / `ui/components/deprize/DePrizeIndexContent.tsx` — same thread-through
  into `bettingBlockedReason` (130–136), which already propagates to `RaceMarketCard` and
  `LiveDePrizeHero` with no changes to those files.
- Decide `DePrizeRestrictedNotice.tsx`'s fate: either mount it for `restricted` visitors (which is
  what `DEPRIZE_JURISDICTIONAL_CONTROLS.md` 44–46 currently claims happens, and would require
  updating that doc if not done) or delete it. Note this choice is in direct tension with PR-D,
  which needs the page body to render for restricted visitors so they can forecast — so the
  in-page notice is the better option and the doc row should be corrected to describe it.
- Optionally deprecate the DePrize surfaces' use of `useRegionRestriction` entirely; its EU semantics
  remain correct for its original callers (`ui/pages/citizen/index.tsx`, `ui/pages/moonbase/index.tsx`),
  which should be left alone.
- Add a regression test asserting that a `US` geo header yields no Back CTA. The existing
  `page-eligibility.mocha.ts` tests the eligibility function in isolation and cannot catch a
  discarded prop, which is exactly how this shipped.

**This belongs in its own PR, not in PR-D.** Three reasons: it touches `bettingAllowed` and the
index's betting gate, which are the hardening surfaces PRs #1579/#1581 established and deserve
review isolated from a forecasts feature; PR-D's reviewers would otherwise be asked to evaluate a
compliance-adjacent change alongside a scoring system; and PR-D's notice-copy edit should land
*after* the gate fix so the amended sentence is written against whatever condition the fix settles
on. Sequencing: land the gate fix first, then rebase PR-D and let it amend the (now correctly
targeted) notice copy as planned.

---

## Files examined

`ui/pages/api/geo/country.ts` · `ui/lib/geo/{index,headers,useRegionRestriction}.ts` ·
`ui/pages/deprize/{index,[id]}.tsx` · `ui/components/deprize/{DePrizeIndexContent,DePrizeTeamCard,DePrizeRestrictedNotice,DePrizeAvailabilityLegend,RaceMarketCard,LiveDePrizeHero,BetModal}.tsx` ·
`ui/lib/deprize/{pageEligibility,restrictedJurisdictions,eligibility,runEligibility,compliancePermit,walletObservations,constants}.ts` ·
`ui/pages/api/deprize/{permit,eligibility}.ts` · `ui/middleware.ts` ·
`subscription-contracts/src/deprize/DePrizeMint.sol` · `docs/DEPRIZE_JURISDICTIONAL_CONTROLS.md` ·
`ui/cypress/integration/lib/deprize/page-eligibility.mocha.ts`

---

## Revision (2026-09-16, post-implementation)

§5 citations into `pr-d-forecasts.md` were rewritten from line numbers (`:238`, "line 22", "line 242")
to section + quoted phrase, matching PR-0 revision-log 7. The panel rule in the same section now
matches PR-D §6.6: mount unconditionally; consume `useDePrizeRestricted()` for copy and emphasis
only; never gate the mount. The original geo-gate finding in §§1–4 is unchanged.
