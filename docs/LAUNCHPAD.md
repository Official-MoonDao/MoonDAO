# MoonDAO Launchpad

## Testing Plan

0. Unit testing (MissionTest.t.sol) [done]
0. [Code coverage](https://app.codecov.io/gh/Official-MoonDao/MoonDAO/pull/553/tree/subscription-contracts/src?dropdown=coverage) (95% coverage) [done]
0. Cypress integration test [done]
0. UI testing, check functionality against spec [complete by 6/24]
    - Test mission creation
    - Test mission funding
    - Test mission refund
    - Test mission payout
    - Test mission token distribution
    - Test mission stages
    - Test token vesting
    - Test token AMM liquidity
    - Test vMOONEY AMM rewards
0. Mainnet deployment [complete by 6/25]
0. Mainnet testing [complete by 6/26]
    - Deploy contracts to mainnet (FeeHook, MissionCreator, MissionTable)
    - Repeat unit testing, integration testing, and code coverage
    - Repeat UI testing

## Specification

This document summarizes how the Launchpad operates based on the current repository. It focuses on tokenomics, mission stages, refund behavior, and payment distribution. Potential inconsistencies between smart contracts and UI explanations are noted.

### Mission Lifecycle and Stages

- Each mission has a funding goal and a deadline. If the network is not Sepolia, the deadline defaults to 28 days after mission creation.
- The `LaunchPadPayHook` contract defines stages based on funding and deadline:
  1. **Stage 1** – Fundraising ongoing. Contributions are accepted until the deadline.
  2. **Stage 2** – Funding goal reached before deadline. Payouts become available.
  3. **Stage 3** – Deadline passed without meeting the goal. Contributors may request refunds during a defined refund period.
- The `stage` function within `LaunchPadPayHook` implements this logic.

```solidity
    function stage(address terminal, uint256 projectId) public view returns (uint256) {
        uint256 currentFunding = _totalFunding(terminal, projectId);
        if (currentFunding < fundingGoal) {
            if (block.timestamp >= deadline) {
                return 3; // Refund stage
            } else {
                return 1; // Stage 1
            }
        } else {
            return 2; // Stage 2
        }
    }
```
[LaunchPadPayHook.sol&nbsp;L106-L117](../subscription-contracts/src/LaunchPadPayHook.sol#L106-L117)

### Refunds

- Refunds are controlled by `LaunchPadPayHook` through `beforeCashOutRecordedWith`.
- Refund requests are only valid if:
  - The funding goal was not reached.
  - The deadline has passed.
  - The call is within the configured refund period.

```solidity
    if (currentFunding >= fundingGoal){
        revert("Project has passed funding goal requirement. Refunds are disabled.");
    }
    if (block.timestamp < deadline) {
        revert("Project funding deadline has not passed. Refunds are disabled.");
    }
    if (block.timestamp >= deadline + refundPeriod) {
        revert("Refund period has passed. Refunds are disabled.");
    }
```
[LaunchPadPayHook.sol&nbsp;L70-L86](../subscription-contracts/src/LaunchPadPayHook.sol#L70-L86)

### Tokenomics and Funding Allocation

#### UI Explanation

The UI component `MissionTokenomicsExplainer` outlines how funds are intended to be distributed:

```
Goal & Timeline: Missions have 28 days, or one lunar cycle, to raise their Funding Goal; otherwise, the Mission will not proceed and all contributions will be refunded.
ETH Price Fluctuations: The value of ETH may fluctuate during the mission campaign, meaning the actual funds raised could be higher or lower than initially anticipated. Teams should account for potential volatility.
Fund Allocation: Teams can withdraw up to 90% of their total raised funds. The remaining 20% is allocated as follows:
  • 5% to liquidity to ensure tradability and market stability.
  • 2.5% to MoonDAO to support the broader space acceleration ecosystem.
  • 2.5% to Juicebox, the underlying protocol powering the fundraising infrastructure.
```
[MissionTokenomicsExplainer.tsx&nbsp;L7-L21](../ui/components/mission/MissionTokenomicsExplainer.tsx#L7-L21)

Additionally, `MissionTokenInfo` describes token distribution:

```
50% of the total tokens will go to the contributor when funding the project, and the other 50% are locked for at least one year, allocated as follows:
  • 2.5% of the token is locked indefinitely on an Automated Market Maker (AMM).
  • 17.5% of the token is locked for one year, and vested for three years, to be held by MoonDAO's Treasury.
  • 30% of the token is locked for one year, and vested for three years, to be held by the Mission Team to distribute how they see fit.
If the project does not launch (their funding goal was not met), then contributors can get their full contribution back.
```
[MissionTokenInfo.tsx&nbsp;L14-L32](../ui/components/mission/MissionTokenInfo.tsx#L14-L32)

#### Smart Contract Implementation

In `MissionCreator`, ETH payouts are configured via splits:

```solidity
splitGroups[0].splits[0] = JBSplit({
    percent: 25_641_025, // works out to 2.5% after 2.5% jb fee.
    beneficiary: moonDAOTreasuryPayable
});
splitGroups[0].splits[1] = JBSplit({
    percent: 51_282_051, // works out to 5% after 2.5% jb fee.
    beneficiary: payable(address(poolDeployer))
});
splitGroups[0].splits[2] = JBSplit({
    percent: 923_076_923, // works out to 90% after 2.5% jb fee.
    beneficiary: toPayable
});
```
[MissionCreator.sol&nbsp;L200-L227](../subscription-contracts/src/MissionCreator.sol#L200-L227)

Token distribution uses reserved splits:

```solidity
// MoonDAO token split
splitGroups[1].splits[0] = JBSplit({
    percent: 300_000_000, // 17.5% of total tokens
    beneficiary: payable(address(moonDAOVesting))
});
// Project team split
splitGroups[1].splits[1] = JBSplit({
    percent: 600_000_000, // 30% of total tokens
    beneficiary: payable(address(teamVesting))
});
// AMM liquidity split
splitGroups[1].splits[2] = JBSplit({
    percent: 50_000_000, // 2.5% of total tokens
    beneficiary: payable(address(poolDeployer))
});
```
[MissionCreator.sol&nbsp;L229-L259](../subscription-contracts/src/MissionCreator.sol#L229-L259)

These contract-defined percentages differ from the UI description above.

### Payments

- Contributions are accepted in ETH (`JBConstants.NATIVE_TOKEN`), verified during `beforePayRecordedWith`.
- Once the funding goal is reached and the deadline has passed, the approval hook enables payouts. Reserved tokens and ETH are distributed according to the configured splits.

### Observed Inconsistencies

1. **Funding Allocation Percentages**
   The UI specifies 80% available to the team, with 10% liquidity, 7.5% to MoonDAO, and 2.5% to Juicebox. The contract splits give roughly 90% to the team, 5% to liquidity, and 2.5% to MoonDAO after the Juicebox fee. This indicates the code and UI are not aligned.
2. **Token Distribution**
   The UI states 10% of total tokens go to liquidity, 10% to MoonDAO, and 30% to the team. The contract reserves 2.5% to liquidity, 17.5% to MoonDAO, and 30% to the team. Again the values do not match.
3. **Refund Window**
   The contracts enforce that refunds must be claimed within `refundPeriod` after the deadline. The UI text does not mention this explicit period, which could cause confusion.
4. **28 day deadline**
   We might want something other than a 28 day deadline.
