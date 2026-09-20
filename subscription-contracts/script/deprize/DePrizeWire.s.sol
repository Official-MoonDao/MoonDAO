// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "std/Script.sol";
import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";
import {DePrizeMint} from "../../src/deprize/DePrizeMint.sol";
import {ILMSRMarketMaker} from "../../src/deprize/interfaces/ILMSRMarketMaker.sol";
import {LaunchPadPayHook} from "../../src/LaunchPadPayHook.sol";

/// @title DePrizeWire
/// @notice v2 wiring runbook as a script:
///         register → setCondition → mint.setMarket → mint.setComplianceSigner → open.
///         Asserts the LMSR market is owned by the Safe (no fee router in v2).
///
/// Default is dry-run (print calldata for the Safe). Set `DEPRIZE_DO_WIRE=true`
/// to broadcast from `PRIVATE_KEY` (testnets, where the deployer is the owner).
///
/// `payHook.setDePrizeRegistry` is a one-way latch owned by the mission `to`
/// account, which may not be the DePrize owner. The script never broadcasts it
/// unless `DEPRIZE_WIRE_PAYHOOK=true` AND the hook is still unlatched; it
/// always prints the calldata so the right Safe can submit it.
///
/// Env:
///   DEPRIZE_REGISTRY DEPRIZE_MINT DEPRIZE_MARKET DEPRIZE_OWNER (the Safe)
///   DEPRIZE_CONDITION (bytes32) DEPRIZE_SUNSET (unix) DEPRIZE_JB_PROJECT
///   DEPRIZE_NUM_OUTCOMES DEPRIZE_TEAM_ID_0 .. DEPRIZE_TEAM_ID_{n-1}
///   DEPRIZE_COMPLIANCE_SIGNER (optional) DEPRIZE_PAYHOOK (optional)
///   DEPRIZE_ID (optional; skip register if already assigned)
contract DePrizeWire is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        bool doWire = vm.envOr("DEPRIZE_DO_WIRE", false);

        DePrizeRegistry registry = DePrizeRegistry(vm.envAddress("DEPRIZE_REGISTRY"));
        DePrizeMint mint = DePrizeMint(vm.envAddress("DEPRIZE_MINT"));
        address market = vm.envAddress("DEPRIZE_MARKET");
        address safe = vm.envAddress("DEPRIZE_OWNER");
        bytes32 condition = vm.envBytes32("DEPRIZE_CONDITION");
        require(condition != bytes32(0), "DEPRIZE_CONDITION is zero");
        require(market != address(0), "DEPRIZE_MARKET is zero");

        // v2: the Safe owns the market directly. Nothing else may.
        address lmsrOwner = ILMSRMarketMaker(market).owner();
        console.log("LMSR owner:", lmsrOwner);
        require(lmsrOwner == safe, "LMSR market must be owned by DEPRIZE_OWNER (the Safe)");
        require(registry.owner() == safe, "registry owner != DEPRIZE_OWNER");
        require(mint.owner() == safe, "mint owner != DEPRIZE_OWNER");

        uint256 deprizeId = vm.envOr("DEPRIZE_ID", uint256(0));

        if (doWire) vm.startBroadcast(pk);

        if (deprizeId == 0) {
            uint256 jbProjectId = vm.envUint("DEPRIZE_JB_PROJECT");
            uint256 sunset = vm.envUint("DEPRIZE_SUNSET");
            uint256[] memory teams = _teamIds();
            console.log("1. registry.register(jb, teams, sunset)");
            console.logBytes(abi.encodeCall(DePrizeRegistry.register, (jbProjectId, teams, sunset)));
            if (doWire) {
                deprizeId = registry.register(jbProjectId, teams, sunset);
                console.log("  assigned deprizeId:", deprizeId);
            } else {
                console.log("  (dry-run - set DEPRIZE_ID after submitting register)");
            }
        } else {
            console.log("1. skip register; DEPRIZE_ID=", deprizeId);
        }

        if (deprizeId != 0) {
            bytes32 existing = registry.getDePrize(deprizeId).ctfConditionId;
            console.log("2. registry.setCondition");
            console.logBytes(abi.encodeCall(DePrizeRegistry.setCondition, (deprizeId, condition)));
            if (doWire && existing != condition) registry.setCondition(deprizeId, condition);

            console.log("3. mint.setMarket (write-once)");
            console.logBytes(abi.encodeCall(DePrizeMint.setMarket, (deprizeId, market)));
            address bound = mint.marketOf(deprizeId);
            if (bound != address(0)) {
                require(bound == market, "mint already bound to a different market");
                console.log("  already bound.");
            } else if (doWire) {
                mint.setMarket(deprizeId, market);
            }

            address signer = vm.envOr("DEPRIZE_COMPLIANCE_SIGNER", address(0));
            if (signer != address(0)) {
                console.log("4. mint.setComplianceSigner");
                console.logBytes(abi.encodeCall(DePrizeMint.setComplianceSigner, (signer)));
                if (doWire && mint.complianceSigner() != signer) mint.setComplianceSigner(signer);
            } else {
                console.log("4. DEPRIZE_COMPLIANCE_SIGNER unset - bets stay disabled until it is set.");
            }

            IDePrizeRegistry.DePrizeState st = registry.state(deprizeId);
            console.log("5. registry.open (last: freezes the roster and starts betting)");
            console.logBytes(abi.encodeCall(DePrizeRegistry.open, (deprizeId)));
            if (doWire && st == IDePrizeRegistry.DePrizeState.DRAFT) registry.open(deprizeId);
        }

        if (doWire) vm.stopBroadcast();

        address payHook = vm.envOr("DEPRIZE_PAYHOOK", address(0));
        if (payHook != address(0)) {
            address hooked = address(LaunchPadPayHook(payHook).deprizeRegistry());
            console.log("6. payHook.setDePrizeRegistry (ONE-WAY LATCH)");
            console.log("  payHook:", payHook);
            console.log("  current deprizeRegistry():", hooked);
            console.log("  payHook.owner() (must submit):", LaunchPadPayHook(payHook).owner());
            console.logBytes(abi.encodeCall(LaunchPadPayHook.setDePrizeRegistry, (address(registry))));
            if (hooked != address(0)) {
                console.log("  SKIP - already latched. Do not re-send.");
            } else if (vm.envOr("DEPRIZE_WIRE_PAYHOOK", false) && doWire) {
                vm.startBroadcast(pk);
                LaunchPadPayHook(payHook).setDePrizeRegistry(address(registry));
                vm.stopBroadcast();
            }
        } else {
            console.log("6. skipped (set DEPRIZE_PAYHOOK to print latch calldata)");
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
