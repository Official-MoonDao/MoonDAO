// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/tables/JobBoardTable.sol";
import "../src/tables/MarketplaceTable.sol";

// Deploys new JobBoardTable and MarketplaceTable contracts with operator support.
// The deployer becomes owner and can immediately set operators without needing
// the multisig Safe.
//
// Usage:
//   forge script script/DeployTableOperators.s.sol \
//     --rpc-url https://arb1.arbitrum.io/rpc \
//     --broadcast \
//     --private-key $PRIVATE_KEY
//
// After deployment, update JOBS_TABLE_ADDRESSES and MARKETPLACE_TABLE_ADDRESSES
// in ui/const/config.ts with the printed addresses.

contract DeployTableOperators is Script {
    // MoonDAOTeam contract on Arbitrum
    address constant MOON_DAO_TEAM = 0xAB2C354eC32880C143e87418f80ACc06334Ff55F;

    // Operators to whitelist (Pablo + Ryan)
    address constant PABLO = 0x679d87D8640e66778c3419D164998E720D7495f6;
    address constant RYAN  = 0xB2d3900807094D4Fe47405871B0C8AdB58E10D42;

    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPk);

        // Deploy JobBoardTable
        JobBoardTable jobBoard = new JobBoardTable("JOBBOARD");
        jobBoard.setMoonDaoTeam(MOON_DAO_TEAM);
        jobBoard.setOperator(PABLO, true);
        jobBoard.setOperator(RYAN, true);

        // Deploy MarketplaceTable
        MarketplaceTable marketplace = new MarketplaceTable("MARKETPLACE");
        marketplace.setMoonDaoTeam(MOON_DAO_TEAM);
        marketplace.setOperator(PABLO, true);
        marketplace.setOperator(RYAN, true);

        vm.stopBroadcast();

        console.log("=== Update ui/const/config.ts with these addresses ===");
        console.log("JobBoardTable (arbitrum):    ", address(jobBoard));
        console.log("MarketplaceTable (arbitrum): ", address(marketplace));
    }
}
