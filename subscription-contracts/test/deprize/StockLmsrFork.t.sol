// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// `std/` (not `forge-std/`) so Test and Config share one forge-std source unit.
import "std/Test.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {Config} from "base/Config.sol";

import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";
import {DePrizeMint} from "../../src/deprize/DePrizeMint.sol";
import {DePrizeRedeem} from "../../src/deprize/DePrizeRedeem.sol";
import {IConditionalTokens} from "../../src/deprize/interfaces/IConditionalTokens.sol";
import {ILMSRMarketMaker} from "../../src/deprize/interfaces/ILMSRMarketMaker.sol";
import {IWETH} from "../../src/deprize/interfaces/IWETH.sol";
import {DePrizeResolve} from "../../script/deprize/DePrizeResolve.s.sol";
import {DePrizeSweepFees} from "../../script/deprize/DePrizeSweepFees.s.sol";
import {MockJBTerminal} from "./DePrizeMocks.sol";

/// @dev 0.8 view of the stock Gnosis LMSRMarketMakerFactory (0.5.1).
interface ILMSRMarketMakerFactory {
    function createLMSRMarketMaker(
        address pmSystem,
        address collateralToken,
        bytes32[] calldata conditionIds,
        uint64 fee,
        address whitelist,
        uint256 funding
    ) external returns (address lmsrMarketMaker);
}

