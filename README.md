# MoonDAO.com Website

[![](https://gray-main-toad-36.mypinata.cloud/ipfs/bafkreifucveibyrj3px25qg7rajl77gkgkrzvtrsno57zo4pbmq3ntazkq)](https://www.moondao.com)

[MoonDAO.com](https://www.moondao.com) is the hub for the Internet's Space Program, where users can become a MoonDAO member by buying $MOONEY, lock to participate in governance, become a Citizen in the Space Acceleration Network, submit proposals, vote, read news and updates, dive into the documentation, and purchase from the Marketplace with unique experiences such as the Ticket to Space sweepstakes or zero gravity astronaut training experiences and offerings from Teams in the Space Acceleration Network. To get started, users can connect their onchain wallet, or create one by email or social login, in order to interact with the MoonDAO smart contracts.

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
