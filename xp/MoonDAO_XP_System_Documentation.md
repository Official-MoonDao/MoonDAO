# MoonDAO XP System

## Overview

The MoonDAO XP (Experience Points) system is a comprehensive gamification platform that rewards community members for various activities and achievements within the MoonDAO ecosystem. The system is built on Ethereum smart contracts and uses a modular architecture to support different types of verifications and reward mechanisms.

## High-Level Architecture

### Core Components

1. **XPManager.sol** - Central contract managing XP distribution, ERC20 rewards, and XP levels
2. **IXPVerifier.sol** - Interface that all verifiers must implement
3. **StagedXPVerifier.sol** - Abstract base for staged/progressive XP rewards
4. **XPOracleVerifier.sol** - Abstract base for oracle-backed verifications
5. **Individual Verifiers** - Specific implementations for different activities

### System Flow

```
User Action → Verifier Check → Oracle Proof (if needed) → XP Awarded → Automatic ERC20 Conversion → Level Progression
```

## XP Manager System

### Core Functionality

- **XP Tracking**: Maintains total XP balance for each user
- **Verifier Registry**: Maps verifier IDs to contract addresses
- **Proof Prevention**: Prevents double-claiming using unique claim IDs
- **ERC20 Rewards**: Direct conversion rate system with automatic claiming
- **XP Levels**: Configurable level system with thresholds
- **User Management**: Tracks which verifiers users have claimed from

### Key Features

- **Claim Methods**: 
  - `claimXP()` - User claims individual stages directly
  - `claimXPFor()` - Server-relayed claims for better UX
  - `claimBulkXP()` - User claims all eligible stages at once
  - `claimBulkXPFor()` - Server-relayed bulk claims
- **Automatic ERC20 Rewards**: XP is automatically converted to ERC20 tokens at a configurable rate
- **XP Levels**: Progressive level system with configurable thresholds
- **Admin Controls**: Owner can register verifiers, configure rewards and levels, reset users

## ERC20 Reward System

### Direct Conversion Rate System

The system now uses a direct conversion rate approach instead of threshold-based rewards:

```solidity
struct ERC20RewardConfig {
    address tokenAddress;      // ERC20 token address
    uint256 conversionRate;    // ERC20 tokens per 1 XP (with decimals)
    bool active;               // Whether rewards are enabled
}
```

### How It Works

1. **Automatic Conversion**: Every time XP is earned, it's automatically converted to ERC20 tokens
2. **Direct Rate**: 1 XP = configurable amount of ERC20 tokens (e.g., 1 XP = 0.1 MOONEY)
3. **Immediate Claiming**: No need for users to manually claim rewards - they're sent automatically
4. **Configurable**: Admins can set the conversion rate and change it as needed

### Benefits of New System

- **Simplified UX**: Users don't need to manually claim rewards
- **Immediate Rewards**: Tokens are sent as soon as XP is earned
- **Flexible Rates**: Easy to adjust conversion rates based on token economics
- **Gas Efficient**: No separate claiming transactions needed

## XP Levels System

### Progressive Level System

The system now includes a configurable level system that provides additional gamification:

```solidity
struct XPLevel {
    uint256 xpThreshold;    // XP required to reach this level
    uint256 level;          // Level number
    bool active;            // Whether this level is active
}
```

### Level Features

- **Configurable Thresholds**: Admins can set custom XP thresholds for each level
- **Progressive Advancement**: Users automatically advance through levels as they earn XP
- **Level Events**: `LevelUp` events are emitted when users reach new levels
- **Flexible Configuration**: Levels can be added, removed, or modified dynamically

### Level Management Functions

- `setXPLevels()` - Configure level thresholds and numbers
- `getUserLevel()` - Get current user level
- `getNextLevelInfo()` - Get information about the next level
- `getAllLevelInfo()` - Get comprehensive level information for display

### Example Level Configuration

