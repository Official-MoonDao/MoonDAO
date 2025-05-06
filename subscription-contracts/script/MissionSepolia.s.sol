pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MissionCreator.sol";
import "../src/tables/MissionTable.sol";

contract MyScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address JB_CONTROLLER = 0xb291844F213047Eb9e1621AE555B1Eae6700d553;
        address JB_MULTI_TERMINAL = 0xDB9644369c79C3633cDE70D2Df50d827D7dC7Dbc;
        address JB_RULESETS = 0x117aA863C690A871523715E0eA42A49121F10Cfd;
        address JB_PROJECTS = 0x0b538A02610d7d3Cc91Ce2870F423e0a34D646AD;
        address JB_TERMINAL_STORE = 0x6F6740ddA12033ca9fBAA56693194E38cfD36827;
        address MOON_DAO_TEAM = 0x21d2C4bEBd1AEb830277F8548Ae30F505551f961;
        address MISSION_TABLE = 0x0000000000000000000000000000000000000000;
        address MOON_DAO_TREASURY = 0x0724d0eb7b6d32AEDE6F9e492a5B1436b537262b;

        MissionTable missionTable = new MissionTable("MissionTable", address(0));

        MissionCreator missionCreator = new MissionCreator(JB_CONTROLLER, JB_MULTI_TERMINAL, JB_PROJECTS, JB_TERMINAL_STORE, JB_RULESETS, MOON_DAO_TEAM, MISSION_TABLE, MOON_DAO_TREASURY);

        missionTable.setMissionCreator(address(missionCreator));
        missionCreator.setMissionTable(address(missionTable));

        vm.stopBroadcast();
    }
}
