// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";

/// @notice DePrizeRegistry v2: immutable, Ownable2Step, seven states.
contract DePrizeRegistryTest is Test {
    DePrizeRegistry registry;

    address owner = address(0xA11CE);
    address stranger = address(0xBEEF);

    uint256 constant JB_PROJECT = 100;
    bytes32 constant CONDITION = bytes32(uint256(0xC0FFEE));

    event DePrizeRegistered(uint256 indexed deprizeId, uint256 indexed jbProjectId, uint256[] teamIds, uint256 sunset);
    event ConditionSet(uint256 indexed deprizeId, bytes32 ctfConditionId);
    event SunsetUpdated(uint256 indexed deprizeId, uint256 sunset);
    event StateChanged(
        uint256 indexed deprizeId, IDePrizeRegistry.DePrizeState indexed from, IDePrizeRegistry.DePrizeState indexed to
    );
    event WinnerDeclared(uint256 indexed deprizeId, uint256 indexed winningTeamId);
    event CancellationAnnounced(uint256 indexed deprizeId, uint256 noticeAt, uint256 executableAt);
    event CancellationAborted(uint256 indexed deprizeId);
    event TeamsUpdated(uint256 indexed deprizeId, uint256[] teamIds);
    event DePrizeSuperseded(uint256 indexed oldDeprizeId, uint256 indexed newDeprizeId, uint256[] newTeamIds);

    function setUp() public {
        registry = new DePrizeRegistry(owner);
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

    function _toLocked() internal returns (uint256 id) {
        id = _registerAndOpen();
        vm.prank(owner);
        registry.lock(id);
    }

    function _toSettled(uint256 winner) internal returns (uint256 id) {
        id = _toLocked();
        vm.prank(owner);
        registry.settleWinner(id, winner);
    }

    /// @dev Drive a fresh DePrize (unique JB project) into `target`.
    function _fresh(uint256 jb, IDePrizeRegistry.DePrizeState target) internal returns (uint256 id) {
        vm.startPrank(owner);
        id = registry.register(jb, _teams(), block.timestamp + 30 days);
        if (target == IDePrizeRegistry.DePrizeState.DRAFT) return _stop(id);
        registry.setCondition(id, CONDITION);
        registry.open(id);
        if (target == IDePrizeRegistry.DePrizeState.OPEN) return _stop(id);
        if (target == IDePrizeRegistry.DePrizeState.SUPERSEDED) {
            registry.supersede(id, _teams(), block.timestamp + 60 days);
            return _stop(id);
        }
        if (target == IDePrizeRegistry.DePrizeState.CANCELLED) {
            registry.announceCancellation(id);
            vm.warp(block.timestamp + 7 days);
            registry.cancel(id);
            return _stop(id);
        }
        registry.lock(id);
        if (target == IDePrizeRegistry.DePrizeState.LOCKED) return _stop(id);
        if (target == IDePrizeRegistry.DePrizeState.NO_WINNER) {
            registry.settleNoWinner(id);
            return _stop(id);
        }
        registry.settleWinner(id, 2);
        return _stop(id);
    }

    function _stop(uint256 id) private returns (uint256) {
        vm.stopPrank();
        return id;
    }

    function _st(uint256 id) internal view returns (IDePrizeRegistry.DePrizeState) {
        return registry.state(id);
    }

    // ---------------------------------------------------------------------
    // construction & ownership
    // ---------------------------------------------------------------------

    function testConstructorSetsOwnerAndDefaults() public view {
        assertEq(registry.owner(), owner);
        assertEq(registry.pendingOwner(), address(0));
        assertEq(registry.count(), 0);
        assertEq(registry.CANCELLATION_NOTICE(), 7 days);
    }

    function testConstructorRejectsZeroOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new DePrizeRegistry(address(0));
    }

    function testOwnershipIsTwoStep() public {
        vm.prank(owner);
        registry.transferOwnership(stranger);
        assertEq(registry.owner(), owner, "owner unchanged until accepted");
        assertEq(registry.pendingOwner(), stranger);

        // The old owner still administers until acceptance.
        _register();

        vm.prank(stranger);
        registry.acceptOwnership();
        assertEq(registry.owner(), stranger);
        assertEq(registry.pendingOwner(), address(0));

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, owner));
        registry.register(JB_PROJECT + 1, _teams(), block.timestamp + 1 days);
    }

    function testRenounceOwnershipDisabled() public {
        vm.prank(owner);
        vm.expectRevert(DePrizeRegistry.RenounceDisabled.selector);
        registry.renounceOwnership();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        registry.renounceOwnership();
        assertEq(registry.owner(), owner);
    }

    function testAcceptOwnershipOnlyPending() public {
        vm.prank(owner);
        registry.transferOwnership(stranger);
        vm.prank(address(0xD00D));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, address(0xD00D)));
        registry.acceptOwnership();
    }

    function testNoUpgradeOrInitializeSurface() public view {
        // The immutable registry exposes no proxy plumbing.
        (bool okInit,) = address(registry).staticcall(abi.encodeWithSignature("initialize(address)", owner));
        assertFalse(okInit, "initialize must not exist");
        (bool okUpgrade,) = address(registry).staticcall(abi.encodeWithSignature("proxiableUUID()"));
        assertFalse(okUpgrade, "UUPS must not exist");
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
        assertEq(uint256(_st(id)), uint256(IDePrizeRegistry.DePrizeState.DRAFT));
        assertEq(registry.deprizeIdByJBProject(JB_PROJECT), 1);

        vm.prank(owner);
        uint256 id2 = registry.register(JB_PROJECT + 1, _teams(), block.timestamp + 30 days);
        assertEq(id2, 2);
        assertEq(registry.count(), 2);
    }

    function testRegisterStoresTeamsAndRecord() public {
        uint256 id = _register();
        IDePrizeRegistry.DePrize memory d = registry.getDePrize(id);
        assertEq(d.jbProjectId, JB_PROJECT);
        assertEq(d.ctfConditionId, bytes32(0));
        assertEq(d.sunset, block.timestamp + 30 days);
        assertEq(d.winningTeamId, 0);
        assertEq(d.cancellationNoticeAt, 0);
        assertEq(d.teamIds.length, 3);
        assertTrue(registry.isTeam(id, 1));
        assertTrue(registry.isTeam(id, 3));
        assertFalse(registry.isTeam(id, 4));
    }

    function testRegisterOnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        registry.register(JB_PROJECT, _teams(), block.timestamp + 1 days);
    }

    function testRegisterRevertsZeroJBProject() public {
        vm.prank(owner);
        vm.expectRevert(IDePrizeRegistry.InvalidJBProject.selector);
        registry.register(0, _teams(), block.timestamp + 1 days);
    }

    function testRegisterRevertsBoundJBProject() public {
        _register();
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.JBProjectAlreadyBound.selector, JB_PROJECT));
        registry.register(JB_PROJECT, _teams(), block.timestamp + 1 days);
    }

    function testRegisterRevertsTooFewTeams() public {
        uint256[] memory one = new uint256[](1);
        one[0] = 1;
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.TooFewTeams.selector, 1));
        registry.register(JB_PROJECT, one, block.timestamp + 1 days);
    }

    function testRegisterRevertsZeroTeamId() public {
        uint256[] memory t = _teams();
        t[1] = 0;
        vm.prank(owner);
        vm.expectRevert(IDePrizeRegistry.ZeroTeamId.selector);
        registry.register(JB_PROJECT, t, block.timestamp + 1 days);
    }

    function testRegisterRevertsDuplicateTeam() public {
        uint256[] memory t = _teams();
        t[2] = 1;
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.DuplicateTeam.selector, 1));
        registry.register(JB_PROJECT, t, block.timestamp + 1 days);
    }

    function testRegisterRevertsPastSunset() public {
        vm.prank(owner);
        vm.expectRevert(IDePrizeRegistry.InvalidSunset.selector);
        registry.register(JB_PROJECT, _teams(), block.timestamp);
    }

    function testFuzzRegisterRoster(uint256 jb, uint8 n, uint256 seed, uint64 ahead) public {
        jb = bound(jb, 1, type(uint256).max);
        n = uint8(bound(n, 2, 12));
        ahead = uint64(bound(ahead, 1, 3650 days));
        uint256[] memory t = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            t[i] = uint256(keccak256(abi.encode(seed, i))) | 1; // never zero, unique w.h.p.
        }
        vm.prank(owner);
        uint256 id = registry.register(jb, t, block.timestamp + ahead);
        assertEq(registry.teamIds(id).length, n);
        for (uint256 i = 0; i < n; i++) {
            assertTrue(registry.isTeam(id, t[i]));
        }
        assertEq(registry.deprizeIdByJBProject(jb), id);
        assertTrue(registry.getDePrize(id).sunset > block.timestamp);
    }

    // ---------------------------------------------------------------------
    // configuration: condition / sunset / teams
    // ---------------------------------------------------------------------

    function testSetConditionDraftOnlyAndOverwritable() public {
        uint256 id = _register();
        vm.startPrank(owner);
        vm.expectEmit(true, false, false, true);
        emit ConditionSet(id, CONDITION);
        registry.setCondition(id, CONDITION);
        registry.setCondition(id, bytes32(uint256(2)));
        assertEq(registry.getDePrize(id).ctfConditionId, bytes32(uint256(2)));
        registry.open(id);
        vm.expectRevert(
            abi.encodeWithSelector(IDePrizeRegistry.InvalidState.selector, id, IDePrizeRegistry.DePrizeState.OPEN)
        );
        registry.setCondition(id, CONDITION);
        vm.stopPrank();
    }

    function testSetSunsetDraftAnyFuture() public {
        uint256 id = _register();
        vm.startPrank(owner);
        vm.expectEmit(true, false, false, true);
        emit SunsetUpdated(id, block.timestamp + 1 days);
        registry.setSunset(id, block.timestamp + 1 days);
        assertEq(registry.getDePrize(id).sunset, block.timestamp + 1 days);
        vm.expectRevert(IDePrizeRegistry.InvalidSunset.selector);
        registry.setSunset(id, block.timestamp);
        vm.stopPrank();
    }

    function testSetSunsetOpenExtendOnly() public {
        uint256 id = _registerAndOpen();
        uint256 current = registry.getDePrize(id).sunset;
        vm.startPrank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IDePrizeRegistry.SunsetNotExtended.selector, current, current - 1 days)
        );
        registry.setSunset(id, current - 1 days);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.SunsetNotExtended.selector, current, current));
        registry.setSunset(id, current);
        registry.setSunset(id, current + 1);
        assertEq(registry.getDePrize(id).sunset, current + 1);
        vm.stopPrank();
    }

    function testSetSunsetRejectedOutsideDraftOrOpen() public {
        uint256 id = _toLocked();
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IDePrizeRegistry.InvalidState.selector, id, IDePrizeRegistry.DePrizeState.LOCKED)
        );
        registry.setSunset(id, block.timestamp + 90 days);
    }

    function testSetTeamsReplacesRosterAndClearsStaleMembership() public {
        uint256 id = _register();
        uint256[] memory t = new uint256[](2);
        t[0] = 7;
        t[1] = 8;
        vm.startPrank(owner);
        vm.expectEmit(true, false, false, true);
        emit TeamsUpdated(id, t);
        registry.setTeams(id, t);
        vm.stopPrank();
        assertEq(registry.teamIds(id).length, 2);
        assertFalse(registry.isTeam(id, 1), "stale membership cleared");
        assertTrue(registry.isTeam(id, 7));

        // A stale id can never become the winner.
        vm.startPrank(owner);
        registry.setCondition(id, CONDITION);
        registry.open(id);
        registry.lock(id);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.UnknownTeam.selector, id, 1));
        registry.settleWinner(id, 1);
        vm.stopPrank();
    }

    function testSetTeamsValidatesLikeRegister() public {
        uint256 id = _register();
        uint256[] memory one = new uint256[](1);
        one[0] = 9;
        uint256[] memory zero = _teams();
        zero[0] = 0;
        uint256[] memory dup = _teams();
        dup[2] = 2;
        vm.startPrank(owner);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.TooFewTeams.selector, 1));
        registry.setTeams(id, one);
        vm.expectRevert(IDePrizeRegistry.ZeroTeamId.selector);
        registry.setTeams(id, zero);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.DuplicateTeam.selector, 2));
        registry.setTeams(id, dup);
        vm.stopPrank();
    }

    function testSetTeamsDraftOnly() public {
        uint256 id = _registerAndOpen();
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IDePrizeRegistry.InvalidState.selector, id, IDePrizeRegistry.DePrizeState.OPEN)
        );
        registry.setTeams(id, _teams());
    }

    // ---------------------------------------------------------------------
    // happy-path transitions
    // ---------------------------------------------------------------------

    function testOpenRequiresCondition() public {
        uint256 id = _register();
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.ConditionNotSet.selector, id));
        registry.open(id);
    }

    function testOpenRequiresFutureSunset() public {
        uint256 id = _register();
        vm.startPrank(owner);
        registry.setCondition(id, CONDITION);
        vm.warp(block.timestamp + 31 days);
        vm.expectRevert(IDePrizeRegistry.InvalidSunset.selector);
        registry.open(id);
        vm.stopPrank();
    }

    function testOpenLockSettleWinner() public {
        uint256 id = _registerAndOpen();
        assertTrue(registry.bettingOpen(id));
        vm.startPrank(owner);
        vm.expectEmit(true, true, true, false);
        emit StateChanged(id, IDePrizeRegistry.DePrizeState.OPEN, IDePrizeRegistry.DePrizeState.LOCKED);
        registry.lock(id);
        assertFalse(registry.bettingOpen(id));

        vm.expectEmit(true, true, true, false);
        emit StateChanged(id, IDePrizeRegistry.DePrizeState.LOCKED, IDePrizeRegistry.DePrizeState.SETTLED);
        vm.expectEmit(true, true, false, false);
        emit WinnerDeclared(id, 2);
        registry.settleWinner(id, 2);
        vm.stopPrank();

        assertEq(registry.winningTeamId(id), 2);
        assertTrue(registry.isTerminal(id), "SETTLED is the success terminal");
        assertFalse(registry.isRefundable(id));
    }

    function testSettleWinnerUnknownTeamReverts() public {
        uint256 id = _toLocked();
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.UnknownTeam.selector, id, 42));
        registry.settleWinner(id, 42);
    }

    function testSettleWinnerZeroTeamReverts() public {
        uint256 id = _toLocked();
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.UnknownTeam.selector, id, 0));
        registry.settleWinner(id, 0);
    }

    function testSettleNoWinner() public {
        uint256 id = _toLocked();
        vm.prank(owner);
        registry.settleNoWinner(id);
        assertEq(uint256(_st(id)), uint256(IDePrizeRegistry.DePrizeState.NO_WINNER));
        assertTrue(registry.isTerminal(id));
        assertTrue(registry.isRefundable(id));
        assertEq(registry.winningTeamId(id), 0);
    }

    function testSettleClearsPendingCancellation() public {
        uint256 id = _toLocked();
        vm.startPrank(owner);
        registry.announceCancellation(id);
        assertTrue(registry.cancellationPending(id));
        vm.expectEmit(true, false, false, false);
        emit CancellationAborted(id);
        registry.settleWinner(id, 1);
        vm.stopPrank();
        assertFalse(registry.cancellationPending(id));
    }

    // ---------------------------------------------------------------------
    // exhaustive transition matrix
    // ---------------------------------------------------------------------

    function _allStates() internal pure returns (IDePrizeRegistry.DePrizeState[7] memory s) {
        s[0] = IDePrizeRegistry.DePrizeState.DRAFT;
        s[1] = IDePrizeRegistry.DePrizeState.OPEN;
        s[2] = IDePrizeRegistry.DePrizeState.LOCKED;
        s[3] = IDePrizeRegistry.DePrizeState.SETTLED;
        s[4] = IDePrizeRegistry.DePrizeState.NO_WINNER;
        s[5] = IDePrizeRegistry.DePrizeState.CANCELLED;
        s[6] = IDePrizeRegistry.DePrizeState.SUPERSEDED;
    }

    function _expectInvalid(uint256 id, IDePrizeRegistry.DePrizeState s) internal {
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.InvalidState.selector, id, s));
    }

    function testMatrixOpenOnlyFromDraft() public {
        IDePrizeRegistry.DePrizeState[7] memory s = _allStates();
        for (uint256 i = 0; i < s.length; i++) {
            uint256 id = _fresh(1000 + i, s[i]);
            vm.prank(owner);
            if (s[i] == IDePrizeRegistry.DePrizeState.DRAFT) {
                vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.ConditionNotSet.selector, id));
            } else {
                _expectInvalid(id, s[i]);
            }
            registry.open(id);
        }
    }

    function testMatrixLockOnlyFromOpen() public {
        IDePrizeRegistry.DePrizeState[7] memory s = _allStates();
        for (uint256 i = 0; i < s.length; i++) {
            uint256 id = _fresh(1000 + i, s[i]);
            vm.prank(owner);
            if (s[i] != IDePrizeRegistry.DePrizeState.OPEN) _expectInvalid(id, s[i]);
            registry.lock(id);
            if (s[i] == IDePrizeRegistry.DePrizeState.OPEN) {
                assertEq(uint256(_st(id)), uint256(IDePrizeRegistry.DePrizeState.LOCKED));
            }
        }
    }

    function testMatrixSettleOnlyFromLocked() public {
        IDePrizeRegistry.DePrizeState[7] memory s = _allStates();
        for (uint256 i = 0; i < s.length; i++) {
            uint256 id = _fresh(1000 + i, s[i]);
            bool locked = s[i] == IDePrizeRegistry.DePrizeState.LOCKED;
            vm.prank(owner);
            if (!locked) _expectInvalid(id, s[i]);
            registry.settleNoWinner(id);

            uint256 id2 = _fresh(2000 + i, s[i]);
            vm.prank(owner);
            if (!locked) _expectInvalid(id2, s[i]);
            registry.settleWinner(id2, 1);
        }
    }

    function testMatrixSetConditionAndTeamsOnlyFromDraft() public {
        IDePrizeRegistry.DePrizeState[7] memory s = _allStates();
        for (uint256 i = 0; i < s.length; i++) {
            uint256 id = _fresh(1000 + i, s[i]);
            bool draft = s[i] == IDePrizeRegistry.DePrizeState.DRAFT;
            vm.startPrank(owner);
            if (!draft) _expectInvalid(id, s[i]);
            registry.setCondition(id, CONDITION);
            if (!draft) _expectInvalid(id, s[i]);
            registry.setTeams(id, _teams());
            vm.stopPrank();
        }
    }

    function testMatrixSupersedeOnlyFromOpenOrLocked() public {
        IDePrizeRegistry.DePrizeState[7] memory s = _allStates();
        for (uint256 i = 0; i < s.length; i++) {
            uint256 id = _fresh(1000 + i, s[i]);
            bool ok = s[i] == IDePrizeRegistry.DePrizeState.OPEN || s[i] == IDePrizeRegistry.DePrizeState.LOCKED;
            vm.prank(owner);
            if (!ok) _expectInvalid(id, s[i]);
            registry.supersede(id, _teams(), block.timestamp + 60 days);
        }
    }

    function testMatrixAnnounceCancellationOnlyNonTerminal() public {
        IDePrizeRegistry.DePrizeState[7] memory s = _allStates();
        for (uint256 i = 0; i < s.length; i++) {
            uint256 id = _fresh(1000 + i, s[i]);
            bool terminal = registry.isTerminal(id);
            vm.prank(owner);
            if (terminal) _expectInvalid(id, s[i]);
            registry.announceCancellation(id);
            if (!terminal) assertTrue(registry.cancellationPending(id));
        }
    }

    function testMatrixTerminalAndRefundableFlags() public {
        IDePrizeRegistry.DePrizeState[7] memory s = _allStates();
        for (uint256 i = 0; i < s.length; i++) {
            uint256 id = _fresh(1000 + i, s[i]);
            bool terminal = s[i] == IDePrizeRegistry.DePrizeState.SETTLED
                || s[i] == IDePrizeRegistry.DePrizeState.NO_WINNER || s[i] == IDePrizeRegistry.DePrizeState.CANCELLED
                || s[i] == IDePrizeRegistry.DePrizeState.SUPERSEDED;
            bool refundable =
                s[i] == IDePrizeRegistry.DePrizeState.NO_WINNER || s[i] == IDePrizeRegistry.DePrizeState.CANCELLED;
            assertEq(registry.isTerminal(id), terminal, "isTerminal");
            assertEq(registry.isRefundable(id), refundable, "isRefundable");
            assertEq(registry.bettingOpen(id), s[i] == IDePrizeRegistry.DePrizeState.OPEN, "bettingOpen");
        }
    }

    function testEveryTransitionIsOwnerOnly() public {
        uint256 id = _registerAndOpen();
        bytes[] memory calls = new bytes[](11);
        calls[0] = abi.encodeCall(registry.setCondition, (id, CONDITION));
        calls[1] = abi.encodeCall(registry.setSunset, (id, block.timestamp + 90 days));
        calls[2] = abi.encodeCall(registry.setTeams, (id, _teams()));
        calls[3] = abi.encodeCall(registry.supersede, (id, _teams(), block.timestamp + 90 days));
        calls[4] = abi.encodeCall(registry.open, (id));
        calls[5] = abi.encodeCall(registry.lock, (id));
        calls[6] = abi.encodeCall(registry.settleWinner, (id, 1));
        calls[7] = abi.encodeCall(registry.settleNoWinner, (id));
        calls[8] = abi.encodeCall(registry.announceCancellation, (id));
        calls[9] = abi.encodeCall(registry.abortCancellation, (id));
        calls[10] = abi.encodeCall(registry.cancel, (id));
        for (uint256 i = 0; i < calls.length; i++) {
            vm.prank(stranger);
            (bool ok, bytes memory ret) = address(registry).call(calls[i]);
            assertFalse(ok, "stranger call must revert");
            assertEq(bytes4(ret), Ownable.OwnableUnauthorizedAccount.selector, "must be an auth revert");
        }
    }

    // ---------------------------------------------------------------------
    // cancellation
    // ---------------------------------------------------------------------

    function testCancellationFlow() public {
        uint256 id = _registerAndOpen();
        vm.startPrank(owner);
        vm.expectEmit(true, false, false, true);
        emit CancellationAnnounced(id, block.timestamp, block.timestamp + 7 days);
        registry.announceCancellation(id);
        assertFalse(registry.bettingOpen(id), "notice closes betting");
        assertTrue(registry.cancellationPending(id));
        assertEq(uint256(_st(id)), uint256(IDePrizeRegistry.DePrizeState.OPEN), "state unchanged until executed");

        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.CancellationAlreadyPending.selector, id));
        registry.announceCancellation(id);

        uint256 executableAt = block.timestamp + 7 days;
        vm.warp(executableAt - 1);
        vm.expectRevert(
            abi.encodeWithSelector(IDePrizeRegistry.CancellationNoticeNotElapsed.selector, id, executableAt)
        );
        registry.cancel(id);

        vm.warp(executableAt);
        vm.expectEmit(true, true, true, false);
        emit StateChanged(id, IDePrizeRegistry.DePrizeState.OPEN, IDePrizeRegistry.DePrizeState.CANCELLED);
        registry.cancel(id);
        vm.stopPrank();

        assertFalse(registry.cancellationPending(id));
        assertTrue(registry.isRefundable(id));
        assertTrue(registry.isTerminal(id));
    }

    function testAbortCancellationReopensBetting() public {
        uint256 id = _registerAndOpen();
        vm.startPrank(owner);
        registry.announceCancellation(id);
        vm.expectEmit(true, false, false, false);
        emit CancellationAborted(id);
        registry.abortCancellation(id);
        vm.stopPrank();
        assertTrue(registry.bettingOpen(id));
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.NoCancellationPending.selector, id));
        registry.abortCancellation(id);
    }

    function testCancelWithoutNoticeReverts() public {
        uint256 id = _registerAndOpen();
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.NoCancellationPending.selector, id));
        registry.cancel(id);
    }

    function testCancelFromDraftAndLocked() public {
        uint256 a = _fresh(501, IDePrizeRegistry.DePrizeState.DRAFT);
        uint256 b = _fresh(502, IDePrizeRegistry.DePrizeState.LOCKED);
        vm.startPrank(owner);
        registry.announceCancellation(a);
        registry.announceCancellation(b);
        vm.warp(block.timestamp + 7 days);
        registry.cancel(a);
        registry.cancel(b);
        vm.stopPrank();
        assertEq(uint256(_st(a)), uint256(IDePrizeRegistry.DePrizeState.CANCELLED));
        assertEq(uint256(_st(b)), uint256(IDePrizeRegistry.DePrizeState.CANCELLED));
    }

    function testFuzzCancelBoundary(uint32 delta) public {
        uint256 id = _registerAndOpen();
        vm.startPrank(owner);
        registry.announceCancellation(id);
        uint256 executableAt = block.timestamp + 7 days;
        uint256 target = block.timestamp + uint256(delta);
        vm.warp(target);
        if (target < executableAt) {
            vm.expectRevert(
                abi.encodeWithSelector(IDePrizeRegistry.CancellationNoticeNotElapsed.selector, id, executableAt)
            );
            registry.cancel(id);
        } else {
            registry.cancel(id);
            assertEq(uint256(_st(id)), uint256(IDePrizeRegistry.DePrizeState.CANCELLED));
        }
        vm.stopPrank();
    }

    // ---------------------------------------------------------------------
    // supersede
    // ---------------------------------------------------------------------

    function testSupersedeForksRosterKeepsProject() public {
        uint256 id = _registerAndOpen();
        uint256[] memory t2 = new uint256[](4);
        t2[0] = 1;
        t2[1] = 2;
        t2[2] = 3;
        t2[3] = 4;
        vm.expectEmit(true, true, false, true);
        emit DePrizeSuperseded(id, id + 1, t2);
        vm.prank(owner);
        uint256 newId = registry.supersede(id, t2, block.timestamp + 60 days);

        assertEq(newId, id + 1);
        assertEq(uint256(_st(id)), uint256(IDePrizeRegistry.DePrizeState.SUPERSEDED));
        assertEq(uint256(_st(newId)), uint256(IDePrizeRegistry.DePrizeState.DRAFT));
        assertTrue(registry.isTerminal(id));
        assertFalse(registry.isRefundable(id), "superseded is never refundable");
        assertFalse(registry.bettingOpen(id));

        assertEq(registry.supersededBy(id), newId);
        assertEq(registry.supersedes(newId), id);
        assertEq(registry.deprizeIdByJBProject(JB_PROJECT), newId, "JB rebinds to the new generation");
        assertEq(registry.getDePrize(newId).jbProjectId, JB_PROJECT);
        assertEq(registry.getDePrize(newId).ctfConditionId, bytes32(0), "new generation needs its own condition");
        assertTrue(registry.isTeam(newId, 4));
        assertTrue(registry.isTeam(id, 1), "old roster stays readable for payout mapping");
    }

    function testSupersedeClearsPendingCancellation() public {
        uint256 id = _registerAndOpen();
        vm.startPrank(owner);
        registry.announceCancellation(id);
        vm.expectEmit(true, false, false, false);
        emit CancellationAborted(id);
        registry.supersede(id, _teams(), block.timestamp + 60 days);
        vm.stopPrank();
        assertFalse(registry.cancellationPending(id));
    }

    function testSupersedeValidatesRosterAndSunset() public {
        uint256 id = _registerAndOpen();
        uint256[] memory one = new uint256[](1);
        one[0] = 1;
        vm.startPrank(owner);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.TooFewTeams.selector, 1));
        registry.supersede(id, one, block.timestamp + 60 days);
        vm.expectRevert(IDePrizeRegistry.InvalidSunset.selector);
        registry.supersede(id, _teams(), block.timestamp);
        vm.stopPrank();
    }

    function testSupersedeChainWalksForward() public {
        uint256 g1 = _registerAndOpen();
        vm.startPrank(owner);
        uint256 g2 = registry.supersede(g1, _teams(), block.timestamp + 60 days);
        registry.setCondition(g2, CONDITION);
        registry.open(g2);
        uint256 g3 = registry.supersede(g2, _teams(), block.timestamp + 90 days);
        vm.stopPrank();
        assertEq(registry.supersededBy(g1), g2);
        assertEq(registry.supersededBy(g2), g3);
        assertEq(registry.supersededBy(g3), 0);
        assertEq(registry.supersedes(g3), g2);
        assertEq(registry.deprizeIdByJBProject(JB_PROJECT), g3);
        assertEq(registry.count(), 3);
    }

    // ---------------------------------------------------------------------
    // views on unknown ids
    // ---------------------------------------------------------------------

    function testUnknownDePrize() public {
        assertEq(uint256(_st(99)), uint256(IDePrizeRegistry.DePrizeState.NONE));
        assertFalse(registry.bettingOpen(99));
        assertFalse(registry.isTerminal(99));
        assertFalse(registry.isRefundable(99));
        assertEq(registry.winningTeamId(99), 0);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.UnknownDePrize.selector, 99));
        registry.getDePrize(99);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.UnknownDePrize.selector, 99));
        registry.teamIds(99);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.UnknownDePrize.selector, 99));
        registry.open(99);
    }
}
