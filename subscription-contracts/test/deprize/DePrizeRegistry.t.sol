// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";

/// @dev Minimal V2 used only to prove the UUPS upgrade path + storage persistence.
contract DePrizeRegistryV2Mock is DePrizeRegistry {
    function version() external pure returns (uint256) {
        return 2;
    }
}

contract DePrizeRegistryTest is Test {
    DePrizeRegistry registry;

    address owner = address(0xA11CE);
    address stranger = address(0xBEEF);

    uint256 constant JB_PROJECT = 100;
    bytes32 constant CONDITION = bytes32(uint256(0xC0FFEE));

    // Mirror of the interface events for vm.expectEmit.
    event DePrizeRegistered(uint256 indexed deprizeId, uint256 indexed jbProjectId, uint256[] teamIds, uint256 sunset);
    event ConditionSet(uint256 indexed deprizeId, bytes32 ctfConditionId);
    event StateChanged(
        uint256 indexed deprizeId, IDePrizeRegistry.DePrizeState indexed from, IDePrizeRegistry.DePrizeState indexed to
    );
    event WinnerDeclared(uint256 indexed deprizeId, uint256 indexed winningTeamId);
    event CancellationAnnounced(uint256 indexed deprizeId, uint256 noticeAt, uint256 executableAt);
    event CancellationAborted(uint256 indexed deprizeId);

    function setUp() public {
        DePrizeRegistry impl = new DePrizeRegistry();
        bytes memory initData = abi.encodeCall(DePrizeRegistry.initialize, (owner));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        registry = DePrizeRegistry(address(proxy));
    }

    // ---------------------------------------------------------------------
    // helpers
    // ---------------------------------------------------------------------

    function _teams() internal pure returns (uint256[] memory t) {
        t = new uint256[](3);
        t[0] = 1;
        t[1] = 2;
        t[2] = 3;
    }

    function _register() internal returns (uint256 id) {
        vm.prank(owner);
        id = registry.register(JB_PROJECT, _teams(), block.timestamp + 30 days);
    }

    function _registerAndOpen() internal returns (uint256 id) {
        id = _register();
        vm.startPrank(owner);
        registry.setCondition(id, CONDITION);
        registry.open(id);
        vm.stopPrank();
    }

    function _toSettled(uint256 id, uint256 winner) internal {
        vm.startPrank(owner);
        registry.lock(id);
        registry.startVote(id);
        registry.settleWinner(id, winner);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------------
    // init
    // ---------------------------------------------------------------------

    function testInitializeSetsOwner() public view {
        assertEq(registry.owner(), owner);
        assertEq(registry.count(), 0);
        assertEq(registry.CANCELLATION_NOTICE(), 7 days);
    }

    function testCannotReinitialize() public {
        vm.expectRevert();
        registry.initialize(stranger);
    }

    // ---------------------------------------------------------------------
    // registration
    // ---------------------------------------------------------------------

    function testRegisterAssignsIdsFromOne() public {
        vm.expectEmit(true, true, false, true);
        emit DePrizeRegistered(1, JB_PROJECT, _teams(), block.timestamp + 30 days);
        vm.expectEmit(true, true, true, false);
        emit StateChanged(1, IDePrizeRegistry.DePrizeState.NONE, IDePrizeRegistry.DePrizeState.DRAFT);

        uint256 id = _register();
        assertEq(id, 1);
        assertEq(registry.count(), 1);
        assertEq(uint256(registry.state(id)), uint256(IDePrizeRegistry.DePrizeState.DRAFT));
        assertEq(registry.deprizeIdByJBProject(JB_PROJECT), 1);

        // second registration gets id 2
        vm.prank(owner);
        uint256 id2 = registry.register(JB_PROJECT + 1, _teams(), block.timestamp + 30 days);
        assertEq(id2, 2);
        assertEq(registry.count(), 2);
    }

    function testRegisterStoresTeams() public {
        uint256 id = _register();
        uint256[] memory t = registry.teamIds(id);
        assertEq(t.length, 3);
        assertTrue(registry.isTeam(id, 1));
        assertTrue(registry.isTeam(id, 2));
        assertTrue(registry.isTeam(id, 3));
        assertFalse(registry.isTeam(id, 4));
    }

    function testRegisterRevertsZeroProject() public {
        vm.prank(owner);
        vm.expectRevert(IDePrizeRegistry.InvalidJBProject.selector);
        registry.register(0, _teams(), block.timestamp + 30 days);
    }

    function testRegisterRevertsDuplicateProject() public {
        _register();
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.JBProjectAlreadyBound.selector, JB_PROJECT));
        registry.register(JB_PROJECT, _teams(), block.timestamp + 30 days);
    }

    function testRegisterRevertsTooFewTeams() public {
        uint256[] memory t = new uint256[](1);
        t[0] = 1;
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.TooFewTeams.selector, 1));
        registry.register(JB_PROJECT, t, block.timestamp + 30 days);
    }

    function testRegisterRevertsDuplicateTeam() public {
        uint256[] memory t = new uint256[](3);
        t[0] = 1;
        t[1] = 2;
        t[2] = 1;
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.DuplicateTeam.selector, 1));
        registry.register(JB_PROJECT, t, block.timestamp + 30 days);
    }

    function testRegisterRevertsPastSunset() public {
        vm.prank(owner);
        vm.expectRevert(IDePrizeRegistry.InvalidSunset.selector);
        registry.register(JB_PROJECT, _teams(), block.timestamp);
    }

    function testRegisterOnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", stranger));
        registry.register(JB_PROJECT, _teams(), block.timestamp + 30 days);
    }

    // ---------------------------------------------------------------------
    // configuration
    // ---------------------------------------------------------------------

    function testSetConditionDraftOnlyAndOverwritable() public {
        uint256 id = _register();
        vm.expectEmit(true, false, false, true);
        emit ConditionSet(id, CONDITION);
        vm.prank(owner);
        registry.setCondition(id, CONDITION);
        assertEq(registry.getDePrize(id).ctfConditionId, CONDITION);

        // overwrite while still DRAFT
        bytes32 other = bytes32(uint256(0xBEEF));
        vm.prank(owner);
        registry.setCondition(id, other);
        assertEq(registry.getDePrize(id).ctfConditionId, other);
    }

    function testSetConditionRevertsAfterOpen() public {
        uint256 id = _registerAndOpen();
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IDePrizeRegistry.InvalidState.selector, id, IDePrizeRegistry.DePrizeState.OPEN)
        );
        registry.setCondition(id, CONDITION);
    }

    function testSetSunset() public {
        uint256 id = _register();
        vm.prank(owner);
        registry.setSunset(id, block.timestamp + 60 days);
        assertEq(registry.getDePrize(id).sunset, block.timestamp + 60 days);
    }

    function testSetSunsetRevertsPast() public {
        uint256 id = _register();
        vm.prank(owner);
        vm.expectRevert(IDePrizeRegistry.InvalidSunset.selector);
        registry.setSunset(id, block.timestamp);
    }

    // ---------------------------------------------------------------------
    // open guards
    // ---------------------------------------------------------------------

    function testOpenRequiresCondition() public {
        uint256 id = _register();
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.ConditionNotSet.selector, id));
        registry.open(id);
    }

    function testOpenRevertsIfSunsetPassed() public {
        uint256 id = _register();
        vm.prank(owner);
        registry.setCondition(id, CONDITION);
        vm.warp(block.timestamp + 31 days);
        vm.prank(owner);
        vm.expectRevert(IDePrizeRegistry.InvalidSunset.selector);
        registry.open(id);
    }

    // ---------------------------------------------------------------------
    // happy path
    // ---------------------------------------------------------------------

    function testHappyPathToM2Complete() public {
        uint256 id = _registerAndOpen();
        assertEq(uint256(registry.state(id)), uint256(IDePrizeRegistry.DePrizeState.OPEN));
        assertTrue(registry.bettingOpen(id));

        vm.startPrank(owner);
        registry.lock(id);
        assertEq(uint256(registry.state(id)), uint256(IDePrizeRegistry.DePrizeState.LOCKED));
        assertFalse(registry.bettingOpen(id));

        registry.startVote(id);
        assertEq(uint256(registry.state(id)), uint256(IDePrizeRegistry.DePrizeState.VOTING));

        vm.expectEmit(true, true, false, false);
        emit WinnerDeclared(id, 2);
        registry.settleWinner(id, 2);
        assertEq(uint256(registry.state(id)), uint256(IDePrizeRegistry.DePrizeState.SETTLED));
        assertEq(registry.winningTeamId(id), 2);

        registry.releaseM1(id);
        assertEq(uint256(registry.state(id)), uint256(IDePrizeRegistry.DePrizeState.M1_RELEASED));

        registry.completeM2(id);
        assertEq(uint256(registry.state(id)), uint256(IDePrizeRegistry.DePrizeState.M2_COMPLETE));
        vm.stopPrank();

        assertTrue(registry.isTerminal(id));
        assertFalse(registry.isRefundable(id));
    }

    function testSettleWinnerFromLockedSkippingVote() public {
        uint256 id = _registerAndOpen();
        vm.startPrank(owner);
        registry.lock(id);
        registry.settleWinner(id, 1);
        vm.stopPrank();
        assertEq(uint256(registry.state(id)), uint256(IDePrizeRegistry.DePrizeState.SETTLED));
        assertEq(registry.winningTeamId(id), 1);
    }

    function testSettleWinnerUnknownTeamReverts() public {
        uint256 id = _registerAndOpen();
        vm.startPrank(owner);
        registry.lock(id);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.UnknownTeam.selector, id, 99));
        registry.settleWinner(id, 99);
        vm.stopPrank();
    }

    function testSettleNoWinnerFromVoting() public {
        uint256 id = _registerAndOpen();
        vm.startPrank(owner);
        registry.lock(id);
        registry.startVote(id);
        registry.settleNoWinner(id);
        vm.stopPrank();
        assertEq(uint256(registry.state(id)), uint256(IDePrizeRegistry.DePrizeState.NO_WINNER));
        assertTrue(registry.isRefundable(id));
        assertTrue(registry.isTerminal(id));
    }

    function testM2FailedPath() public {
        uint256 id = _registerAndOpen();
        _toSettled(id, 2);
        vm.startPrank(owner);
        registry.releaseM1(id);
        registry.failM2(id);
        vm.stopPrank();
        assertEq(uint256(registry.state(id)), uint256(IDePrizeRegistry.DePrizeState.M2_FAILED));
        assertTrue(registry.isRefundable(id));
    }

    // ---------------------------------------------------------------------
    // invalid transitions
    // ---------------------------------------------------------------------

    function testLockBeforeOpenReverts() public {
        uint256 id = _register();
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IDePrizeRegistry.InvalidState.selector, id, IDePrizeRegistry.DePrizeState.DRAFT)
        );
        registry.lock(id);
    }

    function testStartVoteBeforeLockReverts() public {
        uint256 id = _registerAndOpen();
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IDePrizeRegistry.InvalidState.selector, id, IDePrizeRegistry.DePrizeState.OPEN)
        );
        registry.startVote(id);
    }

    function testReleaseM1BeforeSettledReverts() public {
        uint256 id = _registerAndOpen();
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IDePrizeRegistry.InvalidState.selector, id, IDePrizeRegistry.DePrizeState.OPEN)
        );
        registry.releaseM1(id);
    }

    function testCompleteM2BeforeReleaseReverts() public {
        uint256 id = _registerAndOpen();
        _toSettled(id, 2);
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IDePrizeRegistry.InvalidState.selector, id, IDePrizeRegistry.DePrizeState.SETTLED)
        );
        registry.completeM2(id);
    }

    function testSettleWinnerFromOpenReverts() public {
        uint256 id = _registerAndOpen();
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IDePrizeRegistry.InvalidState.selector, id, IDePrizeRegistry.DePrizeState.OPEN)
        );
        registry.settleWinner(id, 1);
    }

    // ---------------------------------------------------------------------
    // cancellation
    // ---------------------------------------------------------------------

    function testCancellationFlow() public {
        uint256 id = _registerAndOpen();
        uint256 noticeAt = block.timestamp;

        vm.expectEmit(true, false, false, true);
        emit CancellationAnnounced(id, noticeAt, noticeAt + 7 days);
        vm.prank(owner);
        registry.announceCancellation(id);

        assertTrue(registry.cancellationPending(id));
        assertFalse(registry.bettingOpen(id)); // bets pause immediately

        // too early
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IDePrizeRegistry.CancellationNoticeNotElapsed.selector, id, noticeAt + 7 days)
        );
        registry.cancel(id);

        // still too early at 7 days minus 1
        vm.warp(noticeAt + 7 days - 1);
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IDePrizeRegistry.CancellationNoticeNotElapsed.selector, id, noticeAt + 7 days)
        );
        registry.cancel(id);

        // exactly at the window
        vm.warp(noticeAt + 7 days);
        vm.prank(owner);
        registry.cancel(id);
        assertEq(uint256(registry.state(id)), uint256(IDePrizeRegistry.DePrizeState.CANCELLED));
        assertTrue(registry.isRefundable(id));
        assertTrue(registry.isTerminal(id));
    }

    function testCancelWithoutNoticeReverts() public {
        uint256 id = _registerAndOpen();
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.NoCancellationPending.selector, id));
        registry.cancel(id);
    }

    function testAbortCancellationReenablesBetting() public {
        uint256 id = _registerAndOpen();
        vm.prank(owner);
        registry.announceCancellation(id);
        assertFalse(registry.bettingOpen(id));

        vm.expectEmit(true, false, false, false);
        emit CancellationAborted(id);
        vm.prank(owner);
        registry.abortCancellation(id);

        assertFalse(registry.cancellationPending(id));
        assertTrue(registry.bettingOpen(id));
    }

    function testAbortWithoutNoticeReverts() public {
        uint256 id = _registerAndOpen();
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.NoCancellationPending.selector, id));
        registry.abortCancellation(id);
    }

    function testCancelFromDraft() public {
        uint256 id = _register();
        vm.startPrank(owner);
        registry.announceCancellation(id);
        vm.warp(block.timestamp + 7 days);
        registry.cancel(id);
        vm.stopPrank();
        assertEq(uint256(registry.state(id)), uint256(IDePrizeRegistry.DePrizeState.CANCELLED));
    }

    function testCancelFromSettled() public {
        uint256 id = _registerAndOpen();
        _toSettled(id, 2);
        vm.startPrank(owner);
        registry.announceCancellation(id);
        vm.warp(block.timestamp + 7 days);
        registry.cancel(id);
        vm.stopPrank();
        assertEq(uint256(registry.state(id)), uint256(IDePrizeRegistry.DePrizeState.CANCELLED));
    }

    function testAnnounceCancellationOnTerminalReverts() public {
        uint256 id = _registerAndOpen();
        _toSettled(id, 2);
        vm.startPrank(owner);
        registry.releaseM1(id);
        registry.completeM2(id);
        vm.expectRevert(
            abi.encodeWithSelector(
                IDePrizeRegistry.InvalidState.selector, id, IDePrizeRegistry.DePrizeState.M2_COMPLETE
            )
        );
        registry.announceCancellation(id);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------------
    // access control on transitions
    // ---------------------------------------------------------------------

    function testTransitionsOnlyOwner() public {
        uint256 id = _registerAndOpen();
        bytes memory err = abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", stranger);

        vm.startPrank(stranger);
        vm.expectRevert(err);
        registry.lock(id);
        vm.expectRevert(err);
        registry.setCondition(id, CONDITION);
        vm.expectRevert(err);
        registry.announceCancellation(id);
        vm.expectRevert(err);
        registry.settleWinner(id, 1);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------------
    // unknown deprize views
    // ---------------------------------------------------------------------

    function testUnknownDePrizeStateIsNone() public view {
        assertEq(uint256(registry.state(999)), uint256(IDePrizeRegistry.DePrizeState.NONE));
        assertEq(registry.deprizeIdByJBProject(999), 0);
    }

    function testGetUnknownDePrizeReverts() public {
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.UnknownDePrize.selector, 999));
        registry.getDePrize(999);
    }

    function testOpenUnknownDePrizeReverts() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.UnknownDePrize.selector, 999));
        registry.open(999);
    }

    // ---------------------------------------------------------------------
    // UUPS upgrade
    // ---------------------------------------------------------------------

    function testUpgradeByOwnerPreservesState() public {
        uint256 id = _registerAndOpen();

        DePrizeRegistryV2Mock v2 = new DePrizeRegistryV2Mock();
        vm.prank(owner);
        registry.upgradeToAndCall(address(v2), "");

        DePrizeRegistryV2Mock upgraded = DePrizeRegistryV2Mock(address(registry));
        assertEq(upgraded.version(), 2);
        // state survived the upgrade
        assertEq(upgraded.count(), 1);
        assertEq(uint256(upgraded.state(id)), uint256(IDePrizeRegistry.DePrizeState.OPEN));
        assertEq(upgraded.deprizeIdByJBProject(JB_PROJECT), id);
    }

    function testUpgradeByStrangerReverts() public {
        DePrizeRegistryV2Mock v2 = new DePrizeRegistryV2Mock();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", stranger));
        registry.upgradeToAndCall(address(v2), "");
    }
}
