// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IXPVerifier.sol";

contract XPManager {
    mapping(address => uint256) public xp;
    mapping(uint256 => address) public verifiers;
    mapping(bytes32 => bool) public usedProofs;
    address public rewardToken;
    uint256 public xpPerReward = 1000;

    constructor(address _rewardToken) {
        rewardToken = _rewardToken;
    }

    function registerVerifier(uint256 id, address verifier) external {
        // Only owner in real version
        verifiers[id] = verifier;
    }

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

    function _grantXP(address user, uint256 amount) internal {
        xp[user] += amount;
        if (xp[user] >= xpPerReward) {
            xp[user] -= xpPerReward;
            IERC20(rewardToken).transfer(user, 1e18); // 1 token
        }
    }
}
