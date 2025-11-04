// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/XPManager.sol";
import "../src/verifiers/HasVotingPowerStaged.sol";
import "../src/interfaces/IXPOracle.sol";
import "../src/mocks/MockERC5643Citizen.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract MockXPOracle is IXPOracle {
    mapping(bytes32 => bool) public validProofs;
    mapping(address => bool) public signers;
    bytes32 public constant DOMAIN_SEPARATOR = keccak256("MockXPOracle");

    function setValidProof(bytes32 proofHash, bool valid) external {
        validProofs[proofHash] = valid;
    }

    function setSigner(address signer, bool valid) external {
        signers[signer] = valid;
    }

    function verify(Proof memory proof) external view returns (bool) {
        bytes32 proofHash = keccak256(abi.encode(proof));
        return validProofs[proofHash];
    }

    function verifyProof(Proof calldata proof, bytes calldata signature) external view returns (bool isValid) {
        bytes32 proofHash = keccak256(abi.encode(proof));
        return validProofs[proofHash];
    }

    function isSigner(address account) external view returns (bool) {
        return signers[account];
    }

    function domainSeparator() external pure returns (bytes32) {
        return DOMAIN_SEPARATOR;
    }
}

contract BulkClaimTest is Test {
    XPManager public xpManager;
    HasVotingPowerStaged public votingVerifier;
    MockXPOracle public oracle;
    MockERC5643Citizen public citizenNFT;

    address public user = address(0x123);
    address public owner = address(this);

    uint256 public constant VERIFIER_ID = 1;

    function setUp() public {
        // Deploy contracts
        oracle = new MockXPOracle();
        
        // Deploy Citizen NFT
        citizenNFT = new MockERC5643Citizen("MoonDAO Citizen", "CITIZEN", address(0), address(0), address(0), address(0));
        
        // Deploy XPManager implementation
        XPManager implementation = new XPManager();
        
        // Deploy proxy and initialize
        bytes memory initData = abi.encodeWithSelector(XPManager.initialize.selector);
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        xpManager = XPManager(address(proxy));
        
        votingVerifier = new HasVotingPowerStaged(address(oracle));

        // Register verifier
        xpManager.registerVerifier(VERIFIER_ID, address(votingVerifier));

        // Set XPManager in verifier
        votingVerifier.setXPManager(address(xpManager));

        // Set citizen NFT address in XPManager
        xpManager.setCitizenNFTAddress(address(citizenNFT));

        // Give user a citizen NFT
        citizenNFT.mintTo(user);
    }

    function testBulkClaimAllStages() public {
        // Setup: User has 10,000 voting power (qualifies for all stages)
        uint256 votingPower = 10000;
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 1 hours;

        // Create context data
        bytes memory context = abi.encode(
            votingPower,
            0, // XP amount not used in bulk claim
            validAfter,
            validBefore,
            "" // Empty signature for testing
        );

        // Create oracle proof
        IXPOracle.Proof memory proof = IXPOracle.Proof({
            user: user,
            verifier: address(votingVerifier),
            contextHash: keccak256(abi.encode(votingPower)),
            xpAmount: 0,
            validAfter: validAfter,
            validBefore: validBefore
        });

        // Set proof as valid in mock oracle
        bytes32 proofHash = keccak256(abi.encode(proof));
        oracle.setValidProof(proofHash, true);

        // Check initial state
        assertEq(xpManager.getTotalXP(user), 0);
        assertEq(votingVerifier.getUserHighestStage(user), 0);

        // Check bulk eligibility
        (bool eligible, uint256 totalXP, uint256 highestStage) = votingVerifier.isBulkEligible(user, context);
        assertTrue(eligible);

        assertEq(totalXP, 185); // 5 + 10 + 20 + 50 + 100 = 185
        assertEq(highestStage, 4); // Index of last stage

        // Perform bulk claim
        vm.prank(user);
        xpManager.claimBulkXP(VERIFIER_ID, context);

        // Verify results
        assertEq(xpManager.getTotalXP(user), 385);
        assertEq(votingVerifier.getUserHighestStage(user), 5); // Next stage they can claim (have claimed 0-4)

        // Verify cannot claim again (no more stages available)
        vm.prank(user);
        vm.expectRevert("Not eligible");
        xpManager.claimBulkXP(VERIFIER_ID, context);
    }

    function testBulkClaimPartialStages() public {
        // Setup: User has 100 voting power (qualifies for first 3 stages)
        uint256 votingPower = 100;
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 1 hours;

        // Create context data
        bytes memory context = abi.encode(votingPower, 0, validAfter, validBefore, "");

        // Create oracle proof
        IXPOracle.Proof memory proof = IXPOracle.Proof({
            user: user,
            verifier: address(votingVerifier),
            contextHash: keccak256(abi.encode(votingPower)),
            xpAmount: 0,
            validAfter: validAfter,
            validBefore: validBefore
        });

        bytes32 proofHash = keccak256(abi.encode(proof));
        oracle.setValidProof(proofHash, true);

        // Check bulk eligibility
        (bool eligible, uint256 totalXP, uint256 highestStage) = votingVerifier.isBulkEligible(user, context);
        assertTrue(eligible);
        assertEq(totalXP, 35); // 5 + 10 + 20 = 35 (first 3 stages)
        assertEq(highestStage, 2); // Index of third stage

        // Perform bulk claim
        vm.prank(user);
        xpManager.claimBulkXP(VERIFIER_ID, context);

        // Verify results
        assertEq(xpManager.getTotalXP(user), 85);
        assertEq(votingVerifier.getUserHighestStage(user), 3); // Next stage they can claim (have claimed 0-2)
    }

    function testBulkClaimProgression() public {
        // First claim with 100 voting power
        uint256 votingPower1 = 100;
        uint256 validAfter1 = block.timestamp;
        uint256 validBefore1 = block.timestamp + 1 hours;

        bytes memory context1 = abi.encode(votingPower1, 0, validAfter1, validBefore1, "");

        IXPOracle.Proof memory proof1 = IXPOracle.Proof({
            user: user,
            verifier: address(votingVerifier),
            contextHash: keccak256(abi.encode(votingPower1)),
            xpAmount: 0,
            validAfter: validAfter1,
            validBefore: validBefore1
        });

        oracle.setValidProof(keccak256(abi.encode(proof1)), true);

        vm.prank(user);
        xpManager.claimBulkXP(VERIFIER_ID, context1);

        assertEq(xpManager.getTotalXP(user), 85);
        assertEq(votingVerifier.getUserHighestStage(user), 3);

        // Second claim with 10,000 voting power (should claim remaining stages)
        uint256 votingPower2 = 10000;
        uint256 validAfter2 = block.timestamp + 2 hours;
        uint256 validBefore2 = block.timestamp + 3 hours;

        bytes memory context2 = abi.encode(votingPower2, 0, validAfter2, validBefore2, "");

        IXPOracle.Proof memory proof2 = IXPOracle.Proof({
            user: user,
            verifier: address(votingVerifier),
            contextHash: keccak256(abi.encode(votingPower2)),
            xpAmount: 0,
            validAfter: validAfter2,
            validBefore: validBefore2
        });

        oracle.setValidProof(keccak256(abi.encode(proof2)), true);

        // Fast forward time
        vm.warp(block.timestamp + 2 hours + 1);

        // Check eligibility for remaining stages
        (bool eligible, uint256 totalXP, uint256 highestStage) = votingVerifier.isBulkEligible(user, context2);
        assertTrue(eligible);
        assertEq(totalXP, 150); // 50 + 100 = 150 (stages 3 and 4)
        assertEq(highestStage, 4);

        vm.prank(user);
        xpManager.claimBulkXP(VERIFIER_ID, context2);

        // Verify final state
        assertEq(xpManager.getTotalXP(user), 185); // 35 + 150
        assertEq(votingVerifier.getUserHighestStage(user), 5);
    }

    function testBulkClaimAlreadyClaimedError() public {
        // Test the "Already claimed" error when trying to use the same proof twice
        // We'll claim stage 0 only, then try to claim it again
        uint256 votingPower = 1; // Only qualifies for stage 0
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 1 hours;

        bytes memory context = abi.encode(votingPower, 0, validAfter, validBefore, "");

        IXPOracle.Proof memory proof = IXPOracle.Proof({
            user: user,
            verifier: address(votingVerifier),
            contextHash: keccak256(abi.encode(votingPower)),
            xpAmount: 0,
            validAfter: validAfter,
            validBefore: validBefore
        });

        oracle.setValidProof(keccak256(abi.encode(proof)), true);

        // First claim
        vm.prank(user);
        xpManager.claimBulkXP(VERIFIER_ID, context);

        assertEq(xpManager.getTotalXP(user), 10);
        assertEq(votingVerifier.getUserHighestStage(user), 1);

        // Reset user stage back to 0 so they can theoretically claim stage 0 again
        // But the proof should be marked as already used
        votingVerifier.resetUserStage(user);
        assertEq(votingVerifier.getUserHighestStage(user), 0);

        // Try to claim with the exact same context again - should get "Already claimed"
        vm.prank(user);
        vm.expectRevert("Already claimed");
        xpManager.claimBulkXP(VERIFIER_ID, context);
    }
}
