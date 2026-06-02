// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {LaunchPadApprovalHook} from "../../src/LaunchPadApprovalHook.sol";
import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";

import {JBConstants} from "@nana-core-v5/libraries/JBConstants.sol";
import {JBRuleset} from "@nana-core-v5/structs/JBRuleset.sol";
import {JBApprovalStatus} from "@nana-core-v5/enums/JBApprovalStatus.sol";

/// @dev Minimal IJBTerminalStore stand-in (only the selectors the hook reads).
contract MockTerminalStore {
    uint256 public balance;
    uint256 public withdrawn;

    function setFunding(uint256 _balance, uint256 _withdrawn) external {
        balance = _balance;
        withdrawn = _withdrawn;
    }

    function balanceOf(address, uint256, address) external view returns (uint256) {
        return balance;
    }

    function usedPayoutLimitOf(address, uint256, address, uint256, uint256) external view returns (uint256) {
        return withdrawn;
    }
}

/// @dev Stand-in for LaunchPadPayHook: the approval hook only reads
///      `refundsEnabled()` and `deprizeRegistry()` from it.
contract MockPayHook {
    bool public refundsEnabled;
    address public deprizeRegistry;

    function setRefundsEnabled(bool v) external {
        refundsEnabled = v;
    }

    function setDeprizeRegistry(address r) external {
        deprizeRegistry = r;
    }
}

