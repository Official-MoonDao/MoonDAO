# Access gate — moonbase and DePrize

`/moonbase`, `/deprize` and `/deprize-play` ship in the repository but are not
ready to be public. A shared password gates them so the code can merge to `main`
without the pages being reachable.

## Setting it up

Two server-side variables:

```
MOONBASE_GATE_PASSWORD=<the password you hand to people>
MOONBASE_GATE_TOKEN=<long random string, e.g. `openssl rand -hex 32`>
```

The password is what a person types into the form. The token is unrelated to it
and becomes the value of their session cookie — it never appears in the form and
nobody needs to know it. They are separate so that neither has to be the other:
a cookie travels in every request header and is stored on disk by the browser,
so putting the password in one would spread it around. It also means either can
be rotated on its own.

`MOONBASE_GATE_TOKEN` must be at least 24 characters. A shorter one is treated
as unconfigured, because it is the value actually holding the gate shut.

Set both in **two** places, and nowhere else:

1. The deployment environment (Vercel → Project → Settings → Environment
   Variables), for each environment you want reachable — Production, Preview and
   Development are configured separately.
2. Each developer's `ui/.env.local`, which is untracked (`.gitignore` covers
   `.env*`).

Neither value may be committed. They are deliberately **absent** from
`.env.mainnet` and `.env.testnet`, which are tracked files — even a placeholder
line there is an invitation for someone to fill in the real value and push it.
The variable *names* are declared for type-checking in `ui/env.d.ts`, which
holds names only.

There is no default and no fallback. **If either variable is unset, the gated
routes are closed to everybody**, including the team. That is the intended
failure: a deploy that forgets the configuration locks the pages rather than
publishing them.

## Changing or revoking access

Change `MOONBASE_GATE_TOKEN` and redeploy — every existing cookie stops working
at once and everyone signs in again. Change `MOONBASE_GATE_PASSWORD` to alter
what gets them back in. There is no per-person revocation; this is one shared
secret, not user accounts.

## How it works

- `ui/middleware.ts` runs on every request to a gated route and checks the
  cookie against `MOONBASE_GATE_TOKEN`. No cookie, or the wrong one, and it
  redirects to `/gate?next=…`.
- `ui/pages/gate.tsx` is the form. It posts to `/api/gate`.
- `ui/pages/api/gate.ts` compares the submitted password against
  `MOONBASE_GATE_PASSWORD` and, on success, sets an `HttpOnly` cookie holding
  the token.
- `ui/lib/gate/access.ts` holds the shared pieces: the gated prefixes, the
  constant-time comparison, and the fail-closed checks.

The check has to happen on the server. A gate evaluated in the browser needs its
secret in the JavaScript bundle, which makes it public — that is why there is no
`NEXT_PUBLIC_` variable here, and why the comparison lives in an API route
rather than in the page.

Comparisons use `constantTimeEquals`, which walks both strings in full rather
than returning early, so a rejection does not time out the length of the secret.

## What the gate does not cover

- **On-chain state.** DePrize markets live on Arbitrum. Gating the pages hides
  the interface, not the contracts: anyone with the addresses can interact
  directly. If the concern is that real money should not be at stake yet, that
  has to be settled on-chain, not here.
- **Anything already public.** Routes outside the three prefixes are untouched.
  Navigation still links to the gated pages; visitors reach the password form
  rather than a 404.
- **Sharing.** One password among several people is exactly as private as the
  least careful of them.

## Adding a route to the gate

Add the prefix to `GATED_PREFIXES` in `ui/lib/gate/access.ts` **and** to the
`matcher` in `ui/middleware.ts`. Next requires that matcher to be a static
literal it can read at build time, so it cannot import the list. A unit test in
`cypress/integration/unit/access-gate.cy.ts` fails if the two drift apart.
