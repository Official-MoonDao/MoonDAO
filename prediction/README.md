# Prediction Markets

Gnosis ConditionalTokens + the **unmodified** Gnosis `LMSRMarketMaker` /
`LMSRMarketMakerFactory` (Solidity 0.5, `@gnosis.pm/conditional-tokens-market-makers`
1.8.1). Used by DePrize v2 as the external market layer. There is no MoonDAO
market-maker subclass: the 0.8 glue in `subscription-contracts/src/deprize/`
only calls these audited contracts through interfaces. Deployed addresses are in
`docs/DEPRIZE_ARBITRUM_ADDRESSES.md`.

## Setup
```
npm install
```

Use Node 18 or 20. Truffle's dependency tree builds `leveldown` from source on
newer runtimes and fails there.

Invoke Truffle through `npm run truffle --`, not `npx truffle`. Truffle 5.11.5
publishes `build/cli.bundled.js` without an executable bit, so the `.bin` shim
exits 126 (`Permission denied`); the script runs the bundle through `node` and
sidesteps it.

Requires `PRIVATE_KEY` and (for public networks) an RPC URL. Network config is
committed at `truffle-config.js`. A local (gitignored) `truffle.js` does not
override it — Truffle prefers `truffle-config.js` and warns when both exist —
but it also has no `arbitrum` network, so run mainnet from the committed config.

## Deployment

```shell
# Local
npm run truffle -- migrate --network development --reset

# Arbitrum Sepolia (full stack including a test WETH9)
npm run truffle -- migrate --network arbitrumSepolia

# Arbitrum mainnet — Phase 2 shared infra ONLY (CTF + math + factory).
# Do NOT pass --reset. Do NOT run migration 05 (it would deploy a fake WETH9).
npm run truffle -- migrate -f 2 --to 4 --network arbitrum
```

After Phase 2, record ConditionalTokens + LMSRMarketMakerFactory and fill
`fee-hook/script/base/Config.sol` / `ui/const/config.ts`.

The three Phase 2 artifacts in `build/contracts/` are committed on purpose:
their `networks.42161` entry is what makes migration 02's `overwrite: false`
reuse the live mainnet ConditionalTokens instead of deploying a second one from
a clean checkout. The rest of `build/` is ignored.

## Block-explorer verification

Truffle does not keep its compiler input, so verification rebuilds the solc
standard-JSON from each artifact's embedded metadata and proves it reproduces
the deployed bytecode before uploading anything.

```shell
npm install --no-save --ignore-scripts solc@0.5.1

node scripts/build-verification-input.js ConditionalTokens
ETHERSCAN_API_KEY=... node scripts/verify-on-arbiscan.js \
  ConditionalTokens 0x12DAC07Bf586E06a9bDa32c422864C8Fda43FA29
```

Contracts that link a library pass it as `Name=0xaddress` trailing arguments
rather than in the JSON, so the compiled metadata still matches the unlinked
deployment:

```shell
INPUT_FILE=LMSRMarketMakerFactory.etherscan.json \
CONTRACT_NAME_OVERRIDE=@gnosis.pm/conditional-tokens-market-makers/contracts/LMSRMarketMakerFactory.sol:LMSRMarketMakerFactory \
ETHERSCAN_API_KEY=... node scripts/verify-on-arbiscan.js \
  LMSRMarketMakerFactory 0x<stock-factory> \
  Fixed192x64Math=0x6cc53E9158aeFd3aB65B1B053844D083C4b7C53b
```

The `.etherscan.json` variant exists because Etherscan splits a contract
identifier on its first colon and Truffle names project-local sources
`project:/contracts/…`. Stripping that prefix changes only the appended
metadata hashes; the build script asserts nothing else moved.

## Provision a DePrize market (v2)

```shell
DEPRIZE_ORACLE=0x<admin-safe> \
DEPRIZE_NUM_OUTCOMES=<N> \
DEPRIZE_QUESTION_ID=0x<unique-bytes32> \
DEPRIZE_CTF=0x<phase2-ctf> \
DEPRIZE_WETH=0x82aF49447D8a07e3bd95BD0d56f35241523fBab1 \
DEPRIZE_FACTORY=0x<phase2-factory> \
DEPRIZE_FUNDING_PER_OUTCOME=<wei> \
npm run truffle -- migrate -f 8 --to 8 --network arbitrum
```

`DEPRIZE_ORACLE` must be the **admin Safe**: it is baked into the conditionId as
the only address that can `reportPayouts`, and migration 08 also transfers the
market's ownership to it (`pause` / `close` / `withdrawFees` are onlyOwner). No
contract sits between the Safe and the market in v2.

Migration 08 prints `conditionId` + LMSR address. **Record `questionId`** — it
is not stored on-chain and resolution cannot be constructed without it. Then
wire the 0.8 side with `subscription-contracts/script/deprize/DePrizeWire.s.sol`
and verify with `DePrizeVerify.s.sol`.

The fee sweep that `DePrizeFeeRouter` used to perform on-chain is now a Safe
batch built by `subscription-contracts/script/deprize/DePrizeSweepFees.s.sol`.

Note: the v1 `LMSRWithTWAP` subclass and its factory were removed with DePrize
v2 (see `docs/DEPRIZE_SECURITY_AUDIT.md`, H-01). Markets created by the old
factory are not compatible with the v2 mint and must not be bound to it.
