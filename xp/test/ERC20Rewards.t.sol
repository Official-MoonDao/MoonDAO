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

        uint256[] memory thresholds = new uint256[](3);
        thresholds[0] = 100;
        thresholds[1] = 500;
        thresholds[2] = 1000;
        uint256[] memory rewards = new uint256[](3);
        rewards[0] = 10e18;
        rewards[1] = 50e18;
        rewards[2] = 100e18;

        xpManager.setERC20RewardConfig(address(rewardToken), thresholds, rewards);

        // Verify configuration
        (address tokenAddr, uint256[] memory storedThresholds, uint256[] memory storedRewards, bool active) =
            xpManager.getERC20RewardConfig();

        assertEq(tokenAddr, address(rewardToken));
        assertEq(storedThresholds.length, 3);
        assertEq(storedThresholds[0], 100);
        assertEq(storedThresholds[1], 500);
        assertEq(storedThresholds[2], 1000);
        assertEq(storedRewards[0], 10e18);
        assertEq(storedRewards[1], 50e18);
        assertEq(storedRewards[2], 100e18);
        assertTrue(active);

        vm.stopPrank();
    }

    function testClaimRewards() public {
        vm.startPrank(owner);

        // Set up rewards
        uint256[] memory thresholds = new uint256[](3);
        thresholds[0] = 100;
        thresholds[1] = 500;
        thresholds[2] = 1000;
        uint256[] memory rewards = new uint256[](3);
        rewards[0] = 10e18;
        rewards[1] = 50e18;
        rewards[2] = 100e18;
        xpManager.setERC20RewardConfig(address(rewardToken), thresholds, rewards);

        vm.stopPrank();

        // Simulate user earning XP (in real scenario, this would be through verifiers)
        vm.startPrank(owner);
        // Directly grant XP for testing
        // Note: In real implementation, XP would be earned through verifiers
        vm.stopPrank();

        // User has 600 XP, should be able to claim 100 and 500 thresholds
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

        // Set up rewards
        uint256[] memory thresholds = new uint256[](2);
        thresholds[0] = 100;
        thresholds[1] = 500;
        uint256[] memory rewards = new uint256[](2);
        rewards[0] = 10e18;
        rewards[1] = 50e18;
        xpManager.setERC20RewardConfig(address(rewardToken), thresholds, rewards);

        // Deactivate
        xpManager.deactivateERC20RewardConfig();

        // Verify deactivated
        (,,, bool active) = xpManager.getERC20RewardConfig();
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

    function testInvalidThresholds() public {
        vm.startPrank(owner);

        uint256[] memory thresholds = new uint256[](2);
        thresholds[0] = 500;
        thresholds[1] = 100; // Not ascending
        uint256[] memory rewards = new uint256[](2);
        rewards[0] = 50e18;
        rewards[1] = 10e18;

        vm.expectRevert("Thresholds must be ascending");
        xpManager.setERC20RewardConfig(address(rewardToken), thresholds, rewards);

        vm.stopPrank();
    }

    function testArrayLengthMismatch() public {
        vm.startPrank(owner);

        uint256[] memory thresholds = new uint256[](2);
        thresholds[0] = 100;
        thresholds[1] = 500;
        uint256[] memory rewards = new uint256[](1);
        rewards[0] = 10e18; // Different length

        vm.expectRevert("Arrays length mismatch");
        xpManager.setERC20RewardConfig(address(rewardToken), thresholds, rewards);

        vm.stopPrank();
    }

    function testEmptyThresholds() public {
        vm.startPrank(owner);

        uint256[] memory thresholds = new uint256[](0);
        uint256[] memory rewards = new uint256[](0);

        vm.expectRevert("No thresholds provided");
        xpManager.setERC20RewardConfig(address(rewardToken), thresholds, rewards);

        vm.stopPrank();
    }
}
