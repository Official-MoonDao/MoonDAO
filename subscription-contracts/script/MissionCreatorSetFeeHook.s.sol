pragma solidity ^0.8.20;

import "../src/MissionCreator.sol";
import "../src/tables/MissionTable.sol";
import "base/Config.sol";

contract MyScript is Script, Config {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        MissionCreator missionCreator = MissionCreator(MISSION_CREATOR_ADDRESSES[block.chainid]);
        missionCreator.setFeeHookAddress(FEE_HOOK_ADDRESSES[block.chainid]);

        vm.stopBroadcast();
    }
}
