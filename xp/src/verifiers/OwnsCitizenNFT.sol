// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IXPVerifier.sol";
import "../mocks/MockERC5643Citizen.sol";

/// @title OwnsCitizenNFT
/// @notice Verifier that checks if a user owns a MoonDAO Citizen NFT
/// @dev Context should be abi.encode(address citizenNFTAddress, uint256 xpAmount)
contract OwnsCitizenNFT is IXPVerifier {
    
    /// @notice Human-readable identifier for this verifier
    function name() external pure returns (string memory) {
        return "OwnsCitizenNFT:v1";
    }

    /// @notice Check if user owns a MoonDAO Citizen NFT
    /// @param user The claimant
    /// @param context ABI-encoded parameters: (address citizenNFTAddress, uint256 xpAmount)
    /// @return eligible True if user owns a Citizen NFT
    /// @return xpAmount The amount of XP to grant
    function isEligible(address user, bytes calldata context) 
        external 
        view 
        returns (bool eligible, uint256 xpAmount) 
    {
        (address citizenNFTAddress, uint256 amount) = abi.decode(context, (address, uint256));
        
        MockERC5643Citizen citizenNFT = MockERC5643Citizen(citizenNFTAddress);
        
        // Check if user owns at least one Citizen NFT
        eligible = citizenNFT.balanceOf(user) > 0;
        xpAmount = eligible ? amount : 0;
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

    /// @notice No cooldown for this verifier
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
