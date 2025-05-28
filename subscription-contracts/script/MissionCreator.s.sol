pragma solidity ^0.8.20;

import "../src/MissionCreator.sol";
import "../src/tables/MissionTable.sol";
import "base/Config.sol";

contract MyScript is Script, Config {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Juicebox contracts are shared across chains
        address JB_CONTROLLER = 0xb291844F213047Eb9e1621AE555B1Eae6700d553;
        address JB_MULTI_TERMINAL = 0xDB9644369c79C3633cDE70D2Df50d827D7dC7Dbc;
        address JB_RULESETS = 0xDA86EeDb67C6C9FB3E58FE83Efa28674D7C89826;
        address JB_PROJECTS = 0x0b538A02610d7d3Cc91Ce2870F423e0a34D646AD;
        address JB_TERMINAL_STORE = 0x6F6740ddA12033ca9fBAA56693194E38cfD36827;
        address MISSION_TABLE = 0x0000000000000000000000000000000000000000;

        MissionTable missionTable = new MissionTable("MissionTable", address(0));

        MissionCreator missionCreator = new MissionCreator(JB_CONTROLLER, JB_MULTI_TERMINAL, JB_PROJECTS, JB_TERMINAL_STORE, JB_RULESETS, MOONDAO_TEAM_ADDRESSES[block.chainid], MISSION_TABLE, MOONDAO_TREASURY_ADDRESSES[block.chainid], FEE_HOOK_ADDRESSES[block.chainid], POSITION_MANAGERS[block.chainid]);

        missionTable.setMissionCreator(address(missionCreator));
        missionCreator.setMissionTable(address(missionTable));

        vm.stopBroadcast();
    }
}
