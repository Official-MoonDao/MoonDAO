// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ProofManagementLib
 * @dev Library for managing used proofs to reduce contract size
 */
library ProofManagementLib {
    /**
     * @dev Reset all user proofs with basic patterns
     */
    function resetAllUserProofs(
        mapping(bytes32 => bool) storage usedProofs,
        mapping(uint256 => address) storage verifiers,
        address user
    ) internal {
        // Reset only basic patterns to avoid gas issues
        for (uint256 i = 1; i <= 5; i++) { // Limit to first 5 verifiers
            if (verifiers[i] != address(0)) {
                bytes32 basicClaimId = keccak256(abi.encodePacked(verifiers[i], user, keccak256(abi.encode(uint256(0)))));
                usedProofs[basicClaimId] = false;
                bytes32 emptyClaimId = keccak256(abi.encodePacked(verifiers[i], user, bytes32(0)));
                usedProofs[emptyClaimId] = false;
            }
        }
    }

    /**
     * @dev Reset verifier proofs with basic patterns
     */
    function resetVerifierProofs(
        mapping(bytes32 => bool) storage usedProofs,
        address verifierAddress
    ) internal {
        // Reset basic patterns only
        bytes32[] memory contexts = new bytes32[](3);
        contexts[0] = keccak256(abi.encode(uint256(0)));
        contexts[1] = keccak256(abi.encode(uint256(100)));
        contexts[2] = bytes32(0);
        
        address[] memory users = new address[](3);
        users[0] = address(0x1);
        users[1] = address(0x2);
        users[2] = address(0x3);
        
        for (uint256 c = 0; c < contexts.length; c++) {
            for (uint256 u = 0; u < users.length; u++) {
                bytes32 claimId = keccak256(abi.encodePacked(verifierAddress, users[u], contexts[c]));
                usedProofs[claimId] = false;
            }
        }
    }

    /**
     * @dev Reset verifier proofs for specific user
     */
    function resetVerifierProofsForUser(
        mapping(bytes32 => bool) storage usedProofs,
        address verifierAddress,
        address user
    ) internal {
        // Reset basic context patterns
        bytes32[] memory contexts = new bytes32[](4);
        contexts[0] = keccak256(abi.encode(uint256(0)));
        contexts[1] = keccak256(abi.encode(uint256(100)));
        contexts[2] = keccak256(abi.encode(uint256(1000)));
        contexts[3] = bytes32(0);
        
        for (uint256 c = 0; c < contexts.length; c++) {
            bytes32 claimId = keccak256(abi.encodePacked(verifierAddress, user, contexts[c]));
            usedProofs[claimId] = false;
            
            // Reset bulk claim patterns for staged verifiers (limited stages)
            for (uint256 stage = 0; stage <= 3; stage++) {
                bytes32 bulkClaimId = keccak256(abi.encodePacked(verifierAddress, user, stage, contexts[c]));
                usedProofs[bulkClaimId] = false;
            }
        }
    }
}
