// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import {DePrizeMint} from "../../src/deprize/DePrizeMint.sol";
import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";
import {ILMSRWithTWAP} from "../../src/deprize/interfaces/ILMSRWithTWAP.sol";
import {IWETH} from "../../src/deprize/interfaces/IWETH.sol";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/// @dev Records the 5% prize-slice routing. Signature matches IJBTerminal.pay so
///      the router's interface call dispatches here. Returns a 1:1 token count to
///      stand in for the $OVERVIEW the bettor would receive.
contract MockJBTerminal {
    uint256 public lastProjectId;
    address public lastBeneficiary;
    uint256 public lastValue;
    uint256 public totalReceived;

    function pay(
        uint256 projectId,
        address,
        uint256,
        address beneficiary,
        uint256,
        string calldata,
        bytes calldata
    ) external payable returns (uint256) {
        lastProjectId = projectId;
        lastBeneficiary = beneficiary;
        lastValue = msg.value;
        totalReceived += msg.value;
        return msg.value;
    }

    receive() external payable {}
}

/// @dev Minimal WETH9-style wrapper.
contract MockWETH {
    string public name = "Wrapped Ether";
    string public symbol = "WETH";
    uint8 public decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function deposit() external payable {
        balanceOf[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external {
        balanceOf[msg.sender] -= amount;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "withdraw failed");
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function totalSupply() external pure returns (uint256) {
        return 0;
    }

    receive() external payable {
        balanceOf[msg.sender] += msg.value;
    }
}

/// @dev Minimal Gnosis ConditionalTokens ERC-1155 surface plus a `mintTo` helper
///      the market mock uses to deliver outcome tokens (mirroring how the real CTF
///      invokes the ERC-1155 acceptance hook with msg.sender == CTF).
contract MockCTF {
    mapping(uint256 => mapping(address => uint256)) public balances;

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

    function isApprovedForAll(address, address) external pure returns (bool) {
        return true;
    }

    function setApprovalForAll(address, bool) external {}

    function mintTo(address to, uint256[] memory ids, uint256[] memory values) external {
        for (uint256 i = 0; i < ids.length; i++) {
            balances[ids[i]][to] += values[i];
        }
        // Acceptance hook is invoked by the CTF itself (msg.sender == this).
        bytes4 ret = IERC1155Receiver(to).onERC1155BatchReceived(msg.sender, address(0), ids, values, "");
        require(ret == IERC1155Receiver.onERC1155BatchReceived.selector, "1155 rejected");
    }

    function mintToSingle(address to, uint256 id, uint256 value) external {
        balances[id][to] += value;
        bytes4 ret = IERC1155Receiver(to).onERC1155Received(msg.sender, address(0), id, value, "");
        require(ret == IERC1155Receiver.onERC1155Received.selector, "1155 rejected");
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes calldata) external {
        balances[id][from] -= value;
        balances[id][to] += value;
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata
    ) external {
        for (uint256 i = 0; i < ids.length; i++) {
            balances[ids[i]][from] -= values[i];
            balances[ids[i]][to] += values[i];
        }
    }
}

/// @dev LMSRWithTWAP stand-in: linear pricing (cost = qty * price / 1e18), pulls
///      WETH collateral from the trader, and mints outcome tokens via the CTF mock.
contract MockMarket {
    address public ctf;
    address public weth;
    uint256 public slots;
    uint256 public price; // WETH per outcome token, fixed-point 1e18
    bytes32 public conditionId;

    // Test knobs to exercise router edge cases.
    uint64 private _fee = 1e16; // 1%
    uint256 public underpull; // collateral the market leaves unconsumed
    bool public skipMint; // pull collateral but mint no outcome tokens
    bool public singleTransfer; // deliver via onERC1155Received (single) instead of batch

    constructor(address _ctf, address _weth, uint256 _slots, uint256 _price) {
        ctf = _ctf;
        weth = _weth;
        slots = _slots;
        price = _price;
        conditionId = keccak256("condition");
    }

    function setFee(uint64 f) external {
        _fee = f;
    }

    function setUnderpull(uint256 u) external {
        underpull = u;
    }

    function setSkipMint(bool s) external {
        skipMint = s;
    }

    function setSingleTransfer(bool s) external {
        singleTransfer = s;
    }

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

    function stage() external pure returns (uint8) {
        return 0;
    }

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

    /// @dev Mirrors MarketMaker.calcMarketFee: outcomeTokenCost * fee / 1e18.
    function calcMarketFee(uint256 outcomeTokenCost) public view returns (uint256) {
        return (outcomeTokenCost * uint256(fee())) / 1e18;
    }

    function trade(int256[] memory amounts, int256 collateralLimit) public returns (int256) {
        return _trade(amounts, collateralLimit);
    }

    function tradeWithTWAP(int256[] memory amounts, int256 collateralLimit) external {
        // Faithful to the deployed LMSRWithTWAP: an external self-call makes the
        // market the trader. The router must NOT use this (it would misattribute
        // collateral/outcome flows) — it calls updateCumulativeTWAP() + trade().
        this.trade(amounts, collateralLimit);
    }

    function _trade(int256[] memory amounts, int256 collateralLimit) internal returns (int256 total) {
        int256 net = calcNetCost(amounts);
        require(net >= 0, "negative");
        // MarketMaker charges netCost + fee and checks the total against the limit.
        total = net + int256(calcMarketFee(uint256(net)));
        require(total <= collateralLimit, "limit");
        // `underpull` lets a test leave collateral unconsumed to exercise the router's sweep.
        MockWETH(payable(weth)).transferFrom(msg.sender, address(this), uint256(total) - underpull);

        if (skipMint) return total;

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
        if (singleTransfer && n == 1) {
            MockCTF(ctf).mintToSingle(msg.sender, ids[0], values[0]);
        } else {
            MockCTF(ctf).mintTo(msg.sender, ids, values);
        }
    }
}

/// @dev Trivial UUPS upgrade target to exercise _authorizeUpgrade.
contract DePrizeMintV2 is DePrizeMint {
    function version() external pure returns (uint256) {
        return 2;
    }
}

/// @dev Bettor with no payable receive/fallback: the ETH refund call reverts.
contract RevertingBettor {
    DePrizeMint internal mint;

    constructor(DePrizeMint m) {
        mint = m;
    }

    function placeBet(uint256 deprizeId, uint256 outcomeIndex, uint256 qty, uint256 maxCost) external payable {
        mint.bet{value: msg.value}(deprizeId, outcomeIndex, qty, maxCost);
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

contract DePrizeMintTest is Test {
    DePrizeMint mint;
    DePrizeRegistry registry;
    MockJBTerminal terminal;
    MockWETH weth;
    MockCTF ctf;
    MockMarket market;

    address owner = address(0xA11CE);
    address bettor = address(0xB0B);

    uint256 constant JB_PROJECT = 4;
    uint256 constant PRICE = 0.5 ether; // 0.5 WETH per outcome token
    uint256[] teamIds;
    uint256 deprizeId;

    function setUp() public {
        // Registry (real, behind a proxy).
        DePrizeRegistry regImpl = new DePrizeRegistry();
        registry = DePrizeRegistry(
            address(new ERC1967Proxy(address(regImpl), abi.encodeCall(DePrizeRegistry.initialize, (owner))))
        );

        // Prediction-market mocks.
        terminal = new MockJBTerminal();
        weth = new MockWETH();
        ctf = new MockCTF();
        market = new MockMarket(address(ctf), address(weth), 3, PRICE);

        // Mint router (real, behind a proxy).
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

        teamIds = new uint256[](3);
        teamIds[0] = 101;
        teamIds[1] = 102;
        teamIds[2] = 103;

        vm.startPrank(owner);
        deprizeId = registry.register(JB_PROJECT, teamIds, block.timestamp + 30 days);
        registry.setCondition(deprizeId, keccak256("condition"));
        registry.open(deprizeId);
        mint.setMarket(deprizeId, address(market));
        vm.stopPrank();

        vm.deal(bettor, 100 ether);
    }

    function _positionId(uint256 outcomeIndex) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode("position", outcomeIndex)));
    }

    // -- happy path ---------------------------------------------------------

    function testBetRoutesSliceWrapsAndForwardsOutcomeTokens() public {
        uint256 qty = 1 ether; // buy 1 outcome token
        uint256 value = 1 ether; // slice = 0.05, budget = 0.95
        uint256 expectedSlice = value / 20;
        uint256 outcomeCost = (qty * PRICE) / 1e18; // 0.5 ETH (excludes fee)
        uint256 expectedFee = (outcomeCost * 1e16) / 1e18; // 1% = 0.005 ETH
        uint256 expectedCost = outcomeCost + expectedFee; // 0.505 ETH (what the market pulls)
        uint256 expectedRefund = value - expectedSlice - expectedCost;

        uint256 balBefore = bettor.balance;

        vm.prank(bettor);
        mint.bet{value: value}(deprizeId, 0, qty, type(uint256).max);

        // 5% slice -> Juicebox, bettor as beneficiary (receives $OVERVIEW).
        assertEq(terminal.lastValue(), expectedSlice, "slice value");
        assertEq(terminal.lastBeneficiary(), bettor, "beneficiary");
        assertEq(terminal.lastProjectId(), JB_PROJECT, "project id");

        // Outcome tokens delivered to the bettor.
        assertEq(ctf.balanceOf(bettor, _positionId(0)), qty, "outcome tokens");
        assertEq(ctf.balanceOf(address(mint), _positionId(0)), 0, "router holds none");

        // 95% wrapped; exactly `cost` consumed by the trade, rest refunded.
        assertEq(weth.balanceOf(address(market)), expectedCost, "market collateral");
        assertEq(weth.balanceOf(address(mint)), 0, "no stuck WETH");
        assertEq(address(mint).balance, 0, "no stuck ETH");
        assertEq(bettor.balance, balBefore - expectedSlice - expectedCost, "net spend = slice + cost");
        assertEq(balBefore - bettor.balance, expectedSlice + expectedCost);
        // sanity: refund matches
        assertEq(expectedRefund, value - expectedSlice - expectedCost);
    }

    function testBetChargesLmsrFee() public {
        uint256 qty = 1 ether;
        uint256 outcomeCost = (qty * PRICE) / 1e18; // 0.5 ETH
        uint256 expectedFee = (outcomeCost * 1e16) / 1e18; // 1% = 0.005 ETH
        assertGt(expectedFee, 0, "fee should be non-zero");

        vm.prank(bettor);
        mint.bet{value: 1 ether}(deprizeId, 0, qty, type(uint256).max);

        // The market pulls outcomeCost + fee (not just outcomeCost). If the router
        // under-funded by the fee, the trade would have reverted instead.
        assertEq(weth.balanceOf(address(market)), outcomeCost + expectedFee, "market gets net + fee");
    }

    function testBetUpdatesTwapBeforeTrade() public {
        assertFalse(market.twapUpdated(), "precondition");
        vm.prank(bettor);
        mint.bet{value: 1 ether}(deprizeId, 0, 1 ether, type(uint256).max);
        // The router calls updateCumulativeTWAP() (it uses trade(), not the
        // self-calling tradeWithTWAP, so it must update TWAP itself).
        assertTrue(market.twapUpdated(), "TWAP must be updated on every bet");
    }

    function testBetExactBudgetNoRefund() public {
        // Fee-free, 1:1 priced market so cost can equal budget exactly (leftover == 0).
        MockMarket m = new MockMarket(address(ctf), address(weth), 3, 1 ether);
        m.setFee(0);
        vm.prank(owner);
        mint.setMarket(deprizeId, address(m));

        uint256 value = 20 ether; // slice = 1, budget = 19
        uint256 qty = 19 ether; // cost = 19 (no fee) == budget
        uint256 balBefore = bettor.balance;

        vm.prank(bettor);
        mint.bet{value: value}(deprizeId, 0, qty, type(uint256).max);

        assertEq(weth.balanceOf(address(m)), 19 ether, "market collateral == budget");
        assertEq(address(mint).balance, 0, "no stuck ETH");
        assertEq(balBefore - bettor.balance, value, "entire value spent, nothing refunded");
        assertEq(ctf.balanceOf(bettor, _positionId(0)), qty);
    }

    function testBetSweepsResidualCollateral() public {
        // Market consumes less collateral than approved; the router must unwrap and
        // refund the remainder rather than leaving WETH stranded.
        uint256 underpull = 0.01 ether;
        market.setUnderpull(underpull);

        uint256 qty = 1 ether; // total cost (incl fee) = 0.505 ETH
        uint256 outcomeCost = (qty * PRICE) / 1e18;
        uint256 cost = outcomeCost + (outcomeCost * 1e16) / 1e18; // 0.505
        uint256 value = 1 ether;
        uint256 slice = value / 20;
        uint256 balBefore = bettor.balance;

        vm.prank(bettor);
        mint.bet{value: value}(deprizeId, 0, qty, type(uint256).max);

        // Market kept cost - underpull; router holds no WETH or ETH.
        assertEq(weth.balanceOf(address(market)), cost - underpull, "market kept net of underpull");
        assertEq(weth.balanceOf(address(mint)), 0, "residual WETH swept");
        assertEq(address(mint).balance, 0, "no stuck ETH");
        // Net spend = slice + (cost - underpull); the swept residual is refunded.
        assertEq(balBefore - bettor.balance, slice + cost - underpull, "residual refunded");
    }

    function testResidualSweepIgnoresStrayWeth() public {
        // The residual-collateral sweep must be scoped to THIS bet's own unconsumed
        // collateral, not the router's absolute WETH balance. WETH already sitting in
        // the router (a donation, dust, or balance a future upgrade/operator parked
        // there) must NOT be swept into the bettor's refund.
        address donor = address(0xD0E);
        vm.deal(donor, 1 ether);
        vm.startPrank(donor);
        weth.deposit{value: 1 ether}();
        weth.transfer(address(mint), 1 ether);
        vm.stopPrank();
        assertEq(weth.balanceOf(address(mint)), 1 ether, "router starts with stray WETH");

        uint256 qty = 1 ether; // cost (incl 1% fee) = 0.505 ETH
        uint256 value = 1 ether; // slice 0.05, budget 0.95
        uint256 outcomeCost = (qty * PRICE) / 1e18;
        uint256 cost = outcomeCost + (outcomeCost * 1e16) / 1e18; // 0.505
        uint256 slice = value / 20;
        uint256 balBefore = bettor.balance;

        vm.prank(bettor);
        mint.bet{value: value}(deprizeId, 0, qty, type(uint256).max);

        // The stray 1 WETH is untouched by the bet ...
        assertEq(weth.balanceOf(address(mint)), 1 ether, "stray WETH left in the router");
        assertEq(address(mint).balance, 0, "no stuck ETH");
        // ... and the bettor only ever pays its own slice + cost (no windfall, no loss).
        assertEq(balBefore - bettor.balance, slice + cost, "bettor pays exactly slice + cost");
        assertEq(ctf.balanceOf(bettor, _positionId(0)), qty, "outcome tokens delivered");
    }

    function testBetDeliversViaSingleTransfer() public {
        // Exercises onERC1155Received (single) instead of the batch hook.
        market.setSingleTransfer(true);
        vm.prank(bettor);
        mint.bet{value: 1 ether}(deprizeId, 0, 1 ether, type(uint256).max);
        assertEq(ctf.balanceOf(bettor, _positionId(0)), 1 ether, "single-transfer delivery");
    }

    function testBetWithNoMintedTokens() public {
        // Market mints nothing: should revert with NoOutcomeTokensReceived.
        market.setSkipMint(true);
        vm.prank(bettor);
        vm.expectRevert(DePrizeMint.NoOutcomeTokensReceived.selector);
        mint.bet{value: 1 ether}(deprizeId, 0, 1 ether, type(uint256).max);
    }

    function testBetRevertsNonPositiveCost() public {
        // qty == 0 -> calcNetCost == 0 -> NonPositiveCost.
        vm.prank(bettor);
        vm.expectRevert(DePrizeMint.NonPositiveCost.selector);
        mint.bet{value: 1 ether}(deprizeId, 0, 0, type(uint256).max);
    }

    function testBetRevertsWhenRefundFails() public {
        RevertingBettor rb = new RevertingBettor(mint);
        vm.deal(address(rb), 10 ether);
        // leftover refund to rb fails because rb has no payable receive.
        vm.expectRevert(DePrizeMint.RefundFailed.selector);
        rb.placeBet{value: 1 ether}(deprizeId, 0, 1 ether, type(uint256).max);
    }

    // -- upgradeability -----------------------------------------------------

    function testUpgradeAuthorized() public {
        DePrizeMintV2 v2 = new DePrizeMintV2();
        vm.prank(owner);
        mint.upgradeToAndCall(address(v2), "");
        assertEq(DePrizeMintV2(payable(address(mint))).version(), 2);
    }

    function testUpgradeOnlyOwner() public {
        DePrizeMintV2 v2 = new DePrizeMintV2();
        vm.prank(bettor);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", bettor));
        mint.upgradeToAndCall(address(v2), "");
    }

    function testBetOnSecondOutcome() public {
        uint256 qty = 2 ether; // cost = 1 ETH
        vm.prank(bettor);
        mint.bet{value: 2 ether}(deprizeId, 1, qty, type(uint256).max);
        assertEq(ctf.balanceOf(bettor, _positionId(1)), qty);
        assertEq(ctf.balanceOf(bettor, _positionId(0)), 0);
    }

    // -- gates / guards -----------------------------------------------------

    function testBetRevertsWhenBettingClosed() public {
        vm.prank(owner);
        registry.lock(deprizeId); // OPEN -> LOCKED, betting no longer open

        vm.prank(bettor);
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.BettingClosed.selector, deprizeId));
        mint.bet{value: 1 ether}(deprizeId, 0, 1 ether, type(uint256).max);
    }

    function testBetRevertsWhenCancellationPending() public {
        vm.prank(owner);
        registry.announceCancellation(deprizeId); // bettingOpen becomes false

        vm.prank(bettor);
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.BettingClosed.selector, deprizeId));
        mint.bet{value: 1 ether}(deprizeId, 0, 1 ether, type(uint256).max);
    }

    function testBetRevertsBadOutcomeIndex() public {
        vm.prank(bettor);
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.BadOutcomeIndex.selector, deprizeId, uint8(3)));
        mint.bet{value: 1 ether}(deprizeId, 3, 1 ether, type(uint256).max);
    }

    function testBetRevertsMaxCostExceeded() public {
        uint256 qty = 1 ether; // outcome cost 0.5 + 1% fee = 0.505 ETH total
        uint256 cap = 0.4 ether; // below total cost
        vm.prank(bettor);
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.CostTooHigh.selector, 0.505 ether, 0.95 ether, cap));
        mint.bet{value: 1 ether}(deprizeId, 0, qty, cap);
    }

    function testBetRevertsWhenCostExceedsBudget() public {
        // qty needs 0.505 ETH total cost but only 0.095 ETH budget from 0.1 ETH value.
        uint256 qty = 1 ether;
        vm.prank(bettor);
        vm.expectRevert(
            abi.encodeWithSelector(DePrizeMint.CostTooHigh.selector, 0.505 ether, 0.095 ether, type(uint256).max)
        );
        mint.bet{value: 0.1 ether}(deprizeId, 0, qty, type(uint256).max);
    }

    function testBetRevertsMarketNotSet() public {
        vm.startPrank(owner);
        uint256 other = registry.register(99, teamIds, block.timestamp + 30 days);
        registry.setCondition(other, keccak256("c2"));
        registry.open(other);
        vm.stopPrank();

        vm.prank(bettor);
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.MarketNotSet.selector, other));
        mint.bet{value: 1 ether}(other, 0, 1 ether, type(uint256).max);
    }

    // -- admin: setMarket validations --------------------------------------

    function testSetMarketRevertsOnCtfMismatch() public {
        MockCTF otherCtf = new MockCTF();
        MockMarket badMarket = new MockMarket(address(otherCtf), address(weth), 3, PRICE);
        vm.prank(owner);
        vm.expectRevert(DePrizeMint.MarketCtfMismatch.selector);
        mint.setMarket(deprizeId, address(badMarket));
    }

    function testSetMarketRevertsOnCollateralMismatch() public {
        MockWETH otherWeth = new MockWETH();
        MockMarket badMarket = new MockMarket(address(ctf), address(otherWeth), 3, PRICE);
        vm.prank(owner);
        vm.expectRevert(DePrizeMint.MarketCollateralMismatch.selector);
        mint.setMarket(deprizeId, address(badMarket));
    }

    function testSetMarketRevertsOnSlotMismatch() public {
        MockMarket badMarket = new MockMarket(address(ctf), address(weth), 2, PRICE);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.MarketSlotMismatch.selector, 2, 3));
        mint.setMarket(deprizeId, address(badMarket));
    }

    function testSetMarketRevertsOnConditionMismatch() public {
        // Valid CTF/collateral/slots, but the market settles a different condition
        // than the one the registry will resolve.
        MockMarket badMarket = new MockMarket(address(ctf), address(weth), 3, PRICE);
        bytes32 wrongCondition = keccak256("other-condition");
        badMarket.setConditionId(wrongCondition);
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                DePrizeMint.MarketConditionMismatch.selector, wrongCondition, keccak256("condition")
            )
        );
        mint.setMarket(deprizeId, address(badMarket));
    }

    function testSetMarketOnlyOwner() public {
        vm.prank(bettor);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", bettor));
        mint.setMarket(deprizeId, address(market));
    }

    function testZeroMarketReverts() public {
        vm.prank(owner);
        vm.expectRevert(DePrizeMint.ZeroMarket.selector);
        mint.setMarket(deprizeId, address(0));
    }

    // -- ERC-1155 receiver guard -------------------------------------------

    function testRejectsUnsolicitedERC1155() public {
        uint256[] memory ids = new uint256[](1);
        uint256[] memory values = new uint256[](1);
        ids[0] = 1;
        values[0] = 1;
        // Even from the configured CTF, transfers outside an active bet are rejected.
        vm.prank(address(ctf));
        vm.expectRevert(DePrizeMint.UnexpectedERC1155.selector);
        IERC1155Receiver(address(mint)).onERC1155BatchReceived(address(this), address(0), ids, values, "");
    }

    function testRejectsUnsolicitedERC1155Single() public {
        vm.prank(address(ctf));
        vm.expectRevert(DePrizeMint.UnexpectedERC1155.selector);
        IERC1155Receiver(address(mint)).onERC1155Received(address(this), address(0), 1, 1, "");
    }

    function testRejectsERC1155FromNonCtf() public {
        // A non-CTF caller is rejected even if a bet were in progress (here it isn't).
        uint256[] memory ids = new uint256[](1);
        uint256[] memory values = new uint256[](1);
        ids[0] = 1;
        values[0] = 1;
        vm.prank(address(0xDEAD));
        vm.expectRevert(DePrizeMint.UnexpectedERC1155.selector);
        IERC1155Receiver(address(mint)).onERC1155BatchReceived(address(this), address(0), ids, values, "");
    }

    function testSupportsInterface() public view {
        assertTrue(mint.supportsInterface(type(IERC1155Receiver).interfaceId), "ERC1155Receiver");
        assertTrue(mint.supportsInterface(type(IERC165).interfaceId), "ERC165");
        assertFalse(mint.supportsInterface(0xffffffff), "unknown");
    }
}

