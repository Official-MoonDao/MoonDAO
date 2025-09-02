// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./XPOracleVerifier.sol";

/// @title HasCreatedTeams
/// @notice Verifier that awards XP based on team creation threshold
/// @dev Context: abi.encode(uint256 teamsCreated, uint256 xpAmount, uint256 validAfter, uint256 validBefore, bytes signature)
contract HasCreatedATeam is XPOracleVerifier {
    uint256 public xpPerClaim;

    constructor(address _oracle, uint256 _xpPerClaim) XPOracleVerifier(_oracle) {
        xpPerClaim = _xpPerClaim;
    }

    function setXpPerClaim(uint256 newAmount) external onlyOwner {
        xpPerClaim = newAmount;
    }

    function name() external pure returns (string memory) {
        return "HasCreatedTeam:v1";
    }

    function isEligible(address user, bytes calldata context) external view returns (bool eligible, uint256 xpAmount) {
        (uint256 teamsCreated,, uint256 validAfterTs, uint256 validBefore, bytes memory signature) =
            abi.decode(context, (uint256, uint256, uint256, uint256, bytes));

        // The oracle enforces that the given `user` has created at least `teamsCreated` teams
        _verifyOracleProof(
            user, keccak256(abi.encode(teamsCreated)), xpPerClaim, validAfterTs, validBefore, signature
        );

        eligible = true;
        xpAmount = xpPerClaim;
    }

    function claimId(address user, bytes calldata context) external view returns (bytes32) {
        (uint256 teamsCreated, uint256 amount, uint256 validAfterTs, uint256 validBefore,) =
            abi.decode(context, (uint256, uint256, uint256, uint256, bytes));
        // Keep amount in the claimId for backwards compatibility even if ignored
        bytes32 contextHash = keccak256(abi.encode(teamsCreated, amount, validAfterTs, validBefore));
        return keccak256(abi.encodePacked(address(this), user, contextHash));
    }

    function validAfter(address, bytes calldata) external pure returns (uint256) {
        return 0;
    }
}