/// @title StockLmsrFork
/// @notice The v2 glue against REAL Gnosis bytecode: the live ConditionalTokens and
///         WETH on the forked chain, plus a stock `LMSRMarketMakerFactory` deployed
///         from the committed 0.5.1 creation bytecode (fixtures/gnosis). Proves:
///           - bets through DePrizeMint settle exactly (no residual collateral);
///           - the market has no TWAP surface;
///           - the Safe (this test) owns the market and can pause/close/withdrawFees;
///           - the fee-sweep planner matches what withdrawFees actually moves;
///           - the close-out loop conserves ETH to the wei.
///
///         Runs when the chain is a fork with the configured CTF deployed
///         (CI: `forge test --fork-url 127.0.0.1:8545`), or when DEPRIZE_FORK_RPC
///         is set. Otherwise every test is a no-op.
contract StockLmsrForkTest is Test, Config {
    IConditionalTokens ctf;
    IWETH weth;
    ILMSRMarketMakerFactory factory;
    DePrizeRegistry registry;
    DePrizeMint mint;
    DePrizeRedeem redeem;
    MockJBTerminal terminal;
    DePrizeResolve resolveScript;
    DePrizeSweepFees sweepPlanner;

    // This test contract is both the admin Safe and the CTF oracle.
    address owner = address(this);
    address alice = address(0xA11A);
    address bob = address(0xB0B);

    uint256 constant SLOTS = 3;
    uint64 constant FEE = 1e16;
    uint256 internal constant COMPLIANCE_PK = uint256(keccak256("deprize-compliance-signer"));
    bool enabled;

    function setUp() public {
        string memory rpc = vm.envOr("DEPRIZE_FORK_RPC", string(""));
        if (bytes(rpc).length != 0) vm.createSelectFork(rpc);

        address ctfAddr = CONDITIONAL_TOKENS_ADDRESSES[block.chainid];
        address wethAddr = WETH_ADDRESSES[block.chainid];
        if (ctfAddr == address(0) || ctfAddr.code.length == 0 || wethAddr.code.length == 0) return;
        enabled = true;

        ctf = IConditionalTokens(ctfAddr);
        weth = IWETH(wethAddr);
        factory = ILMSRMarketMakerFactory(_deployStockFactory());

        registry = new DePrizeRegistry(owner);
        terminal = new MockJBTerminal();
        mint = new DePrizeMint(owner, address(registry), address(terminal), wethAddr, ctfAddr);
        redeem = new DePrizeRedeem(address(registry), ctfAddr, wethAddr);
        // Deterministic test addresses can already hold ETH on a fork; zero them so
        // the "holds nothing" invariants measure only what the flow leaves behind.
        vm.deal(address(redeem), 0);
        vm.deal(address(mint), 0);
        resolveScript = new DePrizeResolve();
        sweepPlanner = new DePrizeSweepFees();
        mint.setComplianceSigner(vm.addr(COMPLIANCE_PK));

        vm.deal(address(this), 1000 ether);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    // ---------------------------------------------------------------------
    // Stock factory from committed 0.5.1 bytecode
    // ---------------------------------------------------------------------

    function _deployStockFactory() internal returns (address f) {
        bytes memory libCode = vm.parseBytes(_trim(vm.readFile("test/deprize/fixtures/gnosis/Fixed192x64Math.bin")));
        address lib = _create(libCode);
        string memory linked = _link(
            _trim(vm.readFile("test/deprize/fixtures/gnosis/LMSRMarketMakerFactory.bin")),
            "__Fixed192x64Math_______________________",
            lib
        );
        f = _create(vm.parseBytes(linked));
        require(f.code.length > 0, "factory deploy failed");
    }

    function _create(bytes memory code) internal returns (address addr) {
        assembly {
            addr := create(0, add(code, 0x20), mload(code))
        }
        require(addr != address(0), "create failed");
    }

    /// @dev Replace every 40-char truffle link placeholder with the library address.
    function _link(string memory hexCode, string memory placeholder, address lib) internal pure returns (string memory) {
        bytes memory code = bytes(hexCode);
        bytes memory ph = bytes(placeholder);
        bytes memory addrHex = bytes(_toHexNoPrefix(lib));
        require(ph.length == 40 && addrHex.length == 40, "placeholder width");
        for (uint256 i = 0; i + 40 <= code.length; i++) {
            bool match_ = true;
            for (uint256 j = 0; j < 40; j++) {
                if (code[i + j] != ph[j]) {
                    match_ = false;
                    break;
                }
            }
            if (match_) {
                for (uint256 j = 0; j < 40; j++) {
                    code[i + j] = addrHex[j];
                }
                i += 39;
            }
        }
        return string(code);
    }

    function _toHexNoPrefix(address a) internal pure returns (string memory) {
        bytes16 symbols = "0123456789abcdef";
        bytes memory out = new bytes(40);
        uint160 v = uint160(a);
        for (uint256 i = 0; i < 20; i++) {
            uint8 b = uint8(v >> (8 * (19 - i)));
            out[2 * i] = symbols[b >> 4];
            out[2 * i + 1] = symbols[b & 0x0f];
        }
        return string(out);
    }

    function _trim(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        uint256 end = b.length;
        while (end > 0 && (b[end - 1] == 0x0a || b[end - 1] == 0x0d || b[end - 1] == 0x20)) end--;
        bytes memory out = new bytes(end);
        for (uint256 i = 0; i < end; i++) out[i] = b[i];
        return string(out);
    }

    // ---------------------------------------------------------------------
    // Provisioning helpers (mirror prediction/migrations/08 + DePrizeWire)
    // ---------------------------------------------------------------------

    function _provision(bytes32 salt, uint256 funding)
        internal
        returns (uint256 deprizeId, bytes32 questionId, bytes32 conditionId, address market)
    {
        questionId = keccak256(abi.encode("deprize-v2-fork", salt, block.number, address(this)));
        ctf.prepareCondition(owner, questionId, SLOTS);
        conditionId = ctf.getConditionId(owner, questionId, SLOTS);

        weth.deposit{value: funding}();
        weth.approve(address(factory), funding);
        bytes32[] memory conds = new bytes32[](1);
        conds[0] = conditionId;
        market = factory.createLMSRMarketMaker(address(ctf), address(weth), conds, FEE, address(0), funding);
        assertEq(ILMSRMarketMaker(market).owner(), owner, "factory hands the market to the creator (the Safe)");

        uint256[] memory teams = new uint256[](SLOTS);
        for (uint256 i = 0; i < SLOTS; i++) teams[i] = 100 + i;
        deprizeId = registry.register(uint256(keccak256(abi.encode(salt))) % 1e9 + 1, teams, block.timestamp + 30 days);
        registry.setCondition(deprizeId, conditionId);
        mint.setMarket(deprizeId, market);
        registry.open(deprizeId);
    }

    function _permit(DePrizeMint m, address wallet, uint256 deprizeId)
        internal
        view
        returns (uint256 deadline, bytes memory signature)
    {
        deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(COMPLIANCE_PK, m.hashPermit(wallet, deprizeId, deadline));
        signature = abi.encodePacked(r, s, v);
    }

    function _positionId(bytes32 conditionId, uint256 slot) internal view returns (uint256) {
        return ctf.getPositionId(address(weth), ctf.getCollectionId(bytes32(0), conditionId, 1 << slot));
    }

    function _betVia(address market, uint256 deprizeId, address bettor, uint256 slot, uint256 qty)
        internal
        returns (uint256 spent, uint256 cost)
    {
        int256[] memory amounts = new int256[](SLOTS);
        amounts[slot] = int256(qty);
        uint256 net = uint256(ILMSRMarketMaker(market).calcNetCost(amounts));
        cost = net + ILMSRMarketMaker(market).calcMarketFee(net);
        uint256 value = cost * 2 + 1 ether;
        uint256 before = bettor.balance;
        (uint256 deadline, bytes memory sig) = _permit(mint, bettor, deprizeId);
        vm.prank(bettor);
        mint.bet{value: value}(deprizeId, slot, qty, cost, deadline, sig);
        spent = before - bettor.balance;
    }

    function _redeemAs(address account, uint256 deprizeId) internal returns (uint256 payout) {
        vm.startPrank(account);
        ctf.setApprovalForAll(address(redeem), true);
        uint256 before = account.balance;
        redeem.redeem(deprizeId);
        payout = account.balance - before;
        vm.stopPrank();
    }

    // Accept ERC-1155 (market close pushes inventory to the owner).
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

    receive() external payable {}

    // ---------------------------------------------------------------------
    // Tests
    // ---------------------------------------------------------------------

    function testForkMarketIsStockGnosisWithNoTwapSurface() public {
        if (!enabled) return;
        (,,, address market) = _provision("surface", 1 ether);
        assertEq(ILMSRMarketMaker(market).fee(), FEE);
        assertEq(ILMSRMarketMaker(market).atomicOutcomeSlotCount(), SLOTS);
        assertEq(ILMSRMarketMaker(market).pmSystem(), address(ctf));
        assertEq(ILMSRMarketMaker(market).collateralToken(), address(weth));
        assertEq(ILMSRMarketMaker(market).stage(), 0);

        (bool ok1,) = market.staticcall(abi.encodeWithSignature("getTWAP()"));
        (bool ok2,) = market.call(abi.encodeWithSignature("updateCumulativeTWAP()"));
        int256[] memory zero = new int256[](SLOTS);
        (bool ok3,) = market.call(abi.encodeWithSignature("tradeWithTWAP(int256[],int256)", zero, int256(0)));
        (bool ok4,) = market.staticcall(abi.encodeWithSignature("cumulativeProbabilities(uint256)", 0));
        assertFalse(ok1 || ok2 || ok3 || ok4, "no TWAP surface on a stock LMSRMarketMaker");
    }

    function testForkBetSettlesExactlyAgainstRealCtf() public {
        if (!enabled) return;
        (uint256 deprizeId,, bytes32 conditionId, address market) = _provision("bet", 3 ether);

        uint256 marketWethBefore = weth.balanceOf(market);
        (uint256 spent, uint256 cost) = _betVia(market, deprizeId, alice, 1, 0.5 ether);

        assertEq(ctf.balanceOf(alice, _positionId(conditionId, 1)), 0.5 ether, "alice holds exactly qty");
        assertEq(ctf.balanceOf(alice, _positionId(conditionId, 0)), 0);
        assertEq(terminal.totalReceived(), spent - cost, "5% slice reached Juicebox");
        assertEq(spent, terminal.lastValue() + cost, "bettor paid slice + fee-inclusive cost, nothing more");

        // Only the 1% fee stays standalone in the market; principal is escrowed in the CTF.
        uint256 feePortion = weth.balanceOf(market) - marketWethBefore;
        assertEq(feePortion, ILMSRMarketMaker(market).calcMarketFee(cost - feePortion), "standalone WETH == fee");

        assertEq(address(mint).balance, 0, "mint holds no ETH");
        assertEq(weth.balanceOf(address(mint)), 0, "mint holds no WETH");
        assertEq(weth.allowance(address(mint), market), 0, "no dangling allowance");
        for (uint256 i = 0; i < SLOTS; i++) {
            assertEq(ctf.balanceOf(address(mint), _positionId(conditionId, i)), 0, "mint holds no tokens");
        }
    }

    function testForkHoldersCanSellDirectlyOnTheMarket() public {
        if (!enabled) return;
        (uint256 deprizeId,, bytes32 conditionId, address market) = _provision("sell", 3 ether);
        _betVia(market, deprizeId, alice, 0, 1 ether);

        int256[] memory sell = new int256[](SLOTS);
        sell[0] = -0.4 ether;
        uint256 wethBefore = weth.balanceOf(alice);
        vm.startPrank(alice);
        ctf.setApprovalForAll(market, true);
        // Gnosis semantics: collateralLimit 0 == no limit; a negative limit is the
        // minimum proceeds (netCost <= limit). type(int256).min would revert.
        ILMSRMarketMaker(market).trade(sell, 0);
        vm.stopPrank();
        assertEq(ctf.balanceOf(alice, _positionId(conditionId, 0)), 0.6 ether, "partial exit");
        assertGt(weth.balanceOf(alice) - wethBefore, 0, "paid for the exit");
    }

    function testForkSafeOwnsMarketAndSweepPlannerMatchesWithdrawFees() public {
        if (!enabled) return;
        (uint256 deprizeId,,, address market) = _provision("sweep", 3 ether);
        _betVia(market, deprizeId, alice, 1, 0.5 ether);
        _betVia(market, deprizeId, bob, 0, 0.25 ether);

        DePrizeSweepFees.Plan memory p =
            sweepPlanner.plan(registry, ILMSRMarketMaker(market), weth, deprizeId, owner);
        assertTrue(p.toPrizePool, "live DePrize routes fees to the pool");
        assertGt(p.amount, 0, "fees accrued");

        uint256 before = weth.balanceOf(owner);
        (bool ok, bytes memory ret) = market.call(p.withdrawFeesCall);
        assertTrue(ok);
        assertEq(abi.decode(ret, (uint256)), p.amount, "withdrawFees moved exactly the planned amount");
        assertEq(weth.balanceOf(owner) - before, p.amount);
        assertEq(weth.balanceOf(market), 0, "nothing standalone left; principal stays escrowed in the CTF");

        // A stranger cannot sweep: the Safe is the only owner.
        vm.prank(alice);
        (bool strangerOk,) = market.call(p.withdrawFeesCall);
        assertFalse(strangerOk, "withdrawFees is onlyOwner");
    }

    function testForkFullCloseOutLoopConservesEth() public {
        if (!enabled) return;
        uint256 funding = 3 ether;
        // Measure before provisioning so the funding split into the CTF is part of the identity.
        uint256 ctfWethBefore = weth.balanceOf(address(ctf));
        uint256 safeWethBefore = weth.balanceOf(owner);
        (uint256 deprizeId, bytes32 questionId, bytes32 conditionId, address market) = _provision("loop", funding);

        (uint256 aliceSpend,) = _betVia(market, deprizeId, alice, 1, 0.5 ether); // winner slot
        (uint256 bobSpend,) = _betVia(market, deprizeId, bob, 0, 0.3 ether); // loser slot

        // Close-out runbook, all from the Safe: lock -> pause -> settle -> resolve preflight
        // -> report -> close -> withdrawFees -> recover inventory.
        registry.lock(deprizeId);
        ILMSRMarketMaker(market).pause();
        registry.settleWinner(deprizeId, 101);

        (bytes32 cid, uint256[] memory payouts, bytes memory reportCall) =
            resolveScript.buildReport(registry, ctf, deprizeId, questionId, owner);
        assertEq(cid, conditionId);
        resolveScript.assertMarketHalted(ILMSRMarketMaker(market), conditionId);
        assertEq(payouts[1], 1);
        (bool reported,) = address(ctf).call(reportCall);
        assertTrue(reported, "Safe submits reportPayouts as the oracle");

        ILMSRMarketMaker(market).close();
        uint256 fees = ILMSRMarketMaker(market).withdrawFees();
        assertGt(fees, 0, "1% fees accrued");
        assertEq(weth.balanceOf(market), 0, "market drained");

        uint256[] memory indexSets = new uint256[](SLOTS);
        for (uint256 i = 0; i < SLOTS; i++) indexSets[i] = 1 << i;
        ctf.redeemPositions(address(weth), bytes32(0), conditionId, indexSets);
        uint256 safeRecovered = weth.balanceOf(owner) - safeWethBefore;

        uint256 alicePayout = _redeemAs(alice, deprizeId);
        uint256 bobPayout = _redeemAs(bob, deprizeId);
        assertGt(alicePayout, 0, "winner paid");
        assertEq(bobPayout, 0, "loser paid 0");
        assertEq(ctf.balanceOf(bob, _positionId(conditionId, 0)), 0, "loser tokens burned");

        uint256 ctfLocked = weth.balanceOf(address(ctf)) - ctfWethBefore;
        assertEq(
            aliceSpend + bobSpend + funding,
            terminal.totalReceived() + alicePayout + bobPayout + safeRecovered + ctfLocked,
            "ETH conservation to the wei"
        );
        assertEq(address(redeem).balance, 0);
        assertEq(weth.balanceOf(address(redeem)), 0);
        assertEq(address(mint).balance, 0);
        assertEq(weth.balanceOf(address(mint)), 0);
    }
}
