# Prediction Markets

Gnosis ConditionalTokens + `LMSRWithTWAP` (Solidity 0.5). Used by DePrize as the
external market layer. Deployed addresses are in
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

After Phase 2, record ConditionalTokens + LMSRWithTWAPFactory and fill
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
INPUT_FILE=LMSRWithTWAPFactory.etherscan.json \
CONTRACT_NAME_OVERRIDE=contracts/LMSRWithTWAPFactory.sol:LMSRWithTWAPFactory \
ETHERSCAN_API_KEY=... node scripts/verify-on-arbiscan.js \
  LMSRWithTWAPFactory 0xb40d77bD8C3D8CF38c4b88D649D397efa2dd2cB8 \
  Fixed192x64Math=0x6cc53E9158aeFd3aB65B1B053844D083C4b7C53b
```

The `.etherscan.json` variant exists because Etherscan splits a contract
identifier on its first colon and Truffle names project-local sources
`project:/contracts/…`. Stripping that prefix changes only the appended
metadata hashes; the build script asserts nothing else moved.

## Provision a DePrize market (Phase 4)

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

Migration 08 prints `conditionId` + LMSR address. **Record `questionId`** — it
is not stored on-chain and resolution cannot be constructed without it.
Then transfer LMSR ownership to the `DePrizeFeeRouter`.

Note: DePrize 1 was provisioned with direct `cast` calls while the `npx truffle`
breakage above was unresolved, so migration 08 has not yet been exercised
against Arbitrum mainnet. Dry-run it on Sepolia before relying on it.
