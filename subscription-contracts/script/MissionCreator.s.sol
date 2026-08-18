pragma solidity ^0.8.20;

import "../src/MissionCreator.sol";
import "../src/tables/MissionTable.sol";
import "base/Config.sol";

/// @title DeployMissionCreator
/// @notice Deploys a fresh MissionCreator with the latest source — notably
///         `ownerMustSendPayouts = true` baked into both rulesets so future
///         missions are gated by default.
///
/// This script ONLY deploys the contract. Wiring the new MissionCreator into
/// the existing MissionTable (`setMissionCreator`) and transferring table
/// ownership are owner-gated calls and must be executed by the current
/// MissionTable owner directly (e.g. via Arbiscan).
///
/// No legacy missions are migrated. Mission 4's ruleset has already been
/// fixed on-chain, and the earlier missions are stale.
///
/// Usage (Arbitrum mainnet):
///   forge script script/MissionCreator.s.sol \
///     --rpc-url https://arb1.arbitrum.io/rpc \
///     --via-ir --optimizer-runs 200 \
///     --broadcast --verify
contract MyScript is Script, Config {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Juicebox contract addresses are shared across chains.
        MissionCreator missionCreator = new MissionCreator(
            JB_V5_CONTROLLER,
            JB_V5_MULTI_TERMINAL,
            JB_V5_PROJECTS,
            JB_V5_TERMINAL_STORE,
            JB_V5_RULESETS,
            MOONDAO_TEAM_ADDRESSES[block.chainid],
            MISSION_TABLE_ADDRESSES[block.chainid],
            MOONDAO_TREASURY_ADDRESSES[block.chainid],
            FEE_HOOK_ADDRESSES[block.chainid],
            POSITION_MANAGERS[block.chainid]
        );

        // AUDIT[plan 3.1]: optional ownership handoff. Default leaves the
        // deployer as owner so they can still call createMission (onlyOwner OR
        // team manager). Set DEPRIZE_TRANSFER_OWNERSHIP=true AFTER the mission
        // exists, or create the mission from the Safe once it owns the creator.
        address nextOwner = vm.envOr("DEPRIZE_OWNER", address(0));
        if (vm.envOr("DEPRIZE_TRANSFER_OWNERSHIP", false)) {
            require(nextOwner != address(0), "DEPRIZE_OWNER required to transfer");
            missionCreator.transferOwnership(nextOwner);
        }

        vm.stopBroadcast();

        console.log("New MissionCreator deployed:", address(missionCreator));
        if (nextOwner != address(0) && vm.envOr("DEPRIZE_TRANSFER_OWNERSHIP", false)) {
            console.log("  ownership transferred to:", nextOwner);
        } else {
            console.log("  owner is deployer; transfer later via DEPRIZE_TRANSFER_OWNERSHIP");
        }
        console.log("AUDIT[plan 3.1]: this creator is NOT yet the app-wide Arbitrum creator.");
        console.log("  Production MissionCreator (listings):", MISSION_CREATOR_ADDRESSES[block.chainid]);
        console.log("  Wiring this into MissionTable.setMissionCreator makes ALL future");
        console.log("  missions registry-aware. Leave unset to keep this DePrize-only");
        console.log("  (mission will not appear in the main launchpad list).");
        console.log("Next: script/deprize/CreateDePrizeMission.s.sol with MISSION_CREATOR=this");
        console.log("MissionTable address:", MISSION_TABLE_ADDRESSES[block.chainid]);
    }
}
