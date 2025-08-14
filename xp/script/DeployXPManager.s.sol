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

        // Deploy staged verifiers
        HasVotingPowerStaged votingPowerVerifier = new HasVotingPowerStaged(oracleAddress);
        HasVotedStaged hasVotedVerifier = new HasVotedStaged(oracleAddress);
        HasTokenBalanceStaged hasTokenBalanceVerifier = new HasTokenBalanceStaged(rewardToken);
        HasContributedStaged hasContributedVerifier = new HasContributedStaged(oracleAddress);
        HasBoughtAMarketplaceListingStaged hasBoughtAMarketplaceListingVerifier = new HasBoughtAMarketplaceListingStaged(oracleAddress);

        // Register verifiers
        xpManager.registerVerifier(0, address(votingPowerVerifier));
        xpManager.registerVerifier(1, address(hasVotedVerifier));
        xpManager.registerVerifier(2, address(hasTokenBalanceVerifier)); 
        xpManager.registerVerifier(3, address(hasCreatedTeamVerifier));
        xpManager.registerVerifier(4, address(hasContributedVerifier));
        xpManager.registerVerifier(5, address(hasCompletedCitizenProfileVerifier));
        xpManager.registerVerifier(6, address(hasBoughtAMarketplaceListingVerifier));
        xpManager.registerVerifier(7, address(hasJoinedATeamVerifier));

        uint256[] memory thresholds = new uint256[](4);
        thresholds[0] = 100;
        thresholds[1] = 500;
        thresholds[2] = 1000; 
        thresholds[3] = 5000;
        uint256[] memory rewards = new uint256[](4);
        rewards[0] = 10e18;
        rewards[1] = 50e18;
        rewards[2] = 100e18;
        rewards[3] = 500e18;

        xpManager.setERC20RewardConfig(
            address(rewardToken),
            thresholds,
            rewards
        );
        
        vm.stopBroadcast();
    }
}
