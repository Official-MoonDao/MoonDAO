// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/XPManager.sol";
import "../src/verifiers/OwnsCitizenNFT.sol";
import "../src/mocks/MockERC5643Citizen.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

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

        // Deploy XPManager implementation
        XPManager implementation = new XPManager();
        
        // Deploy proxy and initialize
        bytes memory initData = abi.encodeWithSelector(XPManager.initialize.selector);
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        xpManager = XPManager(address(proxy));

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

        // Set up ERC20 reward configuration with conversion rate
        uint256 conversionRate = 1e16; // 0.01 tokens per XP
        xpManager.setERC20RewardConfig(address(rewardToken), conversionRate);

        // Set citizen NFT address in XPManager
        xpManager.setCitizenNFTAddress(address(citizenNFT));

        vm.stopPrank();
    }

    function testCompleteFlow() public {
        // Step 1: User gets a Citizen NFT
        vm.startPrank(user);

        // Mock the minting process
        vm.mockCall(address(citizenNFT), abi.encodeWithSelector(citizenNFT.balanceOf.selector, user), abi.encode(1));

        // Step 2: User claims XP from citizen verifier and gets automatic ERC20 rewards
        bytes memory context = abi.encode(100);
        
        uint256 tokenBalanceBefore = rewardToken.balanceOf(user);
        console.log("Token balance before:", tokenBalanceBefore);
        
        // Expect automatic ERC20 reward event
        vm.expectEmit(true, true, false, true);
        emit XPManager.ERC20RewardClaimed(user, address(rewardToken), 100 * 1e16); // 100 XP * 0.01

        xpManager.claimXP(1, context);

        // Step 3: Verify XP was awarded
        uint256 xpBalance = xpManager.getTotalXP(user);
        assertEq(xpBalance, 100, "User should have 100 XP");

        // Step 4: Verify ERC20 rewards were automatically distributed
        uint256 tokenBalanceAfter = rewardToken.balanceOf(user);
        uint256 expectedReward = 100 * 1e16; // 100 XP * 0.01 tokens per XP
        assertEq(tokenBalanceAfter, tokenBalanceBefore + expectedReward, "Should automatically receive ERC20 tokens");

        // Step 5: Verify no pending rewards (all claimed automatically)
        uint256 availableRewards = xpManager.calculateAvailableERC20Reward(user);
        assertEq(availableRewards, 0, "No pending rewards should remain");

        // Step 6: Verify claim is marked as used
        bytes32 claimId = citizenVerifier.claimId(user, context);
        bool claimedAfter = xpManager.usedProofs(claimId);
        assertTrue(claimedAfter);

        // Step 7: Try to claim again (should fail)
        vm.expectRevert("Already claimed");
        xpManager.claimXP(1, context);

        vm.stopPrank();
    }

    function testProgressiveRewards() public {
        vm.startPrank(user);

        // Mock user has NFT
        vm.mockCall(address(citizenNFT), abi.encodeWithSelector(citizenNFT.balanceOf.selector, user), abi.encode(1));

        uint256 initialBalance = rewardToken.balanceOf(user);

        // Step 1: Earn 100 XP - automatic rewards
        bytes memory context1 = abi.encode(100);
        xpManager.claimXP(1, context1);
        
        uint256 expectedAfter1 = initialBalance + (100 * 1e16); // 100 XP * 0.01
        assertEq(rewardToken.balanceOf(user), expectedAfter1, "Should have automatic rewards for 100 XP");

        // Step 2: Earn 100 more XP (total 200) - more automatic rewards
        bytes memory context2 = abi.encode(200);
        xpManager.claimXP(1, context2);
        
        uint256 expectedAfter2 = initialBalance + (200 * 1e16); // 200 XP * 0.01
        assertEq(rewardToken.balanceOf(user), expectedAfter2, "Should have automatic rewards for 200 XP total");

        // Step 3: Earn 100 more XP (total 300)
        bytes memory context3 = abi.encode(300);
        xpManager.claimXP(1, context3);
        
        uint256 expectedAfter3 = initialBalance + (300 * 1e16); // 300 XP * 0.01
        assertEq(rewardToken.balanceOf(user), expectedAfter3, "Should have automatic rewards for 300 XP total");

        // Step 4: Earn 200 more XP (total 500)
        bytes memory context4 = abi.encode(400);
        xpManager.claimXP(1, context4);
        bytes memory context5 = abi.encode(500);
        xpManager.claimXP(1, context5);
        
        uint256 expectedAfter5 = initialBalance + (500 * 1e16); // 500 XP * 0.01
        assertEq(rewardToken.balanceOf(user), expectedAfter5, "Should have automatic rewards for 500 XP total");

        // Verify total XP
        assertEq(xpManager.getTotalXP(user), 500, "Should have 500 XP total");

        // Verify no pending rewards
        assertEq(xpManager.calculateAvailableERC20Reward(user), 0, "No pending rewards should remain");

        vm.stopPrank();
    }

    function testMultipleUsers() public {
        address user2 = address(0x321);

        // Both users have NFTs
        vm.mockCall(address(citizenNFT), abi.encodeWithSelector(citizenNFT.balanceOf.selector, user), abi.encode(1));
        vm.mockCall(address(citizenNFT), abi.encodeWithSelector(citizenNFT.balanceOf.selector, user2), abi.encode(1));

        // User 1 claims 100 XP
        vm.startPrank(user);
        uint256 user1InitialBalance = rewardToken.balanceOf(user);
        
        bytes memory context1 = abi.encode(100);
        xpManager.claimXP(1, context1);
        
        uint256 user1ExpectedBalance = user1InitialBalance + (100 * 1e16);
        assertEq(rewardToken.balanceOf(user), user1ExpectedBalance, "User 1 should have automatic rewards");
        vm.stopPrank();

        // User 2 claims 200 XP (two separate claims)
        vm.startPrank(user2);
        uint256 user2InitialBalance = rewardToken.balanceOf(user2);
        
        bytes memory context2a = abi.encode(200);
        xpManager.claimXP(1, context2a);
        bytes memory context2b = abi.encode(300);
        xpManager.claimXP(1, context2b);
        
        uint256 user2ExpectedBalance = user2InitialBalance + (200 * 1e16);
        assertEq(rewardToken.balanceOf(user2), user2ExpectedBalance, "User 2 should have automatic rewards");
        vm.stopPrank();

        // Verify independent totals
        assertEq(xpManager.getTotalXP(user), 100, "User 1 should have 100 XP");
        assertEq(xpManager.getTotalXP(user2), 200, "User 2 should have 200 XP");
    }

    function testNoERC20WhenConfigInactive() public {
        // Deactivate rewards
        vm.prank(owner);
        xpManager.deactivateERC20RewardConfig();

        // Mock user has NFT
        vm.mockCall(address(citizenNFT), abi.encodeWithSelector(citizenNFT.balanceOf.selector, user), abi.encode(1));

        vm.startPrank(user);
        uint256 initialBalance = rewardToken.balanceOf(user);
        
        bytes memory context = abi.encode(100);
        xpManager.claimXP(1, context);
        
        // Should get XP but no ERC20 rewards
        assertEq(xpManager.getTotalXP(user), 100, "Should have XP");
        assertEq(rewardToken.balanceOf(user), initialBalance, "Should not have ERC20 rewards");
        
        vm.stopPrank();
    }
}
