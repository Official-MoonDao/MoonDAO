## Installation

`git clone --recurse-submodules <repo-URL>`
`git submodule update --init --recursive`

```sh
forge install
```

## Deploy a contract

`PRIVATE_KEY=<PRIVATE_KEY> forge script script/Project.s.sol:MyScript --via-ir --rpc-url https://arb1.arbitrum.io/rpc --broadcast --verify -vv`

### Running tests on test chain

1. `forge test -vv`
2. `forge test --match-path test/EntityERC5643Test.t.sol -vv`

`source .env`
`forge test --via-ir --fork-url $SEPOLIA_RPC_URL --match-path test/EntityTest.t.sol -vv`
`forge script script/Project.s.sol:MyScript --via-ir --rpc-url $SEPOLIA_RPC_URL --broadcast --verify -vv`

### Running tests locally

```bash
# Set up local chain forked off eg Sepolia
anvil --fork-url https://11155111.rpc.thirdweb.com/${THIRDWEB_CLIENT_ID}

# Run tests
ETHERSCAN_API_KEY="Y9MZ685PVCHY686V7MKFQXS8Z9Z6WTY4GZ" forge test --via-ir --fork-url 127.0.0.1:8545 --match-path test/ProjectTest.t.sol -vvvv
```
