# MoonDAO App UI

https://app.moondao.com

## Run the UI locally

Navigate to the folder of the UI app:
```
cd ui/
```

Install the dependencies:
```
yarn install
```

Add variables to your local development environment:
```
cp .env.sepolia .env.local
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

Then open http://localhost:42069 in a browser.

## Integration Testing

Run the integration tests:
```
yarn cypress
```

Run the integration tests headlessly:
```
yarn cypress:headless
```
