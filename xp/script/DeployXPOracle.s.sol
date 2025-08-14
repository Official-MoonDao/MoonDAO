// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/XPOracle.sol";

contract DeployXPOracleScript is Script {
    string public constant ORACLE_NAME = "MoonDAO XP Oracle";
    string public constant ORACLE_VERSION = "1.0.0";

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        address oracleSigner = vm.envAddress("ORACLE_SIGNER");

        vm.startBroadcast(deployerPrivateKey);

        XPOracle oracle = new XPOracle(ORACLE_NAME, ORACLE_VERSION);

        if (oracleSigner != address(0)) {
            oracle.setSigner(oracleSigner, true);
        }

        vm.stopBroadcast();

        console.log("XPOracle deployed at:", address(oracle));
        console.log("Domain name:", ORACLE_NAME);
        console.log("Domain version:", ORACLE_VERSION);
        if (oracleSigner != address(0)) {
            console.log("Authorized signer:", oracleSigner);
        } else {
            console.log("No signer authorized (ORACLE_SIGNER was zero address)");
        }
    }
}
