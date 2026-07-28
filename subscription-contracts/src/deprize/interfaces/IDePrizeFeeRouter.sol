// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IDePrizeFeeRouter
/// @notice Minimal surface DePrizeMint uses to trigger a best-effort fee sweep
///         after each bet. See {DePrizeFeeRouter}.
interface IDePrizeFeeRouter {
    /// @notice Sweep the LMSR market's accrued trade fees for `deprizeId` and
    ///         route them to the DePrize's Juicebox prize pool (or, once the
    ///         DePrize is terminal, to the treasury owner). Permissionless.
    /// @return swept The amount of collateral (in wei) swept.
    function sweepFees(uint256 deprizeId) external returns (uint256 swept);
}
