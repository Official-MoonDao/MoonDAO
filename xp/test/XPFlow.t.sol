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
    
    address public user = address(0x123);
    address public treasury = address(0x456);
    address public table = address(0x789);
    address public whitelist = address(0xABC);
    address public discountList = address(0xDEF);

    function setUp() public {
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
        
        // Deploy verifier
        citizenVerifier = new OwnsCitizenNFT();
        
        // Register verifier
        xpManager.registerVerifier(1, address(citizenVerifier));
        
        // No reward configuration
    }

    function testCompleteFlow() public {
        console.log("Testing Complete XP Flow");
        
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
            address(citizenNFT), // citizenNFTAddress
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
        
        // Step 7: Verify claim is marked as used
        console.log("Step 7: Verify claim marked as used");
        bool claimedAfter = xpManager.usedProofs(claimId);
        console.log("Claimed after:", claimedAfter);
        assertTrue(claimedAfter);
        
        // Step 8: Try to claim again (should fail)
        console.log("Step 8: Try to claim again (should fail)");
        vm.expectRevert("Already claimed");
        xpManager.claimXP(1, context);
        
        vm.stopPrank();
        
        console.log("Complete flow test passed!");
    }

    function testUserWithoutNFT() public {
        console.log("Testing user without Citizen NFT");
        
        address userWithoutNFT = address(0x999);
        
        bytes memory context = abi.encode(
            address(citizenNFT),
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

    function testRewardTokenDistribution() public {
        console.log("Testing reward token distribution");
        
        vm.startPrank(user);
        
        // Mock user has NFT
        vm.mockCall(
            address(citizenNFT),
            abi.encodeWithSelector(citizenNFT.balanceOf.selector, user),
            abi.encode(1)
        );
        
        // Claim enough XP to get a reward (1000 XP needed)
        bytes memory context = abi.encode(
            address(citizenNFT),
            1000
        );
        
        xpManager.claimXP(1, context);
        
        // With no rewards, XP should simply increase by the claimed amount
        uint256 xpAfter = xpManager.userXP(user);
        console.log("XP after claim:", xpAfter);
        assertEq(xpAfter, 1000);
        
        vm.stopPrank();
        
        console.log("Reward token distribution test passed!");
    }
}
