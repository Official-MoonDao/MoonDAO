pragma solidity ^0.8.20;

import "../src/MissionCreator.sol";
import "../src/FundingOracle.sol";
import "../src/tables/MissionTable.sol";
import "base/Config.sol";

contract MyScript is Script, Config {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Juicebox contract addresses are shared across chains
        address MISSION_TABLE = 0x0000000000000000000000000000000000000000;

        MissionTable missionTable = new MissionTable("MissionTable", address(0));
        bytes32 internal constant salt = bytes32(abi.encode(0xda0));

        MissionCreator missionCreator = new MissionCreator{salt: salt}(JB_V5_CONTROLLER, JB_V5_MULTI_TERMINAL, JB_V5_PROJECTS, JB_V5_TERMINAL_STORE, JB_V5_RULESETS, MOONDAO_TEAM_ADDRESSES[block.chainid], MISSION_TABLE, MOONDAO_TREASURY_ADDRESSES[block.chainid], FEE_HOOK_ADDRESSES[block.chainid], POSITION_MANAGERS[block.chainid], FUNDING_ORACLE_ADDRESS);

        missionTable.setMissionCreator(address(missionCreator));
        missionCreator.setMissionTable(address(missionTable));
        FundingOracle(FUNDING_ORACLE_ADDRESS).setMissionCreatorAddress(address(missionCreator));


        vm.stopBroadcast();
    }
}