/// @notice Optional integration test against the real, already-deployed Gnosis CTF
///         + LMSRWithTWAP market on Arbitrum-Sepolia. The 0.5 prediction-market
///         contracts cannot be deployed from Foundry, so we reuse the live market
///         and only mock the Juicebox terminal (the 5% slice). Skips entirely unless
///         `DEPRIZE_FORK_RPC` is set, so CI without an RPC is unaffected.
///
/// Run with: DEPRIZE_FORK_RPC=<arb-sepolia rpc> forge test --match-contract DePrizeMintForkTest -vvv
contract DePrizeMintForkTest is Test {
    // Arbitrum-Sepolia deployments (mirror ui/const/config.ts).
    address constant WETH = 0xA441f20115c868dc66bC1977E1c17D4B9A0189c7;
    address constant CTF = 0xa0B1b14515C26acb193cb45Be5508A8A46109a27;
    address constant MARKET = 0xbd10F66098e123Aa036f7cb1E747e76bbe849eBe;

    DePrizeMint mint;
    DePrizeRegistry registry;
    MockJBTerminal terminal;

    address owner = address(0xA11CE);
    address bettor = address(0xB0B);
    uint256 deprizeId;
    uint256 slots;

    function setUp() public {
        string memory rpc = vm.envOr("DEPRIZE_FORK_RPC", string(""));
        if (bytes(rpc).length == 0) return; // not configured -> tests no-op
        vm.createSelectFork(rpc);

        slots = ILMSRWithTWAP(MARKET).atomicOutcomeSlotCount();
        require(slots >= 2, "market needs >=2 outcomes");

        terminal = new MockJBTerminal();

        DePrizeRegistry regImpl = new DePrizeRegistry();
        registry = DePrizeRegistry(
            address(new ERC1967Proxy(address(regImpl), abi.encodeCall(DePrizeRegistry.initialize, (owner))))
        );

        DePrizeMint mintImpl = new DePrizeMint();
        mint = DePrizeMint(
            payable(
                address(
                    new ERC1967Proxy(
                        address(mintImpl),
                        abi.encodeCall(DePrizeMint.initialize, (owner, address(registry), address(terminal), WETH, CTF))
                    )
                )
            )
        );

        uint256[] memory teams = new uint256[](slots);
        for (uint256 i = 0; i < slots; i++) {
            teams[i] = 100 + i;
        }

        vm.startPrank(owner);
        deprizeId = registry.register(4, teams, block.timestamp + 30 days);
        registry.setCondition(deprizeId, ILMSRWithTWAP(MARKET).conditionIds(0));
        registry.open(deprizeId);
        mint.setMarket(deprizeId, MARKET); // validates pmSystem()/collateralToken()/slots
        vm.stopPrank();

        vm.deal(bettor, 100 ether);
    }

    function _forkEnabled() internal view returns (bool) {
        return address(mint) != address(0);
    }

    function testForkBetReusesLiveMarket() public {
        if (!_forkEnabled()) return;

        uint256 qty = 0.01 ether; // small order against the live market
        int256[] memory amounts = new int256[](slots);
        amounts[0] = int256(qty);
        uint256 net = uint256(ILMSRWithTWAP(MARKET).calcNetCost(amounts));
        uint256 cost = net + ILMSRWithTWAP(MARKET).calcMarketFee(net); // fee-inclusive
        assertGt(cost, 0, "expected positive cost");

        uint256 value = cost * 2 + 1 ether; // ample for slice + cost
        uint256 expectedSlice = value / 20;
        uint256 balBefore = bettor.balance;

        // Outcome tokens are delivered to the bettor via the ERC-1155 acceptance
        // callbacks (position-id math handled inside the live CTF).
        vm.prank(bettor);
        mint.bet{value: value}(deprizeId, 0, qty, cost); // maxCost = exact quote

        // 5% routed to the (mock) Juicebox terminal.
        assertEq(terminal.lastValue(), expectedSlice, "slice");
        assertEq(terminal.lastBeneficiary(), bettor, "beneficiary");

        // Net spend is slice + cost; the rest refunded. No funds stuck.
        assertEq(balBefore - bettor.balance, expectedSlice + cost, "net spend");
        assertEq(address(mint).balance, 0, "no stuck ETH");
        assertEq(IWETH(WETH).balanceOf(address(mint)), 0, "no stuck WETH");
    }

    function testForkMaxCostGuard() public {
        if (!_forkEnabled()) return;

        uint256 qty = 0.01 ether;
        int256[] memory amounts = new int256[](slots);
        amounts[0] = int256(qty);
        uint256 net = uint256(ILMSRWithTWAP(MARKET).calcNetCost(amounts));
        uint256 cost = net + ILMSRWithTWAP(MARKET).calcMarketFee(net); // fee-inclusive

        uint256 value = cost * 2 + 1 ether;
        uint256 cap = cost - 1; // just below the quote
        vm.prank(bettor);
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.CostTooHigh.selector, cost, value - value / 20, cap));
        mint.bet{value: value}(deprizeId, 0, qty, cap);
    }

    function testForkBettingClosedGate() public {
        if (!_forkEnabled()) return;
        vm.prank(owner);
        registry.lock(deprizeId);
        vm.prank(bettor);
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.BettingClosed.selector, deprizeId));
        mint.bet{value: 1 ether}(deprizeId, 0, 0.01 ether, type(uint256).max);
    }
}
