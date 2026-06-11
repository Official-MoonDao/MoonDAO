// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import {DePrizeRedeem} from "../../src/deprize/DePrizeRedeem.sol";
import {DePrizeMint} from "../../src/deprize/DePrizeMint.sol";
import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";
import {IConditionalTokens} from "../../src/deprize/interfaces/IConditionalTokens.sol";
import {ILMSRWithTWAP} from "../../src/deprize/interfaces/ILMSRWithTWAP.sol";
import {IWETH} from "../../src/deprize/interfaces/IWETH.sol";
import {DePrizeResolve} from "../../script/deprize/DePrizeResolve.s.sol";
import {MockWETH, MockJBTerminal} from "./DePrizeMint.t.sol";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/// @dev Resolution-capable ConditionalTokens mock, faithful to the deployed 0.5
///      Gnosis source: conditionId derived from msg.sender in reportPayouts,
///      write-once payout vector (denominator 0 -> sum), per-position floor
///      division in redeemPositions, burn-on-redeem, ERC-1155 approval checks
///      and acceptance hooks on transfers to contracts.
contract MockResolvingCTF {
    mapping(uint256 => mapping(address => uint256)) public balances;
    mapping(address => mapping(address => bool)) public approvals;
    mapping(bytes32 => uint256[]) private _payoutNumerators;
    mapping(bytes32 => uint256) public payoutDenominator;
    address public collateral; // mock WETH used to pay redemptions

    constructor(address collateral_) {
        collateral = collateral_;
    }

    // -- conditions & resolution (mirrors ConditionalTokens.sol) ------------

    function prepareCondition(address oracle, bytes32 questionId, uint256 outcomeSlotCount) external {
        require(outcomeSlotCount > 1, "there should be more than one outcome slot");
        bytes32 conditionId = getConditionId(oracle, questionId, outcomeSlotCount);
        require(_payoutNumerators[conditionId].length == 0, "condition already prepared");
        _payoutNumerators[conditionId] = new uint256[](outcomeSlotCount);
    }

    function reportPayouts(bytes32 questionId, uint256[] calldata payouts) external {
        uint256 outcomeSlotCount = payouts.length;
        require(outcomeSlotCount > 1, "there should be more than one outcome slot");
        // The oracle is enforced to be the sender because it's part of the hash.
        bytes32 conditionId = getConditionId(msg.sender, questionId, outcomeSlotCount);
        require(_payoutNumerators[conditionId].length == outcomeSlotCount, "condition not prepared or found");
        require(payoutDenominator[conditionId] == 0, "payout denominator already set");
        uint256 den = 0;
        for (uint256 i = 0; i < outcomeSlotCount; i++) {
            den += payouts[i];
            require(_payoutNumerators[conditionId][i] == 0, "payout numerator already set");
            _payoutNumerators[conditionId][i] = payouts[i];
        }
        require(den > 0, "payout is all zeroes");
        payoutDenominator[conditionId] = den;
    }

    function redeemPositions(
        address collateralToken,
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint256[] calldata indexSets
    ) external {
        require(parentCollectionId == bytes32(0), "mock supports root positions only");
        uint256 den = payoutDenominator[conditionId];
        require(den > 0, "result for condition not received yet");
        uint256 outcomeSlotCount = _payoutNumerators[conditionId].length;
        require(outcomeSlotCount > 0, "condition not prepared yet");

        uint256 totalPayout = 0;
        uint256 fullIndexSet = (1 << outcomeSlotCount) - 1;
        for (uint256 i = 0; i < indexSets.length; i++) {
            uint256 indexSet = indexSets[i];
            require(indexSet > 0 && indexSet < fullIndexSet, "got invalid index set");
            uint256 positionId = getPositionId(collateralToken, getCollectionId(parentCollectionId, conditionId, indexSet));
            uint256 payoutNumerator = 0;
            for (uint256 j = 0; j < outcomeSlotCount; j++) {
                if (indexSet & (1 << j) != 0) payoutNumerator += _payoutNumerators[conditionId][j];
            }
            uint256 stake = balances[positionId][msg.sender];
            if (stake > 0) {
                // Per-position floor division, exactly like the real CTF.
                totalPayout += stake * payoutNumerator / den;
                balances[positionId][msg.sender] = 0;
            }
        }
        if (totalPayout > 0) {
            require(MockWETH(payable(collateralToken)).transfer(msg.sender, totalPayout), "payout transfer failed");
        }
    }

    function payoutNumerators(bytes32 conditionId, uint256 index) external view returns (uint256) {
        return _payoutNumerators[conditionId][index];
    }

    function getOutcomeSlotCount(bytes32 conditionId) external view returns (uint256) {
        return _payoutNumerators[conditionId].length;
    }

    // -- id helpers ----------------------------------------------------------

    function getConditionId(address oracle, bytes32 questionId, uint256 outcomeSlotCount)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(oracle, questionId, outcomeSlotCount));
    }

    function getCollectionId(bytes32 parentCollectionId, bytes32 conditionId, uint256 indexSet)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(parentCollectionId, conditionId, indexSet));
    }

    function getPositionId(address collateralToken, bytes32 collectionId) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(collateralToken, collectionId)));
    }

    // -- ERC-1155 surface ----------------------------------------------------

    function balanceOf(address owner, uint256 id) external view returns (uint256) {
        return balances[id][owner];
    }

    function balanceOfBatch(address[] calldata owners, uint256[] calldata ids)
        external
        view
        returns (uint256[] memory out)
    {
        out = new uint256[](owners.length);
        for (uint256 i = 0; i < owners.length; i++) {
            out[i] = balances[ids[i]][owners[i]];
        }
    }

    function setApprovalForAll(address operator, bool approved) external {
        approvals[msg.sender][operator] = approved;
    }

    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return approvals[owner][operator];
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes calldata) external {
        require(from == msg.sender || approvals[from][msg.sender], "ERC1155: caller not approved");
        balances[id][from] -= value;
        balances[id][to] += value;
        _acceptSingle(to, from, id, value);
    }

    /// @dev Test knob: deliver batch transfers through the SINGLE acceptance hook
    ///      per id (exercises the receiver's onERC1155Received path).
    bool public useSingleHooks;

    function setUseSingleHooks(bool v) external {
        useSingleHooks = v;
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata
    ) external {
        require(from == msg.sender || approvals[from][msg.sender], "ERC1155: caller not approved");
        for (uint256 i = 0; i < ids.length; i++) {
            balances[ids[i]][from] -= values[i];
            balances[ids[i]][to] += values[i];
        }
        if (to.code.length > 0) {
            if (useSingleHooks) {
                for (uint256 i = 0; i < ids.length; i++) {
                    _acceptSingle(to, from, ids[i], values[i]);
                }
            } else {
                bytes4 ret = IERC1155Receiver(to).onERC1155BatchReceived(msg.sender, from, ids, values, "");
                require(ret == IERC1155Receiver.onERC1155BatchReceived.selector, "1155 rejected");
            }
        }
    }

    function _acceptSingle(address to, address from, uint256 id, uint256 value) private {
        if (to.code.length > 0) {
            bytes4 ret = IERC1155Receiver(to).onERC1155Received(msg.sender, from, id, value, "");
            require(ret == IERC1155Receiver.onERC1155Received.selector, "1155 rejected");
        }
    }

    /// @dev Test helper: mint outcome tokens directly (stands in for splitPosition).
    function mint(address to, uint256 id, uint256 value) external {
        balances[id][to] += value;
    }
}

