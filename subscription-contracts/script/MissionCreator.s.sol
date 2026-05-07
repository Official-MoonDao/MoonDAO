pragma solidity ^0.8.20;

import "../src/MissionCreator.sol";
import "../src/tables/MissionTable.sol";
import "base/Config.sol";

/// @title DeployMissionCreator
/// @notice Deploys a fresh MissionCreator with the latest source — notably
///         `ownerMustSendPayouts = true` baked into both rulesets so future
///         missions are gated by default — and re-points the existing
///         MissionTable at the new MissionCreator.
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

        // Re-point the existing MissionTable at the new MissionCreator.
        MissionTable missionTable = MissionTable(MISSION_TABLE_ADDRESSES[block.chainid]);
        missionTable.setMissionCreator(address(missionCreator));

        // Transfer MissionTable ownership to the dev wallet so future
        // redeploys can be run without the original deployer key.
        missionTable.transferOwnership(0x31CDb419E4A7998367627faa24cEe15941795827);

        vm.stopBroadcast();
    }
}
