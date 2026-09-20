// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {IJBTerminal} from "@nana-core-v5/interfaces/IJBTerminal.sol";
import {JBConstants} from "@nana-core-v5/libraries/JBConstants.sol";

import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";
import {ILMSRMarketMaker} from "../../src/deprize/interfaces/ILMSRMarketMaker.sol";
import {IWETH} from "../../src/deprize/interfaces/IWETH.sol";
import {DePrizeSweepFees} from "../../script/deprize/DePrizeSweepFees.s.sol";
import {MockWETH, MockResolvingCTF, MockLMSR} from "./DePrizeMocks.sol";

/// @notice The fee-sweep planner replaces DePrizeFeeRouter's on-chain routing rule
///         (Terms 5.3): prize pool while live, treasury once terminal or a
///         cancellation notice is pending. The Safe executes what it prints.
contract DePrizeSweepFeesTest is Test {
    DePrizeRegistry registry;
    MockWETH weth;
    MockResolvingCTF ctf;
    MockLMSR market;
    DePrizeSweepFees planner;

    address safe = address(0x5AFE);
    uint256 deprizeId;
    bytes32 cond;
    uint256 constant JB = 268;

    function setUp() public {
        registry = new DePrizeRegistry(safe);
        weth = new MockWETH();
        ctf = new MockResolvingCTF(address(weth));
        ctf.prepareCondition(safe, keccak256("q"), 3);
        cond = ctf.getConditionId(safe, keccak256("q"), 3);
        vm.prank(safe);
        market = new MockLMSR(address(ctf), address(weth), 3, 0.5 ether, cond);
        planner = new DePrizeSweepFees();

        uint256[] memory teams = new uint256[](3);
        teams[0] = 1;
        teams[1] = 2;
        teams[2] = 3;
        vm.startPrank(safe);
        deprizeId = registry.register(JB, teams, block.timestamp + 30 days);
        registry.setCondition(deprizeId, cond);
        registry.open(deprizeId);
        vm.stopPrank();

        // Seed "accrued fees" as standalone WETH in the market.
        vm.deal(address(this), 10 ether);
        weth.deposit{value: 3 ether}();
        weth.transfer(address(market), 3 ether);
    }

    function _plan() internal view returns (DePrizeSweepFees.Plan memory) {
        return planner.plan(registry, ILMSRMarketMaker(address(market)), IWETH(address(weth)), deprizeId, safe);
    }

    function testLiveRoutesToPrizePool() public view {
        DePrizeSweepFees.Plan memory p = _plan();
        assertEq(p.amount, 3 ether);
        assertTrue(p.toPrizePool);
        assertEq(p.withdrawFeesCall, abi.encodeCall(ILMSRMarketMaker.withdrawFees, ()));
        assertEq(p.unwrapCall, abi.encodeCall(IWETH.withdraw, (3 ether)));
        assertEq(
            p.payCall,
            abi.encodeCall(IJBTerminal.pay, (JB, JBConstants.NATIVE_TOKEN, 3 ether, safe, 0, "DePrize trade fees", ""))
        );
    }

    function testCancellationNoticeRoutesToTreasury() public {
        vm.prank(safe);
        registry.announceCancellation(deprizeId);
        DePrizeSweepFees.Plan memory p = _plan();
        assertFalse(p.toPrizePool);
        assertEq(p.payCall.length, 0, "no Juicebox pay while a refund may be pending");
    }

    function testTerminalRoutesToTreasury() public {
        vm.startPrank(safe);
        registry.lock(deprizeId);
        registry.settleWinner(deprizeId, 2);
        vm.stopPrank();
        DePrizeSweepFees.Plan memory p = _plan();
        assertFalse(p.toPrizePool);
        assertEq(p.payCall.length, 0);
    }

    function testRejectsMarketNotOwnedBySafe() public {
        vm.prank(safe);
        market.transferOwnership(address(0xBAD));
        vm.expectRevert("market not owned by the Safe");
        _plan();
    }

    function testRejectsConditionMismatch() public {
        market.setCondition(keccak256("other"));
        vm.expectRevert("market/registry condition mismatch");
        _plan();
    }

    function testPlannedCallsExecuteEndToEnd() public {
        DePrizeSweepFees.Plan memory p = _plan();
        // The Safe executes tx 1 + tx 2 as printed.
        vm.startPrank(safe);
        (bool ok1,) = address(market).call(p.withdrawFeesCall);
        assertTrue(ok1);
        assertEq(weth.balanceOf(safe), 3 ether, "fees landed in the Safe as WETH");
        (bool ok2,) = address(weth).call(p.unwrapCall);
        assertTrue(ok2);
        vm.stopPrank();
        assertEq(safe.balance, 3 ether, "unwrapped to ETH ready for jbTerminal.pay");
        assertEq(weth.balanceOf(address(market)), 0);
    }
}
