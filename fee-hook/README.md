# Fee Hook

## Design

- Loosely based on [Uniswap v4 Hooks template](https://github.com/uniswapfoundation/v4-template).
- Fee Hook uses [uniswap v4 hooks](https://docs.uniswap.org/contracts/v4/concepts/hooks) to automatically collect liquidity fees and distribute them to vMOONEY holders.
- Pools are registered with the _beforeAddLiquidity callback.
- After swaps, fees are automatically withdrawn once a threshold is hit.
- vMOONEY holders must call `checkIn` each week to register for rewards.
- After the week ends a single call to `distributeFees` pays out the accrued
  fees proportionally to the checked in holders' current balances.

## Local Testing
```
# Start local chain.
anvil --fork-url https://1.rpc.thirdweb.com/$THIRDWEB_TOKEN
forge script script/Anvil.s.sol --rpc-url localhost:8545 --private-key <PK> --broadcast --via-ir -vvvv --verify
```

## Testnet Deployment
```
# Deploy the FeeHook contract, 1 per chain
PRIVATE_KEY=$PK ETHERSCAN_API_KEY=$SEP forge script script/FeeHook.s.sol --rpc-url https://11155111.rpc.thirdweb.com/$THIRDWEB_TOKEN --broadcast -vv --verify --via-ir --optimize --optimizer-runs 2000 --delay 10 --retries 10

PRIVATE_KEY=$PK ETHERSCAN_API_KEY=$ARB forge script script/FeeHook.s.sol --rpc-url https://421614.rpc.thirdweb.com/$THIRDWEB_TOKEN --broadcast -vv --verify --via-ir --optimize --optimizer-runs 2000 --delay 10 --retries 10
# Update FEE_HOOK_ADDRESSES and TEST_TOKEN_ADDRESSES for each chain in Config.sol

# Deploy Pool, 1 per chain
PRIVATE_KEY=$PK ETHERSCAN_API_KEY=$SEP forge script script/Pool.s.sol --rpc-url https://11155111.rpc.thirdweb.com/$THIRDWEB_TOKEN --broadcast -vv --verify
PRIVATE_KEY=$PK ETHERSCAN_API_KEY=$ARB forge script script/Pool.s.sol --rpc-url https://421614.rpc.thirdweb.com/$THIRDWEB_TOKEN --broadcast -vv --verify

# Execute Swap, on source chain and destination chain
PRIVATE_KEY=$PK ETHERSCAN_API_KEY=$SEP forge script script/Swap.s.sol --rpc-url https://11155111.rpc.thirdweb.com/$THIRDWEB_TOKEN --broadcast -vv --verify --via-ir
PRIVATE_KEY=$PK ETHERSCAN_API_KEY=$ARB forge script script/Swap.s.sol --rpc-url https://421614.rpc.thirdweb.com/$THIRDWEB_TOKEN --broadcast -vv --verify --via-ir

# Withdraw fees
PRIVATE_KEY=$PK ETHERSCAN_API_KEY=$SEP forge script script/WithdrawFees.s.sol --rpc-url https://11155111.rpc.thirdweb.com/$THIRDWEB_TOKEN --broadcast -vv --verify --via-ir
PRIVATE_KEY=$PK ETHERSCAN_API_KEY=$ARB forge script script/WithdrawFees.s.sol --rpc-url https://421614.rpc.thirdweb.com/$THIRDWEB_TOKEN --broadcast -vv --verify --via-ir
```
