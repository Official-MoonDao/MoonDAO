# MoonDAO.com Website

[![](https://gray-main-toad-36.mypinata.cloud/ipfs/QmZDpmqsxJwk4x53DkvB3vek1nXFn4GJxGCc94fPBpicuA)](https://www.moondao.com)

[MoonDAO.com](https://www.moondao.com is the hub for the Internet's Space Program, where users can become a MoonDAO member, obtain $MOONEY, stake to participate in governance, submit proposals, vote, read news and updates, dive into the documentation, and interact with the Marketplace for unique experiences such as the Ticket to Space sweepstakes or zero gravity astronaut training experiences. To get started, users can connect their Web3 wallet, or create one by email or social login, in order to interact with the MoonDAO smart contracts.

> [![app](/ui/public/moondao_homepage.png)](https://www.moondao.com)

## File Structure

The code in this repository is structured into two main parts:

```
.
├── contracts # The smart contracts
└── ui        # The user interface (UI) for interacting with the smart contracts
```

## Run the UI locally

See [ui/README.md](ui/README.md)

## Testing against the Mumbai testnet

Add testnet variables to your local development environment:
```
cp .env.testnet .env.local
```

Start the development server:
```
yarn dev
```