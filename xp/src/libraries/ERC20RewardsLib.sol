// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ERC20RewardsLib
 * @dev Library for ERC20 reward calculations to reduce contract size
 */
library ERC20RewardsLib {
    using SafeERC20 for IERC20;

    struct ERC20RewardConfig {
        address tokenAddress;
        uint256 conversionRate; // How many ERC20 tokens per 1 XP (with decimals)
        bool active;
    }

    /**
     * @dev Calculate available ERC20 rewards for a user
     */
    function calculateAvailableReward(
        ERC20RewardConfig storage config,
        mapping(address => uint256) storage userXP,
        mapping(address => uint256) storage claimedRewards,
        address user
    ) internal view returns (uint256) {
        if (!config.active) {
            return 0;
        }

        uint256 totalEarned = (userXP[user] * config.conversionRate);
        uint256 alreadyClaimed = claimedRewards[user];
        
        if (totalEarned > alreadyClaimed) {
            return totalEarned - alreadyClaimed;
        }
        return 0;
    }

    /**
     * @dev Check if sufficient balance exists for projected payout
     */
    function checkSufficientBalance(
        ERC20RewardConfig storage config,
        mapping(address => uint256) storage userXP,
        mapping(address => uint256) storage claimedRewards,
        address user,
        uint256 additionalXP
    ) internal view returns (bool) {
        if (!config.active) {
            return true;
        }

        uint256 newTotalEarned = ((userXP[user] + additionalXP) * config.conversionRate);
        uint256 alreadyClaimed = claimedRewards[user];
        
        if (newTotalEarned > alreadyClaimed) {
            uint256 projectedPayout = newTotalEarned - alreadyClaimed;
            uint256 bal = IERC20(config.tokenAddress).balanceOf(address(this));
            return bal >= projectedPayout;
        }
        
        return true;
    }

    /**
     * @dev Claim ERC20 rewards for a user
     */
    function claimRewards(
        ERC20RewardConfig storage config,
        mapping(address => uint256) storage userXP,
        mapping(address => uint256) storage claimedRewards,
        address user
    ) internal returns (uint256 claimedAmount) {
        if (!config.active) {
            return 0;
        }

        uint256 availableReward = calculateAvailableReward(config, userXP, claimedRewards, user);
        if (availableReward > 0) {
            uint256 bal = IERC20(config.tokenAddress).balanceOf(address(this));
            require(bal >= availableReward, "Insufficient ERC20 balance");
            
            // Update claimed amount
            claimedRewards[user] += availableReward;
            
            // Transfer tokens
            IERC20(config.tokenAddress).safeTransfer(user, availableReward);
            
            return availableReward;
        }
        
        return 0;
    }
}