```solidity
// Example: Set 5 levels with increasing XP requirements
uint256[] thresholds = [100, 500, 1000, 2500, 5000];
uint256[] levels = [1, 2, 3, 4, 5];
```

## Verifier Types

### 1. Simple Oracle Verifiers
These verify one-time achievements through oracle signatures:

#### HasCompletedCitizenProfile
- **Purpose**: Rewards completing MoonDAO citizen profile
- **XP Reward**: Configurable (default: set at deployment)
- **Verification**: Oracle confirms profile completion status

#### HasCreatedATeam
- **Purpose**: Rewards creating a team in MoonDAO
- **XP Reward**: Configurable (default: set at deployment)
- **Verification**: Oracle confirms team creation

#### HasJoinedATeam
- **Purpose**: Rewards joining a team in MoonDAO
- **XP Reward**: Configurable (default: set at deployment)
- **Verification**: Oracle confirms team membership

### 2. On-Chain Verifiers

#### OwnsCitizenNFT
- **Purpose**: Rewards owning a MoonDAO Citizen NFT
- **XP Reward**: Configurable (default: set at deployment)
- **Verification**: Direct on-chain balance check
- **Requirements**: Must own at least 1 Citizen NFT

### 3. Staged Oracle Verifiers
These provide progressive rewards based on achievement levels:

#### HasVotedStaged
- **Purpose**: Progressive rewards for voting participation
- **Stages**:
  - Stage 1: 1 vote → 5 XP
  - Stage 2: 5 votes → 10 XP (Total: 15 XP)
  - Stage 3: 10 votes → 20 XP (Total: 35 XP)
  - Stage 4: 20 votes → 50 XP (Total: 85 XP)
  - Stage 5: 100 votes → 100 XP (Total: 185 XP)

#### HasVotingPowerStaged
- **Purpose**: Progressive rewards for voting power milestones
- **Stages**:
  - Stage 1: 1 voting power → 5 XP
  - Stage 2: 10 voting power → 10 XP (Total: 15 XP)
  - Stage 3: 100 voting power → 20 XP (Total: 35 XP)
  - Stage 4: 1,000 voting power → 50 XP (Total: 85 XP)
  - Stage 5: 10,000 voting power → 100 XP (Total: 185 XP)

#### HasContributedStaged
- **Purpose**: Progressive rewards for community contributions
- **Stages**:
  - Stage 1: 1 contribution → 10 XP
  - Stage 2: 3 contributions → 20 XP (Total: 30 XP)
  - Stage 3: 10 contributions → 50 XP (Total: 80 XP)
  - Stage 4: 25 contributions → 100 XP (Total: 180 XP)
  - Stage 5: 50 contributions → 300 XP (Total: 480 XP)
  - Stage 6: 100 contributions → 500 XP (Total: 980 XP)

#### HasBoughtAMarketplaceListingStaged
- **Purpose**: Progressive rewards for marketplace purchases
- **Stages**:
  - Stage 1: 1 purchase → 50 XP
  - Stage 2: 3 purchases → 75 XP (Total: 125 XP)
  - Stage 3: 5 purchases → 100 XP (Total: 225 XP)
  - Stage 4: 10 purchases → 150 XP (Total: 375 XP)
  - Stage 5: 25 purchases → 250 XP (Total: 625 XP)

#### HasSubmittedPRStaged
- **Purpose**: Progressive rewards for GitHub Pull Request submissions
- **Stages**:
  - Stage 1: 1 PR → 10 XP
  - Stage 2: 5 PRs → 25 XP (Total: 35 XP)
  - Stage 3: 10 PRs → 50 XP (Total: 85 XP)
  - Stage 4: 25 PRs → 100 XP (Total: 185 XP)
  - Stage 5: 50 PRs → 200 XP (Total: 385 XP)
  - Stage 6: 100 PRs → 500 XP (Total: 885 XP)
