// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/verifiers/XPOracleVerifier.sol";
import "../src/XPOracle.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Minimal test-only verifier to exercise XPOracleVerifier base logic
contract TestOracleVerifier is XPOracleVerifier {
    constructor(address _oracle) XPOracleVerifier(_oracle) {}

    function verify(
        address user,
        bytes32 contextHash,
        uint256 xpAmount,
        uint256 validAfter,
        uint256 validBefore,
        bytes memory signature
    ) external view returns (uint256) {
        return _verifyOracleProof(user, contextHash, xpAmount, validAfter, validBefore, signature);
    }

    // Minimal IXPVerifier implementations to satisfy the interface
    function name() external pure returns (string memory) { return "TestOracleVerifier"; }

    function isEligible(address, bytes calldata) external pure returns (bool, uint256) {
        return (false, 0);
    }

    function claimId(address user, bytes calldata context) external view returns (bytes32) {
        return keccak256(abi.encodePacked(address(this), user, context));
    }

    function validAfter(address, bytes calldata) external pure returns (uint256) { return 0; }
}

contract XPOracleVerifierTest is Test {
    TestOracleVerifier public verifier;
    XPOracle public oracle;

    address public user = address(0x2);
    address public nonOwner = address(0x3);

    uint256 public oraclePrivateKey = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;

    function setUp() public {
        // Deploy oracle and authorize signer
        oracle = new XPOracle("MoonDAO XP", "1");
        address oracleSigner = vm.addr(oraclePrivateKey);
        oracle.setSigner(oracleSigner, true);

        // Deploy test verifier with oracle address
        verifier = new TestOracleVerifier(address(oracle));
    }

    function _signProof(
        address _user,
        address _verifier,
        bytes32 _contextHash,
        uint256 _xpAmount,
        uint256 _validAfter,
        uint256 _validBefore
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                oracle.PROOF_TYPEHASH(),
                _user,
                _verifier,
                _contextHash,
                _xpAmount,
                _validAfter,
                _validBefore
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", oracle.domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePrivateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function testInitialState() public {
        assertEq(address(verifier.oracle()), address(oracle));
    }

    function testVerify_ValidSignature() public {
        bytes32 contextHash = keccak256(abi.encode(uint256(1234)));
        uint256 xpAmount = 10;
        uint256 validAfter = 0;
        uint256 validBefore = block.timestamp + 1 days;

        bytes memory signature = _signProof(user, address(verifier), contextHash, xpAmount, validAfter, validBefore);

        uint256 xp = verifier.verify(user, contextHash, xpAmount, validAfter, validBefore, signature);
        assertEq(xp, xpAmount);
    }

    function testVerify_InvalidSignature() public {
        bytes32 contextHash = keccak256(abi.encode(uint256(9999)));
        uint256 xpAmount = 10;
        uint256 validAfter = 0;
        uint256 validBefore = block.timestamp + 1 days;

        // Sign with wrong key
        bytes32 structHash = keccak256(
            abi.encode(
                oracle.PROOF_TYPEHASH(),
                user,
                address(verifier),
                contextHash,
                xpAmount,
                validAfter,
                validBefore
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", oracle.domainSeparator(), structHash));
        uint256 wrongPrivateKey = 0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd;
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert("Invalid oracle proof");
        verifier.verify(user, contextHash, xpAmount, validAfter, validBefore, signature);
    }

    function testVerify_ExpiredWindow() public {
        bytes32 contextHash = keccak256(abi.encode("ctx"));
        uint256 xpAmount = 10;
        uint256 validAfter = 0;
        uint256 validBefore = block.timestamp + 60; // 1 minute window

        bytes memory signature = _signProof(user, address(verifier), contextHash, xpAmount, validAfter, validBefore);

        // Warp beyond validBefore
        vm.warp(validBefore + 1);
        vm.expectRevert("Invalid oracle proof");
        verifier.verify(user, contextHash, xpAmount, validAfter, validBefore, signature);
    }

    function testVerify_NotYetValid() public {
        bytes32 contextHash = keccak256(abi.encode("ctx2"));
        uint256 xpAmount = 10;
        uint256 validAfter = block.timestamp + 1 days;
        uint256 validBefore = validAfter + 1 days;

        bytes memory signature = _signProof(user, address(verifier), contextHash, xpAmount, validAfter, validBefore);

        vm.expectRevert("Invalid oracle proof");
        verifier.verify(user, contextHash, xpAmount, validAfter, validBefore, signature);
    }

    function testVerify_DifferentUserSameSignatureReverts() public {
        bytes32 contextHash = keccak256(abi.encode("bound-to-user"));
        uint256 xpAmount = 5;
        uint256 validAfter = 0;
        uint256 validBefore = block.timestamp + 1 days;

        bytes memory signature = _signProof(user, address(verifier), contextHash, xpAmount, validAfter, validBefore);

        address differentUser = address(0x5);
        vm.expectRevert("Invalid oracle proof");
        verifier.verify(differentUser, contextHash, xpAmount, validAfter, validBefore, signature);
    }

    function testUpdateOracle() public {
        XPOracle newOracle = new XPOracle("MoonDAO XP", "1");
        // Only owner (this test contract) can update
        verifier.updateOracle(address(newOracle));
        assertEq(address(verifier.oracle()), address(newOracle));
    }

    function testUpdateOracleOnlyOwner() public {
        XPOracle newOracle = new XPOracle("MoonDAO XP", "1");
        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner));
        verifier.updateOracle(address(newOracle));
    }

    function testUpdateOracleInvalidAddress() public {
        vm.expectRevert("Invalid oracle address");
        verifier.updateOracle(address(0));
    }

    function testConstructorInvalidOracle() public {
        vm.expectRevert("Invalid oracle address");
        new TestOracleVerifier(address(0));
    }
}
