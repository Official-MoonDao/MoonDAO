// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/XPManager.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract UpgradeXPManagerScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address proxyAddress = vm.envAddress("XP_MANAGER_ADDRESS");

        if (proxyAddress == address(0)) {
            revert("No proxy address provided");
        }

        vm.startBroadcast(deployerPrivateKey);

        // Deploy new XPManager implementation
        XPManager newImplementation = new XPManager();
        
        console.log("New implementation deployed at:", address(newImplementation));
        console.log("Proxy address:", proxyAddress);

        // Get the current proxy instance
        XPManager proxy = XPManager(proxyAddress);
        
        // Verify we're the owner before upgrading
        address owner = proxy.owner();
        console.log("Current owner:", owner);
        
        // Upgrade to new implementation
        proxy.upgradeToAndCall(address(newImplementation), "");
        
        console.log("Upgrade completed successfully!");
        console.log("New implementation:", address(newImplementation));

        vm.stopBroadcast();
    }
}
