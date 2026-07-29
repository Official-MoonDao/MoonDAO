// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";
import {IConditionalTokens} from "../../src/deprize/interfaces/IConditionalTokens.sol";
import {DePrizeResolve} from "../../script/deprize/DePrizeResolve.s.sol";
import {MockResolvingCTF} from "./DePrizeRedeem.t.sol";
import {MockWETH} from "./DePrizeMint.t.sol";
import {LaunchPadPayHook} from "../../src/LaunchPadPayHook.sol";

import {JBConstants} from "@nana-core-v5/libraries/JBConstants.sol";
import {JBTokenAmount} from "@nana-core-v5/structs/JBTokenAmount.sol";
import {JBRuleset} from "@nana-core-v5/structs/JBRuleset.sol";
import {JBBeforeCashOutRecordedContext} from "@nana-core-v5/structs/JBBeforeCashOutRecordedContext.sol";

contract GenTerminalStore {
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

contract GenRulesets {
    uint112 public weight = uint112(1e18);

    function getRulesetOf(uint256, uint256) external view returns (JBRuleset memory r) {
        r.weight = weight;
    }
}

/// @dev Trivial UUPS upgrade target to exercise storage persistence across the
///      generations upgrade (__gap 45 → 42).
contract DePrizeRegistryGenerationsV2 is DePrizeRegistry {
    function version() external pure returns (uint256) {
        return 2;
    }
}

/// @notice Phase 2 generations / withdrawal / setTeams / setSunset / resolve lineage.
contract DePrizeGenerationsTest is Test {
    DePrizeRegistry registry;
    DePrizeResolve resolveScript;
    MockResolvingCTF ctf;
    MockWETH weth;

    address owner = address(0xA11CE);
    address oracle;

    uint256 constant JB_PROJECT = 256;
    uint256 constant OPEN_FIELD = 999;
    bytes32 constant CONDITION = keccak256("condition");
    bytes32 constant Q1 = keccak256("q1");
    bytes32 constant Q2 = keccak256("q2");

    function setUp() public {
        DePrizeRegistry impl = new DePrizeRegistry();
        bytes memory initData = abi.encodeCall(DePrizeRegistry.initialize, (owner));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        registry = DePrizeRegistry(address(proxy));

        weth = new MockWETH();
        ctf = new MockResolvingCTF(address(weth));
        resolveScript = new DePrizeResolve();
        oracle = address(this);
    }

    function _teams3() internal pure returns (uint256[] memory t) {
        t = new uint256[](3);
        t[0] = 301;
        t[1] = 302;
        t[2] = 303;
    }

    function _teamsWithField() internal pure returns (uint256[] memory t) {
        t = new uint256[](4);
        t[0] = 301;
        t[1] = 302;
        t[2] = 303;
        t[3] = OPEN_FIELD;
    }

    function _teamsGen2() internal pure returns (uint256[] memory t) {
        t = new uint256[](5);
        t[0] = 301;
        t[1] = 302;
        t[2] = 303;
        t[3] = 401; // Blue Origin
        t[4] = OPEN_FIELD;
    }

    function _registerOpen(uint256[] memory teams) internal returns (uint256 id) {
        vm.startPrank(owner);
        id = registry.register(JB_PROJECT, teams, block.timestamp + 30 days);
        registry.setCondition(id, CONDITION);
        registry.open(id);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------------
    // supersede
    // ---------------------------------------------------------------------

    function testSupersedeFromOpen() public {
        uint256 oldId = _registerOpen(_teamsWithField());
        uint256 newSunset = block.timestamp + 60 days;

        vm.prank(owner);
        uint256 newId = registry.supersede(oldId, _teamsGen2(), newSunset);

        assertEq(uint256(registry.state(oldId)), uint256(IDePrizeRegistry.DePrizeState.SUPERSEDED));
        assertEq(uint256(registry.state(newId)), uint256(IDePrizeRegistry.DePrizeState.DRAFT));
        assertEq(registry.deprizeIdByJBProject(JB_PROJECT), newId);
        assertEq(registry.supersededBy(oldId), newId);
        assertEq(registry.supersedes(newId), oldId);
        assertEq(registry.getDePrize(newId).jbProjectId, JB_PROJECT);
        assertEq(registry.getDePrize(newId).sunset, newSunset);
        assertEq(registry.teamIds(newId).length, 5);
        assertTrue(registry.isTerminal(oldId));
        assertFalse(registry.isRefundable(oldId));
        assertFalse(registry.bettingOpen(oldId));
    }

    function testSupersedeFromLocked() public {
        uint256 oldId = _registerOpen(_teamsWithField());
        vm.prank(owner);
        registry.lock(oldId);

        vm.prank(owner);
        uint256 newId = registry.supersede(oldId, _teamsGen2(), block.timestamp + 60 days);
        assertEq(uint256(registry.state(oldId)), uint256(IDePrizeRegistry.DePrizeState.SUPERSEDED));
        assertEq(registry.deprizeIdByJBProject(JB_PROJECT), newId);
    }

    function testSupersedeRevertsFromDraft() public {
        vm.prank(owner);
        uint256 id = registry.register(JB_PROJECT, _teams3(), block.timestamp + 30 days);
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IDePrizeRegistry.InvalidState.selector, id, IDePrizeRegistry.DePrizeState.DRAFT)
        );
        registry.supersede(id, _teamsGen2(), block.timestamp + 60 days);
    }

    function testSupersedeRevertsFromSettled() public {
        uint256 id = _registerOpen(_teams3());
        vm.startPrank(owner);
        registry.lock(id);
        registry.settleWinner(id, 301);
        vm.expectRevert(
            abi.encodeWithSelector(IDePrizeRegistry.InvalidState.selector, id, IDePrizeRegistry.DePrizeState.SETTLED)
        );
        registry.supersede(id, _teamsGen2(), block.timestamp + 60 days);
        vm.stopPrank();
    }

    function testSupersedeDoesNotOpenCashOut() public {
        GenTerminalStore store = new GenTerminalStore();
        GenRulesets rulesets = new GenRulesets();
        LaunchPadPayHook hook =
            new LaunchPadPayHook(10 ether, block.timestamp + 28 days, 14 days, address(store), address(rulesets), owner);

        uint256 oldId = _registerOpen(_teamsWithField());
        vm.prank(owner);
        hook.setDePrizeRegistry(address(registry));

        // Pre: cashOut blocked.
        vm.expectRevert("DePrize is active. Refunds are disabled.");
        hook.beforeCashOutRecordedWith(_cashOutCtx(JB_PROJECT));

        vm.prank(owner);
        uint256 newId = registry.supersede(oldId, _teamsGen2(), block.timestamp + 60 days);

        // Post: still blocked — SUPERSEDED is not refundable, and the JB mapping
        // now points at a DRAFT which is also not refundable.
        assertEq(registry.deprizeIdByJBProject(JB_PROJECT), newId);
        vm.expectRevert("DePrize is active. Refunds are disabled.");
        hook.beforeCashOutRecordedWith(_cashOutCtx(JB_PROJECT));
        assertEq(hook.stage(address(this), JB_PROJECT), 1);
    }

    // ---------------------------------------------------------------------
    // setTeams
    // ---------------------------------------------------------------------

    function testSetTeamsRewritesRosterAndClearsStale() public {
        vm.prank(owner);
        uint256 id = registry.register(JB_PROJECT, _teams3(), block.timestamp + 30 days);

        uint256[] memory neu = new uint256[](2);
        neu[0] = 401;
        neu[1] = 402;

        vm.prank(owner);
        registry.setTeams(id, neu);

        assertEq(registry.teamIds(id).length, 2);
        assertTrue(registry.isTeam(id, 401));
        assertTrue(registry.isTeam(id, 402));
        assertFalse(registry.isTeam(id, 301));
        assertFalse(registry.isTeam(id, 302));
        assertFalse(registry.isTeam(id, 303));
    }

    /// @dev A roster edit must not look like a registration to an indexer.
    function testSetTeamsEmitsTeamsUpdatedNotRegistered() public {
        vm.prank(owner);
        uint256 id = registry.register(JB_PROJECT, _teams3(), block.timestamp + 30 days);

        uint256[] memory neu = new uint256[](2);
        neu[0] = 401;
        neu[1] = 402;

        vm.recordLogs();
        vm.prank(owner);
        registry.setTeams(id, neu);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 registered = keccak256("DePrizeRegistered(uint256,uint256,uint256[],uint256)");
        bytes32 updated = keccak256("TeamsUpdated(uint256,uint256[])");
        bool sawUpdated;
        for (uint256 i = 0; i < logs.length; i++) {
            assertTrue(logs[i].topics[0] != registered, "setTeams must not emit DePrizeRegistered");
            if (logs[i].topics[0] == updated) sawUpdated = true;
        }
        assertTrue(sawUpdated, "setTeams must emit TeamsUpdated");
    }

    function testSetTeamsRevertsAfterOpen() public {
        uint256 id = _registerOpen(_teams3());
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IDePrizeRegistry.InvalidState.selector, id, IDePrizeRegistry.DePrizeState.OPEN)
        );
        registry.setTeams(id, _teamsWithField());
    }

    // ---------------------------------------------------------------------
    // markWithdrawn
    // ---------------------------------------------------------------------

    function testMarkWithdrawnDoesNotGateBetting() public {
        uint256 id = _registerOpen(_teams3());
        vm.prank(owner);
        registry.markWithdrawn(id, 302);

        assertTrue(registry.withdrawn(id, 302));
        assertTrue(registry.bettingOpen(id));
        assertTrue(registry.isTeam(id, 302));
    }

    function testMarkWithdrawnRevertsUnknownTeam() public {
        uint256 id = _registerOpen(_teams3());
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.TeamNotOnRoster.selector, id, 9999));
        registry.markWithdrawn(id, 9999);
    }

    // ---------------------------------------------------------------------
    // setSunset extend-only while OPEN
    // ---------------------------------------------------------------------

    function testSetSunsetExtendWhileOpen() public {
        uint256 id = _registerOpen(_teams3());
        uint256 current = registry.getDePrize(id).sunset;
        vm.prank(owner);
        registry.setSunset(id, current + 7 days);
        assertEq(registry.getDePrize(id).sunset, current + 7 days);
    }

    function testSetSunsetCannotShortenWhileOpen() public {
        uint256 id = _registerOpen(_teams3());
        uint256 current = registry.getDePrize(id).sunset;
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IDePrizeRegistry.SunsetNotExtended.selector, current, current - 1 days));
        registry.setSunset(id, current - 1 days);
    }

    function testSetSunsetRevertsWhenLocked() public {
        uint256 id = _registerOpen(_teams3());
        vm.prank(owner);
        registry.lock(id);
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IDePrizeRegistry.InvalidState.selector, id, IDePrizeRegistry.DePrizeState.LOCKED)
        );
        registry.setSunset(id, block.timestamp + 90 days);
    }

    // ---------------------------------------------------------------------
    // UUPS persistence
    // ---------------------------------------------------------------------

    function testUpgradePersistsLineageAndGap() public {
        uint256 oldId = _registerOpen(_teamsWithField());
        vm.prank(owner);
        uint256 newId = registry.supersede(oldId, _teamsGen2(), block.timestamp + 60 days);
        vm.prank(owner);
        registry.markWithdrawn(newId, 401);

        DePrizeRegistryGenerationsV2 v2 = new DePrizeRegistryGenerationsV2();
        vm.prank(owner);
        registry.upgradeToAndCall(address(v2), "");

        assertEq(DePrizeRegistryGenerationsV2(address(registry)).version(), 2);
        assertEq(registry.supersededBy(oldId), newId);
        assertEq(registry.supersedes(newId), oldId);
        assertEq(registry.deprizeIdByJBProject(JB_PROJECT), newId);
        assertTrue(registry.withdrawn(newId, 401));
        assertEq(uint256(registry.state(oldId)), uint256(IDePrizeRegistry.DePrizeState.SUPERSEDED));
    }

    // ---------------------------------------------------------------------
    // DePrizeResolve SUPERSEDED lineage
    // ---------------------------------------------------------------------

    function testBuildReportSupersededNamedWinner() public {
        // Gen1: 301/302/303/FIELD on C1. Supersede → Gen2. Settle Gen2 to 301.
        bytes32 c1 = ctf.getConditionId(oracle, Q1, 4);
        ctf.prepareCondition(oracle, Q1, 4);

        vm.startPrank(owner);
        uint256 g1 = registry.register(JB_PROJECT, _teamsWithField(), block.timestamp + 30 days);
        registry.setCondition(g1, c1);
        registry.open(g1);
        uint256 g2 = registry.supersede(g1, _teamsGen2(), block.timestamp + 60 days);
        bytes32 c2 = ctf.getConditionId(oracle, Q2, 5);
        ctf.prepareCondition(oracle, Q2, 5);
        registry.setCondition(g2, c2);
        registry.open(g2);
        registry.lock(g2);
        registry.settleWinner(g2, 301);
        vm.stopPrank();

        (, uint256[] memory payouts,) = resolveScript.buildReport(
            IDePrizeRegistry(address(registry)),
            IConditionalTokens(address(ctf)),
            g1,
            Q1,
            oracle,
            301,
            OPEN_FIELD
        );
        assertEq(payouts.length, 4);
        assertEq(payouts[0], 1); // Westinghouse
        assertEq(payouts[1], 0);
        assertEq(payouts[2], 0);
        assertEq(payouts[3], 0);
    }

    function testBuildReportSupersededFieldWinner() public {
        // Blue Origin (401) wins on Gen2 — maps to Gen1 Open Field.
        bytes32 c1 = ctf.getConditionId(oracle, Q1, 4);
        ctf.prepareCondition(oracle, Q1, 4);

        vm.startPrank(owner);
        uint256 g1 = registry.register(JB_PROJECT, _teamsWithField(), block.timestamp + 30 days);
        registry.setCondition(g1, c1);
        registry.open(g1);
        uint256 g2 = registry.supersede(g1, _teamsGen2(), block.timestamp + 60 days);
        bytes32 c2 = ctf.getConditionId(oracle, Q2, 5);
        ctf.prepareCondition(oracle, Q2, 5);
        registry.setCondition(g2, c2);
        registry.open(g2);
        registry.lock(g2);
        registry.settleWinner(g2, 401);
        vm.stopPrank();

        (, uint256[] memory payouts,) = resolveScript.buildReport(
            IDePrizeRegistry(address(registry)),
            IConditionalTokens(address(ctf)),
            g1,
            Q1,
            oracle,
            401,
            OPEN_FIELD
        );
        assertEq(payouts[0], 0);
        assertEq(payouts[1], 0);
        assertEq(payouts[2], 0);
        assertEq(payouts[3], 1); // Open Field
    }

    function testBuildReportSupersededFieldlessFallsBackToEqualPayout() public {
        // Gen1 has no field slot; Gen2 introduces 401 and wins with it → 1/N on Gen1.
        bytes32 c1 = ctf.getConditionId(oracle, Q1, 3);
        ctf.prepareCondition(oracle, Q1, 3);

        vm.startPrank(owner);
        uint256 g1 = registry.register(JB_PROJECT, _teams3(), block.timestamp + 30 days);
        registry.setCondition(g1, c1);
        registry.open(g1);
        uint256 g2 = registry.supersede(g1, _teamsGen2(), block.timestamp + 60 days);
        bytes32 c2 = ctf.getConditionId(oracle, Q2, 5);
        ctf.prepareCondition(oracle, Q2, 5);
        registry.setCondition(g2, c2);
        registry.open(g2);
        registry.lock(g2);
        registry.settleWinner(g2, 401);
        vm.stopPrank();

        // openFieldTeamId = 0 → equal payout
        (, uint256[] memory payouts,) = resolveScript.buildReport(
            IDePrizeRegistry(address(registry)), IConditionalTokens(address(ctf)), g1, Q1, oracle, 401, 0
        );
        assertEq(payouts.length, 3);
        assertEq(payouts[0], 1);
        assertEq(payouts[1], 1);
        assertEq(payouts[2], 1);
    }

    function _cashOutCtx(uint256 projectId) internal view returns (JBBeforeCashOutRecordedContext memory) {
        return JBBeforeCashOutRecordedContext({
            terminal: address(this),
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
