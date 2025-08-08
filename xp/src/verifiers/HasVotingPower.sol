// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IXPVerifier.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title HasVotingPower
/// @notice Verifier that checks if a user has voting power across chains using off-chain data
/// @dev Context should be abi.encode(uint256 minVotingPower, uint256 xpAmount, uint256 timestamp, bytes signature)
/// @dev The signature is created off-chain by a trusted oracle that queries voting power data
contract HasVotingPower is IXPVerifier {
    using ECDSA for bytes32;
    
    address public oracle;
    uint256 public constant SIGNATURE_TIMEOUT = 1 hours; // 1 hour timeout for signatures
    
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    
    constructor(address _oracle) {
        require(_oracle != address(0), "Invalid oracle address");
        oracle = _oracle;
    }
    
    /// @notice Update the oracle address (only current oracle can update)
    function updateOracle(address newOracle) external {
        require(msg.sender == oracle, "Only oracle can update");
        require(newOracle != address(0), "Invalid oracle address");
        
        address oldOracle = oracle;
        oracle = newOracle;
        
        emit OracleUpdated(oldOracle, newOracle);
    }
    
    /// @notice Human-readable identifier for this verifier
    function name() external pure returns (string memory) {
        return "HasVotingPower:v1";
    }

    /// @notice Check if user has sufficient voting power across chains
    /// @param user The claimant
    /// @param context ABI-encoded parameters: (uint256 minVotingPower, uint256 xpAmount, uint256 timestamp, bytes signature)
    /// @return eligible True if user has sufficient voting power
    /// @return xpAmount The amount of XP to grant
    function isEligible(address user, bytes calldata context) 
        external 
        view 
        returns (bool eligible, uint256 xpAmount) 
    {
        (uint256 minVotingPower, uint256 amount, uint256 timestamp, bytes memory signature) = 
            abi.decode(context, (uint256, uint256, uint256, bytes));
        
        // Check if signature is not expired
        require(block.timestamp <= timestamp + SIGNATURE_TIMEOUT, "Signature expired");
        
        // Verify the signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            user,
            minVotingPower,
            amount,
            timestamp
        ));
        
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));
        address signer = ethSignedMessageHash.recover(signature);
        
        require(signer == oracle, "Invalid signature");
        
        // For this verifier, we assume the oracle has verified the voting power off-chain
        // and only signs if the user meets the minimum voting power requirement
        // The signature itself serves as proof that the user has sufficient voting power
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
        return keccak256(abi.encodePacked(address(this), user, context));
    }

    /// @notice No cooldown for this verifier (but oracle can control frequency via signatures)
    /// @param user The claimant
    /// @param context Same bytes passed to isEligible
    /// @return validAfter Always returns 0 (no cooldown)
    function validAfter(address user, bytes calldata context) 
        external 
        pure 
        returns (uint256) 
    {
        return 0; // No cooldown
    }
}
