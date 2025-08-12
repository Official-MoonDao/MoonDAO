// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./XPOracleVerifier.sol";

/// @title HasVotingPower
/// @notice Verifier that checks if a user has voting power across chains using off-chain data
/// @dev Context should be abi.encode(uint256 minVotingPower, uint256 xpAmount, uint256 validAfter, uint256 validBefore, bytes signature)
/// @dev The signature is created off-chain by a trusted oracle over EIP-712 typed data
contract HasVotingPower is XPOracleVerifier {
    constructor(address _oracle) XPOracleVerifier(_oracle) {}
    
    /// @notice Human-readable identifier for this verifier
    function name() external pure returns (string memory) {
        return "HasVotingPower:v1";
    }

    /// @notice Check if user has sufficient voting power across chains
    /// @param user The claimant
    /// @param context ABI-encoded parameters: (uint256 minVotingPower, uint256 xpAmount, uint256 validAfter, uint256 validBefore, bytes signature)
    /// @return eligible True if user has sufficient voting power
    /// @return xpAmount The amount of XP to grant
    function isEligible(address user, bytes calldata context)
        external
        view
        returns (bool eligible, uint256 xpAmount)
    {
        (uint256 minVotingPower, uint256 amount, uint256 validAfterTs, uint256 validBefore, bytes memory signature) =
            abi.decode(context, (uint256, uint256, uint256, uint256, bytes));

        // Build oracle proof tying to this verifier and user
        // Verify oracle proof
        _verifyOracleProof(
            user,
            keccak256(abi.encode(minVotingPower)),
            amount,
            validAfterTs,
            validBefore,
            signature
        );

        // Off-chain oracle ensures min voting power constraint
        eligible = true;
        xpAmount = amount;
    }

    /// @notice Generate a unique claim ID for this verifier
    /// @param user The claimant
    /// @param context Same bytes passed to isEligible
    /// @return id A unique claim identifier
    function claimId(address user, bytes calldata context)
        external
        view
        returns (bytes32)
    {
        // Exclude the signature bytes from the claim ID so the same claim cannot be replayed with a different signature
        (uint256 minVotingPower, uint256 amount, uint256 validAfterTs, uint256 validBefore,) =
            abi.decode(context, (uint256, uint256, uint256, uint256, bytes));
        bytes32 contextHash = keccak256(abi.encode(minVotingPower, amount, validAfterTs, validBefore));
        return keccak256(abi.encodePacked(address(this), user, contextHash));
    }

    /// @notice No cooldown for this verifier (oracle signatures can impose timing). Always returns 0.
    function validAfter(address, bytes calldata) external pure returns (uint256) { return 0; }
}
