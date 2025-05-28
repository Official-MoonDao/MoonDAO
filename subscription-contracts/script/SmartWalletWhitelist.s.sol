pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/SmartWalletWhitelist.sol";

contract MyScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        new SmartWalletWhitelist(0x5DA2a965FDd9f20B1b9bd2bA033fCb1f50E75e18);

        vm.stopBroadcast();
    }
}