- **Verification**: Oracle confirms PR submission count from GitHub
- **Context Format**: `abi.encode(uint256 prCount, uint256 xpAmount, uint256 validAfter, uint256 validBefore, bytes signature)`
- **Admin Functions**: Configurable stages, bulk stage updates, user resets

#### HasTokenBalanceStaged
- **Purpose**: Progressive rewards for holding ERC20 tokens (cross-chain verification)
- **Stages** (assuming 18 decimals):
  - Stage 1: 1,000 tokens → 25 XP
  - Stage 2: 20,000 tokens → 50 XP (Total: 75 XP)
  - Stage 3: 50,000 tokens → 100 XP (Total: 175 XP)
  - Stage 4: 100,000 tokens → 250 XP (Total: 425 XP)
  - Stage 5: 500,000 tokens → 500 XP (Total: 925 XP)
  - Stage 6: 1,000,000 tokens → 1,000 XP (Total: 1,925 XP)
- **Verification**: Oracle confirms token balance across different chains
- **Context Format**: `abi.encode(uint256 balance, uint256 xpAmount, uint256 validAfter, uint256 validBefore, bytes signature)`
- **Admin Functions**: Configurable stages, bulk stage updates, user resets

### 4. On-Chain Staged Verifiers

*No on-chain staged verifiers currently implemented*

### 5. Simple Oracle Verifiers (Non-Staged)

#### HasSubmittedIssue
- **Purpose**: Rewards for submitting GitHub issues
- **XP Reward**: Configurable XP per issue × issue count
- **Verification**: Oracle confirms issue submission count from GitHub
- **Context Format**: `abi.encode(uint256 issueCount, uint256 xpAmount, uint256 validAfter, uint256 validBefore, bytes signature)`
- **Admin Functions**: Configurable XP per claim amount
- **Example**: If `xpPerClaim = 5` and user submits 3 issues, they receive 15 XP total

## Bulk Claiming Technical Implementation

### New Smart Contract Functions

#### XPManager.sol Additions
- `claimBulkXP(uint256 conditionId, bytes calldata context)` - User bulk claim
- `claimBulkXPFor(address user, uint256 conditionId, bytes calldata context)` - Server-relayed bulk claim

#### StagedXPVerifier.sol Additions  
- `isBulkEligible(address user, bytes calldata context)` - Returns total claimable XP and highest stage
- `bulkClaimId(address user, bytes calldata context)` - Generates unique bulk claim identifier
- `updateUserStage(address user, uint256 newHighestStage)` - Updates user progression (XPManager only)

#### IStagedXPVerifier.sol Interface
New interface defining bulk claiming capabilities for staged verifiers.

### Implementation Details

#### Bulk Eligibility Calculation
1. Verifies oracle proof to get user's current metric (voting power, contributions, etc.)
2. Iterates through stages starting from user's current position
3. Accumulates XP for all sequential stages user qualifies for
4. Returns total XP and highest claimable stage index

#### Stage Progression Logic
- User's `userHighestClaimedStage` represents the **next** stage they can claim
- Value 0 = can claim stage 0, value 1 = can claim stage 1, etc.
- After claiming stages 0-3, user's value becomes 4 (can claim stage 4 next)
- Ensures sequential claiming while enabling bulk operations

#### Unique Claim ID Generation
Bulk claim IDs include the user's current stage position to ensure uniqueness:
```solidity
keccak256(abi.encodePacked(address(this), user, context, currentHighest, "bulk"))
```

### Backwards Compatibility
- All existing individual claiming functions remain unchanged
- Existing verifiers work with both individual and bulk claiming
- No breaking changes to current implementations

## Oracle System

### Purpose
The oracle system enables off-chain verification of achievements that cannot be validated directly on-chain (e.g., forum posts, Discord activity, external platform interactions).

