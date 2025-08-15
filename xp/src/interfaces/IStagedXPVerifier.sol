// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IXPVerifier.sol";

/// @title IStagedXPVerifier
/// @notice Interface for verifiers that support bulk claiming of multiple stages
interface IStagedXPVerifier is IXPVerifier {
    /// @notice Check bulk eligibility for all claimable stages at once
    /// @param user Address of the user
    /// @param context Encoded context data
    /// @return eligible Whether the user is eligible for any stages
    /// @return totalXP Total XP amount for all eligible stages
    /// @return highestStage Highest stage the user can claim up to
    function isBulkEligible(address user, bytes calldata context)
        external
        view
        returns (bool eligible, uint256 totalXP, uint256 highestStage);

    /// @notice Generate a bulk claim ID for claiming multiple stages at once
    /// @param user Address of the user
    /// @param context Encoded context data
    /// @return Unique bulk claim identifier
    function bulkClaimId(address user, bytes calldata context) external view returns (bytes32);

    /// @notice Get the highest stage a user has claimed
    /// @param user Address of the user
    /// @return Highest stage index claimed by the user
    function getUserHighestStage(address user) external view returns (uint256);

    /// @notice Update user's highest claimed stage (only callable by XPManager)
    /// @param user Address of the user
    /// @param newHighestStage New highest stage index
    function updateUserStage(address user, uint256 newHighestStage) external;
}
