# MoonDAO App UI

https://moondao.com/

## Run the UI locally

Navigate to the folder of the UI app:
```
cd ui/
```

Install the dependencies:
```
yarn install
```

Add testnet variables to your local development environment:
```
cp .env.testnet .env.local
```

Build:
```
yarn build
```

Lint:
```
yarn lint
```

Start the development server:
```
yarn dev
```

Then open http://localhost:3000 in a browser.

## E2E and Integration Testing
Start the development server:
```
yarn dev
```

Run the end-to-end tests headlessly:
```
yarn cy:run
```

Run the integration (component) tests headlessly:
```
yarn cy:run-ct
```

*This project is tested with [Browser Stack](https://www.browserstack.com/).*
