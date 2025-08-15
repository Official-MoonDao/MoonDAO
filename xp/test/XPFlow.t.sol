// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/XPManager.sol";
import "../src/verifiers/OwnsCitizenNFT.sol";
import "../src/mocks/MockERC5643Citizen.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("XP Reward", "XPR") {
        _mint(msg.sender, 1000000 * 10 ** 18);
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
    address public whitelist = address(0xDEF);
    address public discountList = address(0x111);

    function setUp() public {
        vm.startPrank(owner);

        // Deploy XP Manager
        xpManager = new XPManager();

        // Deploy Citizen NFT (mock for testing)
        citizenNFT = new MockERC5643Citizen("MoonDAO Citizen", "CITIZEN", treasury, address(0xABC), whitelist, discountList);

        // Deploy reward token
        rewardToken = new MockERC20();

        // Deploy verifier with initial xpPerClaim
        citizenVerifier = new OwnsCitizenNFT(address(citizenNFT), 100);

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
        // Step 1: User gets a Citizen NFT
        vm.startPrank(user);

        // Mock the minting process (in real scenario, user would call mintTo)
        // For testing, we'll just simulate ownership
        vm.mockCall(address(citizenNFT), abi.encodeWithSelector(citizenNFT.balanceOf.selector, user), abi.encode(1));

        uint256 balance = citizenNFT.balanceOf(user);
        assertEq(balance, 1);

        // Step 2: Create context for XP claim
        bytes memory context = abi.encode(
            100 // xpAmount
        );

        // Step 3: Check eligibility
        (bool eligible, uint256 xpAmount) = citizenVerifier.isEligible(user, context);
        assertTrue(eligible);
        assertEq(xpAmount, 100);

        // Step 4: Generate claim ID
        bytes32 claimId = citizenVerifier.claimId(user, context);

        // Step 5: Check if already claimed
        bool alreadyClaimed = xpManager.usedProofs(claimId);
        assertFalse(alreadyClaimed);

        // Step 6: Claim XP
        uint256 xpBefore = xpManager.userXP(user);

        xpManager.claimXP(1, context);

        uint256 xpAfter = xpManager.userXP(user);
        assertEq(xpAfter, xpBefore + 100);

        // Step 7: Check available ERC20 rewards
        uint256 availableRewards = xpManager.getAvailableERC20Reward(user);
        assertEq(availableRewards, 10e18, "Should have 10 tokens for 100 XP threshold");

        // Step 8: Claim ERC20 rewards
        uint256 tokenBalanceBefore = rewardToken.balanceOf(user);

        xpManager.claimERC20Rewards();

        uint256 tokenBalanceAfter = rewardToken.balanceOf(user);
        assertEq(tokenBalanceAfter, tokenBalanceBefore + 10e18, "Should receive 10 tokens");

        // Step 9: Verify claim is marked as used
        bool claimedAfter = xpManager.usedProofs(claimId);
        assertTrue(claimedAfter);

        // Step 10: Try to claim again (should fail)
        vm.expectRevert("Already claimed");
        xpManager.claimXP(1, context);

        vm.stopPrank();
    }

    function testProgressiveRewards() public {

        vm.startPrank(user);

        // Mock user has NFT
        vm.mockCall(address(citizenNFT), abi.encodeWithSelector(citizenNFT.balanceOf.selector, user), abi.encode(1));

        // Step 1: Earn 100 XP and claim reward
        bytes memory context1 = abi.encode(100);
        xpManager.claimXP(1, context1);

        uint256 available1 = xpManager.getAvailableERC20Reward(user);
        assertEq(available1, 10e18, "Should have 10 tokens for 100 XP");

        xpManager.claimERC20Rewards();

        // Step 2: Earn 100 more XP (total 200) - need to reach 500 threshold
        bytes memory context2 = abi.encode(200); // Different context for unique claimId
        xpManager.claimXP(1, context2);

        // Step 3: Earn 100 more XP (total 300)
        bytes memory context3 = abi.encode(300); // Different context for unique claimId
        xpManager.claimXP(1, context3);

        // Step 4: Earn 100 more XP (total 400)
        bytes memory context4 = abi.encode(400); // Different context for unique claimId
        xpManager.claimXP(1, context4);

        // Step 5: Earn 100 more XP (total 500) and claim reward
        bytes memory context5 = abi.encode(500); // Different context for unique claimId
        xpManager.claimXP(1, context5);

        uint256 available2 = xpManager.getAvailableERC20Reward(user);
        assertEq(available2, 50e18, "Should have 50 tokens for 500 XP threshold");

        xpManager.claimERC20Rewards();

        // Step 6: Earn enough more XP to reach 1000 (need 5 more claims)
        for (uint256 i = 6; i <= 10; i++) {
            bytes memory contextN = abi.encode(i * 100);
            xpManager.claimXP(1, contextN);
        }

        uint256 available3 = xpManager.getAvailableERC20Reward(user);
        assertEq(available3, 100e18, "Should have 100 tokens for 1000 XP threshold");

        xpManager.claimERC20Rewards();

        // Step 7: Check total tokens received
        uint256 totalTokens = rewardToken.balanceOf(user);
        assertEq(totalTokens, 160e18, "Should have received 10 + 50 + 100 = 160 tokens");

        vm.stopPrank();
    }

    function testMultipleVerifiersWorkflow() public {

        vm.startPrank(owner);

        // Register a second verifier with different XP amount
        OwnsCitizenNFT secondVerifier = new OwnsCitizenNFT(address(citizenNFT), 50);
        xpManager.registerVerifier(2, address(secondVerifier));

        vm.stopPrank();

        vm.startPrank(user);

        // Mock user has NFT
        vm.mockCall(address(citizenNFT), abi.encodeWithSelector(citizenNFT.balanceOf.selector, user), abi.encode(1));

        // Claim from first verifier (100 XP)
        bytes memory context1 = abi.encode(100);
        xpManager.claimXP(1, context1);

        // Claim from second verifier (50 XP)
        bytes memory context2 = abi.encode(200);
        xpManager.claimXP(2, context2);

        uint256 totalXP = xpManager.getTotalXP(user);
        assertEq(totalXP, 150, "Should have 100 + 50 = 150 XP");

        vm.stopPrank();
    }

    function testNoRewardsForInsufficientXP() public {

        vm.startPrank(user);

        // Mock user has NFT
        vm.mockCall(address(citizenNFT), abi.encodeWithSelector(citizenNFT.balanceOf.selector, user), abi.encode(1));

        // Verifier gives 100 XP regardless of context, so user will always reach 100 threshold
        // To test insufficient XP, we need to set thresholds higher
        vm.stopPrank();
        vm.startPrank(owner);

        // Set higher thresholds so 100 XP won't be enough
        uint256[] memory newThresholds = new uint256[](1);
        newThresholds[0] = 200; // Higher than the 100 XP the verifier gives
        uint256[] memory newRewards = new uint256[](1);
        newRewards[0] = 10e18;
        xpManager.setERC20RewardConfig(address(rewardToken), newThresholds, newRewards);

        vm.stopPrank();
        vm.startPrank(user);

        // Now earn 100 XP (from verifier) which is below 200 threshold
        bytes memory context = abi.encode(50);
        xpManager.claimXP(1, context);

        uint256 available = xpManager.getAvailableERC20Reward(user);
        assertEq(available, 0, "Should have no rewards for insufficient XP");

        // Try to claim rewards (should fail)
        vm.expectRevert("No rewards to claim");
        xpManager.claimERC20Rewards();

        vm.stopPrank();
    }

    function testClaimXPForWorkflow() public {

        address server = address(0x777);

        // Mock user has NFT but doesn't claim directly
        vm.mockCall(address(citizenNFT), abi.encodeWithSelector(citizenNFT.balanceOf.selector, user), abi.encode(1));

        // Server claims XP on behalf of user
        vm.startPrank(server);

        bytes memory context = abi.encode(100);
        xpManager.claimXPFor(user, 1, context);

        vm.stopPrank();

        // Verify user received XP
        uint256 userXP = xpManager.getTotalXP(user);
        assertEq(userXP, 100, "User should have received 100 XP via server");

        // User can now claim rewards
        vm.startPrank(user);
        uint256 availableRewards = xpManager.getAvailableERC20Reward(user);
        assertEq(availableRewards, 10e18, "Should have 10 tokens available");

        xpManager.claimERC20Rewards();

        uint256 tokenBalance = rewardToken.balanceOf(user);
        assertEq(tokenBalance, 10e18, "User should have received 10 tokens");

        vm.stopPrank();
    }

    // Multiple token rewards test removed for single-token config

    function testRewardConfigurationChange() public {
        vm.startPrank(user);

        // Mock user has NFT
        vm.mockCall(address(citizenNFT), abi.encodeWithSelector(citizenNFT.balanceOf.selector, user), abi.encode(1));

        // User earns 100 XP under original config
        bytes memory context1 = abi.encode(100);
        xpManager.claimXP(1, context1);

        uint256 availableBefore = xpManager.getAvailableERC20Reward(user);
        assertEq(availableBefore, 10e18, "Should have 10 tokens under original config");

        vm.stopPrank();

        // Owner changes reward configuration
        vm.startPrank(owner);

        uint256[] memory newThresholds = new uint256[](2);
        newThresholds[0] = 100;
        newThresholds[1] = 200;
        uint256[] memory newRewards = new uint256[](2);
        newRewards[0] = 20e18; // Increased reward
        newRewards[1] = 40e18;

        xpManager.setERC20RewardConfig(address(rewardToken), newThresholds, newRewards);

        vm.stopPrank();

        // Check how this affects existing user
        uint256 availableAfter = xpManager.getAvailableERC20Reward(user);
        assertEq(availableAfter, 20e18, "Should have 20 tokens under new config");
    }
}
