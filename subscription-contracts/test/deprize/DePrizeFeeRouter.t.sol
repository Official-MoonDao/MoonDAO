// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import {DePrizeFeeRouter} from "../../src/deprize/DePrizeFeeRouter.sol";
import {DePrizeMint} from "../../src/deprize/DePrizeMint.sol";
import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";
import {MockJBTerminal, MockWETH, MockCTF} from "./DePrizeMint.t.sol";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/// @dev Owned LMSR stand-in faithful to the deployed Gnosis MarketMaker in the
///      properties the fee router depends on:
///      - `withdrawFees()` is onlyOwner and transfers the market's ENTIRE
///        standalone WETH balance to the owner;
///      - during trades only the FEE stays on the market — the outcome-token
///        net cost is escrowed away (real market: splitPosition into the CTF),
///        so balance == accrued fees while Running/Paused;
///      - `close()` pushes remaining outcome-token inventory to the owner via
///        the CTF (which invokes the ERC-1155 acceptance hook);
///      - pause/resume/close/transferOwnership are onlyOwner.
contract MockOwnedMarket {
    address public owner;
    address public ctf;
    address public weth;
    uint256 public slots;
    uint256 public price; // WETH per outcome token, fixed-point 1e18
    bytes32 public conditionId;
    uint8 public stage; // 0 Running, 1 Paused, 2 Closed
    uint64 private _fee = 1e16; // 1%

    uint256[] private invIds;
    uint256[] private invValues;

    constructor(address _ctf, address _weth, uint256 _slots, uint256 _price) {
        owner = msg.sender;
        ctf = _ctf;
        weth = _weth;
        slots = _slots;
        price = _price;
        conditionId = keccak256("condition");
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    // -- config views the routers validate against ---------------------------

    function pmSystem() external view returns (address) {
        return ctf;
    }

    function collateralToken() external view returns (address) {
        return weth;
    }

    function atomicOutcomeSlotCount() external view returns (uint256) {
        return slots;
    }

    function conditionIds(uint256) external view returns (bytes32) {
        return conditionId;
    }

    function setConditionId(bytes32 c) external {
        conditionId = c;
    }

    function fee() public view returns (uint64) {
        return _fee;
    }

    // -- trading (DePrizeMint integration) ------------------------------------

    bool public twapUpdated;

    function updateCumulativeTWAP() external {
        twapUpdated = true;
    }

    function calcMarginalPrice(uint8) external view returns (uint256) {
        return price;
    }

    function calcNetCost(int256[] memory amounts) public view returns (int256 cost) {
        for (uint256 i = 0; i < amounts.length; i++) {
            cost += (amounts[i] * int256(price)) / 1e18;
        }
    }

    function calcMarketFee(uint256 outcomeTokenCost) public view returns (uint256) {
        return (outcomeTokenCost * uint256(fee())) / 1e18;
    }

    function trade(int256[] memory amounts, int256 collateralLimit) public returns (int256 total) {
        require(stage == 0, "not running");
        int256 net = calcNetCost(amounts);
        require(net >= 0, "negative");
        uint256 feeAmt = calcMarketFee(uint256(net));
        total = net + int256(feeAmt);
        require(total <= collateralLimit, "limit");
        // Pull fee-inclusive total, then escrow the net cost away (the real
        // market locks it in the CTF via splitPosition) so only the fee stays.
        MockWETH(payable(weth)).transferFrom(msg.sender, address(this), uint256(total));
        MockWETH(payable(weth)).transfer(ctf, uint256(net));

        uint256 n;
        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] > 0) n++;
        }
        uint256[] memory ids = new uint256[](n);
        uint256[] memory values = new uint256[](n);
        uint256 j;
        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] > 0) {
                ids[j] = uint256(keccak256(abi.encode("position", i)));
                values[j] = uint256(amounts[i]);
                j++;
            }
        }
        if (n > 0) MockCTF(ctf).mintTo(msg.sender, ids, values);
    }

    function tradeWithTWAP(int256[] memory amounts, int256 collateralLimit) external {
        this.trade(amounts, collateralLimit);
    }

    // -- owner surface --------------------------------------------------------

    function withdrawFees() external onlyOwner returns (uint256 fees) {
        fees = MockWETH(payable(weth)).balanceOf(address(this));
        MockWETH(payable(weth)).transfer(owner, fees);
    }

    function pause() external onlyOwner {
        require(stage == 0, "not running");
        stage = 1;
    }

    function resume() external onlyOwner {
        require(stage == 1, "not paused");
        stage = 0;
    }

    function close() external onlyOwner {
        require(stage < 2, "closed");
        if (invIds.length > 0) {
            MockCTF(ctf).mintTo(owner, invIds, invValues);
            delete invIds;
            delete invValues;
        }
        stage = 2;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    /// @dev Test knob: give the market outcome-token inventory that close()
    ///      pushes to the owner.
    function setInventory(uint256[] memory ids, uint256[] memory values) external {
        invIds = ids;
        invValues = values;
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

contract DePrizeFeeRouterTest is Test {
    event FeesSwept(uint256 indexed deprizeId, uint256 amount, bool indexed toPrizePool);

    DePrizeFeeRouter router;
    DePrizeRegistry registry;
    MockJBTerminal terminal;
    MockWETH weth;
    MockCTF ctf;
    MockOwnedMarket market;

    address owner = address(0xA11CE);
    address rando = address(0xC0FFEE);

    uint256 constant JB_PROJECT = 4;
    uint256 constant PRICE = 0.5 ether;
    uint256[] teamIds;
    uint256 deprizeId;

    function setUp() public {
        DePrizeRegistry regImpl = new DePrizeRegistry();
        registry = DePrizeRegistry(
            address(new ERC1967Proxy(address(regImpl), abi.encodeCall(DePrizeRegistry.initialize, (owner))))
        );

        terminal = new MockJBTerminal();
        weth = new MockWETH();
        ctf = new MockCTF();
        market = new MockOwnedMarket(address(ctf), address(weth), 3, PRICE);

        router = new DePrizeFeeRouter(owner, address(registry), address(terminal), address(weth), address(ctf));

        teamIds = new uint256[](3);
        teamIds[0] = 101;
        teamIds[1] = 102;
        teamIds[2] = 103;

        vm.startPrank(owner);
        deprizeId = registry.register(JB_PROJECT, teamIds, block.timestamp + 30 days);
        registry.setCondition(deprizeId, keccak256("condition"));
        registry.open(deprizeId);
        router.setMarket(deprizeId, address(market));
        vm.stopPrank();

        // The router must own the market for withdrawFees to work.
        market.transferOwnership(address(router));
    }

    /// @dev Simulate fee accrual: park WETH on the market (during Running the
    ///      real market's standalone balance is exactly the accumulated fees).
    function _accrueFees(uint256 amount) internal {
        vm.deal(address(this), amount);
        weth.deposit{value: amount}();
        weth.transfer(address(market), amount);
    }

    // -- sweeping -------------------------------------------------------------

    function testSweepRoutesFeesToPrizePoolWhileActive() public {
        _accrueFees(1 ether);

        vm.prank(rando); // permissionless
        uint256 swept = router.sweepFees(deprizeId);

        assertEq(swept, 1 ether);
        assertEq(terminal.totalReceived(), 1 ether);
        assertEq(terminal.lastProjectId(), JB_PROJECT);
        assertEq(terminal.lastBeneficiary(), owner);
        assertEq(weth.balanceOf(address(market)), 0);
        assertEq(weth.balanceOf(address(router)), 0);
        assertEq(address(router).balance, 0);
    }

    function testSweepEmitsEvent() public {
        _accrueFees(0.3 ether);
        vm.expectEmit(true, true, false, true);
        emit FeesSwept(deprizeId, 0.3 ether, true);
        router.sweepFees(deprizeId);
    }

    function testSweepWithNoFeesIsANoOp() public {
        uint256 swept = router.sweepFees(deprizeId);
        assertEq(swept, 0);
        assertEq(terminal.totalReceived(), 0);
    }

    function testSweepRoutesToTreasuryOnceTerminal() public {
        vm.startPrank(owner);
        registry.announceCancellation(deprizeId);
        vm.warp(block.timestamp + registry.CANCELLATION_NOTICE());
        registry.cancel(deprizeId);
        vm.stopPrank();

        _accrueFees(1 ether);
        uint256 ownerBefore = owner.balance;

        uint256 swept = router.sweepFees(deprizeId);

        assertEq(swept, 1 ether);
        assertEq(owner.balance - ownerBefore, 1 ether);
        assertEq(terminal.totalReceived(), 0); // refund floor NOT inflated
    }

    function testSweepIsScopedToTheWithdrawnDelta() public {
        // Stray WETH parked on the ROUTER must never be swept into the pool.
        vm.deal(address(this), 5 ether);
        weth.deposit{value: 5 ether}();
        weth.transfer(address(router), 2 ether);
        _accrueFees(1 ether);

        uint256 swept = router.sweepFees(deprizeId);

        assertEq(swept, 1 ether);
        assertEq(terminal.totalReceived(), 1 ether);
        assertEq(weth.balanceOf(address(router)), 2 ether); // untouched
    }

    function testSweepRevertsWhenMarketNotSet() public {
        vm.expectRevert(abi.encodeWithSelector(DePrizeFeeRouter.MarketNotSet.selector, 999));
        router.sweepFees(999);
    }

    function testSweepRevertsWhenRouterDoesNotOwnMarket() public {
        vm.prank(address(router));
        market.transferOwnership(address(0xDEAD));
        _accrueFees(1 ether);
        vm.expectRevert("not owner");
        router.sweepFees(deprizeId);
    }

    // -- setMarket ------------------------------------------------------------

    function testSetMarketOnlyOwner() public {
        vm.prank(rando);
        vm.expectRevert();
        router.setMarket(deprizeId, address(market));
    }

    function testSetMarketRejectsZero() public {
        vm.prank(owner);
        vm.expectRevert(DePrizeFeeRouter.ZeroMarket.selector);
        router.setMarket(deprizeId, address(0));
    }

    function testSetMarketRejectsCtfMismatch() public {
        MockOwnedMarket bad = new MockOwnedMarket(address(0xBAD), address(weth), 3, PRICE);
        vm.prank(owner);
        vm.expectRevert(DePrizeFeeRouter.MarketCtfMismatch.selector);
        router.setMarket(deprizeId, address(bad));
    }

    function testSetMarketRejectsCollateralMismatch() public {
        MockOwnedMarket bad = new MockOwnedMarket(address(ctf), address(0xBAD), 3, PRICE);
        vm.prank(owner);
        vm.expectRevert(DePrizeFeeRouter.MarketCollateralMismatch.selector);
        router.setMarket(deprizeId, address(bad));
    }

    function testSetMarketRejectsConditionMismatch() public {
        MockOwnedMarket bad = new MockOwnedMarket(address(ctf), address(weth), 3, PRICE);
        bad.setConditionId(keccak256("other"));
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                DePrizeFeeRouter.MarketConditionMismatch.selector, keccak256("other"), keccak256("condition")
            )
        );
        router.setMarket(deprizeId, address(bad));
    }

    // -- owner passthroughs -----------------------------------------------------

    function testPauseResumeClosePassthroughs() public {
        vm.startPrank(owner);
        router.pauseMarket(deprizeId);
        assertEq(market.stage(), 1);
        router.resumeMarket(deprizeId);
        assertEq(market.stage(), 0);
        router.closeMarket(deprizeId);
        assertEq(market.stage(), 2);
        vm.stopPrank();
    }

    function testPassthroughsOnlyOwner() public {
        vm.startPrank(rando);
        vm.expectRevert();
        router.pauseMarket(deprizeId);
        vm.expectRevert();
        router.resumeMarket(deprizeId);
        vm.expectRevert();
        router.closeMarket(deprizeId);
        vm.expectRevert();
        router.transferMarketOwnership(deprizeId, rando);
        vm.stopPrank();
    }

    function testPassthroughsRequireMarketSet() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(DePrizeFeeRouter.MarketNotSet.selector, 999));
        router.pauseMarket(999);
    }

    function testTransferMarketOwnershipEscapeHatch() public {
        vm.prank(owner);
        router.transferMarketOwnership(deprizeId, owner);
        assertEq(market.owner(), owner);
    }

    function testTransferMarketOwnershipRejectsZero() public {
        vm.prank(owner);
        vm.expectRevert(DePrizeFeeRouter.ZeroAddress.selector);
        router.transferMarketOwnership(deprizeId, address(0));
    }

    // -- close inventory + ERC-1155 gating --------------------------------------

    function testCloseAcceptsInventoryAndRecoverForwardsIt() public {
        uint256[] memory ids = new uint256[](2);
        uint256[] memory values = new uint256[](2);
        ids[0] = 11;
        ids[1] = 22;
        values[0] = 3 ether;
        values[1] = 4 ether;
        market.setInventory(ids, values);

        vm.prank(owner);
        router.closeMarket(deprizeId);
        assertEq(ctf.balanceOf(address(router), 11), 3 ether);
        assertEq(ctf.balanceOf(address(router), 22), 4 ether);

        vm.prank(owner);
        router.recoverERC1155(ids, values, owner);
        assertEq(ctf.balanceOf(owner, 11), 3 ether);
        assertEq(ctf.balanceOf(owner, 22), 4 ether);
        assertEq(ctf.balanceOf(address(router), 11), 0);
    }

    function testUnsolicitedERC1155Reverts() public {
        uint256[] memory ids = new uint256[](1);
        uint256[] memory values = new uint256[](1);
        ids[0] = 11;
        values[0] = 1 ether;
        vm.expectRevert();
        ctf.mintTo(address(router), ids, values);
        vm.expectRevert();
        ctf.mintToSingle(address(router), 11, 1 ether);
    }

    function testRecoverERC1155OnlyOwner() public {
        uint256[] memory ids = new uint256[](1);
        uint256[] memory values = new uint256[](1);
        vm.prank(rando);
        vm.expectRevert();
        router.recoverERC1155(ids, values, rando);
    }

    // -- recovery ---------------------------------------------------------------

    function testRecoverETH() public {
        vm.deal(address(router), 1 ether);
        vm.prank(owner);
        router.recoverETH(owner, 1 ether);
        assertEq(owner.balance, 1 ether);
    }

    function testRecoverERC20() public {
        vm.deal(address(this), 1 ether);
        weth.deposit{value: 1 ether}();
        weth.transfer(address(router), 1 ether);
        vm.prank(owner);
        router.recoverERC20(address(weth), owner, 1 ether);
        assertEq(weth.balanceOf(owner), 1 ether);
    }

    function testRecoveryOnlyOwner() public {
        vm.startPrank(rando);
        vm.expectRevert();
        router.recoverETH(rando, 1);
        vm.expectRevert();
        router.recoverERC20(address(weth), rando, 1);
        vm.stopPrank();
    }

    // -- interface --------------------------------------------------------------

    function testSupportsInterface() public view {
        assertTrue(router.supportsInterface(type(IERC1155Receiver).interfaceId));
        assertTrue(router.supportsInterface(type(IERC165).interfaceId));
        assertFalse(router.supportsInterface(0xdeadbeef));
    }
}

