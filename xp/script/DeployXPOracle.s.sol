// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/XPOracle.sol";

contract DeployXPOracleScript is Script {
    string public constant ORACLE_NAME = "MoonDAO XP Oracle";
    string public constant ORACLE_VERSION = "1.0.0";

    function run() external {
        address oracleSigner = vm.envAddress("HSM_SIGNER_ADDRESS");
        address daoSafeAddress = vm.envAddress("DAO_SAFE_ADDRESS");

        if (oracleSigner == address(0)) {
            revert("No HSM signer address provided");
        }

        if (daoSafeAddress == address(0)) {
            revert("No DAO safe address provided");
        }

        // Start broadcast
        vm.startBroadcast();

        XPOracle oracle = new XPOracle(ORACLE_NAME, ORACLE_VERSION);

        oracle.setSigner(oracleSigner, true);

        // Transfer ownership to DAO Safe
        oracle.transferOwnership(daoSafeAddress);

        // Log deployment summary
        console.log("=== ORACLE DEPLOYMENT SUMMARY ===");
        console.log("Oracle Address:", address(oracle));
        console.log("Oracle Name:", ORACLE_NAME);
        console.log("Oracle Version:", ORACLE_VERSION);
        console.log("HSM Signer Address:", oracleSigner);
        console.log("DAO Safe Address:", daoSafeAddress);
        console.log("Oracle transferred to DAO Safe");

        vm.stopBroadcast();
    }
}
