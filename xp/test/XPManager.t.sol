// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/XPManager.sol";
import "../src/verifiers/OwnsCitizenNFT.sol";
import "../src/mocks/MockERC5643Citizen.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 1000000 * 10**decimals()); // Mint 1M tokens to deployer
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract XPManagerTest is Test {
    XPManager public xpManager;
    OwnsCitizenNFT public citizenVerifier;
    MockERC5643Citizen public citizenNFT;
    MockERC20 public rewardToken;
    
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public owner = address(0x3);
    address public relayer = address(0x4);

    function setUp() public {
        // Deploy Citizen NFT
        citizenNFT = new MockERC5643Citizen("MoonDAO Citizen", "CITIZEN", address(0), address(0), address(0), address(0));
        
        // Deploy XPManager
        xpManager = new XPManager();
        
        // Deploy reward token
        rewardToken = new MockERC20("Reward Token", "REWARD");
        
        // Deploy verifier with initial xpPerClaim
        citizenVerifier = new OwnsCitizenNFT(address(citizenNFT), 25);
        
        // Register verifier
        xpManager.registerVerifier(1, address(citizenVerifier));
        
        // Give users some Citizen NFTs
        citizenNFT.mintTo(user1);
        citizenNFT.mintTo(user2);
        
        // Transfer ownership from current owner (deployer)
        xpManager.transferOwnership(owner);
        
        // Fund XPManager with reward tokens for testing
        rewardToken.transfer(address(xpManager), 10000 * 10**18);
    }

    function testInitialState() public {
        assertEq(xpManager.userXP(user1), 0);
        assertEq(xpManager.userXP(user2), 0);
    }

    function testClaimXP() public {
        vm.startPrank(user1);
        
        // Context: any value (verifier returns fixed xpPerClaim = 25)
        bytes memory context = abi.encode(100);
        
        // Claim XP
        xpManager.claimXP(1, context);
        
        // Check XP was awarded (verifier gives 25 XP regardless of context)
        assertEq(xpManager.userXP(user1), 25);
        
        vm.stopPrank();
    }

    function testMultipleXPClaims() public {
        vm.startPrank(user1);
        
        // First claim: verifier gives 25 XP
        bytes memory context1 = abi.encode(15);
        xpManager.claimXP(1, context1);
        assertEq(xpManager.userXP(user1), 25);
        
        // Second claim: verifier gives 25 XP again
        bytes memory context2 = abi.encode(40);
        xpManager.claimXP(1, context2);
        assertEq(xpManager.userXP(user1), 50);
        
        // Third claim: verifier gives 25 XP again
        bytes memory context3 = abi.encode(50);
        xpManager.claimXP(1, context3);
        assertEq(xpManager.userXP(user1), 75);
        
        vm.stopPrank();
    }

    function testGetTotalXP() public {
        vm.startPrank(user1);
        
        bytes memory context = abi.encode(100);
        xpManager.claimXP(1, context);
        
        assertEq(xpManager.getTotalXP(user1), 25);
        
        vm.stopPrank();
    }

    function testCannotClaimTwice() public {
        vm.startPrank(user1);
        
        bytes memory context = abi.encode(25);
        xpManager.claimXP(1, context);
        
        // Try to claim again with same context
        vm.expectRevert("Already claimed");
        xpManager.claimXP(1, context);
        
        vm.stopPrank();
    }

    function testCannotClaimWithoutEligibility() public {
        address userWithoutNFT = address(0x5);
        vm.startPrank(userWithoutNFT);
        
        // Context - verifier will return 0 XP since user has no NFT
        bytes memory context = abi.encode(25);
        
        vm.expectRevert("Not eligible");
        xpManager.claimXP(1, context);
        
        vm.stopPrank();
    }

    function testCannotClaimWithoutCitizenNFT() public {
        address userWithoutNFT = address(0x4);
        vm.startPrank(userWithoutNFT);
        
        bytes memory context = abi.encode(25);
        
        vm.expectRevert("Not eligible");
        xpManager.claimXP(1, context);
        
        vm.stopPrank();
    }

    function testOnlyOwnerCanRegisterVerifier() public {
        vm.startPrank(user1);
        
        vm.expectRevert();
        xpManager.registerVerifier(2, address(0x5));
        
        vm.stopPrank();
    }

    function testEvents() public {
        vm.startPrank(user1);
        
        bytes memory context = abi.encode(25);
        
        // Expect event for XP earned
        vm.expectEmit(true, false, false, true);
        emit XPManager.XPEarned(user1, 25, 25);
        
        xpManager.claimXP(1, context);
        
        vm.stopPrank();
    }

    function testMultipleUsers() public {
        // User 1 claims XP
        vm.startPrank(user1);
        bytes memory context1 = abi.encode(30);
        xpManager.claimXP(1, context1);
        assertEq(xpManager.userXP(user1), 25);
        vm.stopPrank();
        
        // User 2 claims XP
        vm.startPrank(user2);
        bytes memory context2 = abi.encode(45);
        xpManager.claimXP(1, context2);
        assertEq(xpManager.userXP(user2), 25);
        vm.stopPrank();
        
        // Verify totals
        assertEq(xpManager.userXP(user1), 25);
        assertEq(xpManager.userXP(user2), 25);
    }

    function testVerifierRegistration() public {
        vm.startPrank(owner);
        
        // Register a new verifier
        xpManager.registerVerifier(2, address(0x5));
        assertEq(xpManager.verifiers(2), address(0x5));
        
        vm.stopPrank();
    }

    function testInvalidVerifierAddress() public {
        vm.startPrank(owner);
        
        vm.expectRevert("Invalid verifier address");
        xpManager.registerVerifier(2, address(0));
        
        vm.stopPrank();
    }

    function testVerifierNotFound() public {
        vm.startPrank(user1);
        
        bytes memory context = abi.encode(25);
        
        vm.expectRevert("Verifier not found");
        xpManager.claimXP(999, context); // Non-existent verifier ID
        
        vm.stopPrank();
    }

    // ===== ERC20 REWARD TESTS =====

    function testSetERC20RewardConfig() public {
        vm.startPrank(owner);
        
        uint256[] memory thresholds = new uint256[](3);
        thresholds[0] = 100;
        thresholds[1] = 500;
        thresholds[2] = 1000;
        
        uint256[] memory rewardAmounts = new uint256[](3);
        rewardAmounts[0] = 10 * 10**18;
        rewardAmounts[1] = 50 * 10**18;
        rewardAmounts[2] = 100 * 10**18;
        
        // Expect event
        vm.expectEmit(true, false, false, true);
        emit XPManager.ERC20RewardConfigSet(address(rewardToken), thresholds, rewardAmounts);
        
        xpManager.setERC20RewardConfig(address(rewardToken), thresholds, rewardAmounts);
        
        // Verify configuration
        (address tokenAddress, uint256[] memory returnedThresholds, uint256[] memory returnedRewards, bool active) = xpManager.getERC20RewardConfig();
        assertEq(tokenAddress, address(rewardToken));
        assertEq(returnedThresholds.length, 3);
        assertEq(returnedThresholds[0], 100);
        assertEq(returnedThresholds[1], 500);
        assertEq(returnedThresholds[2], 1000);
        assertEq(returnedRewards[0], 10 * 10**18);
        assertEq(returnedRewards[1], 50 * 10**18);
        assertEq(returnedRewards[2], 100 * 10**18);
        assertTrue(active);
        
        vm.stopPrank();
    }

    function testSetERC20RewardConfigInvalidToken() public {
        vm.startPrank(owner);
        
        uint256[] memory thresholds = new uint256[](1);
        thresholds[0] = 100;
        
        uint256[] memory rewardAmounts = new uint256[](1);
        rewardAmounts[0] = 10 * 10**18;
        
        vm.expectRevert("Invalid token address");
        xpManager.setERC20RewardConfig(address(0), thresholds, rewardAmounts);
        
        vm.stopPrank();
    }

    function testSetERC20RewardConfigArrayMismatch() public {
        vm.startPrank(owner);
        
        uint256[] memory thresholds = new uint256[](2);
        thresholds[0] = 100;
        thresholds[1] = 500;
        
        uint256[] memory rewardAmounts = new uint256[](1);
        rewardAmounts[0] = 10 * 10**18;
        
        vm.expectRevert("Arrays length mismatch");
        xpManager.setERC20RewardConfig(address(rewardToken), thresholds, rewardAmounts);
        
        vm.stopPrank();
    }

    function testSetERC20RewardConfigEmptyThresholds() public {
        vm.startPrank(owner);
        
        uint256[] memory thresholds = new uint256[](0);
        uint256[] memory rewardAmounts = new uint256[](0);
        
        vm.expectRevert("No thresholds provided");
        xpManager.setERC20RewardConfig(address(rewardToken), thresholds, rewardAmounts);
        
        vm.stopPrank();
    }

    function testSetERC20RewardConfigNonAscendingThresholds() public {
        vm.startPrank(owner);
        
        uint256[] memory thresholds = new uint256[](3);
        thresholds[0] = 100;
        thresholds[1] = 500;
        thresholds[2] = 300; // Not ascending
        
        uint256[] memory rewardAmounts = new uint256[](3);
        rewardAmounts[0] = 10 * 10**18;
        rewardAmounts[1] = 50 * 10**18;
        rewardAmounts[2] = 100 * 10**18;
        
        vm.expectRevert("Thresholds must be ascending");
        xpManager.setERC20RewardConfig(address(rewardToken), thresholds, rewardAmounts);
        
        vm.stopPrank();
    }

    function testOnlyOwnerCanSetERC20RewardConfig() public {
        vm.startPrank(user1);
        
        uint256[] memory thresholds = new uint256[](1);
        thresholds[0] = 100;
        
        uint256[] memory rewardAmounts = new uint256[](1);
        rewardAmounts[0] = 10 * 10**18;
        
        vm.expectRevert();
        xpManager.setERC20RewardConfig(address(rewardToken), thresholds, rewardAmounts);
        
        vm.stopPrank();
    }

    function testDeactivateERC20RewardConfig() public {
        // First set up rewards
        vm.startPrank(owner);
        
        uint256[] memory thresholds = new uint256[](1);
        thresholds[0] = 100;
        
        uint256[] memory rewardAmounts = new uint256[](1);
        rewardAmounts[0] = 10 * 10**18;
        
        xpManager.setERC20RewardConfig(address(rewardToken), thresholds, rewardAmounts);
        
        // Verify it's active
        (, , , bool active) = xpManager.getERC20RewardConfig();
        assertTrue(active);
        
        // Expect event
        vm.expectEmit(true, false, false, false);
        emit XPManager.ERC20RewardConfigDeactivated(address(rewardToken));
        
        // Deactivate
        xpManager.deactivateERC20RewardConfig();
        
        // Verify it's inactive
        (, , , bool activeAfter) = xpManager.getERC20RewardConfig();
        assertFalse(activeAfter);
        
        vm.stopPrank();
    }

    function testDeactivateERC20RewardConfigNotActive() public {
        vm.startPrank(owner);
        
        vm.expectRevert("Config not active");
        xpManager.deactivateERC20RewardConfig();
        
        vm.stopPrank();
    }

    function testCalculateERC20Reward() public {
        // Set up rewards
        vm.startPrank(owner);
        
        uint256[] memory thresholds = new uint256[](3);
        thresholds[0] = 25;  // First claim
        thresholds[1] = 50;  // Second claim
        thresholds[2] = 75;  // Third claim
        
        uint256[] memory rewardAmounts = new uint256[](3);
        rewardAmounts[0] = 5 * 10**18;
        rewardAmounts[1] = 10 * 10**18;
        rewardAmounts[2] = 20 * 10**18;
        
        xpManager.setERC20RewardConfig(address(rewardToken), thresholds, rewardAmounts);
        
        vm.stopPrank();
        
        // User has no XP initially
        assertEq(xpManager.calculateERC20Reward(user1), 0);
        
        // Give user1 25 XP (one claim)
        vm.startPrank(user1);
        bytes memory context = abi.encode(100);
        xpManager.claimXP(1, context);
        vm.stopPrank();
        
        // Should be eligible for first threshold only
        assertEq(xpManager.calculateERC20Reward(user1), 5 * 10**18);
        
        // Give user1 more XP to reach 50 total (second claim)
        vm.startPrank(user1);
        bytes memory context2 = abi.encode(200); // Different context for unique claimId
        xpManager.claimXP(1, context2);
        vm.stopPrank();
        
        // Should be eligible for first two thresholds
        assertEq(xpManager.calculateERC20Reward(user1), 15 * 10**18); // 5 + 10
        
        // Give user1 more XP to reach 75 total (third claim)
        vm.startPrank(user1);
        bytes memory context3 = abi.encode(300); // Different context for unique claimId
        xpManager.claimXP(1, context3);
        vm.stopPrank();
        
        // Should be eligible for all thresholds
        assertEq(xpManager.calculateERC20Reward(user1), 35 * 10**18); // 5 + 10 + 20
    }

    function testCalculateERC20RewardInactiveConfig() public {
        // No config set - should return 0
        assertEq(xpManager.calculateERC20Reward(user1), 0);
    }

    function testClaimERC20Rewards() public {
        // Set up rewards
        vm.startPrank(owner);
        
        uint256[] memory thresholds = new uint256[](2);
        thresholds[0] = 25;  // First claim
        thresholds[1] = 50;  // Second claim
        
        uint256[] memory rewardAmounts = new uint256[](2);
        rewardAmounts[0] = 5 * 10**18;
        rewardAmounts[1] = 10 * 10**18;
        
        xpManager.setERC20RewardConfig(address(rewardToken), thresholds, rewardAmounts);
        
        vm.stopPrank();
        
        // Give user1 50 XP (two claims)
        vm.startPrank(user1);
        bytes memory context = abi.encode(100);
        xpManager.claimXP(1, context); // 25 XP
        bytes memory context2 = abi.encode(200); // Different context for unique claimId
        xpManager.claimXP(1, context2); // 50 XP total
        vm.stopPrank();
        
        // Check initial balance
        uint256 initialBalance = rewardToken.balanceOf(user1);
        
        // Claim rewards
        vm.startPrank(user1);
        
        // Expect event
        vm.expectEmit(true, true, false, true);
        emit XPManager.ERC20RewardClaimed(user1, address(rewardToken), 15 * 10**18);
        
        xpManager.claimERC20Rewards();
        
        // Check balance increased
        assertEq(rewardToken.balanceOf(user1), initialBalance + 15 * 10**18);
        
        // Check highest threshold was updated
        assertEq(xpManager.highestThresholdReached(user1), 50);
        
        vm.stopPrank();
    }

    function testClaimERC20RewardsNoRewards() public {
        // Set up rewards
        vm.startPrank(owner);
        
        uint256[] memory thresholds = new uint256[](1);
        thresholds[0] = 100;
        
        uint256[] memory rewardAmounts = new uint256[](1);
        rewardAmounts[0] = 10 * 10**18;
        
        xpManager.setERC20RewardConfig(address(rewardToken), thresholds, rewardAmounts);
        
        vm.stopPrank();
        
        // User has no XP
        vm.startPrank(user1);
        
        vm.expectRevert("No rewards to claim");
        xpManager.claimERC20Rewards();
        
        vm.stopPrank();
    }

    function testClaimERC20RewardsInactiveConfig() public {
        vm.startPrank(user1);
        
        vm.expectRevert("Reward config not active");
        xpManager.claimERC20Rewards();
        
        vm.stopPrank();
    }

    function testClaimERC20RewardsOnlyOnce() public {
        // Set up rewards
        vm.startPrank(owner);
        
        uint256[] memory thresholds = new uint256[](1);
        thresholds[0] = 25;  // First claim threshold
        
        uint256[] memory rewardAmounts = new uint256[](1);
        rewardAmounts[0] = 5 * 10**18;
        
        xpManager.setERC20RewardConfig(address(rewardToken), thresholds, rewardAmounts);
        
        vm.stopPrank();
        
        // Give user1 25 XP
        vm.startPrank(user1);
        bytes memory context = abi.encode(100);
        xpManager.claimXP(1, context);
        vm.stopPrank();
        
        // Claim rewards first time
        vm.startPrank(user1);
        xpManager.claimERC20Rewards();
        
        // Try to claim again - should fail
        vm.expectRevert("No rewards to claim");
        xpManager.claimERC20Rewards();
        
        vm.stopPrank();
    }

    function testGetAvailableERC20Reward() public {
        // Set up rewards
        vm.startPrank(owner);
        
        uint256[] memory thresholds = new uint256[](1);
        thresholds[0] = 25;  // First claim threshold
        
        uint256[] memory rewardAmounts = new uint256[](1);
        rewardAmounts[0] = 5 * 10**18;
        
        xpManager.setERC20RewardConfig(address(rewardToken), thresholds, rewardAmounts);
        
        vm.stopPrank();
        
        // Give user1 25 XP
        vm.startPrank(user1);
        bytes memory context = abi.encode(100);
        xpManager.claimXP(1, context);
        vm.stopPrank();
        
        // Check available reward
        assertEq(xpManager.getAvailableERC20Reward(user1), 5 * 10**18);
        
        // Claim rewards
        vm.startPrank(user1);
        xpManager.claimERC20Rewards();
        vm.stopPrank();
        
        // Available reward should now be 0
        assertEq(xpManager.getAvailableERC20Reward(user1), 0);
    }

    function testEmergencyWithdrawERC20() public {
        uint256 withdrawAmount = 1000 * 10**18;
        uint256 initialOwnerBalance = rewardToken.balanceOf(owner);
        
        vm.startPrank(owner);
        
        xpManager.emergencyWithdrawERC20(address(rewardToken), withdrawAmount);
        
        assertEq(rewardToken.balanceOf(owner), initialOwnerBalance + withdrawAmount);
        
        vm.stopPrank();
    }

    function testOnlyOwnerCanEmergencyWithdraw() public {
        vm.startPrank(user1);
        
        vm.expectRevert();
        xpManager.emergencyWithdrawERC20(address(rewardToken), 1000);
        
        vm.stopPrank();
    }

    // ===== CLAIM XP FOR TESTS =====

    function testClaimXPFor() public {
        // Relayer claims XP for user1
        vm.startPrank(relayer);
        
        bytes memory context = abi.encode(50);
        
        // Expect event for user1 (verifier gives 25 XP)
        vm.expectEmit(true, false, false, true);
        emit XPManager.XPEarned(user1, 25, 25);
        
        xpManager.claimXPFor(user1, 1, context);
        
        // Check XP was awarded to user1
        assertEq(xpManager.userXP(user1), 25);
        
        vm.stopPrank();
    }

    function testClaimXPForInvalidUser() public {
        vm.startPrank(relayer);
        
        bytes memory context = abi.encode(50);
        
        vm.expectRevert("Invalid user");
        xpManager.claimXPFor(address(0), 1, context);
        
        vm.stopPrank();
    }

    function testClaimXPForVerifierNotFound() public {
        vm.startPrank(relayer);
        
        bytes memory context = abi.encode(50);
        
        vm.expectRevert("Verifier not found");
        xpManager.claimXPFor(user1, 999, context);
        
        vm.stopPrank();
    }

    function testClaimXPForAlreadyClaimed() public {
        vm.startPrank(relayer);
        
        bytes memory context = abi.encode(50);
        xpManager.claimXPFor(user1, 1, context);
        
        // Try to claim again with same context
        vm.expectRevert("Already claimed");
        xpManager.claimXPFor(user1, 1, context);
        
        vm.stopPrank();
    }

    function testClaimXPForNotEligible() public {
        address userWithoutNFT = address(0x5);
        
        vm.startPrank(relayer);
        
        bytes memory context = abi.encode(50);
        
        vm.expectRevert("Not eligible");
        xpManager.claimXPFor(userWithoutNFT, 1, context);
        
        vm.stopPrank();
    }

    function testClaimXPForNoXP() public {
        address userWithoutNFT = address(0x6);
        vm.startPrank(relayer);
        
        bytes memory context = abi.encode(100);
        
        vm.expectRevert("Not eligible");
        xpManager.claimXPFor(userWithoutNFT, 1, context);
        
        vm.stopPrank();
    }

    // ===== INTEGRATION TESTS =====

    function testIntegratedXPAndRewardFlow() public {
        // Set up rewards
        vm.startPrank(owner);
        
        uint256[] memory thresholds = new uint256[](3);
        thresholds[0] = 25;  // First claim
        thresholds[1] = 50;  // Second claim
        thresholds[2] = 75;  // Third claim
        
        uint256[] memory rewardAmounts = new uint256[](3);
        rewardAmounts[0] = 5 * 10**18;
        rewardAmounts[1] = 10 * 10**18;
        rewardAmounts[2] = 20 * 10**18;
        
        xpManager.setERC20RewardConfig(address(rewardToken), thresholds, rewardAmounts);
        
        vm.stopPrank();
        
        // User1 claims 25 XP (first claim)
        vm.startPrank(user1);
        bytes memory context1 = abi.encode(100);
        xpManager.claimXP(1, context1);
        vm.stopPrank();
        
        // Should be eligible for first threshold
        assertEq(xpManager.getAvailableERC20Reward(user1), 5 * 10**18);
        
        // Claim rewards
        vm.startPrank(user1);
        uint256 initialBalance = rewardToken.balanceOf(user1);
        xpManager.claimERC20Rewards();
        assertEq(rewardToken.balanceOf(user1), initialBalance + 5 * 10**18);
        vm.stopPrank();
        
        // User1 claims more XP to reach 50 total
        vm.startPrank(user1);
        bytes memory context2 = abi.encode(200); // Different context for unique claimId
        xpManager.claimXP(1, context2);
        vm.stopPrank();
        
        // Should be eligible for second threshold only (first already claimed)
        assertEq(xpManager.getAvailableERC20Reward(user1), 10 * 10**18);
        
        // Claim rewards again
        vm.startPrank(user1);
        uint256 balanceBeforeSecond = rewardToken.balanceOf(user1);
        xpManager.claimERC20Rewards();
        assertEq(rewardToken.balanceOf(user1), balanceBeforeSecond + 10 * 10**18);
        vm.stopPrank();
        
        // User1 claims more XP to reach 75 total
        vm.startPrank(user1);
        bytes memory context3 = abi.encode(300); // Different context for unique claimId
        xpManager.claimXP(1, context3);
        vm.stopPrank();
        
        // Should be eligible for third threshold only
        assertEq(xpManager.getAvailableERC20Reward(user1), 20 * 10**18);
        
        // Final claim
        vm.startPrank(user1);
        uint256 balanceBeforeThird = rewardToken.balanceOf(user1);
        xpManager.claimERC20Rewards();
        assertEq(rewardToken.balanceOf(user1), balanceBeforeThird + 20 * 10**18);
        vm.stopPrank();
        
        // No more rewards available
        assertEq(xpManager.getAvailableERC20Reward(user1), 0);
    }

    function testMultipleUsersRewards() public {
        // Set up rewards
        vm.startPrank(owner);
        
        uint256[] memory thresholds = new uint256[](2);
        thresholds[0] = 25;  // First claim
        thresholds[1] = 50;  // Second claim
        
        uint256[] memory rewardAmounts = new uint256[](2);
        rewardAmounts[0] = 5 * 10**18;
        rewardAmounts[1] = 10 * 10**18;
        
        xpManager.setERC20RewardConfig(address(rewardToken), thresholds, rewardAmounts);
        
        vm.stopPrank();
        
        // User1 gets 25 XP (one claim)
        vm.startPrank(user1);
        bytes memory context1 = abi.encode(100);
        xpManager.claimXP(1, context1);
        vm.stopPrank();
        
        // User2 gets 50 XP (two claims)
        vm.startPrank(user2);
        bytes memory context2a = abi.encode(100);
        xpManager.claimXP(1, context2a);
        bytes memory context2b = abi.encode(200); // Different context for unique claimId
        xpManager.claimXP(1, context2b);
        vm.stopPrank();
        
        // Check available rewards
        assertEq(xpManager.getAvailableERC20Reward(user1), 5 * 10**18); // First threshold only
        assertEq(xpManager.getAvailableERC20Reward(user2), 15 * 10**18); // Both thresholds
        
        // Both users claim
        uint256 user1InitialBalance = rewardToken.balanceOf(user1);
        uint256 user2InitialBalance = rewardToken.balanceOf(user2);
        
        vm.startPrank(user1);
        xpManager.claimERC20Rewards();
        vm.stopPrank();
        
        vm.startPrank(user2);
        xpManager.claimERC20Rewards();
        vm.stopPrank();
        
        assertEq(rewardToken.balanceOf(user1), user1InitialBalance + 5 * 10**18);
        assertEq(rewardToken.balanceOf(user2), user2InitialBalance + 15 * 10**18);
    }
}