/// @dev Minimal LMSR stub for the resolve script's market-halted check.
contract StubMarket {
    uint8 public stage; // 0 = Running, 1 = Paused, 2 = Closed
    bytes32 internal _conditionId;

    constructor(bytes32 conditionId_) {
        _conditionId = conditionId_;
    }

    function setStage(uint8 s) external {
        stage = s;
    }

    function conditionIds(uint256) external view returns (bytes32) {
        return _conditionId;
    }
}

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

        DePrizeRegistry regImpl = new DePrizeRegistry();
        registry = DePrizeRegistry(
            address(new ERC1967Proxy(address(regImpl), abi.encodeCall(DePrizeRegistry.initialize, (owner))))
        );

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

    function testBuildReportRefusesM2Failed() public {
        _settleWinner(102);
        vm.startPrank(owner);
        registry.releaseM1(deprizeId);
        registry.failM2(deprizeId);
        vm.stopPrank();
        vm.expectRevert(abi.encodeWithSelector(DePrizeResolve.M2FailedCtfAlreadyFinal.selector, deprizeId));
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
        resolveScript.assertMarketHalted(ILMSRWithTWAP(address(market)), conditionId);
    }

    function testAssertMarketHaltedAcceptsPausedAndClosed() public {
        StubMarket market = new StubMarket(conditionId);
        market.setStage(1); // Paused
        resolveScript.assertMarketHalted(ILMSRWithTWAP(address(market)), conditionId);
        market.setStage(2); // Closed
        resolveScript.assertMarketHalted(ILMSRWithTWAP(address(market)), conditionId);
    }

    function testAssertMarketHaltedRevertsOnConditionMismatch() public {
        bytes32 wrong = keccak256("wrong-market-condition");
        StubMarket market = new StubMarket(wrong);
        market.setStage(1);
        vm.expectRevert(abi.encodeWithSelector(DePrizeResolve.MarketConditionMismatch.selector, wrong, conditionId));
        resolveScript.assertMarketHalted(ILMSRWithTWAP(address(market)), conditionId);
    }
}

