// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IXPOracle
 * @notice Shared oracle interface for signing/verifying off-chain computed XP eligibility proofs
 * @dev Uses EIP-712 typed data for signatures. Verifiers can depend on a single oracle
 *      to validate proofs across many conditions.
 */
interface IXPOracle {
    /// @notice Typed data struct that is signed by an authorized oracle signer
    /// @dev contextHash should be keccak256-encoded domain-specific parameters for the verifier
    struct Proof {
        address user; // claimant
        address verifier; // verifier contract address (binds proof to a specific verifier)
        bytes32 contextHash; // hash of verifier-specific context values (e.g., minVotingPower)
        uint256 xpAmount; // XP to grant if proof is valid
        uint256 validAfter; // not-before timestamp (unix seconds)
        uint256 validBefore; // not-after timestamp (unix seconds)
    }

    /// @notice Verify that a signature over `proof` was produced by an authorized signer
    /// @return isValid True if signature is valid and signer is authorized
    function verifyProof(Proof calldata proof, bytes calldata signature) external view returns (bool isValid);

    /// @notice Check if an address is an authorized signer
    function isSigner(address account) external view returns (bool);

    /// @notice Return the EIP-712 domain separator used by the oracle
    function domainSeparator() external view returns (bytes32);
}
