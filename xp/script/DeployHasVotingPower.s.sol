// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/verifiers/HasVotingPower.sol";

contract DeployHasVotingPowerScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address oracleAddress = vm.envAddress("ORACLE_ADDRESS");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy HasVotingPower verifier
        HasVotingPower votingPowerVerifier = new HasVotingPower(oracleAddress);
        
        vm.stopBroadcast();
        
        console.log("HasVotingPower verifier deployed at:", address(votingPowerVerifier));
        console.log("Oracle address:", oracleAddress);
        console.log("");
        console.log("To register this verifier with XPManager:");
        console.log("xpManager.registerVerifier(2, address(votingPowerVerifier));");
        console.log("");
        console.log("Voting Power Tiers:");
        console.log("- 1,000+ VP: 10 XP (Small Holder)");
        console.log("- 5,000+ VP: 25 XP (Medium Holder)");
        console.log("- 10,000+ VP: 50 XP (Large Holder)");
        console.log("- 50,000+ VP: 100 XP (Whale)");
        console.log("- 100,000+ VP: 200 XP (Mega Whale)");
    }
}
