// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "std/Script.sol";
import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";
import {DePrizeMint} from "../../src/deprize/DePrizeMint.sol";
import {DePrizeFeeRouter} from "../../src/deprize/DePrizeFeeRouter.sol";
import {ILMSRWithTWAP} from "../../src/deprize/interfaces/ILMSRWithTWAP.sol";
import {IConditionalTokens} from "../../src/deprize/interfaces/IConditionalTokens.sol";
import {LaunchPadPayHook} from "../../src/LaunchPadPayHook.sol";
import "base/Config.sol";

/// @title DePrizeVerify
/// @notice Read-only Phase 5 "verify before announcing" checklist
///         (docs/DEPRIZE_ARBITRUM_LAUNCH.md). Reverts on the first mismatch so
///         a reviewer can treat a successful run as a green launch gate.
///
/// AUDIT[plan Phase 5 verify]: mirrors DEPRIZE_QA.md section B.
///
/// Env: DEPRIZE_REGISTRY DEPRIZE_MINT DEPRIZE_FEE_ROUTER DEPRIZE_ID
///      DEPRIZE_MARKET DEPRIZE_PAYHOOK (optional) DEPRIZE_JB_PROJECT (optional)
contract DePrizeVerify is Script, Config {
    function run() external {
        DePrizeRegistry registry = DePrizeRegistry(vm.envAddress("DEPRIZE_REGISTRY"));
        DePrizeMint mint = DePrizeMint(payable(vm.envAddress("DEPRIZE_MINT")));
        DePrizeFeeRouter feeRouter = DePrizeFeeRouter(payable(vm.envAddress("DEPRIZE_FEE_ROUTER")));
        uint256 id = vm.envUint("DEPRIZE_ID");
        address market = vm.envAddress("DEPRIZE_MARKET");

        IDePrizeRegistry.DePrize memory d = registry.getDePrize(id);
        IDePrizeRegistry.DePrizeState st = registry.state(id);

        _ok("registry.state == OPEN", uint256(st) == uint256(IDePrizeRegistry.DePrizeState.OPEN));
        _ok("registry.bettingOpen", registry.bettingOpen(id));
        _ok("not terminal", !registry.isTerminal(id));
        _ok("not refundable", !registry.isRefundable(id));

        uint256 jb = vm.envOr("DEPRIZE_JB_PROJECT", d.jbProjectId);
        _ok("deprizeIdByJBProject", registry.deprizeIdByJBProject(jb) == id);
        _ok("jbProjectId matches", d.jbProjectId == jb);

        _ok("mint.marketOf == lmsr", mint.marketOf(id) == market);
        _ok("feeRouter.marketOf == lmsr", feeRouter.marketOf(id) == market);
        _ok("mint.feeRouter set", mint.feeRouter() == address(feeRouter));
        _ok("lmsr.owner == feeRouter", ILMSRWithTWAP(market).owner() == address(feeRouter));
        _ok("lmsr.stage == Running (0)", ILMSRWithTWAP(market).stage() == 0);
        _ok("lmsr.fee == 1e16", ILMSRWithTWAP(market).fee() == 1e16);

        bytes32 cond = ILMSRWithTWAP(market).conditionIds(0);
        _ok("market condition == registry", cond == d.ctfConditionId);
        _ok("condition unresolved (payoutDenominator==0)", IConditionalTokens(ILMSRWithTWAP(market).pmSystem()).payoutDenominator(cond) == 0);

        (address weth, address ctf) = requireDePrizeCollateral(block.chainid);
        _ok("market collateral == configured WETH", ILMSRWithTWAP(market).collateralToken() == weth);
        _ok("market pmSystem == configured CTF", ILMSRWithTWAP(market).pmSystem() == ctf);
        _ok("mint/feeRouter share registry", address(mint.registry()) == address(registry) && address(feeRouter.registry()) == address(registry));

        address payHook = vm.envOr("DEPRIZE_PAYHOOK", address(0));
        if (payHook != address(0)) {
            _ok("payHook.deprizeRegistry == registry", address(LaunchPadPayHook(payHook).deprizeRegistry()) == address(registry));
            _ok("payHook.stage == 1 (cashOut locked)", LaunchPadPayHook(payHook).stage(JB_V5_MULTI_TERMINAL, jb) == 1);
        } else {
            console.log("WARN: DEPRIZE_PAYHOOK unset - cashOut latch not checked");
        }

        console.log("DePrizeVerify: all asserted checks passed.");
    }

    function _ok(string memory label, bool pass) internal pure {
        require(pass, label);
    }
}
