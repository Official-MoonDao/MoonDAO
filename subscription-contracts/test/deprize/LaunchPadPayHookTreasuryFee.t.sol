// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {LaunchPadPayHook} from "../../src/LaunchPadPayHook.sol";
import {TreasuryPayHook} from "../../src/TreasuryPayHook.sol";
import {TreasuryFeeMath} from "../../src/TreasuryFeeMath.sol";
import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";

import {IJBPayHook} from "@nana-core-v5/interfaces/IJBPayHook.sol";
import {JBConstants} from "@nana-core-v5/libraries/JBConstants.sol";
import {JBTokenAmount} from "@nana-core-v5/structs/JBTokenAmount.sol";
import {JBRuleset} from "@nana-core-v5/structs/JBRuleset.sol";
import {JBBeforePayRecordedContext} from "@nana-core-v5/structs/JBBeforePayRecordedContext.sol";
import {JBAfterPayRecordedContext} from "@nana-core-v5/structs/JBAfterPayRecordedContext.sol";
import {JBPayHookSpecification} from "@nana-core-v5/structs/JBPayHookSpecification.sol";

/// @dev Same stand-ins as LaunchPadPayHookDePrize.t.sol, kept local so that
///      file's non-fee path stays a zero-hook hook.
contract FeeTerminalStore {
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

contract FeeRulesets {
    function getRulesetOf(uint256, uint256) external pure returns (JBRuleset memory r) {}
}

contract LaunchPadPayHookTreasuryFeeTest is Test {
    LaunchPadPayHook hook;
    TreasuryPayHook treasuryHook;
    DePrizeRegistry registry;
    FeeTerminalStore store;

    address owner = address(0xA11CE);
    address treasury = address(0x7EA5);
    address bettor = address(0xCAFE);

    uint256 constant PROJECT = 100;
    uint256 constant WEIGHT = 2_000_000_000_000_000_000_000;
    uint256 constant PAY = 1 ether;

    function setUp() public {
        store = new FeeTerminalStore();
        treasuryHook = new TreasuryPayHook(treasury);
        hook = new LaunchPadPayHook(
            10 ether,
            block.timestamp + 28 days,
            14 days,
            address(store),
            address(new FeeRulesets()),
            owner,
            address(treasuryHook)
        );
        registry = new DePrizeRegistry(owner);
    }

    function _payCtx(uint256 projectId, uint256 amount) internal view returns (JBBeforePayRecordedContext memory) {
        return JBBeforePayRecordedContext({
            terminal: address(this),
            payer: bettor,
            amount: JBTokenAmount({token: JBConstants.NATIVE_TOKEN, decimals: 18, currency: 0, value: amount}),
            projectId: projectId,
            rulesetId: 1,
            beneficiary: bettor,
            weight: WEIGHT,
            reservedPercent: 5_000,
            metadata: ""
        });
    }

    function testForwardsTwoAndAHalfPercentAndScalesWeight() public view {
        (uint256 weight, JBPayHookSpecification[] memory specs) = hook.beforePayRecordedWith(_payCtx(PROJECT, PAY));

        assertEq(weight, (WEIGHT * TreasuryFeeMath.KEPT_NUMERATOR) / TreasuryFeeMath.FEE_DENOMINATOR);
        assertEq(specs.length, 1);
        assertEq(address(specs[0].hook), address(treasuryHook));
        assertEq(specs[0].amount, TreasuryFeeMath.fee(PAY));
        assertEq(specs[0].amount, PAY * 250 / 10_000);
    }

    function testDePrizeBranchDoesNotCharge() public {
        uint256[] memory teams = new uint256[](2);
        teams[0] = 1;
        teams[1] = 2;
        vm.startPrank(owner);
        uint256 id = registry.register(PROJECT, teams, block.timestamp + 30 days);
        registry.setCondition(id, bytes32(uint256(0xC0FFEE)));
        registry.open(id);
        hook.setDePrizeRegistry(address(registry));
        vm.stopPrank();

        (uint256 weight, JBPayHookSpecification[] memory specs) = hook.beforePayRecordedWith(_payCtx(PROJECT, PAY));
        assertEq(weight, WEIGHT, "DePrize contributions keep the ruleset weight");
        assertEq(specs.length, 0, "no fee on a prize contribution");
        assertEq(uint256(registry.state(id)), uint256(IDePrizeRegistry.DePrizeState.OPEN));
    }

    function testTreasuryHookForwardsMsgValue() public {
        uint256 fee = TreasuryFeeMath.fee(PAY);
        JBAfterPayRecordedContext memory ctx = JBAfterPayRecordedContext({
            payer: bettor,
            projectId: PROJECT,
            rulesetId: 1,
            amount: JBTokenAmount({token: JBConstants.NATIVE_TOKEN, decimals: 18, currency: 0, value: PAY}),
            forwardedAmount: JBTokenAmount({token: JBConstants.NATIVE_TOKEN, decimals: 18, currency: 0, value: fee}),
            weight: WEIGHT,
            newlyIssuedTokenCount: 0,
            beneficiary: bettor,
            hookMetadata: "",
            payerMetadata: ""
        });

        uint256 before = treasury.balance;
        treasuryHook.afterPayRecordedWith{value: fee}(ctx);
        assertEq(treasury.balance - before, fee);
        assertEq(address(treasuryHook).balance, 0);
        assertTrue(treasuryHook.supportsInterface(type(IJBPayHook).interfaceId));
    }

    function testGrossToKeepMeetsNetGoal() public pure {
        uint256 goal = 10 ether;
        uint256 gross = TreasuryFeeMath.grossToKeep(goal);
        assertGe(TreasuryFeeMath.kept(gross), goal);
        assertLt(TreasuryFeeMath.kept(gross - 1), goal);
    }
}
