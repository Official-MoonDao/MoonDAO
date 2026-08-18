// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "std/Script.sol";
import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";
import {DePrizeMint} from "../../src/deprize/DePrizeMint.sol";
import {DePrizeFeeRouter} from "../../src/deprize/DePrizeFeeRouter.sol";
import {ILMSRWithTWAP} from "../../src/deprize/interfaces/ILMSRWithTWAP.sol";
import {LaunchPadPayHook} from "../../src/LaunchPadPayHook.sol";

/// @title DePrizeWire
/// @notice Phase 5 runbook as a script: register → setCondition → open →
///         setMarket (mint + fee router) → setFeeRouter. Optionally transfers
///         LMSR ownership to the FeeRouter (required for sweeps).
///
/// AUDIT[plan Phase 5]: `payHook.setDePrizeRegistry` is a **one-way latch**
/// owned by the mission `to` account, which may not be `DEPRIZE_OWNER`. This
/// script NEVER broadcasts that call unless `DEPRIZE_WIRE_PAYHOOK=true` AND
/// `payHook.deprizeRegistry()` is still zero. It always prints the calldata
/// so a different Safe can submit it.
///
/// Default is dry-run (print calldata). Set `DEPRIZE_DO_WIRE=true` to broadcast
/// the owner-gated registry/mint/fee-router calls (testnet EOA or a key that
/// is the Safe... which it usually isn't on mainnet — prefer dry-run + Safe).
///
/// Env:
///   DEPRIZE_REGISTRY DEPRIZE_MINT DEPRIZE_FEE_ROUTER DEPRIZE_MARKET
///   DEPRIZE_CONDITION (bytes32) DEPRIZE_SUNSET (unix) DEPRIZE_JB_PROJECT
///   DEPRIZE_NUM_OUTCOMES DEPRIZE_TEAM_ID_0 .. DEPRIZE_TEAM_ID_{n-1}
///   DEPRIZE_PAYHOOK (optional; for the latch calldata)
///   DEPRIZE_ID (optional; skip register if already assigned)
contract DePrizeWire is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        bool doWire = vm.envOr("DEPRIZE_DO_WIRE", false);

        DePrizeRegistry registry = DePrizeRegistry(vm.envAddress("DEPRIZE_REGISTRY"));
        DePrizeMint mint = DePrizeMint(payable(vm.envAddress("DEPRIZE_MINT")));
        DePrizeFeeRouter feeRouter = DePrizeFeeRouter(payable(vm.envAddress("DEPRIZE_FEE_ROUTER")));
        address market = vm.envAddress("DEPRIZE_MARKET");
        bytes32 condition = vm.envBytes32("DEPRIZE_CONDITION");
        require(condition != bytes32(0), "DEPRIZE_CONDITION is zero");
        require(market != address(0), "DEPRIZE_MARKET is zero");

        uint256 deprizeId = vm.envOr("DEPRIZE_ID", uint256(0));

        if (doWire) vm.startBroadcast(pk);

        if (deprizeId == 0) {
            uint256 jbProjectId = vm.envUint("DEPRIZE_JB_PROJECT");
            uint256 sunset = vm.envUint("DEPRIZE_SUNSET");
            uint256[] memory teams = _teamIds();
            bytes memory regCall =
                abi.encodeCall(DePrizeRegistry.register, (jbProjectId, teams, sunset));
            console.log("5.1 registry.register(jb, teams, sunset)");
            console.logBytes(regCall);
            if (doWire) {
                deprizeId = registry.register(jbProjectId, teams, sunset);
                console.log("  assigned deprizeId:", deprizeId);
            } else {
                console.log("  (dry-run - set DEPRIZE_ID after submitting register)");
            }
        } else {
            console.log("5.1 skip register; DEPRIZE_ID=", deprizeId);
        }

        if (deprizeId != 0) {
            bytes32 existing = registry.getDePrize(deprizeId).ctfConditionId;
            bytes memory condCall = abi.encodeCall(DePrizeRegistry.setCondition, (deprizeId, condition));
            console.log("5.2 registry.setCondition");
            console.logBytes(condCall);
            if (doWire && existing != condition) {
                registry.setCondition(deprizeId, condition);
            }

            IDePrizeRegistry.DePrizeState st = registry.state(deprizeId);
            bytes memory openCall = abi.encodeCall(DePrizeRegistry.open, (deprizeId));
            console.log("5.4 registry.open");
            console.logBytes(openCall);
            if (doWire && st == IDePrizeRegistry.DePrizeState.DRAFT) {
                registry.open(deprizeId);
            }

            bytes memory mintMkt = abi.encodeCall(DePrizeMint.setMarket, (deprizeId, market));
            console.log("5.5 mint.setMarket");
            console.logBytes(mintMkt);
            if (doWire && mint.marketOf(deprizeId) != market) {
                mint.setMarket(deprizeId, market);
            }

            bytes memory feeMkt = abi.encodeCall(DePrizeFeeRouter.setMarket, (deprizeId, market));
            console.log("5.6 feeRouter.setMarket");
            console.logBytes(feeMkt);
            if (doWire && feeRouter.marketOf(deprizeId) != market) {
                feeRouter.setMarket(deprizeId, market);
            }

            bytes memory setFr = abi.encodeCall(DePrizeMint.setFeeRouter, (address(feeRouter)));
            console.log("5.7 mint.setFeeRouter");
            console.logBytes(setFr);
            if (doWire && mint.feeRouter() != address(feeRouter)) {
                mint.setFeeRouter(address(feeRouter));
            }
        }

        address lmsrOwner = ILMSRWithTWAP(market).owner();
        bytes memory xfer = abi.encodeCall(ILMSRWithTWAP.transferOwnership, (address(feeRouter)));
        console.log("Phase 4/5 LMSR.transferOwnership(feeRouter)");
        console.log("  current LMSR owner:", lmsrOwner);
        console.logBytes(xfer);
        if (doWire && lmsrOwner != address(feeRouter) && lmsrOwner == vm.addr(pk)) {
            ILMSRWithTWAP(market).transferOwnership(address(feeRouter));
        } else if (lmsrOwner != address(feeRouter)) {
            console.log("  submit transferOwnership from the CURRENT owner (often the Safe / oracle).");
        }

        if (doWire) vm.stopBroadcast();

        // AUDIT[plan 5.3]: one-way latch, different owner. Isolated from broadcast.
        address payHook = vm.envOr("DEPRIZE_PAYHOOK", address(0));
        if (payHook != address(0)) {
            address hooked = address(LaunchPadPayHook(payHook).deprizeRegistry());
            bytes memory latch =
                abi.encodeCall(LaunchPadPayHook.setDePrizeRegistry, (address(registry)));
            console.log("5.3 payHook.setDePrizeRegistry (ONE-WAY LATCH)");
            console.log("  payHook:", payHook);
            console.log("  current deprizeRegistry():", hooked);
            console.log("  payHook.owner() (must submit):", LaunchPadPayHook(payHook).owner());
            console.logBytes(latch);
            if (hooked != address(0)) {
                console.log("  SKIP - already latched. Do not re-send.");
            } else if (vm.envOr("DEPRIZE_WIRE_PAYHOOK", false) && doWire) {
                require(hooked == address(0), "already latched");
                vm.startBroadcast(pk);
                LaunchPadPayHook(payHook).setDePrizeRegistry(address(registry));
                vm.stopBroadcast();
            }
        } else {
            console.log("5.3 skipped (set DEPRIZE_PAYHOOK to print latch calldata)");
        }

        console.log("Next: forge script script/deprize/DePrizeVerify.s.sol");
    }

    function _teamIds() internal view returns (uint256[] memory teams) {
        uint256 n = vm.envUint("DEPRIZE_NUM_OUTCOMES");
        require(n >= 2, "DEPRIZE_NUM_OUTCOMES < 2");
        teams = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            teams[i] = vm.envUint(string.concat("DEPRIZE_TEAM_ID_", vm.toString(i)));
            require(teams[i] != 0, "zero team id (reserved winningTeamId sentinel)");
        }
    }
}
