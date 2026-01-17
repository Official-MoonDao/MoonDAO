## Installation

```bash
git clone --recurse-submodules <repo-URL>
git submodule update --init --recursive
# install foundry
curl -L https://foundry.paradigm.xyz/ | bash
# source shell profile to add then foundryup to path then run
foundryup

# install dependencies
npm install --legacy-peer-deps
forge install
```

## Build Contracts

```bash
forge build --via-ir --optimize
```

## Set up a development wallet
```
# create a new wallet for development via eg Metamask, copy private key
vim ~/.bash_profile

# append to .bash_profile
export PRIVATE_KEY="0x..."

source ~/.bash_profile
```

## Set up etherscan key for verifying contracts
```
# go to etherscan.io and make an account, go to API Dashboard, and make a new API key
vim ~/.bash_profile

# append to .bash_profile
export ETHERSCAN_API_KEY="..."

source ~/.bash_profile
```

## Deploy a contract

```bash
// arbitrum
ETHERSCAN_API_KEY=$ETHERSCAN_API_KEY PRIVATE_KEY=$PRIVATE_KEY forge script script/Project.s.sol:MyScript --via-ir --rpc-url https://42161.rpc.thirdweb.com/$THIRDWEB_CLIENT_ID --broadcast --verify -vv --optimize
// sepolia
ETHERSCAN_API_KEY=$ETHERSCAN_API_KEY PRIVATE_KEY=$PRIVATE_KEY forge script script/CitizenTableV2.s.sol:MyScript --via-ir --rpc-url https://11155111.rpc.thirdweb.com/$THIRDWEB_CLIENT_ID --broadcast --verify -vv --optimize
```

### Running tests 

```bash
# Set up local chain forked off eg Sepolia (replace 11155111 with a different chain id if desired)
anvil --fork-url https://11155111.rpc.thirdweb.com/$THIRDWEB_CLIENT_ID

# Run all tests
ETHERSCAN_API_KEY=$ETH forge test --via-ir --fork-url localhost:8545

# Run a specific test
ETHERSCAN_API_KEY=$ETH forge test --via-ir --fork-url localhost:8545
--match-path test/MissionTest.t.sol -vvvv
```

