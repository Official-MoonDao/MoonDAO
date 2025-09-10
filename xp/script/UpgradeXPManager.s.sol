// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/XPManager.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./HSMSigner.s.sol";

contract UpgradeXPManagerScript is Script, HSMSigner {
    function run() external {
        // Get HSM signer address
        address hsmSignerAddress = getHSMAddress();
        console.log("Upgrading with HSM signer:", hsmSignerAddress);
        
        address proxyAddress = vm.envAddress("XP_MANAGER_ADDRESS");

        if (proxyAddress == address(0)) {
            revert("No proxy address provided");
        }

        // Start HSM broadcast
        startHSMBroadcast();

        // Deploy new XPManager implementation
        XPManager newImplementation = new XPManager();
        console.log("New implementation deployed at:", address(newImplementation));
        console.log("Proxy address:", proxyAddress);

        // Get the current proxy instance
        XPManager proxy = XPManager(proxyAddress);
        
        // Verify we're the owner before upgrading
        address owner = proxy.owner();
        console.log("Current owner:", owner);
        console.log("HSM signer is owner:", owner == hsmSignerAddress);
        
        // Upgrade to new implementation
        proxy.upgradeToAndCall(address(newImplementation), "");
        
        console.log("Upgrade completed successfully!");
        console.log("New implementation:", address(newImplementation));

        // Log upgrade summary
        console.log("=== UPGRADE SUMMARY ===");
        console.log("HSM Signer Address:", hsmSignerAddress);
        console.log("Proxy Address:", proxyAddress);
        console.log("New Implementation:", address(newImplementation));
        console.log("Previous Owner:", owner);

        stopHSMBroadcast();
    }
}
