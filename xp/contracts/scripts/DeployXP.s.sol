// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../XPManager.sol";
import "../verifiers/OwnsCitizenNFT.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DeployXPScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Deploy the reward token (if you don't have one)
        // This is just an example - you might already have a token
        // MockERC20 rewardToken = new MockERC20("XP Reward", "XPR", 18);
        
        // Step 2: Deploy the XP Manager
        // Replace with your actual reward token address
        address rewardTokenAddress = vm.envAddress("REWARD_TOKEN_ADDRESS");
        XPManager xpManager = new XPManager(rewardTokenAddress);
        
        // Step 3: Deploy the OwnsCitizenNFT verifier
        OwnsCitizenNFT citizenVerifier = new OwnsCitizenNFT();
        
        // Step 4: Register the verifier with a condition ID
        // Condition ID 1 = OwnsCitizenNFT verifier
        xpManager.registerVerifier(1, address(citizenVerifier));
        
        // Step 5: Optional - Register additional verifiers
        // xpManager.registerVerifier(2, address(otherVerifier));
        
        vm.stopBroadcast();
        
        console.log("XP System deployed successfully!");
        console.log("XPManager address:", address(xpManager));
        console.log("OwnsCitizenNFT verifier address:", address(citizenVerifier));
        console.log("Reward token address:", rewardTokenAddress);
        console.log("Verifier registered with condition ID: 1");
    }
}
