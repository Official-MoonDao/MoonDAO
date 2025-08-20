// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/XPManager.sol";
import "../src/FakeERC20.sol";

contract XPLevelsTest is Test {
    XPManager public xpManager;
    FakeERC20 public erc20Token;
    
    address public owner = address(0x1);
    address public user1 = address(0x2);
    address public user2 = address(0x3);
    
    function setUp() public {
        vm.startPrank(owner);
        
        // Deploy contracts
        xpManager = new XPManager();
        erc20Token = new FakeERC20("Test Token", "TEST");
        
        // Set up XP levels: More realistic progression based on actual verifier rewards
        uint256[] memory thresholds = new uint256[](6);
        uint256[] memory levels = new uint256[](6);
        
        thresholds[0] = 50;    // 50 XP = Level 1 (achievable with basic activities)
        thresholds[1] = 150;   // 150 XP = Level 2 (moderate engagement)
        thresholds[2] = 300;   // 300 XP = Level 3 (active user)
        thresholds[3] = 600;   // 600 XP = Level 4 (very active user)
        thresholds[4] = 1000;  // 1000 XP = Level 5 (power user)
        thresholds[5] = 2000;  // 2000 XP = Level 6 (whale/elite user)
        
        levels[0] = 1;
        levels[1] = 2;
        levels[2] = 3;
        levels[3] = 4;
        levels[4] = 5;
        levels[5] = 6;
        
        xpManager.setXPLevels(thresholds, levels);
        
        // Set ERC20 reward configuration: 1 XP = 0.001 tokens
        uint256 conversionRate = 1e15; // 0.001 * 10^18
        xpManager.setERC20RewardConfig(address(erc20Token), conversionRate);
        
        // Fund the XPManager with ERC20 tokens
        erc20Token.mint(address(xpManager), 1000e18); // 1000 tokens
        
        vm.stopPrank();
    }
    
    function testSetXPLevels() public {
        vm.startPrank(owner);
        
        uint256[] memory thresholds = new uint256[](2);
        uint256[] memory levels = new uint256[](2);
        
        thresholds[0] = 100;
        thresholds[1] = 500;
        levels[0] = 1;
        levels[1] = 2;
        
        xpManager.setXPLevels(thresholds, levels);
        
        (uint256[] memory newThresholds, uint256[] memory newLevels, bool active) = xpManager.getXPLevels();
        assertTrue(active);
        assertEq(newThresholds.length, 2);
        assertEq(newThresholds[0], 100);
        assertEq(newThresholds[1], 500);
        assertEq(newLevels[0], 1);
        assertEq(newLevels[1], 2);
        
        vm.stopPrank();
    }
    
    function testGetUserLevel() public {
        // User starts at level 0
        assertEq(xpManager.getUserLevel(user1), 0);
        
        // Grant 30 XP - still level 0
        vm.prank(owner);
        xpManager.resetUser(user1);
        _grantXP(user1, 30);
        assertEq(xpManager.getUserLevel(user1), 0);
        
        // Grant 50 XP - now level 1
        _grantXP(user1, 20);
        assertEq(xpManager.getUserLevel(user1), 1);
        
        // Grant 150 XP - now level 2
        _grantXP(user1, 100);
        assertEq(xpManager.getUserLevel(user1), 2);
        
        // Grant 300 XP - now level 3
        _grantXP(user1, 150);
        assertEq(xpManager.getUserLevel(user1), 3);
        
        // Grant 600 XP - now level 4
        _grantXP(user1, 300);
        assertEq(xpManager.getUserLevel(user1), 4);
        
        // Grant 1000 XP - now level 5
        _grantXP(user1, 400);
        assertEq(xpManager.getUserLevel(user1), 5);
        
        // Grant 2000 XP - now level 6
        _grantXP(user1, 1000);
        assertEq(xpManager.getUserLevel(user1), 6);
    }
    
    function testGetLevelForXP() public {
        assertEq(xpManager.getLevelForXP(0), 0);
        assertEq(xpManager.getLevelForXP(49), 0);
        assertEq(xpManager.getLevelForXP(50), 1);
        assertEq(xpManager.getLevelForXP(149), 1);
        assertEq(xpManager.getLevelForXP(150), 2);
        assertEq(xpManager.getLevelForXP(299), 2);
        assertEq(xpManager.getLevelForXP(300), 3);
        assertEq(xpManager.getLevelForXP(599), 3);
        assertEq(xpManager.getLevelForXP(600), 4);
        assertEq(xpManager.getLevelForXP(999), 4);
        assertEq(xpManager.getLevelForXP(1000), 5);
        assertEq(xpManager.getLevelForXP(1999), 5);
        assertEq(xpManager.getLevelForXP(2000), 6);
        assertEq(xpManager.getLevelForXP(5000), 6); // Max level
    }
    
    function testGetNextLevelInfo() public {
        // User with 0 XP
        (uint256 nextLevel, uint256 xpRequired, uint256 xpProgress) = xpManager.getNextLevelInfo(user1);
        assertEq(nextLevel, 1);
        assertEq(xpRequired, 50);
        assertEq(xpProgress, 0);
        
        // User with 30 XP
        _grantXP(user1, 30);
        (nextLevel, xpRequired, xpProgress) = xpManager.getNextLevelInfo(user1);
        assertEq(nextLevel, 1);
        assertEq(xpRequired, 50);
        assertEq(xpProgress, 30);
        
        // User with 50 XP (level 1)
        _grantXP(user1, 20);
        (nextLevel, xpRequired, xpProgress) = xpManager.getNextLevelInfo(user1);
        assertEq(nextLevel, 2);
        assertEq(xpRequired, 150);
        assertEq(xpProgress, 50);
        
        // User with 2000 XP (max level)
        _grantXP(user1, 1950);
        (nextLevel, xpRequired, xpProgress) = xpManager.getNextLevelInfo(user1);
        assertEq(nextLevel, 0); // No next level
        assertEq(xpRequired, 0);
        assertEq(xpProgress, 2000);
    }
    
    function testGetAllLevelInfo() public {
        _grantXP(user1, 100); // Between level 1 and 2
        
        (
            uint256[] memory thresholds,
            uint256[] memory levels,
            uint256 userLevel,
            uint256 currentUserXP,
            uint256 nextLevel,
            uint256 xpRequired,
            uint256 xpProgress
        ) = xpManager.getAllLevelInfo(user1);
        
        assertEq(thresholds.length, 6);
        assertEq(levels.length, 6);
        assertEq(userLevel, 1);
        assertEq(currentUserXP, 100);
        assertEq(nextLevel, 2);
        assertEq(xpRequired, 150);
        assertEq(xpProgress, 100);
    }
    
    function testERC20RewardsWithLevels() public {
        // User starts with 0 XP and 0 tokens
        assertEq(xpManager.getTotalXP(user1), 0);
        assertEq(erc20Token.balanceOf(user1), 0);
        
        // Grant 50 XP - should reach level 1 and get ERC20 tokens
        _grantXP(user1, 50);
        
        assertEq(xpManager.getTotalXP(user1), 50);
        assertEq(xpManager.getUserLevel(user1), 1);
        
        // Check ERC20 rewards: 50 XP * 0.001 = 0.05 tokens
        assertEq(erc20Token.balanceOf(user1), 5e16);
        
        // Grant another 100 XP - should reach level 2 and get more tokens
        _grantXP(user1, 100);
        
        assertEq(xpManager.getTotalXP(user1), 150);
        assertEq(xpManager.getUserLevel(user1), 2);
        
        // Check ERC20 rewards: 150 XP * 0.001 = 0.15 tokens total
        assertEq(erc20Token.balanceOf(user1), 15e16); // 0.15 tokens
        
        // Grant 150 more XP to reach level 3
        _grantXP(user1, 150);
        
        assertEq(xpManager.getTotalXP(user1), 300);
        assertEq(xpManager.getUserLevel(user1), 3);
        
        // Check ERC20 rewards: 300 XP * 0.001 = 0.3 tokens total
        assertEq(erc20Token.balanceOf(user1), 3e17);
    }
    
    function testLevelUpEvents() public {
        // Grant XP and check for level up events
        vm.expectEmit(true, false, false, true);
        emit XPManager.LevelUp(user1, 1, 50);
        _grantXP(user1, 50);
        
        vm.expectEmit(true, false, false, true);
        emit XPManager.LevelUp(user1, 2, 150);
        _grantXP(user1, 100);
        
        vm.expectEmit(true, false, false, true);
        emit XPManager.LevelUp(user1, 3, 300);
        _grantXP(user1, 150);
    }
    
    function testResetUserWithLevels() public {
        // Grant XP to user
        _grantXP(user1, 150);
        assertEq(xpManager.getTotalXP(user1), 150);
        assertEq(xpManager.getUserLevel(user1), 2);
        assertEq(erc20Token.balanceOf(user1), 15e16);
        
        // Reset user
        vm.prank(owner);
        xpManager.resetUser(user1);
        
        // Check everything is reset
        assertEq(xpManager.getTotalXP(user1), 0);
        assertEq(xpManager.getUserLevel(user1), 0);
        assertEq(erc20Token.balanceOf(user1), 0);
    }
    
    // Helper function to grant XP (bypassing verifier system for testing)
    function _grantXP(address user, uint256 amount) internal {
        // We'll use the reset function to clear the user first, then grant XP
        // This is a test-only approach
        vm.prank(owner);
        xpManager.resetUser(user);
        
        // For testing purposes, we'll directly call the internal function
        // In production, this would be done through verifiers
        bytes memory data = abi.encodeWithSignature("_grantXP(address,uint256)", user, amount);
        (bool success,) = address(xpManager).call(data);
        require(success, "Failed to grant XP");
    }
}
