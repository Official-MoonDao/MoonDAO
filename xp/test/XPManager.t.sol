// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/XPManager.sol";
import "../src/verifiers/OwnsCitizenNFT.sol";
import "../src/mocks/MockERC5643Citizen.sol";

contract XPManagerTest is Test {
    XPManager public xpManager;
    OwnsCitizenNFT public citizenVerifier;
    MockERC5643Citizen public citizenNFT;
    
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public owner = address(0x3);

    function setUp() public {
        // Deploy Citizen NFT
        citizenNFT = new MockERC5643Citizen("MoonDAO Citizen", "CITIZEN", address(0), address(0), address(0), address(0));
        
        // Deploy XPManager
        xpManager = new XPManager();
        
        // Deploy verifier
        citizenVerifier = new OwnsCitizenNFT();
        
        // Register verifier
        xpManager.registerVerifier(1, address(citizenVerifier));
        
        // Give users some Citizen NFTs
        citizenNFT.mintTo(user1);
        citizenNFT.mintTo(user2);
        
        // Transfer ownership from current owner (deployer)
        xpManager.transferOwnership(owner);
    }

    function testInitialState() public {
        assertEq(xpManager.userXP(user1), 0);
        assertEq(xpManager.userXP(user2), 0);
    }

    function testClaimXP() public {
        vm.startPrank(user1);
        
        // Context: Citizen NFT address + 25 XP
        bytes memory context = abi.encode(address(citizenNFT), 25);
        
        // Claim XP
        xpManager.claimXP(1, context);
        
        // Check XP was awarded
        assertEq(xpManager.userXP(user1), 25);
        
        vm.stopPrank();
    }

    function testMultipleXPClaims() public {
        vm.startPrank(user1);
        
        // First claim: 15 XP
        bytes memory context1 = abi.encode(address(citizenNFT), 15);
        xpManager.claimXP(1, context1);
        assertEq(xpManager.userXP(user1), 15);
        
        // Second claim: 40 XP
        bytes memory context2 = abi.encode(address(citizenNFT), 40);
        xpManager.claimXP(1, context2);
        assertEq(xpManager.userXP(user1), 55);
        
        // Third claim: 50 XP
        bytes memory context3 = abi.encode(address(citizenNFT), 50);
        xpManager.claimXP(1, context3);
        assertEq(xpManager.userXP(user1), 105);
        
        vm.stopPrank();
    }

    function testGetTotalXP() public {
        vm.startPrank(user1);
        
        bytes memory context = abi.encode(address(citizenNFT), 100);
        xpManager.claimXP(1, context);
        
        assertEq(xpManager.getTotalXP(user1), 100);
        
        vm.stopPrank();
    }

    function testCannotClaimTwice() public {
        vm.startPrank(user1);
        
        bytes memory context = abi.encode(address(citizenNFT), 25);
        xpManager.claimXP(1, context);
        
        // Try to claim again with same context
        vm.expectRevert("Already claimed");
        xpManager.claimXP(1, context);
        
        vm.stopPrank();
    }

    function testCannotClaimWithoutEligibility() public {
        vm.startPrank(user1);
        
        // Context with 0 XP
        bytes memory context = abi.encode(address(citizenNFT), 0);
        
        vm.expectRevert("No XP to claim");
        xpManager.claimXP(1, context);
        
        vm.stopPrank();
    }

    function testCannotClaimWithoutCitizenNFT() public {
        address userWithoutNFT = address(0x4);
        vm.startPrank(userWithoutNFT);
        
        bytes memory context = abi.encode(address(citizenNFT), 25);
        
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
        
        bytes memory context = abi.encode(address(citizenNFT), 25);
        
        // Expect event for XP earned
        vm.expectEmit(true, false, false, true);
        emit XPManager.XPEarned(user1, 25, 25);
        
        xpManager.claimXP(1, context);
        
        vm.stopPrank();
    }

    function testMultipleUsers() public {
        // User 1 claims XP
        vm.startPrank(user1);
        bytes memory context1 = abi.encode(address(citizenNFT), 30);
        xpManager.claimXP(1, context1);
        assertEq(xpManager.userXP(user1), 30);
        vm.stopPrank();
        
        // User 2 claims XP
        vm.startPrank(user2);
        bytes memory context2 = abi.encode(address(citizenNFT), 45);
        xpManager.claimXP(1, context2);
        assertEq(xpManager.userXP(user2), 45);
        vm.stopPrank();
        
        // Verify totals
        assertEq(xpManager.userXP(user1), 30);
        assertEq(xpManager.userXP(user2), 45);
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
        
        bytes memory context = abi.encode(address(citizenNFT), 25);
        
        vm.expectRevert("Verifier not found");
        xpManager.claimXP(999, context); // Non-existent verifier ID
        
        vm.stopPrank();
    }
}
