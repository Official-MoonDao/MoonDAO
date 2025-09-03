// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/XPManager.sol";
import "../src/verifiers/OwnsCitizenNFT.sol";
import "../src/mocks/MockERC5643Citizen.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 1000000 * 10 ** decimals()); // Mint 1M tokens to deployer
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
        citizenNFT =
            new MockERC5643Citizen("MoonDAO Citizen", "CITIZEN", address(0), address(0), address(0), address(0));

        // Deploy XPManager implementation
        XPManager implementation = new XPManager();
        
        // Deploy proxy and initialize
        bytes memory initData = abi.encodeWithSelector(XPManager.initialize.selector);
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        xpManager = XPManager(address(proxy));

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

        // Set citizen NFT address in XPManager (as owner)
        vm.startPrank(owner);
        xpManager.setCitizenNFTAddress(address(citizenNFT));
        vm.stopPrank();

        // Fund XPManager with reward tokens for testing
        rewardToken.transfer(address(xpManager), 10000 * 10 ** 18);
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

        vm.expectRevert("Only citizens can claim XP");
        xpManager.claimXP(1, context);

        vm.stopPrank();
    }

    function testCannotClaimWithoutCitizenNFT() public {
        address userWithoutNFT = address(0x4);
        vm.startPrank(userWithoutNFT);

        bytes memory context = abi.encode(25);

        vm.expectRevert("Only citizens can claim XP");
        xpManager.claimXP(1, context);

        vm.stopPrank();
    }

    function testCitizenCheck() public {
        // Set citizen NFT address in XPManager
        vm.startPrank(owner);
        xpManager.setCitizenNFTAddress(address(citizenNFT));
        vm.stopPrank();

        // Test that user1 is recognized as a citizen
        assertTrue(xpManager.isCitizen(user1));
        
        // Test that user2 is recognized as a citizen
        assertTrue(xpManager.isCitizen(user2));
        
        // Test that a user without NFT is not a citizen
        address userWithoutNFT = address(0x5);
        assertFalse(xpManager.isCitizen(userWithoutNFT));
    }

    function testCannotClaimXPWithoutCitizenNFT() public {
        // Set citizen NFT address in XPManager
        vm.startPrank(owner);
        xpManager.setCitizenNFTAddress(address(citizenNFT));
        vm.stopPrank();

        address userWithoutNFT = address(0x5);
        vm.startPrank(userWithoutNFT);

        bytes memory context = abi.encode(25);

        // Should revert with "Only citizens can claim XP" instead of "Not eligible"
        vm.expectRevert("Only citizens can claim XP");
        xpManager.claimXP(1, context);

        vm.stopPrank();
    }

    function testCannotClaimXPForWithoutCitizenNFT() public {
        // Set citizen NFT address in XPManager
        vm.startPrank(owner);
        xpManager.setCitizenNFTAddress(address(citizenNFT));
        vm.stopPrank();

        address userWithoutNFT = address(0x5);
        vm.startPrank(relayer); // Anyone can call claimXPFor

        bytes memory context = abi.encode(25);

        // Should revert with "Only citizens can claim XP"
        vm.expectRevert("Only citizens can claim XP");
        xpManager.claimXPFor(userWithoutNFT, 1, context);

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

        uint256 conversionRate = 1e15; // 0.001 tokens per XP

        // Expect event
        vm.expectEmit(true, false, false, true);
        emit XPManager.ERC20RewardConfigSet(address(rewardToken), conversionRate);

        xpManager.setERC20RewardConfig(address(rewardToken), conversionRate);

        // Verify configuration
        (address tokenAddress, uint256 returnedRate, bool active) = xpManager.getERC20RewardConfig();
        assertEq(tokenAddress, address(rewardToken));
        assertEq(returnedRate, conversionRate);
        assertTrue(active);

        vm.stopPrank();
    }

    function testSetERC20RewardConfigInvalidToken() public {
        vm.startPrank(owner);

        uint256 conversionRate = 1e15;

        vm.expectRevert("Invalid token address");
        xpManager.setERC20RewardConfig(address(0), conversionRate);

        vm.stopPrank();
    }

    function testSetERC20RewardConfigInvalidRate() public {
        vm.startPrank(owner);

        vm.expectRevert("Conversion rate must be greater than 0");
        xpManager.setERC20RewardConfig(address(rewardToken), 0);

        vm.stopPrank();
    }

    function testOnlyOwnerCanSetERC20RewardConfig() public {
        vm.startPrank(user1);

        uint256 conversionRate = 1e15;

        vm.expectRevert();
        xpManager.setERC20RewardConfig(address(rewardToken), conversionRate);

        vm.stopPrank();
    }



    function testDeactivateERC20RewardConfig() public {
        // First set up rewards
        vm.startPrank(owner);

        uint256 conversionRate = 1e15;
        xpManager.setERC20RewardConfig(address(rewardToken), conversionRate);

        // Verify it's active
        (,, bool active) = xpManager.getERC20RewardConfig();
        assertTrue(active);

        // Expect event
        vm.expectEmit(true, false, false, false);
        emit XPManager.ERC20RewardConfigDeactivated(address(rewardToken));

        // Deactivate
        xpManager.deactivateERC20RewardConfig();

        // Verify it's inactive
        (,, bool activeAfter) = xpManager.getERC20RewardConfig();
        assertFalse(activeAfter);

        vm.stopPrank();
    }

    function testDeactivateERC20RewardConfigNotActive() public {
        vm.startPrank(owner);

        vm.expectRevert("Config not active");
        xpManager.deactivateERC20RewardConfig();

        vm.stopPrank();
    }

    function testCalculateAvailableERC20Reward() public {
        // Set up rewards
        vm.startPrank(owner);

        uint256 conversionRate = 1e16; // 0.01 tokens per XP
        xpManager.setERC20RewardConfig(address(rewardToken), conversionRate);

        vm.stopPrank();

        // User has no XP initially
        assertEq(xpManager.calculateAvailableERC20Reward(user1), 0);

        // Give user1 25 XP (one claim)
        vm.startPrank(user1);
        bytes memory context = abi.encode(100);
        xpManager.claimXP(1, context);
        vm.stopPrank();

        // Should calculate: 25 XP * 0.01 = 0.25 tokens, but user already claimed automatically
        // So available should be 0 since automatic claiming happened
        assertEq(xpManager.calculateAvailableERC20Reward(user1), 0);
        
        // Check user received tokens automatically
        assertEq(rewardToken.balanceOf(user1), 25 * 1e16); // 25 * 0.01 = 0.25 tokens

        // Give user1 more XP to reach 50 total (second claim)
        vm.startPrank(user1);
        bytes memory context2 = abi.encode(200); // Different context for unique claimId
        xpManager.claimXP(1, context2);
        vm.stopPrank();

        // Should have 50 * 0.01 = 0.5 tokens total
        assertEq(rewardToken.balanceOf(user1), 50 * 1e16);
    }

    function testCalculateAvailableERC20RewardInactiveConfig() public {
        // No config set - should return 0
        assertEq(xpManager.calculateAvailableERC20Reward(user1), 0);
    }

    function testAutomaticERC20Rewards() public {
        // Set up rewards
        vm.startPrank(owner);

        uint256 conversionRate = 2e17; // 0.2 tokens per XP
        xpManager.setERC20RewardConfig(address(rewardToken), conversionRate);

        vm.stopPrank();

        // Give user1 50 XP (two claims) - rewards should be automatic
        vm.startPrank(user1);
        
        uint256 initialBalance = rewardToken.balanceOf(user1);
        
        // Expect event for automatic ERC20 reward claiming
        vm.expectEmit(true, true, false, true);
        emit XPManager.ERC20RewardClaimed(user1, address(rewardToken), 25 * conversionRate);

        bytes memory context = abi.encode(100);
        xpManager.claimXP(1, context); // 25 XP

        // Check balance increased automatically
        assertEq(rewardToken.balanceOf(user1), initialBalance + 25 * conversionRate);

        // Expect event for second claim
        vm.expectEmit(true, true, false, true);
        emit XPManager.ERC20RewardClaimed(user1, address(rewardToken), 25 * conversionRate);
        
        bytes memory context2 = abi.encode(200); // Different context for unique claimId
        xpManager.claimXP(1, context2); // 50 XP total

        // Check total balance: 50 XP * 0.2 = 10 tokens
        assertEq(rewardToken.balanceOf(user1), initialBalance + 50 * conversionRate);

        vm.stopPrank();
    }

    function testNoRewardsWhenConfigInactive() public {
        // User has no rewards when config is inactive
        vm.startPrank(user1);
        
        uint256 initialBalance = rewardToken.balanceOf(user1);
        
        bytes memory context = abi.encode(100);
        xpManager.claimXP(1, context); // 25 XP

        // No tokens should be received since no config is set
        assertEq(rewardToken.balanceOf(user1), initialBalance);
        assertEq(xpManager.calculateAvailableERC20Reward(user1), 0);

        vm.stopPrank();
    }

    function testGetAvailableERC20Reward() public {
        // Set up rewards
        vm.startPrank(owner);

        uint256 conversionRate = 2e17; // 0.2 tokens per XP
        xpManager.setERC20RewardConfig(address(rewardToken), conversionRate);

        vm.stopPrank();

        // User has no available rewards initially
        assertEq(xpManager.getAvailableERC20Reward(user1), 0);

        // Give user1 25 XP - rewards should be claimed automatically
        vm.startPrank(user1);
        bytes memory context = abi.encode(100);
        xpManager.claimXP(1, context);
        vm.stopPrank();

        // Available reward should be 0 since it was claimed automatically
        assertEq(xpManager.getAvailableERC20Reward(user1), 0);
        
        // But user should have received tokens
        assertEq(rewardToken.balanceOf(user1), 25 * conversionRate);
    }

    function testEmergencyWithdrawERC20() public {
        uint256 withdrawAmount = 1000 * 10 ** 18;
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

        vm.expectRevert("Only citizens can claim XP");
        xpManager.claimXPFor(userWithoutNFT, 1, context);

        vm.stopPrank();
    }

    function testClaimXPForNoXP() public {
        address userWithoutNFT = address(0x6);
        vm.startPrank(relayer);

        bytes memory context = abi.encode(100);

        vm.expectRevert("Only citizens can claim XP");
        xpManager.claimXPFor(userWithoutNFT, 1, context);

        vm.stopPrank();
    }

    // ===== INTEGRATION TESTS =====

    function testIntegratedXPAndRewardFlow() public {
        // Set up rewards
        vm.startPrank(owner);

        uint256 conversionRate = 2e17; // 0.2 tokens per XP
        xpManager.setERC20RewardConfig(address(rewardToken), conversionRate);

        vm.stopPrank();

        // User1 claims 25 XP (first claim) - rewards should be automatic
        vm.startPrank(user1);
        uint256 initialBalance = rewardToken.balanceOf(user1);
        
        bytes memory context1 = abi.encode(100);
        xpManager.claimXP(1, context1);
        
        // Should receive tokens automatically: 25 XP * 0.2 = 5 tokens
        assertEq(rewardToken.balanceOf(user1), initialBalance + 25 * conversionRate);
        assertEq(xpManager.getAvailableERC20Reward(user1), 0); // No pending rewards
        vm.stopPrank();

        // User1 claims more XP to reach 50 total
        vm.startPrank(user1);
        bytes memory context2 = abi.encode(200); // Different context for unique claimId
        xpManager.claimXP(1, context2);
        
        // Should now have tokens for 50 XP total: 50 * 0.2 = 10 tokens
        assertEq(rewardToken.balanceOf(user1), initialBalance + 50 * conversionRate);
        assertEq(xpManager.getAvailableERC20Reward(user1), 0); // Still no pending rewards
        vm.stopPrank();

        // User1 claims more XP to reach 75 total
        vm.startPrank(user1);
        bytes memory context3 = abi.encode(300); // Different context for unique claimId
        xpManager.claimXP(1, context3);
        
        // Should now have tokens for 75 XP total: 75 * 0.2 = 15 tokens
        assertEq(rewardToken.balanceOf(user1), initialBalance + 75 * conversionRate);
        assertEq(xpManager.getAvailableERC20Reward(user1), 0); // Still no pending rewards
        vm.stopPrank();

        // Verify XP total
        assertEq(xpManager.getTotalXP(user1), 75);
    }

    function testMultipleUsersRewards() public {
        // Set up rewards
        vm.startPrank(owner);

        uint256 conversionRate = 2e17; // 0.2 tokens per XP
        xpManager.setERC20RewardConfig(address(rewardToken), conversionRate);

        vm.stopPrank();

        // User1 gets 25 XP (one claim) - rewards should be automatic
        vm.startPrank(user1);
        uint256 user1InitialBalance = rewardToken.balanceOf(user1);
        
        bytes memory context1 = abi.encode(100);
        xpManager.claimXP(1, context1);
        
        // User1 should have: 25 XP * 0.2 = 5 tokens
        assertEq(rewardToken.balanceOf(user1), user1InitialBalance + 25 * conversionRate);
        vm.stopPrank();

        // User2 gets 50 XP (two claims) - rewards should be automatic
        vm.startPrank(user2);
        uint256 user2InitialBalance = rewardToken.balanceOf(user2);
        
        bytes memory context2a = abi.encode(100);
        xpManager.claimXP(1, context2a); // 25 XP
        
        bytes memory context2b = abi.encode(200); // Different context for unique claimId
        xpManager.claimXP(1, context2b); // 50 XP total
        
        // User2 should have: 50 XP * 0.2 = 10 tokens
        assertEq(rewardToken.balanceOf(user2), user2InitialBalance + 50 * conversionRate);
        vm.stopPrank();

        // Both users should have no available rewards (all claimed automatically)
        assertEq(xpManager.getAvailableERC20Reward(user1), 0);
        assertEq(xpManager.getAvailableERC20Reward(user2), 0);
        
        // Verify XP totals
        assertEq(xpManager.getTotalXP(user1), 25);
        assertEq(xpManager.getTotalXP(user2), 50);
    }

    function testVerifierTracking() public {
        // Register multiple verifiers for testing (as owner)
        OwnsCitizenNFT verifier2 = new OwnsCitizenNFT(address(citizenNFT), 75);
        OwnsCitizenNFT verifier3 = new OwnsCitizenNFT(address(citizenNFT), 100);

        // Make sure we're the owner when registering verifiers
        address currentOwner = xpManager.owner();
        vm.startPrank(currentOwner);
        xpManager.registerVerifier(2, address(verifier2));
        xpManager.registerVerifier(3, address(verifier3));
        vm.stopPrank();

        // Initially, user1 has not claimed from any verifiers
        assertFalse(xpManager.hasClaimedFromVerifier(user1, 1));
        assertFalse(xpManager.hasClaimedFromVerifier(user1, 2));
        assertFalse(xpManager.hasClaimedFromVerifier(user1, 3));
        assertEq(xpManager.getClaimedVerifierCount(user1), 0);

        // User1 claims from verifier 1
        vm.prank(user1);
        xpManager.claimXP(1, "");

        // Check that verifier 1 is now tracked
        assertTrue(xpManager.hasClaimedFromVerifier(user1, 1));
        assertFalse(xpManager.hasClaimedFromVerifier(user1, 2));
        assertFalse(xpManager.hasClaimedFromVerifier(user1, 3));
        assertEq(xpManager.getClaimedVerifierCount(user1), 1);

        uint256[] memory claimedVerifiers = xpManager.getClaimedVerifiers(user1);
        assertEq(claimedVerifiers.length, 1);
        assertEq(claimedVerifiers[0], 1);

        // User1 claims from verifier 2
        vm.prank(user1);
        xpManager.claimXP(2, "");

        // Check that both verifiers are tracked
        assertTrue(xpManager.hasClaimedFromVerifier(user1, 1));
        assertTrue(xpManager.hasClaimedFromVerifier(user1, 2));
        assertFalse(xpManager.hasClaimedFromVerifier(user1, 3));
        assertEq(xpManager.getClaimedVerifierCount(user1), 2);

        claimedVerifiers = xpManager.getClaimedVerifiers(user1);
        assertEq(claimedVerifiers.length, 2);
        // Verifiers should be added in order of claiming
        assertEq(claimedVerifiers[0], 1);
        assertEq(claimedVerifiers[1], 2);

        // User2 claims from verifier 3 only
        vm.prank(user2);
        xpManager.claimXP(3, "");

        // Check that user2's tracking is independent
        assertFalse(xpManager.hasClaimedFromVerifier(user2, 1));
        assertFalse(xpManager.hasClaimedFromVerifier(user2, 2));
        assertTrue(xpManager.hasClaimedFromVerifier(user2, 3));
        assertEq(xpManager.getClaimedVerifierCount(user2), 1);

        uint256[] memory user2ClaimedVerifiers = xpManager.getClaimedVerifiers(user2);
        assertEq(user2ClaimedVerifiers.length, 1);
        assertEq(user2ClaimedVerifiers[0], 3);

        // User1's data should be unchanged
        assertTrue(xpManager.hasClaimedFromVerifier(user1, 1));
        assertTrue(xpManager.hasClaimedFromVerifier(user1, 2));
        assertFalse(xpManager.hasClaimedFromVerifier(user1, 3));
        assertEq(xpManager.getClaimedVerifierCount(user1), 2);
    }

    function testVerifierClaimedEvent() public {
        // Expect the VerifierClaimed event when claiming XP
        vm.expectEmit(true, true, false, true);
        emit XPManager.VerifierClaimed(user1, 1, 25); // user, verifierId, xpAmount

        vm.prank(user1);
        xpManager.claimXP(1, "");
    }

    function testVerifierTrackingWithClaimXPFor() public {
        // Test that verifier tracking also works with claimXPFor
        assertFalse(xpManager.hasClaimedFromVerifier(user1, 1));

        // Use claimXPFor instead of claimXP
        xpManager.claimXPFor(user1, 1, "");

        // Check that verifier is still tracked correctly
        assertTrue(xpManager.hasClaimedFromVerifier(user1, 1));
        assertEq(xpManager.getClaimedVerifierCount(user1), 1);

        uint256[] memory claimedVerifiers = xpManager.getClaimedVerifiers(user1);
        assertEq(claimedVerifiers.length, 1);
        assertEq(claimedVerifiers[0], 1);
    }

    function testTrackVerifierClaimsButAllowMultipleClaims() public {
        // User1 claims from verifier 1 successfully
        vm.prank(user1);
        xpManager.claimXP(1, abi.encode(25));

        // Verify the claim was recorded
        assertTrue(xpManager.hasClaimedFromVerifier(user1, 1));
        assertEq(xpManager.getTotalXP(user1), 25);

        // User should be able to claim from the same verifier with different context
        vm.prank(user1);
        xpManager.claimXP(1, abi.encode(50));

        // XP should increase, and verifier should still be marked as claimed from
        assertEq(xpManager.getTotalXP(user1), 50);
        assertTrue(xpManager.hasClaimedFromVerifier(user1, 1));

        // Attempting to claim with the same context should fail
        vm.prank(user1);
        vm.expectRevert("Already claimed");
        xpManager.claimXP(1, abi.encode(25)); // Same context as first claim
    }

    // ===== XP LEVELS TESTS =====

    function testSetXPLevels() public {
        vm.startPrank(owner);

        uint256[] memory thresholds = new uint256[](3);
        uint256[] memory levels = new uint256[](3);
        
        thresholds[0] = 50;   // 50 XP = Level 1
        thresholds[1] = 150;  // 150 XP = Level 2
        thresholds[2] = 300;  // 300 XP = Level 3
        
        levels[0] = 1;
        levels[1] = 2;
        levels[2] = 3;

        // Expect event
        vm.expectEmit(false, false, false, true);
        emit XPManager.XPLevelsSet(thresholds, levels);

        xpManager.setXPLevels(thresholds, levels);

        // Verify configuration
        (uint256[] memory returnedThresholds, uint256[] memory returnedLevels, bool active) = xpManager.getXPLevels();
        assertTrue(active);
        assertEq(returnedThresholds.length, 3);
        assertEq(returnedThresholds[0], 50);
        assertEq(returnedThresholds[1], 150);
        assertEq(returnedThresholds[2], 300);
        assertEq(returnedLevels[0], 1);
        assertEq(returnedLevels[1], 2);
        assertEq(returnedLevels[2], 3);

        vm.stopPrank();
    }

    function testGetUserLevel() public {
        // Set up levels
        vm.startPrank(owner);
        uint256[] memory thresholds = new uint256[](3);
        uint256[] memory levels = new uint256[](3);
        thresholds[0] = 50;
        thresholds[1] = 150;
        thresholds[2] = 300;
        levels[0] = 1;
        levels[1] = 2;
        levels[2] = 3;
        xpManager.setXPLevels(thresholds, levels);
        vm.stopPrank();

        // User starts at level 0
        assertEq(xpManager.getUserLevel(user1), 0);

        // Give user1 25 XP - still level 0
        vm.prank(user1);
        xpManager.claimXP(1, abi.encode(100));
        assertEq(xpManager.getUserLevel(user1), 0);

        // Give user1 more XP to reach 50 - now level 1
        vm.prank(user1);
        xpManager.claimXP(1, abi.encode(200));
        assertEq(xpManager.getUserLevel(user1), 1);

        // Give user1 more XP to reach 150 - now level 2
        vm.prank(user1);
        xpManager.claimXP(1, abi.encode(300));
        assertEq(xpManager.getUserLevel(user1), 1); // Still level 1 at 75 XP

        // More XP to reach level 2
        vm.prank(user1);
        xpManager.claimXP(1, abi.encode(400));
        assertEq(xpManager.getUserLevel(user1), 1); // 100 XP
        
        vm.prank(user1);
        xpManager.claimXP(1, abi.encode(500));
        assertEq(xpManager.getUserLevel(user1), 1); // 125 XP
        
        vm.prank(user1);
        xpManager.claimXP(1, abi.encode(600));
        assertEq(xpManager.getUserLevel(user1), 2); // 150 XP - level 2
    }

    function testLevelUpEvent() public {
        // Set up levels
        vm.startPrank(owner);
        uint256[] memory thresholds = new uint256[](2);
        uint256[] memory levels = new uint256[](2);
        thresholds[0] = 50;
        thresholds[1] = 100;
        levels[0] = 1;
        levels[1] = 2;
        xpManager.setXPLevels(thresholds, levels);
        vm.stopPrank();

        // Give user1 first claim (25 XP) - no level up yet
        vm.startPrank(user1);
        xpManager.claimXP(1, abi.encode(100)); // 25 XP
        vm.stopPrank();

        // Expect level up event when reaching level 1 (50 XP total)
        vm.expectEmit(true, false, false, true);
        emit XPManager.LevelUp(user1, 1, 50);

        // Second claim should trigger level up
        vm.startPrank(user1);
        xpManager.claimXP(1, abi.encode(200)); // 50 XP total - should trigger level up
        vm.stopPrank();
    }

    function testGetNextLevelInfo() public {
        // Set up levels
        vm.startPrank(owner);
        uint256[] memory thresholds = new uint256[](2);
        uint256[] memory levels = new uint256[](2);
        thresholds[0] = 50;
        thresholds[1] = 150;
        levels[0] = 1;
        levels[1] = 2;
        xpManager.setXPLevels(thresholds, levels);
        vm.stopPrank();

        // User with 0 XP
        (uint256 nextLevel, uint256 xpRequired, uint256 xpProgress) = xpManager.getNextLevelInfo(user1);
        assertEq(nextLevel, 1);
        assertEq(xpRequired, 50);
        assertEq(xpProgress, 0);

        // Give user some XP
        vm.prank(user1);
        xpManager.claimXP(1, abi.encode(100)); // 25 XP

        (nextLevel, xpRequired, xpProgress) = xpManager.getNextLevelInfo(user1);
        assertEq(nextLevel, 1);
        assertEq(xpRequired, 50);
        assertEq(xpProgress, 25);

        // Reach level 1
        vm.prank(user1);
        xpManager.claimXP(1, abi.encode(200)); // 50 XP total

        (nextLevel, xpRequired, xpProgress) = xpManager.getNextLevelInfo(user1);
        assertEq(nextLevel, 2);
        assertEq(xpRequired, 150);
        assertEq(xpProgress, 50);
    }

    function testVerifierTrackingRecordsFirstClaimOnly() public {
        // Initially not claimed from any verifier
        assertFalse(xpManager.hasClaimedFromVerifier(user1, 1));
        assertEq(xpManager.getClaimedVerifierCount(user1), 0);

        // First claim should add verifier to the list
        vm.prank(user1);
        xpManager.claimXP(1, abi.encode(25));

        assertTrue(xpManager.hasClaimedFromVerifier(user1, 1));
        assertEq(xpManager.getClaimedVerifierCount(user1), 1);

        uint256[] memory claimedVerifiers = xpManager.getClaimedVerifiers(user1);
        assertEq(claimedVerifiers.length, 1);
        assertEq(claimedVerifiers[0], 1);

        // Second claim from same verifier should not duplicate the record
        vm.prank(user1);
        xpManager.claimXP(1, abi.encode(50));

        // Still should only be counted once
        assertTrue(xpManager.hasClaimedFromVerifier(user1, 1));
        assertEq(xpManager.getClaimedVerifierCount(user1), 1);

        claimedVerifiers = xpManager.getClaimedVerifiers(user1);
        assertEq(claimedVerifiers.length, 1);
        assertEq(claimedVerifiers[0], 1);
    }
}
