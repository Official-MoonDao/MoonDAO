// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import {DePrizeRedeem} from "../../src/deprize/DePrizeRedeem.sol";
import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";
import {IConditionalTokens} from "../../src/deprize/interfaces/IConditionalTokens.sol";
import {ILMSRMarketMaker} from "../../src/deprize/interfaces/ILMSRMarketMaker.sol";
import {DePrizeResolve} from "../../script/deprize/DePrizeResolve.s.sol";
import {MockWETH, MockJBTerminal, MockResolvingCTF, StubMarket} from "./DePrizeMocks.sol";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/// @dev Holds outcome tokens but has no payable receive: the ETH payout fails.
contract RevertingRedeemer {
    function approveAndRedeem(MockResolvingCTF ctf, DePrizeRedeem redeem, uint256 deprizeId) external {
        ctf.setApprovalForAll(address(redeem), true);
        redeem.redeem(deprizeId);
    }
}

/// @dev Attempts to re-enter `redeem` from the ETH payout callback.
contract ReentrantRedeemer {
    DePrizeRedeem internal redeemContract;
    uint256 internal deprizeId;

    function approveAndRedeem(MockResolvingCTF ctf, DePrizeRedeem redeem_, uint256 deprizeId_) external {
        redeemContract = redeem_;
        deprizeId = deprizeId_;
        ctf.setApprovalForAll(address(redeem_), true);
        redeem_.redeem(deprizeId_);
    }

    receive() external payable {
        // Re-entering reverts (ReentrancyGuard), which reverts this receive, which
        // makes the outer payout call fail with RedeemFailed.
        redeemContract.redeem(deprizeId);
    }
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

contract DePrizeRedeemTest is Test {
    DePrizeRedeem redeem;
    DePrizeRegistry registry;
    MockWETH weth;
    MockResolvingCTF ctf;
    DePrizeResolve resolveScript;

    address owner = address(0xA11CE);
    address oracle = address(0x5AFE);
    address alice = address(0xA11A);
    address bob = address(0xB0B);

    bytes32 constant QUESTION_ID = keccak256("deprize-question");
    uint256 constant JB_PROJECT = 4;
    uint256[] teamIds;
    uint256 deprizeId;
    bytes32 conditionId;

    event Redeemed(uint256 indexed deprizeId, address indexed account, uint256 payout);

    function setUp() public {
        weth = new MockWETH();
        ctf = new MockResolvingCTF(address(weth));

        registry = new DePrizeRegistry(owner);

        redeem = new DePrizeRedeem(address(registry), address(ctf), address(weth));
        // The helper is deployed at a deterministic CREATE2 address. On a forked
        // chain that address can already hold native ETH (e.g. 0.17 ETH on Sepolia),
        // which the fresh deployment inherits and would corrupt the "no residual
        // ETH" invariants below. Zero it so those assertions test only what the
        // redemption flow leaves behind.
        vm.deal(address(redeem), 0);
        resolveScript = new DePrizeResolve();

        teamIds = new uint256[](3);
        teamIds[0] = 101;
        teamIds[1] = 102;
        teamIds[2] = 103;

        ctf.prepareCondition(oracle, QUESTION_ID, 3);
        conditionId = ctf.getConditionId(oracle, QUESTION_ID, 3);

        vm.startPrank(owner);
        deprizeId = registry.register(JB_PROJECT, teamIds, block.timestamp + 30 days);
        registry.setCondition(deprizeId, conditionId);
        registry.open(deprizeId);
        vm.stopPrank();

        // Collateral the CTF will pay redemptions from (in reality deposited by
        // the LMSR's splitPosition calls as bets came in).
        vm.deal(address(this), 1000 ether);
        weth.deposit{value: 1000 ether}();
        weth.transfer(address(ctf), 1000 ether);
    }

    function _positionId(uint256 outcomeIndex) internal view returns (uint256) {
        return ctf.getPositionId(address(weth), ctf.getCollectionId(bytes32(0), conditionId, 1 << outcomeIndex));
    }

    function _settleWinner(uint256 winnerTeamId) internal {
        vm.startPrank(owner);
        registry.lock(deprizeId);
        registry.settleWinner(deprizeId, winnerTeamId);
        vm.stopPrank();
    }

    function _reportWinner(uint256 winnerIndex) internal {
        uint256[] memory payouts = new uint256[](3);
        payouts[winnerIndex] = 1;
        vm.prank(oracle);
        ctf.reportPayouts(QUESTION_ID, payouts);
    }

    function _reportEqual() internal {
        uint256[] memory payouts = new uint256[](3);
        payouts[0] = 1;
        payouts[1] = 1;
        payouts[2] = 1;
        vm.prank(oracle);
        ctf.reportPayouts(QUESTION_ID, payouts);
    }

    // -- winner path ----------------------------------------------------------

    function testRedeemWinnerPaysFullValueInEth() public {
        ctf.mint(alice, _positionId(1), 2 ether); // winner slot
        ctf.mint(alice, _positionId(0), 1 ether); // loser slot
        _settleWinner(102);
        _reportWinner(1);

        vm.prank(alice);
        ctf.setApprovalForAll(address(redeem), true);

        uint256 balBefore = alice.balance;
        vm.expectEmit(true, true, false, true);
        emit Redeemed(deprizeId, alice, 2 ether);
        vm.prank(alice);
        redeem.redeem(deprizeId);

        assertEq(alice.balance - balBefore, 2 ether, "winner paid full value in ETH");
        assertEq(ctf.balanceOf(alice, _positionId(0)), 0, "loser tokens burned");
        assertEq(ctf.balanceOf(alice, _positionId(1)), 0, "winner tokens burned");
        assertEq(ctf.balanceOf(address(redeem), _positionId(0)), 0, "helper holds no tokens");
        assertEq(ctf.balanceOf(address(redeem), _positionId(1)), 0, "helper holds no tokens");
        assertEq(weth.balanceOf(address(redeem)), 0, "helper holds no WETH");
        assertEq(address(redeem).balance, 0, "helper holds no ETH");
    }

    function testRedeemLoserOnlyBurnsAndPaysZero() public {
        ctf.mint(bob, _positionId(0), 3 ether); // loser slot only
        _settleWinner(102);
        _reportWinner(1);

        vm.prank(bob);
        ctf.setApprovalForAll(address(redeem), true);

        uint256 balBefore = bob.balance;
        vm.expectEmit(true, true, false, true);
        emit Redeemed(deprizeId, bob, 0);
        vm.prank(bob);
        redeem.redeem(deprizeId);

        assertEq(bob.balance, balBefore, "loser receives nothing");
        assertEq(ctf.balanceOf(bob, _positionId(0)), 0, "loser tokens burned");
    }

    // -- refund (equal-payout) path -------------------------------------------

    function testRedeemEqualPayoutRefund() public {
        // 1 ETH of tokens on a 3-outcome equal payout -> floor(1e18 / 3).
        ctf.mint(alice, _positionId(0), 1 ether);
        vm.startPrank(owner);
        registry.lock(deprizeId);
        registry.settleNoWinner(deprizeId);
        vm.stopPrank();
        _reportEqual();

        vm.prank(alice);
        ctf.setApprovalForAll(address(redeem), true);

        uint256 expected = uint256(1 ether) / 3;
        assertEq(redeem.previewRedeem(deprizeId, alice), expected, "preview matches");

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        redeem.redeem(deprizeId);
        assertEq(alice.balance - balBefore, expected, "1/N refund, floored like the CTF");
    }

    function testEqualPayoutParimutuelSkew() public {
        // Equal payout pays per TOKEN, not per ETH spent: a bettor holding fewer
        // (i.e. more expensive) tokens recovers less. Alice "paid more" per token.
        ctf.mint(alice, _positionId(0), 1 ether); // concentrated/expensive position
        ctf.mint(bob, _positionId(2), 5 ether); // cheap longshot position
        vm.startPrank(owner);
        registry.lock(deprizeId);
        registry.settleNoWinner(deprizeId);
        vm.stopPrank();
        _reportEqual();

        vm.prank(alice);
        ctf.setApprovalForAll(address(redeem), true);
        vm.prank(bob);
        ctf.setApprovalForAll(address(redeem), true);

        uint256 aliceBefore = alice.balance;
        uint256 bobBefore = bob.balance;
        vm.prank(alice);
        redeem.redeem(deprizeId);
        vm.prank(bob);
        redeem.redeem(deprizeId);

        assertEq(alice.balance - aliceBefore, uint256(1 ether) / 3);
        assertEq(bob.balance - bobBefore, uint256(5 ether) / 3);
    }

    // -- preview ----------------------------------------------------------------

    function testPreviewMatchesActualWithRounding() public {
        // Amounts not divisible by 3 across two slots: per-position floors must sum
        // identically in preview and redeem.
        ctf.mint(alice, _positionId(0), 1 ether + 1);
        ctf.mint(alice, _positionId(1), 2 ether + 2);
        vm.startPrank(owner);
        registry.lock(deprizeId);
        registry.settleNoWinner(deprizeId);
        vm.stopPrank();
        _reportEqual();

        uint256 expected = (uint256(1 ether) + 1) / 3 + (uint256(2 ether) + 2) / 3;
        assertEq(redeem.previewRedeem(deprizeId, alice), expected, "per-position floor");

        vm.startPrank(alice);
        ctf.setApprovalForAll(address(redeem), true);
        uint256 balBefore = alice.balance;
        redeem.redeem(deprizeId);
        vm.stopPrank();
        assertEq(alice.balance - balBefore, expected, "actual == preview");
    }

    function testPreviewZeroBeforeResolution() public {
        ctf.mint(alice, _positionId(1), 2 ether);
        assertEq(redeem.previewRedeem(deprizeId, alice), 0, "unresolved -> 0");
    }

    function testPreviewRevertsUnknownDePrize() public {
        vm.expectRevert(abi.encodeWithSelector(DePrizeRedeem.UnknownDePrize.selector, 999));
        redeem.previewRedeem(999, alice);
    }

    // -- guards ------------------------------------------------------------------

    function testRedeemRevertsNotResolved() public {
        ctf.mint(alice, _positionId(1), 1 ether);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(DePrizeRedeem.NotResolved.selector, deprizeId));
        redeem.redeem(deprizeId);
    }

    function testRedeemRevertsUnknownDePrize() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(DePrizeRedeem.UnknownDePrize.selector, 999));
        redeem.redeem(999);
    }

    function testRedeemRevertsNothingToRedeem() public {
        _settleWinner(102);
        _reportWinner(1);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(DePrizeRedeem.NothingToRedeem.selector, deprizeId, alice));
        redeem.redeem(deprizeId);
    }

    function testRedeemRevertsWithoutApproval() public {
        ctf.mint(alice, _positionId(1), 1 ether);
        _settleWinner(102);
        _reportWinner(1);
        vm.prank(alice);
        vm.expectRevert("ERC1155: caller not approved");
        redeem.redeem(deprizeId);
    }

    function testDoubleRedeemReverts() public {
        ctf.mint(alice, _positionId(1), 1 ether);
        _settleWinner(102);
        _reportWinner(1);
        vm.startPrank(alice);
        ctf.setApprovalForAll(address(redeem), true);
        redeem.redeem(deprizeId);
        vm.expectRevert(abi.encodeWithSelector(DePrizeRedeem.NothingToRedeem.selector, deprizeId, alice));
        redeem.redeem(deprizeId);
        vm.stopPrank();
    }

    function testRedeemFailedWhenReceiverReverts() public {
        RevertingRedeemer rr = new RevertingRedeemer();
        ctf.mint(address(rr), _positionId(1), 1 ether);
        _settleWinner(102);
        _reportWinner(1);
        vm.expectRevert(DePrizeRedeem.RedeemFailed.selector);
        rr.approveAndRedeem(ctf, redeem, deprizeId);
    }

    function testRedeemReentrancyBlocked() public {
        ReentrantRedeemer rr = new ReentrantRedeemer();
        ctf.mint(address(rr), _positionId(1), 1 ether);
        _settleWinner(102);
        _reportWinner(1);
        // The re-entrant inner call reverts on the guard, failing the ETH payout.
        vm.expectRevert(DePrizeRedeem.RedeemFailed.selector);
        rr.approveAndRedeem(ctf, redeem, deprizeId);
    }

    function testRedeemViaSingleAcceptanceHook() public {
        // A CTF delivering the mid-redeem pull through onERC1155Received (single)
        // instead of the batch hook must work identically.
        ctf.setUseSingleHooks(true);
        ctf.mint(alice, _positionId(1), 1 ether);
        _settleWinner(102);
        _reportWinner(1);

        vm.startPrank(alice);
        ctf.setApprovalForAll(address(redeem), true);
        uint256 balBefore = alice.balance;
        redeem.redeem(deprizeId);
        vm.stopPrank();
        assertEq(alice.balance - balBefore, 1 ether, "paid via single-hook delivery");
    }

    function testApprovalNotAbusableByThirdParty() public {
        // A victim's standing setApprovalForAll on the helper cannot be leveraged
        // by anyone else: the helper only ever moves msg.sender's own tokens.
        ctf.mint(alice, _positionId(1), 5 ether);
        _settleWinner(102);
        _reportWinner(1);

        vm.prank(alice);
        ctf.setApprovalForAll(address(redeem), true); // standing approval

        vm.prank(bob); // attacker holds nothing
        vm.expectRevert(abi.encodeWithSelector(DePrizeRedeem.NothingToRedeem.selector, deprizeId, bob));
        redeem.redeem(deprizeId);
        assertEq(ctf.balanceOf(alice, _positionId(1)), 5 ether, "victim untouched");
    }

    function testCrossConditionIsolation() public {
        // Outcome tokens of an unrelated condition (same collateral, same holder)
        // are never touched by a redeem for this DePrize.
        bytes32 otherCid = ctf.getConditionId(oracle, keccak256("unrelated"), 3);
        uint256 otherPid = ctf.getPositionId(address(weth), ctf.getCollectionId(bytes32(0), otherCid, 1 << 1));
        ctf.mint(alice, otherPid, 4 ether);
        ctf.mint(alice, _positionId(1), 1 ether);
        _settleWinner(102);
        _reportWinner(1);

        vm.startPrank(alice);
        ctf.setApprovalForAll(address(redeem), true);
        redeem.redeem(deprizeId);
        vm.stopPrank();
        assertEq(ctf.balanceOf(alice, otherPid), 4 ether, "unrelated condition untouched");
    }

    function testStrayWethNotSweptIntoPayout() public {
        // Same lesson as the M3 residual-sweep fix: WETH parked in the helper must
        // never leak into a caller's payout (the payout is the redemption DELTA).
        vm.deal(address(this), 5 ether);
        weth.deposit{value: 5 ether}();
        weth.transfer(address(redeem), 5 ether);

        ctf.mint(alice, _positionId(1), 1 ether);
        _settleWinner(102);
        _reportWinner(1);

        vm.startPrank(alice);
        ctf.setApprovalForAll(address(redeem), true);
        uint256 balBefore = alice.balance;
        redeem.redeem(deprizeId);
        vm.stopPrank();

        assertEq(alice.balance - balBefore, 1 ether, "exactly the redemption value");
        assertEq(weth.balanceOf(address(redeem)), 5 ether, "stray WETH untouched");
    }

    function testConstructorRejectsZeroAddresses() public {
        vm.expectRevert(DePrizeRedeem.ZeroAddress.selector);
        new DePrizeRedeem(address(0), address(ctf), address(weth));
        vm.expectRevert(DePrizeRedeem.ZeroAddress.selector);
        new DePrizeRedeem(address(registry), address(0), address(weth));
        vm.expectRevert(DePrizeRedeem.ZeroAddress.selector);
        new DePrizeRedeem(address(registry), address(ctf), address(0));
    }

    // -- ERC-1155 receiver guard ---------------------------------------------------

    function testRejectsUnsolicitedERC1155() public {
        uint256[] memory ids = new uint256[](1);
        uint256[] memory values = new uint256[](1);
        ids[0] = 1;
        values[0] = 1;
        vm.prank(address(ctf));
        vm.expectRevert(DePrizeRedeem.UnexpectedERC1155.selector);
        IERC1155Receiver(address(redeem)).onERC1155BatchReceived(address(this), address(0), ids, values, "");
    }

    function testRejectsUnsolicitedERC1155Single() public {
        vm.prank(address(ctf));
        vm.expectRevert(DePrizeRedeem.UnexpectedERC1155.selector);
        IERC1155Receiver(address(redeem)).onERC1155Received(address(this), address(0), 1, 1, "");
    }

    function testRejectsERC1155FromNonCtf() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert(DePrizeRedeem.UnexpectedERC1155.selector);
        IERC1155Receiver(address(redeem)).onERC1155Received(address(this), address(0), 1, 1, "");
    }

    function testSupportsInterface() public view {
        assertTrue(redeem.supportsInterface(type(IERC1155Receiver).interfaceId), "ERC1155Receiver");
        assertTrue(redeem.supportsInterface(type(IERC165).interfaceId), "ERC165");
        assertFalse(redeem.supportsInterface(0xffffffff), "unknown");
    }

    // -- mock-CTF fidelity (the properties the design relies on) --------------------

    function testReportPayoutsIsWriteOnce() public {
        _reportWinner(1);
        uint256[] memory payouts = new uint256[](3);
        payouts[0] = 1;
        vm.prank(oracle);
        vm.expectRevert("payout denominator already set");
        ctf.reportPayouts(QUESTION_ID, payouts);
    }

    function testReportPayoutsRejectsAllZeroes() public {
        uint256[] memory payouts = new uint256[](3);
        vm.prank(oracle);
        vm.expectRevert("payout is all zeroes");
        ctf.reportPayouts(QUESTION_ID, payouts);
    }

    function testReportPayoutsOnlyOracleResolvesThisCondition() public {
        // A non-oracle sender resolves a DIFFERENT conditionId (derived from
        // msg.sender), so the DePrize condition stays unresolved.
        uint256[] memory payouts = new uint256[](3);
        payouts[1] = 1;
        vm.prank(address(0xBAD));
        vm.expectRevert("condition not prepared or found");
        ctf.reportPayouts(QUESTION_ID, payouts);
        assertEq(ctf.payoutDenominator(conditionId), 0, "DePrize condition unresolved");
    }

    // -----------------------------------------------------------------------
    // DePrizeResolve script pre-flight
    // -----------------------------------------------------------------------

    function testBuildReportWinnerVector() public {
        _settleWinner(102);
        (bytes32 cid, uint256[] memory payouts, bytes memory callData) = resolveScript.buildReport(
            IDePrizeRegistry(address(registry)), IConditionalTokens(address(ctf)), deprizeId, QUESTION_ID, oracle
        );
        assertEq(cid, conditionId, "conditionId");
        assertEq(payouts.length, 3);
        assertEq(payouts[0], 0);
        assertEq(payouts[1], 1, "winner slot (team 102 = index 1)");
        assertEq(payouts[2], 0);
        assertEq(callData, abi.encodeCall(IConditionalTokens.reportPayouts, (QUESTION_ID, payouts)), "calldata");

        // The emitted calldata, submitted by the oracle, resolves the condition.
        vm.prank(oracle);
        (bool ok,) = address(ctf).call(callData);
        assertTrue(ok, "report submission");
        assertEq(ctf.payoutDenominator(conditionId), 1, "resolved");
    }

    function testBuildReportEqualVectorOnNoWinner() public {
        vm.startPrank(owner);
        registry.lock(deprizeId);
        registry.settleNoWinner(deprizeId);
        vm.stopPrank();
        (, uint256[] memory payouts,) = resolveScript.buildReport(
            IDePrizeRegistry(address(registry)), IConditionalTokens(address(ctf)), deprizeId, QUESTION_ID, oracle
        );
        for (uint256 i = 0; i < 3; i++) {
            assertEq(payouts[i], 1, "equal payout");
        }
    }

    function testBuildReportEqualVectorOnCancelled() public {
        vm.startPrank(owner);
        registry.announceCancellation(deprizeId);
        vm.warp(block.timestamp + registry.CANCELLATION_NOTICE());
        registry.cancel(deprizeId);
        vm.stopPrank();
        (, uint256[] memory payouts,) = resolveScript.buildReport(
            IDePrizeRegistry(address(registry)), IConditionalTokens(address(ctf)), deprizeId, QUESTION_ID, oracle
        );
        for (uint256 i = 0; i < 3; i++) {
            assertEq(payouts[i], 1, "equal payout");
        }
    }

    function testBuildReportRevertsWrongState() public {
        vm.expectRevert(
            abi.encodeWithSelector(DePrizeResolve.WrongState.selector, deprizeId, IDePrizeRegistry.DePrizeState.OPEN)
        );
        resolveScript.buildReport(
            IDePrizeRegistry(address(registry)), IConditionalTokens(address(ctf)), deprizeId, QUESTION_ID, oracle
        );
    }

    function testBuildReportRevertsConditionMismatchWrongQuestion() public {
        _settleWinner(102);
        bytes32 wrongQuestion = keccak256("some-other-question");
        bytes32 computed = ctf.getConditionId(oracle, wrongQuestion, 3);
        vm.expectRevert(abi.encodeWithSelector(DePrizeResolve.ConditionMismatch.selector, computed, conditionId));
        resolveScript.buildReport(
            IDePrizeRegistry(address(registry)), IConditionalTokens(address(ctf)), deprizeId, wrongQuestion, oracle
        );
    }

    function testBuildReportRevertsConditionMismatchWrongOracle() public {
        _settleWinner(102);
        address wrongOracle = address(0xBAD);
        bytes32 computed = ctf.getConditionId(wrongOracle, QUESTION_ID, 3);
        vm.expectRevert(abi.encodeWithSelector(DePrizeResolve.ConditionMismatch.selector, computed, conditionId));
        resolveScript.buildReport(
            IDePrizeRegistry(address(registry)), IConditionalTokens(address(ctf)), deprizeId, QUESTION_ID, wrongOracle
        );
    }

    function testBuildReportRevertsAlreadyReported() public {
        _settleWinner(102);
        _reportWinner(1);
        vm.expectRevert(abi.encodeWithSelector(DePrizeResolve.AlreadyReported.selector, conditionId, 1));
        resolveScript.buildReport(
            IDePrizeRegistry(address(registry)), IConditionalTokens(address(ctf)), deprizeId, QUESTION_ID, oracle
        );
    }

    function testAssertMarketHaltedRevertsWhileRunning() public {
        StubMarket market = new StubMarket(conditionId); // stage 0 = Running
        vm.expectRevert(abi.encodeWithSelector(DePrizeResolve.MarketStillRunning.selector, address(market)));
        resolveScript.assertMarketHalted(ILMSRMarketMaker(address(market)), conditionId);
    }

    function testAssertMarketHaltedAcceptsPausedAndClosed() public {
        StubMarket market = new StubMarket(conditionId);
        market.setStage(1); // Paused
        resolveScript.assertMarketHalted(ILMSRMarketMaker(address(market)), conditionId);
        market.setStage(2); // Closed
        resolveScript.assertMarketHalted(ILMSRMarketMaker(address(market)), conditionId);
    }

    function testAssertMarketHaltedRevertsOnConditionMismatch() public {
        bytes32 wrong = keccak256("wrong-market-condition");
        StubMarket market = new StubMarket(wrong);
        market.setStage(1);
        vm.expectRevert(abi.encodeWithSelector(DePrizeResolve.MarketConditionMismatch.selector, wrong, conditionId));
        resolveScript.assertMarketHalted(ILMSRMarketMaker(address(market)), conditionId);
    }
}
