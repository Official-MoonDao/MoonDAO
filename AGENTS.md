# AGENTS.md

## Cursor Cloud specific instructions

This monorepo's primary product is the `ui/` Next.js 13 (Pages Router) web app for
[moondao.com](https://moondao.com). The Solidity packages (`contracts/`, `fee-hook/`,
`prediction/`, `subscription-contracts/`, `xp/`) and services (`dispatcher/`,
`townhall-summarizer/`, `tui/`) are separate and are not covered by the Cloud Agent
environment setup below. Default to `ui/` unless another package is explicitly named.

Standard commands live in `ui/README.md` and `ui/package.json` scripts; the notes here only
capture the non-obvious gotchas discovered during setup.

### Node version
- Use the environment's default Node (currently Node 22 via `/exec-daemon/node`). The dev
  server, `yarn install`, and the mocha unit tests all run fine on it, so no version switching
  is needed for normal development. (CI builds on Node 20 and the lint workflow uses Node 18,
  but neither is required locally.)
- `nvm` is present, but `/exec-daemon/node` is earlier in `PATH` than nvm's shims, so `node`
  always resolves to the exec-daemon Node regardless of `nvm use`/`nvm alias default`. To force
  a specific version, prepend its bin explicitly, e.g.
  `export PATH="$(dirname "$(nvm which 20)"):$PATH"`.

### Environment variables (IMPORTANT — app will not render without real secrets)
- The dev server reads `ui/.env.local`. Seed it from the checked-in template:
  `cp ui/.env.testnet ui/.env.local`.
- `ui/lib/thirdweb/client.ts` throws at module load unless `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`
  is set, and `PrivyProvider` in `ui/pages/_app.tsx` wraps the whole app and **hard-validates
  `NEXT_PUBLIC_PRIVY_APP_ID` against Privy's servers** — an invalid/placeholder value throws
  "Cannot initialize the Privy provider with an invalid Privy app ID" and 500s **every page**.
  These are not in the `.env.testnet` template. To render any UI page you must supply real
  values for at least `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` and `NEXT_PUBLIC_PRIVY_APP_ID` (see
  `.github/workflows/ci.yml` for the full set of runtime secrets the app uses).
- Without those secrets you can still: run the dev server (it compiles and boots), hit API
  routes that don't need external creds (e.g. `POST /api/revalidate`), and run the offline
  mocha unit tests. On-chain reads log `401 Unauthorized: invalid project id` from thirdweb
  when the client id is a placeholder.
- `.env.local` is gitignored — never commit secrets.

### Lint is pre-existing broken (non-gating)
- `yarn lint` fails at plugin load with ``[[GeneratorState]]` is not present on `O``. This is a
  bug in the pinned `eslint-plugin-jsx-a11y` + `es-iterator-helpers@1.0.19` deps (thrown when
  `Iterator.prototype.filter` runs inside `isInteractiveElement.js`), and it reproduces on Node
  18, 20, and 22 — it is not an environment or setup problem. CI does not gate on it:
  `.github/workflows/ci.yml` has no lint step and `.github/workflows/autofix.yml` runs
  `yarn lint --fix || true`. Don't try to "fix the environment" for this.

### Tests
- Fast offline unit tests (mocha + ts-node, no browser/secrets):
  `cd ui && yarn test:deprize` and `yarn test:cypress-unit`.
- Cypress component tests (`yarn cy:run-ct`) start their own dev server and need the Cypress
  binary (`npx cypress install`); many specs also need the runtime secrets above.
- Cypress E2E (`yarn cy:run`) runs against BrowserStack (`ui/browserstack.json`) and requires
  BrowserStack credentials — not runnable purely locally.

### Running the app
- `cd ui && yarn dev`, then open http://localhost:3000. First compile of a route is slow
  (tens of seconds) because the dependency graph (thirdweb/wagmi/three.js) is large; this is
  normal for dev mode, not a hang.
