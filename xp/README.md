# XPManager - Pure XP (Experience Points) System

The XPManager is a smart contract system that allows users to earn XP (Experience Points) from various verifiers for gamification purposes. This is a pure XP system with no token rewards to avoid legal concerns.

## Overview

This system implements a pure XP-based gamification system where:

1. **Users gain XP** from different verifiers
2. **Each verifier can assign different amounts** of XP
3. **Pure gamification**: No token rewards, just XP for engagement tracking
4. **Legal compliance**: No financial incentives for voting or participation
5. **Flexible verifier system**: Pluggable verifiers for different activities

## Key Features

### XP System
- Users accumulate XP from various verifiers
- Each verifier can assign different XP amounts
- XP is permanent and accumulates over time
- Pure gamification with no financial rewards

### Verifier System
- Pluggable verifier contracts
- Each verifier can implement different eligibility criteria
- Verifiers are registered with unique IDs
- No cooldown requirements (configurable per verifier)

### Legal Compliance
- **No token rewards**: Eliminates legal concerns about rewarding voters
- **Pure gamification**: XP serves only as engagement tracking
- **Transparent**: All XP earning is public and verifiable
- **Flexible**: Can be used for various community activities

## Contract Architecture

### XPManager.sol
Main contract that manages:
- User XP tracking
- Verifier registration
- XP distribution
- Claim prevention (no double-claiming)

### IXPVerifier.sol
Interface for verifier contracts that:
- Check user eligibility
- Return XP amounts
- Generate unique claim IDs
- Handle cooldowns (optional)

### OwnsCitizenNFT.sol
Example verifier that:
- Checks if user owns a MoonDAO Citizen NFT
- Awards configurable XP
- No cooldown period

## Usage

### For Users

1. **Claim XP**
```solidity
// Context: Citizen NFT address + XP amount
bytes memory context = abi.encode(citizenNFTAddress, 25);
xpManager.claimXP(1, context);
```

2. **Check Total XP**
```solidity
uint256 totalXP = xpManager.getTotalXP(userAddress);
```

### For Verifier Developers

Create a new verifier by implementing `IXPVerifier`:

```solidity
contract MyVerifier is IXPVerifier {
    function name() external pure returns (string memory) {
        return "MyVerifier:v1";
    }
    
    function isEligible(address user, bytes calldata context) 
        external view returns (bool eligible, uint256 xpAmount) {
        // Your eligibility logic here
        // Return XP amount if eligible
    }
    
    function claimId(address user, bytes calldata context) 
        external pure returns (bytes32) {
        return keccak256(abi.encodePacked(address(this), user, context));
    }
    
    function validAfter(address user, bytes calldata context) 
        external pure returns (uint256) {
        return 0; // No cooldown
    }
}
```

### For Administrators

1. **Register Verifiers**
```solidity
xpManager.registerVerifier(verifierId, verifierAddress);
```

## Deployment

### Prerequisites
- Deployer private key
- Network configuration

### Environment Variables
```bash
export PRIVATE_KEY="your_private_key"
```

### Deploy
```bash
forge script script/DeployXPManager.s.sol --rpc-url <RPC_URL> --broadcast
```

## Testing

Run the test suite:
```bash
forge test
```

Key test scenarios:
- XP earning and accumulation
- Verifier registration and usage
- Access control (owner-only functions)
- Event emissions
- Multiple user scenarios
- Claim prevention (no double-claiming)

## Events

The contract emits events for tracking:

- `XPEarned(address user, uint256 xpAmount, uint256 totalXP)`
- `VerifierRegistered(uint256 id, address verifier)`

## Security Features

- **Access Control**: Owner-only functions for verifier registration
- **Claim Prevention**: Unique claim IDs prevent double-claiming
- **Input Validation**: Proper parameter validation
- **Emergency Functions**: Owner can withdraw stuck tokens if needed

## Example Workflow

1. **Setup**: Deploy XPManager
2. **Register Verifiers**: Add verifier contracts for different activities
3. **Users Claim XP**: Users interact with verifiers to earn XP
4. **Track Engagement**: XP serves as engagement metrics
5. **Gamification**: Use XP for community features, badges, etc.

## Use Cases

### Community Engagement
- **Voting participation**: Award XP for participating in governance
- **Content creation**: XP for creating valuable content
- **Community help**: XP for helping other community members
- **Event participation**: XP for attending community events

### Gamification Features
- **Leaderboards**: Rank users by XP
- **Badges**: Award badges at XP milestones
- **Access levels**: Unlock features based on XP
- **Community roles**: Assign roles based on XP

### Legal Benefits
- **No financial incentives**: Eliminates vote buying concerns
- **Transparent tracking**: All XP earning is public
- **Community focused**: Encourages genuine engagement
- **Flexible implementation**: Can adapt to different activities

## Example Verifiers

### Citizen NFT Ownership
```solidity
// Awards XP for owning MoonDAO Citizen NFT
context = abi.encode(citizenNFTAddress, 25);
```

### Voting Participation
```solidity
// Awards XP for participating in governance votes
context = abi.encode(proposalId, 10);
```

### Content Creation
```solidity
// Awards XP for creating approved content
context = abi.encode(contentHash, 50);
```

### Community Events
```solidity
// Awards XP for attending community events
context = abi.encode(eventId, 15);
```

## Configuration Examples

### XP Amounts
- **Small activities**: 5-15 XP (voting, attending events)
- **Medium activities**: 25-50 XP (content creation, community help)
- **Large activities**: 100+ XP (major contributions, leadership)

### Verifier Types
- **One-time**: Award XP once per user (NFT ownership)
- **Recurring**: Award XP for repeated activities (voting, events)
- **Conditional**: Award XP based on specific conditions

This system provides a legal, transparent, and engaging way to track community participation and encourage genuine engagement without any financial incentives that could raise legal concerns.
