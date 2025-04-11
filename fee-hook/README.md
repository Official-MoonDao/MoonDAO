# Fee Hook

## Design

- Fee Hook uses [uniswap v4 hooks](https://docs.uniswap.org/contracts/v4/concepts/hooks) to automatically collect liquidity fees and distribute them to vMOONEY holders.
- Pools are registered with the _beforeAddLiquidity callback.
- After swaps, fees are automatically withdrawn once a threshold is hit.
- If the pool is not on the destination chain, the fees are sent to the FeeHook contract on the destination chain using layerzero.
- vMOONEY holders can claim their fees using the withdrawFees function.

## Local Testing
```
# Start local chain. Layerzero is not supported on local chains, so some functions won't work as expected.
anvil --fork-url https://1.rpc.thirdweb.com/$THIRDWEB_TOKEN
forge script script/Anvil.s.sol --rpc-url localhost:8545 --private-key <PK> --broadcast --via-ir -vvvv --verify
```

## Testnet Deployment
```
# Deploy a mock vMOONEY contract, 1 per chain
PRIVATE_KEY=<PK> ETHERSCAN_API_KEY=$SEP forge script script/FakeERC20.s.sol --rpc-url https://11155111.rpc.thirdweb.com/$THIRDWEB_TOKEN --broadcast -vv --verify
...
# Update tokenAddress for that chain in Config.sol

# Deploy the FeeHook contract, 1 per chain
PRIVATE_KEY=<PK> ETHERSCAN_API_KEY=$SEP forge script script/FeeHook.s.sol --rpc-url https://11155111.rpc.thirdweb.com/$THIRDWEB_TOKEN --broadcast -vv --verify
...
# Update hookAddress for that chain in Config.sol

# Set FeeHook contracts as peers for layerzero, 1 per chain
PRIVATE_KEY=<PK> ETHERSCAN_API_KEY=$SEP forge script script/FeeHookConnect.s.sol --rpc-url https://11155111.rpc.thirdweb.com/$THIRDWEB_TOKEN --broadcast -vv --verify
...

# Deploy Pool, 1 per chain
PRIVATE_KEY=<PK> ETHERSCAN_API_KEY=$SEP forge script script/Pool.s.sol --rpc-url https://11155111.rpc.thirdweb.com/$THIRDWEB_TOKEN --broadcast -vv --verify
...

# Execute Swap, on source chain and destination chain
PRIVATE_KEY=<PK> ETHERSCAN_API_KEY=$SEP forge script script/Swap.s.sol --rpc-url https://11155111.rpc.thirdweb.com/$THIRDWEB_TOKEN --broadcast -vv --verify

```
