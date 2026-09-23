# Quarterly vMOONEY Rewards Distribution Guide

This document provides the standard operating procedure for distributing locked vMOONEY rewards to project and community contributors. Once executed, contributors can claim their rewards directly on the MoonDAO website.

All distributions must be executed on the Arbitrum network.

## Access the Treasury
Navigate to the MoonDAO Multichain Treasury on Arbitrum:
[MoonDAO Safe (Arbitrum)](https://app.safe.global/home?safe=arb1:0xAF26a002d716508b7e375f1f620338442F5470c0)

## Step 1: Approve the Total MOONEY Distribution Amount
Before assigning vMOONEY to individual addresses, you must approve the total aggregate amount of MOONEY that will be distributed in this batch. 

Open the Safe app and initiate a new transaction using the **Transaction Builder**.

Input the following parameters for the approval step:
* **Target Mooney:** `arb1:0x1Fa56414549BdccBB09916f61f0A5827f779a85c`
* **To Address:** `0x1Fa56414549BdccBB09916f61f0A5827f779a85c`
* **Contract Method Selector:** `Approve`
* **Spender Address (Voting Escrow Depositor):** `0xBE19a62384014F103686dfE6D9d50B1D3E81B2d0`
* **Amount (uint256):** Enter the total batch amount. You must append 18 zeros to the real token amount to account for contract decimals.

Reference for Step 1: [Example Approval Transaction](https://app.safe.global/transactions/tx?safe=arb1:0xAF26a002d716508b7e375f1f620338442F5470c0&id=multisig_0xAF26a002d716508b7e375f1f620338442F5470c0_0xd7d8daa00d5822ce4b06903a055ae02966f04685d4a2a5b4f349e18d6015bd47)

## Step 2: Distribute vMOONEY to Contributors
Next, you will instruct the contract to distribute the approved amount to the specific contributor addresses. 

Continue using the **Transaction Builder**.

Input the following parameters for the distribution step:
* **Target Contract (Voting Escrow Depositor):** `0xBE19a62384014F103686dfE6D9d50B1D3E81B2d0`
* **Contract Method Selector:** `increaseWithdrawAmounts`

You will be prompted to provide the distribution data:
* Input a JSON array containing all recipient addresses and their specific reward amounts.
* Ensure every individual amount is formatted in `uint256` by appending 18 zeros to the real token amount. 

Reference for Step 2: [Example Distribution History](https://app.safe.global/transactions/history?safe=arb1:0xAF26a002d716508b7e375f1f620338442F5470c0)

## Final Review
Verify that the sum of the amounts in the JSON array perfectly matches the total approved amount in Step 1. Ensure all `uint256` values contain the correct 18 decimal padding. Sign and execute the transaction block.

