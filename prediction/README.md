# Prediction Markets


## Setup
```
npm install
```

## Deployment
```shell
# Deploy to local network
npx truffle migrate --network development --reset
# Deploy to arbitrum sepolia
npx truffle migrate --network arbsep --reset
# Deploy to arbitrum
npx truffle migrate --network arbitrum --reset
```

## Deploying new markets
```shell
# Update questionId and numOutcomes in markets.config.js
npx truffle migrate --network arbitrum --reset
```
