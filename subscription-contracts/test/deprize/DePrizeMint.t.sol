// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

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

    constructor(address _ctf, address _weth, uint256 _slots, uint256 _price) {
        ctf = _ctf;
        weth = _weth;
        slots = _slots;
        price = _price;
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

    function fee() external pure returns (uint64) {
        return 1e16;
    }

    function stage() external pure returns (uint8) {
        return 0;
    }

    function calcMarginalPrice(uint8) external view returns (uint256) {
        return price;
    }

    function calcNetCost(int256[] memory amounts) public view returns (int256 cost) {
        for (uint256 i = 0; i < amounts.length; i++) {
            cost += (amounts[i] * int256(price)) / 1e18;
        }
    }

    function trade(int256[] memory amounts, int256 collateralLimit) public returns (int256) {
        return _trade(amounts, collateralLimit);
    }

    function tradeWithTWAP(int256[] memory amounts, int256 collateralLimit) external {
        _trade(amounts, collateralLimit);
    }

    function _trade(int256[] memory amounts, int256 collateralLimit) internal returns (int256 cost) {
        cost = calcNetCost(amounts);
        require(cost <= collateralLimit, "limit");
        require(cost >= 0, "negative");
        MockWETH(payable(weth)).transferFrom(msg.sender, address(this), uint256(cost));

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
        MockCTF(ctf).mintTo(msg.sender, ids, values);
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
            address(
                new ERC1967Proxy(
                    address(mintImpl),
                    abi.encodeCall(
                        DePrizeMint.initialize,
                        (owner, address(registry), address(terminal), address(weth), address(ctf))
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
        uint256 qty = 1 ether; // buy 1 outcome token, cost = 0.5 ETH
        uint256 value = 1 ether; // slice = 0.05, budget = 0.95
        uint256 expectedSlice = value / 20;
        uint256 expectedCost = (qty * PRICE) / 1e18; // 0.5 ETH
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
        uint256 qty = 1 ether; // cost = 0.5 ETH
        uint256 cap = 0.4 ether; // below cost
        vm.prank(bettor);
        vm.expectRevert(abi.encodeWithSelector(DePrizeMint.CostTooHigh.selector, 0.5 ether, 0.95 ether, cap));
        mint.bet{value: 1 ether}(deprizeId, 0, qty, cap);
    }

    function testBetRevertsWhenCostExceedsBudget() public {
        // qty needs 0.5 ETH cost but only ~0.095 ETH budget from 0.1 ETH value.
        uint256 qty = 1 ether;
        vm.prank(bettor);
        vm.expectRevert(
            abi.encodeWithSelector(DePrizeMint.CostTooHigh.selector, 0.5 ether, 0.095 ether, type(uint256).max)
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

    function testSupportsInterface() public view {
        assertTrue(mint.supportsInterface(type(IERC1155Receiver).interfaceId));
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
            address(
                new ERC1967Proxy(
                    address(mintImpl),
                    abi.encodeCall(DePrizeMint.initialize, (owner, address(registry), address(terminal), WETH, CTF))
                )
            )
        );

        uint256[] memory teams = new uint256[](slots);
        for (uint256 i = 0; i < slots; i++) {
            teams[i] = 100 + i;
        }

        vm.startPrank(owner);
        deprizeId = registry.register(4, teams, block.timestamp + 30 days);
        registry.setCondition(deprizeId, keccak256("fork-condition"));
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
        uint256 cost = uint256(ILMSRWithTWAP(MARKET).calcNetCost(amounts));
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
        uint256 cost = uint256(ILMSRWithTWAP(MARKET).calcNetCost(amounts));

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
