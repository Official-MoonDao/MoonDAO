pragma solidity ^0.8.20;

import "../src/MissionCreator.sol";
import "../src/tables/MissionTable.sol";
import "base/Config.sol";

/// @title DeployMissionCreator
/// @notice Deploys a fresh MissionCreator with the latest source — notably
///         `ownerMustSendPayouts = true` baked into both rulesets so future
///         missions are gated by default.
///
/// Default (DePrize-only / Sepolia): also deploys a **fresh MissionTable**
/// with this creator in the `missionCreator` slot so `createMission` can
/// insert. Production `MissionTable.insertIntoTable` is `onlyOperators`
/// (table owner or the single registered creator); a newly deployed creator
/// is neither until `setMissionCreator` is called.
///
/// Canonical (all future missions registry-aware): set
/// `DEPRIZE_USE_PRODUCTION_MISSION_TABLE=true`. Then the production table
/// owner must call `setMissionCreator(newCreator)` **before** Phase 3.2.
///
/// Transferring production-table ownership remains owner-gated (e.g. via
/// Arbiscan). No legacy missions are migrated. Mission 4's ruleset has
/// already been fixed on-chain, and the earlier missions are stale.
///
/// Usage (Arbitrum mainnet):
///   forge script script/MissionCreator.s.sol \
///     --rpc-url https://arb1.arbitrum.io/rpc \
///     --via-ir --optimizer-runs 200 \
///     --broadcast --verify
contract MyScript is Script, Config {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        bool useProductionTable = vm.envOr("DEPRIZE_USE_PRODUCTION_MISSION_TABLE", false);
        address productionTable = MISSION_TABLE_ADDRESSES[block.chainid];
        if (useProductionTable) {
            require(productionTable != address(0), "no production MissionTable for chain");
        }

        vm.startBroadcast(deployerPrivateKey);

        // Juicebox contract addresses are shared across chains.
        // Fresh-table path passes address(0) then `setMissionTable` after the
        // table exists (constructor chicken-egg; same pattern as the tests).
        MissionCreator missionCreator = new MissionCreator(
            JB_V5_CONTROLLER,
            JB_V5_MULTI_TERMINAL,
            JB_V5_PROJECTS,
            JB_V5_TERMINAL_STORE,
            JB_V5_RULESETS,
            MOONDAO_TEAM_ADDRESSES[block.chainid],
            useProductionTable ? productionTable : address(0),
            MOONDAO_TREASURY_ADDRESSES[block.chainid],
            FEE_HOOK_ADDRESSES[block.chainid],
            POSITION_MANAGERS[block.chainid]
        );

        address tableAddr = productionTable;
        if (!useProductionTable) {
            MissionTable fresh = new MissionTable("DEPRIZEMISSION", address(missionCreator));
            address team = MOONDAO_TEAM_ADDRESSES[block.chainid];
            if (team != address(0)) {
                fresh.setMoonDaoTeam(team);
            }
            missionCreator.setMissionTable(address(fresh));
            tableAddr = address(fresh);
        }

        // AUDIT[plan 3.1]: optional creator handoff. Default leaves the
        // deployer as MissionCreator owner so they can still call createMission
        // (onlyOwner OR team manager). Set DEPRIZE_TRANSFER_OWNERSHIP=true
        // AFTER the mission exists, or create the mission from the Safe once
        // it owns the creator. Fresh-table ownership is not required for
        // createMission (missionCreator slot is already set) and is handed to
        // DEPRIZE_OWNER so the listing table is not left on the deployer EOA.
        address nextOwner = vm.envOr("DEPRIZE_OWNER", address(0));
        if (vm.envOr("DEPRIZE_TRANSFER_OWNERSHIP", false)) {
            require(nextOwner != address(0), "DEPRIZE_OWNER required to transfer");
            missionCreator.transferOwnership(nextOwner);
        }
        if (!useProductionTable && nextOwner != address(0)) {
            MissionTable(tableAddr).transferOwnership(nextOwner);
        }

        vm.stopBroadcast();

        console.log("New MissionCreator deployed:", address(missionCreator));
        if (nextOwner != address(0) && vm.envOr("DEPRIZE_TRANSFER_OWNERSHIP", false)) {
            console.log("  ownership transferred to:", nextOwner);
        } else {
            console.log("  owner is deployer; transfer later via DEPRIZE_TRANSFER_OWNERSHIP");
        }
        if (!useProductionTable && nextOwner != address(0)) {
            console.log("  fresh table ownership transferred to:", nextOwner);
        }
        console.log("AUDIT[plan 3.1]: this creator is NOT yet the app-wide Arbitrum creator.");
        console.log("  Production MissionCreator (listings):", MISSION_CREATOR_ADDRESSES[block.chainid]);
        console.log("MissionTable address:", tableAddr);
        if (useProductionTable) {
            console.log("  production table — MissionTable.owner MUST call");
            console.log("  setMissionCreator(this) BEFORE CreateDePrizeMission.");
            console.log("  Wiring this into MissionTable.setMissionCreator makes ALL future");
            console.log("  missions registry-aware.");
            console.logBytes(abi.encodeCall(MissionTable.setMissionCreator, (address(missionCreator))));
        } else {
            console.log("  fresh DePrize-only table (Sepolia path); creator is operator.");
            console.log("  Mission will not appear in the main launchpad list.");
            console.log("  Canonical: rerun with DEPRIZE_USE_PRODUCTION_MISSION_TABLE=true");
            console.log("  then call setMissionCreator before 3.2.");
        }
        console.log("Next: script/deprize/CreateDePrizeMission.s.sol with MISSION_CREATOR=this");
    }
}
