pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/tables/Project.sol";

contract MyScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        Project project = new Project("PROJECT");

        vm.stopBroadcast();
    }
}
