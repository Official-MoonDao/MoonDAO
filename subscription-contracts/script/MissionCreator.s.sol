pragma solidity ^0.8.20;

import "../src/MissionCreator.sol";
import "../src/tables/MissionTable.sol";
import "base/Config.sol";

contract MyScript is Script, Config {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Juicebox contract addresses are shared across chains
        address MISSION_TABLE = 0x0000000000000000000000000000000000000000;

        MissionTable missionTable = new MissionTable("MissionTable", address(0));

        MissionCreator missionCreator = new MissionCreator(JB_V5_CONTROLLER, JB_V5_MULTI_TERMINAL, JB_V5_PROJECTS, JB_V5_TERMINAL_STORE, JB_V5_RULESETS, MOONDAO_TEAM_ADDRESSES[block.chainid], MISSION_TABLE, MOONDAO_TREASURY_ADDRESSES[block.chainid], FEE_HOOK_ADDRESSES[block.chainid], POSITION_MANAGERS[block.chainid]);

        missionTable.setMissionCreator(address(missionCreator));
        missionCreator.setMissionTable(address(missionTable));

        vm.stopBroadcast();
    }
}
