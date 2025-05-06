pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/tables/JobBoardTable.sol";

contract MyScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        JobBoardTable jobBoardTable = new JobBoardTable("JOBBOARD");
        jobBoardTable.setMoonDaoTeam(0x21d2C4bEBd1AEb830277F8548Ae30F505551f961);

        vm.stopBroadcast();
    }
}