/// @notice Unit tests for the DePrize-aware ruleset-transition logic of
///         LaunchPadApprovalHook. Non-DePrize (original) behavior is exercised
///         on a fork by MissionTest; here we mock the pay hook + JB store so the
///         gating is deterministic and needs no RPC.
contract LaunchPadApprovalHookDePrizeTest is Test {
    LaunchPadApprovalHook hook;
    DePrizeRegistry registry;
    MockTerminalStore store;
    MockPayHook payHook;

    address owner = address(0xA11CE);

    uint256 constant PROJECT = 100;
    uint256 constant OTHER_PROJECT = 200;
    bytes32 constant CONDITION = bytes32(uint256(0xC0FFEE));

    uint256 constant FUNDING_GOAL = 10 ether;
    uint256 deadline;
    uint256 constant REFUND_PERIOD = 14 days;

    function setUp() public {
        deadline = block.timestamp + 28 days;

        store = new MockTerminalStore();
        payHook = new MockPayHook();

        DePrizeRegistry impl = new DePrizeRegistry();
        bytes memory initData = abi.encodeCall(DePrizeRegistry.initialize, (owner));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        registry = DePrizeRegistry(address(proxy));

        hook = new LaunchPadApprovalHook(
            FUNDING_GOAL, deadline, REFUND_PERIOD, address(store), address(this), address(payHook), owner
        );
    }

    // ---------------------------------------------------------------------
    // helpers
    // ---------------------------------------------------------------------
    function _teams() internal pure returns (uint256[] memory t) {
        t = new uint256[](2);
        t[0] = 1;
        t[1] = 2;
    }

    /// @dev Register a DePrize bound to `projectId` and advance it to `target`.
    function _registerTo(uint256 projectId, IDePrizeRegistry.DePrizeState target) internal returns (uint256 id) {
        vm.startPrank(owner);
        id = registry.register(projectId, _teams(), block.timestamp + 30 days);

        if (target == IDePrizeRegistry.DePrizeState.DRAFT) {
            vm.stopPrank();
            return id;
        }

        registry.setCondition(id, CONDITION);
        registry.open(id);
        if (target == IDePrizeRegistry.DePrizeState.OPEN) {
            vm.stopPrank();
            return id;
        }

        if (target == IDePrizeRegistry.DePrizeState.CANCELLED) {
            registry.announceCancellation(id);
            vm.warp(block.timestamp + registry.CANCELLATION_NOTICE());
            registry.cancel(id);
            vm.stopPrank();
            return id;
        }

        registry.lock(id);
        if (target == IDePrizeRegistry.DePrizeState.LOCKED) {
            vm.stopPrank();
            return id;
        }
        if (target == IDePrizeRegistry.DePrizeState.NO_WINNER) {
            registry.settleNoWinner(id);
            vm.stopPrank();
            return id;
        }

        registry.startVote(id);
        if (target == IDePrizeRegistry.DePrizeState.VOTING) {
            vm.stopPrank();
            return id;
        }

        registry.settleWinner(id, 1);
        if (target == IDePrizeRegistry.DePrizeState.SETTLED) {
            vm.stopPrank();
            return id;
        }

        registry.releaseM1(id);
        if (target == IDePrizeRegistry.DePrizeState.M1_RELEASED) {
            vm.stopPrank();
            return id;
        }
        if (target == IDePrizeRegistry.DePrizeState.M2_FAILED) {
            registry.failM2(id);
            vm.stopPrank();
            return id;
        }
        if (target == IDePrizeRegistry.DePrizeState.M2_COMPLETE) {
            registry.completeM2(id);
            vm.stopPrank();
            return id;
        }

        revert("unsupported target");
    }

    function _attach() internal {
        payHook.setDeprizeRegistry(address(registry));
    }

    function _status(uint256 projectId) internal view returns (JBApprovalStatus) {
        JBRuleset memory rs;
        return hook.approvalStatusOf(projectId, rs);
    }

    // ---------------------------------------------------------------------
    // classic (no DePrize) behavior is preserved
    // ---------------------------------------------------------------------
    function testNoRegistryUsesOriginalApproval() public {
        // under goal, before deadline → not yet approved (stay funding)
        store.setFunding(1 ether, 0);
        assertEq(uint256(_status(PROJECT)), uint256(JBApprovalStatus.Failed));

        // goal met past deadline → approved (payouts)
        store.setFunding(FUNDING_GOAL, 0);
        vm.warp(deadline + 1);
        assertEq(uint256(_status(PROJECT)), uint256(JBApprovalStatus.Approved));
    }

    function testRegistrySetButProjectUnregisteredUsesOriginal() public {
        _registerTo(OTHER_PROJECT, IDePrizeRegistry.DePrizeState.OPEN);
        _attach();

        store.setFunding(1 ether, 0);
        assertEq(uint256(_status(PROJECT)), uint256(JBApprovalStatus.Failed));
    }

    // ---------------------------------------------------------------------
    // DePrize active / refundable → stay locked (Failed)
    // ---------------------------------------------------------------------
    function testActiveStatesStayLocked() public {
        IDePrizeRegistry.DePrizeState[6] memory states = [
            IDePrizeRegistry.DePrizeState.DRAFT,
            IDePrizeRegistry.DePrizeState.OPEN,
            IDePrizeRegistry.DePrizeState.LOCKED,
            IDePrizeRegistry.DePrizeState.VOTING,
            IDePrizeRegistry.DePrizeState.SETTLED,
            IDePrizeRegistry.DePrizeState.M1_RELEASED
        ];
        _attach();
        for (uint256 i = 0; i < states.length; i++) {
            uint256 projectId = 1000 + i;
            _registerTo(projectId, states[i]);
            // even well past the immutable deadline, payouts stay locked
            vm.warp(deadline + REFUND_PERIOD + 100 days);
            assertEq(uint256(_status(projectId)), uint256(JBApprovalStatus.Failed), "active should stay locked");
        }
    }

    function testRefundableTerminalsStayLocked() public {
        IDePrizeRegistry.DePrizeState[3] memory states = [
            IDePrizeRegistry.DePrizeState.CANCELLED,
            IDePrizeRegistry.DePrizeState.NO_WINNER,
            IDePrizeRegistry.DePrizeState.M2_FAILED
        ];
        _attach();
        for (uint256 i = 0; i < states.length; i++) {
            uint256 projectId = 2000 + i;
            _registerTo(projectId, states[i]);
            // refundable → stay in funding/refund ruleset so cashOut works
            assertEq(uint256(_status(projectId)), uint256(JBApprovalStatus.Failed), "refundable should stay locked");
        }
    }

    // ---------------------------------------------------------------------
    // DePrize success terminal → unlock payouts (Approved)
    // ---------------------------------------------------------------------
    function testM2CompleteUnlocksPayouts() public {
        _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.M2_COMPLETE);
        _attach();
        assertEq(uint256(_status(PROJECT)), uint256(JBApprovalStatus.Approved));
    }
}
