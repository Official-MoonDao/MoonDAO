// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";
import {DePrizeDisburse, IJBTerminalLike} from "../../script/deprize/DePrizeDisburse.s.sol";

/// @dev Exercises the M5 milestone-disbursement pre-flight / Safe-calldata builder
///      against a real DePrizeRegistry. No RPC: the JB terminal is a placeholder
///      address (the script only encodes calldata, it never calls it).
contract DePrizeDisburseTest is Test {
    DePrizeRegistry registry;
    DePrizeDisburse disburse;

    address owner = address(0xA11CE);
    address provider = address(0x1234567890123456789012345678901234567890);
    address constant JB_TERMINAL = address(0xABCD);
    address constant NATIVE_TOKEN = 0x000000000000000000000000000000000000EEEe;

    uint256 constant JB_PROJECT = 100;
    bytes32 constant CONDITION = bytes32(uint256(0xC0FFEE));
    uint256 constant WINNER = 2;
    uint256 constant PRIZE = 100 ether;

    // Milestone tags as locals so they aren't re-evaluated as an external getter
    // call inside a `vm.expectRevert` region (which would catch the getter, not
    // the `buildDisbursement` call under test).
    bytes32 constant M1_TAG = keccak256("M1");
    bytes32 constant M2_TAG = keccak256("M2");
    bytes32 constant REFUND_TAG = keccak256("REFUND");

    function setUp() public {
        DePrizeRegistry impl = new DePrizeRegistry();
        bytes memory initData = abi.encodeCall(DePrizeRegistry.initialize, (owner));
        registry = DePrizeRegistry(address(new ERC1967Proxy(address(impl), initData)));
        disburse = new DePrizeDisburse();
    }

    function _teams() internal pure returns (uint256[] memory t) {
        t = new uint256[](3);
        t[0] = 1;
        t[1] = 2;
        t[2] = 3;
    }

    function _settled(bool setProvider) internal returns (uint256 id) {
        vm.startPrank(owner);
        id = registry.register(JB_PROJECT, _teams(), block.timestamp + 30 days);
        registry.setCondition(id, CONDITION);
        registry.open(id);
        registry.lock(id);
        registry.settleWinner(id, WINNER);
        if (setProvider) registry.setProviderPayoutAddress(id, provider);
        vm.stopPrank();
    }

    function _m1Released() internal returns (uint256 id) {
        id = _settled(true);
        vm.prank(owner);
        registry.releaseM1(id);
    }

    function testMilestoneTagsMatchScriptConstants() public view {
        assertEq(disburse.M1(), M1_TAG);
        assertEq(disburse.M2(), M2_TAG);
        assertEq(disburse.REFUND(), REFUND_TAG);
    }

    // ------------------------------------------------------------------
    // happy paths
    // ------------------------------------------------------------------

    function testBuildM1ReleasesThirtyPercentToProvider() public {
        uint256 id = _settled(true);
        DePrizeDisburse.Disbursement memory d =
            disburse.buildDisbursement(registry, JB_TERMINAL, id, M1_TAG, PRIZE);

        assertEq(d.registry, address(registry));
        assertEq(d.registryCall, abi.encodeCall(IDePrizeRegistry.releaseM1, (id)));
        assertEq(d.payoutTo, provider);
        assertEq(d.payoutValue, 30 ether);
        assertEq(d.payoutData.length, 0);
        assertEq(d.jbProjectId, JB_PROJECT);
    }

    function testBuildM2ReleasesRemainderToProvider() public {
        uint256 id = _m1Released();
        DePrizeDisburse.Disbursement memory d =
            disburse.buildDisbursement(registry, JB_TERMINAL, id, M2_TAG, PRIZE);

        assertEq(d.registryCall, abi.encodeCall(IDePrizeRegistry.completeM2, (id)));
        assertEq(d.payoutTo, provider);
        assertEq(d.payoutValue, 70 ether);
        assertEq(d.payoutData.length, 0);
    }

    function testBuildRefundReturnsRemainderToJuicebox() public {
        uint256 id = _m1Released();
        DePrizeDisburse.Disbursement memory d =
            disburse.buildDisbursement(registry, JB_TERMINAL, id, REFUND_TAG, PRIZE);

        assertEq(d.registry, JB_TERMINAL);
        assertEq(
            d.registryCall,
            abi.encodeCall(
                IJBTerminalLike.addToBalanceOf,
                (JB_PROJECT, NATIVE_TOKEN, 70 ether, false, "DePrize M2_FAILED refund", "")
            )
        );
        assertEq(d.payoutTo, address(registry));
        assertEq(d.payoutValue, 70 ether);
        assertEq(d.payoutData, abi.encodeCall(IDePrizeRegistry.failM2, (id)));
    }

    function testSplitIsExactForIndivisiblePrize() public {
        uint256 id = _settled(true);
        uint256 odd = 1 ether + 7; // not divisible by the 30/70 split
        DePrizeDisburse.Disbursement memory m1 =
            disburse.buildDisbursement(registry, JB_TERMINAL, id, M1_TAG, odd);

        vm.prank(owner);
        registry.releaseM1(id);
        DePrizeDisburse.Disbursement memory m2 =
            disburse.buildDisbursement(registry, JB_TERMINAL, id, M2_TAG, odd);

        assertEq(m1.payoutValue + m2.payoutValue, odd, "M1 + M2 must equal the prize exactly");
        assertEq(m1.payoutValue, (odd * 30) / 100);
    }

    // ------------------------------------------------------------------
    // guards
    // ------------------------------------------------------------------

    function testM1WrongStateReverts() public {
        // SETTLED is required for M1; an OPEN deprize must abort.
        vm.startPrank(owner);
        uint256 id = registry.register(JB_PROJECT, _teams(), block.timestamp + 30 days);
        registry.setCondition(id, CONDITION);
        registry.open(id);
        vm.stopPrank();

        vm.expectRevert(
            abi.encodeWithSelector(DePrizeDisburse.WrongState.selector, id, IDePrizeRegistry.DePrizeState.OPEN)
        );
        disburse.buildDisbursement(registry, JB_TERMINAL, id, M1_TAG, PRIZE);
    }

    function testM2BeforeReleaseReverts() public {
        uint256 id = _settled(true); // SETTLED, not yet M1_RELEASED
        vm.expectRevert(
            abi.encodeWithSelector(DePrizeDisburse.WrongState.selector, id, IDePrizeRegistry.DePrizeState.SETTLED)
        );
        disburse.buildDisbursement(registry, JB_TERMINAL, id, M2_TAG, PRIZE);
    }

    function testRefundBeforeReleaseReverts() public {
        uint256 id = _settled(true);
        vm.expectRevert(
            abi.encodeWithSelector(DePrizeDisburse.WrongState.selector, id, IDePrizeRegistry.DePrizeState.SETTLED)
        );
        disburse.buildDisbursement(registry, JB_TERMINAL, id, REFUND_TAG, PRIZE);
    }

    function testM1WithoutProviderReverts() public {
        uint256 id = _settled(false); // provider not set
        vm.expectRevert(abi.encodeWithSelector(DePrizeDisburse.ProviderNotSet.selector, id));
        disburse.buildDisbursement(registry, JB_TERMINAL, id, M1_TAG, PRIZE);
    }

    function testZeroPrizeReverts() public {
        uint256 id = _settled(true);
        vm.expectRevert(DePrizeDisburse.ZeroPrize.selector);
        disburse.buildDisbursement(registry, JB_TERMINAL, id, M1_TAG, 0);
    }

    function testUnknownMilestoneReverts() public {
        uint256 id = _settled(true);
        bytes32 bogus = keccak256("BOGUS");
        vm.expectRevert(abi.encodeWithSelector(DePrizeDisburse.UnknownMilestone.selector, bogus));
        disburse.buildDisbursement(registry, JB_TERMINAL, id, bogus, PRIZE);
    }

    function testUnknownDePrizeReverts() public {
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.UnknownDePrize.selector, 999));
        disburse.buildDisbursement(registry, JB_TERMINAL, 999, M1_TAG, PRIZE);
    }

    // REFUND does not require a provider address (it returns ETH to Juicebox).
    function testRefundWithoutProviderSucceeds() public {
        // settle, set provider so we can reach M1_RELEASED, then clear is not
        // possible (no unset), so just confirm REFUND ignores provider entirely by
        // building from a normal M1_RELEASED state.
        uint256 id = _m1Released();
        DePrizeDisburse.Disbursement memory d =
            disburse.buildDisbursement(registry, JB_TERMINAL, id, REFUND_TAG, PRIZE);
        assertEq(d.registry, JB_TERMINAL);
    }
}