// ---------------------------------------------------------------------------
// Fork tests (guarded — skip unless DEPRIZE_FORK_RPC is set)
// ---------------------------------------------------------------------------

/// @dev 0.8 view of the 0.5 LMSRWithTWAPFactory (full-loop test only).
interface ILMSRWithTWAPFactory {
    function createLMSRWithTWAP(
        address pmSystem,
        address collateralToken,
        bytes32[] calldata conditionIds,
        uint64 fee,
        address whitelist,
        uint256 funding
    ) external returns (address lmsrWithTWAP);
}

/// @notice The resolve→redeem close-out loop against the REAL Arbitrum-Sepolia
///         CTF (the contract whose payout math actually decides mainnet payouts).
///         A fresh condition is prepared with a test oracle, so resolution can be
///         exercised without touching the shared live market's condition.
///
/// Run with:
///   DEPRIZE_FORK_RPC=<arb-sepolia rpc> forge test --match-contract DePrizeM4ForkTest -vvv
/// The full bet→resolve→redeem→unwind loop additionally needs the LMSR factory:
///   DEPRIZE_FORK_FACTORY=0x<LMSRWithTWAPFactory> (skipped when unset)
contract DePrizeM4ForkTest is Test {
    // Arbitrum-Sepolia deployments (mirror ui/const/config.ts).
    address constant WETH = 0xA441f20115c868dc66bC1977E1c17D4B9A0189c7;
    address constant CTF = 0xa0B1b14515C26acb193cb45Be5508A8A46109a27;

    DePrizeRegistry registry;
    DePrizeRedeem redeem;

    address owner = address(0xA11CE);
    address oracle = address(0x5AFE);
    address alice = address(0xA11A);
    address bob = address(0xB0B);

    uint256 constant SLOTS = 3;
    bool forkEnabled;

    function setUp() public {
        string memory rpc = vm.envOr("DEPRIZE_FORK_RPC", string(""));
        if (bytes(rpc).length == 0) return; // not configured -> tests no-op
        vm.createSelectFork(rpc);
        forkEnabled = true;

        DePrizeRegistry regImpl = new DePrizeRegistry();
        registry = DePrizeRegistry(
            address(new ERC1967Proxy(address(regImpl), abi.encodeCall(DePrizeRegistry.initialize, (owner))))
        );
        redeem = new DePrizeRedeem(address(registry), CTF, WETH);

        vm.deal(address(this), 1000 ether);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    /// @dev Register a DePrize against a freshly-prepared condition (unique
    ///      questionId per call so reruns/parallel tests never collide).
    function _newDePrize(bytes32 salt) internal returns (uint256 deprizeId, bytes32 questionId, bytes32 conditionId) {
        questionId = keccak256(abi.encode("deprize-m4-fork", salt, block.number, address(this)));
        IConditionalTokens(CTF).prepareCondition(oracle, questionId, SLOTS);
        conditionId = IConditionalTokens(CTF).getConditionId(oracle, questionId, SLOTS);

        uint256[] memory teams = new uint256[](SLOTS);
        for (uint256 i = 0; i < SLOTS; i++) {
            teams[i] = 100 + i;
        }
        vm.startPrank(owner);
        deprizeId = registry.register(uint256(keccak256(abi.encode(salt))) % 1e9 + 1, teams, block.timestamp + 30 days);
        registry.setCondition(deprizeId, conditionId);
        registry.open(deprizeId);
        vm.stopPrank();
    }

    /// @dev Split `amount` WETH into a full outcome set and send slot `slot` to `to`.
    function _giveOutcomeTokens(bytes32 conditionId, address to, uint256 slot, uint256 amount) internal {
        IWETH(WETH).deposit{value: amount}();
        IWETH(WETH).approve(CTF, amount);
        uint256[] memory partition = new uint256[](SLOTS);
        for (uint256 i = 0; i < SLOTS; i++) {
            partition[i] = 1 << i;
        }
        IConditionalTokens(CTF).splitPosition(WETH, bytes32(0), conditionId, partition, amount);
        IConditionalTokens(CTF).safeTransferFrom(address(this), to, _positionId(conditionId, slot), amount, "");
    }

    function _positionId(bytes32 conditionId, uint256 slot) internal view returns (uint256) {
        return IConditionalTokens(CTF).getPositionId(
            WETH, IConditionalTokens(CTF).getCollectionId(bytes32(0), conditionId, 1 << slot)
        );
    }

    function _report(bytes32 questionId, uint256[] memory payouts) internal {
        vm.prank(oracle);
        IConditionalTokens(CTF).reportPayouts(questionId, payouts);
    }

    // Accept ERC-1155 from splitPosition / market close.
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function testForkWinnerResolveRedeem() public {
        if (!forkEnabled) return;
        (uint256 deprizeId, bytes32 questionId, bytes32 conditionId) = _newDePrize("winner");

        _giveOutcomeTokens(conditionId, alice, 1, 2 ether); // alice backs the winner
        _giveOutcomeTokens(conditionId, bob, 0, 1 ether); // bob backs a loser

        vm.startPrank(owner);
        registry.lock(deprizeId);
        registry.settleWinner(deprizeId, 101); // team at slot 1
        vm.stopPrank();

        uint256[] memory payouts = new uint256[](SLOTS);
        payouts[1] = 1;
        _report(questionId, payouts);

        // Winner redeems full value, in ETH, through the helper.
        vm.startPrank(alice);
        IConditionalTokens(CTF).setApprovalForAll(address(redeem), true);
        uint256 aliceBefore = alice.balance;
        redeem.redeem(deprizeId);
        vm.stopPrank();
        assertEq(alice.balance - aliceBefore, 2 ether, "winner full value vs real CTF math");

        // Loser redeems zero; tokens burned.
        vm.startPrank(bob);
        IConditionalTokens(CTF).setApprovalForAll(address(redeem), true);
        uint256 bobBefore = bob.balance;
        redeem.redeem(deprizeId);
        vm.stopPrank();
        assertEq(bob.balance, bobBefore, "loser gets 0");
        assertEq(IConditionalTokens(CTF).balanceOf(bob, _positionId(conditionId, 0)), 0, "burned");

        assertEq(IWETH(WETH).balanceOf(address(redeem)), 0, "no stuck WETH");
        assertEq(address(redeem).balance, 0, "no stuck ETH");
    }

    function testForkCancellationEqualPayoutRedeem() public {
        if (!forkEnabled) return;
        (uint256 deprizeId, bytes32 questionId, bytes32 conditionId) = _newDePrize("cancel");

        _giveOutcomeTokens(conditionId, alice, 0, 1 ether);

        vm.startPrank(owner);
        registry.announceCancellation(deprizeId);
        vm.warp(block.timestamp + registry.CANCELLATION_NOTICE());
        registry.cancel(deprizeId);
        vm.stopPrank();

        uint256[] memory payouts = new uint256[](SLOTS);
        for (uint256 i = 0; i < SLOTS; i++) {
            payouts[i] = 1;
        }
        _report(questionId, payouts);

        uint256 expected = uint256(1 ether) / 3; // real CTF floor division
        assertEq(redeem.previewRedeem(deprizeId, alice), expected, "preview vs real CTF");

        vm.startPrank(alice);
        IConditionalTokens(CTF).setApprovalForAll(address(redeem), true);
        uint256 before = alice.balance;
        redeem.redeem(deprizeId);
        vm.stopPrank();
        assertEq(alice.balance - before, expected, "1/N refund vs real CTF math");
    }

    /// @notice Full close-out loop: provision market -> bets through DePrizeMint ->
    ///         lock -> pause -> settle -> close -> report -> withdrawFees ->
    ///         treasury redeems inventory -> bettors redeem. Asserts ETH
    ///         conservation to the wei. Needs DEPRIZE_FORK_FACTORY.
    function testForkFullCloseOutLoop() public {
        if (!forkEnabled) return;
        address factory = vm.envOr("DEPRIZE_FORK_FACTORY", address(0));
        if (factory == address(0)) return; // factory not configured -> no-op

        (uint256 deprizeId, bytes32 questionId, bytes32 conditionId) = _newDePrize("full-loop");

        // Provision a fresh LMSR market seeded by this test ("the treasury").
        uint256 funding = 3 ether;
        IWETH(WETH).deposit{value: funding}();
        IWETH(WETH).approve(factory, funding);
        bytes32[] memory conditionIds = new bytes32[](1);
        conditionIds[0] = conditionId;
        address market =
            ILMSRWithTWAPFactory(factory).createLMSRWithTWAP(CTF, WETH, conditionIds, 1e16, address(0), funding);

        // Provisioning runbook step: hand the market to the oracle Safe.
        ILMSRWithTWAP(market).transferOwnership(oracle);
        assertEq(ILMSRWithTWAP(market).owner(), oracle, "market owned by oracle");

        // Router (real, behind a proxy) with a mock JB terminal for the 5% slice.
        MockJBTerminal terminal = new MockJBTerminal();
        DePrizeMint mintImpl = new DePrizeMint();
        DePrizeMint mint = DePrizeMint(
            payable(
                address(
                    new ERC1967Proxy(
                        address(mintImpl),
                        abi.encodeCall(DePrizeMint.initialize, (owner, address(registry), address(terminal), WETH, CTF))
                    )
                )
            )
        );
        vm.prank(owner);
        mint.setMarket(deprizeId, market);

        uint256 ctfWethBefore = IWETH(WETH).balanceOf(CTF);

        // Two bets via the real router.
        uint256 aliceSpend = _bet(mint, market, deprizeId, alice, 1, 0.5 ether); // winner slot
        uint256 bobSpend = _bet(mint, market, deprizeId, bob, 0, 0.3 ether); // loser slot

        // Close-out runbook: lock -> pause -> settle -> close -> report -> withdrawFees.
        vm.startPrank(owner);
        registry.lock(deprizeId);
        registry.settleWinner(deprizeId, 101); // team at slot 1
        vm.stopPrank();

        vm.startPrank(oracle);
        ILMSRWithTWAP(market).pause();
        ILMSRWithTWAP(market).close(); // inventory -> oracle
        vm.stopPrank();

        uint256[] memory payouts = new uint256[](SLOTS);
        payouts[1] = 1;
        _report(questionId, payouts);

        vm.startPrank(oracle);
        uint256 fees = ILMSRWithTWAP(market).withdrawFees(); // residual WETH -> oracle
        // Treasury recovers the closed market's inventory via the CTF directly.
        uint256[] memory indexSets = new uint256[](SLOTS);
        for (uint256 i = 0; i < SLOTS; i++) {
            indexSets[i] = 1 << i;
        }
        IConditionalTokens(CTF).redeemPositions(WETH, bytes32(0), conditionId, indexSets);
        vm.stopPrank();
        uint256 treasuryRecovered = IWETH(WETH).balanceOf(oracle);
        assertEq(IWETH(WETH).balanceOf(market), 0, "market fully drained");
        assertGt(fees, 0, "1% fees accrued");

        // Bettors redeem through the helper.
        uint256 alicePayout = _redeemAs(alice, deprizeId);
        uint256 bobPayout = _redeemAs(bob, deprizeId);
        assertGt(alicePayout, 0, "winner paid");
        assertEq(bobPayout, 0, "loser paid 0");

        // ETH conservation, to the wei: everything bettors + treasury put in comes
        // back out as JB slices, bettor payouts, treasury recovery, or collateral
        // still locked in the CTF backing unredeemed (worthless) positions.
        uint256 ctfLocked = IWETH(WETH).balanceOf(CTF) - ctfWethBefore;
        assertEq(
            aliceSpend + bobSpend + funding,
            terminal.totalReceived() + alicePayout + bobPayout + treasuryRecovered + ctfLocked,
            "ETH conservation"
        );
    }

    function _bet(DePrizeMint mint, address market, uint256 deprizeId, address bettor, uint256 slot, uint256 qty)
        internal
        returns (uint256 spent)
    {
        int256[] memory amounts = new int256[](SLOTS);
        amounts[slot] = int256(qty);
        uint256 net = uint256(ILMSRWithTWAP(market).calcNetCost(amounts));
        uint256 cost = net + ILMSRWithTWAP(market).calcMarketFee(net);
        uint256 value = cost * 2 + 1 ether;
        uint256 before = bettor.balance;
        vm.prank(bettor);
        mint.bet{value: value}(deprizeId, slot, qty, cost);
        spent = before - bettor.balance; // slice + cost
    }

    function _redeemAs(address account, uint256 deprizeId) internal returns (uint256 payout) {
        vm.startPrank(account);
        IConditionalTokens(CTF).setApprovalForAll(address(redeem), true);
        uint256 before = account.balance;
        redeem.redeem(deprizeId);
        payout = account.balance - before;
        vm.stopPrank();
    }
}
