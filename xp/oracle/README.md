# Oracle System

This directory contains the refactored oracle system for MoonDAO's XP management.

## Structure

### `index.js` - Core Oracle Utilities
Contains shared utilities and configuration that can be used across different oracle implementations:

- **Configuration**: Environment variables and contract ABIs
- **Core Functions**: 
  - `createSignature()` - Create cryptographic signatures for oracle verification
  - `createContext()` - Generate context data for XP claims
  - `submitClaim()` - Submit XP claims to the blockchain
  - `graphqlQuery()` - Generic GraphQL query function
  - `validateOracleConfig()` - Validate required environment variables
  - `getCurrentTimestamp()` - Get current timestamp in seconds
  - `processBatch()` - Generic batch processing utility

### `VotingPowerOracle.js` - Voting Power Specific Oracle
Implements the voting power oracle that queries Snapshot for user voting power and awards XP based on tiers:

- **Voting Power Queries**: Functions to query Snapshot GraphQL API
- **XP Tier System**: Configurable tiers based on voting power thresholds
- **User Processing**: Process individual users and batch operations
- **Main Runner**: `runOracle()` function for executing the oracle

## Usage

### Running the Voting Power Oracle

```bash
# Set required environment variables
export ORACLE_PRIVATE_KEY="your_private_key"
export XP_MANAGER_ADDRESS="contract_address"
export HAS_VOTING_POWER_VERIFIER_ADDRESS="verifier_address"

# Run the oracle with user addresses
node VotingPowerOracle.js 0x1234... 0x5678... 0x9abc...
```

### Using Core Utilities in Custom Oracles

```javascript
const {
  createSignature,
  createContext,
  submitClaim,
  graphqlQuery,
  validateOracleConfig,
  processBatch,
} = require("./index");

// Validate configuration
validateOracleConfig();

// Process users with custom logic
const results = await processBatch(userAddresses, async (address) => {
  // Your custom oracle logic here
  const data = await yourCustomQuery(address);
  
  if (data.meetsCriteria) {
    const signature = createSignature(address, minValue, xpAmount, timestamp, privateKey);
    const context = createContext(minValue, xpAmount, signature);
    
    return {
      user: address,
      context,
      // ... other data
    };
  }
  
  return null;
});
```

## Environment Variables

- `ORACLE_PRIVATE_KEY` - Private key for signing oracle data
- `XP_MANAGER_ADDRESS` - Address of the XP Manager contract
- `HAS_VOTING_POWER_VERIFIER_ADDRESS` - Address of the voting power verifier contract

## Voting Power Tiers

The voting power oracle uses the following tiers:

- **Small Holder**: 1,000+ VP → 10 XP
- **Medium Holder**: 5,000+ VP → 25 XP  
- **Large Holder**: 10,000+ VP → 50 XP
- **Whale**: 50,000+ VP → 100 XP
- **Mega Whale**: 100,000+ VP → 200 XP

## Benefits of Refactoring

1. **Code Reusability**: Core utilities can be shared across different oracle types
2. **Maintainability**: Centralized configuration and common functions
3. **Extensibility**: Easy to add new oracle types by importing core utilities
4. **Testing**: Core functions can be tested independently
5. **Consistency**: Standardized approach to oracle operations

