// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/XPManager.sol";
import "../src/verifiers/CitizenReferralsStaged.sol";
import "../src/mocks/MockERC5643Citizen.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title StagedVerifierFarmingFix
/// @notice Tests that the fix for Bug C3 (Staged Verifier Farming via Single Claims) works correctly.
/// @dev The bug allowed a user to re-claim the same stage via claimXP() because
///      userHighestClaimedStage was not updated on the single-claim path.
contract StagedVerifierFarmingFixTest is Test {
    XPManager public xpManager;
    CitizenReferralsStaged public referralVerifier;
    MockERC5643Citizen public citizenNFT;

    address public user = address(0x1);
    address public referredA = address(0xA);
    address public referredB = address(0xB);
    address public referredC = address(0xC);
    address public authorizedSigner = address(this);

    uint256 public constant VERIFIER_ID = 7;

    function setUp() public {
        // Deploy Citizen NFT
        citizenNFT = new MockERC5643Citizen("MoonDAO Citizen", "CITIZEN", address(0), address(0), address(0), address(0));

        // Deploy XPManager via proxy
        XPManager implementation = new XPManager();
        bytes memory initData = abi.encodeWithSelector(XPManager.initialize.selector);
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        xpManager = XPManager(address(proxy));

        // Deploy CitizenReferralsStaged
        referralVerifier = new CitizenReferralsStaged(authorizedSigner);

        // Register verifier
        xpManager.registerVerifier(VERIFIER_ID, address(referralVerifier));

        // Set XPManager in verifier
        referralVerifier.setXPManager(address(xpManager));

        // Set citizen NFT address
        xpManager.setCitizenNFTAddress(address(citizenNFT));

        // Give user a citizen NFT
        citizenNFT.mintTo(user);
    }

    /// @notice Test the original exploit scenario: user claims stage 0 twice with different claimIds.
    /// @dev Before the fix, the second claimXP() would succeed because userHighestClaimedStage
    ///      was never updated. After the fix, the second call should revert with "Not eligible".
    function test_cannotFarmStage0WithDifferentClaimIds() public {
        bytes memory emptyContext = "";

        // Step 1: User gets 1 referral
        referralVerifier.referred(referredA, user);
        assertEq(referralVerifier.referralCount(user), 1);

        // Step 2: User claims stage 0 via single claim (claimXP)
        vm.prank(user);
        xpManager.claimXP(VERIFIER_ID, emptyContext);

        // Verify: user got 1,000 XP
        assertEq(xpManager.getTotalXP(user), 1000);

        // Verify: userHighestClaimedStage is now 1 (meaning stage 0 has been claimed)
        assertEq(referralVerifier.getUserHighestStage(user), 1);

        // Step 3: User gets a 2nd referral (changes claimId)
        referralVerifier.referred(referredB, user);
        assertEq(referralVerifier.referralCount(user), 2);

        // Step 4: User tries to claim stage 0 again — should FAIL
        vm.prank(user);
        vm.expectRevert("Not eligible");
        xpManager.claimXP(VERIFIER_ID, emptyContext);

        // Verify: XP is still only 1,000
        assertEq(xpManager.getTotalXP(user), 1000);
    }

    /// @notice Test that normal sequential progression still works via single claims.
    function test_singleClaimProgressesStagesCorrectly() public {
        bytes memory emptyContext = "";

        // Stage 0: 1 referral → 1,000 XP
        referralVerifier.referred(referredA, user);

        vm.prank(user);
        xpManager.claimXP(VERIFIER_ID, emptyContext);

        assertEq(xpManager.getTotalXP(user), 1000);
        assertEq(referralVerifier.getUserHighestStage(user), 1); // Can now claim stage 1

        // Stage 1: 3 referrals → 3,000 XP
        referralVerifier.referred(referredB, user);
        referralVerifier.referred(referredC, user);
        assertEq(referralVerifier.referralCount(user), 3);

        vm.prank(user);
        xpManager.claimXP(VERIFIER_ID, emptyContext);

        assertEq(xpManager.getTotalXP(user), 4000); // 1,000 + 3,000
        assertEq(referralVerifier.getUserHighestStage(user), 2); // Can now claim stage 2
    }

    /// @notice Test that bulk claim still works correctly after the fix.
    function test_bulkClaimStillWorksCorrectly() public {
        bytes memory emptyContext = "";

        // Give user 3 referrals (qualifies for stage 0 and stage 1)
        referralVerifier.referred(referredA, user);
        referralVerifier.referred(referredB, user);
        referralVerifier.referred(referredC, user);

        // Bulk claim all eligible stages
        vm.prank(user);
        xpManager.claimBulkXP(VERIFIER_ID, emptyContext);

        // Should get stage 0 (1,000) + stage 1 (3,000) = 4,000 XP
        assertEq(xpManager.getTotalXP(user), 4000);
        assertEq(referralVerifier.getUserHighestStage(user), 2); // Next claimable is stage 2
    }

    /// @notice Test that mixing single and bulk claims works correctly.
    function test_mixedSingleAndBulkClaims() public {
        bytes memory emptyContext = "";

        // Claim stage 0 via single claim
        referralVerifier.referred(referredA, user);
        vm.prank(user);
        xpManager.claimXP(VERIFIER_ID, emptyContext);
        assertEq(xpManager.getTotalXP(user), 1000);
        assertEq(referralVerifier.getUserHighestStage(user), 1);

        // Now get 3 referrals total (qualifies for stage 1)
        referralVerifier.referred(referredB, user);
        referralVerifier.referred(referredC, user);

        // Bulk claim remaining stages
        vm.prank(user);
        xpManager.claimBulkXP(VERIFIER_ID, emptyContext);

        // Should only get stage 1 (3,000 XP) since stage 0 already claimed
        assertEq(xpManager.getTotalXP(user), 4000); // 1,000 + 3,000
        assertEq(referralVerifier.getUserHighestStage(user), 2);
    }

    /// @notice Test that a duplicate claim with the same claimId is still caught by usedProofs.
    function test_duplicateExactClaimIdStillBlocked() public {
        bytes memory emptyContext = "";

        // User gets 1 referral and claims
        referralVerifier.referred(referredA, user);
        vm.prank(user);
        xpManager.claimXP(VERIFIER_ID, emptyContext);

        // Try to claim again with the SAME claimId (same referral count)
        // This was always caught by usedProofs, even before the fix
        vm.prank(user);
        vm.expectRevert("Already claimed");
        xpManager.claimXP(VERIFIER_ID, emptyContext);
    }
}
