// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./XPOracleVerifier.sol";

/// @title HasJoinedATeam
/// @notice Verifier that checks if a user has joined at least one team on MoonDAO (off-chain via oracle)
/// @dev Context: abi.encode(uint256 minTeams, uint256 xpAmount, uint256 validAfter, uint256 validBefore, bytes signature)
contract HasJoinedATeam is XPOracleVerifier {
    uint256 public xpPerClaim;

    constructor(address _oracle, uint256 _xpPerClaim) XPOracleVerifier(_oracle) {
        xpPerClaim = _xpPerClaim;
    }

    function setXpPerClaim(uint256 newAmount) external onlyOwner {
        xpPerClaim = newAmount;
    }

    function name() external pure returns (string memory) {
        return "HasJoinedATeam:v1";
    }

    function isEligible(address user, bytes calldata context)
        external
        view
        returns (bool eligible, uint256 xpAmount)
    {
        (uint256 minTeams, , uint256 validAfterTs, uint256 validBefore, bytes memory signature) =
            abi.decode(context, (uint256, uint256, uint256, uint256, bytes));

        // The oracle enforces that the given `user` has joined at least `minTeams` teams
        _verifyOracleProof(
            user,
            keccak256(abi.encode(minTeams)),
            xpPerClaim,
            validAfterTs,
            validBefore,
            signature
        );

        eligible = true;
        xpAmount = xpPerClaim;
    }

    function claimId(address user, bytes calldata context) external view returns (bytes32) {
        (uint256 minTeams, uint256 amount, uint256 validAfterTs, uint256 validBefore, ) =
            abi.decode(context, (uint256, uint256, uint256, uint256, bytes));
        // Keep amount in the claimId for backwards compatibility even if ignored
        bytes32 contextHash = keccak256(abi.encode(minTeams, amount, validAfterTs, validBefore));
        return keccak256(abi.encodePacked(address(this), user, contextHash));
    }

    function validAfter(address, bytes calldata) external pure returns (uint256) {
        return 0;
    }
}
