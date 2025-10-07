# MoonDAO.com Website

[![](https://gray-main-toad-36.mypinata.cloud/ipfs/bafybeifj47o7trhnktsabduwuzbfodldot5es4dfhxajodup4kqgx2bntm)](https://www.moondao.com)

[MoonDAO.com](https://www.moondao.com) is the hub for the Internet's Space Program, where users can become a MoonDAO member by buying $MOONEY, lock to participate in governance, become a Citizen in the Space Acceleration Network, submit proposals, vote, read news and updates, dive into the documentation, and purchase from the Marketplace with unique experiences such as the Ticket to Space sweepstakes or zero gravity astronaut training experiences and offerings from Teams in the Space Acceleration Network. To get started, users can connect their onchain wallet, or create one by email or social login, in order to interact with the MoonDAO smart contracts.

> [![app](/ui/public/moondao_homepage.png)](https://www.moondao.com)

## File Structure

```
.
├── contracts            # Core smart contracts and deployment scripts
├── dispatcher           # Event processing and pipeline orchestration system
├── docs                 # Documentation files
├── fee-hook             # Uniswap V4 fee hook implementation
├── prediction           # Prediction market contracts and migrations
├── subscription-contracts Network and governance contracts
├── ui                   # The user interface (UI) for interacting with the smart contracts
└── xp                   # Experience points system contracts
```

## Run the UI locally

See [ui/README.md](ui/README.md)

## Testing against the Sepolia testnet

Add testnet variables to your local development environment:
```
cp .env.testnet .env.local
```

Start the development server:
```
yarn dev
```
