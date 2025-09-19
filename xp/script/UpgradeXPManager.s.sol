// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/XPManager.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract UpgradeXPManagerScript is Script {
    function run() external {
        // Get HSM signer address
        address hsmSignerAddress = vm.envAddress("HSM_SIGNER_ADDRESS");
        address proxyAddress = vm.envAddress("XP_MANAGER_ADDRESS");
        address daoSafeAddress = vm.envAddress("DAO_SAFE_ADDRESS");

        if (proxyAddress == address(0)) {
            revert("No proxy address provided");
        }

        // Start HSM broadcast
        vm.startBroadcast();

        // Deploy new XPManager implementation
        XPManager newImplementation = new XPManager();
        console.log("New implementation deployed at:", address(newImplementation));
        console.log("Proxy address:", proxyAddress);

        // Get the current proxy instance
        XPManager proxy = XPManager(proxyAddress);
        
        // Upgrade to new implementation
        proxy.upgradeToAndCall(address(newImplementation), "");

        proxy.transferOwnership(daoSafeAddress);
        
        console.log("Upgrade completed successfully!");
        console.log("New implementation:", address(newImplementation));

        vm.stopBroadcast();
    }
}
