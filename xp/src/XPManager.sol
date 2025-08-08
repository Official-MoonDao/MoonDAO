// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IXPVerifier.sol";

contract XPManager is Ownable {
    // User state
    mapping(address => uint256) public userXP;
    
    // Verifier management
    mapping(uint256 => address) public verifiers;
    mapping(bytes32 => bool) public usedProofs;
    
    // Events
    event XPEarned(address indexed user, uint256 xpAmount, uint256 totalXP);
    event VerifierRegistered(uint256 indexed id, address verifier);

    constructor() Ownable(msg.sender) {
        // No constructor parameters needed for pure XP system
    }

    /**
     * @notice Register a new verifier
     * @param id Unique identifier for the verifier
     * @param verifier Address of the verifier contract
     */
    function registerVerifier(uint256 id, address verifier) external onlyOwner {
        require(verifier != address(0), "Invalid verifier address");
        verifiers[id] = verifier;
        emit VerifierRegistered(id, verifier);
    }

    // No reward token distribution in this XP Manager

    /**
     * @notice Claim XP from a verifier
     * @param conditionId ID of the verifier condition
     * @param context Context data for the verifier
     */
    function claimXP(
        uint256 conditionId,
        bytes calldata context
    ) external {
        require(verifiers[conditionId] != address(0), "Verifier not found");
        
        IXPVerifier verifier = IXPVerifier(verifiers[conditionId]);
        
        // Generate claim ID
        bytes32 claimId = verifier.claimId(msg.sender, context);
        require(!usedProofs[claimId], "Already claimed");
        
        // Check cooldown
        uint256 validAfter = verifier.validAfter(msg.sender, context);
        require(block.timestamp >= validAfter, "Cooldown not expired");
        
        // Check eligibility
        (bool eligible, uint256 xpAmount) = verifier.isEligible(msg.sender, context);
        require(eligible, "Not eligible");
        require(xpAmount > 0, "No XP to claim");
        
        // Mark as used
        usedProofs[claimId] = true;
        
        // Grant XP
        _grantXP(msg.sender, xpAmount);
    }

    /**
     * @notice Get total XP for a user
     * @param user Address of the user
     * @return Total XP amount
     */
    function getTotalXP(address user) external view returns (uint256) {
        return userXP[user];
    }

    /**
     * @dev Internal function to grant XP
     * @param user Address of the user
     * @param amount XP to grant
     */
    function _grantXP(address user, uint256 amount) internal {
        userXP[user] += amount;
        emit XPEarned(user, amount, userXP[user]);
    }
}
