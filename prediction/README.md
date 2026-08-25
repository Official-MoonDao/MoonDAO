# Prediction Markets

Gnosis ConditionalTokens + `LMSRWithTWAP` (Solidity 0.5). Used by DePrize as the
external market layer. See `docs/DEPRIZE_ARBITRUM_LAUNCH.md`.

## Setup
```
npm install
```

Requires `PRIVATE_KEY` and (for public networks) an RPC URL. Network config is
committed at `truffle-config.js` (do not add a local `truffle.js` — it overrides).

## Deployment

```shell
# Local
npx truffle migrate --network development --reset

# Arbitrum Sepolia (full stack including a test WETH9)
npx truffle migrate --network arbitrumSepolia

# Arbitrum mainnet — Phase 2 shared infra ONLY (CTF + math + factory).
# Do NOT pass --reset. Do NOT run migration 05 (it would deploy a fake WETH9).
npx truffle migrate -f 2 --to 4 --network arbitrum
```

After Phase 2, record ConditionalTokens + LMSRWithTWAPFactory and fill
`fee-hook/script/base/Config.sol` / `ui/const/config.ts` (plan 1.5).

## Provision a DePrize market (Phase 4)

```shell
DEPRIZE_ORACLE=0x<admin-safe> \
DEPRIZE_NUM_OUTCOMES=<N> \
DEPRIZE_QUESTION_ID=0x<unique-bytes32> \
DEPRIZE_CTF=0x<phase2-ctf> \
DEPRIZE_WETH=0x82aF49447D8a07e3bd95BD0d56f35241523fBab1 \
DEPRIZE_FACTORY=0x<phase2-factory> \
DEPRIZE_FUNDING_PER_OUTCOME=<wei> \
npx truffle migrate -f 8 --to 8 --network arbitrum
```

Migration 08 prints `conditionId` + LMSR address. **Record `questionId`** — it
is not stored on-chain and resolution cannot be constructed without it.
Then transfer LMSR ownership to the `DePrizeFeeRouter` (plan Phase 4 step 3).
