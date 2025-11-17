## Installation


```bash
git clone --recurse-submodules <repo-URL>
git submodule update --init --recursive
# install foundry
curl -L https://foundry.paradigm.xyz/ | bash
# source shell profile to add then foundryup to path then run
foundryup

# install dependencies
yarn install
forge install
```

## Build Contracts

```bash
forge build
```

## Deploy a contract

```bash
// arbitrum
ETHERSCAN_API_KEY=$ETH PRIVATE_KEY=$PRIVATE_KEY forge script script/Project.s.sol:MyScript --via-ir --rpc-url https://42161.rpc.thirdweb.com/$THIRDWEB_TOKEN --broadcast --verify -vv
// sepolia
ETHERSCAN_API_KEY=$ETH PRIVATE_KEY=$PRIVATE_KEY forge script script/ProjectTeamCreator.s.sol:MyScript --via-ir --rpc-url https://11155111.rpc.thirdweb.com/$THIRDWEB_TOKEN --broadcast --verify -vv
```

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
ETHERSCAN_API_KEY=$ETH forge test --via-ir --fork-url 127.0.0.1:8545 --match-path test/MissionTest.t.sol -vvvv
```
