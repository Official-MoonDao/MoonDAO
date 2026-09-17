// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

import {DePrizeMint} from "../../src/deprize/DePrizeMint.sol";
import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";
import {MockJBTerminal, MockWETH, MockResolvingCTF, MockLMSR} from "./DePrizeMocks.sol";

/// @dev Fuzz handler: random actors bet through the mint, sell directly on the
///      market, and the owner rotates the permit signer. Tracks ground truth so
///      the invariants can compare against the mocks' observable state.
contract MintHandler is Test {
    uint256 internal constant SIGNER_PK = uint256(keccak256("invariant-signer"));

    DePrizeMint public mint;
    DePrizeRegistry public registry;
    MockJBTerminal public terminal;
    MockWETH public weth;
    MockResolvingCTF public ctf;
    MockLMSR public market;
    address public owner;
    uint256 public deprizeId;

    address[] public actors;
    uint256 public ghostSlices;
    uint256 public ghostCostPaid;
    uint256 public ghostSellProceeds;
    uint256 public ghostFees;
    uint256 public ghostTokensBought;
    uint256 public ghostTokensSold;
    uint256 public bets;
    uint256 public sells;
    uint256 public rejected;

    constructor(
        DePrizeMint mint_,
        DePrizeRegistry registry_,
        MockJBTerminal terminal_,
        MockWETH weth_,
        MockResolvingCTF ctf_,
        MockLMSR market_,
        address owner_,
        uint256 deprizeId_
    ) {
        mint = mint_;
        registry = registry_;
        terminal = terminal_;
        weth = weth_;
        ctf = ctf_;
        market = market_;
        owner = owner_;
        deprizeId = deprizeId_;
        for (uint256 i = 0; i < 4; i++) {
            address a = address(uint160(0xA000 + i));
            actors.push(a);
            vm.deal(a, 1_000 ether);
        }
        vm.prank(owner);
        mint.setComplianceSigner(vm.addr(SIGNER_PK));
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function _permit(address wallet) internal view returns (uint256 deadline, bytes memory sig) {
        deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PK, mint.hashPermit(wallet, deprizeId, deadline));
        sig = abi.encodePacked(r, s, v);
    }

    function bet(uint256 actorSeed, uint96 qtyRaw, uint8 slot, uint96 extraRaw) external {
        address who = _actor(actorSeed);
        uint256 qty = bound(uint256(qtyRaw), 1e12, 20 ether);
        uint256 outcome = uint256(slot) % 3;
        uint256 net = (qty * market.price()) / 1e18;
        uint256 cost = net + market.calcMarketFee(net);
        uint256 value = (cost * 20 + 18) / 19 + bound(uint256(extraRaw), 0, 5 ether);
        if (who.balance < value) return;
        (uint256 deadline, bytes memory sig) = _permit(who);
        vm.prank(who);
        try mint.bet{value: value}(deprizeId, outcome, qty, type(uint256).max, deadline, sig) {
            ghostSlices += value / 20;
            ghostCostPaid += cost;
            ghostFees += cost - net;
            ghostTokensBought += qty;
            bets++;
        } catch {
            rejected++;
        }
    }

    function sell(uint256 actorSeed, uint8 slot, uint96 fracRaw) external {
        address who = _actor(actorSeed);
        uint256 outcome = uint256(slot) % 3;
        uint256 held = ctf.balanceOf(who, market.positionId(outcome));
        if (held == 0) return;
        uint256 amount = bound(uint256(fracRaw), 1, held);
        uint256 gross = (amount * market.price()) / 1e18;
        if (gross == 0) return;
        uint256 f = market.calcMarketFee(gross);
        if (weth.balanceOf(address(market)) < gross - f) return;

        int256[] memory amounts = new int256[](3);
        amounts[outcome] = -int256(amount);
        vm.startPrank(who);
        ctf.setApprovalForAll(address(market), true);
        try market.trade(amounts, 0) {
            ghostSellProceeds += gross - f;
            ghostFees += f;
            ghostTokensSold += amount;
            sells++;
        } catch {
            rejected++;
        }
        vm.stopPrank();
    }

    function rotateSigner(uint256 seed) external {
        // Rotating away and back must never strand anything.
        vm.startPrank(owner);
        mint.setComplianceSigner(address(uint160(seed)));
        mint.setComplianceSigner(vm.addr(SIGNER_PK));
        vm.stopPrank();
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }
}

