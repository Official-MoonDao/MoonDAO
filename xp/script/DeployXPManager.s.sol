// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/XPManager.sol";
import "../src/verifiers/OwnsCitizenNFT.sol";
import "../src/verifiers/HasVotingPower.sol";
import "../src/XPOracle.sol";
import "../src/verifiers/HasVoted.sol";

contract DeployXPManagerScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address oracleAddress = vm.envAddress("ORACLE_ADDRESS");

        address citizenNFTAddress = vm.envAddress("CITIZEN_NFT_ADDRESS");

        if (oracleAddress == address(0)) {
            revert("No oracle address provided");
        }

        if (citizenNFTAddress == address(0)) {
            revert("No citizen NFT address provided");
        }
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy XPManager (no constructor parameters needed)
        XPManager xpManager = new XPManager();

        // Deploy verifiers with initial xpPerClaim values
        OwnsCitizenNFT citizenVerifier = new OwnsCitizenNFT(citizenNFTAddress, 10);
        HasVotingPower votingPowerVerifier = new HasVotingPower(oracleAddress, 5);
        HasVoted hasVotedVerifier = new HasVoted(oracleAddress, 5);

        // Register verifiers
        xpManager.registerVerifier(1, address(citizenVerifier)); // Citizen NFT ownership
        xpManager.registerVerifier(2, address(votingPowerVerifier)); // Voting power
        xpManager.registerVerifier(3, address(hasVotedVerifier)); // Has voted at least once
        
        vm.stopBroadcast();
        
        console.log("XPManager deployed at:", address(xpManager));
        console.log("Citizen NFT Verifier deployed at:", address(citizenVerifier));
        console.log("HasVotingPower Verifier deployed at:", address(votingPowerVerifier));
        console.log("HasVoted Verifier deployed at:", address(hasVotedVerifier));
        console.log("Oracle address:", oracleAddress);
        console.log("Citizen NFT address:", citizenNFTAddress);
        console.log("");
        console.log("Pure XP system deployed successfully!");
        console.log("Users can now earn XP through various verifiers without any token rewards.");
        console.log("");
        console.log("Verifier IDs:");
        console.log("- ID 1: Citizen NFT ownership");
        console.log("- ID 2: Voting power across chains");
        console.log("- ID 3: Has voted on at least one proposal");
        console.log("");
        console.log("Voting Power Tiers:");
        console.log("- 1,000+ VP: 10 XP (Small Holder)");
        console.log("- 5,000+ VP: 25 XP (Medium Holder)");
        console.log("- 10,000+ VP: 50 XP (Large Holder)");
        console.log("- 50,000+ VP: 100 XP (Whale)");
        console.log("- 100,000+ VP: 200 XP (Mega Whale)");
    }
}
