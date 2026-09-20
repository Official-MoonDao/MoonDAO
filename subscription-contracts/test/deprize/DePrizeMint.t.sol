// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import {DePrizeMint} from "../../src/deprize/DePrizeMint.sol";
import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";
import {MintPermitHelper} from "./MintPermitHelper.sol";
import {MockJBTerminal, MockWETH, MockResolvingCTF, MockLMSR} from "./DePrizeMocks.sol";

/// @dev Bettor with no payable receive: the ETH refund call reverts.
contract RevertingBettor {
    DePrizeMint internal mint;

    constructor(DePrizeMint m) {
        mint = m;
    }

    function placeBet(
        uint256 deprizeId,
        uint256 outcomeIndex,
        uint256 qty,
        uint256 maxCost,
        uint256 deadline,
        bytes calldata signature
    ) external payable {
        mint.bet{value: msg.value}(deprizeId, outcomeIndex, qty, maxCost, deadline, signature);
    }

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
}

/// @dev Re-enters `bet` from the refund callback. Both hops carry the same permit.
contract ReentrantBettor {
    DePrizeMint internal mint;
    bytes internal replay;
    uint256 internal reentered;

    constructor(DePrizeMint m) {
        mint = m;
    }

    function placeBet(
        uint256 deprizeId,
        uint256 outcomeIndex,
        uint256 qty,
        uint256 maxCost,
        uint256 deadline,
        bytes calldata signature
    ) external payable {
        replay = abi.encodeCall(DePrizeMint.bet, (deprizeId, outcomeIndex, qty, maxCost, deadline, signature));
        mint.bet{value: msg.value}(deprizeId, outcomeIndex, qty, maxCost, deadline, signature);
    }

    receive() external payable {
        if (reentered++ == 0) {
            (bool ok,) = address(mint).call{value: msg.value}(replay);
            require(ok, "reentry rejected");
        }
    }

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
}

