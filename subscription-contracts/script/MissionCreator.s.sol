pragma solidity ^0.8.20;

import "../src/MissionCreator.sol";
import "../src/tables/MissionTable.sol";
import "base/Config.sol";

contract MyScript is Script, Config {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        MissionCreator oldMissionCreator = MissionCreator(MISSION_CREATOR_ADDRESSES[block.chainid]);

        // Juicebox contract addresses are shared across chains
        MissionCreator missionCreator = new MissionCreator(JB_V5_CONTROLLER, JB_V5_MULTI_TERMINAL, JB_V5_PROJECTS, JB_V5_TERMINAL_STORE, JB_V5_RULESETS, MOONDAO_TEAM_ADDRESSES[block.chainid], MISSION_CREATOR_ADDRESSES[block.chainid], MOONDAO_TREASURY_ADDRESSES[block.chainid], FEE_HOOK_ADDRESSES[block.chainid], POSITION_MANAGERS[block.chainid]);
        MissionTable missionTable = MissionTable(MISSION_TABLE_ADDRESSES[block.chainid]);

        missionTable.setMissionCreator(address(missionCreator));
        missionCreator.setMissionTable(address(missionTable));
        uint256[] memory missionIds = new uint256[](1);
        missionIds[0] = 1;
        for (uint i = 0; i < missionIds.length; i++){
            uint256 missionId = missionIds[i];
            missionCreator.setMissionData(
                missionId,
                oldMissionCreator.missionIdToProjectId(missionId),
                oldMissionCreator.missionIdToPayHook(missionId),
                oldMissionCreator.missionIdToApprovalHook(missionId),
                oldMissionCreator.missionIdToTeamVesting(missionId),
                oldMissionCreator.missionIdToMoonDAOVesting(missionId),
                oldMissionCreator.missionIdToPoolDeployer(missionId),
                oldMissionCreator.missionIdToFundingGoal(missionId),
                oldMissionCreator.missionIdToTerminal(missionId)
            );
        }

        vm.stopBroadcast();
    }
}