### Security Model
- **EIP-712 Signatures**: Structured, typed data signatures for security
- **Authorized Signers**: Only whitelisted addresses can create valid proofs
- **Proof Binding**: Each proof is bound to specific user, verifier, and context
- **Time Windows**: Proofs have validity periods to prevent replay attacks

### Proof Structure
```solidity
struct Proof {
    address user;          // Who can claim this XP
    address verifier;      // Which verifier this proof is for
    bytes32 contextHash;   // Hash of achievement details
    uint256 xpAmount;      // XP amount (must match verifier config)
    uint256 validAfter;    // Not valid before this timestamp
    uint256 validBefore;   // Not valid after this timestamp
}
```

## Staged XP System

### Progressive Rewards
- Users must claim stages sequentially (can't skip stages)
- Each stage has a threshold requirement and XP reward
- System tracks highest stage claimed per user
- Admins can reconfigure stages dynamically

### Bulk Claiming Feature
- **Single Transaction Claims**: Users can claim all eligible stages with one transaction
- **Automatic Calculation**: System automatically determines all claimable stages
- **Gas Efficient**: Reduces transaction costs for users with multiple eligible stages
- **Seamless UX**: No need to click claim button multiple times
- **Sequential Enforcement**: Still maintains sequential stage claiming requirements
- **Unique Claim IDs**: Bulk claims have unique identifiers to prevent double-claiming

#### How Bulk Claiming Works
1. User calls `claimBulkXP()` with their context data
2. System verifies oracle proof and determines user's metric (e.g., voting power)
3. Calculates all sequential stages user can claim from their current position
4. Awards total XP for all eligible stages in a single transaction
5. Updates user's progression to the highest stage claimed

#### Example: Voting Power Bulk Claim
- User has 1,000 voting power and has never claimed voting XP
- Instead of 4 separate transactions for stages 0-3:
  - **Old way**: Claim stage 0 (5 XP) → Claim stage 1 (10 XP) → Claim stage 2 (20 XP) → Claim stage 3 (50 XP)
  - **New way**: Single `claimBulkXP()` transaction awards 85 XP total (5+10+20+50)

### Benefits
- Encourages continued engagement
- Prevents gaming through single large actions
- Creates clear progression paths for users
- Flexible configuration for different activity types
- Improved UX with single-click claiming for multiple stages
- Lower gas costs with one transaction instead of multiple

## Total XP Potential Summary

### Maximum XP Per Verifier Category

#### One-Time Verifiers
- **OwnsCitizenNFT**: Configurable XP (one-time)
- **HasCompletedCitizenProfile**: Configurable XP (one-time)
- **HasCreatedATeam**: Configurable XP (one-time)
- **HasJoinedATeam**: Configurable XP (one-time)

#### Staged Verifiers (Maximum Possible)
- **HasVotedStaged**: 185 XP total (across 5 stages)
- **HasVotingPowerStaged**: 185 XP total (across 5 stages)
- **HasContributedStaged**: 980 XP total (across 6 stages)
- **HasBoughtAMarketplaceListingStaged**: 625 XP total (across 5 stages)
- **HasSubmittedPRStaged**: 885 XP total (across 6 stages)
- **HasTokenBalanceStaged**: 1,925 XP total (across 6 stages)

### Theoretical Maximum XP
**Staged Verifiers Total**: 4,785 XP
**Plus One-Time Verifiers**: Additional XP based on configuration

## Administrative Features

### Verifier Management
- Register new verifiers with unique IDs
- Update verifier contracts
- Deactivate verifiers when needed

### Stage Configuration
- Add new stages to existing verifiers
- Update stage thresholds and rewards
- Activate/deactivate individual stages
- Bulk reconfigure all stages

### ERC20 Reward Management
- Configure ERC20 reward token and conversion rate
- Update conversion rates dynamically
- Deactivate reward system
- Emergency token withdrawal

### XP Level Management
- Configure level thresholds and numbers
- Update level configurations
- Deactivate specific levels
- Bulk level configuration updates

### User Management
- Reset individual users (clear XP and claims)
- Reset user progress on specific verifiers
- Emergency functions for edge cases

## Security Considerations

### Anti-Gaming Measures
- **Unique Claim IDs**: Prevent double-spending of the same achievement
- **Sequential Stages**: Force progression through stages in order
- **Oracle Signatures**: Prevent fabrication of off-chain achievements
- **Time-bound Proofs**: Limit validity window of oracle proofs

### Access Controls
- **Owner-only Functions**: Critical configuration changes restricted to contract owner
- **Verifier Isolation**: Each verifier is independent and replaceable
- **Proof Binding**: Proofs cannot be reused across different verifiers or users

### Upgrade Path
- **Modular Design**: Individual verifiers can be updated without affecting core system
- **Migration Tools**: User reset functions enable migration scenarios
- **Emergency Controls**: Owner can pause/modify system components

## Integration Guidelines

### For Frontend Developers
1. **Check Eligibility**: 
   - Use `isEligible()` for single stage claims
   - Use `isBulkEligible()` for bulk claims to show total claimable XP
2. **Display ERC20 Rewards**: Use `getAvailableERC20Reward()` to show pending token rewards
3. **Track Progress**: Use `getUserHighestStage()` for staged verifiers
4. **Show Levels**: Use `getAllLevelInfo()` to display user's current level and progress
5. **Claim XP**: 
   - Use `claimXP()` for individual stage claims
   - Use `claimBulkXP()` for claiming all eligible stages at once
   - Backend integration: `claimXPFor()` and `claimBulkXPFor()`
6. **Bulk Claim UX**: Show single "Claim All XP" button instead of multiple claim buttons

### For Backend Developers
1. **Oracle Integration**: Implement EIP-712 signing for off-chain verifications
2. **Proof Generation**: Create proofs with appropriate validity windows
3. **Batch Processing**: 
   - Use `claimXPFor()` for individual stage claims
   - Use `claimBulkXPFor()` for bulk claiming on behalf of users
4. **Monitoring**: Track events for XP claims, level ups, and reward distributions
5. **Bulk Claim Integration**: Implement endpoints that calculate user's maximum claimable XP

### For Administrators
1. **Initial Setup**: Configure all verifiers, ERC20 rewards, and XP levels
2. **ERC20 Configuration**: Set appropriate conversion rates based on token economics
3. **Level Configuration**: Design engaging level progression with appropriate XP thresholds
4. **Ongoing Management**: Monitor system usage and adjust parameters
5. **Emergency Response**: Use reset and emergency withdrawal functions when needed
6. **Upgrades**: Plan verifier updates and user migration strategies

## Event Monitoring

### Key Events to Track
- `XPEarned`: When users gain XP (individual or bulk claims)
- `VerifierClaimed`: When users claim from specific verifiers (individual or bulk)
- `ERC20RewardClaimed`: When users automatically receive token rewards
- `LevelUp`: When users reach new XP levels
- `XPLevelsSet`: When administrators configure level thresholds
- `ERC20RewardConfigSet`: When ERC20 reward configuration is updated
- `StageUpdated`: When administrators modify stage configurations
- `UserReset`: When user data is reset
- `UserStageProgressed`: When users progress through multiple stages (bulk claims)
- `XPManagerSet`: When XPManager address is configured in verifiers

### Bulk Claim Event Patterns
- Bulk claims emit standard `XPEarned` and `VerifierClaimed` events
- `UserStageProgressed` shows progression from previous to new highest stage
- Total XP in `XPEarned` reflects sum of all stages claimed in bulk transaction

### ERC20 Reward Event Patterns
- `ERC20RewardClaimed` is emitted automatically when XP is earned
- Amount reflects the conversion rate applied to earned XP
- No manual claiming required from users

### Level Progression Events
- `LevelUp` events show when users reach new levels
- `XPLevelsSet` events track level configuration changes
- Level information can be queried for display purposes