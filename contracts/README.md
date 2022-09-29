# MOONEY smart contracts

## Overview

- [MOONEY Token](./src/tokens/MyToken.sol)
- [Voting Escrow (vMOONEY)](./src/governance/VotingEscrow.vy)
- [MOONEY Airdrop Distributor](./src/distributors/MerkleDistributor.sol)

## Contributing

### Requirements

- foundry
- node v16
- working rpc node (local chain)

### Install Foundry

See https://book.getfoundry.sh/getting-started/installation.html
```
curl -L https://foundry.paradigm.xyz | bash
brew install libusb
foundryup
```

### Local Setup

```zsh
# Install dependencies
yarn install

# Set up environment variables
cp .env.sample .env

# Install Vyper
pip install vyper==0.2.4

# Install Git submodules
forge install

# Compile Solidity and Vyper contracts
yarn compile

# Deploy stack for local development
yarn dev-deploy
```

### Running a node

If you want to test/develop locally, you'll need to run a local node, for example with [Ganache](https://trufflesuite.com/ganache/).

### Testing

[Forge testing guide](https://book.getfoundry.sh/forge/tests.html)
