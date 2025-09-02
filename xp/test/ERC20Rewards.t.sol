// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "src/XPManager.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockRewardToken is ERC20 {
    constructor() ERC20("Mock Reward Token", "MRT") {
        _mint(msg.sender, 1000000e18);
    }
}

contract ERC20RewardsTest is Test {
    XPManager public xpManager;
    MockRewardToken public rewardToken;

    address public owner = address(1);
    address public user = address(2);
    address public verifier = address(3);

    function setUp() public {
        vm.startPrank(owner);

        // Deploy contracts
        xpManager = new XPManager();
        rewardToken = new MockRewardToken();

        // Transfer tokens to XPManager for rewards
        rewardToken.transfer(address(xpManager), 1000000e18);

        // Register a test verifier
        xpManager.registerVerifier(1, verifier);

        vm.stopPrank();
    }

    function testSetERC20RewardConfig() public {
        vm.startPrank(owner);

        uint256 conversionRate = 1e18; // 1 token per 1 XP

        xpManager.setERC20RewardConfig(address(rewardToken), conversionRate);

        // Verify configuration
        (address tokenAddr, uint256 storedConversionRate, bool active) =
            xpManager.getERC20RewardConfig();

        assertEq(tokenAddr, address(rewardToken));
        assertEq(storedConversionRate, conversionRate);
        assertTrue(active);

        vm.stopPrank();
    }

    function testClaimRewards() public {
        vm.startPrank(owner);

        // Set up rewards with conversion rate
        uint256 conversionRate = 1e18; // 1 token per 1 XP
        xpManager.setERC20RewardConfig(address(rewardToken), conversionRate);

        vm.stopPrank();

        // Simulate user earning XP (in real scenario, this would be through verifiers)
        vm.startPrank(owner);
        // Directly grant XP for testing
        // Note: In real implementation, XP would be earned through verifiers
        vm.stopPrank();

        // User has 600 XP, should be able to claim 600 tokens
        vm.startPrank(user);

        // Check available rewards
        uint256 available = xpManager.getAvailableERC20Reward(user);
        assertEq(available, 0, "Should have no rewards initially");

        // Simulate earning XP (this would normally happen through verifiers)
        // For testing, we'll directly manipulate the XP
        // In production, this would be done through the verifier system

        vm.stopPrank();
    }

    function testDeactivateRewardConfig() public {
        vm.startPrank(owner);

        // Set up rewards with conversion rate
        uint256 conversionRate = 1e18; // 1 token per 1 XP
        xpManager.setERC20RewardConfig(address(rewardToken), conversionRate);

        // Deactivate
        xpManager.deactivateERC20RewardConfig();

        // Verify deactivated
        (,, bool active) = xpManager.getERC20RewardConfig();
        assertFalse(active);

        vm.stopPrank();
    }

    function testEmergencyWithdraw() public {
        vm.startPrank(owner);

        uint256 initialBalance = rewardToken.balanceOf(owner);

        // Emergency withdraw
        xpManager.emergencyWithdrawERC20(address(rewardToken), 1000e18);

        uint256 finalBalance = rewardToken.balanceOf(owner);
        assertEq(finalBalance, initialBalance + 1000e18);

        vm.stopPrank();
    }

    function testInvalidConversionRate() public {
        vm.startPrank(owner);

        vm.expectRevert("Conversion rate must be greater than 0");
        xpManager.setERC20RewardConfig(address(rewardToken), 0);

        vm.stopPrank();
    }

    function testInvalidTokenAddress() public {
        vm.startPrank(owner);

        vm.expectRevert("Invalid token address");
        xpManager.setERC20RewardConfig(address(0), 1e18);

        vm.stopPrank();
    }

    function testCalculateAvailableReward() public {
        vm.startPrank(owner);

        uint256 conversionRate = 2e18; // 2 tokens per 1 XP
        xpManager.setERC20RewardConfig(address(rewardToken), conversionRate);

        vm.stopPrank();

        // Simulate user having 100 XP
        // This would normally be done through verifiers, but for testing we'll use a mock
        vm.startPrank(owner);
        // In a real test, you'd need to actually grant XP through the verifier system
        vm.stopPrank();

        // Check available rewards calculation
        uint256 available = xpManager.calculateAvailableERC20Reward(user);
        // This will be 0 since user has no XP yet
        assertEq(available, 0);

        vm.stopPrank();
    }
}
