// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "std/Script.sol";
import {MissionCreator} from "../../src/MissionCreator.sol";
import {MissionTable} from "../../src/tables/MissionTable.sol";

/// @title CreateDePrizeMission
/// @notice Phase 3.2: create the Juicebox mission whose pay hook will be
///         registry-aware (compiled from current LaunchPadPayHook).
///
/// AUDIT[plan 3.1 / 3.2]: pass the *new* MissionCreator from
/// `script/MissionCreator.s.sol`, not the production Arbitrum creator
/// (`0x87e80c…`) — that one predates M2 and its hooks have no
/// `setDePrizeRegistry`.
///
/// Sender must be the MissionCreator owner or a manager of `TEAM_ID`.
///
/// Env:
///   MISSION_CREATOR  TEAM_ID  MISSION_TO (pay-hook owner / JB project owner)
///   PROJECT_URI  FUNDING_GOAL  DEADLINE (unix)  REFUND_PERIOD (seconds)
///   TOKEN_NAME  TOKEN_SYMBOL  MEMO
contract CreateDePrizeMission is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address creatorAddr = vm.envAddress("MISSION_CREATOR");
        MissionCreator creator = MissionCreator(creatorAddr);

        uint256 teamId = vm.envUint("TEAM_ID");
        address to = vm.envAddress("MISSION_TO");
        string memory uri = vm.envString("PROJECT_URI");
        uint256 fundingGoal = vm.envUint("FUNDING_GOAL");
        uint256 deadline = vm.envUint("DEADLINE");
        uint256 refundPeriod = vm.envUint("REFUND_PERIOD");
        string memory tokenName = vm.envOr("TOKEN_NAME", string("DePrize"));
        string memory tokenSymbol = vm.envOr("TOKEN_SYMBOL", string("DPRZ"));
        string memory memo = vm.envOr("MEMO", string("DePrize prize-pool mission"));

        console.log("Creating mission via MissionCreator:", creatorAddr);
        console.log("  MissionCreator.owner():", creator.owner());
        console.log("  MISSION_TO (payhook owner):", to);

        // insertIntoTable is onlyOperators (table owner or missionCreator slot).
        // Fail before launchProjectFor so a missing setMissionCreator / fresh
        // table cannot create an orphan Juicebox project.
        MissionTable table = creator.missionTable();
        require(address(table) != address(0), "MissionCreator.missionTable is zero");
        require(
            table.missionCreator() == creatorAddr || table.owner() == creatorAddr,
            "MissionCreator is not MissionTable operator; deploy a fresh table or call setMissionCreator first"
        );
        console.log("  MissionTable:", address(table));

        vm.startBroadcast(pk);
        uint256 missionId = creator.createMission(
            teamId,
            to,
            uri,
            fundingGoal,
            deadline,
            refundPeriod,
            true,
            tokenName,
            tokenSymbol,
            memo
        );
        vm.stopBroadcast();

        uint256 projectId = creator.missionIdToProjectId(missionId);
        address payHook = creator.missionIdToPayHook(missionId);
        console.log("RECORD these - Phase 5 needs them:");
        console.log("  missionId:        ", missionId);
        console.log("  jbProjectId:      ", projectId);
        console.log("  payHook:          ", payHook);
        console.log("  payHook.owner() must submit setDePrizeRegistry (one-way).");
        console.log("Set DEPRIZE_JB_PROJECT and DEPRIZE_PAYHOOK for DePrizeWire / DePrizeVerify.");
    }
}
