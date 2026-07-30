// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";
import {DePrizeMint} from "../../src/deprize/DePrizeMint.sol";
import {DePrizeRedeem} from "../../src/deprize/DePrizeRedeem.sol";
import {LaunchPadPayHook} from "../../src/LaunchPadPayHook.sol";
import {MockWETH, MockJBTerminal, MockCTF, MockMarket} from "./DePrizeMint.t.sol";
import {MockResolvingCTF} from "./DePrizeRedeem.t.sol";

import {JBConstants} from "@nana-core-v5/libraries/JBConstants.sol";
import {JBTokenAmount} from "@nana-core-v5/structs/JBTokenAmount.sol";
import {JBRuleset} from "@nana-core-v5/structs/JBRuleset.sol";
import {JBBeforeCashOutRecordedContext} from "@nana-core-v5/structs/JBBeforeCashOutRecordedContext.sol";

/// @dev Minimal IJBTerminalStore stand-in (same surface as LaunchPadPayHookDePrize.t.sol).
contract SpikeTerminalStore {
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

contract SpikeRulesets {
    uint112 public weight = uint112(1e18);

    function getRulesetOf(uint256, uint256) external view returns (JBRuleset memory r) {
        r.weight = weight;
    }
}

/// @notice Pins today's roster / JB-binding immutability constraints in CI before
///         the generations upgrade lands. See docs/DEPRIZE_ROSTER_CHANGES.md Phase 0.
contract DePrizeRosterSpikeTest is Test {
    DePrizeRegistry registry;
    address owner = address(0xA11CE);

    uint256 constant JB_PROJECT = 256;
    bytes32 constant CONDITION = keccak256("condition");

    function setUp() public {
        DePrizeRegistry impl = new DePrizeRegistry();
        bytes memory initData = abi.encodeCall(DePrizeRegistry.initialize, (owner));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        registry = DePrizeRegistry(address(proxy));
    }

    function _teams3() internal pure returns (uint256[] memory t) {
        t = new uint256[](3);
        t[0] = 301;
        t[1] = 302;
        t[2] = 303;
    }

    function _registerDraft() internal returns (uint256 id) {
        vm.prank(owner);
        id = registry.register(JB_PROJECT, _teams3(), block.timestamp + 30 days);
    }

    function _registerOpen() internal returns (uint256 id) {
        id = _registerDraft();
        vm.startPrank(owner);
        registry.setCondition(id, CONDITION);
        registry.open(id);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------------
    // 1. JB binding is write-once
    // ---------------------------------------------------------------------

    function testCannotReRegisterSameJBProject() public {
        _registerDraft();
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.JBProjectAlreadyBound.selector, JB_PROJECT));
        registry.register(JB_PROJECT, _teams3(), block.timestamp + 60 days);
    }

    // ---------------------------------------------------------------------
    // 2. setCondition is DRAFT-only
    // ---------------------------------------------------------------------

    function testSetConditionRevertsAfterOpen() public {
        uint256 id = _registerOpen();
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IDePrizeRegistry.InvalidState.selector, id, IDePrizeRegistry.DePrizeState.OPEN)
        );
        registry.setCondition(id, keccak256("other"));
    }

    // ---------------------------------------------------------------------
    // 3. Mint refuses a market whose slot count differs from teamIds.length
    // ---------------------------------------------------------------------

    function testSetMarketRevertsWhenRosterLengthDiffers() public {
        uint256 id = _registerOpen();

        MockWETH weth = new MockWETH();
        MockCTF ctf = new MockCTF();
        MockJBTerminal terminal = new MockJBTerminal();

        DePrizeMint mintImpl = new DePrizeMint();
        bytes memory mintInit =
            abi.encodeCall(DePrizeMint.initialize, (owner, address(registry), address(terminal), address(weth), address(ctf)));
        DePrizeMint mint = DePrizeMint(payable(address(new ERC1967Proxy(address(mintImpl), mintInit))));

        // 4-slot market vs 3-team DePrize — the in-place roster edit failure mode.
        MockMarket badMarket = new MockMarket(address(ctf), address(weth), 4, 1e17);
        badMarket.setConditionId(CONDITION);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.MarketSlotMismatch.selector, 4, 3));
        mint.setMarket(id, address(badMarket));
    }

    // ---------------------------------------------------------------------
    // 4. Redeem refuses when teamIds.length != CTF outcome slot count
    // ---------------------------------------------------------------------

    function testRedeemRevertsSlotCountMismatch() public {
        MockWETH weth = new MockWETH();
        MockResolvingCTF ctf = new MockResolvingCTF(address(weth));
        address oracle = address(0x1234);
        bytes32 questionId = keccak256("q");

        // Prepare a 4-slot condition, bind a 3-team DePrize to it.
        ctf.prepareCondition(oracle, questionId, 4);
        bytes32 conditionId = ctf.getConditionId(oracle, questionId, 4);

        uint256 id = _registerDraft();
        vm.startPrank(owner);
        registry.setCondition(id, conditionId);
        registry.open(id);
        vm.stopPrank();

        DePrizeRedeem redeem = new DePrizeRedeem(address(registry), address(ctf), address(weth));

        vm.expectRevert(abi.encodeWithSelector(DePrizeRedeem.SlotCountMismatch.selector, id, 3, 4));
        redeem.previewRedeem(id, address(this));
    }

    // ---------------------------------------------------------------------
    // 5. Cancel opens cashOut on the bound Juicebox project
    // ---------------------------------------------------------------------

    function testCancelOpensCashOutOnBoundProject() public {
        SpikeTerminalStore store = new SpikeTerminalStore();
        SpikeRulesets rulesets = new SpikeRulesets();
        uint256 deadline = block.timestamp + 28 days;

        LaunchPadPayHook hook = new LaunchPadPayHook(
            10 ether, deadline, 14 days, address(store), address(rulesets), owner
        );

        uint256 id = _registerOpen();
        vm.prank(owner);
        hook.setDePrizeRegistry(address(registry));

        // Active: cashOut blocked.
        vm.expectRevert("DePrize is active. Refunds are disabled.");
        hook.beforeCashOutRecordedWith(_cashOutCtx(address(this), JB_PROJECT));

        // Cancel through the notice window.
        vm.startPrank(owner);
        registry.announceCancellation(id);
        vm.warp(block.timestamp + registry.CANCELLATION_NOTICE());
        registry.cancel(id);
        vm.stopPrank();

        store.setFunding(8 ether, 2 ether);
        (, uint256 cashOutCount,,) = hook.beforeCashOutRecordedWith(_cashOutCtx(address(this), JB_PROJECT));
        assertEq(cashOutCount, 5e18);
        assertEq(hook.stage(address(this), JB_PROJECT), 3);
    }

    function _cashOutCtx(address terminal, uint256 projectId)
        internal
        pure
        returns (JBBeforeCashOutRecordedContext memory)
    {
        return JBBeforeCashOutRecordedContext({
            terminal: terminal,
            holder: address(0xCAFE),
            projectId: projectId,
            rulesetId: 1,
            cashOutCount: 5e18,
            totalSupply: 0,
            surplus: JBTokenAmount({token: JBConstants.NATIVE_TOKEN, decimals: 18, currency: 0, value: 0}),
            useTotalSurplus: false,
            cashOutTaxRate: 0,
            metadata: ""
        });
    }
}
