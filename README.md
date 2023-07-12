# MoonDAO App 🌕🌕

[![](/ui/public/Original_Black.png)](https://app.moondao.com)

The MoonDAO App at https://app.moondao.com is where people can connect their Ethereum wallet and interact with the MoonDAO smart contracts.

> [![app](/ui/public/screenshot.png)](https://app.moondao.com)

## File Structure

The code in this repository is structured into two main parts:

```
.
├── contracts # The smart contracts
└── ui        # The user interface (UI) for interacting with the smart contracts
```

## Run the UI locally

See [ui/README.md](ui/README.md)

## Testing against the Sepolia Ethereum testnet

Add sepolia testnet variables to your local development environment:
```
cp .env.testnet .env.local
```

Start the development server:
```
yarn dev
```
