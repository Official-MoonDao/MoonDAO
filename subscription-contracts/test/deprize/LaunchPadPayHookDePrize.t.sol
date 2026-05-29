// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {LaunchPadPayHook} from "../../src/LaunchPadPayHook.sol";
import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";

import {JBConstants} from "@nana-core-v5/libraries/JBConstants.sol";
import {JBTokenAmount} from "@nana-core-v5/structs/JBTokenAmount.sol";
import {JBRuleset} from "@nana-core-v5/structs/JBRuleset.sol";
import {JBBeforePayRecordedContext} from "@nana-core-v5/structs/JBBeforePayRecordedContext.sol";
import {JBBeforeCashOutRecordedContext} from "@nana-core-v5/structs/JBBeforeCashOutRecordedContext.sol";

/// @dev Minimal IJBTerminalStore stand-in: only the two selectors the hook calls.
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

/// @dev Minimal IJBRulesets stand-in: only getRulesetOf, returning a configurable weight.
contract MockRulesets {
    uint112 public weight;

    function setWeight(uint112 _weight) external {
        weight = _weight;
    }

    function getRulesetOf(uint256, uint256) external view returns (JBRuleset memory r) {
        r.weight = weight;
    }
}

/// @notice Unit tests for the DePrize-aware branches of LaunchPadPayHook.
///         Non-DePrize (original) behavior is exercised on a fork by MissionTest;
///         here we mock the JB store/rulesets so the registry-gating logic can be
///         tested deterministically and without an RPC.
contract LaunchPadPayHookDePrizeTest is Test {
    LaunchPadPayHook hook;
    DePrizeRegistry registry;
    MockTerminalStore store;
    MockRulesets rulesets;

    address owner = address(0xA11CE);
    address stranger = address(0xBEEF);
    address bettor = address(0xCAFE);

    uint256 constant PROJECT = 100; // bound to a DePrize
    uint256 constant OTHER_PROJECT = 200; // never bound
    bytes32 constant CONDITION = bytes32(uint256(0xC0FFEE));

    uint256 constant FUNDING_GOAL = 10 ether;
    uint256 deadline;
    uint256 constant REFUND_PERIOD = 14 days;

    address constant NATIVE = JBConstants.NATIVE_TOKEN;

    function setUp() public {
        deadline = block.timestamp + 28 days;

        store = new MockTerminalStore();
        rulesets = new MockRulesets();

        DePrizeRegistry impl = new DePrizeRegistry();
        bytes memory initData = abi.encodeCall(DePrizeRegistry.initialize, (owner));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        registry = DePrizeRegistry(address(proxy));

        hook = new LaunchPadPayHook(
            FUNDING_GOAL, deadline, REFUND_PERIOD, address(store), address(rulesets), owner
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
        vm.prank(owner);
        hook.setDePrizeRegistry(address(registry));
    }

    function _payCtx(uint256 projectId) internal view returns (JBBeforePayRecordedContext memory) {
        return JBBeforePayRecordedContext({
            terminal: address(this),
            payer: bettor,
            amount: JBTokenAmount({token: NATIVE, decimals: 18, currency: 0, value: 1 ether}),
            projectId: projectId,
            rulesetId: 1,
            beneficiary: bettor,
            weight: 1e18,
            reservedPercent: 0,
            metadata: ""
        });
    }

    function _cashOutCtx(uint256 projectId) internal view returns (JBBeforeCashOutRecordedContext memory) {
        return JBBeforeCashOutRecordedContext({
            terminal: address(this),
            holder: bettor,
            projectId: projectId,
            rulesetId: 1,
            cashOutCount: 5e18,
            totalSupply: 0,
            surplus: JBTokenAmount({token: NATIVE, decimals: 18, currency: 0, value: 0}),
            useTotalSurplus: false,
            cashOutTaxRate: 0,
            metadata: ""
        });
    }

    // ---------------------------------------------------------------------
    // setter / access control
    // ---------------------------------------------------------------------
    function testSetDePrizeRegistryOnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", stranger));
        hook.setDePrizeRegistry(address(registry));
    }

    function testSetDePrizeRegistry() public {
        _attach();
        assertEq(address(hook.deprizeRegistry()), address(registry));
    }

    function testSetDePrizeRegistryRejectsZero() public {
        vm.prank(owner);
        vm.expectRevert("registry is zero");
        hook.setDePrizeRegistry(address(0));
    }

    /// @dev One-way latch: once attached, the registry can neither be detached
    ///      (address(0)) nor repointed, so the mission owner cannot drop the
    ///      DePrize cashOut lock mid-campaign.
    function testSetDePrizeRegistryIsOneWay() public {
        _attach();

        // cannot detach
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("DePrizeRegistryAlreadySet()"));
        hook.setDePrizeRegistry(address(0));

        // cannot repoint to a different registry
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("DePrizeRegistryAlreadySet()"));
        hook.setDePrizeRegistry(address(0xDEAD));

        assertEq(address(hook.deprizeRegistry()), address(registry));
    }

    // ---------------------------------------------------------------------
    // backwards compatibility (no DePrize attached)
    // ---------------------------------------------------------------------
    function testNoRegistryUsesOriginalPay() public {
        // under goal, before deadline → original path allows the pay
        store.setFunding(1 ether, 0);
        (uint256 weight,) = hook.beforePayRecordedWith(_payCtx(PROJECT));
        assertEq(weight, 1e18);
    }

    function testNoRegistryOriginalCashOutGuard() public {
        // goal met, refunds disabled → original guard reverts
        store.setFunding(FUNDING_GOAL, 0);
        vm.expectRevert("Project has passed funding goal requirement. Refunds are disabled.");
        hook.beforeCashOutRecordedWith(_cashOutCtx(PROJECT));
    }

    function testRegistrySetButProjectUnregisteredUsesOriginal() public {
        // DePrize exists for OTHER_PROJECT only; PROJECT falls through to original logic.
        _registerTo(OTHER_PROJECT, IDePrizeRegistry.DePrizeState.OPEN);
        _attach();

        store.setFunding(1 ether, 0);
        (uint256 weight,) = hook.beforePayRecordedWith(_payCtx(PROJECT));
        assertEq(weight, 1e18);

        store.setFunding(FUNDING_GOAL, 0);
        vm.expectRevert("Project has passed funding goal requirement. Refunds are disabled.");
        hook.beforeCashOutRecordedWith(_cashOutCtx(PROJECT));
    }

    // ---------------------------------------------------------------------
    // active DePrize: contributions open, cashOut disabled
    // ---------------------------------------------------------------------
    function testActiveDePrizeAllowsContributionsBlocksCashOut() public {
        _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.OPEN);
        _attach();

        // contributions allowed even past the immutable deadline (registry governs)
        vm.warp(deadline + 1 days);
        (uint256 weight,) = hook.beforePayRecordedWith(_payCtx(PROJECT));
        assertEq(weight, 1e18);

        // cashOut disabled while active
        vm.expectRevert("DePrize is active. Refunds are disabled.");
        hook.beforeCashOutRecordedWith(_cashOutCtx(PROJECT));

        assertEq(hook.stage(address(this), PROJECT), 1);
    }

    function testActiveStatesBlockCashOut() public {
        // SETTLED / M1_RELEASED are non-terminal (campaign still resolving) → stage 1.
        IDePrizeRegistry.DePrizeState[4] memory states = [
            IDePrizeRegistry.DePrizeState.LOCKED,
            IDePrizeRegistry.DePrizeState.VOTING,
            IDePrizeRegistry.DePrizeState.SETTLED,
            IDePrizeRegistry.DePrizeState.M1_RELEASED
        ];
        // attach once: the registry pointer is write-once, and the same registry
        // serves every project id below
        _attach();
        for (uint256 i = 0; i < states.length; i++) {
            // fresh project id per iteration so each DePrize binds uniquely
            uint256 projectId = 1000 + i;
            _registerTo(projectId, states[i]);
            vm.expectRevert("DePrize is active. Refunds are disabled.");
            hook.beforeCashOutRecordedWith(_cashOutCtx(projectId));
            assertEq(hook.stage(address(this), projectId), 1, "active stage should be 1");
        }
    }

    /// @dev M2_COMPLETE (success terminal): cashOut stays disabled, but stage is
    ///      2 (payouts), matching the approval hook unlocking ruleset 2.
    function testM2CompleteBlocksCashOutPayoutsStage() public {
        _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.M2_COMPLETE);
        _attach();
        vm.expectRevert("DePrize is active. Refunds are disabled.");
        hook.beforeCashOutRecordedWith(_cashOutCtx(PROJECT));
        assertEq(hook.stage(address(this), PROJECT), 2, "completed stage should be 2");
    }

    function testDraftBlocksCashOutAllowsPay() public {
        _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.DRAFT);
        _attach();

        (uint256 weight,) = hook.beforePayRecordedWith(_payCtx(PROJECT));
        assertEq(weight, 1e18);

        vm.expectRevert("DePrize is active. Refunds are disabled.");
        hook.beforeCashOutRecordedWith(_cashOutCtx(PROJECT));
    }

    // ---------------------------------------------------------------------
    // refundable terminals: cashOut enabled, contributions closed
    // ---------------------------------------------------------------------
    function testCancelledEnablesRefundsClosesContributions() public {
        _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.CANCELLED);
        _attach();

        // new contributions rejected
        vm.expectRevert("DePrize is closed to new contributions.");
        hook.beforePayRecordedWith(_payCtx(PROJECT));

        // cashOut enabled — supply computed from funding * weight / 2e18
        store.setFunding(8 ether, 2 ether); // total 10 ETH
        rulesets.setWeight(uint112(1e18));
        (, uint256 cashOutCount, uint256 totalSupply,) = hook.beforeCashOutRecordedWith(_cashOutCtx(PROJECT));
        assertEq(cashOutCount, 5e18);
        assertEq(totalSupply, (10 ether * 1e18) / (2 * 1e18));

        assertEq(hook.stage(address(this), PROJECT), 3);
    }

    function testNoWinnerEnablesRefunds() public {
        _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.NO_WINNER);
        _attach();

        store.setFunding(5 ether, 0);
        rulesets.setWeight(uint112(2e18));
        (,, uint256 totalSupply,) = hook.beforeCashOutRecordedWith(_cashOutCtx(PROJECT));
        assertEq(totalSupply, (5 ether * 2e18) / (2 * 1e18));
        assertEq(hook.stage(address(this), PROJECT), 3);
    }

    function testM2FailedEnablesRefunds() public {
        _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.M2_FAILED);
        _attach();

        store.setFunding(3 ether, 0);
        rulesets.setWeight(uint112(1e18));
        (,, uint256 totalSupply,) = hook.beforeCashOutRecordedWith(_cashOutCtx(PROJECT));
        assertEq(totalSupply, (3 ether * 1e18) / (2 * 1e18));
        assertEq(hook.stage(address(this), PROJECT), 3);

        vm.expectRevert("DePrize is closed to new contributions.");
        hook.beforePayRecordedWith(_payCtx(PROJECT));
    }

    // ---------------------------------------------------------------------
    // fundingTurnedOff still wins, even under a DePrize
    // ---------------------------------------------------------------------
    function testFundingTurnedOffOverridesDePrize() public {
        _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.OPEN);
        _attach();
        vm.prank(owner);
        hook.setFundingTurnedOff(true);

        vm.expectRevert("Funding has been turned off.");
        hook.beforePayRecordedWith(_payCtx(PROJECT));
    }
}
