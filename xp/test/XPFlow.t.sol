// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/XPManager.sol";
import "../src/verifiers/OwnsCitizenNFT.sol";
import "../src/mocks/MockERC5643Citizen.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("XP Reward", "XPR") {
        _mint(msg.sender, 1000000 * 10**18);
    }
}

contract XPFlowTest is Test {
    XPManager public xpManager;
    OwnsCitizenNFT public citizenVerifier;
    MockERC5643Citizen public citizenNFT;
    MockERC20 public rewardToken;
    
    address public user = address(0x123);
    address public owner = address(0x456);
    address public treasury = address(0x789);
    address public table = address(0xABC);
    address public whitelist = address(0xDEF);
    address public discountList = address(0x111);

    function setUp() public {
        vm.startPrank(owner);
        
        // Deploy XP Manager
        xpManager = new XPManager();
        
        // Deploy Citizen NFT (mock for testing)
        citizenNFT = new MockERC5643Citizen(
            "MoonDAO Citizen",
            "CITIZEN",
            treasury,
            table,
            whitelist,
            discountList
        );
        
        // Deploy reward token
        rewardToken = new MockERC20();
        
        // Deploy verifier
        citizenVerifier = new OwnsCitizenNFT(address(citizenNFT));
        
        // Register verifier
        xpManager.registerVerifier(1, address(citizenVerifier));
        
        // Transfer tokens to XPManager for rewards
        rewardToken.transfer(address(xpManager), 1000000e18);
        
        // Set up ERC20 reward configuration
        uint256[] memory thresholds = new uint256[](4);
        thresholds[0] = 100;
        thresholds[1] = 500;
        thresholds[2] = 1000;
        thresholds[3] = 5000;
        uint256[] memory rewards = new uint256[](4);
        rewards[0] = 10e18;
        rewards[1] = 50e18;
        rewards[2] = 100e18;
        rewards[3] = 500e18;
        xpManager.setERC20RewardConfig(address(rewardToken), thresholds, rewards);
        
        vm.stopPrank();
    }

    function testCompleteFlow() public {
        console.log("Testing Complete XP Flow with ERC20 Rewards");
        
        // Step 1: User gets a Citizen NFT
        console.log("Step 1: User gets Citizen NFT");
        vm.startPrank(user);
        
        // Mock the minting process (in real scenario, user would call mintTo)
        // For testing, we'll just simulate ownership
        vm.mockCall(
            address(citizenNFT),
            abi.encodeWithSelector(citizenNFT.balanceOf.selector, user),
            abi.encode(1)
        );
        
        uint256 balance = citizenNFT.balanceOf(user);
        console.log("User Citizen NFT balance:", balance);
        assertEq(balance, 1);
        
        // Step 2: Create context for XP claim
        console.log("Step 2: Create XP claim context");
        bytes memory context = abi.encode(
            100 // xpAmount
        );
        
        // Step 3: Check eligibility
        console.log("Step 3: Check eligibility");
        (bool eligible, uint256 xpAmount) = citizenVerifier.isEligible(user, context);
        console.log("Eligible:", eligible);
        console.log("XP Amount:", xpAmount);
        assertTrue(eligible);
        assertEq(xpAmount, 100);
        
        // Step 4: Generate claim ID
        console.log("Step 4: Generate claim ID");
        bytes32 claimId = citizenVerifier.claimId(user, context);
        console.log("Claim ID:", vm.toString(claimId));
        
        // Step 5: Check if already claimed
        console.log("Step 5: Check claim status");
        bool alreadyClaimed = xpManager.usedProofs(claimId);
        console.log("Already claimed:", alreadyClaimed);
        assertFalse(alreadyClaimed);
        
        // Step 6: Claim XP
        console.log("Step 6: Claim XP");
        uint256 xpBefore = xpManager.userXP(user);
        console.log("XP before claim:", xpBefore);
        
        xpManager.claimXP(1, context);
        
        uint256 xpAfter = xpManager.userXP(user);
        console.log("XP after claim:", xpAfter);
        assertEq(xpAfter, xpBefore + 100);
        
        // Step 7: Check available ERC20 rewards
        console.log("Step 7: Check available ERC20 rewards");
        uint256 availableRewards = xpManager.getAvailableERC20Reward(user);
        console.log("Available rewards:", availableRewards);
        assertEq(availableRewards, 10e18, "Should have 10 tokens for 100 XP threshold");
        
        // Step 8: Claim ERC20 rewards
        console.log("Step 8: Claim ERC20 rewards");
        uint256 tokenBalanceBefore = rewardToken.balanceOf(user);
        console.log("Token balance before claim:", tokenBalanceBefore);
        
        xpManager.claimERC20Rewards();
        
        uint256 tokenBalanceAfter = rewardToken.balanceOf(user);
        console.log("Token balance after claim:", tokenBalanceAfter);
        assertEq(tokenBalanceAfter, tokenBalanceBefore + 10e18, "Should receive 10 tokens");
        
        // Step 9: Verify claim is marked as used
        console.log("Step 9: Verify claim marked as used");
        bool claimedAfter = xpManager.usedProofs(claimId);
        console.log("Claimed after:", claimedAfter);
        assertTrue(claimedAfter);
        
        // Step 10: Try to claim again (should fail)
        console.log("Step 10: Try to claim again (should fail)");
        vm.expectRevert("Already claimed");
        xpManager.claimXP(1, context);
        
        vm.stopPrank();
        
        console.log("Complete flow test passed!");
    }

    function testProgressiveRewards() public {
        console.log("Testing Progressive ERC20 Rewards");
        
        vm.startPrank(user);
        
        // Mock user has NFT
        vm.mockCall(
            address(citizenNFT),
            abi.encodeWithSelector(citizenNFT.balanceOf.selector, user),
            abi.encode(1)
        );
        
        // Step 1: Earn 100 XP and claim reward
        console.log("Step 1: Earn 100 XP");
        bytes memory context1 = abi.encode(100);
        xpManager.claimXP(1, context1);
        
        uint256 available1 = xpManager.getAvailableERC20Reward(user);
        console.log("Available rewards after 100 XP:", available1);
        assertEq(available1, 10e18, "Should have 10 tokens for 100 XP");
        
        xpManager.claimERC20Rewards();
        
        // Step 2: Earn 400 more XP (total 500) and claim reward
        console.log("Step 2: Earn 400 more XP (total 500)");
        bytes memory context2 = abi.encode(400);
        xpManager.claimXP(1, context2);
        
        uint256 available2 = xpManager.getAvailableERC20Reward(user);
        console.log("Available rewards after 500 XP:", available2);
        assertEq(available2, 50e18, "Should have 50 tokens for 500 XP threshold");
        
        xpManager.claimERC20Rewards();
        
        // Step 3: Earn 500 more XP (total 1000) and claim reward
        console.log("Step 3: Earn 500 more XP (total 1000)");
        bytes memory context3 = abi.encode(500);
        xpManager.claimXP(1, context3);
        
        uint256 available3 = xpManager.getAvailableERC20Reward(user);
        console.log("Available rewards after 1000 XP:", available3);
        assertEq(available3, 100e18, "Should have 100 tokens for 1000 XP threshold");
        
        xpManager.claimERC20Rewards();
        
        // Step 4: Check total tokens received
        uint256 totalTokens = rewardToken.balanceOf(user);
        console.log("Total tokens received:", totalTokens);
        assertEq(totalTokens, 160e18, "Should have received 10 + 50 + 100 = 160 tokens");
        
        vm.stopPrank();
        
        console.log("Progressive rewards test passed!");
    }

    function testUserWithoutNFT() public {
        console.log("Testing user without Citizen NFT");
        
        address userWithoutNFT = address(0x999);
        
        bytes memory context = abi.encode(
            100
        );
        
        // Mock user has no NFTs
        vm.mockCall(
            address(citizenNFT),
            abi.encodeWithSelector(citizenNFT.balanceOf.selector, userWithoutNFT),
            abi.encode(0)
        );
        
        (bool eligible, uint256 xpAmount) = citizenVerifier.isEligible(userWithoutNFT, context);
        console.log("Eligible:", eligible);
        console.log("XP Amount:", xpAmount);
        assertFalse(eligible);
        assertEq(xpAmount, 0);
        
        // Try to claim (should fail)
        vm.startPrank(userWithoutNFT);
        vm.expectRevert("Not eligible");
        xpManager.claimXP(1, context);
        vm.stopPrank();
        
        console.log("User without NFT test passed!");
    }

    function testNoRewardsForInsufficientXP() public {
        console.log("Testing no rewards for insufficient XP");
        
        vm.startPrank(user);
        
        // Mock user has NFT
        vm.mockCall(
            address(citizenNFT),
            abi.encodeWithSelector(citizenNFT.balanceOf.selector, user),
            abi.encode(1)
        );
        
        // Earn only 50 XP (below 100 threshold)
        bytes memory context = abi.encode(50);
        xpManager.claimXP(1, context);
        
        uint256 available = xpManager.getAvailableERC20Reward(user);
        console.log("Available rewards for 50 XP:", available);
        assertEq(available, 0, "Should have no rewards for insufficient XP");
        
        // Try to claim rewards (should fail)
        vm.expectRevert("No rewards to claim");
        xpManager.claimERC20Rewards();
        
        vm.stopPrank();
        
        console.log("No rewards for insufficient XP test passed!");
    }

    function testRewardConfiguration() public {
        console.log("Testing reward configuration");
        
        vm.startPrank(owner);
        
        // Check current configuration
        (address tokenAddr, uint256[] memory thresholds, uint256[] memory rewards, bool active) = 
            xpManager.getERC20RewardConfig();
            
        assertEq(tokenAddr, address(rewardToken));
        assertEq(thresholds.length, 4);
        assertEq(thresholds[0], 100);
        assertEq(thresholds[1], 500);
        assertEq(thresholds[2], 1000);
        assertEq(thresholds[3], 5000);
        assertEq(rewards[0], 10e18);
        assertEq(rewards[1], 50e18);
        assertEq(rewards[2], 100e18);
        assertEq(rewards[3], 500e18);
        assertTrue(active);
        
        // Test deactivation
        xpManager.deactivateERC20RewardConfig();
        
        (,,, bool activeAfter) = xpManager.getERC20RewardConfig();
        assertFalse(activeAfter);
        
        vm.stopPrank();
        
        console.log("Reward configuration test passed!");
    }

    // Multiple token rewards test removed for single-token config

    function testCannotClaimSameThresholdTwice() public {
        console.log("Testing cannot claim same threshold twice");
        
        vm.startPrank(user);
        
        // Mock user has NFT
        vm.mockCall(
            address(citizenNFT),
            abi.encodeWithSelector(citizenNFT.balanceOf.selector, user),
            abi.encode(1)
        );
        
        // Earn 100 XP and claim reward
        bytes memory context1 = abi.encode(100);
        xpManager.claimXP(1, context1);
        xpManager.claimERC20Rewards();
        
        // Earn more XP but don't reach next threshold
        bytes memory context2 = abi.encode(50);
        xpManager.claimXP(1, context2);
        
        // Try to claim rewards again (should fail - no new thresholds reached)
        vm.expectRevert("No rewards to claim");
        xpManager.claimERC20Rewards();
        
        vm.stopPrank();
        
        console.log("Cannot claim same threshold twice test passed!");
    }
}
