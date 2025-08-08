// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/verifiers/HasVotingPower.sol";

contract HasVotingPowerTest is Test {
    HasVotingPower public verifier;
    
    address public oracle;
    address public user = address(0x2);
    address public nonOracle = address(0x3);
    
    uint256 public oraclePrivateKey = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;

    function setUp() public {
        // Derive oracle address from private key
        oracle = vm.addr(oraclePrivateKey);

        // Deploy verifier
        verifier = new HasVotingPower(oracle);
    }

    function testInitialState() public {
        assertEq(verifier.oracle(), oracle);
        assertEq(verifier.SIGNATURE_TIMEOUT(), 1 hours);
        assertEq(verifier.name(), "HasVotingPower:v1");
    }

    function testValidSignature() public {
        uint256 minVotingPower = 1000;
        uint256 xpAmount = 10;
        uint256 timestamp = block.timestamp;
        
        // Create valid signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            user,
            minVotingPower,
            xpAmount,
            timestamp
        ));
        
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePrivateKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        // Create context
        bytes memory context = abi.encode(minVotingPower, xpAmount, timestamp, signature);
        
        // Test eligibility
        (bool eligible, uint256 xp) = verifier.isEligible(user, context);
        
        assertTrue(eligible);
        assertEq(xp, xpAmount);
    }

    function testInvalidSignature() public {
        uint256 minVotingPower = 1000;
        uint256 xpAmount = 10;
        uint256 timestamp = block.timestamp;
        
        // Create invalid signature (wrong signer)
        bytes32 messageHash = keccak256(abi.encodePacked(
            user,
            minVotingPower,
            xpAmount,
            timestamp
        ));
        
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));
        // Use a different private key than the oracle's
        uint256 wrongPrivateKey = 0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd;
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPrivateKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        // Create context
        bytes memory context = abi.encode(minVotingPower, xpAmount, timestamp, signature);
        
        // Test eligibility - should fail
        vm.expectRevert("Invalid signature");
        verifier.isEligible(user, context);
    }

    function testExpiredSignature() public {
        uint256 minVotingPower = 1000;
        uint256 xpAmount = 10;
        // Set the timestamp to current block time and then warp forward to enforce expiry
        uint256 timestamp = block.timestamp;
        
        // Create valid signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            user,
            minVotingPower,
            xpAmount,
            timestamp
        ));
        
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePrivateKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        // Create context
        bytes memory context = abi.encode(minVotingPower, xpAmount, timestamp, signature);
        
        // Warp forward beyond timeout to trigger expiry
        vm.warp(timestamp + verifier.SIGNATURE_TIMEOUT() + 1);

        // Test eligibility - should fail
        vm.expectRevert("Signature expired");
        verifier.isEligible(user, context);
    }

    function testClaimId() public {
        uint256 minVotingPower = 1000;
        uint256 xpAmount = 10;
        uint256 timestamp = block.timestamp;
        
        bytes memory context = abi.encode(minVotingPower, xpAmount, timestamp, "");
        
        bytes32 expectedClaimId = keccak256(abi.encodePacked(
            address(verifier),
            user,
            context
        ));
        
        bytes32 actualClaimId = verifier.claimId(user, context);
        
        assertEq(actualClaimId, expectedClaimId);
    }

    function testValidAfter() public {
        uint256 minVotingPower = 1000;
        uint256 xpAmount = 10;
        uint256 timestamp = block.timestamp;
        
        bytes memory context = abi.encode(minVotingPower, xpAmount, timestamp, "");
        
        uint256 validAfter = verifier.validAfter(user, context);
        assertEq(validAfter, 0); // No cooldown
    }

    function testUpdateOracle() public {
        address newOracle = address(0x4);
        
        vm.startPrank(oracle);
        verifier.updateOracle(newOracle);
        vm.stopPrank();
        
        assertEq(verifier.oracle(), newOracle);
    }

    function testUpdateOracleNonOracle() public {
        address newOracle = address(0x4);
        
        vm.startPrank(nonOracle);
        vm.expectRevert("Only oracle can update");
        verifier.updateOracle(newOracle);
        vm.stopPrank();
    }

    function testUpdateOracleInvalidAddress() public {
        vm.startPrank(oracle);
        vm.expectRevert("Invalid oracle address");
        verifier.updateOracle(address(0));
        vm.stopPrank();
    }

    function testConstructorInvalidOracle() public {
        vm.expectRevert("Invalid oracle address");
        new HasVotingPower(address(0));
    }

    function testDifferentUsersSameSignature() public {
        uint256 minVotingPower = 1000;
        uint256 xpAmount = 10;
        uint256 timestamp = block.timestamp;
        
        // Create signature for user1
        bytes32 messageHash = keccak256(abi.encodePacked(
            user,
            minVotingPower,
            xpAmount,
            timestamp
        ));
        
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePrivateKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        // Create context
        bytes memory context = abi.encode(minVotingPower, xpAmount, timestamp, signature);
        
        // Test with correct user - should work
        (bool eligible1, uint256 xp1) = verifier.isEligible(user, context);
        assertTrue(eligible1);
        assertEq(xp1, xpAmount);
        
        // Test with different user - should fail
        address differentUser = address(0x5);
        vm.expectRevert("Invalid signature");
        verifier.isEligible(differentUser, context);
    }

    function testDifferentParameters() public {
        uint256 minVotingPower = 5000;
        uint256 xpAmount = 25;
        uint256 timestamp = block.timestamp;
        
        // Create valid signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            user,
            minVotingPower,
            xpAmount,
            timestamp
        ));
        
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePrivateKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        // Create context
        bytes memory context = abi.encode(minVotingPower, xpAmount, timestamp, signature);
        
        // Test eligibility
        (bool eligible, uint256 xp) = verifier.isEligible(user, context);
        
        assertTrue(eligible);
        assertEq(xp, xpAmount);
    }
}
