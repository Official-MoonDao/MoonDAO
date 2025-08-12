// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./XPManager.sol";

/**
 * @title ERC20RewardsExample
 * @notice Example contract demonstrating how to use the ERC20 rewards system (single token)
 */
contract ERC20RewardsExample {
    XPManager public xpManager;
    
    // Example reward token
    ERC20 public rewardToken;
    
    constructor(address _xpManager, address _rewardToken) {
        xpManager = XPManager(_xpManager);
        rewardToken = ERC20(_rewardToken);
    }
    
    /**
     * @notice Example function to set up ERC20 rewards
     * @dev This would typically be called by the contract owner
     */
    function setupRewards() external {
        // Example thresholds and rewards:
        // 100 XP = 10 tokens
        // 500 XP = 50 tokens  
        // 1000 XP = 100 tokens
        // 5000 XP = 500 tokens
        
        uint256[] memory thresholds = new uint256[](4);
        thresholds[0] = 100;
        thresholds[1] = 500;
        thresholds[2] = 1000;
        thresholds[3] = 5000;
        
        uint256[] memory rewards = new uint256[](4);
        rewards[0] = 10 * 10**18; // 10 tokens with 18 decimals
        rewards[1] = 50 * 10**18; // 50 tokens
        rewards[2] = 100 * 10**18; // 100 tokens
        rewards[3] = 500 * 10**18; // 500 tokens
        
        xpManager.setERC20RewardConfig(address(rewardToken), thresholds, rewards);
    }
    
    /**
     * @notice Example function to check available rewards for a user
     * @param user Address of the user
     * @return Available reward amount
     */
    function checkUserRewards(address user) external view returns (uint256) {
        return xpManager.getAvailableERC20Reward(user);
    }
    
    /**
     * @notice Example function to claim rewards for a user
     * @param user Address of the user
     */
    function claimRewardsForUser(address user) external {
        // Note: In a real implementation, you'd want to add access control
        // This is just an example of how to call the claim function
        xpManager.claimERC20Rewards();
    }
}

/**
 * @title ExampleRewardToken
 * @notice Simple ERC20 token for testing rewards
 */
contract ExampleRewardToken is ERC20 {
    constructor() ERC20("Example Reward Token", "ERT") {
        _mint(msg.sender, 1000000 * 10**18); // Mint 1M tokens
    }
}


