// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "std/Script.sol";
import "base/Config.sol";

import {MissionCreator} from "../src/MissionCreator.sol";
import {IJBTerminal} from "@nana-core-v5/interfaces/IJBTerminal.sol";
import {JBConstants} from "@nana-core-v5/libraries/JBConstants.sol";

/// @title CreateTestMissionSepolia
/// @notice Track B (Option B): create a Frank-like Launchpad mission on the PUBLIC
///         Sepolia testnet so we can drive the whole re-open flow through the real
///         UI with real wallets and faucet ETH — and share a public link.
///
/// Because a public testnet clock cannot be fast-forwarded, this creates the mission
/// with SHORT durations (default: 10 min deadline, 10 min refund window) so the
/// original round lapses in real time. After it lapses, re-open it by running
/// QueueReopenRuleset.s.sol against the printed MISSION_ID.
///
/// Prereq: the sender must be the MissionCreator owner OR a manager of `teamId`
/// (see MissionCreator.createMission access control). On Sepolia the deployer EOA
/// is the owner, so use its key.
///
/// Usage (from subscription-contracts/):
///   export PRIVATE_KEY=0x...            # MissionCreator owner (or team manager)
///   export SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/<key>
///   # optional: TEAM_ID, FUNDING_GOAL, DEADLINE_MINUTES, REFUND_MINUTES, SEED_ETH
///   forge script script/CreateTestMissionSepolia.s.sol \
///     --rpc-url $SEPOLIA_RPC_URL --broadcast --via-ir -vvv
///
/// Then, once DEADLINE_MINUTES + REFUND_MINUTES have elapsed:
///   MISSION_ID=<printed> MISSION_CREATOR_ADDRESS=<printed> QUEUE_VIA_SENDER=true \
///   TOKENS_PER_ETH=500 CAMPAIGN_DURATION_DAYS=1 REFUND_PERIOD_DAYS=1 \
///   TEAM_VESTING=<printed> MOONDAO_VESTING=<printed> POOL_DEPLOYER=<printed> \
///   TERMINAL=<printed> \
///   forge script script/QueueReopenRuleset.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --via-ir
contract CreateTestMissionSepolia is Script, Config {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");

        address missionCreatorAddress = vm.envOr("MISSION_CREATOR_ADDRESS", MISSION_CREATOR_ADDRESSES[SEP]);
        require(missionCreatorAddress != address(0), "No Sepolia MissionCreator; set MISSION_CREATOR_ADDRESS");

        uint256 teamId = vm.envOr("TEAM_ID", uint256(0));
        uint256 fundingGoal = vm.envOr("FUNDING_GOAL", uint256(100 ether)); // above the seed so it stays below goal
        uint256 deadlineMinutes = vm.envOr("DEADLINE_MINUTES", uint256(10));
        uint256 refundMinutes = vm.envOr("REFUND_MINUTES", uint256(10));
        uint256 seedEth = vm.envOr("SEED_ETH", uint256(0.001 ether));

        MissionCreator missionCreator = MissionCreator(missionCreatorAddress);
        address sender = vm.addr(pk);

        uint256 deadline = block.timestamp + deadlineMinutes * 1 minutes;
        uint256 refundPeriod = refundMinutes * 1 minutes;

        console.log("=== Create test mission on Sepolia ===");
        console.log("MissionCreator:", missionCreatorAddress);
        console.log("Sender:", sender);
        console.log("Funding goal (wei):", fundingGoal);
        console.log("Deadline (unix):", deadline);
        console.log("Refund window (sec):", refundPeriod);

        vm.startBroadcast(pk);

        uint256 missionId = missionCreator.createMission(
            teamId,
            sender,
            "",
            fundingGoal,
            deadline,
            refundPeriod,
            true,
            "FRANK TEST",
            "FRANKT",
            "Re-open UI test mission (Sepolia)"
        );

        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        address terminalAddress = missionCreator.missionIdToTerminal(missionId);

        // Seed a small contribution so the funding bar and refund flow have something
        // to show. Kept well below the goal so the round closes under-funded.
        if (seedEth > 0) {
            IJBTerminal(terminalAddress).pay{value: seedEth}(
                projectId, JBConstants.NATIVE_TOKEN, seedEth, sender, 0, "seed", new bytes(0)
            );
        }

        vm.stopBroadcast();

        console.log("");
        console.log("=== Mission created ===");
        console.log("MISSION_ID:", missionId);
        console.log("PROJECT_ID:", projectId);
        console.log("TERMINAL:", terminalAddress);
        console.log("TEAM_VESTING:", missionCreator.missionIdToTeamVesting(missionId));
        console.log("MOONDAO_VESTING:", missionCreator.missionIdToMoonDAOVesting(missionId));
        console.log("POOL_DEPLOYER:", missionCreator.missionIdToPoolDeployer(missionId));
        console.log("Seeded contribution (wei):", seedEth);
        console.log("");
        console.log("Wait until deadline + refund window elapse, then re-open with");
        console.log("QueueReopenRuleset.s.sol using the MISSION_ID above.");
        console.log("View in UI (testnet): /mission/", missionId);
    }
}
