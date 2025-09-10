// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/XPManager.sol";
import "../src/XPOracle.sol";
import "../src/verifiers/HasVotingPowerStaged.sol";
import "../src/verifiers/HasVotedStaged.sol";
import "../src/verifiers/HasTokenBalanceStaged.sol";
import "../src/verifiers/HasCreatedATeam.sol";
import "../src/verifiers/HasContributedStaged.sol";
import "../src/verifiers/HasCompletedCitizenProfile.sol";
import "../src/verifiers/HasBoughtAMarketplaceListingStaged.sol";
import "../src/verifiers/HasJoinedATeam.sol";
import "../src/verifiers/HasSubmittedPRStaged.sol";
import "../src/verifiers/HasSubmittedIssue.sol";
import "../src/verifiers/CitizenReferralsStaged.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployXPManagerScript is Script {
    function run() external {
        // Get configuration from environment
        address authorizedSignerAddress = vm.envAddress("HSM_SIGNER_ADDRESS");
        address oracleAddress = vm.envAddress("ORACLE_ADDRESS");
        address rewardToken = vm.envAddress("REWARD_TOKEN");
        address citizenNFTAddress = vm.envAddress("CITIZEN_ADDRESS");
        address daoSafeAddress = vm.envAddress("DAO_SAFE_ADDRESS");

        if (oracleAddress == address(0)) {
            revert("No oracle address provided");
        }

        if (authorizedSignerAddress == address(0)) {
            revert("No HSM signer address provided");
        }

        if (daoSafeAddress == address(0)) {
            revert("No DAO safe address provided");
        }

        // Start broadcast
        vm.startBroadcast();

        // Deploy XPManager implementation
        XPManager implementation = new XPManager();
        
        // Deploy proxy and initialize
        bytes memory initData = abi.encodeWithSelector(XPManager.initialize.selector);
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        XPManager xpManager = XPManager(address(proxy));

        // Deploy single verifiers
        HasJoinedATeam hasJoinedATeamVerifier = new HasJoinedATeam(oracleAddress, 5);
        HasCreatedATeam hasCreatedTeamVerifier = new HasCreatedATeam(oracleAddress, 5);
        HasCompletedCitizenProfile hasCompletedCitizenProfileVerifier = new HasCompletedCitizenProfile(oracleAddress, 5);
        HasSubmittedIssue hasSubmittedIssueVerifier = new HasSubmittedIssue(oracleAddress, 5);

        // Deploy staged verifiers
        HasVotingPowerStaged votingPowerVerifier = new HasVotingPowerStaged(oracleAddress);
        HasVotedStaged hasVotedVerifier = new HasVotedStaged(oracleAddress);
        HasTokenBalanceStaged hasTokenBalanceVerifier = new HasTokenBalanceStaged(oracleAddress);
        HasContributedStaged hasContributedVerifier = new HasContributedStaged(oracleAddress);
        HasBoughtAMarketplaceListingStaged hasBoughtAMarketplaceListingVerifier =
            new HasBoughtAMarketplaceListingStaged(oracleAddress);
        HasSubmittedPRStaged hasSubmittedPRVerifier = new HasSubmittedPRStaged(oracleAddress);
        CitizenReferralsStaged citizenReferralsVerifier = new CitizenReferralsStaged(oracleAddress);

        // Set XPManager address
        votingPowerVerifier.setXPManager(address(xpManager));
        hasVotedVerifier.setXPManager(address(xpManager));
        hasTokenBalanceVerifier.setXPManager(address(xpManager));
        hasContributedVerifier.setXPManager(address(xpManager));
        hasBoughtAMarketplaceListingVerifier.setXPManager(address(xpManager));
        hasSubmittedPRVerifier.setXPManager(address(xpManager));
        citizenReferralsVerifier.setXPManager(address(xpManager));

        // Set GCP HSM signer as authorized signer
        citizenReferralsVerifier.setAuthorizedSigner(authorizedSignerAddress);

        // Register verifiers
        xpManager.registerVerifier(0, address(votingPowerVerifier));
        xpManager.registerVerifier(1, address(hasVotedVerifier));
        xpManager.registerVerifier(2, address(hasTokenBalanceVerifier));
        xpManager.registerVerifier(3, address(hasCreatedTeamVerifier));
        xpManager.registerVerifier(4, address(hasContributedVerifier));
        xpManager.registerVerifier(5, address(hasCompletedCitizenProfileVerifier));
        xpManager.registerVerifier(6, address(hasBoughtAMarketplaceListingVerifier));
        xpManager.registerVerifier(7, address(hasJoinedATeamVerifier));
        xpManager.registerVerifier(8, address(hasSubmittedIssueVerifier));
        xpManager.registerVerifier(9, address(hasSubmittedPRVerifier));
        xpManager.registerVerifier(10, address(citizenReferralsVerifier));


        // Set up XP levels
        uint256[] memory thresholds = new uint256[](6);
        uint256[] memory levels = new uint256[](6);
        
        thresholds[0] = 25;    // 25 XP = Level 1 (basic activities)
        thresholds[1] = 100;   // 100 XP = Level 2 (moderate engagement)  
        thresholds[2] = 300;   // 300 XP = Level 3 (active user)
        thresholds[3] = 750;   // 750 XP = Level 4 (very active user)
        thresholds[4] = 1500;  // 1500 XP = Level 5 (power user)
        thresholds[5] = 3000;  // 3000 XP = Level 6 (whale/elite user)
        
        levels[0] = 1;
        levels[1] = 2;
        levels[2] = 3;
        levels[3] = 4;
        levels[4] = 5;
        levels[5] = 6;

        // Set XP levels
        xpManager.setXPLevels(thresholds, levels);

        // Set ERC20 reward configuration with conversion rate
        // Example: 1 XP = 1 ERC20 tokens (assuming 18 decimals)
        uint256 conversionRate = 1e18; // 1 * 10^18
        
        xpManager.setERC20RewardConfig(address(rewardToken), conversionRate);
        
        // Set citizen NFT address for citizenship verification
        if (citizenNFTAddress != address(0)) {
            xpManager.setCitizenNFTAddress(citizenNFTAddress);
        }

        // Transfer ownership to DAO Safe
        xpManager.transferOwnership(daoSafeAddress);
        votingPowerVerifier.transferOwnership(daoSafeAddress);
        hasVotedVerifier.transferOwnership(daoSafeAddress);
        hasTokenBalanceVerifier.transferOwnership(daoSafeAddress);
        hasContributedVerifier.transferOwnership(daoSafeAddress);
        hasBoughtAMarketplaceListingVerifier.transferOwnership(daoSafeAddress);
        hasSubmittedPRVerifier.transferOwnership(daoSafeAddress);
        citizenReferralsVerifier.transferOwnership(daoSafeAddress);
        hasJoinedATeamVerifier.transferOwnership(daoSafeAddress);
        hasCreatedTeamVerifier.transferOwnership(daoSafeAddress);
        hasCompletedCitizenProfileVerifier.transferOwnership(daoSafeAddress);
        hasSubmittedIssueVerifier.transferOwnership(daoSafeAddress);

        console.log("=== DEPLOYMENT SUMMARY ===");
        console.log("XPManager Proxy:", address(xpManager));
        console.log("XPManager Implementation:", address(implementation));
        console.log("DAO Safe Address:", daoSafeAddress);
        console.log("HSM Signer Address:", authorizedSignerAddress);
        console.log("All contracts transferred to DAO Safe");
        
        vm.stopBroadcast();
    }
}