contract DePrizeMintInvariantTest is Test {
    DePrizeMint mint;
    DePrizeRegistry registry;
    MockJBTerminal terminal;
    MockWETH weth;
    MockResolvingCTF ctf;
    MockLMSR market;
    MintHandler handler;

    address owner = address(0xA11CE);
    address oracle = address(0x5AFE);
    uint256 deprizeId;

    function setUp() public {
        registry = new DePrizeRegistry(owner);
        terminal = new MockJBTerminal();
        weth = new MockWETH();
        ctf = new MockResolvingCTF(address(weth));
        ctf.prepareCondition(oracle, keccak256("inv"), 3);
        bytes32 cond = ctf.getConditionId(oracle, keccak256("inv"), 3);
        market = new MockLMSR(address(ctf), address(weth), 3, 0.25 ether, cond);
        mint = new DePrizeMint(owner, address(registry), address(terminal), address(weth), address(ctf));

        uint256[] memory teams = new uint256[](3);
        teams[0] = 1;
        teams[1] = 2;
        teams[2] = 3;
        vm.startPrank(owner);
        deprizeId = registry.register(7, teams, block.timestamp + 365 days);
        registry.setCondition(deprizeId, cond);
        registry.open(deprizeId);
        mint.setMarket(deprizeId, address(market));
        vm.stopPrank();

        handler = new MintHandler(mint, registry, terminal, weth, ctf, market, owner, deprizeId);

        targetContract(address(handler));
        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = MintHandler.bet.selector;
        selectors[1] = MintHandler.sell.selector;
        selectors[2] = MintHandler.rotateSigner.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    /// @dev The router is a pass-through: it never holds ETH, WETH, allowance or tokens.
    function invariant_mintHoldsNothing() public view {
        assertEq(address(mint).balance, 0, "mint ETH");
        assertEq(weth.balanceOf(address(mint)), 0, "mint WETH");
        assertEq(weth.allowance(address(mint), address(market)), 0, "mint allowance");
        for (uint256 i = 0; i < 3; i++) {
            assertEq(ctf.balanceOf(address(mint), market.positionId(i)), 0, "mint tokens");
        }
    }

    /// @dev Every wei of prize slice landed in Juicebox, nowhere else.
    function invariant_slicesReachJuicebox() public view {
        assertEq(terminal.totalReceived(), handler.ghostSlices(), "JB received == sum of slices");
        assertEq(address(terminal).balance, handler.ghostSlices(), "JB balance == slices");
    }

    /// @dev Market collateral == what buyers paid in minus what sellers took out.
    ///      With a real CTF the trade principal is escrowed and only fees remain
    ///      standalone; the mock keeps principal in the market, so the identity is
    ///      the full flow. The property H-01 broke was collateral appearing from
    ///      nowhere: here it can only come from recorded bets.
    function invariant_marketCollateralIsAccountedFor() public view {
        assertEq(
            weth.balanceOf(address(market)),
            handler.ghostCostPaid() - handler.ghostSellProceeds(),
            "market WETH == bets in - sells out"
        );
        assertEq(market.accruedFees(), handler.ghostFees(), "fees tracked exactly");
    }

    /// @dev No actor can end up with tokens the market never issued; sold
    ///      tokens sit in the market's inventory.
    function invariant_tokenSupplyMatchesMarketIssuance() public view {
        uint256 n = handler.actorCount();
        uint256 held;
        for (uint256 i = 0; i < n; i++) {
            address a = handler.actors(i);
            for (uint256 s = 0; s < 3; s++) {
                held += ctf.balanceOf(a, market.positionId(s));
            }
        }
        uint256 marketHeld;
        for (uint256 s = 0; s < 3; s++) {
            marketHeld += ctf.balanceOf(address(market), market.positionId(s));
        }
        assertEq(held, handler.ghostTokensBought() - handler.ghostTokensSold(), "actors hold bought - sold");
        assertEq(marketHeld, handler.ghostTokensSold(), "market inventory == sold back");
    }
}
