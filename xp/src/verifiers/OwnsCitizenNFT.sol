// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IXPVerifier.sol";

interface IERC5643Like {
    function balanceOf(address owner) external view returns (uint256);
}

/// @title OwnsCitizenNFT
/// @notice Verifier that checks if a user owns a MoonDAO Citizen NFT
/// @dev Context should be abi.encode(uint256 xpAmount)
contract OwnsCitizenNFT is IXPVerifier, Ownable {
    IERC5643Like public citizenNFT;

    constructor(address citizenNFTAddress) Ownable(msg.sender) {
        require(citizenNFTAddress != address(0), "Invalid Citizen address");
        citizenNFT = IERC5643Like(citizenNFTAddress);
    }

    function setCitizenNFTAddress(address newAddress) external onlyOwner {
        require(newAddress != address(0), "Invalid Citizen address");
        citizenNFT = IERC5643Like(newAddress);
    }
    
    /// @notice Human-readable identifier for this verifier
    function name() external pure returns (string memory) {
        return "OwnsCitizenNFT:v1";
    }

    /// @notice Check if user owns a MoonDAO Citizen NFT
    /// @param user The claimant
    /// @param context ABI-encoded parameters: (uint256 xpAmount)
    /// @return eligible True if user owns a Citizen NFT
    /// @return xpAmount The amount of XP to grant
    function isEligible(address user, bytes calldata context) 
        external 
        view 
        returns (bool eligible, uint256 xpAmount) 
    {
        uint256 amount = abi.decode(context, (uint256));
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

    /// @notice No cooldown for this verifier. Always returns 0 (no cooldown)
    function validAfter(address, bytes calldata) external pure returns (uint256) { return 0; }
}
