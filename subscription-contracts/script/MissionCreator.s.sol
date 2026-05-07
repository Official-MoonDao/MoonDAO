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

        vm.stopBroadcast();

        console.log("New MissionCreator deployed:", address(missionCreator));
        console.log("Next steps (call from MissionTable owner):");
        console.log("  MissionTable.setMissionCreator(%s)", address(missionCreator));
        console.log("  MissionTable.transferOwnership(0x31CDb419E4A7998367627faa24cEe15941795827)");
        console.log("MissionTable address:", MISSION_TABLE_ADDRESSES[block.chainid]);
    }
}
