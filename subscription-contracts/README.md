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
# Set up local chain
anvil

# Deploy juicebox to local chain (requires npm >= 20.0.0)
git clone https://github.com/Bananapus/nana-core
cd nana-core
npm ci && forge install
awk '/^\[rpc_endpoints\]$/ {print; print "local = \"http://127.0.0.1:8545\""; next} 1' foundry.toml > temp && mv temp foundry.toml # add local chain to foundry.toml
PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" npx sphinx deploy script/Deploy.s.sol --network local --confirm # private key is the default anvil key, not a secret

# Deploy tableland to local chain
git clone https://github.com/tablelandnetwork/evm-tableland.git
cd evm-tableland
npx hardhat run scripts/deploy.ts --network localhost

# Run tests
ETHERSCAN_API_KEY="Y9MZ685PVCHY686V7MKFQXS8Z9Z6WTY4GZ" forge test --via-ir --fork-url 127.0.0.1:8545 --match-path test/ProjectTest.t.sol -vvvv
```