contract DePrizeMintTest is Test, MintPermitHelper {
    DePrizeMint mint;
    DePrizeRegistry registry;
    MockJBTerminal terminal;
    MockWETH weth;
    MockResolvingCTF ctf;
    MockLMSR market;

    address owner = address(0xA11CE);
    address oracle = address(0x5AFE);
    address bettor = address(0xB0B);
    address other = address(0xCAFE);

    uint256 constant JB_PROJECT = 4;
    uint256 constant PRICE = 0.5 ether; // 0.5 WETH per outcome token
    bytes32 constant QUESTION = keccak256("touchdown");
    uint256[] teamIds;
    uint256 deprizeId;
    bytes32 conditionId;

    event MarketSet(uint256 indexed deprizeId, address indexed market);
    event ComplianceSignerSet(address indexed complianceSigner);
    event Bet(
        uint256 indexed deprizeId,
        address indexed bettor,
        uint256 outcomeIndex,
        uint256 outcomeTokenAmount,
        uint256 cost,
        uint256 slice
    );

    function setUp() public {
        registry = new DePrizeRegistry(owner);
        terminal = new MockJBTerminal();
        weth = new MockWETH();
        ctf = new MockResolvingCTF(address(weth));

        ctf.prepareCondition(oracle, QUESTION, 3);
        conditionId = ctf.getConditionId(oracle, QUESTION, 3);
        market = new MockLMSR(address(ctf), address(weth), 3, PRICE, conditionId);

        mint = new DePrizeMint(owner, address(registry), address(terminal), address(weth), address(ctf));

        teamIds = new uint256[](3);
        teamIds[0] = 101;
        teamIds[1] = 102;
        teamIds[2] = 103;

        vm.startPrank(owner);
        deprizeId = registry.register(JB_PROJECT, teamIds, block.timestamp + 30 days);
        registry.setCondition(deprizeId, conditionId);
        registry.open(deprizeId);
        mint.setMarket(deprizeId, address(market));
        vm.stopPrank();

        _initCompliance(mint, owner);
        vm.deal(bettor, 100 ether);
        vm.deal(other, 100 ether);
    }

    // ---------------------------------------------------------------------
    // helpers
    // ---------------------------------------------------------------------

    function _cost(uint256 qty) internal view returns (uint256) {
        uint256 net = (qty * PRICE) / 1e18;
        return net + (net * 1e16) / 1e18;
    }

    function _assertMintHoldsNothing() internal view {
        assertEq(address(mint).balance, 0, "mint ETH");
        assertEq(weth.balanceOf(address(mint)), 0, "mint WETH");
        assertEq(weth.allowance(address(mint), address(market)), 0, "mint allowance");
        for (uint256 i = 0; i < 3; i++) {
            assertEq(ctf.balanceOf(address(mint), market.positionId(i)), 0, "mint outcome tokens");
        }
    }

    function _openSecondDePrize() internal returns (uint256 id, MockLMSR m2, bytes32 cond2) {
        bytes32 q2 = keccak256("second");
        ctf.prepareCondition(oracle, q2, 3);
        cond2 = ctf.getConditionId(oracle, q2, 3);
        m2 = new MockLMSR(address(ctf), address(weth), 3, PRICE, cond2);
        vm.startPrank(owner);
        id = registry.register(JB_PROJECT + 1, teamIds, block.timestamp + 30 days);
        registry.setCondition(id, cond2);
        registry.open(id);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------------
    // construction
    // ---------------------------------------------------------------------

    function testConstructorWiresImmutables() public view {
        assertEq(mint.owner(), owner);
        assertEq(mint.pendingOwner(), address(0));
        assertEq(address(mint.registry()), address(registry));
        assertEq(address(mint.jbTerminal()), address(terminal));
        assertEq(address(mint.weth()), address(weth));
        assertEq(address(mint.ctf()), address(ctf));
        assertEq(mint.SLICE_DENOMINATOR(), 20);
    }

    function testConstructorRejectsZeroDependencies() public {
        vm.expectRevert(DePrizeMint.ZeroAddress.selector);
        new DePrizeMint(owner, address(0), address(terminal), address(weth), address(ctf));
        vm.expectRevert(DePrizeMint.ZeroAddress.selector);
        new DePrizeMint(owner, address(registry), address(0), address(weth), address(ctf));
        vm.expectRevert(DePrizeMint.ZeroAddress.selector);
        new DePrizeMint(owner, address(registry), address(terminal), address(0), address(ctf));
        vm.expectRevert(DePrizeMint.ZeroAddress.selector);
        new DePrizeMint(owner, address(registry), address(terminal), address(weth), address(0));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new DePrizeMint(address(0), address(registry), address(terminal), address(weth), address(ctf));
    }

    function testNoProxyPlumbingAndNoReceive() public {
        (bool okInit,) = address(mint).call(abi.encodeWithSignature("initialize(address,address,address,address,address)", owner, owner, owner, owner, owner));
        assertFalse(okInit, "initialize must not exist");
        (bool okUpgrade,) = address(mint).call(abi.encodeWithSignature("upgradeToAndCall(address,bytes)", owner, ""));
        assertFalse(okUpgrade, "UUPS must not exist");
        (bool okFee,) = address(mint).call(abi.encodeWithSignature("setFeeRouter(address)", owner));
        assertFalse(okFee, "fee router must not exist");
        vm.prank(bettor);
        (bool okEth,) = address(mint).call{value: 1 wei}("");
        assertFalse(okEth, "mint must not accept stray ETH");
    }

    function testEip712DomainIsStable() public view {
        // The backend signer (ui/pages/api/deprize/permit.ts) signs against
        // name "DePrizeMint" / version "1"; a v2 redeploy must not change that.
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("DePrizeMint"),
                keccak256("1"),
                block.chainid,
                address(mint)
            )
        );
        uint256 deadline = block.timestamp + 1;
        bytes32 structHash = keccak256(abi.encode(mint.COMPLIANCE_PERMIT_TYPEHASH(), bettor, deprizeId, deadline));
        assertEq(mint.hashPermit(bettor, deprizeId, deadline), keccak256(abi.encodePacked("\x19\x01", domain, structHash)));
    }

    function testSupportsInterface() public view {
        assertTrue(mint.supportsInterface(type(IERC1155Receiver).interfaceId));
        assertTrue(mint.supportsInterface(type(IERC165).interfaceId));
        assertFalse(mint.supportsInterface(0xdeadbeef));
    }

    // ---------------------------------------------------------------------
    // happy path
    // ---------------------------------------------------------------------

    function testBetRoutesSliceBuysAndRefunds() public {
        uint256 qty = 1 ether;
        uint256 value = 1 ether;
        uint256 slice = value / 20; // 0.05
        uint256 cost = _cost(qty); // 0.505
        uint256 refund = value - slice - cost;

        uint256 before = bettor.balance;
        (uint256 deadline, bytes memory sig) = _permit(mint, bettor, deprizeId);

        vm.expectEmit(true, true, false, true);
        emit Bet(deprizeId, bettor, 0, qty, cost, slice);
        vm.prank(bettor);
        mint.bet{value: value}(deprizeId, 0, qty, type(uint256).max, deadline, sig);

        assertEq(terminal.lastProjectId(), JB_PROJECT);
        assertEq(terminal.lastBeneficiary(), bettor);
        assertEq(terminal.lastValue(), slice);
        assertEq(weth.balanceOf(address(market)), cost, "market received exactly cost");
        assertEq(ctf.balanceOf(bettor, market.positionId(0)), qty, "bettor holds the outcome tokens");
        assertEq(ctf.balanceOf(bettor, market.positionId(1)), 0);
        assertEq(before - bettor.balance, slice + cost, "bettor paid slice + cost");
        assertEq(bettor.balance, before - value + refund, "unspent budget refunded");
        assertGt(refund, 0, "this case has a refund");
        _assertMintHoldsNothing();
    }

    function testBetExactBudgetNoRefund() public {
        uint256 qty = 1 ether;
        uint256 cost = _cost(qty);
        // value such that value - value/20 == cost  => value = cost * 20 / 19 (rounded up)
        uint256 value = (cost * 20 + 18) / 19;
        uint256 slice = value / 20;
        assertGe(value - slice, cost);
        uint256 before = bettor.balance;
        _bet(mint, bettor, value, deprizeId, 1, qty, cost);
        assertEq(before - bettor.balance, slice + cost);
        assertEq(ctf.balanceOf(bettor, market.positionId(1)), qty);
        _assertMintHoldsNothing();
    }

    function testBetAcceptsSingleTransferDelivery() public {
        // Default mock delivery is the real Gnosis shape (one batch over all slots);
        // a market that sends one single transfer per slot must also settle.
        market.setDeliverSingle(true);
        _bet(mint, bettor, 1 ether, deprizeId, 2, 1 ether, type(uint256).max);
        assertEq(ctf.balanceOf(bettor, market.positionId(2)), 1 ether);
        _assertMintHoldsNothing();
    }

    function testMultipleBetsAccumulateFeesInMarketOnly() public {
        _bet(mint, bettor, 1 ether, deprizeId, 0, 1 ether, type(uint256).max);
        _bet(mint, other, 2 ether, deprizeId, 1, 2 ether, type(uint256).max);
        assertEq(weth.balanceOf(address(market)), _cost(1 ether) + _cost(2 ether));
        assertEq(terminal.totalReceived(), 1 ether / 20 + 2 ether / 20);
        assertEq(terminal.payCount(), 2);
        _assertMintHoldsNothing();
    }

    function testFuzzBetConservesValue(uint96 qtyRaw, uint96 extraRaw) public {
        uint256 qty = bound(uint256(qtyRaw), 1e12, 50 ether);
        uint256 extra = bound(uint256(extraRaw), 0, 10 ether);
        uint256 cost = _cost(qty);
        uint256 value = (cost * 20 + 18) / 19 + extra;
        vm.deal(bettor, value);
        uint256 slice = value / 20;

        _bet(mint, bettor, value, deprizeId, 0, qty, type(uint256).max);

        uint256 refund = bettor.balance;
        assertEq(slice + cost + refund, value, "ETH in == slice + cost + refund");
        assertEq(terminal.totalReceived(), slice);
        assertEq(weth.balanceOf(address(market)), cost);
        assertEq(ctf.balanceOf(bettor, market.positionId(0)), qty);
        _assertMintHoldsNothing();
    }

    // ---------------------------------------------------------------------
    // input validation
    // ---------------------------------------------------------------------

    function testBetRevertsCostAboveMaxCost() public {
        uint256 cost = _cost(1 ether);
        (uint256 deadline, bytes memory sig) = _permit(mint, bettor, deprizeId);
        vm.prank(bettor);
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.CostTooHigh.selector, cost, 0.95 ether, cost - 1));
        mint.bet{value: 1 ether}(deprizeId, 0, 1 ether, cost - 1, deadline, sig);
    }

    function testBetRevertsCostAboveBudget() public {
        uint256 cost = _cost(1 ether);
        (uint256 deadline, bytes memory sig) = _permit(mint, bettor, deprizeId);
        vm.prank(bettor);
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.CostTooHigh.selector, cost, 0.475 ether, type(uint256).max));
        mint.bet{value: 0.5 ether}(deprizeId, 0, 1 ether, type(uint256).max, deadline, sig);
    }

    function testBetRevertsZeroQuantity() public {
        (uint256 deadline, bytes memory sig) = _permit(mint, bettor, deprizeId);
        vm.prank(bettor);
        vm.expectRevert(DePrizeMint.NonPositiveCost.selector);
        mint.bet{value: 1 ether}(deprizeId, 0, 0, type(uint256).max, deadline, sig);
    }

    function testBetRevertsBadOutcomeIndex() public {
        (uint256 deadline, bytes memory sig) = _permit(mint, bettor, deprizeId);
        vm.prank(bettor);
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.BadOutcomeIndex.selector, deprizeId, 3));
        mint.bet{value: 1 ether}(deprizeId, 3, 1 ether, type(uint256).max, deadline, sig);
    }

    function testBetRevertsMarketNotSet() public {
        (uint256 id,,) = _openSecondDePrize();
        (uint256 deadline, bytes memory sig) = _permit(mint, bettor, id);
        vm.prank(bettor);
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.MarketNotSet.selector, id));
        mint.bet{value: 1 ether}(id, 0, 1 ether, type(uint256).max, deadline, sig);
    }

    function testBetRevertsWhenBettingClosed() public {
        vm.prank(owner);
        registry.announceCancellation(deprizeId);
        (uint256 deadline, bytes memory sig) = _permit(mint, bettor, deprizeId);
        vm.prank(bettor);
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.BettingClosed.selector, deprizeId));
        mint.bet{value: 1 ether}(deprizeId, 0, 1 ether, type(uint256).max, deadline, sig);

        vm.startPrank(owner);
        registry.abortCancellation(deprizeId);
        registry.lock(deprizeId);
        vm.stopPrank();
        vm.prank(bettor);
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.BettingClosed.selector, deprizeId));
        mint.bet{value: 1 ether}(deprizeId, 0, 1 ether, type(uint256).max, deadline, sig);
    }

    function testBetRevertsUnknownDePrize() public {
        (uint256 deadline, bytes memory sig) = _permit(mint, bettor, 77);
        vm.prank(bettor);
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.BettingClosed.selector, 77));
        mint.bet{value: 1 ether}(77, 0, 1 ether, type(uint256).max, deadline, sig);
    }

    // ---------------------------------------------------------------------
    // compliance permit
    // ---------------------------------------------------------------------

    function testPermitExpired() public {
        (uint256 deadline, bytes memory sig) = _permit(mint, bettor, deprizeId);
        vm.warp(deadline + 1);
        vm.prank(bettor);
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.PermitExpired.selector, deadline));
        mint.bet{value: 1 ether}(deprizeId, 0, 1 ether, type(uint256).max, deadline, sig);
    }

    function testPermitBoundToWallet() public {
        (uint256 deadline, bytes memory sig) = _permit(mint, bettor, deprizeId);
        vm.prank(other);
        vm.expectRevert(); // InvalidPermit(recovered) with an unpredictable recovered address
        mint.bet{value: 1 ether}(deprizeId, 0, 1 ether, type(uint256).max, deadline, sig);
    }

    function testPermitBoundToDePrize() public {
        (uint256 id, MockLMSR m2,) = _openSecondDePrize();
        vm.prank(owner);
        mint.setMarket(id, address(m2));
        (uint256 deadline, bytes memory sig) = _permit(mint, bettor, deprizeId);
        vm.prank(bettor);
        vm.expectRevert();
        mint.bet{value: 1 ether}(id, 0, 1 ether, type(uint256).max, deadline, sig);
    }

    function testPermitWrongSigner() public {
        uint256 deadline = block.timestamp + 1 hours;
        uint256 badPk = uint256(keccak256("not-the-signer"));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(badPk, mint.hashPermit(bettor, deprizeId, deadline));
        bytes memory sig = abi.encodePacked(r, s, v);
        vm.prank(bettor);
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.InvalidPermit.selector, vm.addr(badPk)));
        mint.bet{value: 1 ether}(deprizeId, 0, 1 ether, type(uint256).max, deadline, sig);
    }

    function testPermitSignerUnsetDisablesBetting() public {
        (uint256 deadline, bytes memory sig) = _permit(mint, bettor, deprizeId);
        vm.expectEmit(true, false, false, false);
        emit ComplianceSignerSet(address(0));
        vm.prank(owner);
        mint.setComplianceSigner(address(0));
        vm.prank(bettor);
        vm.expectRevert(DePrizeMint.ComplianceSignerUnset.selector);
        mint.bet{value: 1 ether}(deprizeId, 0, 1 ether, type(uint256).max, deadline, sig);
    }

    function testSetComplianceSignerOnlyOwner() public {
        vm.prank(bettor);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, bettor));
        mint.setComplianceSigner(bettor);
    }

    // ---------------------------------------------------------------------
    // setMarket
    // ---------------------------------------------------------------------

    function testSetMarketOnlyOwner() public {
        (uint256 id, MockLMSR m2,) = _openSecondDePrize();
        vm.prank(bettor);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, bettor));
        mint.setMarket(id, address(m2));
    }

    function testSetMarketIsWriteOnce() public {
        (uint256 id, MockLMSR m2, bytes32 cond2) = _openSecondDePrize();
        MockLMSR m3 = new MockLMSR(address(ctf), address(weth), 3, PRICE, cond2);
        vm.startPrank(owner);
        vm.expectEmit(true, true, false, false);
        emit MarketSet(id, address(m2));
        mint.setMarket(id, address(m2));
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.MarketAlreadySet.selector, id, address(m2)));
        mint.setMarket(id, address(m3));
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.MarketAlreadySet.selector, id, address(m2)));
        mint.setMarket(id, address(m2));
        vm.stopPrank();
        assertEq(mint.marketOf(id), address(m2));
    }

    function testSetMarketValidations() public {
        (uint256 id,, bytes32 cond2) = _openSecondDePrize();
        vm.startPrank(owner);

        vm.expectRevert(DePrizeMint.ZeroAddress.selector);
        mint.setMarket(id, address(0));

        MockResolvingCTF otherCtf = new MockResolvingCTF(address(weth));
        MockLMSR badCtf = new MockLMSR(address(otherCtf), address(weth), 3, PRICE, cond2);
        vm.expectRevert(DePrizeMint.MarketCtfMismatch.selector);
        mint.setMarket(id, address(badCtf));

        MockWETH otherWeth = new MockWETH();
        MockLMSR badWeth = new MockLMSR(address(ctf), address(otherWeth), 3, PRICE, cond2);
        vm.expectRevert(DePrizeMint.MarketCollateralMismatch.selector);
        mint.setMarket(id, address(badWeth));

        MockLMSR badSlots = new MockLMSR(address(ctf), address(weth), 4, PRICE, cond2);
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.MarketSlotMismatch.selector, 4, 3));
        mint.setMarket(id, address(badSlots));

        MockLMSR badCond = new MockLMSR(address(ctf), address(weth), 3, PRICE, conditionId);
        vm.expectRevert(
            abi.encodeWithSelector(DePrizeMint.MarketConditionMismatch.selector, conditionId, cond2)
        );
        mint.setMarket(id, address(badCond));
        vm.stopPrank();
    }

    // ---------------------------------------------------------------------
    // fail closed on market misbehaviour
    // ---------------------------------------------------------------------

    function testBetRevertsWhenMarketUnderpulls() public {
        market.setUnderpull(1);
        uint256 cost = _cost(1 ether);
        (uint256 deadline, bytes memory sig) = _permit(mint, bettor, deprizeId);
        vm.prank(bettor);
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.CollateralMismatch.selector, cost, cost - 1));
        mint.bet{value: 1 ether}(deprizeId, 0, 1 ether, type(uint256).max, deadline, sig);
        _assertMintHoldsNothing();
    }

    function testBetRevertsWhenNoTokensDelivered() public {
        market.setSkipDeliver(true);
        (uint256 deadline, bytes memory sig) = _permit(mint, bettor, deprizeId);
        uint256 expectedId = market.positionId(0);
        vm.prank(bettor);
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.OutcomeTokenMismatch.selector, expectedId, 1 ether, 0));
        mint.bet{value: 1 ether}(deprizeId, 0, 1 ether, type(uint256).max, deadline, sig);
    }

    function testBetRevertsWhenWrongSlotDelivered() public {
        market.setDeliverWrongSlot(true);
        (uint256 deadline, bytes memory sig) = _permit(mint, bettor, deprizeId);
        vm.prank(bettor);
        // The hook refuses a non-zero amount on any id other than the expected one.
        vm.expectRevert(DePrizeMint.UnexpectedERC1155.selector);
        mint.bet{value: 1 ether}(deprizeId, 1, 1 ether, type(uint256).max, deadline, sig);
    }

    function testBetRevertsWhenOverDelivered() public {
        market.setOverDeliver(true);
        (uint256 deadline, bytes memory sig) = _permit(mint, bettor, deprizeId);
        uint256 expectedId = market.positionId(0);
        vm.prank(bettor);
        vm.expectRevert(
            abi.encodeWithSelector(DePrizeMint.OutcomeTokenMismatch.selector, expectedId, 1 ether, 1 ether + 1)
        );
        mint.bet{value: 1 ether}(deprizeId, 0, 1 ether, type(uint256).max, deadline, sig);
    }

    function testBetRevertsWhenMarketPaused() public {
        vm.prank(address(this));
        market.pause();
        (uint256 deadline, bytes memory sig) = _permit(mint, bettor, deprizeId);
        vm.prank(bettor);
        vm.expectRevert("market halted");
        mint.bet{value: 1 ether}(deprizeId, 0, 1 ether, type(uint256).max, deadline, sig);
    }

    // ---------------------------------------------------------------------
    // ERC-1155 receiver gating
    // ---------------------------------------------------------------------

    function testReceiverRejectsOutsideBet() public {
        uint256[] memory ids = new uint256[](1);
        uint256[] memory vals = new uint256[](1);
        vm.prank(address(ctf));
        vm.expectRevert(DePrizeMint.UnexpectedERC1155.selector);
        mint.onERC1155Received(address(0), address(0), 1, 1, "");
        vm.prank(address(ctf));
        vm.expectRevert(DePrizeMint.UnexpectedERC1155.selector);
        mint.onERC1155BatchReceived(address(0), address(0), ids, vals, "");
    }

    function testReceiverRejectsNonCtfSender() public {
        vm.prank(bettor);
        vm.expectRevert(DePrizeMint.UnexpectedERC1155.selector);
        mint.onERC1155Received(address(0), address(0), 1, 1, "");
    }

    function testUnsolicitedCtfTransferToMintReverts() public {
        uint256 id = market.positionId(0);
        ctf.mint(bettor, id, 5);
        vm.prank(bettor);
        vm.expectRevert(DePrizeMint.UnexpectedERC1155.selector);
        ctf.safeTransferFrom(bettor, address(mint), id, 5, "");
    }

    // ---------------------------------------------------------------------
    // refund path
    // ---------------------------------------------------------------------

    function testRefundFailureReverts() public {
        RevertingBettor rb = new RevertingBettor(mint);
        vm.deal(address(rb), 10 ether);
        (uint256 deadline, bytes memory sig) = _permit(mint, address(rb), deprizeId);
        vm.expectRevert(DePrizeMint.RefundFailed.selector);
        rb.placeBet{value: 1 ether}(deprizeId, 0, 1 ether, type(uint256).max, deadline, sig);
    }

    function testReentrantRefundIsRejected() public {
        ReentrantBettor rb = new ReentrantBettor(mint);
        vm.deal(address(rb), 10 ether);
        (uint256 deadline, bytes memory sig) = _permit(mint, address(rb), deprizeId);
        // Inner bet reverts (ReentrancyGuard) -> receive reverts -> outer RefundFailed.
        vm.expectRevert(DePrizeMint.RefundFailed.selector);
        rb.placeBet{value: 1 ether}(deprizeId, 0, 1 ether, type(uint256).max, deadline, sig);
        _assertMintHoldsNothing();
    }

    // ---------------------------------------------------------------------
    // ownership
    // ---------------------------------------------------------------------

    function testRenounceOwnershipDisabled() public {
        vm.prank(owner);
        vm.expectRevert(DePrizeMint.RenounceDisabled.selector);
        mint.renounceOwnership();
        assertEq(mint.owner(), owner);
    }

    function testOwnershipIsTwoStep() public {
        vm.prank(owner);
        mint.transferOwnership(other);
        assertEq(mint.owner(), owner);
        vm.prank(other);
        mint.acceptOwnership();
        assertEq(mint.owner(), other);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, owner));
        mint.setComplianceSigner(owner);
    }
}
