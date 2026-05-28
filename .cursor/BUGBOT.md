# Bugbot Review Guide — MoonDAO

Project-specific review rules for the MoonDAO monorepo. Prioritize **security**,
**correctness of money/on-chain logic**, and **consistency with existing
patterns** over style nits. Lead reviews with the highest-severity issues and
keep comments concise and actionable.

## Repo layout & stack

- `ui/` — Next.js (Pages Router) app. API routes live in `ui/pages/api/**`.
  Frontend uses React, Tailwind, **Privy** (auth/wallet), **thirdweb v5**
  (`getContract`/`readContract`), **NextAuth**, **Tableland**, **Upstash Redis**,
  and Coinbase Onramp. Tests are **Cypress** (component + e2e).
- `xp/` — Foundry/Solidity contracts (OpenZeppelin). `xp/lib/**` is vendored
  dependencies — **do not review or flag anything under `**/lib/**`,
  `node_modules/**`, or generated/ABI files in `const/abis/**`.**
- `const/` — shared config: contract `*_ADDRESSES` keyed by chain slug, ABIs.
- Other top-level packages (`dispatcher/`, etc.) are secondary.

## Security — API routes (`ui/pages/api/**`)

- **Auth:** Routes that read or mutate user-specific data must be wrapped with
  `withMiddleware(handler, authMiddleware, ...)`. Flag any new authenticated-data
  route that is exported as a bare `handler` without `authMiddleware` (or the
  role middlewares `isOperator` / `isExecutive` / `isEBManager` where privileged).
- **Privileged actions** (treasury, EB rewards, role-gated mutations) must use the
  appropriate role middleware, not just `authMiddleware`.
- **Secrets:** Never log or return secrets, access tokens, private keys, or full
  upstream API responses to the client. Flag returning a raw third-party response
  body (e.g. `raw: data`) to the browser.
- **Access tokens in URLs:** Flag passing Privy access tokens, JWTs, or API keys
  as query-string parameters (`?accessToken=...`). They leak into logs, proxies,
  and browser history — use POST bodies or `Authorization` headers. Prefer
  reading auth from the request, not from client-supplied query params.
- **Env vars:** Anything prefixed `NEXT_PUBLIC_` is exposed to the browser. Flag
  server-only secrets (HSM tokens, private keys, `IRON_SESSION`, Redis tokens)
  that are accidentally referenced via a `NEXT_PUBLIC_` name or sent client-side.
- **Region / eligibility gates:** Server-side gates must **default-deny** when the
  signal is missing. Flag patterns like `getCountryFromHeaders(req) || 'US'` that
  default to *allow* on missing geo headers, especially for region-restricted
  features (e.g. US-only onramp).
- **Caching headers:** Public, expensive read endpoints (on-chain / Etherscan
  fan-out) should set `Cache-Control` / `s-maxage`. Prod rate limiting via the
  `rateLimit` middleware only runs when `NEXT_PUBLIC_ENV === 'prod'` — don't
  assume it protects you in other environments.

## Security — frontend & cross-origin

- **`postMessage` handlers:** Flag `window.addEventListener('message', ...)`
  handlers that act on the payload without validating `event.origin` (against an
  allowlist) and/or `event.source === iframeRef.current?.contentWindow`. This is
  especially critical when a message triggers a payment-success, balance, or
  on-chain side effect — those paths are spoofable without origin checks.
- **Payment / value-transfer success:** Do not treat a client-side signal
  (postMessage, redirect query param) as proof a payment settled. Money-movement
  success should be confirmed server-side (e.g. poll the order/tx by id) before
  firing on-chain transactions or crediting the user.
- **iframes:** Review `sandbox`, `allow`, and `referrerPolicy` attributes when
  embedding third-party payment/auth frames — over-restrictive sandboxes can
  silently break popups/Apple Pay, and stripping the referrer can break the
  embedding provider's domain validation. Confirm the committed attributes match
  the intended behavior described in the PR.

## Web3 / on-chain & financial correctness

- **Chain config:** Contract addresses come from `*_ADDRESSES[chainSlug]` in
  `const/config`. Flag hardcoded contract addresses or chain IDs that bypass this.
- **Unit math:** Watch for wei↔ETH conversions (`/ 1e18`), `pricePerSecond`
  scaling, and `BigInt`→`Number` precision. Flag mismatched time bases (e.g. a
  30-day "month" that's later multiplied by 12 to imply an annual figure, or
  mixing 365 vs 365.25 day-years).
- **Magic constants:** Flag duplicated financial constants (e.g. `TEAM_DISCOUNT`
  / `TEAM_PRICE_DISCOUNT = 0.067`) copied across files with only a "keep in sync"
  comment — they should be exported from one module and imported.
- **Silent fallbacks:** Flag `catch {}` blocks that swallow errors and return
  hardcoded/fabricated values (prices, counts, revenue) without logging AND
  without signaling to the consumer that the data is estimated/stale. For
  auditable EB/treasury endpoints this is a correctness hazard.
- **Price = 0:** When an ETH/USD price fetch can return `0` on failure, flag
  downstream `*USD` fields that would silently become `$0` instead of erroring.
- **Concurrency & caching:** Flag concurrent calls (`Promise.all`) into a
  memoized fetcher that lacks in-flight deduplication — on a cold cache they
  issue duplicate upstream requests (and can trip API rate limits). Comments
  claiming "no extra API calls" should match the actual dedup behavior.

## React / frontend correctness

- Flag `useEffect` hooks with missing/incorrect dependencies, missing cleanup
  (event listeners, timers, `cancelled` guards on async setState), and state
  updates after unmount.
- Flag dismiss/notice UI whose state lives only in `useState` when it should
  persist (e.g. `localStorage`) — otherwise it reappears on every remount.
- Avoid `parseInt` without a radix; avoid `parseFloat` on untrusted input without
  `Number.isNaN` guards.
- Reuse existing helpers (e.g. `generatePrettyLinkWithId`, network-name mappers)
  rather than re-deriving the same logic inline; flag obvious duplication.

## Testing

- New API routes and non-trivial pure logic (validation, parsing, on-chain math)
  should have unit/component coverage. Prefer extracting pure helpers (the repo
  does this, e.g. `headlessOrder.ts`, `headlessEvents.ts`) so they're testable
  without React/Next. Flag complex new logic added with no corresponding test.

## Noise control — do NOT flag

- Files under `**/lib/**` (vendored), `node_modules/**`, `const/abis/**`,
  `**/*.json` ABIs, build output (`.next/`), or Cypress fixtures.
- Pure formatting/whitespace, import ordering, or subjective naming preferences.
- Pre-existing issues unrelated to the PR diff.
- Restating what the code obviously does — only comment when there's a real risk,
  bug, or concrete improvement.
