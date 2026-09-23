// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";
import {DePrizeMint} from "../../src/deprize/DePrizeMint.sol";
import {DePrizeRedeem} from "../../src/deprize/DePrizeRedeem.sol";
import {IConditionalTokens} from "../../src/deprize/interfaces/IConditionalTokens.sol";
import {DePrizeResolve} from "../../script/deprize/DePrizeResolve.s.sol";
import {MockResolvingCTF, MockWETH, MockJBTerminal, MockLMSR} from "./DePrizeMocks.sol";
import {MintPermitHelper} from "./MintPermitHelper.sol";

/// @notice End-to-end generational supersede: real registry, real mint router,
///         real redeem helper, faithful CTF. Money goes in as bets on generation 1,
///         the roster forks, and every holder either sells out or redeems against a
///         lineage-resolved payout vector. Nothing is stranded.
contract DePrizeGenerationsE2ETest is Test, MintPermitHelper {
    DePrizeRegistry registry;
    DePrizeMint mint;
    DePrizeRedeem redeemer;
    DePrizeResolve resolveScript;
    MockResolvingCTF ctf;
    MockWETH weth;
    MockJBTerminal terminal;

    address owner = address(0xA11CE);
    address oracle;
    address alice = address(0xA11A);
    address bob = address(0xB0B);
    address carol = address(0xCAC0);

    uint256 constant JB_PROJECT = 256;
    uint256 constant OPEN_FIELD = 999;
    uint256 constant PRICE = 1e17; // 0.1 WETH per outcome token
    uint256 constant QTY = 10e18; // 10 outcome tokens per bet

    bytes32 constant Q1 = keccak256("q1");
    bytes32 constant Q2 = keccak256("q2");
    bytes32 constant Q3 = keccak256("q3");

    function setUp() public {
        weth = new MockWETH();
        ctf = new MockResolvingCTF(address(weth));
        terminal = new MockJBTerminal();
        resolveScript = new DePrizeResolve();
        oracle = address(this);

        registry = new DePrizeRegistry(owner);
        mint = new DePrizeMint(owner, address(registry), address(terminal), address(weth), address(ctf));

        _initCompliance(mint, owner);
        redeemer = new DePrizeRedeem(address(registry), address(ctf), address(weth));

        // Collateral backing for redemptions (the real CTF holds it from splitPosition).
        // The remainder seeds each generation's market so it can buy positions back.
        vm.deal(address(this), 5000 ether);
        weth.deposit{value: 2000 ether}();
        weth.transfer(address(ctf), 1000 ether);

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(carol, 100 ether);
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    function _teamsGen1() internal pure returns (uint256[] memory t) {
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
        t[3] = 401; // new entrant
        t[4] = OPEN_FIELD;
    }

    function _teamsGen3() internal pure returns (uint256[] memory t) {
        t = new uint256[](6);
        t[0] = 301;
        t[1] = 302;
        t[2] = 303;
        t[3] = 401;
        t[4] = 501; // another new entrant
        t[5] = OPEN_FIELD;
    }

    function _pos(bytes32 cond, uint256 i) internal view returns (uint256) {
        return ctf.getPositionId(address(weth), ctf.getCollectionId(bytes32(0), cond, 1 << i));
    }

    /// @dev Provision a generation end to end: condition on the CTF, registry
    ///      binding, open for betting, and a live market wired into the router.
    function _provision(uint256 deprizeId, bytes32 questionId, uint256 slots)
        internal
        returns (bytes32 conditionId, MockLMSR market)
    {
        conditionId = ctf.getConditionId(oracle, questionId, slots);
        ctf.prepareCondition(oracle, questionId, slots);
        market = new MockLMSR(address(ctf), address(weth), slots, PRICE, conditionId);

        // Seed the market so it can buy positions back from sellers.
        weth.transfer(address(market), 50 ether);

        vm.startPrank(owner);
        registry.setCondition(deprizeId, conditionId);
        if (registry.state(deprizeId) == IDePrizeRegistry.DePrizeState.DRAFT) registry.open(deprizeId);
        mint.setMarket(deprizeId, address(market));
        vm.stopPrank();
    }

    function _bet(address who, uint256 deprizeId, uint256 outcomeIndex) internal {
        (uint256 deadline1, bytes memory signature1) = _permit(mint, who, deprizeId);
        vm.prank(who);
        mint.bet{value: 3 ether}(deprizeId, outcomeIndex, QTY, 3 ether, deadline1, signature1);
    }

    /// @dev Push the resolve script's payout vector on-chain as the oracle.
    function _report(uint256 deprizeId, bytes32 questionId, uint256 winningTeamId, uint256 fieldTeamId) internal {
        (, uint256[] memory payouts,) = resolveScript.buildReport(
            IDePrizeRegistry(address(registry)),
            IConditionalTokens(address(ctf)),
            deprizeId,
            questionId,
            oracle,
            winningTeamId,
            fieldTeamId
        );
        ctf.reportPayouts(questionId, payouts);
    }

    // ---------------------------------------------------------------------
    // The full journey
    // ---------------------------------------------------------------------

    function testE2ESupersedeMoneyFlowEndToEnd() public {
        // --- Generation 1 opens and takes real bets ------------------------
        vm.prank(owner);
        uint256 g1 = registry.register(JB_PROJECT, _teamsGen1(), block.timestamp + 30 days);
        (bytes32 c1, MockLMSR m1) = _provision(g1, Q1, 4);

        _bet(alice, g1, 0); // Alice backs team 301
        _bet(bob, g1, 3); // Bob backs the Open Field

        assertEq(ctf.balanceOf(alice, _pos(c1, 0)), QTY, "alice holds 301 tokens");
        assertEq(ctf.balanceOf(bob, _pos(c1, 3)), QTY, "bob holds field tokens");
        uint256 poolAfterGen1Bets = terminal.totalReceived();
        assertGt(poolAfterGen1Bets, 0, "prize pool took the 5% slices");

        // --- The roster forks ----------------------------------------------
        vm.prank(owner);
        uint256 g2 = registry.supersede(g1, _teamsGen2(), block.timestamp + 60 days);

        assertEq(uint256(registry.state(g1)), uint256(IDePrizeRegistry.DePrizeState.SUPERSEDED));
        assertFalse(registry.isRefundable(g1), "supersede must not open refunds");

        // New bets on the old generation are refused...
        (uint256 deadline2, bytes memory signature2) = _permit(mint, carol, g1);
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.BettingClosed.selector, g1));
        mint.bet{value: 3 ether}(g1, 0, QTY, 3 ether, deadline2, signature2);

        // ...but the old market is still Running, so holders can exit at will.
        assertEq(m1.stage(), 0, "old market stays running as a sell-only venue");
        uint256 aliceEthBefore = weth.balanceOf(alice);
        int256[] memory sell = new int256[](4);
        sell[0] = -int256(QTY / 2); // Alice sells half her position
        vm.startPrank(alice);
        ctf.setApprovalForAll(address(m1), true);
        m1.trade(sell, 0);
        vm.stopPrank();

        assertEq(ctf.balanceOf(alice, _pos(c1, 0)), QTY / 2, "half the position was sold");
        assertGt(weth.balanceOf(alice) - aliceEthBefore, 0, "alice was paid for the exit");

        // --- Generation 2 carries the same prize pool ------------------------
        assertEq(registry.deprizeIdByJBProject(JB_PROJECT), g2, "pool follows the live generation");
        assertEq(registry.getDePrize(g2).jbProjectId, JB_PROJECT);

        (bytes32 c2,) = _provision(g2, Q2, 5);
        _bet(carol, g2, 3); // Carol backs the new entrant 401
        assertEq(ctf.balanceOf(carol, _pos(c2, 3)), QTY);
        assertGt(terminal.totalReceived(), poolAfterGen1Bets, "pool keeps accumulating across generations");

        // --- 401 wins on generation 2 ----------------------------------------
        vm.startPrank(owner);
        registry.lock(g2);
        registry.settleWinner(g2, 401);
        vm.stopPrank();

        _report(g2, Q2, 401, OPEN_FIELD);
        _report(g1, Q1, 401, OPEN_FIELD); // lineage: 401 was unlisted on gen 1 -> Open Field

        assertEq(ctf.payoutNumerators(c1, 3), 1, "gen1 field slot pays");
        assertEq(ctf.payoutNumerators(c1, 0), 0, "gen1 named loser pays nothing");
        assertEq(ctf.payoutNumerators(c2, 3), 1, "gen2 winner pays");

        // --- Everyone settles up ---------------------------------------------
        uint256 carolBefore = carol.balance;
        vm.startPrank(carol);
        ctf.setApprovalForAll(address(redeemer), true);
        redeemer.redeem(g2);
        vm.stopPrank();
        assertEq(carol.balance - carolBefore, QTY, "gen2 winner redeemed in full");

        uint256 bobBefore = bob.balance;
        vm.startPrank(bob);
        ctf.setApprovalForAll(address(redeemer), true);
        redeemer.redeem(g1);
        vm.stopPrank();
        assertEq(bob.balance - bobBefore, QTY, "gen1 field backer redeemed in full");

        // Alice's remaining gen1 position on a losing team pays zero — but the call
        // still succeeds, so she is never stuck holding an unredeemable token.
        uint256 aliceBefore = alice.balance;
        vm.startPrank(alice);
        ctf.setApprovalForAll(address(redeemer), true);
        redeemer.redeem(g1);
        vm.stopPrank();
        assertEq(alice.balance - aliceBefore, 0, "losing position redeems to zero, not a revert");
        assertEq(ctf.balanceOf(alice, _pos(c1, 0)), 0, "position burned");
    }

    /// @dev Two hops of lineage: a generation superseded twice still resolves.
    function testE2EThreeGenerationLineage() public {
        vm.prank(owner);
        uint256 g1 = registry.register(JB_PROJECT, _teamsGen1(), block.timestamp + 30 days);
        (bytes32 c1,) = _provision(g1, Q1, 4);
        _bet(bob, g1, 3); // Bob backs the Open Field on the earliest generation

        vm.prank(owner);
        uint256 g2 = registry.supersede(g1, _teamsGen2(), block.timestamp + 60 days);
        _provision(g2, Q2, 5);

        vm.prank(owner);
        uint256 g3 = registry.supersede(g2, _teamsGen3(), block.timestamp + 90 days);
        (bytes32 c3,) = _provision(g3, Q3, 6);
        _bet(carol, g3, 4); // Carol backs 501, which only exists on gen 3

        vm.startPrank(owner);
        registry.lock(g3);
        registry.settleWinner(g3, 501);
        vm.stopPrank();

        assertEq(registry.supersededBy(g1), g2);
        assertEq(registry.supersededBy(g2), g3);

        _report(g3, Q3, 501, OPEN_FIELD);
        _report(g1, Q1, 501, OPEN_FIELD); // walks g1 -> g2 -> g3

        assertEq(ctf.payoutNumerators(c1, 3), 1, "gen1 field slot absorbs a gen3 winner");
        assertEq(ctf.payoutNumerators(c3, 4), 1);

        uint256 bobBefore = bob.balance;
        vm.startPrank(bob);
        ctf.setApprovalForAll(address(redeemer), true);
        redeemer.redeem(g1);
        vm.stopPrank();
        assertEq(bob.balance - bobBefore, QTY, "oldest generation still pays out");
    }

    /// @dev A named competitor that survives the fork pays its own slot on every
    ///      generation, not the field.
    function testE2ESupersedeNamedSurvivorWins() public {
        vm.prank(owner);
        uint256 g1 = registry.register(JB_PROJECT, _teamsGen1(), block.timestamp + 30 days);
        (bytes32 c1,) = _provision(g1, Q1, 4);
        _bet(alice, g1, 0); // 301, still on the gen2 roster

        vm.prank(owner);
        uint256 g2 = registry.supersede(g1, _teamsGen2(), block.timestamp + 60 days);
        _provision(g2, Q2, 5);

        vm.startPrank(owner);
        registry.lock(g2);
        registry.settleWinner(g2, 301);
        vm.stopPrank();

        _report(g1, Q1, 301, OPEN_FIELD);
        assertEq(ctf.payoutNumerators(c1, 0), 1, "named survivor pays its own slot");
        assertEq(ctf.payoutNumerators(c1, 3), 0, "field pays nothing when the winner was listed");

        uint256 aliceBefore = alice.balance;
        vm.startPrank(alice);
        ctf.setApprovalForAll(address(redeemer), true);
        redeemer.redeem(g1);
        vm.stopPrank();
        assertEq(alice.balance - aliceBefore, QTY);
    }

    /// @dev previewRedeem must agree with what redeem actually pays on a
    ///      lineage-resolved generation (the UI quotes this number).
    function testE2EPreviewMatchesPayoutOnSupersededGeneration() public {
        vm.prank(owner);
        uint256 g1 = registry.register(JB_PROJECT, _teamsGen1(), block.timestamp + 30 days);
        _provision(g1, Q1, 4);
        _bet(bob, g1, 3);

        vm.prank(owner);
        uint256 g2 = registry.supersede(g1, _teamsGen2(), block.timestamp + 60 days);
        _provision(g2, Q2, 5);
        vm.startPrank(owner);
        registry.lock(g2);
        registry.settleWinner(g2, 401);
        vm.stopPrank();

        assertEq(redeemer.previewRedeem(g1, bob), 0, "no quote before the oracle reports");
        _report(g1, Q1, 401, OPEN_FIELD);

        uint256 quoted = redeemer.previewRedeem(g1, bob);
        uint256 before = bob.balance;
        vm.startPrank(bob);
        ctf.setApprovalForAll(address(redeemer), true);
        redeemer.redeem(g1);
        vm.stopPrank();
        assertEq(quoted, bob.balance - before, "preview matches the actual payout");
    }
}