// ---------------------------------------------------------------------------
// DePrizeMint integration: auto-sweep on every bet
// ---------------------------------------------------------------------------

contract DePrizeMintFeeRouterIntegrationTest is Test {
    DePrizeFeeRouter router;
    DePrizeMint mint;
    DePrizeRegistry registry;
    MockJBTerminal terminal;
    MockWETH weth;
    MockCTF ctf;
    MockOwnedMarket market;

    address owner = address(0xA11CE);
    address bettor = address(0xB0B);

    uint256 constant JB_PROJECT = 4;
    uint256 constant PRICE = 0.5 ether;
    uint256[] teamIds;
    uint256 deprizeId;

    function setUp() public {
        DePrizeRegistry regImpl = new DePrizeRegistry();
        registry = DePrizeRegistry(
            address(new ERC1967Proxy(address(regImpl), abi.encodeCall(DePrizeRegistry.initialize, (owner))))
        );

        terminal = new MockJBTerminal();
        weth = new MockWETH();
        ctf = new MockCTF();
        market = new MockOwnedMarket(address(ctf), address(weth), 3, PRICE);

        DePrizeMint mintImpl = new DePrizeMint();
        mint = DePrizeMint(
            payable(
                address(
                    new ERC1967Proxy(
                        address(mintImpl),
                        abi.encodeCall(
                            DePrizeMint.initialize,
                            (owner, address(registry), address(terminal), address(weth), address(ctf))
                        )
                    )
                )
            )
        );

        router = new DePrizeFeeRouter(owner, address(registry), address(terminal), address(weth), address(ctf));

        teamIds = new uint256[](3);
        teamIds[0] = 101;
        teamIds[1] = 102;
        teamIds[2] = 103;

        vm.startPrank(owner);
        deprizeId = registry.register(JB_PROJECT, teamIds, block.timestamp + 30 days);
        registry.setCondition(deprizeId, keccak256("condition"));
        registry.open(deprizeId);
        mint.setMarket(deprizeId, address(market));
        router.setMarket(deprizeId, address(market));
        mint.setFeeRouter(address(router));
        vm.stopPrank();

        market.transferOwnership(address(router));

        vm.deal(bettor, 100 ether);
    }

    function testSetFeeRouterOnlyOwner() public {
        vm.prank(bettor);
        vm.expectRevert();
        mint.setFeeRouter(address(0));
    }

    function testBetSweepsTradeFeeIntoPrizePool() public {
        uint256 qty = 1 ether;
        uint256 value = 1 ether;
        uint256 slice = value / 20; // 5% -> JB
        uint256 net = (qty * PRICE) / 1e18; // 0.5 ETH
        uint256 fee = (net * 1e16) / 1e18; // 1% -> swept to JB

        vm.prank(bettor);
        mint.bet{value: value}(deprizeId, 0, qty, type(uint256).max);

        // JB received the 5% slice AND the swept 1% trade fee.
        assertEq(terminal.totalReceived(), slice + fee);
        // The sweep is the LAST pay: fees are attributed to the treasury owner.
        assertEq(terminal.lastValue(), fee);
        assertEq(terminal.lastBeneficiary(), owner);
        assertEq(terminal.lastProjectId(), JB_PROJECT);
        // Market balance drained (fees no longer parked on the market).
        assertEq(weth.balanceOf(address(market)), 0);
    }

    function testBetSucceedsWhenSweepReverts() public {
        // Break the sweep: router no longer owns the market.
        vm.prank(address(router));
        market.transferOwnership(address(0xDEAD));

        uint256 value = 1 ether;
        vm.prank(bettor);
        mint.bet{value: value}(deprizeId, 0, 1 ether, type(uint256).max);

        // Bet went through; only the 5% slice reached JB (fee sweep failed quietly).
        assertEq(terminal.totalReceived(), value / 20);
        // The unswept fee is still parked on the market.
        uint256 net = (uint256(1 ether) * PRICE) / 1e18;
        assertEq(weth.balanceOf(address(market)), (net * 1e16) / 1e18);
    }

    function testBetWithoutFeeRouterLeavesFeesOnMarket() public {
        vm.prank(owner);
        mint.setFeeRouter(address(0));

        vm.prank(bettor);
        mint.bet{value: 1 ether}(deprizeId, 0, 1 ether, type(uint256).max);

        assertEq(terminal.totalReceived(), uint256(1 ether) / 20);
        uint256 net = (uint256(1 ether) * PRICE) / 1e18;
        assertEq(weth.balanceOf(address(market)), (net * 1e16) / 1e18);
    }
}
