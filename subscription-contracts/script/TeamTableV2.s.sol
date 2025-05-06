pragma solidity ^0.8.20;

/*
Deploying a new Team Table:
1. Run the script
2. Migrate the old team table to the new table /script/migrate/migrateTeamTable.js
3. Update the uri template for the team contract
4. creator.setMoonDaoTeamTable();
*/

import "forge-std/Script.sol";
import "../src/tables/TeamTableV2.sol";

contract MyScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        MoonDAOTeamTable teamTable = new MoonDAOTeamTable("TEAMTABLE");
        teamTable.setMoonDaoTeam(0xAB2C354eC32880C143e87418f80ACc06334Ff55F);

        vm.stopBroadcast();
    }
}