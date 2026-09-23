// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "std/Script.sol";
import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";
import {DePrizeMint} from "../../src/deprize/DePrizeMint.sol";
import {ILMSRMarketMaker} from "../../src/deprize/interfaces/ILMSRMarketMaker.sol";
import {IConditionalTokens} from "../../src/deprize/interfaces/IConditionalTokens.sol";
import {LaunchPadPayHook} from "../../src/LaunchPadPayHook.sol";
import "base/Config.sol";

/// @title DePrizeVerify
/// @notice Read-only "verify before announcing" checklist for a v2 DePrize.
///         Reverts on the first mismatch so a successful run is a green launch gate.
///
/// Env: DEPRIZE_REGISTRY DEPRIZE_MINT DEPRIZE_ID DEPRIZE_MARKET DEPRIZE_OWNER (the Safe)
///      DEPRIZE_PAYHOOK (required — cashOut latch)
///      DEPRIZE_JB_PROJECT (optional; falls back to registry jbProjectId)
contract DePrizeVerify is Script, Config {
    function run() external {
        DePrizeRegistry registry = DePrizeRegistry(vm.envAddress("DEPRIZE_REGISTRY"));
        DePrizeMint mint = DePrizeMint(vm.envAddress("DEPRIZE_MINT"));
        uint256 id = vm.envUint("DEPRIZE_ID");
        address market = vm.envAddress("DEPRIZE_MARKET");
        address safe = vm.envAddress("DEPRIZE_OWNER");

        IDePrizeRegistry.DePrize memory d = registry.getDePrize(id);
        IDePrizeRegistry.DePrizeState st = registry.state(id);

        _ok("registry.state == OPEN", st == IDePrizeRegistry.DePrizeState.OPEN);
        _ok("registry.bettingOpen", registry.bettingOpen(id));
        _ok("not terminal", !registry.isTerminal(id));
        _ok("not refundable", !registry.isRefundable(id));

        uint256 jb = vm.envOr("DEPRIZE_JB_PROJECT", d.jbProjectId);
        _ok("deprizeIdByJBProject", registry.deprizeIdByJBProject(jb) == id);
        _ok("jbProjectId matches", d.jbProjectId == jb);

        // Authority: every owner is the Safe, nothing answers to an EOA or a contract.
        _ok("registry.owner == Safe", registry.owner() == safe);
        _ok("registry.pendingOwner == 0", registry.pendingOwner() == address(0));
        _ok("mint.owner == Safe", mint.owner() == safe);
        _ok("mint.pendingOwner == 0", mint.pendingOwner() == address(0));
        _ok("lmsr.owner == Safe", ILMSRMarketMaker(market).owner() == safe);

        _ok("mint.marketOf == lmsr", mint.marketOf(id) == market);
        _ok("mint.complianceSigner set", mint.complianceSigner() != address(0));
        _ok("mint.registry == registry", address(mint.registry()) == address(registry));
        _ok("lmsr.stage == Running (0)", ILMSRMarketMaker(market).stage() == 0);
        _ok("lmsr.fee == 1e16", ILMSRMarketMaker(market).fee() == 1e16);

        bytes32 cond = ILMSRMarketMaker(market).conditionIds(0);
        _ok("market condition == registry", cond == d.ctfConditionId);
        IConditionalTokens ctf = IConditionalTokens(ILMSRMarketMaker(market).pmSystem());
        _ok("condition unresolved (payoutDenominator==0)", ctf.payoutDenominator(cond) == 0);
        _ok("condition slots == roster", ctf.getOutcomeSlotCount(cond) == d.teamIds.length);

        (address weth, address ctfCfg) = requireDePrizeCollateral(block.chainid);
        _ok("market collateral == configured WETH", ILMSRMarketMaker(market).collateralToken() == weth);
        _ok("market pmSystem == configured CTF", address(ctf) == ctfCfg);
        _ok("mint.weth == configured WETH", address(mint.weth()) == weth);
        _ok("mint.ctf == configured CTF", address(mint.ctf()) == ctfCfg);

        // v2 has no TWAP subclass and no fee router: the market must be stock Gnosis.
        (bool hasTwap,) = market.staticcall(abi.encodeWithSignature("getTWAP()"));
        _ok("market has no getTWAP (stock LMSRMarketMaker)", !hasTwap);

        address payHook = vm.envAddress("DEPRIZE_PAYHOOK");
        require(payHook != address(0), "DEPRIZE_PAYHOOK required (cashOut latch)");
        _ok("payHook.deprizeRegistry == registry", address(LaunchPadPayHook(payHook).deprizeRegistry()) == address(registry));
        _ok("payHook.stage == 1 (cashOut locked)", LaunchPadPayHook(payHook).stage(JB_V5_MULTI_TERMINAL, jb) == 1);

        console.log("DePrizeVerify: all asserted checks passed.");
    }

    function _ok(string memory label, bool pass) internal pure {
        require(pass, label);
    }
}
