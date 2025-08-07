// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IXPVerifier
/// @notice Pluggable eligibility checker for XP claims.
/// @dev Intended to be called by an XPManager. Stateless verifiers are ideal,
///      but implementations may read external contracts (ERC20/721/1155, etc.).
interface IXPVerifier {
    /// @notice Human-readable identifier for this verifier (e.g., "OwnsCoolNFT:v1").
    function name() external view returns (string memory);

    /// @notice Check if `user` meets the condition described by `context`.
    /// @dev MUST be a pure/read-only check (no state writes).
    /// @param user The claimant.
    /// @param context ABI-encoded parameters the verifier needs (e.g., nft addr, min balance, snapshot id).
    ///        Examples:
    ///          - abi.encode(address nftAddress, uint256 minBalance)
    ///          - abi.encode(address token, uint256 minAmount, uint256 blockNumber)
    /// @return eligible True if user currently satisfies the condition.
    /// @return xpAmount How much XP should be granted if eligible (0 allowed).
    function isEligible(address user, bytes calldata context)
        external
        view
        returns (bool eligible, uint256 xpAmount);

    /// @notice Deterministic ID for this specific (user, context) claim.
    /// @dev XPManager should mark this as consumed to prevent re-claims.
    ///      MUST be stable across calls and independent of current eligibility.
    ///      Recommended: keccak256(abi.encodePacked(address(this), user, contextCanonicalForm)).
    /// @param user The claimant.
    /// @param context Same bytes passed to isEligible.
    /// @return id A unique claim identifier.
    function claimId(address user, bytes calldata context) external view returns (bytes32);

    /// @notice Optional: cooldown timestamp after which the user may claim again.
    /// @dev Return 0 if the verifier has no cooldown concept. XPManager can ignore if not used.
    /// @param user The claimant.
    /// @param context Same bytes passed to isEligible.
    /// @return validAfter Unix timestamp after which a new claim may be attempted.
    function validAfter(address user, bytes calldata context) external view returns (uint256);
}
