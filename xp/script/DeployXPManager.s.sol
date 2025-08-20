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

contract DeployXPManagerScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address oracleAddress = vm.envAddress("ORACLE_ADDRESS");
        address rewardToken = vm.envAddress("REWARD_TOKEN");

        if (oracleAddress == address(0)) {
            revert("No oracle address provided");
        }

        vm.startBroadcast(deployerPrivateKey);

        // Deploy XPManager (no constructor parameters needed)
        XPManager xpManager = new XPManager();

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

        // Set XPManager for staged verifiers
        votingPowerVerifier.setXPManager(address(xpManager));
        hasVotedVerifier.setXPManager(address(xpManager));
        hasTokenBalanceVerifier.setXPManager(address(xpManager));
        hasContributedVerifier.setXPManager(address(xpManager));
        hasBoughtAMarketplaceListingVerifier.setXPManager(address(xpManager));
        hasSubmittedPRVerifier.setXPManager(address(xpManager));

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

        // Set up XP levels: More realistic progression based on actual verifier rewards
        uint256[] memory thresholds = new uint256[](6);
        uint256[] memory levels = new uint256[](6);
        
        thresholds[0] = 50;    // 50 XP = Level 1 (achievable with basic activities)
        thresholds[1] = 150;   // 150 XP = Level 2 (moderate engagement)
        thresholds[2] = 300;   // 300 XP = Level 3 (active user)
        thresholds[3] = 600;   // 600 XP = Level 4 (very active user)
        thresholds[4] = 1000;  // 1000 XP = Level 5 (power user)
        thresholds[5] = 2000;  // 2000 XP = Level 6 (whale/elite user)
        
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

        // CRITICAL: Set XPManager address on all staged verifiers
        // This allows XPManager to call updateUserStage() and other protected functions
        votingPowerVerifier.setXPManager(address(xpManager));
        hasVotedVerifier.setXPManager(address(xpManager));
        hasTokenBalanceVerifier.setXPManager(address(xpManager));
        hasContributedVerifier.setXPManager(address(xpManager));
        hasBoughtAMarketplaceListingVerifier.setXPManager(address(xpManager));
        hasSubmittedPRVerifier.setXPManager(address(xpManager));
        
        vm.stopBroadcast();
    }
}
