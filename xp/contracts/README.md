# XP System Setup Guide

This guide walks you through setting up and using the XP (Experience Points) system for MoonDAO.

## Overview

The XP system consists of:
- **XPManager**: Main contract that manages XP distribution and reward token distribution
- **OwnsCitizenNFT**: Verifier that checks if a user owns a MoonDAO Citizen NFT
- **IXPVerifier**: Interface for creating custom eligibility verifiers

## Prerequisites

1. **MoonDAO Citizen NFT Contract**: Already deployed at your target address
2. **Reward Token**: ERC20 token that users receive when they accumulate enough XP
3. **Forge/Hardhat**: Development environment

## Setup Flow

### Step 1: Environment Setup

Create a `.env` file:
```bash
PRIVATE_KEY=your_deployer_private_key
REWARD_TOKEN_ADDRESS=0x... # Your reward token address
CITIZEN_NFT_ADDRESS=0x... # Your MoonDAO Citizen NFT address
```

### Step 2: Deploy Contracts

#### Option A: Using Foundry Script
```bash
# Deploy using the provided script
forge script scripts/DeployXP.s.sol --rpc-url <your_rpc> --broadcast
```

#### Option B: Manual Deployment
```bash
# 1. Deploy XPManager
forge create XPManager --constructor-args <reward_token_address>

# 2. Deploy OwnsCitizenNFT verifier
forge create OwnsCitizenNFT

# 3. Register verifier (replace with actual addresses)
cast call <xp_manager_address> "registerVerifier(uint256,address)" 1 <verifier_address>
```

### Step 3: Verify Setup

Run the verification script:
```bash
node scripts/SetupXP.js
```

## Usage Examples

### For Users: Claiming XP

```javascript
const { ethers } = require("ethers");

// 1. Connect to contracts
const xpManager = new ethers.Contract(xpManagerAddress, xpManagerABI, signer);
const citizenVerifier = new ethers.Contract(verifierAddress, verifierABI, signer);

// 2. Create context (citizenNFTAddress, xpAmount)
const context = ethers.utils.defaultAbiCoder.encode(
    ["address", "uint256"],
    [citizenNFTAddress, ethers.utils.parseEther("100")]
);

// 3. Check eligibility
const [eligible, xpAmount] = await citizenVerifier.isEligible(userAddress, context);

// 4. Claim XP if eligible
if (eligible) {
    const tx = await xpManager.claimXP(1, context); // conditionId = 1
    await tx.wait();
    console.log("XP claimed successfully!");
}
```

### For Developers: Creating Custom Verifiers

```solidity
contract MyCustomVerifier is IXPVerifier {
    function name() external pure returns (string memory) {
        return "MyCustomVerifier:v1";
    }

    function isEligible(address user, bytes calldata context) 
        external 
        view 
        returns (bool eligible, uint256 xpAmount) 
    {
        // Your custom logic here
        // Decode context as needed
        // Return eligibility and XP amount
    }

    function claimId(address user, bytes calldata context) 
        external 
        pure 
        returns (bytes32) 
    {
        return keccak256(abi.encodePacked(address(this), user, context));
    }

    function validAfter(address user, bytes calldata context) 
        external 
        pure 
        returns (uint256) 
    {
        return 0; // No cooldown, or implement your cooldown logic
    }
}
```

## Contract Addresses

After deployment, you'll have these addresses:
- **XPManager**: `0x...`
- **OwnsCitizenNFT Verifier**: `0x...`
- **Reward Token**: `0x...` (existing)
- **Citizen NFT**: `0x...` (existing)

## XP Reward System

- Users earn XP through various verifiers
- When XP reaches `xpPerReward` (default: 1000), they receive 1 reward token
- XP resets after claiming a reward
- Multiple verifiers can be registered with different condition IDs

## Security Considerations

1. **Access Control**: Add proper access control to `registerVerifier`
2. **Reward Token**: Ensure XPManager has sufficient reward token balance
3. **Verifier Validation**: Validate verifier contracts before registration
4. **Context Validation**: Ensure context data is properly validated in verifiers

## Testing

```bash
# Run tests
forge test

# Test specific verifier
forge test --match-test testOwnsCitizenNFT
```

## Troubleshooting

### Common Issues

1. **"Verifier not found"**: Ensure verifier is registered with correct condition ID
2. **"Already claimed"**: Each claim ID can only be used once
3. **"Not eligible"**: User doesn't meet verifier criteria
4. **"Cooldown not expired"**: Wait for cooldown period to end

### Debug Commands

```bash
# Check verifier registration
cast call <xp_manager> "verifiers(uint256)" 1

# Check user XP
cast call <xp_manager> "xp(address)" <user_address>

# Check claim status
cast call <xp_manager> "usedProofs(bytes32)" <claim_id>
```

## Next Steps

1. Deploy to testnet for testing
2. Add more verifiers for different activities
3. Implement frontend integration
4. Add analytics and monitoring
